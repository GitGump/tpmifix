(function() {
	'use strict';

	/**
	 * @description
	 * ClientList is module to control MiFi's connected devices and white list.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.clientList
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.clientList', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('clientList', {
					url: '/clientList',
					templateUrl: 'mod/clientList/mod.html',
					controller: 'clientListCtrl'
				})
				.state('clientList-whiteList', {
					url: '/clientList-whiteList',
					templateUrl: 'mod-clientList-whiteList.html',
					controller: 'clientListWhiteListCtrl'
				})
				.state('clientList-renameDevice', {
					url: '/clientList-renameDevice',
					templateUrl: 'mod-clientList-renameDevice.html',
					controller: 'clientListRenameDeviceCtrl',
					params: {
						connDevice: null
					}
				})
				.state('clientList-listDevice', {
					url: '/clientList-listDevice',
					templateUrl: 'mod-clientList-listDevice.html',
					controller: 'clientListListDeviceCtrl'
				})
				.state('clientList-addDevice', {
					url: '/clienList-addDevice',
					templateUrl: 'mod-clientList-addDevice.html',
					controller: 'clientListAddDeviceCtrl as clientList'
				})
		}
	])

	.constant('clientListConstant', {
		MOD: {
			MAC_FILTERS: 'macFilters',
			CONNECTED_DEVICES: 'connectedDevices'
		},
		ACTION: {
			GET_CONFIG: 0,
			SET_CONFIG: 1
		},
		HEARTBEAT_INTERVAL: 10 * 1000
	})

	.value('clientListValue', {
		connectedDevices: {
			STAs: {} // Connected device list from backend
		},
		macFilters: {},
		myDevice: {},
		connDeviceList: [] // Connected device list saved in local storage
	})

	.factory('clientListService', ['clientListConstant', 'tpService',
		function(clientListConstant, tpService) {
			var saveData = function(data, saveCallback) {
				tpService.serverDataService.request({
					module: clientListConstant.MOD.MAC_FILTERS,
					action: clientListConstant.ACTION.SET_CONFIG,
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

	.controller('clientListCtrl', ['clientListConstant', 'clientListValue', 'clientListService', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$interval',
		function(clientListConstant, clientListValue, clientListService, tpService, tpUtil, tpProtocol, $scope, $interval) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			});

			$scope.data = {
				local: {
					images: {
						clientList_device_normal: tpService.modService.getModImgUrl('clientList_device_normal.png'),
						clientList_device_connected: tpService.modService.getModImgUrl('clientList_device_connected.png')
					},
					whiteListState: '',
					whiteListStates: [{
						type: 0,
						name: 'CLIENT_LIST.CONTENT.OFF'
					}, {
						type: 1,
						name: 'CLIENT_LIST.CONTENT.ON'
					}],
					allowList: [],
					connDevices: [],
					enable: false,
					myDevice: {
						name: undefined,
						mac: ''
					},
					stopRequestData: '',
				},
				server: {
					connectedDevices: {
						STAs: {}
					},
					macFilters: {}
				}
			}

			$scope.action = {};

			var updateView = {
				allowList: function(data) {
					clientListValue.macFilters.allowList = data.allowList;
					clientListValue.macFilters.enable = data.enable;
					clientListValue.macFilters.mode = data.mode;
					$scope.data.server.macFilters.allowList = data.allowList;
					if ($scope.data.server.macFilters.allowList === undefined) {
						$scope.data.server.macFilters.allowList = [];
					}
					$scope.data.local.myDevice.mac = data.clientMac;
					$scope.data.server.macFilters.enable = data.enable;
					$scope.data.local.whiteListState = $scope.data.local.whiteListStates[Number($scope.data.server.macFilters.enable)];
				},
				connDevices: function(data) {
					clientListValue.connectedDevices.STAs = data.STAs;
					angular.copy(data.STAs, $scope.data.server.connectedDevices.STAs);

					// Connected by usb, show rndis info as My device
					if ($scope.data.local.myDevice.mac === undefined) {
						$scope.data.local.myDevice.mac = data.rndis.mac;
						$scope.data.local.myDevice.name = data.rndis.name;
					}

					// Check and use user's defined name instead of description if the device is in the white list
					var i, j;
					for (i = 0; i < $scope.data.server.connectedDevices.STAs.list.length; i++) {
						for (j = 0; j < $scope.data.server.macFilters.allowList.length; j++) {
							if ($scope.data.server.connectedDevices.STAs.list[i].mac.toUpperCase() === $scope.data.server.macFilters.allowList[j].mac.toUpperCase()) {
								if ($scope.data.server.macFilters.allowList[j].description !== '') {
									$scope.data.server.connectedDevices.STAs.list[i].name = $scope.data.server.macFilters.allowList[j].description;
								}
							}
						}
						// If my device is in connected devices, pick it out and show it as My device
						if ($scope.data.local.myDevice.mac.toUpperCase() === $scope.data.server.connectedDevices.STAs.list[i].mac.toUpperCase()) {
							$scope.data.local.myDevice.name = $scope.data.server.connectedDevices.STAs.list[i].name;
							$scope.data.server.connectedDevices.STAs.list.splice(i, 1);
						}
					}

					// Expose myDevice to clientListWhiteListCtrl
					clientListValue.myDevice = $scope.data.local.myDevice;
					$scope.data.local.connDevices = $scope.data.server.connectedDevices.STAs.list;

					var connDeviceTempList = [];
					var connDeviceTempList2 = [];
					connDeviceTempList = data.STAs.list;
					for (i = 0; i < connDeviceTempList.length; i++) {
						if (connDeviceTempList[i].ip !== undefined && connDeviceTempList[i].onlineTime !== undefined) {
							delete connDeviceTempList[i].ip;
							delete connDeviceTempList[i].onlineTime;
						}
					}

					// Get connected devices from local storage
					clientListValue.connDeviceList = tpService.localDataService.getDevice('clientList.connDeviceList');

					// Add new connected devices to connDeviceList
					if (clientListValue.connDeviceList === null) {
						// First use or clean cache
						clientListValue.connDeviceList = connDeviceTempList;
					} else {
						connDeviceTempList2 = clientListValue.connDeviceList;
						for (i = 0; i < connDeviceTempList.length; i++) {
							var flag = true;
							for (j = 0; j < connDeviceTempList2.length; j++) {
								if (connDeviceTempList[i].mac.toUpperCase() === connDeviceTempList2[j].mac.toUpperCase()) {
									flag = false;
									break;
								}
							}
							if (flag) {
								// If connected device is not is in connDeviceList, add it to connDeviceList in local storage
								clientListValue.connDeviceList.push(connDeviceTempList[i]);
							}
						}
					}

					// Save connected devices to local storage and expose to clientListListDeviceCtrl
					tpService.localDataService.setDevice('clientList.connDeviceList', clientListValue.connDeviceList);
				}
			}

			function enterCallback() {
				requestData();
				// Request data and update view periodically
				$scope.data.local.stopRequestData = $interval(requestData, clientListConstant.HEARTBEAT_INTERVAL);
			}

			function beforeLeaveCallback() {
				if ($scope.data.local.stopRequestData) {
					$interval.cancel($scope.data.local.stopRequestData);
				}
			}

			function requestData() {
				tpService.serverDataService.request({
					module: clientListConstant.MOD.MAC_FILTERS,
					action: clientListConstant.ACTION.GET_CONFIG,
					callback: function(data) {
						if (!data || data.result !== 0) {
							// tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
							return;
						}
						updateView.allowList(data);
						tpService.serverDataService.request({
							module: clientListConstant.MOD.CONNECTED_DEVICES,
							action: clientListConstant.ACTION.GET_CONFIG,
							callback: function(data) {
								if (!data || data.result !== 0) {
									// tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
									return;
								}
								updateView.connDevices(data);
							}
						});
					}
				});
			}
		}
	])

	.controller('clientListWhiteListCtrl', ['clientListConstant', 'clientListValue', 'clientListService', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$ionicPopover', '$filter',
		function(clientListConstant, clientListValue, clientListService, tpService, tpUtil, tpProtocol, $scope, $ionicPopover, $filter) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				unloaded: unloadedCallback
			});

			// init popover
			$ionicPopover.fromTemplateUrl('mod-clientList-popover.html', {
				scope: $scope
			}).then(function(popover) {
				$scope.popover = popover;
			});

			$scope.data = {
				local: {
					images: {
						clientList_device_normal: tpService.modService.getModImgUrl('clientList_device_normal.png'),
						clientList_device_connected: tpService.modService.getModImgUrl('clientList_device_connected.png')
					},
					enable: false,
					allowList: [],
					connDevices: [],
					isWhiteListDevice: true,
					deviceState: [{
						type: 0,
						name: 'CLIENT_LIST-WHITE_LIST.CONTENT.ONLINE'
					}, {
						type: 1,
						name: 'CLIENT_LIST-WHITE_LIST.CONTENT.OFFLINE'
					}],
					myDevice: clientListValue.myDevice
				},
				server: {
					macFilters: {},
					connectedDevices: {}
				}
			}

			$scope.action = {
				enable: function() {
					$scope.data.server.macFilters.enable = $scope.data.local.enable;
					removeDeviceState($scope.data.server.macFilters.allowList);
					if ($scope.data.local.enable) {
						tpService.promptService.popup.confirm('CLIENT_LIST-WHITE_LIST.CONTENT.ENABLE_CONFIRM', 'CLIENT_LIST-WHITE_LIST.CONTENT.WHITE_LIST_MODE', function(isOK) {
							if (!isOK) {
								$scope.data.local.enable = !$scope.data.local.enable;
								return;
							}

							// When turnning on the switch, check if my device is in white list, if not, add it to white list
							var isAdded = false, i;
							for (i = 0; i < $scope.data.server.macFilters.allowList.length; i++) {
								if ($scope.data.server.macFilters.allowList[i].mac.toUpperCase() === clientListValue.myDevice.mac.toUpperCase()) {
									isAdded = true;
									break;
								}
							}
							if (!isAdded) {
								var myDevice = {
									mac: clientListValue.myDevice.mac.toUpperCase(),
									description: clientListValue.myDevice.name
								};
								$scope.data.server.macFilters.allowList.push(myDevice);
							}
							clientListService.saveData($scope.data.server.macFilters, updateView.whiteList);
						});
					} else {
						clientListService.saveData($scope.data.server.macFilters, updateView.whiteList);
					}
				},
				addDevice: function(arg) {
					if ($scope.data.server.macFilters.allowList.length >= 10) {
						tpService.promptService.toast.error('CLIENT_LIST-WHITE_LIST.CONTENT.TOP_NUMBER_ERROR');
						return;
					}
					$scope.popover.show(arg);
				},
				deleteDevice: function(whiteListDevice) {
					if (whiteListDevice.mac.toUpperCase() === clientListValue.myDevice.mac.toUpperCase()) {
						tpService.promptService.popup.confirm('CLIENT_LIST-WHITE_LIST.CONTENT.DELETE_MY_DEVICE_CONFIRM', 'COMMON.CONTENT.DELETE', function(isOK) {
							if (!isOK) {
								return;
							}
							removeDeviceState($scope.data.server.macFilters.allowList);
							if ($scope.data.local.allowList.indexOf(whiteListDevice) !== -1) {
								$scope.data.server.macFilters.allowList.splice($scope.data.local.allowList.indexOf(whiteListDevice), 1);
								clientListService.saveData($scope.data.server.macFilters, updateView.whiteList);
							}
						});
					} else {
						tpService.promptService.popup.confirm('CLIENT_LIST-WHITE_LIST.CONTENT.DELETE_CONFIRM', 'COMMON.CONTENT.DELETE', function(isOK) {
							if (!isOK) {
								return;
							}
							removeDeviceState($scope.data.server.macFilters.allowList);
							if ($scope.data.local.allowList.indexOf(whiteListDevice) !== -1) {
								$scope.data.server.macFilters.allowList.splice($scope.data.local.allowList.indexOf(whiteListDevice), 1);
								clientListService.saveData($scope.data.server.macFilters, updateView.whiteList);
							}
						});
					}

				},
				gotoAddDevice: function() {
					$scope.popover.hide();
					tpService.linkService.gotoMod('clientList-addDevice');
				},
				gotoListDevice: function() {
					$scope.popover.hide();
					tpService.linkService.gotoMod('clientList-listDevice');
				}
			}

			var updateView = {
				whiteList: function() {
					$scope.data.server.macFilters = clientListValue.macFilters;
					$scope.data.server.connectedDevices.STAs = clientListValue.connectedDevices.STAs;
					if ($scope.data.server.macFilters.allowList === undefined) {
						$scope.data.server.macFilters.allowList = [];
					}
					$scope.data.local.enable = $scope.data.server.macFilters.enable;
					// In case set device's online/offline flag to local list will influence the server list value, so don't use '=' to copy
					angular.copy($scope.data.server.macFilters.allowList, $scope.data.local.allowList);
					angular.copy($scope.data.server.connectedDevices.STAs.list, $scope.data.local.connDevices);

					// Set device's online/offline flag
					for (var i = 0; i < $scope.data.local.allowList.length; i++) {
						$scope.data.local.allowList[i].deviceState = $scope.data.local.deviceState[1];
						// My device is always online
						if (clientListValue.myDevice.mac.toUpperCase() === $scope.data.local.allowList[i].mac.toUpperCase()) {
							$scope.data.local.allowList[i].deviceState = $scope.data.local.deviceState[0];
						}
						for (var j = 0; j < $scope.data.local.connDevices.length; j++) {
							if ($scope.data.local.allowList[i].mac.toUpperCase() === $scope.data.local.connDevices[j].mac.toUpperCase()) {
								$scope.data.local.allowList[i].deviceState = $scope.data.local.deviceState[0];
								break;
							}
						}
					}
				}
			}

			function enterCallback() {
				updateView.whiteList();
			}

			function unloadedCallback() {
				if ($scope.popover) {
					$scope.popover.remove();
				}
			}

			function removeDeviceState(allowList) {
				for (var i = 0; i < allowList.length; i++) {
					if (allowList[i].deviceState) {
						delete allowList[i].deviceState;
					}
				}
				return allowList;
			}
		}
	])

	// Rename device, not in use for now, keep it here in case that will be used in the future
	.controller('clientListRenameDeviceCtrl', ['clientListConstant', 'clientListValue', 'clientListService', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$stateParams',
		function(clientListConstant, clientListValue, clientListService, tpService, tpUtil, tpProtocol, $scope, $stateParams) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					renameDevice: {
						description: '',
						index: 0
					}
				},
				server: {
					macFilters: {}
				}
			}

			$scope.action = {
				rename: function() {
					tpService.promptService.popup.prompt(
						'CLIENT_LIST-RENAME_DEVICE.CONTENT.RENAME',
						'CLIENT_LIST-RENAME_DEVICE.CONTENT.RENAME',
						saveNewName,
						'text',
						'CLIENT_LIST-RENAME_DEVICE.CONTENT.ENTER_NEW_NAME'
					);
				},
				saveCallback: function(data) {
					tpService.linkService.goBack();
					if (!data || data.result !== 0) {
						tpService.promptService.toast.error('CLIENT_LIST-RENAME_DEVICE.CONTENT.RENAME_FAILED');
						return;
					}
				}
			}

			var updateView = {
				renameDevice: function() {
					$scope.data.local.renameDevice = $stateParams.connDevice.whiteListDevice;
					$scope.data.local.renameDevice.index = $stateParams.connDevice.index;
				}
			}

			function saveNewName(input) {
				if (!input) {
					return;
				}
				if (input === $scope.data.local.renameDevice.description) {
					tpService.promptService.toast.info('CLIENT_LIST-RENAME_DEVICE.CONTENT.NO_CHANGE');
					tpService.linkService.goBack();
					return;
				}
				$scope.data.server.macFilters = clientListValue.macFilters;
				$scope.data.server.macFilters.allowList[$scope.data.local.renameDevice.index] = {
					description: input,
					mac: $scope.data.local.renameDevice.mac
				}
				clientListService.saveData($scope.data.server.macFilters, $scope.action.saveCallback);
			}

			function enterCallback() {
				updateView.renameDevice();
			}
		}
	])

	// Add connected devices to white list from local storage
	.controller('clientListListDeviceCtrl', ['clientListConstant', 'clientListValue', 'clientListService', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$ionicPopover',
		function(clientListConstant, clientListValue, clientListService, tpService, tpUtil, tpProtocol, $scope, $ionicPopover) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					images: {
						clientList_device_normal: tpService.modService.getModImgUrl('clientList_device_normal.png')
					},
					connDevices: [],
					allowList: []
				},
				server: {
					connectedDevices: [],
					macFilters: []
				},
				backup: {
					connDevices: []
				}
			}

			$scope.action = {
				addDevice: function(connDevice) { // Use "add" button to add one device every single time, this way is in use for now
					var addDeviceInfo = {
						description: connDevice.name,
						mac: connDevice.mac.toUpperCase()
					};
					$scope.data.server.macFilters.allowList.push(addDeviceInfo);
					if ($scope.data.server.macFilters.allowList.length > 10) {
						tpService.promptService.toast.error('CLIENT_LIST-WHITE_LIST.CONTENT.TOP_NUMBER_ERROR');
						return;
					}
					clientListService.saveData($scope.data.server.macFilters, saveCallback);
				},
				addDevices: function() { // Use "save" to add or remove devices, not in use for now
					var i, j, flag, addDeviceInfo = {};
					for (i = 0; i < $scope.data.local.connDevices.length; i++) {
						flag = true;
						for (j = 0; j < $scope.data.local.allowList.length; j++) {
							if ($scope.data.local.connDevices[i].mac.toUpperCase() === $scope.data.local.allowList[j].mac.toUpperCase()) {
								if (!$scope.data.local.connDevices[i].isAdded) {
									$scope.data.server.macFilters.allowList.splice(j, 1);
								}
								flag = false;
							}
						}
						if (flag && $scope.data.local.connDevices[i].isAdded) {
							addDeviceInfo = {
								mac: $scope.data.local.connDevices[i].mac.toUpperCase(),
								description: $scope.data.local.connDevices[i].name
							}
							$scope.data.server.macFilters.allowList.push(addDeviceInfo);
						}
					}
					if ($scope.data.server.macFilters.allowList.length > 10) {
						tpService.promptService.toast.error('CLIENT_LIST-WHITE_LIST.CONTENT.TOP_NUMBER_ERROR');
						return;
					}
					removeAddedFlag($scope.data.server.macFilters.allowList);
					clientListService.saveData($scope.data.server.macFilters);
				}
			}

			var updateView = {
				listDevice: function() {
					$scope.data.server.connectedDevices = tpService.localDataService.getDevice('clientList.connDeviceList');
					if ($scope.data.server.connectedDevices === undefined || $scope.data.server.connectedDevices.length === 0) {
						$scope.data.server.connectedDevices = [];
					}
					$scope.data.server.macFilters = clientListValue.macFilters;
					$scope.data.local.connDevices = $scope.data.server.connectedDevices;
					$scope.data.local.allowList = $scope.data.server.macFilters.allowList;

					// See the device is already in the white list or not and set 'isAdded' flag
					for (var i = 0; i < $scope.data.local.connDevices.length; i++) {
						$scope.data.local.connDevices[i].isAdded = false;
						for (var j = 0; j < $scope.data.local.allowList.length; j++) {
							if ($scope.data.local.connDevices[i].mac.toUpperCase() === $scope.data.local.allowList[j].mac.toUpperCase()) {
								$scope.data.local.connDevices[i].isAdded = true;
								break;
							}
						}
					}
					angular.copy($scope.data.local.connDevices, $scope.data.backup.connDevices);
				}
			}

			function enterCallback() {
				updateView.listDevice();
			}

			function saveCallback(data) {
				if (!data || data.result !== 0) {
					return;
				}
				updateView.listDevice();
			}

			function removeAddedFlag(connDevices) {
				for (var i = 0; i < connDevices.length; i++) {
					if (connDevices[i].isAdded !== undefined) {
						delete connDevices[i].isAdded;
					}
				}
				return connDevices;
			}
		}
	])

	// Add device to white list manually
	.controller('clientListAddDeviceCtrl', ['clientListConstant', 'clientListValue', 'clientListService', 'tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(clientListConstant, clientListValue, clientListService, tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					addDeviceInfo: {
						description: '',
						mac: ''
					}
				},
				server: {
					macFilters: {}
				}
			}

			$scope.action = {
				submit: function() {
					$scope.data.server.macFilters = clientListValue.macFilters;
					if (!$scope.data.local.addDeviceInfo.mac) {
						return;
					}
					for (var i = 0, l = $scope.data.server.macFilters.allowList.length; i < l; i++) {
						if ($scope.data.server.macFilters.allowList[i].mac.toUpperCase() === $scope.data.local.addDeviceInfo.mac.toUpperCase().replace(/-/g, ':')) {
							tpService.promptService.toast.warning('CLIENT_LIST-ADD_DEVICE.CONTENT.MAC_EXIST_ERROR');
							$scope.data.local.addDeviceInfo.mac = '';
							return;
						}
					}
					$scope.data.local.addDeviceInfo.mac = $scope.data.local.addDeviceInfo.mac.toUpperCase().replace(/-/g, ':');
					$scope.data.server.macFilters.allowList.push($scope.data.local.addDeviceInfo);
					clientListService.saveData($scope.data.server.macFilters, $scope.action.saveCallback);
				},
				saveCallback: function(data) {
					tpService.linkService.goBack();
					if (!data || data.result !== 0) {
						tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
						return;
					}
				}
			}
		}
	])

})();
