(function() {
	'use strict';

	/**
	 * @description
	 * Tools is module to reboot/poweroff/restore MiFi.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.tools
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.tools', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('tools', {
					url: '/tools',
					templateUrl: 'mod/tools/mod.html',
					controller: 'toolsCtrl'
				})
		}
	])

	.controller('toolsCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				moduleName: {
					REBOOT: "reboot",
					RESTORE: "restoreDefaults"
				},
				ACTION: {
					REBOOT: 0,
					POWEROFF: 1,
					RESTORE: 0
				}
			}

			$scope.action = {
				reboot: function() {
					tpService.promptService.popup.confirm('TOOLS.CONTENT.REBOOT_CONFIRM', 'TOOLS.CONTENT.REBOOT', function(isOK) {
						if (!isOK) {
							return;
						} else {
							tpService.promptService.loading.show('TOOLS.CONTENT.REBOOT_LOADING');
							tpService.serverDataService.request({
								module: $scope.data.moduleName.REBOOT,
								action: $scope.data.ACTION.REBOOT,
								callback: function(data) {
									tpService.promptService.loading.hide();
									if (!data || data.result !== 0) {
										tpService.promptService.toast.error('TOOLS.CONTENT.REBOOT_FAIL');
									} else {
										// logout() will crash, use clear() instead.
										// tpService.authService.logout();
										tpService.authInfoService.clear();
										tpService.authInfoService.markLogin(false);
										tpService.linkService.goBackHome();
										// tpService.promptService.toast.success('TOOLS.CONTENT.REBOOT_SUCC');
									}
								}
							});
						}
					});
				},

				poweroff: function() {
					tpService.promptService.popup.confirm('TOOLS.CONTENT.POWEROFF_CONFIRM', 'TOOLS.CONTENT.POWEROFF', function(isOK) {
						if (!isOK) {
							return;
						} else {
							tpService.promptService.loading.show('TOOLS.CONTENT.POWEROFF_LOADING');
							tpService.serverDataService.request({
								module: $scope.data.moduleName.REBOOT,
								action: $scope.data.ACTION.POWEROFF,
								callback: function(data) {
									tpService.promptService.loading.hide();
									if (!data || data.result !== 0) {
										tpService.promptService.toast.error('TOOLS.CONTENT.POWEROFF_FAIL');
									} else {
										// tpService.authService.logout();
										tpService.authInfoService.clear();
										tpService.authInfoService.markLogin(false);
										tpService.linkService.goBackHome();
										// tpService.promptService.toast.success('TOOLS.CONTENT.POWEROFF_SUCC');
									}
								}
							});
						}
					});
				},

				restore: function() {
					tpService.promptService.popup.confirm('TOOLS.CONTENT.RESTORE_CONFIRM', 'TOOLS.CONTENT.RESTORE', function(isOK) {
						if (!isOK) {
							return;
						} else {
							tpService.promptService.loading.show('TOOLS.CONTENT.RESTORE_LOADING');
							tpService.serverDataService.request({
								module: $scope.data.moduleName.RESTORE,
								action: $scope.data.ACTION.RESTORE,
								callback: function(data) {
									tpService.promptService.loading.hide();
									if (!data || data.result !== 0) {
										tpService.promptService.toast.error('TOOLS.CONTENT.RESTORE_FAIL');
										return;
									} else {
										// tpService.authService.logout();
										tpService.authInfoService.clear();
										tpService.authInfoService.markLogin(false);
										tpService.linkService.goBackHome();
										// tpService.promptService.toast.success('TOOLS.CONTENT.RESTORE_SUCC');
									}
								}
							});
						}
					});
				}
			};
		}
	])

})();
