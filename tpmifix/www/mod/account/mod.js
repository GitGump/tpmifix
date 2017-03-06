(function() {
	'use strict';

	/**
	 * @description
	 * Account is module to control MiFi's login account.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.account
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.account', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('account', {
					url: '/account',
					templateUrl: 'mod/account/mod.html',
					controller: 'accountCtrl as account'
				})
		}
	])

	.controller('accountCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope);

			$scope.data = {
				local: {
					language: tpService.languageService.getLanguage() || 'en',
					oldPassword: '',
					password: '',
					STRENGTH: {
						STRONG: 3,
						MIDDLE: 2,
						WEAK: 1
					},
					passwordStrength: 0,
					oldIconColor: '',
					iconColor: '',
					oldInputType: 'password', // 'password' or 'text'
					inputType: 'password' // 'password' or 'text'
				},
				server: {},
				backup: {}
			};

			$scope.action = {
				checkLoginPasswordStrength: function() {
					$scope.data.local.passwordStrength = tpUtil.checkUtil.loginPassword.strength($scope.data.local.password);
				},
				switchOldInputType: function() {
					if ($scope.data.local.oldInputType === 'password') {
						$scope.data.local.oldIconColor = 'positive';
						$scope.data.local.oldInputType = 'text';
					} else {
						$scope.data.local.oldIconColor = '';
						$scope.data.local.oldInputType = 'password';
					}
				},
				switchInputType: function() {
					if ($scope.data.local.inputType === 'password') {
						$scope.data.local.iconColor = 'positive';
						$scope.data.local.inputType = 'text';
					} else {
						$scope.data.local.iconColor = '';
						$scope.data.local.inputType = 'password';
					}
				},
				submit: function() {
					if (!$scope.data.local.oldPassword) {
						tpService.promptService.toast.error('ACCOUNT.CONTENT.REQUIRE_OLD_PASSWORD');
					} else if (!tpUtil.checkUtil.loginPassword.valid($scope.data.local.password)) {
						tpService.promptService.toast.error('ACCOUNT.CONTENT.INVALID_PASSWORD');
					} else {
						tpService.promptService.loading.show('COMMON.CONTENT.SAVING');
						tpService.authService.updatePassword($scope.data.local.oldPassword, $scope.data.local.password, function(data, isUpdateSuccess) {
							tpService.promptService.loading.hide();
							if (isUpdateSuccess) {
								tpService.promptService.toast.success('ACCOUNT.CONTENT.MODIFY_OK');
								tpService.localDataService.setDevice('login.password', $scope.data.local.password);
								// If set password success, back to the front page.
								tpService.linkService.goBack();
								return;
							} else {
								if (data && data.result === 1) {
									tpService.promptService.toast.error('ACCOUNT.CONTENT.INCORRECT_OLD_PASSWORD');
								} else {
									tpService.promptService.toast.error('ACCOUNT.CONTENT.MODIFY_FAIL');
								}
							}
						});
					}
				}
			};
		}
	])

})();
