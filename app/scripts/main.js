$.getJSON('/data/threads.json').then(function (data) {
'use strict';
/* global Ember */

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

if (!localStorage) localStorage = [];

var $appWrapper = $('#app-wrapper');
var App = Ember.Application.create({ rootElement: $appWrapper, });
var undefined;

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
		return this.get('messages').get('lastObject').get('attachments').length;
	}.property('messages'),
	hasAttachments: function () {
		return !!this.get('attachmentCount');
	}.property('messages'),
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
	}.property('unreadClass'),

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

	unreadStateHasChanged: function () {
		localStorage['unread'+this.id] = +this.unread;
	}.observes('unread'),

	init: function () {
		this.set('date', new Date(this.get('date')));
		if (localStorage) {
			var unread = +localStorage['unread'+this.id];
			if (unread === 0) this.set('unread', false);
		}
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
	}
});

App.ThreadController = Ember.ObjectController.extend({
	actions: {
		markAsRead: function (message) {
			message.set('unread', false);
		},
	}
});

App.Scrolling = Ember.Mixin.create({
	bindScrolling: function() {
		var onScroll, me = this;

		onScroll = debounce(function() { return me.scrolled(); }, 100);
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
	willRemoveElement: function () {
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
				return false;
			}
		});
	},
});

});
