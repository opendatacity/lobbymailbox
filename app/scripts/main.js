$.getJSON('/data/threads.json').then(function (data) {
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
		var className = this.get('currentPath').split('.').pop();
		$appWrapper.attr('class', className);
	}.observes('currentPath')
}),

App.Thread = Ember.Object.extend({
	id: null,
	messages: [],
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
		return this.get('messages').get('lastObject').get('subject').replace(/^(Re|Fwd|AW|WG):\s*/gi, '');
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
		this.set('messages', this.get('messages').sortBy('date'));
	}
});
App.Thread.reopenClass({
	find: function (id) {
		if (id !== undefined) {
			return App.FIXTURES.findBy('id', id);
		} else {
			return App.FIXTURES;
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
		this.set('date', new Date(this.get('date')));
		this.set('body', this.get('body').replace(/\n{3,}/g, '\n\n'));
		if (localStorage) {
			var unread = +localStorage['unread'+this.id];
			if (unread === 0) this.set('unread', false);
		}
		if (this.from && this.from.length === 0) this.set('from', null);
		if (this.to && this.to.length === 0) this.set('to', null);
		if (this.cc && this.cc.length === 0) this.set('cc', null);
		if (this.attachments && this.attachments.length === 0) this.set('attachments', null);
	},
});

App.FIXTURES = data.threads.map(function (thread) {
	thread.messages = thread.messages.map(function (message) {
		return App.Message.create(message);
	});
	return App.Thread.create(thread);
});

App.Router.map(function() {
	this.resource('index', { path: '/'}, function () {
		this.resource('thread', { path: '/threads/:thread_id' });
	});
});
App.Router.reopen({
	location: 'auto',
});

App.ApplicationRoute = Ember.Route.extend({
	model: function () {
		return App.Thread.find();
	}
});

App.ThreadRoute = Ember.Route.extend({
	model: function (params) {
		return App.Thread.find(+params.thread_id);
	},
	afterModel: function () {
		$('.messages').scrollTop(0);
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
	bindScrolling: function() {
		var onScroll, me = this;

		onScroll = debounce(function() { return me.scrolled(); }, 100, true);
		$(this.element).bind('touchmove', onScroll);
		$(this.element).bind('scroll', onScroll);
	},

	unbindScrolling: function() {
		$(this.element).unbind('scroll');
		$(this.element).unbind('touchmove');
	}

});

App.ThreadView = Ember.View.extend(App.Scrolling, {
	classNames: ['messages'],
	didInsertElement: function () {
		this.bindScrolling();
	},
	willDestroyElement: function () {
		this.unbindScrolling();
	},
	scrolled: function () {
		var $this = $(this.element);
		// Iterate over all articles in the view and find the last one above
		// 33% of the viewport height
		var targetHeight = $this.height()/3;
		$this.find('article').each(function (i, article) {
			var $article = $(article);
			var top = $article.position().top;
			var bottom = top + $article.innerHeight();
			if (top < targetHeight && bottom > targetHeight) {
				$article.click();
				//if (article.id) history.replaceState(null, null, '#'+article.id);
				return false;
			}
		});
	},
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
	date = new Date(date);
	return new Ember.Handlebars.SafeString(
		date.getDate() + '. ' + months[date.getMonth()] + ' ' + date.getFullYear() + ' ' +
		zerofill(date.getHours(), 2) + ':' + zerofill(date.getMinutes(), 2)
	);
});
function pluralHelper (n, args) {
	var rules = args.hash? args.hash : args;
	return ((rules[n] !== undefined)? rules[n] : rules.default).replace(/%d/g, n);
}
Ember.Handlebars.helper('plural', pluralHelper);

});
