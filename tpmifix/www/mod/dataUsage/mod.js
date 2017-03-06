(function() {
	'use strict';

	/**
	 * @description
	 * Data usage is module to control MiFi's data usage settings.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.dataUsage
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.dataUsage', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol', 'tpmifix.mod.home'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('dataUsage', {
					url: '/dataUsage',
					templateUrl: 'mod/dataUsage/mod.html',
					controller: 'dataUsageCtrl'
				})
				.state('dataUsage-limitType', {
					url: '/dataUsage-limitType',
					templateUrl: 'mod-dataUsage-limitType.html',
					controller: 'dataUsageLimitTypeCtrl'
				})
				.state('dataUsage-startDay', {
					url: '/dataUsage-startDay',
					templateUrl: 'mod-dataUsage-startDay.html',
					controller: 'dataUsageStartDayCtrl'
				})
				.state('dataUsage-monthDataUsed', {
					url: '/dataUsage-monthDataUsed',
					templateUrl: 'mod-dataUsage-flow.html',
					controller: 'dataUsageMonthDataUsedCtrl as flow'
				})
				.state('dataUsage-monthDataAllowance', {
					url: '/dataUsage-monthDataAllowance',
					templateUrl: 'mod-dataUsage-flow.html',
					controller: 'dataUsageMonthDataAllowanceCtrl as flow'
				})
				.state('dataUsage-monthTimeUsed', {
					url: '/dataUsage-monthTimeUsed',
					templateUrl: 'mod-dataUsage-time.html',
					controller: 'dataUsageMonthTimeUsedCtrl as time'
				})
				.state('dataUsage-monthTimeAllowance', {
					url: '/dataUsage-monthTimeAllowance',
					templateUrl: 'mod-dataUsage-time.html',
					controller: 'dataUsageMonthTimeAllowanceCtrl as time'
				})
				.state('dataUsage-totalDataUsed', {
					url: '/dataUsage-totalDataUsed',
					templateUrl: 'mod-dataUsage-flow.html',
					controller: 'dataUsageTotalDataUsedCtrl as flow'
				})
				.state('dataUsage-totalDataAllowance', {
					url: '/dataUsage-totalDataAllowance',
					templateUrl: 'mod-dataUsage-flow.html',
					controller: 'dataUsageTotalDataAllowanceCtrl as flow'
				})
				.state('dataUsage-totalTimeUsed', {
					url: '/dataUsage-totalTimeUsed',
					templateUrl: 'mod-dataUsage-time.html',
					controller: 'dataUsageTotalTimeUsedCtrl as time'
				})
				.state('dataUsage-totalTimeAllowance', {
					url: '/dataUsage-totalTimeAllowance',
					templateUrl: 'mod-dataUsage-time.html',
					controller: 'dataUsageTotalTimeAllowanceCtrl as time'
				})
				.state('dataUsage-usageAlert', {
					url: '/dataUsage-usageAlert',
					templateUrl: 'mod-dataUsage-usageAlert.html',
					controller: 'dataUsageUsageAlertCtrl'
				})
		}
	])

	.constant('dataUsageConstant', {
		ACTION: {
			GET_CONFIG: 0,
			SET_CONFIG: 1,
			GET_STAT: 2,
			CLEAR_STAT: 3,
			GET_HISTORY: 4,
			CLEAR_HISTORY: 5
		}
	})

	.value('dataUsageValue', {
		settings: {},
		stat: {}
	})

	.factory('dataUsageUtil', ['dataUsageConstant', 'tpUtil', 'tpService',
		function(dataUsageConstant, tpUtil, tpService) {
			var saveData = function(data, saveCallback) {
				tpService.serverDataService.request({
					module: 'flowstat',
					action: dataUsageConstant.ACTION.SET_CONFIG,
					data: data,
					callback: function(data) {
						if (typeof(saveCallback) === 'function') {
							saveCallback(data);
						} else {
							tpService.linkService.goBack();
							if (!data || data.result !== 0) {
								tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
								return;
							}
						}
					}
				});
			}

			return {
				saveData: saveData
			}
		}
	])

	.controller('dataUsageCtrl', ['dataUsageConstant', 'dataUsageValue', 'dataUsageUtil', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageConstant, dataUsageValue, dataUsageUtil, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					limitType: {},
					limitTypes: [{
						type: 0,
						name: 'DATA_USAGE.CONTENT.DATA'
					}, {
						type: 1,
						name: 'DATA_USAGE.CONTENT.TIME'
					}],
					timeUnit: '',
					limitation: '',
					totalStatistics: 0,
					totalConnTime: 0,
					isDataExcess: false
				},
				server: {
					settings: {
						enableDataLimit: false,
						enablePaymentDay: false,
						paymentDay: 1,
						autoDisconnect: false,
						warningPercent: 0
					},
					stat: {}
				}
			}

			$scope.action = {
				enableDataLimit: function() {
					if (Number($scope.data.server.settings.limitation) === 0) {
						if ($scope.data.server.settings.limitType === 0) {
							// set 1G as default data limitation value
							$scope.data.server.settings.limitation = (1024 * 1024 * 1024).toString();
						} else {
							// set 1hour as default time limitation value
							$scope.data.server.settings.limitation = (60 * 60).toString();
						}
					}
					dataUsageUtil.saveData({
						settings: $scope.data.server.settings
					}, enableDataLimitCallback);
				},
				enablePaymentDay: function() {
					dataUsageUtil.saveData({
						settings: $scope.data.server.settings
					}, enablePaymentDayCallback);
				},
				enableAutoDisconnect: function() {
					dataUsageUtil.saveData({
						settings: $scope.data.server.settings
					}, enableAutoDisconnectCallback);
				},
				showMonthDataUsed: function() {
					return ($scope.data.server.settings.enableDataLimit && $scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 0) || (!$scope.data.server.settings.enableDataLimit && $scope.data.server.settings.enablePaymentDay);
				},
				showMonthDataAllowance: function() {
					return ($scope.data.server.settings.enableDataLimit && $scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 0);
				},
				showMonthTimeUsed: function() {
					return ($scope.data.server.settings.enableDataLimit && $scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 1) || (!$scope.data.server.settings.enableDataLimit && $scope.data.server.settings.enablePaymentDay);
				},
				showMonthTimeAllowance: function() {
					return ($scope.data.server.settings.enableDataLimit && $scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 1);
				},
				showTotalDataUsed: function() {
					return ($scope.data.server.settings.enableDataLimit && !$scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 0) || (!$scope.data.server.settings.enableDataLimit && !$scope.data.server.settings.enablePaymentDay);
				},
				showTotalDataAllowance: function() {
					return ($scope.data.server.settings.enableDataLimit && !$scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 0);
				},
				showTotalTimeUsed: function() {
					return ($scope.data.server.settings.enableDataLimit && !$scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 1) || (!$scope.data.server.settings.enableDataLimit && !$scope.data.server.settings.enablePaymentDay);
				},
				showTotalTimeAllowance: function() {
					return ($scope.data.server.settings.enableDataLimit && !$scope.data.server.settings.enablePaymentDay && $scope.data.local.limitType.type === 1);
				},
				clearHistory: function() {
					tpService.promptService.popup.confirm('DATA_USAGE.CONTENT.CLEAR_DATA_CONFIRM', 'DATA_USAGE.CONTENT.CLEAR_DATA', function(isOK) {
						if (!isOK) {
							return;
						}
						clearHistoryRequest();
					});
				}
			}

			var updateView = {
				settings: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}
					dataUsageValue.settings = data.settings;
					$scope.data.server.settings = data.settings;
					if ($scope.data.server.settings.dataLimit === 1 || $scope.data.server.settings.dataLimit === 2) {
						$scope.data.local.isDataExcess = true;
					} else {
						$scope.data.local.isDataExcess = false;
					}
					$scope.data.local.limitType = $scope.data.local.limitTypes[$scope.data.server.settings.limitType];
					if ($scope.data.local.limitType.type === 0) {
						$scope.data.local.limitation = homeUtil.formatFlow($scope.data.server.settings.limitation).flow + homeUtil.formatFlow($scope.data.server.settings.limitation).flowUnit.name;
					} else {
						getTimeStr(Number($scope.data.server.settings.limitation), function(result) {
							$scope.data.local.limitation = result;
						});
					}
				},
				stat: function(data) {
					//tpService.promptService.loading.hide();
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}
					dataUsageValue.stat = data;
					$scope.data.server.stat = data;
					$scope.data.local.totalStatistics = homeUtil.formatFlow($scope.data.server.stat.totalStatistics).flow + homeUtil.formatFlow($scope.data.server.stat.totalStatistics).flowUnit.name;
					getTimeStr(Number($scope.data.server.stat.totalConnTime), function(result) {
						$scope.data.local.totalConnTime = result;
					});
				}
			}

			function enterCallback() {
				requestData();
			}

			function getTimeStr(time, callback) {
				var res, str, TIME_UNITS = {
					DAY: 'days',
					HOUR: 'hrs',
					MINUTE: 'mins'
				};
				tpService.languageService.translate(['DATA_USAGE.CONTENT.DAY', 'DATA_USAGE.CONTENT.HOUR', 'DATA_USAGE.CONTENT.MINUTE'], function(string) {
					TIME_UNITS.DAY = string['DATA_USAGE.CONTENT.DAY'];
					TIME_UNITS.HOUR = string['DATA_USAGE.CONTENT.HOUR'];
					TIME_UNITS.MINUTE = string['DATA_USAGE.CONTENT.MINUTE'];
					if (time === 0) {
						res = '0' + TIME_UNITS.MINUTE;
					} else if (time >= 60 * 60 * 24) {
						str = tpUtil.dateTimeUtil.human.sec2day(time);
						res = str[0] + TIME_UNITS.DAY + str[1] + TIME_UNITS.HOUR + str[2] + TIME_UNITS.MINUTE;
					} else if (time >= 60 * 60) {
						str = tpUtil.dateTimeUtil.human.sec2hour(time);
						res = str[0] + TIME_UNITS.HOUR + str[1] + TIME_UNITS.MINUTE;
					} else {
						str = tpUtil.dateTimeUtil.human.sec2min(time);
						res = str[0] + TIME_UNITS.MINUTE;
					}
					if (res && typeof(callback) === 'function') {
						callback(res);
					}
				});
			}

			function enableDataLimitCallback(data) {
				var limitType = $scope.data.server.settings.limitType,
					adjustStatistics = Number($scope.data.server.settings.adjustStatistics),
					adjustTime = Number($scope.data.server.settings.adjustTime),
					limitation = Number($scope.data.server.settings.limitation),
					warningPercent = $scope.data.server.settings.warningPercent;

				if (!data || data.result !== 0) {
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					$scope.data.server.settings.enableDataLimit = !$scope.data.server.settings.enableDataLimit;
				} else {
					if (limitType === 0 && limitation === 1024 * 1024 * 1024) {
						$scope.data.local.limitation = homeUtil.formatFlow(limitation).flow + homeUtil.formatFlow(limitation).flowUnit.name;
					} else if (limitType === 1 && limitation === 60 * 60) {
						getTimeStr(limitation, function(result) {
							$scope.data.local.limitation = result;
						});
					}
				}

				if ($scope.data.server.settings.enableDataLimit) {
					if ((limitType === 0 && adjustStatistics >= limitation * warningPercent * 0.01) || (limitType === 1 && adjustTime >= limitation * warningPercent * 0.01)) {
						$scope.data.local.isDataExcess = true;
					} else {
						$scope.data.local.isDataExcess = false;
					}
				}
			}

			function enablePaymentDayCallback(data) {
				if (!data || data.result !== 0) {
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					$scope.data.server.settings.enablePaymentDay = !$scope.data.server.settings.enablePaymentDay;
				}
			}

			function enableAutoDisconnectCallback(data) {
				if (!data || data.result !== 0) {
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					$scope.data.server.settings.autoDisconnect = !$scope.data.server.settings.autoDisconnect;
				}
			}

			function requestData() {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: 'flowstat',
					action: dataUsageConstant.ACTION.GET_CONFIG,
					callback: updateView.settings
				});
				tpService.serverDataService.request({
					module: 'flowstat',
					action: dataUsageConstant.ACTION.GET_STAT,
					callback: updateView.stat
				});
			}

			function clearHistoryRequest() {
				tpService.serverDataService.request({
					module: 'flowstat',
					action: dataUsageConstant.ACTION.CLEAR_HISTORY,
					callback: function(data) {
						if (!data || data.result !== 0) {
							tpService.promptService.toast.error('COMMON.CONTENT.FAILED');
							return;
						}
						requestData();
					}
				});
			}
		}
	])

	.controller('dataUsageLimitTypeCtrl', ['dataUsageValue', 'dataUsageUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					limitType: {},
					limitTypes: [{
						type: 0,
						name: 'DATA_USAGE.CONTENT.DATA'
					}, {
						type: 1,
						name: 'DATA_USAGE.CONTENT.TIME'
					}]
				},
				server: {
					settings: {}
				}
			}

			$scope.data.local.limitType = $scope.data.local.limitTypes[dataUsageValue.settings.limitType];

			$scope.action = {
				submit: function(data) {
					$scope.data.server.settings = {
						limitType: data
					};
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageStartDayCtrl', ['dataUsageValue', 'dataUsageUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					paymentDay: 1,
					paymentDays: []
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					paymentDay: 1
				}
			}

			$scope.data.local.paymentDay = dataUsageValue.settings.paymentDay;
			$scope.data.backup.paymentDay = $scope.data.local.paymentDay;

			for (var i = 0; i < 31; i++) {
				$scope.data.local.paymentDays[i] = i + 1;
			}

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.paymentDay = $scope.data.local.paymentDay;
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageMonthDataUsedCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-MONTH_DATA_USED.TITLE',
					placeholder: 'DATA_USAGE-MONTH_DATA_USED.CONTENT.ENTER_MONTH_DATA_USED',
					flowObj: {
						flow: 0,
						flowUnit: homeConstant.FLOW_UNITS[0]
					},
					FLOW_UNITS: homeConstant.FLOW_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					flowObj: {}
				}
			}

			$scope.data.local.flowObj = homeUtil.formatFlow(dataUsageValue.stat.totalStatistics);
			$scope.data.local.flowObj.flow = Number($scope.data.local.flowObj.flow);
			angular.copy($scope.data.local.flowObj, $scope.data.backup.flowObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.adjustStatistics = homeUtil.deformatFlow($scope.data.local.flowObj.flow, $scope.data.local.flowObj.flowUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageMonthDataAllowanceCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-MONTH_DATA_ALLOWANCE.TITLE',
					placeholder: 'DATA_USAGE-MONTH_DATA_ALLOWANCE.CONTENT.ENTER_MONTH_DATA_ALLOWANCE',
					flowObj: {
						flow: 1,
						flowUnit: homeConstant.FLOW_UNITS[2]
					},
					FLOW_UNITS: homeConstant.FLOW_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					flowObj: {}
				}
			}

			$scope.data.local.flowObj = homeUtil.formatFlow(dataUsageValue.settings.limitation);
			$scope.data.local.flowObj.flow = Number($scope.data.local.flowObj.flow);
			angular.copy($scope.data.local.flowObj, $scope.data.backup.flowObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.limitation = homeUtil.deformatFlow($scope.data.local.flowObj.flow, $scope.data.local.flowObj.flowUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageMonthTimeUsedCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-MONTH_TIME_USED.TITLE',
					placeholder: 'DATA_USAGE-MONTH_TIME_USED.CONTENT.ENTER_MONTH_TIME_USED',
					timeObj: {
						time: 0,
						timeUnit: homeConstant.TIME_UNITS[0]
					},
					TIME_UNITS: homeConstant.TIME_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					timeObj: {}
				}
			}

			$scope.data.local.timeObj = homeUtil.formatTime(dataUsageValue.stat.totalConnTime);
			$scope.data.local.timeObj.time = Number($scope.data.local.timeObj.time);
			angular.copy($scope.data.local.timeObj, $scope.data.backup.timeObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.adjustTime = homeUtil.deformatTime($scope.data.local.timeObj.time, $scope.data.local.timeObj.timeUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageMonthTimeAllowanceCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-MONTH_TIME_ALLOWANCE.TITLE',
					placeholder: 'DATA_USAGE-MONTH_TIME_ALLOWANCE.CONTENT.ENTER_MONTH_TIME_ALLOWANCE',
					timeObj: {
						time: 0,
						timeUnit: homeConstant.TIME_UNITS[1]
					},
					TIME_UNITS: homeConstant.TIME_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					timeObj: {}
				}
			}

			$scope.data.local.timeObj = homeUtil.formatTime(dataUsageValue.settings.limitation);
			$scope.data.local.timeObj.time = Number($scope.data.local.timeObj.time);
			angular.copy($scope.data.local.timeObj, $scope.data.backup.timeObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.limitation = homeUtil.deformatTime($scope.data.local.timeObj.time, $scope.data.local.timeObj.timeUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageTotalDataUsedCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-TOTAL_DATA_USED.TITLE',
					placeholder: 'DATA_USAGE-TOTAL_DATA_USED.CONTENT.ENTER_TOTAL_DATA_USED',
					flowObj: {
						flow: 0,
						flowUnit: homeConstant.FLOW_UNITS[0]
					},
					FLOW_UNITS: homeConstant.FLOW_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					flowObj: {}
				}
			}

			$scope.data.local.flowObj = homeUtil.formatFlow(dataUsageValue.stat.totalStatistics);
			$scope.data.local.flowObj.flow = Number($scope.data.local.flowObj.flow);
			angular.copy($scope.data.local.flowObj, $scope.data.backup.flowObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.adjustStatistics = homeUtil.deformatFlow($scope.data.local.flowObj.flow, $scope.data.local.flowObj.flowUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageTotalDataAllowanceCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-TOTAL_DATA_ALLOWANCE.TITLE',
					placeholder: 'DATA_USAGE-TOTAL_DATA_ALLOWANCE.CONTENT.ENTER_TOTAL_DATA_ALLOWANCE',
					flowObj: {
						flow: 1,
						flowUnit: homeConstant.FLOW_UNITS[2]
					},
					FLOW_UNITS: homeConstant.FLOW_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					flowObj: {}
				}
			}

			$scope.data.local.flowObj = homeUtil.formatFlow(dataUsageValue.settings.limitation);
			$scope.data.local.flowObj.flow = Number($scope.data.local.flowObj.flow);
			angular.copy($scope.data.local.flowObj, $scope.data.backup.flowObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.limitation = homeUtil.deformatFlow($scope.data.local.flowObj.flow, $scope.data.local.flowObj.flowUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageTotalTimeUsedCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-TOTAL_TIME_USED.TITLE',
					placeholder: 'DATA_USAGE-TOTAL_TIME_USED.CONTENT.ENTER_TOTAL_TIME_USED',
					timeObj: {
						time: 0,
						timeUnit: homeConstant.TIME_UNITS[0]
					},
					TIME_UNITS: homeConstant.TIME_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					timeObj: {}
				}
			}

			$scope.data.local.timeObj = homeUtil.formatTime(dataUsageValue.stat.totalConnTime);
			$scope.data.local.timeObj.time = Number($scope.data.local.timeObj.time);
			angular.copy($scope.data.local.timeObj, $scope.data.backup.timeObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.adjustTime = homeUtil.deformatTime($scope.data.local.timeObj.time, $scope.data.local.timeObj.timeUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageTotalTimeAllowanceCtrl', ['dataUsageValue', 'dataUsageUtil', 'homeConstant', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, homeConstant, homeUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					title: 'DATA_USAGE-TOTAL_TIME_ALLOWANCE.TITLE',
					placeholder: 'DATA_USAGE-TOTAL_TIME_ALLOWANCE.CONTENT.ENTER_TOTAL_TIME_ALLOWANCE',
					timeObj: {
						time: 1,
						timeUnit: homeConstant.TIME_UNITS[1]
					},
					TIME_UNITS: homeConstant.TIME_UNITS
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					timeObj: {}
				}
			}

			$scope.data.local.timeObj = homeUtil.formatTime(dataUsageValue.settings.limitation);
			$scope.data.local.timeObj.time = Number($scope.data.local.timeObj.time);
			angular.copy($scope.data.local.timeObj, $scope.data.backup.timeObj);

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.limitation = homeUtil.deformatTime($scope.data.local.timeObj.time, $scope.data.local.timeObj.timeUnit);
					dataUsageUtil.saveData($scope.data.server);
				}
			}
		}
	])

	.controller('dataUsageUsageAlertCtrl', ['dataUsageValue', 'dataUsageUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(dataUsageValue, dataUsageUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					warningPercent: {},
					warningPercents: [{
						type: 1,
						name: '10%'
					}, {
						type: 2,
						name: '20%'
					}, {
						type: 3,
						name: '30%'
					}, {
						type: 4,
						name: '40%'
					}, {
						type: 5,
						name: '50%'
					}, {
						type: 6,
						name: '60%'
					}, {
						type: 7,
						name: '70%'
					}, {
						type: 8,
						name: '80%'
					}, {
						type: 9,
						name: '90%'
					}]
				},
				server: {
					settings: dataUsageValue.settings
				},
				backup: {
					warningPercent: {}
				}
			};

			$scope.data.local.warningPercent = $scope.data.local.warningPercents[dataUsageValue.settings.warningPercent / 10 - 1];
			$scope.data.backup.warningPercent = $scope.data.local.warningPercent;

			$scope.action = {
				submit: function() {
					$scope.data.server.settings.warningPercent = $scope.data.local.warningPercent.type * 10;
					dataUsageUtil.saveData($scope.data.server);
				}
			};
		}
	])

})();
