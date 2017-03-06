(function() {
	'use strict';

	/**
	 * @description
	 * Setup Wizard is module to change MiFi's Wi-Fi setting and login password.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.setupWizard
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.setupWizard', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol', 'tpmifix.mod.home'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('setupWizard', {
					url: '/setupWizard',
					templateUrl: 'mod/setupWizard/mod.html',
					controller: 'setupWizardCtrl as setupWizard'
				})
				.state('setupWizard-login', {
					url: '/setupWizard-login',
					templateUrl: 'mod-setupWizard-login.html',
					controller: 'setupWizardLoginCtrl as setupWizardLogin'
				})
				.state('setupWizard-wifi', {
					url: '/setupWizard-wifi',
					templateUrl: 'mod-setupWizard-wifi.html',
					controller: 'setupWizardWifiCtrl as setupWizardWifi',
				})
				.state('setupWizard-end', {
					url: '/setupWizard-end',
					templateUrl: 'mod-setupWizard-end.html',
					controller: 'setupWizardEndCtrl as setupWizardEnd',
				});

		}
	])

	.value('swShare', {
		login: {},
		wifi: {},
		backupWifi: {}
	})

	.factory('swUtil', [

		function() {
			return {
				switchInputType: function(obj) {
					if (obj.data.local.inputType === 'password') {
						obj.data.local.iconColor = 'positive';
						obj.data.local.inputType = 'text';
					} else {
						obj.data.local.iconColor = '';
						obj.data.local.inputType = 'password';
					}
				}
			};
		}
	])

	.controller('setupWizardCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', 'homeValue',
		function(tpService, tpUtil, tpProtocol, $scope, homeValue) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				unloaded: unloadedCallback
			}, true);
			homeValue.preventFactoryJump = true;

			function enterCallback() {
				tpService.authService.factory.login();
			}

			function unloadedCallback() {
				// Avoid some unexpected cases, e.g. login kicked out
				homeValue.preventFactoryJump = false;
			}
		}
	])

	.controller('setupWizardLoginCtrl', ['swShare', 'swUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(swShare, swUtil, tpService, tpUtil, tpProtocol, $scope) {
			var setupWizardLogin = this;

			tpService.modService.initMod($scope, undefined, true);

			setupWizardLogin.data = {
				local: {
					"password": "",
					"passwordStrength": 0,
					"inputType": "password",
					"iconColor": "",
					"CONSTANT": {
						"STRONG": 3,
						"MIDDLE": 2,
						"WEAK": 1
					}
				}
			};

			setupWizardLogin.action = {
				checkLoginPasswordStrength: function() {
					if (setupWizardLogin.data.local.password !== undefined) {
						setupWizardLogin.data.local.passwordStrength = tpUtil.checkUtil.loginPassword.strength(setupWizardLogin.data.local.password);
					} else {
						setupWizardLogin.data.local.passwordStrength = 0;
					}
				},
				switchInputType: function() {
					swUtil.switchInputType(setupWizardLogin);
				},
				jumpToWifi: function() {
					swShare.login.password = setupWizardLogin.data.local.password;
					tpService.linkService.gotoMod('setupWizard-wifi');
				}
			};
		}
	])

	.controller('setupWizardWifiCtrl', ['swShare', 'swUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(swShare, swUtil, tpService, tpUtil, tpProtocol, $scope) {
			var setupWizardWifi = this;

			tpService.modService.initMod($scope, {
				enter: enterCallback
			}, true);

			setupWizardWifi.data = {
				local: {
					// Use array for `select:option` control.
					bands: [{
						type: 0,
						name: "WIFI.CONTENT.BAND_2"
					}, {
						type: 1,
						name: "WIFI.CONTENT.BAND_5"
					}],
					"inputType": "password",
					"iconColor": ""
				},
				server: {},
				backup: {}
			};
			// Default selected `option`.
			setupWizardWifi.data.local.band = setupWizardWifi.data.local.bands[0];

			setupWizardWifi.action = {
				switchInputType: function() {
					swUtil.switchInputType(setupWizardWifi);
				},
				jumpToLogin: function() {
					swShare.backupWifi = setupWizardWifi.data;
					tpService.linkService.gotoMod('setupWizard-login');
				},
				jumpToEnd: function() {
					setupWizardWifi.data.server.wlan.bandType = setupWizardWifi.data.local.band.type;
					if (setupWizardWifi.data.server.wlan.mixed.key !== '') {
						// If password is not empty, turn on security switch
						setupWizardWifi.data.server.wlan.securityMode = 1;
					} else {
						// If password is empty, turn off security switch
						setupWizardWifi.data.server.wlan.securityMode = 0;
					}
					// If data not changed, just back to the front page.
					if (tpUtil.diffUtil.isAllEqual(setupWizardWifi.data.server.wlan, setupWizardWifi.data.backup.wlan)) {
						swShare.wifi = {};
					} else {
						// NOTE: As the bad backend codes compatibility, App must delete some fields before submit to backend.
						// I means the current *json protocol* is unreliable, and App must do request according to Webpage's code practice.
						delete setupWizardWifi.data.server.wlan.result;
						delete setupWizardWifi.data.server.wlan.apIsolation;
						delete setupWizardWifi.data.server.wlan.channel;
						delete setupWizardWifi.data.server.wlan.mixed.mode;
						delete setupWizardWifi.data.server.wlan.region;
						delete setupWizardWifi.data.server.wlan.wirelessMode;
						angular.copy(setupWizardWifi.data.server.wlan, swShare.wifi);
					}
					swShare.backupWifi = setupWizardWifi.data;
					tpService.linkService.gotoMod('setupWizard-end');
				}
			};

			var updateView = {
				wlan: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					// re-init data.
					setupWizardWifi.data.server.wlan = data;
					// deep copy
					setupWizardWifi.data.backup.wlan = {};
					angular.copy(data, setupWizardWifi.data.backup.wlan);

					setupWizardWifi.data.local.band = setupWizardWifi.data.local.bands[setupWizardWifi.data.server.wlan.bandType];
					// setupWizardWifi.data.local.isHideSSID = !setupWizardWifi.data.server.wlan.ssidBcast;
				}
			};

			function enterCallback() {
				requestData();
			}

			function requestData() {
				if (swShare.backupWifi.local !== undefined) {
					setupWizardWifi.data = swShare.backupWifi;
					return;
				}
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: 'wlan',
					action: 0,
					callback: function(data) {
						//tpService.promptService.loading.hide();
						updateView.wlan(data);
					}
				});
			}
		}
	])

	.controller('setupWizardEndCtrl', ['swShare', 'tpService', 'tpUtil', 'tpProtocol', '$scope', 'homeValue',
		function(swShare, tpService, tpUtil, tpProtocol, $scope, homeValue) {
			var setupWizardEnd = this;

			tpService.modService.initMod($scope, {
				enter: enterCallback
			}, true);

			setupWizardEnd.data = {
				local: {
					bands: [{
						type: 0,
						name: "WIFI.CONTENT.BAND_2"
					}, {
						type: 1,
						name: "WIFI.CONTENT.BAND_5"
					}],
					CONSTANT: {
						HIDE_PASSWORD: "******"
					}
				},
				server: {},
				backup: {}
			};

			setupWizardEnd.action = {
				switchLoginPasswd: function() {
					if (setupWizardEnd.data.local.loginPassword === setupWizardEnd.data.local.CONSTANT.HIDE_PASSWORD) {
						setupWizardEnd.data.local.loginPassword = swShare.login.password;
					} else {
						setupWizardEnd.data.local.loginPassword = setupWizardEnd.data.local.CONSTANT.HIDE_PASSWORD;
					}
				},
				switchWifiPasswd: function() {
					if (setupWizardEnd.data.local.wifiPassword === setupWizardEnd.data.local.CONSTANT.HIDE_PASSWORD) {
						setupWizardEnd.data.local.wifiPassword = swShare.backupWifi.server.wlan.mixed.key;
					} else {
						setupWizardEnd.data.local.wifiPassword = setupWizardEnd.data.local.CONSTANT.HIDE_PASSWORD;
					}
				},
				finish: function() {
					savePassword(saveWifi);
				}
			};

			var updateView = {
				check: function() {
					$scope.swShare = swShare;
					setupWizardEnd.data.local.loginPassword = setupWizardEnd.data.local.CONSTANT.HIDE_PASSWORD;
					setupWizardEnd.data.local.wifiPassword = setupWizardEnd.data.local.CONSTANT.HIDE_PASSWORD;
					setupWizardEnd.data.local.band = setupWizardEnd.data.local.bands[0];
				}
			};

			function enterCallback() {
				updateView.check();
			}

			function savePassword(callback) {
				tpService.promptService.loading.show('COMMON.CONTENT.SAVING');
				tpService.authService.factory.setPassword(swShare.login.password, function(data, isUpdateSuccess) {
					tpService.promptService.loading.hide();
					if (isUpdateSuccess) {
						//tpService.promptService.toast.success('LOGIN.CONTENT.SET_PASSWORD_OK');
						tpService.dataSharingService.set('isFactory', false);
						tpService.localDataService.setDevice('login.password', swShare.login.password);
						callback();
					} else {
						tpService.promptService.toast.error('LOGIN.CONTENT.SET_PASSWORD_FAIL');
					}
				});
			}

			function saveWifi() {
				if (swShare.wifi.ssid === undefined) {
					cleanShare();
					homeValue.preventFactoryJump = false;
					tpService.linkService.goBackHome();
				} else {
					tpService.promptService.loading.show('WIFI.CONTENT.RESTARTING');
					tpService.serverDataService.request({
						module: 'wlan',
						action: 1,
						data: swShare.wifi,
						callback: function(data) {
							tpService.promptService.loading.hide();
							if (data && data.result === 0) {
								// tpService.promptService.toast.success('COMMON.CONTENT.SAVED');
								cleanShare();
								homeValue.preventFactoryJump = false;
								tpService.promptService.popup.alert("SETUP_WIZARD_END.CONTENT.TIPS.END", "SETUP_WIZARD.CONTENT.BTN.END", function() {
									if (window.cordova && window.cordova.plugins && window.cordova.plugins.settings) {
										cordova.plugins.settings.open('wifi');
									}
									// Back to the home page.
									tpService.linkService.goBackHome();
								});
							} else {
								tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
							}
						}
					});
				}
			}

			function cleanShare() {
				swShare.login = null;
				swShare.wifi = null;
				swShare.backupWifi = null;
			}
		}
	]);

})();
