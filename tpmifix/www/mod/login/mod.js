(function() {
	'use strict';

	/**
	 * @description
	 * Login is module to login MiFi device.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.login
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.login', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('login', {
					url: '/login',
					templateUrl: 'mod/login/mod.html',
					controller: 'loginCtrl as login'
				})
		}
	])

	.controller('loginCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope',
		function(tpService, tpUtil, tpProtocol, $scope) {
			tpService.modService.initMod($scope, {
				enter: enterCallback
			}, true);

			$scope.data = {
				local: {
					language: tpService.languageService.getLanguage() || 'en',
					STRENGTH: {
						STRONG: 3,
						MIDDLE: 2,
						WEAK: 1
					},
					passwordStrength: 0,
					iconColor: '',
					inputType: 'password', // 'password' or 'text'
					tryLoginFail: false,
					remainAttempts: 10,
					loginDisabledRemainTime: '',
					isFactory: tpService.dataSharingService.get('isFactory') || false,
					isLocked: tpService.dataSharingService.get('login.isLocked') || false
				},
				server: {}
			};
			//$scope.data.local.isFactory = true; // for TEST
			$scope.data.local.password = $scope.data.local.isFactory ? '' : tpService.localDataService.getDevice('login.password');

			$scope.action = {
				checkLoginPasswordStrength: function() {
					$scope.data.local.passwordStrength = tpUtil.checkUtil.loginPassword.strength($scope.data.local.password);
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
				forgetPassword: function() {
					tpService.promptService.popup.alert('LOGIN.CONTENT.FORGET_PASSWORD_PROMPT', 'LOGIN.CONTENT.FORGET_PASSWORD');
				},
				login: function() {
					tpService.promptService.loading.show();
					tpService.authService.login($scope.data.local.password, function(data, isLogin) {
						tpService.promptService.loading.hide();
						if (isLogin) {
							tpService.promptService.toast.success('LOGIN.CONTENT.LOGIN_OK');
							tpService.localDataService.setDevice('login.password', $scope.data.local.password);
							// If login success, back to the front page.
							tpService.linkService.goBack();
							return;
						} else {
							// if login fail, show toast
							if (data && data.result == 1) {
								// and use local remainAttempts-1,
								$scope.data.local.remainAttempts--;
								if ($scope.data.local.remainAttempts < 0) {
									$scope.data.local.remainAttempts = 0;
								}
							} else {
								tpService.promptService.toast.error('LOGIN.CONTENT.LOGIN_FAIL');
							}
							// then get the newest remainAttempts
							requestData();
							$scope.data.local.tryLoginFail = true;
						}
					});
				},
				setPassword: function() {
					tpService.promptService.loading.show('COMMON.CONTENT.SAVING');
					tpService.authService.factory.login(function() {
						tpService.authService.factory.setPassword($scope.data.local.password, function(data, isUpdateSuccess) {
							tpService.promptService.loading.hide();
							if (isUpdateSuccess) {
								tpService.promptService.toast.success('LOGIN.CONTENT.SET_PASSWORD_OK');
								$scope.data.local.isFactory = false;
								tpService.dataSharingService.set('isFactory', $scope.data.local.isFactory);
								tpService.localDataService.setDevice('login.password', $scope.data.local.password);
								// If set password success, back to the front page.
								tpService.linkService.goBack();
								return;
							} else {
								tpService.promptService.toast.error('LOGIN.CONTENT.SET_PASSWORD_FAIL');
							}
						});
					});
				}
			};

			var updateView = {
				attempt: function(data) {
					if (!data || data.result !== 0) {
						//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
						return;
					}

					$scope.data.server.attempt = data;
					$scope.data.local.remainAttempts = $scope.data.server.attempt.remainAttempts;
					if ($scope.data.server.attempt.remainAttempts > 0) {
						$scope.data.local.isLocked = false;
						tpService.localDataService.setDevice('login.isLocked', false);
					} else {
						$scope.data.local.isLocked = true;
						tpService.localDataService.setDevice('login.isLocked', true);
						var hour = tpUtil.dateTimeUtil.human.sec2hour($scope.data.server.attempt.loginDisabledRemainTime);
						var time = "";
						tpService.languageService.translate(['COMMON.CONTENT.DATE_TIME.HOUR', 'COMMON.CONTENT.DATE_TIME.MINUTE'], function(unit) {
							if (hour[0] > 0) {
								time = time + hour[0] + unit["COMMON.CONTENT.DATE_TIME.HOUR"];
							}
							if (hour[1] > 0) {
								time = time + hour[1] + unit["COMMON.CONTENT.DATE_TIME.MINUTE"];
							}
							// just like hour+minute, don't care second
							$scope.data.local.loginDisabledRemainTime = time;
						});
					}
				}
			}

			function enterCallback() {
				requestData();
			}

			function requestData() {
				// check attempts
				tpService.authService.checkAttempt(updateView.attempt);
			}
		}
	])

})();
