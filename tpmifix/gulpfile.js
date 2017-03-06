var bower = require('bower');
var concat = require('gulp-concat');
var gulp = require('gulp');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var minifyCss = require('gulp-minify-css');
var os = require('os');
var prettify = require('gulp-jsbeautifier');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var sh = require('shelljs');
var shell = require('gulp-shell');
var Server = require('karma').Server;

// 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
var platform = os.platform();

var paths = {
	sass: ['./scss/**/*.scss'],
	css: {
		lib: [
			'www/lib/angular-loading-bar/build/loading-bar.css',
			'www/lib/angular-toastr/dist/angular-toastr.css'
		],
		core: [],
		mod: [
			'www/mod/common/css/ionic.app.css',
			'www/mod/common/css/style.css'
		]
	},
	js: {
		lib: [
			'www/lib/angular/angular.js',
			'www/lib/angular-animate/angular-animate.js',
			'www/lib/angular-loading-bar/build/loading-bar.js',
			'www/lib/angular-local-storage/dist/angular-local-storage.js',
			'www/lib/angular-messages/angular-messages.js',
			'www/lib/angular-mocks/angular-mocks.js',
			'www/lib/angular-pdf-viewer/dist/angular-pdf-viewer.min.js',
			'www/lib/angular-sanitize/angular-sanitize.js',
			'www/lib/angular-thumbnails/dist/angular-thumbnails.js',
			'www/lib/angular-toastr/dist/angular-toastr.js',
			'www/lib/angular-translate/angular-translate.js',
			'www/lib/angular-translate-loader-partial/angular-translate-loader-partial.js',
			'www/lib/angular-ui-router/release/angular-ui-router.js',
			'www/lib/async/dist/async.js',
			'www/lib/cryptojslib/rollups/md5.js',
			'www/lib/ionic/js/ionic.js',
			'www/lib/ionic/js/ionic-angular.js',
			'www/lib/oclazyload/dist/ocLazyLoad.js',
			'www/lib/pdfjs-dist/build/pdf.js',
			'www/lib/videogular/videogular.js',
			'www/lib/videogular-controls/vg-controls.js',
			'www/lib/videogular-overlay-play/vg-overlay-play.js',
			'www/lib/videogular-poster/vg-poster.js',
			'www/lib/videogular-buffering/vg-buffering.js'
		],
		core: [
			'www/js/*.js'
		],
		mod: [
			'www/mod/**/mod.js'
		],
		test: [
			'www/mod/**/test.js'
		]
	}
};

//== utils ==//
var _extend = function(oa, ob) {
	// loop through ob
	for (var i in ob) {
		// check if the extended ob has that property
		if (ob.hasOwnProperty(i)) {
			// now check if oa's child is also object so we go through it recursively
			if (typeof oa[i] == "object" && oa.hasOwnProperty(i) && oa[i] != null) {
				oa[i] = _extend(oa[i], ob[i]);
			} else {
				oa[i] = ob[i];
			}
		}
	}
	return oa;
};


//== watch file change ==//
gulp.task('watch', function() {
	gulp.watch(paths.sass, ['sass']);
});

//== install js lib ==//
gulp.task('install', ['git-check'], function() {
	return bower.commands.install()
		.on('log', function(data) {
			gutil.log('bower', gutil.colors.cyan(data.id), data.message);
		});
});

gulp.task('git-check', function(done) {
	if (!sh.which('git')) {
		console.log(
			'  ' + gutil.colors.red('Git is not installed.'),
			'\n  Git, the version control system, is required to download Ionic.',
			'\n  Download git here:', gutil.colors.cyan('http://git-scm.com/downloads') + '.',
			'\n  Once git is installed, run \'' + gutil.colors.cyan('gulp install') + '\' again.'
		);
		process.exit(1);
	}
	done();
});

//== convert sass/scss to css ==//
gulp.task('sass', function(done) {
	gulp.src('./scss/ionic.app.scss')
		.pipe(sass({
			errLogToConsole: true
		}))
		.pipe(gulp.dest('./www/mod/common/css/'))
		.pipe(minifyCss({
			keepSpecialComments: 0
		}))
		.pipe(rename({
			extname: '.min.css'
		}))
		.pipe(gulp.dest('./www/mod/common/css/'))
		.on('end', done);
});

//== run jslint ==//
gulp.task('lint', function() {
	return gulp.src(paths.js.core.concat(paths.js.mod))
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'));
});

//== karma unit testing ==//
var karmaConfig = {
	configFile: __dirname + '/karma.conf.js',
	basePath: './',
	files: paths.js.lib.concat(paths.js.core, paths.js.mod, paths.js.test),
	port: 9876
};

// Run test once and exit.
gulp.task('test', function(done) {
	if (platform == "darwin") {
		new Server(_extend(karmaConfig, {
			browsers: ['Safari'],
			singleRun: true
		}), done).start();
	} else {
		new Server(_extend(karmaConfig, {
			browsers: ['Chrome'],
			singleRun: true
		}), done).start();
	}
});

// Watch (Detecting) for file changes and re-run Tests on each change during Development.
gulp.task('tdd', function(done) {
	if (platform == "darwin") {
		new Server(_extend(karmaConfig, {
			browsers: ['Safari'],
			singleRun: false
		}), done).start();
	} else {
		new Server(_extend(karmaConfig, {
			browsers: ['Chrome'],
			singleRun: false
		}), done).start();
	}
});

//== prettify codes ==//
gulp.task('prettify', function() {
	var config = {
		html: {
			indent_char: ' ',
			indent_size: 2
		},
		css: {
			indent_char: ' ',
			indent_size: 2
		},
		js: {
			file_types: ['.js', '.json', '.config'],
			indent_char: '\t',
			indent_size: 1
		}
	};
	//gulp.src(['./www/index.html'])
	//.pipe(prettify(config))
	//.pipe(gulp.dest('./www/'));
	gulp.src(['./www/js/*.js'])
		.pipe(prettify(config))
		.pipe(gulp.dest('./www/js/'));
	gulp.src(['./www/mod/**/*.json', './www/mod/**/*.js', './www/mod/**/*.html', './www/mod/**/*.css', '!./www/mod/common/css/ionic*.css', './www/mod/**/i18n/*.json', './www/mod/**/*.config'])
		.pipe(prettify(config))
		.pipe(gulp.dest('./www/mod/'));
});

//== collect i18n file ==//
gulp.task('i18n.zip', shell.task([
	'find www/mod  -name  "*.json" | xargs zip tpmifix-i18n-$(date +"%y%m%d")-origin.zip'
]));

gulp.task('i18n.unzip', shell.task([
	'unzip -o tpmifix-i18n.zip'
]));

//== generate jsdoc ==//
gulp.task('jsdoc', shell.task([
	'rm -Rf jsdoc', // Delete old jsdoc directory at first
	'node_modules/jsdoc/jsdoc.js ' +
	'-c node_modules/angular-jsdoc/common/conf.json ' + // config file
	'-t node_modules/angular-jsdoc/angular-template ' + // template file
	'-d jsdoc ' + // output directory
	'../README.md ' + // to include README.md as index contents
	'-r www/js www/mod' // source code directory
]));

//== default task ==//
gulp.task('default', ['lint', 'test']);
