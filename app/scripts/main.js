$.getJSON('/lobbymail/data/data.json').then(function (data) {
'use strict';
/* global Ember, FastClick */

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
}

FastClick.attach(document.body);

if (!localStorage) localStorage = []; /* jshint ignore:line */

var $appWrapper = $('#app-wrapper');
var App = Ember.Application.create({ rootElement: $appWrapper, });
var undefined; /* jshint ignore:line */

App.ApplicationController = Ember.Controller.extend({
	updateCurrentPath: function() {
		var path = this.get('currentPath').split('.');
		var className = path.pop();
		while (path.length && className === 'index') {
			className = path.pop();
		}
		$appWrapper.attr('class', className);
	}.observes('currentPath')
}),

App.Inbox = Ember.Object.extend({
	threads: null,
	unreadCount: function () {
		return this.get('threads').reduce(function (sum, thread) {
			return sum + thread.get('unreadCount');
		}, 0);
	}.property('threads.@each.unreadCount'),
});
App.Inbox.reopenClass({
	find: function () {
		return App.FIXTURES.inbox;
	},
});
App.Folder = Ember.Object.create({
	files: [],
	push: function (file) {
		this.get('files').push(file);
	},
	find: function (id) {
		if (id) {
			return this.get('files').findBy('id', id);
		} else {
			return this.get('files');
		}
	},
});
App.File = Ember.Object.extend({
	id: function () {
		try {
			return this.get('name').replace(/\.[^\/]*$/, '');
		} catch (e) {
			console.error(this);
		}
	}.property('name'),
	path: function () {
		var p = [ '/data' ];
		if (this.get('message')) {
			p.push('attachments');
		} else {
			p.push('files');
		}
		p.push(this.name);
		return p.join('/');
	}.property('name'),
	pageCount: function () {
		if (!this.pages) return null;
		return this.pages.length;
	},
	friendlyName: function () {
		var name = this.get('name').replace(/\..+?$/, '').replace(/[^a-z0-9äöüß\.-]+/ig, ' ');
		return name;
	}.property('name'),
	type: function () {
		var type = this.get('name').split('.').pop().toLowerCase();
		if (type === 'docx') return 'doc';
		return type;
	}.property('name'),
	typeClass: function () {
		return 'file-' + this.get('type');
	}.property('type'),
	isAttachment: function () {
		return !!this.get('message');
	}.property('message'),
	init: function () {
		var me = this;
		App.Folder.push(this);
		if (this.pages) this.pages.forEach(function (page, i) {
			var path = me.get('path').split('/');
			var basename = path.pop();
			path.push('previews');
			path.push(basename.replace(/\..*?$/, '-' + (i+1) + '.png'));
			page.path = path.join('/');
			page.width = page.size[0];
			page.height = page.size[1];
		});
	}
});
App.FileController = Ember.Controller.extend({
	zoom: 1,
});

App.Thread = Ember.Object.extend({
	id: null,
	messages: [],
	date: function () {
		return this.get('messages').get('lastObject').get('date');
	}.property('messages'),
	count: function () {
		return this.get('messages').length;
	}.property('messages'),
	attachmentCount: function () {
		return this.get('messages').reduce(function (sum, message) {
			return sum + message.get('attachmentCount');
		}, 0);
	}.property('messages.@each.attachmentCount'),
	hasAttachments: function () {
		return !!this.get('attachmentCount');
	}.property('attachmentCount'),
	subject: function () {
		try {
			return this.get('messages').get('lastObject').get('subject').replace(/^(Re|Fwd|AW|WG):\s*/gi, '');
		} catch (e) {
			return 'Kein Betreff';
		}
	}.property('messages'),
	unreadCount: function () {
		return this.get('messages').filterBy('unread').length;
	}.property('messages.@each.unread'),
	unreadClass: function () {
		var unreadCount = this.get('unreadCount');
		if (unreadCount === 0) return 'unread-none';
		if (unreadCount === this.get('count')) return 'unread-all';
		return 'unread-some';
	}.property('unreadCount'),
	initiator: function () {
		var person = this.get('messages').get('firstObject').get('from')[0];
		var r = { name: person.name };
		if (!person.name) r.name = person.email;
		if (person.email) r.affiliation = person.email.match(/@(.*?)\./)[1];
		return r;
	}.property('messages'),
	description: function () {
		return pluralHelper(this.get('unreadCount'), {
			0: 'Keine ungelesenen Nachrichten',
			1: '1 ungelesene Nachricht',
			default: '%d ungelesene Nachrichten',
		}) +
		pluralHelper(this.get('attachmentCount'), {
			0: '',
			1: '; 1 Dateianhang',
			default: '; %d Dateianhänge',
		});
	}.property('unreadCount'),

	init: function () {
		var me = this;
		this.get('messages').forEach(function (m) { m.thread = me; });
	}
});
App.Thread.reopenClass({
	find: function (id) {
		if (id !== undefined) {
			return App.FIXTURES.inbox.threads.findBy('id', id);
		} else {
			return App.FIXTURES.inbox.threads;
		}
	}
});
App.Message = Ember.Object.extend({
	id: null,
	from: null,
	to: null,
	cc: null,
	subject: null,
	date: null,
	attachments: null,
	unread: true,
	body: null,

	attachmentCount: function () {
		if (this.attachments) return this.attachments.length;
		return 0;
	}.property('attachments'),

	unreadStateHasChanged: function () {
		localStorage['unread'+this.id] = +this.unread;
	}.observes('unread'),

	init: function () {
		var me = this;
		this.set('date', new Date(this.get('date')));
		this.set('id', this.get('date').valueOf());
		this.set('body', this.get('body').replace(/\n{3,}/g, '\n\n'));
		if (localStorage) {
			var unread = +localStorage['unread'+this.id];
			if (unread === 0) this.set('unread', false);
		}
		if (this.from && this.from.length === 0) this.set('from', null);
		if (this.to && this.to.length === 0) this.set('to', null);
		if (this.cc && this.cc.length === 0) this.set('cc', null);
		if (this.attachments && this.attachments.length === 0) this.set('attachments', null);
		if (this.attachments) this.set('attachments', this.get('attachments').map(function (attachment) {
			try {
				attachment.message = me;
			} catch (e) {
				attachment = {
					name: attachment,
					message: me,
				};
			}
			return App.File.create(attachment);
		}));
	},
});

App.FIXTURES = {
	inbox: App.Inbox.create({
		threads: data.threads.map(function (thread) {
			thread.messages = thread.messages.map(function (message) {
				message.thread = thread;
				return App.Message.create(message);
			});
			return App.Thread.create(thread);
		}),
	}),
};
data.files.forEach(function (file) {
	App.File.create(file);
});

App.Router.map(function() {
	this.resource('index', { path: '/'}, function () {
		this.resource('inbox', function () {
			this.resource('thread', { path: '/:thread_id' }, function () {
				this.resource('attachment', { path: '/:file_name' });
			});
		});
		this.resource('files', function () {
			this.resource('file', { path: '/:file_name' });
		});
	});
});
App.Router.reopen({
	location: 'auto',
	rootURL: '/lobbymail/',
});

App.ApplicationRoute = Ember.Route.extend({
	model: function () {
		return {
			inbox: App.Inbox.find(),
		};
	}
});

App.IndexRoute = Ember.Route.extend({
	beforeModel: function () {
		//this.transitionTo('inbox');
	}
});

App.InboxRoute = Ember.Route.extend({
	model: function () {
		return App.Inbox.find().get('threads').sortBy('date');
	}
});

App.FilesRoute = Ember.Route.extend({
	model: function () {
		return App.Folder.find().sortBy('friendlyName');
	}
});

App.FileRoute = Ember.Route.extend({
	model: function (params) {
		return App.Folder.find(params.file_name);
	},
});

App.AttachmentRoute = Ember.Route.extend({
	model: function (params) {
		return App.Folder.find(params.file_name);
	},
});

App.ThreadRoute = Ember.Route.extend({
	model: function (params) {
		return App.Thread.find(+params.thread_id);
	},
	afterModel: function () {
		$(document).scrollTop(0);
	},
});

App.ThreadController = Ember.Controller.extend({
	actions: {
		markAsRead: function (message) {
			message.set('unread', false);
		},
	}
});

App.Scrolling = Ember.Mixin.create({
	bindScrolling: function(el) {
		var onScroll, me = this;
		if (!el) el = this.element;

		onScroll = debounce(function() { return me.scrolled(); }, 50, true);
		$(el).bind('touchmove', onScroll);
		$(el).bind('scroll', onScroll);
	},

	unbindScrolling: function(el) {
		if (!el) el = this.element;
		$(el).unbind('scroll');
		$(el).unbind('touchmove');
	}

});

App.ThreadView = Ember.View.extend(App.Scrolling, {
	classNames: ['messages', 'detail-view'],
	didInsertElement: function () {
		this.bindScrolling(document);
	},
	willDestroyElement: function () {
		this.unbindScrolling(document);
	},
	scrolled: function () {
		var $this = $(this.element);
		// Iterate over all articles in the view and find the last one above
		// 33% of the viewport height
		var targetHeight = $(window).scrollTop() + $(window).height()/3;
		$this.find('article').each(function (i, article) {
			var $article = $(article);
			var top = $article.position().top;
			var bottom = top + $article.innerHeight();
			if (top < targetHeight && bottom > targetHeight) {
				$article.click();
				return false;
			}
		});
	},
});

App.FileView = Ember.View.extend({
	classNames: ['file-view'],
	didInsertElement: function () {
		$('input[type="range"]').rangeslider({
			polyfill: false,
		});
	}
});

var months = 'Januar Februar März April Mai Juni Juli August September Oktober November Dezember'.split(' ');
function zerofill (n, len) {
	n = ''+n;
	while (n.length < len) {
		n = '0'+n;
	}
	return n;
}
Ember.Handlebars.helper('date', function (date) {
	if (+date === 0) return new Ember.Handlebars.SafeString('Unbekanntes Datum');
	date = new Date(date);
	return new Ember.Handlebars.SafeString(
		date.getDate() + '. ' + months[date.getMonth()] + ' ' + date.getFullYear() + ' ' +
		zerofill(date.getHours(), 2) + ':' + zerofill(date.getMinutes(), 2)
	);
});
Ember.Handlebars.helper('filesize', function (bytes) {
	var units = ['B', 'kB', 'MB', 'GB'];
	while (bytes >= 1000) {
		bytes /= 1000;
		units.shift();
	}
	return Math.round(bytes) + ' ' + units.shift();
});
function pluralHelper (n, args) {
	var rules = args.hash? args.hash : args;
	return ((rules[n] !== undefined)? rules[n] : rules.default).replace(/%d/g, n);
}
Ember.Handlebars.helper('plural', pluralHelper);

// Zoomable containers
var defaultZoom = 0.94;
$(document).on('input change', '.zoom-control', function () {
	var zoom = +$(this).val();
	setZoom($(this).parents('.controls').siblings('.zoomable'), zoom);
});
var gestureStartZoom, gestureStartFingerDist, zooming = false;
function fingerDistance (event) {
	if (event.originalEvent) event = event.originalEvent;
	var x = (event.touches[0].clientX - event.touches[1].clientX);
	var y = (event.touches[0].clientY - event.touches[1].clientY);
	return Math.sqrt(x*x + y*y);
}
$(document).on('touchstart', '.zoomable', function (ev) {
	if (ev.originalEvent.touches.length === 2) {
		zooming = true;
		gestureStartZoom = $(this).data('zoom') || defaultZoom;
		gestureStartFingerDist = fingerDistance(ev);
	} else {
		zooming = false;
	}
});
$(document).on('touchmove', '.zoomable', function (ev) {
	if (!zooming) return;

	ev.preventDefault();
	var $this = $(this);
	var dist = fingerDistance(ev);
	setZoom($this, dist / gestureStartFingerDist * gestureStartZoom);
});

function setZoom (element, zoom, center) {
	var $element = $(element);
	var oldZoom = $element.data('zoom') || defaultZoom;
	$element.data('zoom', zoom);
	var zoomChange = zoom / oldZoom;

	if (!center) { center = [0.5, 0.5]; }
	var x = center[0];
	var y = center[1];

	var addLeft = (zoomChange - 1) * x;
	var addTop = (zoomChange - 1) * y;

	$element.find('img').css('height', (zoom * 100) + 'vh');
	var scrollLeft = zoomChange * $element.scrollLeft() + addLeft * $element.width();
	var scrollTop = zoomChange * $element.scrollTop() + addTop * $element.height();
	if ($element.scrollTop() === 0) scrollTop = 0;

	$element.scrollLeft(scrollLeft).scrollTop(scrollTop);
}

// Quick UI enhancements
$(document).on('click', '.overlay', function (ev) {
	var $target = $(ev.target);
	if (!$target.is('p.page')) return;
	$target.parents('.overlay').find('.close').click();
});
// Key Bindings
var ESCAPE_KEY = 27;
$(document).on('keyup', function (ev) {
	if (ev.keyCode === ESCAPE_KEY) {
		$('.overlay .close').click();
	}
});

});
