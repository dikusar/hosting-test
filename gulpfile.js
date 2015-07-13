/*eslint "no-var":0 */
'use strict';

var
	browserify = require('browserify'),
	browserSync = require('browser-sync'),
	duration = require('gulp-duration'),
	gulp = require('gulp'),
	gutil = require('gulp-util'),
	jade = require('gulp-jade'),
	notifier = require('node-notifier'),
	path = require('path'),
	prefix = require('gulp-autoprefixer'),
	replace = require('gulp-replace'),
	rev = require('gulp-rev'),
	rimraf = require('rimraf'),
	source = require('vinyl-source-stream'),
	sourcemaps = require('gulp-sourcemaps'),
	streamify = require('gulp-streamify'),
	stylus = require('gulp-stylus'),
	uglify = require('gulp-uglify'),
	watchify = require('watchify'),
	minifyCss = require('gulp-minify-css'),
	concat = require('gulp-concat'),
	rename = require("gulp-rename");

/*eslint "no-process-env":0 */
var production = process.env.NODE_ENV === 'production';

var config = {
	destination: './dist',
	scripts: {
		source: './app/js/common.js',
		destination: './dist/assets/js/',
		extensions: ['.jsx'],
		filename: 'common.js'
	},
	templates: {
		source: './app/jade/pages/*.jade',
		watch: './app/jade/**/*.jade',
		destination: './dist/',
		revision: './dist/**/*.html'
	},
	styles: {
		source: './app/stylus/common.styl',
		watch: './app/stylus/**/*.styl',
		destination: './dist/assets/css/'
	},
	assets: {
		source: './app/assets/**/*.*',
		watch: './app/assets/**/*.*',
		destination: './dist/'
	},
	revision: {
		source: ['./dist/**/*.css', './dist/**/*.js'],
		base: path.join(__dirname, 'dist'),
		destination: './dist/'
	}
};

var browserifyConfig = {
	entries: [config.scripts.source],
	extensions: config.scripts.extensions,
	debug: !production,
	cache: {},
	packageCache: {}
};

function handleError(err) {
	gutil.log(err);
	gutil.beep();
	notifier.notify({
	title: 'Compile Error',
	message: err.message
	});
	return this.emit('end');
}

gulp.task('compress', function() {
  return gulp.src([
  	'./app/js/libs/jquery/dist/jquery.min.js',
  	'./app/js/common.js'
  	])
    .pipe(concat('common.min.js'))
    .pipe(gulp.dest(config.scripts.destination));
});

gulp.task('minify-css', function() {
	return gulp.src('./dist/assets/css/*.css')
		.pipe(minifyCss())
		.pipe(rename())
		.pipe(gulp.dest(config.styles.destination));
});

gulp.src('./dist/assets/css/common.css', { base: process.cwd() })
	.pipe(rename({
		suffix: '.min'
	}));

gulp.task('scripts', function() {
	var pipeline = browserify(browserifyConfig)
	.bundle()
	.on('error', handleError)
	.pipe(source(config.scripts.filename));

	if(production) {
		pipeline = pipeline.pipe(streamify(uglify()));
	}

	return pipeline.pipe(gulp.dest(config.scripts.destination));
});

gulp.task('templates', function() {
	var pipeline = gulp.src(config.templates.source)
	.pipe(jade({
		pretty: !production
	}))
	.on('error', handleError)
	.pipe(gulp.dest(config.templates.destination));

	if(production) {
		return pipeline;
	}

	return pipeline.pipe(browserSync.reload({
		stream: true
	}));
});

gulp.task('styles', function() {
	var pipeline = gulp.src(config.styles.source);

	if(!production) {
		pipeline = pipeline.pipe(sourcemaps.init());
	}

	pipeline = pipeline.pipe(stylus({
		'include css': true,
		compress: production
	}))
	.on('error', handleError)
	.pipe(prefix('last 2 versions', 'Chrome 34', 'Firefox 28', 'iOS 7'));

	if(!production) {
		pipeline = pipeline.pipe(sourcemaps.write('.'));
	}

	pipeline = pipeline.pipe(gulp.dest(config.styles.destination));

	if(production) {
		return pipeline;
	}

	return pipeline.pipe(browserSync.stream({
		match: '**/*.css'
	}));
});

gulp.task('assets', function() {
	return gulp.src(config.assets.source)
	.pipe(gulp.dest(config.assets.destination));
});

gulp.task('server', function() {
	return browserSync({
		open: false,
		port: 9001,
		server: {
			baseDir: config.destination
		}
	});
});

gulp.task('watch', function() {
	gulp.watch(config.templates.watch, ['templates']);
	gulp.watch(config.styles.watch, ['styles']);
	gulp.watch(config.assets.watch, ['assets']);

	var bundle = watchify(browserify(browserifyConfig));

	bundle.on('update', function() {
	var build = bundle.bundle()
		.on('error', handleError)
		.pipe(source(config.scripts.filename));

	build.pipe(gulp.dest(config.scripts.destination))
	.pipe(duration('Rebundling browserify bundle'))
	.pipe(browserSync.reload({stream: true}));
	}).emit('update');
});

var buildTasks = ['templates', 'styles', 'assets', 'minify-css', 'compress'];

gulp.task('revision', buildTasks.concat(['scripts']), function() {
	return gulp.src(config.revision.source, {base: config.revision.base})
	.pipe(rev())
	.pipe(gulp.dest(config.revision.destination))
	.pipe(rev.manifest())
	.pipe(gulp.dest('./'));
});

gulp.task('replace-revision-references', ['revision', 'templates'], function() {
	var revisions = require('./rev-manifest.json');

	var pipeline = gulp.src(config.templates.revision);

	pipeline = Object.keys(revisions).reduce(function(stream, key) {
		return stream.pipe(replace(key, revisions[key]));
	}, pipeline);

	return pipeline.pipe(gulp.dest(config.templates.destination));
});

gulp.task('build', function() {
	rimraf.sync(config.destination);
	gulp.start(buildTasks.concat(['scripts', 'revision', 'replace-revision-references']));
});

gulp.task('default', buildTasks.concat(['watch', 'server']));
