'use strict';

var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var extractTemplates = require('./lib/extract-templates');
var through = require('through2');

// load plugins
var $ = require('gulp-load-plugins')();

gulp.task('styles', function () {
	return gulp.src('app/styles/main.scss')
		.pipe($.rubySass({
			style: 'expanded',
			precision: 10
		}))
		.pipe($.autoprefixer('last 1 version'))
		.pipe(gulp.dest('.tmp/styles'))
		.pipe($.size());
});

gulp.task('scripts', function () {
	return gulp.src('app/scripts/**/*.js')
		.pipe($.jshint())
		.pipe($.jshint.reporter(require('jshint-stylish')))
		.pipe($.size());
});

gulp.task('html', ['styles', 'scripts'], function () {
	var jsFilter = $.filter('**/*.js');
	var cssFilter = $.filter('**/*.css');
	var htmlFilter = $.filter('**/*.html');
	var notHTMLFilter = $.filter('!**/*.html');

	return gulp.src('app/*.html')
		.pipe(extractTemplates)
		.pipe($.useref.assets({searchPath: '{.tmp,app}'}))
		.pipe(jsFilter)
		.pipe($.uglify({
			preserveComments: 'some',
		}))
		.pipe(jsFilter.restore())
		.pipe(cssFilter)
		.pipe($.csso())
		.pipe(cssFilter.restore())
		.pipe($.useref.restore())
		.pipe($.useref())
		.pipe(htmlFilter)
		.pipe(gulp.dest('dist/'))
		.pipe(htmlFilter.restore())
		.pipe(notHTMLFilter)
		.pipe(gulp.dest('dist/'))
		.pipe(notHTMLFilter.restore())
		.pipe($.size());
});

gulp.task('fonts', function () {
	return gulp.src('app/fonts/*')
		.pipe($.filter('**/*.{eot,svg,ttf,woff,woff2}'))
		.pipe($.flatten())
		.pipe(gulp.dest('dist/fonts/'))
		.pipe($.size());
});

gulp.task('data', ['html'], function () {
	return gulp.src('app/data/*')
		.pipe(gulp.dest('dist/data/'));
});

gulp.task('extras', function () {
	return gulp.src(['app/*.*', '!app/*.html'], { dot: true })
		.pipe(gulp.dest('dist/'));
});

gulp.task('clean', function () {
	return gulp.src(['.tmp', 'dist'], { read: false }).pipe($.clean());
});

gulp.task('build', ['html', 'fonts', 'data', 'extras']);

gulp.task('default', ['clean'], function () {
	gulp.start('build');
});

gulp.task('connect', function () {
	var connect = require('connect');
	var app = connect()
		.use(require('connect-livereload')({ port: 35729 }))
		.use(require('connect-history-api-fallback')())
		.use(connect.static('app'))
		.use(connect.static('.tmp'))
		.use(connect.directory('app'));

	require('http').createServer(app)
		.listen(9000)
		.on('listening', function () {
			console.log('Started connect web server on http://localhost:9000');
		});
});

gulp.task('serve', ['connect', 'styles'], function () {
	require('opn')('http://localhost:9000');
});

// inject bower components
gulp.task('wiredep', function () {
	var wiredep = require('wiredep').stream;

	gulp.src('app/styles/*.scss')
		.pipe(wiredep({
			directory: 'app/bower_components'
		}))
		.pipe(gulp.dest('app/styles'));

	gulp.src('app/*.html')
		.pipe(wiredep({
			directory: 'app/bower_components'
		}))
		.pipe(gulp.dest('app'));
});

gulp.task('watch', ['connect', 'serve'], function () {
	var server = $.livereload();

	// watch for changes

	gulp.watch([
		'app/*.html',
		'.tmp/styles/**/*.css',
		'app/scripts/**/*.js',
	]).on('change', function (file) {
		server.changed(file.path);
	});

	gulp.watch('app/styles/**/*.scss', ['styles']);
	gulp.watch('app/scripts/**/*.js', ['scripts']);
	gulp.watch('bower.json', ['wiredep']);
});
