(function() {
	'use strict';

	/**
	 * @description
	 * Test is test module to test Router, i18n and other features of tpmifix,
	 * and it is NOT a DEMO! so just have a look at it, but don't depend on it.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.test
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.test', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('test', {
					url: '/test',
					templateUrl: 'mod/test/mod.html',
					controller: 'testCtrl'
				})
				// Now, test has its own child mod named as 'test-detail'.
				// NOTICE: Use '-' instead of '.' for `state` name, or won't work (is a bug?)
				.state('test-detail', {
					url: '/test-detail',
					params: {
						say: undefined
					},
					templateUrl: 'mod-test-detail.html',
					controller: 'testDetailCtrl'
				})
				.state('test-template', {
					url: '/test-template',
					templateUrl: 'mod/test/template/test.html',
					controller: 'testTemplateCtrl'
				})
				.state('test-ftp', {
					url: '/test-ftp',
					templateUrl: 'mod-test-ftp.html',
					controller: 'testFtpCtrl'
				})
		}
	])

	.factory('testUtil', ['tpUtil', 'tpService',
		function(tpUtil, tpService) {

			var enterCallback = function() {
				tpService.linkService.preventAutoJumpWhenError();
			}

			var beforeLeaveCallback = function() {
				tpService.linkService.allowAutoJumpWhenError();
			}

			return {
				enterCallback: enterCallback,
				beforeLeaveCallback: beforeLeaveCallback
			}
		}
	])

	.controller('testCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', 'homeValue', 'testUtil', '$ionicModal', '$sce', '$timeout',
		function(tpService, tpUtil, tpProtocol, $scope, homeValue, testUtil, $ionicModal, $sce, $timeout) {
			tpService.modService.initMod($scope, {
				enter: testUtil.enterCallback,
				beforeLeave: testUtil.beforeLeaveCallback,
				unloaded: unloadedCallback
			}, true);

			//tpService.logService.log(homeValue.stopStatusPolling);
			//homeValue.stopStatusPolling = !homeValue.stopStatusPolling;
			//tpService.logService.log(homeValue.stopStatusPolling);

			// NOTICE: $scope variable must be object, not primitive (e.g., number, string, boolean).
			//         So child $scope can inherit it, not copy it!
			$scope.data = {
				appVerOri: '',
				appVerTest: '0.0.1',
				isCurrentVersion: true,
				list: [{
					name: "First video from test mod (mp4)",
					sources: [{
						src: $sce.trustAsResourceUrl("mod/test/assets/videos/mp4-10MB-720P.mp4"),
						type: "video/mp4"
					}, ]
				}, {
					name: "First audio from test mod (mp3)",
					sources: [{
						src: $sce.trustAsResourceUrl("mod/test/assets/audios/sunshine-girl.mp3"),
						type: "audio/mp3"
					}, ]
				}, {
					name: "Second video from test mod (mov)",
					sources: [{
						src: $sce.trustAsResourceUrl("mod/test/assets/videos/mov-8MB-480P.mov"),
						type: "video/mp4"
					}, ]
				}]
			};

			$scope.data.appVerOri = tpService.dataSharingService.get("test.appVerOri");
			if (!$scope.data.appVerOri) {
				$scope.data.appVerOri = tpProtocol.protocolConstant.APP.VER;
			}

			$scope.action = {
				changeLanguage: function() {
					if (tpService.languageService.getCurrentLanguage() == 'en') {
						// Enforce to set 'zh' at runtime, which will affect all other pages from now on
						tpService.languageService.changeLanguage('zh');
					} else {
						tpService.languageService.changeLanguage('en');
					}
				},
				changeVersion: function() {
					tpService.dataSharingService.set("test.appVerOri", $scope.data.appVerOri);
					tpProtocol.protocolConstant.APP.VER = $scope.data.appVerTest;
				},
				recoverVersion: function() {
					var appVerOri = tpService.dataSharingService.get("test.appVerOri");
					if (!appVerOri) {
						return;
					}
					$scope.data.appVerOri = appVerOri;
					tpProtocol.protocolConstant.APP.VER = $scope.data.appVerOri;
				},
				testLoading: function() {
					tpService.promptService.loadingBar.start();
					tpService.promptService.loading.show({
						message: '10s后被下一个loading替换。如果loading显示closeIcon，你也可以点击关闭此loading，但这并不会影响后续的loading继续弹出。' +
							'另外，当代码主动执行loading.hide时，并非立即执行，而是设定了短暂的延时，具体时间请查看jsdoc或源码。',
						callback: function() {
							tpService.logService.log("loading hide");
						}
					});
					$timeout(function() {
						tpService.promptService.loadingBar.set(0.5);
						tpService.promptService.loading.show();
						$timeout(function() {
							tpService.promptService.loadingBar.complete();
							tpService.promptService.loading.hide();
						}, 2500);
					}, 10000);
				}
			}

			$ionicModal.fromTemplateUrl('mod-test-modal.html', {
				scope: $scope, // modal has the same $scope from this controller.
				animation: 'slide-in-up'
			}).then(function(modal) {
				$scope.modal = modal; // bind this modal to $scope.
			});
			// Some action api capsulation, you can also use $scope.modal.xxx directly.
			$scope.openModal = function() {
				$scope.modal.show();
				if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
					// Refer to: http://localhost:4000/docs/api/page/keyboard/
					// If the content of your app (including the header) is being pushed up and
					// out of view on input focus, try setting cordova.plugins.Keyboard.disableScroll(true).
					// This does not disable scrolling in the Ionic scroll view, rather it
					// disables the native overflow scrolling that happens automatically as a
					// result of focusing on inputs below the keyboard.
					cordova.plugins.Keyboard.disableScroll(true);
				}
			};
			$scope.closeModal = function() {
				$scope.modal.hide();
				if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
					cordova.plugins.Keyboard.disableScroll(false);
				}
			};

			// Execute action on hide modal
			$scope.$on('modal.hidden', function() {
				// Execute action
			});
			// Execute action on remove modal
			$scope.$on('modal.removed', function() {
				// Execute action
			});

			function unloadedCallback() {
				// Cleanup the modal when we're done with it!
				if ($scope.modal) {
					$scope.modal.remove();
				}
			}
		}
	])

	.controller('testDetailCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', 'testUtil',
		function(tpService, tpUtil, tpProtocol, $scope, testUtil) {
			tpService.modService.initMod($scope, {
				enter: testUtil.enterCallback,
				beforeLeave: testUtil.beforeLeaveCallback
			}, true);

			// NOTICE: $scope variable must be object, not primitive (e.g., number, string, boolean).
			//         So child $scope can inherit it, not copy it!
			// NOTICE: Here $scope is the brother of $scope in `testCtrl`, not child!
			//         You can refer to mod.html for their relationship.
			$scope.data = {
				say: tpService.linkService.getModParams().say,
				input: ''
			};

			tpService.logService.log("Parent tell me: " + $scope.data.say);

			$scope.action = {
				submit: function() {
					tpService.logService.log($scope.data.input);
					alert("Got the input: " + $scope.data.input);
				}
			}
		}
	])

	.controller('testTemplateCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', 'testUtil',
		function(tpService, tpUtil, tpProtocol, $scope, testUtil) {
			tpService.modService.initMod($scope, {
				enter: testUtil.enterCallback,
				beforeLeave: testUtil.beforeLeaveCallback
			}, true);
		}
	])

	.controller('testFtpCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', 'testUtil', '$ionicPlatform', '$window',
		function(tpService, tpUtil, tpProtocol, $scope, testUtil, $ionicPlatform, $window) {
			tpService.modService.initMod($scope, {
				enter: testUtil.enterCallback,
				beforeLeave: testUtil.beforeLeaveCallback
			}, true);

			$scope.data = {
				ftp: {
					ADDRESS: '192.168.1.1',
					USERNAME: 'anonymous',
					PASSWORD: 'anonymous@',
					HOME_PATH: '/sdcard/'
				},
				remote: {
					PATH: '/sdcard/testFtpDir/'
				},
				local: {
					FILE: '/mnt/sdcard/test.mp4'
				}
			};

			$scope.action = {
				testFtp: function() {
					var loglog = '';
					tpService.promptService.loading.show(loglog += 'Test Ftp plugin: start...', undefined, true);
					var FTP = {
						ADDRESS: $scope.data.ftp.ADDRESS,
						USERNAME: $scope.data.ftp.USERNAME,
						PASSWORD: $scope.data.ftp.PASSWORD,
						HOME_PATH: $scope.data.ftp.HOME_PATH
					};
					var localFile = $scope.data.local.FILE;
					var localFile1 = localFile + '.1';
					var remotePath = $scope.data.remote.PATH;
					if (remotePath.substr(-1) != '/') {
						remotePath += '/';
					}
					var remoteFile = remotePath + localFile.substr(localFile.lastIndexOf('/') + 1);
					tpService.logService.debug("xtest: remotePath is " + remotePath);
					tpService.logService.debug("xtest: remoteFile is " + remoteFile);
					tpService.logService.debug("xtest: localFile is " + localFile);
					tpService.logService.debug("xtest: localFile1 is " + localFile1);
					// Test code (for angularjs|ionic|cordova)
					// Tip: Usually init/create $window.cordova.plugin.ftp will take some time.
					//      We should listen `deviceready` event for cordova, or `$ionicPlatform.ready()` for ionic.
					//      You can find more info in official docs of cordova or ionic.
					$ionicPlatform.ready(function() {
						if ($window.cordova && $window.cordova.plugin && $window.cordova.plugin.ftp) {
							tpService.logService.info("xtest: ftp: plugin ready");
							tpService.promptService.loading.show(loglog += '\n' + 'plugin ready.', undefined, true);
							// 1. connect to one ftp server, then you can do any actions/cmds
							tpService.promptService.loading.show(loglog += '\n' + 'test connect...', undefined, true);
							$window.cordova.plugin.ftp.connect(FTP.ADDRESS, FTP.USERNAME, FTP.PASSWORD, function() {
								tpService.logService.info("xtest: ftp: connect ok");
								tpService.promptService.loading.show(loglog += '\n' + 'connect ok.', undefined, true);
								// 2. list one dir, note that just can be dir, not file
								tpService.promptService.loading.show(loglog += '\n' + 'test list...', undefined, true);
								$window.cordova.plugin.ftp.ls(FTP.HOME_PATH, function(fileList) {
									tpService.logService.info("xtest: ftp: list ok");
									tpService.promptService.loading.show(loglog += '\n' + 'list ok.', undefined, true);
									if (fileList && fileList.length > 0) {
										tpService.logService.debug("xtest: ftp: The last file'name is " + fileList[fileList.length - 1].name);
										tpService.logService.debug("xtest: ftp: The last file'type is " + fileList[fileList.length - 1].type);
										tpService.logService.debug("xtest: ftp: The last file'link is " + fileList[fileList.length - 1].link);
										tpService.logService.debug("xtest: ftp: The last file'size is " + fileList[fileList.length - 1].size);
										tpService.logService.debug("xtest: ftp: The last file'modifiedDate is " + fileList[fileList.length - 1].modifiedDate);
										// 3. create one dir on ftp server
										tpService.promptService.loading.show(loglog += '\n' + 'test mkdir...', undefined, true);
										$window.cordova.plugin.ftp.mkdir(remotePath, function(ok) {
											tpService.logService.info("xtest: ftp: mkdir ok=" + ok);
											tpService.promptService.loading.show(loglog += '\n' + 'mkdir ok.', undefined, true);
											// 4. upload localFile to remote (you can rename at the same time). arg1: localFile, arg2: remoteFile.
											// - make sure you can ACCESS and READ the localFile.
											// - (for iOS) if localFile not exists, a blank remoteFile will be created on ftp server.
											// - if a same named remoteFile exists on ftp server, it will be overrided!
											tpService.promptService.loading.show(loglog += '\n' + 'test upload...', undefined, true);
											tpService.promptService.loadingBar.start();
											$window.cordova.plugin.ftp.upload(localFile, remoteFile, function(percent) {
												if (percent == 1) {
													tpService.logService.info("xtest: ftp: upload finish");
													tpService.promptService.loadingBar.complete();
													tpService.promptService.loading.show(loglog += '\n' + 'upload finish.', undefined, true);
													// 4a. cancel download after some time
													//$timeout(function() {
													//$window.cordova.plugin.ftp.cancel(function(ok) {
													//tpService.logService.info("xtest: ftp: cancel ok=" + ok);
													//}, function(error) {
													//tpService.logService.error("xtest: ftp: cancel error=" + error);
													//});
													//}, 2000);
													// 5. download remoteFile to local (you can rename at the same time). arg1: localFile, arg2: remoteFile.
													// - make sure you can ACCESS and WRITE the local dir.
													// - if one same named localFile exists, it will be overrided!
													tpService.promptService.loading.show(loglog += '\n' + 'test download...', undefined, true);
													tpService.promptService.loadingBar.start();
													$window.cordova.plugin.ftp.download(localFile1, remoteFile, function(percent) {
														if (percent == 1) {
															tpService.logService.info("xtest: ftp: download finish");
															tpService.promptService.loadingBar.complete();
															tpService.promptService.loading.show(loglog += '\n' + 'download finish.', undefined, true);
															// 6. delete one file on ftp server
															tpService.promptService.loading.show(loglog += '\n' + 'test rm...', undefined, true);
															$window.cordova.plugin.ftp.rm(remoteFile, function(ok) {
																tpService.logService.info("xtest: ftp: rm ok=" + ok);
																tpService.promptService.loading.show(loglog += '\n' + 'rm ok.', undefined, true);
																// 7. delete one dir on ftp server, fail if it's not an empty dir
																tpService.promptService.loading.show(loglog += '\n' + 'test rmdir...', undefined, true);
																$window.cordova.plugin.ftp.rmdir(remotePath, function(ok) {
																	tpService.logService.info("xtest: ftp: rmdir ok=" + ok);
																	tpService.promptService.loading.show(loglog += '\n' + 'rmdir ok.', undefined, true);
																	tpService.promptService.loading.show(loglog += '\n' + 'all test pass.', undefined, true);
																}, function(error) {
																	tpService.logService.error("xtest: ftp: rmdir error=" + error);
																	tpService.promptService.loading.show(loglog += '\n' + 'rmdir error=' + error, undefined, true);
																});
															}, function(error) {
																tpService.logService.error("xtest: ftp: rm error=" + error);
																tpService.promptService.loadingBar.complete();
																tpService.promptService.loading.show(loglog += '\n' + 'rm error=' + error, undefined, true);
															});
														} else {
															tpService.logService.debug("xtest: ftp: download percent=" + percent * 100 + "%");
															tpService.promptService.loadingBar.set(percent);
														}
													}, function(error) {
														tpService.logService.error("xtest: ftp: download error=" + error);
														tpService.promptService.loadingBar.complete();
														tpService.promptService.loading.show(loglog += '\n' + 'download error=' + error, undefined, true);
													});
												} else {
													tpService.logService.debug("xtest: ftp: upload percent=" + percent * 100 + "%");
													tpService.promptService.loadingBar.set(percent);
												}
											}, function(error) {
												tpService.logService.error("xtest: ftp: upload error=" + error);
												tpService.promptService.loading.show(loglog += '\n' + 'upload error=' + error, undefined, true);
											});
										}, function(error) {
											tpService.logService.error("xtest: ftp: mkdir error=" + error);
											tpService.promptService.loading.show(loglog += '\n' + 'mkdir error=' + error, undefined, true);
										});
									}
								}, function(error) {
									tpService.logService.error("xtest: ftp: list error=" + error);
									tpService.promptService.loading.show(loglog += '\n' + 'list error=' + error, undefined, true);
								});
							});
						} else {
							tpService.logService.error("xtest: ftp: plugin not found!");
							tpService.promptService.loading.show(loglog += '\n' + 'plugin not found!', undefined, true);
						}
					});
				}
			}
		}
	])

})();
