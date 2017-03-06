(function() {
	'use strict';

	/**
	 * @description
	 * Home is the core module and main UI for tpMiFi-X, all other modules could depend on it.
	 * If you unload it, app will show a blank UI probably.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.home
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.home', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider', '$locationProvider',
		function($stateProvider, $urlRouterProvider, $locationProvider) {
			//=== Router rule ===//
			// NOTICE: As we use ion-nav-view to embed child page, so the mod's url will like this: `http://<ip>/#/[mod_url]`,
			//         "#" means it is a "Hashbang URLs" in index.html, but be care that it's NOT a simple anchor link!
			//         When you set "href" in html, remember to use "#" as prefix, like: `<a href="#/home">`,
			//         Anyway, we suggest to use common function, like jumpToMod() to process these link's detail.
			$stateProvider
				.state('home', {
					url: '/home',
					templateUrl: 'mod/home/mod.html',
					controller: 'homeCtrl'
				});
		}
	])

	.run(['$ionicPlatform', 'tpService',
		function($ionicPlatform, tpService) {
			$ionicPlatform.ready(function() {
				tpService.notificationService.register({
					description: 'new device connect to router',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.NEW_DEVICE',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && oldStatus && newStatus.connectedDevices.number > oldStatus.connectedDevices.number) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'roaming',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.ROAMING',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.wan.roaming && !newStatus.wan.roamingEnabled) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'data limit warning',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.DATA_LIMIT_WARN',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.wan.limitType === 0 && newStatus.wan.dataLimit === 1) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'data limit overflow',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.DATA_LIMIT_OVERFLOW',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.wan.limitType === 0 && newStatus.wan.dataLimit === 2) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'time limit warning',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.TIME_LIMIT_WARN',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.wan.limitType === 1 && newStatus.wan.dataLimit === 1) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'time limit overflow',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.TIME_LIMIT_OVERFLOW',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.wan.limitType === 1 && newStatus.wan.dataLimit === 2) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'sim not found',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.SIM_NOT_FOUND',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.wan.simStatus === 1) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'new sms come',
					repeat: true,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.NEW_SMS',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && oldStatus && newStatus.message.unreadMessages > oldStatus.message.unreadMessages) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'low battery',
					repeat: false,
					content: 'HOME.CONTENT.NOTIFICATION.CONTENT.LOW_BATTERY',
					notificationCondition: function(oldStatus, newStatus) {
						if (newStatus && newStatus.battery.voltage < 10) {
							return true;
						} else {
							return false;
						}
					}
				});
				tpService.notificationService.register({
					description: 'disconnect from router',
					repeat: false,
					content: 'COMMON.CONTENT.DEVICE_DISCONNECT',
					notificationCondition: function(oldStatus, newStatus) {
						if (!newStatus) {
							return true;
						} else {
							return false;
						}
					}
				});
			});
		}
	])

	.constant('homeConstant', {
		MOD_NAME: 'home',
		FLOW_UNITS: [{
			type: 0,
			name: 'KB'
		}, {
			type: 1,
			name: 'MB'
		}, {
			type: 2,
			name: 'GB'
		}],
		TIME_UNITS: [{
			type: 0,
			name: 'COMMON.CONTENT.DATE_TIME_SHORT.MINUTE'
		}, {
			type: 1,
			name: 'COMMON.CONTENT.DATE_TIME_SHORT.HOUR'
		}, {
			type: 2,
			name: 'COMMON.CONTENT.DATE_TIME_SHORT.DAY'
		}],
		HEARTBEAT_INTERVAL: 10 * 1000,
		CHECK_UPDATE_INTERVAL: 24 * 60 * 60 * 1000
	})

	.value('homeValue', {
		// Stop status polling, home mod may be depend on this flag.
		stopStatusPolling: false,
		// Prevent jump to setupWizard mod when is factory status.
		preventFactoryJump: false
	})

	.factory('homeUtil', ['homeConstant', 'tpUtil', 'tpService',
		function(homeConstant, tpUtil, tpService) {
			/**
			 * @description
			 * Convert second to minute/hour/day with unit.
			 *
			 * @memberof homeUtil
			 * @param {number} ori A number.
			 * @returns {object} The object contains a string number after converted and unit.
			 */
			var formatTime = function(ori) {
				var time, timeUnit;
				if (ori >= 60 * 60 * 24) {
					time = tpUtil.dateTimeUtil.secToDay(ori);
					timeUnit = homeConstant.TIME_UNITS[2];
				} else if (ori >= 60 * 60) {
					time = tpUtil.dateTimeUtil.secToHour(ori);
					timeUnit = homeConstant.TIME_UNITS[1];
				} else {
					time = tpUtil.dateTimeUtil.secToMin(ori);
					timeUnit = homeConstant.TIME_UNITS[0];
				}
				return {
					time: time,
					timeUnit: timeUnit
				}
			}

			/**
			 * @description
			 * Convert minute/hour/day to second without unit.
			 *
			 * @memberof homeUtil
			 * @param {number|string} ori A number or string number.
			 * @param {string} oriUnit A string.
			 * @returns {string} The string number after converted and truncated.
			 */
			var deformatTime = function(ori, oriUnit) {
				var res;
				switch (oriUnit) {
					case homeConstant.TIME_UNITS[2]:
						res = tpUtil.dateTimeUtil.dayToSec(ori);
						break;
					case homeConstant.TIME_UNITS[1]:
						res = tpUtil.dateTimeUtil.hourToSec(ori);
						break;
					case homeConstant.TIME_UNITS[0]:
						res = tpUtil.dateTimeUtil.minToSec(ori);
						break;
				}
				return res;
			}

			/**
			 * @description
			 * Convert Byte to KB/MB/GB with unit
			 *
			 * @memberof homeUtil
			 * @param {number} ori A number.
			 * @returns {object} The object contains number after converted and unit.
			 */
			var formatFlow = function(ori) {
				var flow, flowUnit;
				if (ori >= 1024 * 1024 * 1024) {
					flow = tpUtil.flowUtil.ByteToGB(ori);
					flowUnit = homeConstant.FLOW_UNITS[2];
				} else if (ori >= 1024 * 1024) {
					flow = tpUtil.flowUtil.ByteToMB(ori);
					flowUnit = homeConstant.FLOW_UNITS[1];
				} else {
					flow = tpUtil.flowUtil.ByteToKB(ori);
					flowUnit = homeConstant.FLOW_UNITS[0];
				}
				return {
					flow: flow,
					flowUnit: flowUnit
				}
			}

			/**
			 * @description
			 * Convert KB/MB/GB to Byte without unit.
			 *
			 * @memberof homeUtil
			 * @param {number|string} ori A number or string number.
			 * @param {string} oriUnit A string.
			 * @returns {string} The string number after converted and truncated.
			 */
			var deformatFlow = function(ori, oriUnit) {
				var res;
				switch (oriUnit) {
					case homeConstant.FLOW_UNITS[2]:
						res = tpUtil.flowUtil.GBToByte(ori);
						break;
					case homeConstant.FLOW_UNITS[1]:
						res = tpUtil.flowUtil.MBToByte(ori);
						break;
					case homeConstant.FLOW_UNITS[0]:
						res = tpUtil.flowUtil.KBToByte(ori);
						break;
				}
				return res;
			}

			return {
				formatTime: formatTime,
				deformatTime: deformatTime,
				formatFlow: formatFlow,
				deformatFlow: deformatFlow
			}
		}
	])

	.controller('homeCtrl', ['homeConstant', 'homeValue', 'homeUtil', 'tpService', 'tpUtil', 'tpProtocol',
		'$rootScope', '$scope', '$ionicSideMenuDelegate', '$ionicPlatform', '$interval', '$window', '$timeout',
		function(homeConstant, homeValue, homeUtil, tpService, tpUtil, tpProtocol,
			$rootScope, $scope, $ionicSideMenuDelegate, $ionicPlatform, $interval, $window, $timeout) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback,
				resume: resumeCallback
			}, true);

			// NOTICE: $scope variable must be object, not primitive (e.g., number, string, boolean).
			//         So child $scope can inherit it, not copy it!
			//         Refer to: https://github.com/angular/angular.js/wiki/Understanding-Scopes
			$scope.data = {
				// local data. If needed, define it to process local data or local flags
				local: {
					images: {
						signalStatus: tpService.modService.getModImgUrl('signal_4g_0.png'), // set lte 0 strength as default pic
						networkStatus: tpService.modService.getModImgUrl('network_disconnected.png'), // set disconnected as default pic
						batteryStatus: tpService.modService.getModImgUrl('battery_0_normal.png'), // set voltage 0 as default pic
						clientList: tpService.modService.getModImgUrl('clientList.png'),
						sms: tpService.modService.getModImgUrl('sms.png'),
						storageSharing: tpService.modService.getModImgUrl('storage_sharing.png')
					},
					isHome: true, // is at home now? This flag is only used to `hide-nav-bar` to make animation more smooth!
					isConnect: false, // is connected to MiFi?
					isFactory: false, // is factory status?
					isLogin: false, // is login?
					isVisited: false, // is visited, for pin/puk locked
					hasNewAppVer: false,
					hasNewFirmwareVer: false,
					lastCheckFirmwareTime: 0,
					simStatus: '',
					status: {},
					flowstat: { // flowstat data
						usedX: 105,
						usedY: 5,
						used: 0,
						usedUnit: homeConstant.FLOW_UNITS[0],
						total: 0,
						totalUnit: homeConstant.FLOW_UNITS[2],
						usedPadding: '',
						circleColor: '#aef631',
						flag: 0
					},
					NetworkType: {
						GSM: 1,
						WCDMA: 2,
						LTE: 3,
						TD_SCDMA: 4,
						CDMA_1X: 5,
						CDMA_1XEV: 6
					},
					OPERATOR: {
						NO_SIM_CARD: 0,
						PIN_LOCKED: 1,
						PUK_LOCKED: 2,
						SIM_CARD_BLOCKED: 3,
						SIM_CARD_ERROR: 4,
						NO_SERVICE: 5,
						SEARCHING: 6,
						CMCC: 7,
						CUCC: 8,
						CTCC: 9,
						UNKNOWN: 10
					},
					ConnectStatus: {
						DISABLED: 0,
						DISCONNECTED: 1,
						CONNECTING: 2,
						DISCONNECTING: 3,
						CONNECTED: 4
					},
					DataLimitStatus: {
						NORMAL: 0,
						WARNING: 1,
						EXCEED: 2
					}
				},
				// server data.
				server: {},
				// server data's backup. If needed, define it to backup server data, which is used to compare modification before submit data to server.
				backup: {}
			};

			//--- Set default data ---//
			// Just read protocol spec file for test
			// As efficiency, we won't use protocol spec file to init data
			//tpProtocol.protocolSpecService.getResponse("dntcase/status/spec/case_status_action_0", function(resObj) {
			//$scope.data.server.status = tpUtil.initUtil.initLoading(resObj);
			//});

			$scope.action = {
				toggleSideMenu: function() {
					$ionicSideMenuDelegate.toggleLeft();
				},
				closeSideMenu: function() {
					if ($ionicSideMenuDelegate.isOpenLeft()) {
						$ionicSideMenuDelegate.toggleLeft();
					}
				},
				jumpToMod: function(mod) {
					// If device disconnected, don't jump.
					if (!$scope.data.local.isConnect && mod != 'about' && mod != 'test') {
						tpService.promptService.toast.warning('COMMON.CONTENT.DEVICE_DISCONNECT');
						$scope.action.closeSideMenu();
						return;
					}
					$scope.action.closeSideMenu();
					tpService.linkService.gotoMod(mod);
				},
				// 2in1: login and logout
				login: function() {
					if (!$scope.data.local.isLogin) {
						// login
						$scope.action.jumpToMod(tpService.serviceConstant.MOD.LOGIN);
						return;
					} else {
						// logout
						$scope.data.local.isLogin = false;
						tpService.authService.logout();
						tpService.promptService.toast.success('HOME.CONTENT.LOGOUT_OK');
					}
				}
			};

			var updateView = {
				status: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.warning('COMMON.CONTENT.DEVICE_DISCONNECT');
						$scope.data.local.isConnect = false;
						$scope.data.server.status = {};
						$scope.data.local.status = {};
						tpService.dataSharingService.set('status', null);
						return;
					}

					$scope.data.local.isConnect = true;

					// Share data `status` to all mods
					tpService.dataSharingService.set('status', data);
					tpService.dataSharingService.set('isFactory', data.factoryDefault);

					if (!tpService.linkService.isHome()) {
						// if has jump to child mod, stop update home view
						return;
					}

					// Re-init data.
					$scope.data.server.status = data;
					// deep copy
					$scope.data.backup.status = {};
					angular.copy(data, $scope.data.backup.status);

					// Create local.status for process text easier.
					$scope.data.local.status = {};
					angular.copy(data, $scope.data.local.status);

					// Check factory
					if (data.factoryDefault) {
						$scope.data.local.isFactory = true;
					} else {
						$scope.data.local.isFactory = false;
					}

					// carrier
					if ($scope.data.server.status.wan && $scope.data.server.status.wan.operatorName && $scope.data.server.status.wan.operatorName != 'null') {
						tpService.languageService.translate('HOME.CONTENT.MOBILE_NETWORK.CARRIER_NAME.' + $scope.data.server.status.wan.operatorName, function(string) {
							$scope.data.local.status.wan.operatorName = string;
						});
					} else {
						tpService.languageService.translate('HOME.CONTENT.MOBILE_NETWORK.CARRIER_NAME.NONE', function(string) {
							$scope.data.local.status.wan.operatorName = string;
						});
					}
					// network type
					if ($scope.data.server.status.wan && $scope.data.server.status.wan.networkType !== 0) {
						var networkType;
						switch ($scope.data.server.status.wan.networkType) {
							case $scope.data.local.NetworkType.GSM:
							case $scope.data.local.NetworkType.CDMA_1X:
								networkType = '2g';
								break;
							case $scope.data.local.NetworkType.WCDMA:
							case $scope.data.local.NetworkType.TD_SCDMA:
							case $scope.data.local.NetworkType.CDMA_1XEV:
								networkType = '3g';
								break;
							case $scope.data.local.NetworkType.LTE:
								networkType = '4g';
								break;
							default:
								break;
						}
						if ($scope.data.server.status.wan.signalStrength != 'null') {
							$scope.data.local.images.signalStatus = tpService.modService.getModImgUrl('signal_' + networkType + '_' + $scope.data.server.status.wan.signalStrength + '.png');
						}
					}
					// sim card status
					if ($scope.data.server.status.wan && $scope.data.server.status.wan.operator != 'null') {
						tpService.languageService.translate('HOME.CONTENT.MOBILE_NETWORK.OPERATOR.' + $scope.data.server.status.wan.operator, function(string) {
							$scope.data.local.simStatus = string;
						});
						// when pin locked, jump to pin unlock page
						if ($scope.data.local.isLogin && $scope.data.server.status.wan.operator === 1 && !$scope.data.local.isVisited) {
							// add 1s delay in case 'network-pinUnlock' not loaded
							$timeout(tpService.linkService.gotoMod('network-pinUnlock'), 1000);
							$scope.data.local.isVisited = true;
							return;
						}
						// when puk locked, jump to puk unlock page
						if ($scope.data.local.isLogin && $scope.data.server.status.wan.operator === 2 && !$scope.data.local.isVisited) {
							// add 1s delay in case 'network-pukUnlock' not loaded
							$timeout(tpService.linkService.gotoMod('network-pukUnlock'), 1000);
							$scope.data.local.isVisited = true;
							return;
						}
					}
					// connect status
					if ($scope.data.server.status.wan && $scope.data.server.status.wan.connectStatus != 'null') {
						switch ($scope.data.server.status.wan.connectStatus) {
							case 0:
							case 1:
								$scope.data.local.images.networkStatus = tpService.modService.getModImgUrl('network_disconnected.png');
								break;
							case 2:
							case 3:
								$scope.data.local.images.networkStatus = tpService.modService.getModImgUrl('network_connecting.png');
								break;
								//case 4:
							default:
								$scope.data.local.images.networkStatus = tpService.modService.getModImgUrl('network_connected.png');
								break;
						}
					}
					// battery
					if ($scope.data.server.status.battery && $scope.data.server.status.battery.voltage != 'null') {
						var isCharging, voltage;
						voltage = Math.floor($scope.data.server.status.battery.voltage / 10) * 10;
						if (!$scope.data.server.status.battery.connected) {
							$scope.data.local.images.batteryStatus = tpService.modService.getModImgUrl('battery_0_normal.png');
						} else {
							if ($scope.data.server.status.battery.charging && $scope.data.server.status.battery.voltage < 100) {
								isCharging = 'charging';
							} else {
								isCharging = 'normal';
							}
							$scope.data.local.images.batteryStatus = tpService.modService.getModImgUrl('battery_' + voltage + '_' + isCharging + '.png');
						}
					}
					// sdcard
					// TIP: Here we use "==" instead of "===", because some field may be number, but we don't care.
					if ($scope.data.server.status.sdcard && $scope.data.server.status.sdcard.status == '1') {
						if ($scope.data.server.status.sdcard.mode == '0') {
							tpService.languageService.translate('HOME.CONTENT.SD_SHARING.DETAIL.USB_MODE', function(string) {
								$scope.data.local.status.sdcard.detail = string;
							});
						} else if ($scope.data.server.status.sdcard.mode == '1') {
							tpService.languageService.translate('HOME.CONTENT.SD_SHARING.DETAIL.LEFT', function(string) {
								var left, leftUnit;
								if ($scope.data.server.status.sdcard.left) {
									leftUnit = $scope.data.server.status.sdcard.left.slice(-1);
									if (leftUnit === 'K' || leftUnit === 'M' || leftUnit === 'G') {
										// if backend return `left` field with unit, use it directly.
										left = $scope.data.server.status.sdcard.left;
										// "109.8M" -> "109.8"
										var leftValue = left.substr(0, left.length - 1);
										$scope.data.local.status.sdcard.detail = string + ' ' + Math.round(leftValue) + leftUnit + 'B';
									} else {
										// 'left' number has no unit, actually it's KB value, format it.
										left = homeUtil.formatFlow($scope.data.server.status.sdcard.left * 1024).flow;
										leftUnit = homeUtil.formatFlow($scope.data.server.status.sdcard.left * 1024).flowUnit;
										$scope.data.local.status.sdcard.detail = string + ' ' + Math.round(left) + leftUnit.name;
									}
								} else {
									// else compute `left = total - used`
									var total = parseFloat($scope.data.server.status.sdcard.volume.slice(0, -1));
									var totalUnit = $scope.data.server.status.sdcard.volume.slice(-1);
									var used = parseFloat($scope.data.server.status.sdcard.used.slice(0, -1));
									var usedUnit = $scope.data.server.status.sdcard.used.slice(-1);
									if (total <= 0) {
										tpService.languageService.translate('HOME.CONTENT.SD_SHARING.DETAIL.INVALID_SD', function(string) {
											$scope.data.local.status.sdcard.detail = string;
										});
									} else if (totalUnit === usedUnit) {
										$scope.data.local.status.sdcard.detail = string + ' ' + Math.round(total - used) + totalUnit + 'B';
									} else {
										// convert to Byte
										if (totalUnit === 'K') {
											total = total * 1024;
										} else if (totalUnit === 'M') {
											total = total * 1024 * 1024;
										} else if (totalUnit === 'G') {
											total = total * 1024 * 1024 * 1024;
										} else {
											// 'total' has no unit, then it's KB value
											total = total * 1024;
										}
										// convert to Byte
										if (usedUnit === 'K') {
											used = used * 1024;
										} else if (usedUnit === 'M') {
											used = used * 1024 * 1024;
										} else if (usedUnit === 'G') {
											used = used * 1024 * 1024 * 1024;
										} else {
											// 'used' no unit, then it's KB value
											total = total * 1024;
										}
										// compute left
										left = total - used;
										if (left < 0) {
											tpService.languageService.translate('HOME.CONTENT.SD_SHARING.DETAIL.INVALID_SD', function(string) {
												$scope.data.local.status.sdcard.detail = string;
											});
										} else {
											$scope.data.local.status.sdcard.detail = string + ' ' + Math.round(homeUtil.formatFlow(left).flow) + homeUtil.formatFlow(left).flowUnit.name;
										}
									}
								}
							});
						}
					} else {
						tpService.languageService.translate('HOME.CONTENT.SD_SHARING.DETAIL.NO_SD', function(string) {
							$scope.data.local.status.sdcard.detail = string;
						});
					}

					if ($scope.data.local.isFactory && !homeValue.preventFactoryJump) {
						// go to setup wizard page.
						tpService.linkService.gotoMod('setupWizard');
					}
				},
				dataUsage: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						tpService.dataSharingService.set('flowstat', null);
						return;
					}

					tpService.dataSharingService.set('flowstat', data.settings);

					if (!tpService.linkService.isHome()) {
						// if has jump to child mod, stop update home view
						return;
					}

					$scope.data.server.settings = data.settings;
					if ($scope.data.server.settings.limitType === 0) {
						$scope.data.local.flowstat.used = homeUtil.formatFlow($scope.data.server.settings.adjustStatistics).flow;
						$scope.data.local.flowstat.usedUnit = homeUtil.formatFlow($scope.data.server.settings.adjustStatistics).flowUnit;
						$scope.data.local.flowstat.total = homeUtil.formatFlow($scope.data.server.settings.limitation).flow;
						$scope.data.local.flowstat.totalUnit = homeUtil.formatFlow($scope.data.server.settings.limitation).flowUnit;
						$scope.data.local.flowstat.usedX = 105 + 100 * Math.sin(2 * Math.PI * ($scope.data.server.settings.adjustStatistics / $scope.data.server.settings.limitation)) || 0;
						$scope.data.local.flowstat.usedY = 105 - 100 * Math.cos(2 * Math.PI * ($scope.data.server.settings.adjustStatistics / $scope.data.server.settings.limitation)) || 0;
					} else {
						$scope.data.local.flowstat.used = homeUtil.formatTime($scope.data.server.settings.adjustTime).time;
						$scope.data.local.flowstat.usedUnit = homeUtil.formatTime($scope.data.server.settings.adjustTime).timeUnit;
						$scope.data.local.flowstat.total = homeUtil.formatTime($scope.data.server.settings.limitation).time;
						$scope.data.local.flowstat.totalUnit = homeUtil.formatTime($scope.data.server.settings.limitation).timeUnit;
						$scope.data.local.flowstat.usedX = 105 + 100 * Math.sin(2 * Math.PI * ($scope.data.server.settings.adjustTime / $scope.data.server.settings.limitation)) || 0;
						$scope.data.local.flowstat.usedY = 105 - 100 * Math.cos(2 * Math.PI * ($scope.data.server.settings.adjustTime / $scope.data.server.settings.limitation)) || 0;
					}
					// used data is 0-9, set padding-right to 20px
					// used data is 10-99, set padding-right to 10px
					if ($scope.data.local.flowstat.used.length === 1) {
						$scope.data.local.flowstat.usedPadding = 'pr20';
					} else if ($scope.data.local.flowstat.used.length === 2) {
						$scope.data.local.flowstat.usedPadding = 'pr10';
					} else {
						$scope.data.local.flowstat.usedPadding = '';
					}
					// set elliptical Arc flag, small or big?
					if ($scope.data.local.flowstat.usedX > 105) {
						$scope.data.local.flowstat.flag = 0; // small circle, < 180
					} else {
						$scope.data.local.flowstat.flag = 1; // large circle, >= 180
					}
					switch ($scope.data.server.settings.dataLimit) {
						case $scope.data.local.DataLimitStatus.WARNING:
							$scope.data.local.flowstat.circleColor = '#ffc900';
							break;
						case $scope.data.local.DataLimitStatus.EXCEED:
							$scope.data.local.flowstat.circleColor = '#ef473a';
							break;
							//case $scope.data.local.DataLimitStatus.NORMAL:
						default:
							$scope.data.local.flowstat.circleColor = '#aef631';
							break;
					}
				}
			};

			function enterCallback() {
				$scope.data.local.isHome = true;
				requestData();
			}

			function beforeLeaveCallback() {
				$scope.data.local.isHome = false;
			}

			function resumeCallback() {
				requestData();
			}

			function requestData() {
				if (homeValue.stopStatusPolling) {
					$interval.cancel($scope.data.local.stopStatusPollingHandler);
					return;
				}
				tpService.serverDataService.request({
					ignoreLoadingBar: true,
					module: 'status',
					action: 0,
					callback: function(data) {
						updateView.status(data);
						tpService.authService.checkLogin(function(data, isLogin) {
							if (isLogin) {
								$scope.data.local.isLogin = true;
								var thisCheckFirmwareTime = (new Date()).getTime();
								if (thisCheckFirmwareTime - $scope.data.local.lastCheckFirmwareTime > homeConstant.CHECK_UPDATE_INTERVAL) {
									$scope.data.local.lastCheckFirmwareTime = thisCheckFirmwareTime;
									checkFirmwareUpdate();
								}
							} else {
								$scope.data.local.isLogin = false;
							}
						});
					}
				});
				tpService.serverDataService.request({
					ignoreLoadingBar: true,
					module: 'flowstat',
					action: 0,
					callback: updateView.dataUsage
				});
			}

			// Tip: if network is heavy load, try to move it to front location, to update View faster.
			// WARNING: As angular-cache, controller will just do requestData here once. Use `modService.initMod` (stateChangeStart) or $interval to do multi-times.
			requestData();

			// Request data and update view periodically
			// but if stopStatusPolling, prevent interval to debug easier
			if (!homeValue.stopStatusPolling) {
				$scope.data.local.stopStatusPollingHandler = $interval(requestData, homeConstant.HEARTBEAT_INTERVAL);
			}

			window.addEventListener("resize", function() {
				updateView.status(tpService.dataSharingService.get('status'));
				updateView.dataUsage(tpService.dataSharingService.get('flowstat'));
			});

			// check app update
			function checkUpdateFromAppStore() {
				tpService.appUpdateService.checkUpdateFromAppStore(function(result) {
					if (result == tpService.appUpdateService.result.NEW_VER) {
						$scope.data.local.hasNewAppVer = true;
						tpService.localDataService.setApp('hasNewVer', true);
						tpService.languageService.translate(['HOME.CONTENT.UPDATE.TITLE', 'HOME.CONTENT.UPDATE.CONTENT.APP_HAS_NEW_VER', 'HOME.CONTENT.UPDATE.CONTENT.UPDATE_NOW', 'HOME.CONTENT.UPDATE.CONTENT.UPDATE_LATER'], function(string) {
							tpService.promptService.popup.confirmWithOptions({
								title: string['HOME.CONTENT.UPDATE.TITLE'],
								template: string['HOME.CONTENT.UPDATE.CONTENT.APP_HAS_NEW_VER'],
								okText: string['HOME.CONTENT.UPDATE.CONTENT.UPDATE_NOW'],
								cancelText: string['HOME.CONTENT.UPDATE.CONTENT.UPDATE_LATER'],
								scope: $scope
							}, function(isOK) {
								if (isOK) {
									tpService.appUpdateService.gotoAppStore();
								}
							});
						});
					} else {
						$scope.data.local.hasNewAppVer = false;
						tpService.localDataService.setApp('hasNewVer', false);
					}
				});
			}
			$timeout(checkUpdateFromAppStore, 500);
			$scope.data.local.stopCheckAppUpdateHandler = $interval(checkUpdateFromAppStore, homeConstant.CHECK_UPDATE_INTERVAL);

			// check firmware update
			function checkFirmwareUpdate() {
				tpService.serverDataService.request({
					ignoreLoadingBar: true,
					module: 'update',
					action: 0,
					callback: function(data) {
						if (!data || data.result !== 0) {
							return;
						}

						if (data.hasNewVersion) {
							$scope.data.local.hasNewFirmwareVer = true;
							tpService.localDataService.setDevice('hasNewFirmwareVer', true);
							tpService.languageService.translate(['HOME.CONTENT.UPDATE.TITLE', 'HOME.CONTENT.UPDATE.CONTENT.FIRMWARE_HAS_NEW_VER', 'HOME.CONTENT.UPDATE.CONTENT.UPDATE_NOW', 'HOME.CONTENT.UPDATE.CONTENT.UPDATE_LATER'], function(string) {
								tpService.promptService.popup.confirmWithOptions({
									title: string['HOME.CONTENT.UPDATE.TITLE'],
									template: string['HOME.CONTENT.UPDATE.CONTENT.FIRMWARE_HAS_NEW_VER'],
									okText: string['HOME.CONTENT.UPDATE.CONTENT.UPDATE_NOW'],
									cancelText: string['HOME.CONTENT.UPDATE.CONTENT.UPDATE_LATER'],
									scope: $scope
								}, function(isOK) {
									if (!isOK) {
										return;
									} else {
										tpService.linkService.gotoMod('device');
									}
								});
							});
						} else {
							$scope.data.local.hasNewFirmwareVer = false;
							tpService.localDataService.setDevice('hasNewFirmwareVer', false);
						}
					}
				});
			}

			// notification
			if (tpService.localDataService.getApp('permission.notification') === null) {
				tpService.permissionService.registerNotification(function(granted) {
					if (granted) {
						tpService.localDataService.setApp('permission.notification', true);
						if (tpService.notificationService.isNotifyOn()) {
							tpService.notificationService.enable();
							return;
						}
					}
					tpService.notificationService.disable();
				});
			} else {
				tpService.permissionService.checkNotification(function(granted) {
					if (tpService.notificationService.isNotifyOn() && granted) {
						tpService.notificationService.enable();
					}
				});
			}

			// introduce
			if (tpService.localDataService.getApp('ver') !== tpProtocol.protocolConstant.APP.VER) {
				tpService.localDataService.setApp('ver', tpProtocol.protocolConstant.APP.VER);
				$timeout(function() {
					tpService.linkService.gotoMod('introduce');
				}, 1500);
				return;
			}
		}
	])

})();
