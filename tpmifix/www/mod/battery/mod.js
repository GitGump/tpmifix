(function() {
	'use strict';

	/**
	 * @description
	 * Battery is module to control MiFi's battery settings.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.battery
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.battery', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('battery', {
					url: '/battery',
					templateUrl: 'mod/battery/mod.html',
					controller: 'batteryCtrl'
				})
				.state('battery-sleepTime', {
					url: '/battery-sleepTime',
					templateUrl: 'mod-battery-sleepTime.html',
					controller: 'batterySleepTimeCtrl'
				})
		}
	])

	.value('batteryValue', {
		MOD: {
			BATTERY: 'battery',
			WLAN: 'wlan'
		},
		ACTION: {
			GET_CONFIG: 0,
			SET_CONFIG: 1
		},
		autoDisableTimes: [{
			type: 0,
			name: "BATTERY.CONTENT.SLEEP_TIME_5"
		}, {
			type: 1,
			name: "BATTERY.CONTENT.SLEEP_TIME_15"
		}, {
			type: 2,
			name: "BATTERY.CONTENT.SLEEP_TIME_30"
		}, {
			type: 3,
			name: "BATTERY.CONTENT.SLEEP_TIME_60"
		}],
		wlan: {}
	})

	.factory('batteryUtil', ['tpService',
		function(tpService) {
			var saveData = function(moduleName, data, saveCallback) {
				tpService.serverDataService.request({
					module: moduleName,
					action: 1,
					data: data,
					callback: function(data) {
						if (typeof(saveCallback) === 'function') {
							saveCallback(data);
						} else {
							if (!data || data.result !== 0) {
								tpService.promptService.toast.error('COMMON.CONTENT.FAILED');
							}
						}
					}
				});
			}

			var getSleepTime = function(type) {
				var ret = 0;
				switch (type) {
					case 0:
						ret = 300;
						break;
					case 1:
						ret = 900;
						break;
					case 2:
						ret = 1800;
						break;
					case 3:
						ret = 3600;
						break;
				}
				return ret;
			}

			var getSleepType = function(time) {
				var ret = 0;
				switch (time / 60) {
					case 5:
						ret = 0;
						break;
					case 15:
						ret = 1;
						break;
					case 30:
						ret = 2;
						break;
					case 60:
						ret = 3;
						break;
				}
				return ret;
			}

			return {
				saveData: saveData,
				getSleepTime: getSleepTime,
				getSleepType: getSleepType
			}
		}
	])

	.controller('batteryCtrl', ['batteryValue', 'batteryUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(batteryValue, batteryUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					images: {
						batteryPic: ''
					},
					autoDisableTime: batteryValue.autoDisableTimes[0],
					autoDisableTimes: batteryValue.autoDisableTimes,
					saveModeSwitch: false
				},
				server: {
					wlan: {}
				}
			};

			$scope.action = {
				switchOn: function() {
					if ($scope.data.local.saveModeSwitch === false) {
						$scope.data.server.wlan.autoDisableTime = 0;
					} else {
						$scope.data.local.saveModeSwitch = true;
						$scope.data.server.wlan.autoDisableTime = batteryUtil.getSleepTime($scope.data.local.autoDisableTime.type);
					}
					batteryUtil.saveData(batteryValue.MOD.WLAN, $scope.data.server.wlan);
				}
			};

			var updateView = {
				battery: function() {
					$scope.data.server.battery = tpService.dataSharingService.get('status').battery;

					var isCharging, voltage;
					if ($scope.data.server.battery.charging && $scope.data.server.battery.voltage < 100) {
						isCharging = 'charging';
					} else {
						isCharging = 'normal';
					}
					voltage = Math.floor($scope.data.server.battery.voltage / 10) * 10;
					$scope.data.local.images.batteryPic = tpService.modService.getModImgUrl('battery_' + voltage + '_' + isCharging + '.png');
				},

				wlan: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					$scope.data.server.wlan = data;
					batteryValue.wlan = data;

					if ($scope.data.server.wlan.autoDisableTime === 0) {
						$scope.data.local.saveModeSwitch = false;
					} else {
						$scope.data.local.saveModeSwitch = true;
						$scope.data.local.autoDisableTime = $scope.data.local.autoDisableTimes[batteryUtil.getSleepType($scope.data.server.wlan.autoDisableTime)];
					}
				}
			}

			function enterCallback() {
				requestData();
				updateView.battery();
			}

			function requestData() {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: batteryValue.MOD.WLAN,
					action: batteryValue.ACTION.GET_CONFIG,
					callback: function(data) {
						//tpService.promptService.loading.hide();
						updateView.wlan(data);
					}
				});
			}
		}
	])

	.controller('batterySleepTimeCtrl', ['batteryValue', 'batteryUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(batteryValue, batteryUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					autoDisableTimes: batteryValue.autoDisableTimes
				},
				server: {
					wlan: batteryValue.wlan
				},
				backup: {}
			}

			$scope.data.local.autoDisableTime = $scope.data.local.autoDisableTimes[batteryUtil.getSleepType($scope.data.server.wlan.autoDisableTime)];
			$scope.data.backup.autoDisableTime = $scope.data.local.autoDisableTime;

			$scope.action = {
				submit: function(sleepTime) {
					if ($scope.data.local.autoDisableTime === $scope.data.backup.autoDisableTime) {
						tpService.linkService.goBack();
						return;
					}
					$scope.data.server.wlan.autoDisableTime = batteryUtil.getSleepTime($scope.data.local.autoDisableTime.type);
					batteryUtil.saveData(batteryValue.MOD.WLAN, $scope.data.server.wlan, $scope.action.saveCallback);
				},
				saveCallback: function(data) {
					tpService.linkService.goBack();
					if (!data || data.result !== 0) {
						tpService.promptService.toast.error('COMMON.CONTENT.FAILED');
					}
				}
			}
		}
	])

})();
