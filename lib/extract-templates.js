'use strict';

var fs = require('fs');
var File = require('vinyl');
var jsdom = require('jsdom');
var gutil = require('gulp-util');
var through = require('through2');
var compiler = require('../app/bower_components/ember/ember-template-compiler.js');

module.exports = through.obj(function (file, encoding, next) {
	if (file.isStream()) {
		return next(new gutil.PluginError('extract-templates', 'Streaming not supported'));
	}
	var pipeline = this;
	jsdom.env(file.contents.toString(), function (errors, window) {
		var templates = window.document.querySelectorAll('script[type="text/x-handlebars"]');
		var compiled = Array.prototype.slice.call(templates).map(function (t) {
			t.parentNode.removeChild(t);
			var c = compiler.precompile(t.innerHTML, false);
			return 'Ember.TEMPLATES["'+ t.getAttribute('data-template-name') +
				'"] = Ember.HTMLBars.template(' + c + ');';
		}).join('\n');
		var scripts = window.document.querySelectorAll('script');
		var injectedScriptTag = window.document.createElement('script');
		injectedScriptTag.setAttribute('src', '/scripts/templates.js');
		for (var i=0, script; script=scripts[i]; i++) {
			if (!script.getAttribute('src')) continue;
			if (script.getAttribute('src').indexOf('ember-template-compiler') !== -1) {
				script.parentNode.removeChild(script);
			}
			if (script.getAttribute('src').indexOf('main.js') !== -1) {
				script.parentNode.insertBefore(injectedScriptTag, script);
			}
		}
		file.contents = new Buffer(jsdom.serializeDocument(window.document).replace('/script><script', '/script>\n<script'));
		var templatesFile = new File({
			cwd: file.cwd,
			base: file.base + 'scripts/',
			path: file.base + 'scripts/templates.js',
			contents: new Buffer(compiled),
		});
		fs.writeFile(templatesFile.path, templatesFile.contents, function (err) {
			pipeline.push(file);
			//pipeline.push(templatesFile);
			next(err);
		});
	});
});
