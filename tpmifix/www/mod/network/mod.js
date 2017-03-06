(function() {
	'use strict';

	/**
	 * @description
	 * Network is module to control MiFi's wan settings and PIN.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.network
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.network', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('network', {
					url: '/network',
					templateUrl: 'mod/network/mod.html',
					controller: 'networkCtrl'
				})
				.state('network-dialupType', {
					url: '/network-dialupType',
					templateUrl: 'mod-network-dialupType.html',
					controller: 'networkDialUpTypeCtrl'
				})
				.state('network-networkMode', {
					url: '/network-networkMode',
					templateUrl: 'mod-network-networkMode.html',
					controller: 'networkNetworkModeCtrl'
				})
				.state('network-apnManage', {
					url: '/network-apnManage',
					templateUrl: 'mod-network-apnManage.html',
					controller: 'networkApnManageCtrl'
				})
				.state('network-addApn', {
					url: '/network-addApn',
					templateUrl: 'mod-network-addApn.html',
					controller: 'networkAddApnCtrl as apn'
				})
				.state('network-editApn', {
					url: '/network-editApn',
					templateUrl: 'mod-network-addApn.html',
					controller: 'networkEditApnCtrl as apn',
					params: {
						profile: null
					}
				})
				.state('network-pinManage', {
					url: '/network-pinManage',
					templateUrl: 'mod-network-pinManage.html',
					controller: 'networkPinManageCtrl'
				})
				.state('network-changePin', {
					url: '/network-changePin',
					templateUrl: 'mod-network-changePin.html',
					controller: 'networkChangePinCtrl as pin'
				})
				.state('network-pinUnlock', {
					url: '/network-pinUnlock',
					templateUrl: 'mod/network/template/pinUnlock.html',
					controller: 'networkPinUnlockCtrl as pinUnlock'
				})
				.state('network-pukUnlock', {
					url: '/network-pukUnlock',
					templateUrl: 'mod/network/template/pukUnlock.html',
					controller: 'networkPukUnlockCtrl as pukUnlock'
				})
		}
	])

	.constant('networkConstant', {
		MOD: {
			WAN: 'wan',
			SIMLOCK: 'simLock'
		},
		ACTION: {
			// common
			GET_CONFIG: 0,
			// wan
			SET_CONFIG: 1,
			ADD_ENABLE_PROFILE: 2,
			DELETE_PROFILE: 3,
			CONNECT: 4,
			DISCONNECT: 5,
			GET_CONNECT_STATUS: 6,
			ADD_PROFILE: 7,
			GET_DISCONNECT_REASON: 11,
			EDIT_PROFILE: 13,
			// sim-lock
			ENABLE_PIN: 1,
			DISABLE_PIN: 2,
			MODIFY_PIN: 3,
			ENTER_PIN: 4,
			ENTER_PUK: 5,
			MODIFY_AUTO_UNLOCK: 6
		},
		RESULT: {
			// common
			SUCCESS: 0,
			FAIL: 1,
			// wan
			DISABLE: 0,
			DISCONNECTED: 1,
			CONNECTING: 2,
			DISCONNECTING: 3,
			CONNECTED: 4
		}
	})

	.value('networkValue', {
		wan: {},
		simLock: {}
	})

	.factory('networkUtil', ['tpService',
		function(tpService) {
			var saveData = function(mod, action, data, saveCallback) {
				tpService.serverDataService.request({
					module: mod,
					action: action,
					data: data,
					callback: function(data) {
						if (typeof(saveCallback) === 'function') {
							saveCallback(data);
						} else {
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

	.controller('networkCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					dialUpType: '',
					dialUpTypes: [{
						type: 0,
						name: "NETWORK.CONTENT.MANUAL"
					}, {
						type: 1,
						name: "NETWORK.CONTENT.AUTO"
					}],
					networkMode: '',
					networkModes: [{
						type: 0,
						name: "NETWORK.CONTENT.2G_ONLY"
					}, {
						type: 1,
						name: "NETWORK.CONTENT.3G_ONLY"
					}, {
						type: 2,
						name: "NETWORK.CONTENT.4G_ONLY"
					}, {
						type: 3,
						name: "NETWORK.CONTENT.4G_PREFER"
					}],
					dialUpManual: false,
					isConnected: false,
					isRoaming: false,
					connectTimer: 0,
					getConnectStatusInterval: 1000,
					checkTimes: 0,
					MAX_CHECK_TIME: 10,
					flowstat: {}
				},
				server: {},
				backup: {}
			};

			var simStatus;

			$scope.action = {
				connect: function() {
					tpService.promptService.loading.show();
					if ($scope.data.local.isConnected) {
						networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.CONNECT, $scope.data.server.wan, connectCallback);
					} else {
						networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.DISCONNECT, $scope.data.server.wan, disconnectCallback);
					}
				},
				roaming: function() {
					$scope.data.server.wan.roamingEnabled = $scope.data.local.isRoaming;
					networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.SET_CONFIG, $scope.data.server.wan, roamingCallback);
				},
				pinManage: function() {
					switch (simStatus) {
						case 0:
							tpService.promptService.toast.error('NETWORK.CONTENT.VERIFY_SIM_CARD');
							break;
						case 1:
							tpService.promptService.toast.error('NETWORK.CONTENT.DETECT_SIM_CARD_ERROR');
							break;
						case 2:
							tpService.promptService.toast.error('NETWORK.CONTENT.SIM_CARD_ERROR');
							break;
						case 4:
							tpService.linkService.gotoMod('network-pinUnlock');
							break;
						case 6:
							tpService.linkService.gotoMod('network-pukUnlock');
							break;
						case 7:
							tpService.promptService.toast.error('NETWORK.CONTENT.SIM_CARD_BLOCKED');
							break;
						//case 3:
						//case 5:
						default:
							tpService.linkService.gotoMod('network-pinManage');
							break;
					}
				}
			};

			var updateView = {
				wan: function(data) {
					tpService.promptService.loading.hide();
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					networkValue.wan = data;
					$scope.data.server.wan = data;
					$scope.data.backup.wan = {};
					angular.copy(data, $scope.data.backup.wan);

					$scope.data.local.flowstat = tpService.dataSharingService.get('flowstat');

					$scope.data.local.dialUpType = $scope.data.local.dialUpTypes[$scope.data.server.wan.connectMode].name;
					if ($scope.data.local.dialUpType === $scope.data.local.dialUpTypes[0].name) {
						$scope.data.local.dialUpManual = true;
						if ($scope.data.server.wan.connectStatus === 4) {
							$scope.data.local.isConnected = true;
						} else {
							$scope.data.local.isConnected = false;
						}
					} else {
						$scope.data.local.dialUpManual = false;
						$scope.data.local.isConnected = false;

						if ($scope.data.local.flowstat.enableDataLimit) {
							if ($scope.data.local.flowstat.limitType === 0 && Number($scope.data.local.flowstat.adjustStatistics) >= Number($scope.data.local.flowstat.limitation)) {
								tpService.promptService.toast.warning('NETWORK.CONTENT.DATA_LIMIT_EXCEED');
							}
							if ($scope.data.local.flowstat.limitType === 1 && Number($scope.data.local.flowstat.adjustTime) >= Number($scope.data.local.flowstat.limitation)) {
								tpService.promptService.toast.warning('NETWORK.CONTENT.TIME_LIMIT_EXCEED');
							}
						}
					}

					$scope.data.local.isRoaming = $scope.data.server.wan.roamingEnabled;

					if ($scope.data.server.wan.cardType === 1) {
						$scope.data.local.networkModes[1].name = "NETWORK.CONTENT.2G_3G";

					}
					$scope.data.local.networkMode = $scope.data.local.networkModes[$scope.data.server.wan.networkPreferredMode].name;
				}
			}

			function enterCallback() {
				simStatus = tpService.dataSharingService.get('status').wan.simStatus;
				if (simStatus === 4) {
					// when pin locked, jump to pin unlock page.
					tpService.linkService.gotoMod('network-pinUnlock');
				} else if (simStatus === 6) {
					// when puk locked, jump to puk unlock page.
					tpService.linkService.gotoMod('network-pukUnlock');
				} else {
					requestData();
				}
			}

			function requestData() {
				tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: networkConstant.MOD.WAN,
					action: networkConstant.ACTION.GET_CONFIG,
					callback: updateView.wan
				});
			}

			function getConnectStatus() {
				$scope.data.local.connectTimer = setTimeout(function() {
					tpService.serverDataService.request({
						module: networkConstant.MOD.WAN,
						action: networkConstant.ACTION.GET_CONNECT_STATUS,
						callback: checkConnectStatus
					});
				}, $scope.data.local.getConnectStatusInterval);
			}

			function checkConnectStatus(data) {
				clearTimeout($scope.data.local.getConnectStatusInterval);
				if (!data || data.result !== 0 || $scope.data.local.checkTimes++ > $scope.data.local.MAX_CHECK_TIME) {
					tpService.promptService.loading.hide();
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					$scope.data.local.checkTimes = 0;
					requestData();
					return;
				}
				switch (data.connectStatus) {
					case networkConstant.RESULT.CONNECTING:
					case networkConstant.RESULT.DISCONNECTING:
						getConnectStatus();
						break;
					//case networkConstant.RESULT.DISABLE:
					//case networkConstant.RESULT.DISCONNECTED:
					//case networkConstant.RESULT.CONNECTED:
					default:
						tpService.promptService.loading.hide();
						$scope.data.local.checkTimes = 0;
						requestData();
						break;
				}
			}

			function connectCallback(data) {
				if (!data || data.result !== 0) {
					tpService.promptService.loading.hide();
					tpService.promptService.toast.error('NETWORK.CONTENT.CONNECT_FAIL');
					$scope.data.local.isConnected = false;
					return;
				}
				getConnectStatus();
			}

			function disconnectCallback(data) {
				if (!data || data.result !== 0) {
					tpService.promptService.loading.hide();
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					$scope.data.local.isConnected = true;
					return;
				}
				getConnectStatus();
			}

			function roamingCallback(data) {
				if (!data || data.result === 1) {
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					$scope.data.local.isRoaming = false;
					return;
				}
			}
		}
	])

	.controller('networkDialUpTypeCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					dialUpTypes: [{
						type: 0,
						name: "NETWORK-DIALUP_TYPE.CONTENT.MANUAL"
					}, {
						type: 1,
						name: "NETWORK-DIALUP_TYPE.CONTENT.AUTO"
					}]
				},
				server: {
					wan: networkValue.wan,
					dialUpManual: false,
					dialUpAuto: true
				},
				backup: {
					wan: {}
				}
			}

			$scope.data.local.dialUpType = $scope.data.local.dialUpTypes[$scope.data.server.wan.connectMode];
			angular.copy($scope.data.server.wan, $scope.data.backup.wan);

			$scope.action = {
				submit: function(dialUpType) {
					$scope.data.server.wan.connectMode = dialUpType.type;
					if (tpUtil.diffUtil.isAllEqual($scope.data.server.wan.connectMode, $scope.data.backup.wan.connectMode)) {
						tpService.linkService.goBack();
						return;
					}
					networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.SET_CONFIG, $scope.data.server.wan, saveCallback);
				}
			}

			function saveCallback(data) {
				tpService.linkService.goBack();
				if (!data) {
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					return;
				}
				if (data.result === 1) {
					if ($scope.data.server.wan.connectMode === 0) {
						tpService.promptService.toast.error('NETWORK-DIALUP_TYPE.CONTENT.SET_MANUAL_FAIL');
					} else if ($scope.data.server.wan.connectMode === 1) {
						tpService.promptService.toast.error('NETWORK-DIALUP_TYPE.CONTENT.SET_AUTO_FAIL');
					}
					return;
				}
			}
		}
	])

	.controller('networkNetworkModeCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					networkModes: [{
						type: 1,
						name: "NETWORK-NETWORK_MODE.CONTENT.3G_ONLY"
					}, {
						type: 2,
						name: "NETWORK-NETWORK_MODE.CONTENT.4G_ONLY"
					}, {
						type: 3,
						name: "NETWORK-NETWORK_MODE.CONTENT.4G_PREFER"
					}]
				},
				server: {
					wan: networkValue.wan
				},
				backup: {
					wan: {}
				}
			}

			angular.copy($scope.data.server.wan, $scope.data.backup.wan);

			if ($scope.data.server.wan.cardType === 1) {
				$scope.data.local.networkModes[0].name = "NETWORK-NETWORK_MODE.CONTENT.2G_3G";
			}
			$scope.data.local.productID = tpService.dataSharingService.get('status').deviceInfo.productID;
			if ($scope.data.local.productID === tpProtocol.protocolConstant.PRODUCT.TR961_5200L_V1.ID) {
				var dst = [],
					src = {
						type: 0,
						name: 'NETWORK-NETWORK_MODE.CONTENT.2G_ONLY'
					};
				dst.push(src, $scope.data.local.networkModes[0], $scope.data.local.networkModes[1], $scope.data.local.networkModes[2]);
				$scope.data.local.networkModes = dst;
				$scope.data.local.networkMode = $scope.data.local.networkModes[$scope.data.server.wan.networkPreferredMode];
			} else {
				$scope.data.local.networkMode = $scope.data.local.networkModes[$scope.data.server.wan.networkPreferredMode - 1];
			}

			$scope.action = {
				submit: function(networkMode) {
					$scope.data.server.wan.networkPreferredMode = networkMode.type;
					if (tpUtil.diffUtil.isAllEqual($scope.data.server.wan.networkPreferredMode, $scope.data.backup.wan.networkPreferredMode)) {
						tpService.linkService.goBack();
						return;
					}
					networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.SET_CONFIG, $scope.data.server.wan, saveCallback);
				}
			}

			function saveCallback(data) {
				tpService.linkService.goBack();
				if (!data || data.result === 1) {
					tpService.promptService.toast.error('COMMON.CONTENT.CONFIGURE_FAILED');
					return;
				}
				if (data.result === 2) {
					tpService.promptService.toast.error('NETWORK.CONTENT.DETECT_SIM_CARD_ERROR');
					return;
				}
			}
		}
	])

	.controller('networkApnManageCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					profile: {},
					profileSettings: {
						list: []
					}
				},
				server: {
					profileSettings: {
						list: []
					}
				}
			}

			$scope.action = {
				addApn: function() {
					if ($scope.data.local.profileSettings.list.length < 9) {
						tpService.linkService.gotoMod('network-addApn');
					} else {
						tpService.promptService.toast.warning('NETWORK-APN_MANAGE.CONTENT.TOP_NUMBER_WARNING');
						return;
					}
				},
				active: function(profile) {
					if (profile.profileID === $scope.data.local.profileSettings.activeProfile) {
						return;
					}
					$scope.data.server = {
						profileSettings: {
							list: [{
								profileID: profile.profileID,
								profileName: profile.profileName,
								pdpType: profile.pdpType,
								ipv6Username: profile.ipv6Username,
								ipv6Password: profile.ipv6Password,
								ipv6AuthType: profile.ipv6AuthType,
								ipv6ApnType: profile.ipv6ApnType,
								ipv6Apn: profile.ipv6Apn,
								ipv4Username: profile.ipv4Username,
								ipv4Password: profile.ipv4Password,
								ipv4AuthType: profile.ipv4AuthType,
								ipv4ApnType: profile.ipv4ApnType,
								ipv4Apn: profile.ipv4Apn
							}],
							defaultProfile: $scope.data.local.profileSettings.defaultProfile,
							activeProfile: profile.profileID
						}
					};
					networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.SET_CONFIG, $scope.data.server, activeProfileCallback)
				},
				delete: function(profile) {
					tpService.promptService.popup.confirm('NETWORK-APN_MANAGE.CONTENT.DELETE_APN_CONFIRM', 'COMMON.CONTENT.DELETE', function(isOK) {
						if (isOK) {
							$scope.data.server = {
								profileSettings: {
									list: [{
										profileID: profile.profileID
									}],
									defaultProfile: $scope.data.local.profileSettings.defaultProfile,
									activeProfile: $scope.data.local.profileSettings.activeProfile
								}
							};
							networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.DELETE_PROFILE, $scope.data.server, requestData);
						}
					});
				}
			}

			var updateView = {
				apn: function(data) {
					//tpService.promptService.loading.hide();
					if (!data || data.result !== 0) {
						// tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}
					networkValue.wan = data;
					$scope.data.server.profileSettings = data.profileSettings;
					$scope.data.local.profileSettings = $scope.data.server.profileSettings;
					$scope.data.local.profile = $scope.data.local.profileSettings.list[$scope.data.local.profileSettings.activeProfile];
				}
			}

			function enterCallback() {
				requestData();
			}

			function requestData() {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: networkConstant.MOD.WAN,
					action: networkConstant.ACTION.GET_CONFIG,
					callback: updateView.apn
				});
			}

			function activeProfileCallback(data) {
				if (!data || data.result === 1) {
					tpService.promptService.toast.error('NETWORK-APN_MANAGE.CONTENT.SELECT_APN_ERROR');
					//tpService.linkService.goBack();
					return;
				}
				requestData();
			}
		}
	])

	.controller('networkAddApnCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					apnTypes: [{
						type: 0,
						name: 'NETWORK-ADD_APN.CONTENT.STATIC'
					}, {
						type: 1,
						name: 'NETWORK-ADD_APN.CONTENT.DYNAMIC'
					}],
					profile: {
						apnType: ''
					}
				},
				server: {
					profileSettings: networkValue.wan.profileSettings,
					profile: {
						profileName: '',
						ipv4Apn: '',
						ipv4Username: '',
						ipv4Password: ''
					}
				},
				backup: {
					profile: {}
				}
			}

			$scope.data.local.profile.apnType = $scope.data.local.apnTypes[0];
			angular.copy($scope.data.server.profile, $scope.data.backup.profile);

			$scope.action = {
				submit: function() {
					for (var i = 0, len = $scope.data.server.profileSettings.list.length; i < len; i++) {
						if ($scope.data.server.profile.profileName === $scope.data.server.profileSettings.list[i].profileName) {
							tpService.promptService.toast.warning('NETWORK-ADD_APN.CONTENT.PROFILE_EXIST');
							return;
						}
					}

					var addProfile = {
						profileSettings: {
							list: [{
								profileName: $scope.data.server.profile.profileName,
								profileID: $scope.data.server.profileSettings.list.length,
								pdpType: 0,
								ipv6Username: '',
								ipv6Password: '',
								ipv6AuthType: 2,
								ipv6ApnType: 0,
								ipv6Apn: '',
								ipv4Username: $scope.data.server.profile.ipv4Username,
								ipv4Password: $scope.data.server.profile.ipv4Password,
								ipv4AuthType: 2,
								ipv4ApnType: $scope.data.local.profile.apnType.type,
								ipv4Apn: $scope.data.server.profile.ipv4Apn
							}],
							defaultProfile: $scope.data.server.profileSettings.defaultProfile
						}
					}
					networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.ADD_ENABLE_PROFILE, addProfile, addProfileCallback)
				},
				changeApnType: function() {
					$scope.data.server.profile.ipv4ApnType = $scope.data.local.profile.apnType.type;
				}
			}

			function addProfileCallback(data) {
				if (!data) {
					tpService.promptService.toast.error('COMMON.COMMON.CONFIGURE_FAILED');
					return;
				}
				if (data.result === 1) {
					tpService.promptService.toast.error('NETWORK-ADD_APN.CONTENT.SET_APN_ERROR');
				} else if (data.result === 2) {
					tpService.promptService.toast.error('NETWORK-APN_MANAGE.CONTENT.TOP_NUMBER_WARNING');
				}
				tpService.linkService.goBack();
			}
		}
	])

	.controller('networkEditApnCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$stateParams',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope, $stateParams) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					apnTypes: [{
						type: 0,
						name: 'NETWORK-ADD_APN.CONTENT.STATIC'
					}, {
						type: 1,
						name: 'NETWORK-ADD_APN.CONTENT.DYNAMIC'
					}],
					profile: {
						apnType: ''
					}
				},
				server: {
					profileSettings: networkValue.wan.profileSettings,
					profile: {}
				},
				backup: {
					profile: {}
				}
			}

			angular.copy($stateParams.profile, $scope.data.server.profile);
			angular.copy($scope.data.server.profile, $scope.data.backup.profile);
			$scope.data.local.profile.apnType = $scope.data.local.apnTypes[$scope.data.server.profile.ipv4ApnType];

			$scope.action = {
				submit: function() {
					for (var i = 0, len = $scope.data.server.profileSettings.list.length; i < len; i++) {
						if ($scope.data.server.profile.profileName === $scope.data.backup.profile.profileName) {
							continue;
						} else if ($scope.data.server.profile.profileName === $scope.data.server.profileSettings.list[i].profileName && $scope.data.server.profile.profileID !== $scope.data.server.profileSettings.list[i].profileID) {
							tpService.promptService.toast.warning('NETWORK-ADD_APN.CONTENT.PROFILE_EXIST');
							return;
						}
					}

					var editProfile = {
						profileSettings: {
							list: [{
								profileName: $scope.data.server.profile.profileName,
								profileID: $scope.data.server.profile.profileID,
								pdpType: 0,
								ipv6Username: '',
								ipv6Password: '',
								ipv6AuthType: 2,
								ipv6ApnType: 0,
								ipv6Apn: '',
								ipv4Username: $scope.data.server.profile.ipv4Username,
								ipv4Password: $scope.data.server.profile.ipv4Password,
								ipv4AuthType: 2,
								ipv4ApnType: $scope.data.server.profile.ipv4ApnType,
								ipv4Apn: $scope.data.server.profile.ipv4Apn
							}],
							defaultProfile: $scope.data.server.profileSettings.defaultProfile,
							activeProfile: $scope.data.server.profile.activeProfile
						}
					}
					networkUtil.saveData(networkConstant.MOD.WAN, networkConstant.ACTION.EDIT_PROFILE, editProfile, editProfileCallback)
				},
				changeApnType: function() {
					$scope.data.server.profile.ipv4ApnType = $scope.data.local.profile.apnType.type;
				}
			}

			function editProfileCallback(data) {
				if (!data || data.result !== 0) {
					tpService.promptService.toast.error('COMMON.COMMON.CONFIGURE_FAILED');
					return;
				}
				tpService.linkService.goBack();
			}
		}
	])

	.controller('networkPinManageCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					cardState: 0,
					pinState: false,
					leftTimes: 3,
					promptMessageNormal: '',
					promptMessageWrong: ''
				},
				server: {},
				backup: {}
			}

			$scope.action = {
				simLock: function() {
					if ($scope.data.local.leftTimes === 3) {
						tpService.languageService.translate('NETWORK-PIN_MANAGE.CONTENT.REMAINING_ATTEMPT', function(string) {
							$scope.data.local.promptMessageNormal = string;
							tpService.promptService.popup.prompt(
								$scope.data.local.promptMessageNormal + $scope.data.local.leftTimes,
								'NETWORK-PIN_MANAGE.CONTENT.ENTER_PIN',
								$scope.action.inputHandle,
								'text',
								'NETWORK-PIN_MANAGE.CONTENT.ENTER_PIN');
						});
					} else if ($scope.data.local.leftTimes > 0) {
						tpService.languageService.translate('NETWORK-PIN_MANAGE.CONTENT.WRONG_PIN', function(string) {
							$scope.data.local.promptMessageWrong = string;
							tpService.promptService.popup.prompt(
								$scope.data.local.promptMessageWrong + $scope.data.local.leftTimes,
								'NETWORK-PIN_MANAGE.CONTENT.ENTER_PIN',
								$scope.action.inputHandle,
								'text',
								'NETWORK-PIN_MANAGE.CONTENT.ENTER_PIN');
						});
					} else if ($scope.data.local.leftTimes <= 0) {
						$scope.data.local.leftTimes = 0;
						tpService.linkService.gotoMod('network-pukUnlock');
					}
				},
				inputHandle: function(input) {
					if (!input) {
						// Click "CANCEL"
						$scope.data.local.pinState = !$scope.data.local.pinState;
						return;
					}
					if (!tpUtil.checkUtil.network.isPin(input)) {
						tpService.promptService.toast.warning('NETWORK-PIN_MANAGE.CONTENT.PIN_PATTERN_ERROR');
						$scope.data.local.pinState = !$scope.data.local.pinState;
						return;
					}
					if ($scope.data.local.pinState) {
						$scope.action.enablePin(input);
					} else {
						$scope.action.disablePin(input);
					}
				},
				enablePin: function(input) {
					var data = {
						pin: input
					};
					networkUtil.saveData(networkConstant.MOD.SIMLOCK, networkConstant.ACTION.ENABLE_PIN, data, savePinCallback)
				},
				disablePin: function(input) {
					var data = {
						pin: input
					};
					networkUtil.saveData(networkConstant.MOD.SIMLOCK, networkConstant.ACTION.DISABLE_PIN, data, savePinCallback)
				}
			}

			var updateView = {
				sim: function(data) {
					//tpService.promptService.loading.hide();
					if (!data || data.result !== 0) {
						// tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					networkValue.simLock = data;
					$scope.data.server.simLock = data;
					$scope.data.backup.simLock = {};
					angular.copy($scope.data.server.simLock, $scope.data.backup.simLock);

					$scope.data.local.cardState = $scope.data.server.simLock.cardState;
					if ($scope.data.local.cardState !== 1) {
						return;
					}

					$scope.data.local.leftTimes = $scope.data.server.simLock.pinRemainingTimes;

					if ($scope.data.server.simLock.pinState === 2) {
						$scope.data.local.pinState = true;
					} else if ($scope.data.server.simLock.pinState === 3) {
						$scope.data.local.pinState = false;
					}
				}
			}

			function enterCallback() {
				requestData();
			}

			function requestData() {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: networkConstant.MOD.SIMLOCK,
					action: networkConstant.ACTION.GET_CONFIG,
					callback: updateView.sim
				});
			}

			function savePinCallback(data) {
				if (!data || data.result === 1) {
					$scope.data.local.pinState = !$scope.data.local.pinState;
					tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
					return;
				}
				if (data.result === 2) {
					$scope.data.local.pinState = !$scope.data.local.pinState;
					$scope.data.local.leftTimes--;
					networkValue.simLock.pinRemainingTimes = $scope.data.local.leftTimes;
					if ($scope.data.local.leftTimes > 0) {
						tpService.promptService.toast.error('NETWORK-PIN_MANAGE.CONTENT.WRONG_PIN_ERROR');
					} else {
						$scope.data.local.leftTimes = 0;
						tpService.promptService.toast.error('NETWORK-PUK_UNLOCK.CONTENT.PIN_LOCKED');
						tpService.linkService.gotoMod('network-pukUnlock');
					}
					return;
				}
				tpService.promptService.toast.success('COMMON.CONTENT.SUCCESS');
				$scope.data.local.leftTimes = data.pinRemainingTimes;
				networkValue.simLock.pinRemainingTimes = data.pinRemainingTimes;
			}
		}
	])

	.controller('networkChangePinCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					currentPin: '',
					newPin: '',
					leftTimes: ''
				},
				server: {}
			}

			$scope.action = {
				submit: function() {
					if ($scope.data.local.leftTimes <= 0) {
						$scope.data.local.leftTimes = 0;
						tpService.linkService.gotoMod('network-pukUnlock');
						return;
					}
					$scope.data.server = {
						pin: $scope.data.local.currentPin,
						newPin: $scope.data.local.newPin
					}
					networkUtil.saveData(networkConstant.MOD.SIMLOCK, networkConstant.ACTION.MODIFY_PIN, $scope.data.server, changePinCallback)
				}
			}

			function enterCallback() {
				$scope.data.local.leftTimes = networkValue.simLock.pinRemainingTimes;
			}

			function changePinCallback(data) {
				if (!data || data.result === 1) {
					tpService.promptService.toast.error('NETWORK-CHANGE_PIN.CONTENT.INVALID_PIN_ERROR');
					return;
				}
				if (data.result === 2) {
					$scope.data.local.leftTimes--;
					if ($scope.data.local.leftTimes > 0) {
						tpService.promptService.toast.error('NETWORK-CHANGE_PIN.CONTENT.WRONG_PIN_ERROR');
					} else {
						$scope.data.local.leftTimes = 0;
						tpService.promptService.toast.error('NETWORK-PUK_UNLOCK.CONTENT.PIN_LOCKED');
						tpService.linkService.gotoMod('network-pukUnlock');
					}
					return;
				}
				tpService.promptService.toast.success('COMMON.CONTENT.SUCCESS');
				$scope.data.local.leftTimes = data.pinRemainingTimes;
				tpService.linkService.goBack();
			}
		}
	])

	.controller('networkPinUnlockCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$ionicPlatform',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope, $ionicPlatform) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			});

			$scope.data = {
				local: {
					leftTimes: '',
					pin: ''
				}
			}

			$scope.action = {
				confirm: function() {
					if ($scope.data.local.leftTimes <= 0) {
						$scope.data.local.leftTimes = 0;
						tpService.linkService.gotoMod('network-pukUnlock');
					} else {
						var data = {
							pin: $scope.data.local.pin
						};
						networkUtil.saveData(networkConstant.MOD.SIMLOCK, networkConstant.ACTION.ENTER_PIN, data, unlockPinCallback)
					}
				}
			}

			var updateView = {
				pinUnlock: function(data) {
					if (!data || data.result !== 0) {
						// tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}
					$scope.data.local.leftTimes = data.pinRemainingTimes;
				}
			}

			function enterCallback() {
				tpService.linkService.registerBackButtonAction(tpService.linkService.goBackHome);
				requestData();
			}

			function beforeLeaveCallback() {
				tpService.linkService.unregisterBackButtonAction(tpService.linkService.goBackHome);
			}

			function requestData() {
				tpService.serverDataService.request({
					module: networkConstant.MOD.SIMLOCK,
					action: networkConstant.ACTION.GET_CONFIG,
					callback: updateView.pinUnlock
				});
			}

			function unlockPinCallback(data) {
				if (!data || data.result === 1) {
					tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
					return;
				}
				if (data.result === 2) {
					$scope.data.local.leftTimes = data.pinRemainingTimes;
					if ($scope.data.local.leftTimes > 0) {
						tpService.promptService.toast.error('NETWORK-PIN_MANAGE.CONTENT.WRONG_PIN_ERROR');
					} else {
						$scope.data.local.leftTimes = 0;
						tpService.promptService.toast.error('NETWORK-PUK_UNLOCK.CONTENT.PIN_LOCKED');
						tpService.linkService.gotoMod('network-pukUnlock');
					}
					return;
				}
				tpService.promptService.toast.success('COMMON.CONTENT.SUCCESS');
				$scope.data.local.leftTimes = data.pinRemainingTimes;
				networkValue.simLock.pinRemainingTimes = data.pinRemainingTimes;
				// unlock pin success, set sim card to ready state
				var status = tpService.dataSharingService.get('status');
				status.wan.simStatus = 3;
				tpService.dataSharingService.set('status', status);
				tpService.linkService._goBack();
			}
		}
	])

	.controller('networkPukUnlockCtrl', ['networkConstant', 'networkValue', 'networkUtil', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$ionicPlatform',
		function(networkConstant, networkValue, networkUtil, tpService, tpUtil, tpProtocol, $scope, $ionicPlatform) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			});

			$scope.data = {
				local: {
					pukTimes: '',
					puk: '',
					newPin: ''
				},
				server: {}
			}

			$scope.action = {
				confirm: function() {
					if ($scope.data.local.pukTimes > 0) {
						$scope.data.server = {
							puk: $scope.data.local.puk,
							newPin: $scope.data.local.newPin
						}
						networkUtil.saveData(networkConstant.MOD.SIMLOCK, networkConstant.ACTION.ENTER_PUK, $scope.data.server, unlockPukCallback)
					} else {
						$scope.data.local.pukTimes = 0;
						tpService.promptService.toast.error('NETWORK-PUK_UNLOCK.CONTENT.SIM_CARD_BLOCKED');
						tpService.linkService.goBackHome();
						return;
					}
				}
			}

			var updateView = {
				pukUnlock: function(data) {
					if (!data || data.result !== 0) {
						// tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}
					$scope.data.local.pukTimes = data.pukRemainingTimes;
				}
			}

			function enterCallback() {
				tpService.linkService.registerBackButtonAction(tpService.linkService.goBackHome);
				requestData();
			}

			function beforeLeaveCallback() {
				tpService.linkService.unregisterBackButtonAction(tpService.linkService.goBackHome);
			}

			function requestData() {
				tpService.serverDataService.request({
					module: networkConstant.MOD.SIMLOCK,
					action: networkConstant.ACTION.GET_CONFIG,
					callback: updateView.pukUnlock
				});
			}

			function unlockPukCallback(data) {
				if (!data || data.result === 1) {
					tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
					return;
				}
				if (data.result === 2) {
					$scope.data.local.pukTimes = data.pukRemainingTimes;
					if ($scope.data.local.pukTimes > 0) {
						tpService.promptService.toast.error('NETWORK-PUK_UNLOCK.CONTENT.WRONG_PUK');
					} else {
						$scope.data.local.pukTimes = 0;
						tpService.promptService.toast.error('NETWORK-PUK_UNLOCK.CONTENT.SIM_CARD_BLOCKED');
						tpService.linkService.goBackHome();
					}
					return;
				}
				tpService.promptService.toast.success('COMMON.CONTENT.SUCCESS');
				$scope.data.local.pukTimes = data.pukRemainingTimes;
				networkValue.simLock.pinRemainingTimes = data.pinRemainingTimes;
				// unlock puk success, set sim card to ready state
				var status = tpService.dataSharingService.get('status');
				status.wan.simStatus = 3;
				tpService.dataSharingService.set('status', status);
				tpService.linkService._goBack();
			}
		}
	])

})();
