(function() {
	'use strict';

	/**
	 * @description
	 * This is the first loaded module of the App. You can say it's the entry of the App.
	 *
	 * Set `<body ng-app="tpmifix">` to bind it to index.html DOM.
	 *
	 * @ngdoc overview
	 * @name tpmifix
	 * @requires ionic
	 * @requires tpmifix.mod
	 */
	angular.module('tpmifix', ['ionic', 'tpmifix.service'])

	.run(['$ionicPlatform', '$timeout',
		function($ionicPlatform, $timeout) {
			$ionicPlatform.ready(function() {
				// Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
				// for form inputs)
				if (window.cordova && window.cordova.plugins.Keyboard) {
					cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
				}
				// Hide splash screen after App starts over 3s.
				if (navigator.splashscreen) {
					$timeout(function() {
						navigator.splashscreen.hide();
					}, 3000);
				}
			});
		}
	])

})();
