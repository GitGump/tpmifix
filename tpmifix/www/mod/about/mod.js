(function() {
	'use strict';

	/**
	 * @description
	 * About is module to show MiFi's app version and update.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.about
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.about', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('about', {
					url: '/about',
					templateUrl: 'mod/about/mod.html',
					controller: 'aboutCtrl'
				})
		}
	])

	.controller('aboutCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', '$window',
		function(tpService, tpUtil, tpProtocol, $scope, $window) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			}, true);

			$scope.data = {
				local: {
					images: {
						logo: tpService.modService.getModImgUrl('logo.png')
					},
					hasNewVer: tpService.localDataService.getApp('hasNewVer') || false,
					noticeOn: tpService.notificationService.isNotifyOn(),
					companyHomepage: 'www.tp-link.com.cn'
				}
			};

			$scope.action = {
				update: function() {
					if ($scope.data.local.hasNewVer) {
						tpService.appUpdateService.gotoAppStore();
					} else {
						tpService.promptService.loading.show("ABOUT.CONTENT.CHECKING");
						tpService.appUpdateService.checkUpdateFromAppStore(function(result) {
							tpService.promptService.loading.hide();
							if (result == tpService.appUpdateService.result.NEW_VER) {
								$scope.data.local.hasNewVer = true;
								tpService.localDataService.setApp('hasNewVer', true);
							} else if (result == tpService.appUpdateService.result.NO_NEW_VER) {
								tpService.promptService.toast.info("ABOUT.CONTENT.NO_NEW_VERSION");
								tpService.localDataService.setApp('hasNewVer', false);
							} else if (result == tpService.appUpdateService.result.NO_INTERNET) {
								tpService.promptService.toast.warning("ABOUT.CONTENT.NO_INTERNET");
								tpService.localDataService.clearApp('hasNewVer');
							} else if (result == tpService.appUpdateService.result.NOT_SUPPORTED_PLATFORM) {
								tpService.promptService.toast.info("ABOUT.CONTENT.NO_NEW_VERSION");
								tpService.localDataService.clearApp('hasNewVer');
							} else {
								tpService.promptService.toast.info("ABOUT.CONTENT.NO_NEW_VERSION");
								tpService.localDataService.clearApp('hasNewVer');
							}
						});
					}
				},
				notice: function() {
					if ($scope.data.local.noticeOn) {
						tpService.permissionService.checkNotification(function(granted) {
							if (!granted) {
								$scope.data.local.noticeOn = false;
								tpService.promptService.popup.confirm('ABOUT.CONTENT.PERMISSION_DENIED', 'ABOUT.CONTENT.NOTIFICATION', function callback(isOK) {
									if (isOK) {
										if (window.cordova && window.cordova.plugins.settings) {
											cordova.plugins.settings.open();
										}
									}
								});
							} else {
								tpService.notificationService.enable();
							}
						});
					} else {
						tpService.notificationService.disable();
					}
				},
				openCompanyUrl: function() {
					if (window.cordova && window.cordova.InAppBrowser) {
						// Open url in system browser
						cordova.InAppBrowser.open('http://' + $scope.data.local.companyHomepage, '_system', 'location=yes');
					} else {
						$window.open('http://' + $scope.data.local.companyHomepage, '_blank');
					}
				}
			};

			function enterCallback() {
				// When user view App about info, should prevent auto go home when disconnected from device.
				tpService.linkService.preventAutoJumpWhenError();
			}

			function beforeLeaveCallback() {
				tpService.linkService.allowAutoJumpWhenError();
			}
		}
	])

})();
