(function() {
	'use strict';

	/**
	 * @description
	 * Device is module to show MiFi's device name, IMEI, MAC address and software version.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.device
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.device', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('device', {
					url: '/device',
					templateUrl: 'mod/device/mod.html',
					controller: 'deviceCtrl'
				})
		}
	])

	.controller('deviceCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			$scope.data = {
				local: {
					MOD: {
						STATUS: 'status',
						UPDATE: 'update'
					},
					ACTION: {
						GET_CONFIG: 0,
						CHECK_NEW_VER: 1,
						START_DOWNLOAD: 2,
						PAUSE_DOWNLOAD: 3,
						REQ_DOWNLOAD_PERCENT: 4,
						REQ_UPLOAD_STATUS: 5,
						START_UPGRADE: 6,
						CLEAR_CACHE: 7
					},
					RESULT: {
						//CHECK_UPDATE RESULTS
						CHECK_OK: 0,
						CHECK_ERR: 1,
						CHECK_SERVER_ERR: 2,
						CHECK_NETWORK_ERR: 3,
						CHECK_CHECKING: 4,
						CHECK_NO_NEW: 5,
						CHECK_NEWEST: 6,
						//HAS NEW VERSION
						NO_NEW_VER: 0,
						HAS_NEW_VER: 1,
						//DOWNLOAD RESULTS
						DOWNLOAD_OK: 0,
						DOWNLOAD_NEWEST_VER: 1,
						DOWNLOAD_START_ERR: 2,
						//DOWNLOAD PERCENT RESULTS
						PERCENT_OK: 0,
						PERCENT_GET_ERR: 1,
						PERCENT_RSA_ERR: 2,
						PERCENT_COM_ERR: 3,
						//UPGRADE RESULTS
						UPGRADE_OK: 0
					},
					hardwareVer: '',
					firmwareVer: '',
					firmwareSize: '',
					latestVer: '',
					releaseNote: '',
					CHECK_INTERVAL: 500,
					downloadTimer: 0,
					downloadPercent: 0,
					downloadPercentStr: '',
					hasNewVer: false,
					isCMCU: false,
					downloadStartTime: 0,
					DOWNLOAD_TIMEOUT: 30 * 60 * 1000, // 30min
					UPGRADE_LOADING_DURATION: 20 * 1000, // 20s
					isDownloadPaused: false
				},
				server: {
					deviceInfo: {}
				}
			};

			$scope.action = {
				checkNewVer: function() {
					// If network disconnected, toast error
					if (tpService.dataSharingService.get('status').wan.connectStatus !== 4) {
						tpService.promptService.toast.error('DEVICE.CONTENT.NETWORK_DISCONNECT_ERROR');
						return;
					} else {
						if (!$scope.data.local.hasNewVer) {
							checkNewVerRequest();
						} else {
							tpService.languageService.translate(['UPDATE.TITLE', 'DEVICE.CONTENT.UPDATE_NOW', 'DEVICE.CONTENT.UPDATE_LATER'], function(string) {
								tpService.promptService.popup.confirmWithOptions({
									title: string['UPDATE.TITLE'],
									templateUrl: 'mod-device-updateDetail.html',
									okText: string['DEVICE.CONTENT.UPDATE_NOW'],
									cancelText: string['DEVICE.CONTENT.UPDATE_LATER'],
									scope: $scope
								}, function(isOK) {
									if (!isOK) {
										return;
									} else {
										checkUpgrade();
									}
								});
							});
						}
					}
				},

				pauseDownload: function() {
					clearTimeout($scope.data.local.downloadTimer);
					clearTimeout($scope.data.local.downloadStartTime);
					tpService.promptService.loading.hide();
					$scope.data.local.isDownloadPaused = true;
					tpService.serverDataService.request({
						module: $scope.data.local.MOD.UPDATE,
						action: $scope.data.local.ACTION.PAUSE_DOWNLOAD
					});
				}
			};

			var updateView = {
				deviceInfo: function(data) {
					//tpService.promptService.loading.hide();
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					$scope.data.server.deviceInfo = data.deviceInfo;
					var hardwareVer = $scope.data.server.deviceInfo.hardwareVer,
						firmwareVer = $scope.data.server.deviceInfo.firmwareVer;
					// TL-TR961 5200L v2.0 -> 2.0
					$scope.data.local.hardwareVer = hardwareVer.split('v')[1];
					// x.y.z Build 160318 Rel 100n -> x.y.z
					$scope.data.local.firmwareVer = firmwareVer.split(' ')[0];
					if ($scope.data.server.deviceInfo.productID === tpProtocol.protocolConstant.PRODUCT.TR961_2500L_CM_CU_V1.ID) {
						$scope.data.local.isCMCU = true;
					} else {
						$scope.data.local.isCMCU = false;
					}

					$scope.data.local.hasNewVer = tpService.localDataService.getDevice('hasNewFirmwareVer');
					if ($scope.data.local.hasNewVer === null) {
						// Clear cache or first use
						$scope.data.local.hasNewVer = false;
					} else if ($scope.data.local.hasNewVer) {
						// If has new version, get new version info
						checkNewVerRequest();
					}
				}
			}

			function enterCallback() {
				requestData();
			}

			function requestData() {
				//tpService.promptService.loading.show();
				// Get device info
				tpService.serverDataService.request({
					module: $scope.data.local.MOD.STATUS,
					action: $scope.data.local.ACTION.GET_CONFIG,
					callback: updateView.deviceInfo
				});
			}

			function checkNewVerRequest() {
				// Get update data
				tpService.serverDataService.request({
					module: $scope.data.local.MOD.UPDATE,
					action: $scope.data.local.ACTION.GET_CONFIG,
					callback: function(data) {
						if (!data || data.result !== 0) {
							//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
							return;
						}
						$scope.data.local.hasNewVer = data.hasNewVersion;
						if ($scope.data.local.hasNewVer) {
							$scope.data.local.hasNewVer = true;
							$scope.data.local.latestVer = data.latestVersion;
							$scope.data.local.firmwareSize = tpUtil.flowUtil.ByteToMB(data.firmwareSize) + 'MB';
							$scope.data.local.releaseNote = data.releaseNote.split('<br>');
						} else {
							$scope.data.local.hasNewVer = false;
							tpService.promptService.toast.info('DEVICE.CONTENT.NO_NEW_VERSION');
						}
						tpService.localDataService.setDevice('hasNewFirmwareVer', $scope.data.local.hasNewVer);
					}
				});
			}

			function checkUpgrade() {
				tpService.promptService.loading.show('DEVICE.CONTENT.UPGRADE_CHECKING');
				tpService.serverDataService.request({
					module: $scope.data.local.MOD.UPDATE,
					action: $scope.data.local.ACTION.START_DOWNLOAD,
					callback: function(data) {
						if (!data) {
							//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
							return;
						}

						switch (data.result) {
							case $scope.data.local.RESULT.DOWNLOAD_OK:
								startDownload();
								break;
							case $scope.data.local.RESULT.DOWNLOAD_NEWEST_VER:
								tpService.promptService.loading.hide();
								tpService.promptService.toast.info('DEVICE.CONTENT.DOWNLOAD_NEWEST_VER');
								break;
							//case $scope.data.local.RESULT.DOWNLOAD_START_ERR:
							default:
								tpService.promptService.loading.hide();
								tpService.promptService.toast.error('DEVICE.CONTENT.UPGRADE_FAIL');
								requestData();
								break;
						}
					}
				});
			}

			function startDownload() {
				$scope.data.local.downloadStartTime = (new Date()).getTime();
				$scope.data.local.isDownloadPaused = false;
				tpService.promptService.loading.show('DEVICE.CONTENT.UPGRADE_DOWNLOADING');
				tpService.serverDataService.request({
					module: $scope.data.local.MOD.UPDATE,
					action: $scope.data.local.ACTION.REQ_DOWNLOAD_PERCENT,
					timeout: tpService.serviceConstant.AJAX_TIMEOUT.LONG,
					callback: checkDownloadStatus
				});
			}

			function checkDownloadStatus(data) {
				clearTimeout($scope.data.local.downloadTimer);

				// click "Pause", don't show download percent
				if ($scope.data.local.isDownloadPaused) {
					return;
				}

				// Disconnected with MiFi or something unusual happens
				if (!data) {
					tpService.promptService.loading.hide();
					tpService.promptService.toast.error('DEVICE.CONTENT.CHECK_NETWORK_ERROR');
					return;
				}

				switch (data.result) {
					case $scope.data.local.RESULT.PERCENT_OK:
						showDownloadPercent(data);
						// If network disconnected, cancel download
						if (tpService.dataSharingService.get('status').wan.connectStatus !== 4) {
							tpService.promptService.loading.hide();
							tpService.promptService.toast.error('DEVICE.CONTENT.CHECK_NETWORK_ERROR');
							return;
						}
						// Downloading costs too long, fall through
						if ((new Date()).getTime() - $scope.data.local.downloadStartTime > $scope.data.local.DOWNLOAD_TIMEOUT) {
							tpService.promptService.loading.hide();
							tpService.promptService.toast.error('DEVICE.CONTENT.UPGRADE_DOWNLOAD_FAIL');
							return;
						}
						if (data.percentage < 100) {
							checkDownloadPercent();
							return;
						}
						startUpgrade();
						break;
					//case $scope.data.local.RESULT.PERCENT_GET_ERR:
					//case $scope.data.local.RESULT.PERCENT_RSA_ERR:
					//case $scope.data.local.RESULT.PERCENT_COM_ERR:
					default:
						tpService.promptService.loading.hide();
						tpService.promptService.toast.error('DEVICE.CONTENT.UPGRADE_DOWNLOAD_FAIL');
						requestData();
						break;
				}
			}

			function checkDownloadPercent() {
				$scope.data.local.downloadTimer = setTimeout(function() {
					tpService.serverDataService.request({
						module: $scope.data.local.MOD.UPDATE,
						action: $scope.data.local.ACTION.REQ_DOWNLOAD_PERCENT,
						timeout: tpService.serviceConstant.AJAX_TIMEOUT.LONG,
						callback: checkDownloadStatus
					});
				}, $scope.data.local.CHECK_INTERVAL);
			}

			function showDownloadPercent(data) {
				tpService.languageService.translate('DEVICE.CONTENT.UPGRADE_DOWNLOAD_PERCENT', function(string) {
					$scope.data.local.downloadPercent = data.percentage;
					$scope.data.local.downloadPercentStr = string + data.percentage + '%';
					tpService.promptService.loading.showWithOptions({
						templateUrl: 'mod-device-progress.html',
						duration: undefined,
						scope: $scope
					});
				});
			}

			function startUpgrade() {
				// Hold on loading until go back home
				tpService.promptService.loading.show('DEVICE.CONTENT.UPGRADE_LOADING', $scope.data.local.UPGRADE_LOADING_DURATION);
				tpService.serverDataService.request({
					module: $scope.data.local.MOD.UPDATE,
					action: $scope.data.local.ACTION.START_UPGRADE,
					callback: function(data) {
						if (data && data.result === $scope.data.local.RESULT.UPGRADE_OK) {
							// tpService.promptService.toast.success('DEVICE.CONTENT.UPGRADE_SUCC');
							$scope.data.local.hasNewVer = false;
							tpService.localDataService.setDevice('hasNewFirmwareVer', false);
						} else {
							tpService.promptService.loading.hide();
							tpService.promptService.toast.error('DEVICE.CONTENT.UPGRADE_FAIL');
							requestData();
						}
					}
				});
			}
		}
	])

})();
