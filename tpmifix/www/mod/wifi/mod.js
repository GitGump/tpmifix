(function() {
	'use strict';

	/**
	 * @description
	 * WiFi is module to control MiFi's Wi-Fi setting.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.wifi
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.wifi', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('wifi', {
					url: '/wifi',
					templateUrl: 'mod/wifi/mod.html',
					controller: 'wifiCtrl as wifi'
				})
		}
	])

	.controller('wifiCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					// Use array for `select:option` control.
					bands: [{
						type: 0,
						name: "WIFI.CONTENT.BAND_2"
					}, {
						type: 1,
						name: "WIFI.CONTENT.BAND_5"
					}],
					isHideSSID: false
				},
				server: {},
				backup: {}
			};
			// Default selected `option`.
			$scope.data.local.band = $scope.data.local.bands[0];

			$scope.action = {
				submit: function() {
					// Some data process
					if ($scope.data.server.wlan.mixed.key !== '') {
						// If password is not empty, turn on security switch
						$scope.data.server.wlan.securityMode = 1;
					} else {
						// If password is empty, turn off security switch
						$scope.data.server.wlan.securityMode = 0;
					}
					// Popup message for user if needed.
					tpService.promptService.popup.confirm('WIFI.CONTENT.RESTART_PROMPT', 'COMMON.CONTENT.PROMPT_TITLE.CONFIRM', function(isOK) {
						if (isOK) {
							// NOTE: As the bad backend codes compatibility, App must delete some fields before submit to backend.
							// I means the current *json protocol* is unreliable, and App must do request according to Webpage's code practice.
							delete $scope.data.server.wlan.result;
							delete $scope.data.server.wlan.apIsolation;
							delete $scope.data.server.wlan.channel;
							delete $scope.data.server.wlan.mixed.mode;
							delete $scope.data.server.wlan.region;
							delete $scope.data.server.wlan.wirelessMode;

							saveData($scope.data.server.wlan);
						}
					});
				},
				changeBand: function() {
					$scope.data.server.wlan.bandType = $scope.data.local.band.type;
				},
				hideSSID: function() {
					$scope.data.server.wlan.ssidBcast = !$scope.data.local.isHideSSID;
				}
			};

			var updateView = {
				// Update view about `wlan` module
				wlan: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					// re-init data.
					$scope.data.server.wlan = data;
					// deep copy
					$scope.data.backup.wlan = {};
					angular.copy(data, $scope.data.backup.wlan);

					$scope.data.local.band = $scope.data.local.bands[$scope.data.server.wlan.bandType];
					$scope.data.local.isHideSSID = !$scope.data.server.wlan.ssidBcast;
				}
			}

			function enterCallback() {
				requestData();
			}

			function requestData() {
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

			function saveData(data) {
				tpService.promptService.loading.show('WIFI.CONTENT.RESTARTING');
				tpService.serverDataService.request({
					module: 'wlan',
					action: 1,
					data: data,
					callback: function(data) {
						tpService.promptService.loading.hide();

						if (data && data.result === 0) {
							tpService.promptService.toast.success('COMMON.CONTENT.SAVED');
							// If set success, back to the front page.
							tpService.linkService.goBack();
							return;
						} else {
							tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
							// If set fail, refresh the current page.
							requestData();
						}
					}
				});
			}
		}
	])

})();
