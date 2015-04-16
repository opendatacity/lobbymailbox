$.getJSON('/data/threads.json').then(function (data) {
'use strict';
/* global Ember */

var App = Ember.Application.create();
var undefined;

App.Thread = Ember.Object.extend({
	id: null,
	messages: [],
	count: function () {
		return this.get('messages').length;
	}.property('messages'),
	attachmentCount: function () {
		return this.get('messages')[0].attachments.length;
	}.property('messages'),
	hasAttachments: function () {
		return !!this.get('attachmentCount');
	}.property('messages'),
	subject: function () {
		return this.get('messages')[0].subject.replace(/^(Re|Fwd|AW|WG):\s*/gi, '');
	}.property('messages'),
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
});

App.FIXTURES = data.threads.map(function (thread) {
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

});
