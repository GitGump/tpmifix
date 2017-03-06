(function() {
	'use strict';

	/**
	 * @description
	 * SMS is the module that you can read and compose message.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.sms
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.sms', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider.state('sms', {
					url: '/sms',
					templateUrl: 'mod/sms/mod.html',
					controller: 'smsCtrl as sms'
				})
				.state('sms-compose', {
					url: '/sms-compose?smsFrom',
					templateUrl: 'mod-sms-compose.html',
					controller: 'smsComposeCtrl as smsCompose'
				})
				.state('sms-detail', {
					url: '/ms-compose?smsListIndex',
					templateUrl: 'mod-sms-detail.html',
					controller: 'smsDetailCtrl as smsDetail'
				});
		}
	])

	.value('smsShare', {
		amountPerPage: 8, // must <= 8 as backend bug
		list: []
	})

	.controller('smsCtrl', ['smsShare', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$ionicListDelegate',
		function(smsShare, tpService, tpUtil, tpProtocol, $scope, $ionicListDelegate) {
			var sms = this;

			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			});

			sms.data = {
				local: {
					list: [],
					simStatus: null,
					page: 1,
					canLoadMoreFlag: true,
					isEditing: false,
					selectedCount: 0,
					isAllSelected: false
				}
			};

			sms.action = {
				loadMore: function() {
					sms.data.local.canLoadMoreFlag = true;
					// Note: When user goto this mod, but not login (html will be loaded immediately, but js may be not at that time), he will be redirected to login page.
					// The `loadMore` in html DOM will be triggered, but will fail, and `enterCallback` will not triggered.
					// We should assign `page` number `+1`, so it seems `loadMore` is working rightly.
					// As `loadMore` may be triggered by framework more than once, so we must assign it with `2` instead of `++`.
					// Notice to broadcast `scroll.infiniteScrollComplete`, so we can trigger new `on-infinite`.
					if (!tpService.authInfoService.isLogin()) {
						sms.data.local.page = 2;
						$scope.$broadcast('scroll.infiniteScrollComplete');
						return;
					}
					//tpService.promptService.loading.show();
					requestData(smsShare.amountPerPage, sms.data.local.page, updateView.addSMS);
				},
				openEdit: function() {
					$ionicListDelegate.closeOptionButtons();
					// always do deselect all
					sms.action.cancelSelectAll();
					sms.data.local.isEditing = true;
					stopLoopGetNewSMS();
				},
				closeEdit: function() {
					$ionicListDelegate.closeOptionButtons();
					// always do deselect all
					sms.action.cancelSelectAll();
					sms.data.local.isEditing = false;
					startLoopGetNewSMS();
				},
				isAllSelected: function() {
					var list = sms.data.local.list;
					var isAllSelected = false;
					var j = 0;
					if (list.length) {
						for (var i in list) {
							var file = list[i];
							if (file.checked) {
								j++;
							}
						}
						if (j === list.length) {
							isAllSelected = true;
						} else {
							isAllSelected = false;
						}
					} else {
						isAllSelected = false;
					}
					sms.data.local.selectedCount = j;
					sms.data.local.isAllSelected = isAllSelected;
					return isAllSelected;
				},
				selectAll: function() {
					sms.data.local.list.forEach(function(element) {
						element.checked = true;
					});
					sms.data.local.isAllSelected = true;
					sms.data.local.selectedCount = sms.data.local.list.length;
				},
				cancelSelectAll: function() {
					sms.data.local.list.forEach(function(element) {
						element.checked = false;
					});
					sms.data.local.isAllSelected = false;
					sms.data.local.selectedCount = 0;
				},
				switchSelectAll: function() {
					if (sms.data.local.isAllSelected) {
						sms.action.cancelSelectAll();
					} else {
						sms.action.selectAll();
					}
				},
				delete: function(index) {
					$ionicListDelegate.closeOptionButtons();
					var files = [];
					var indexesAtServer = [];
					if (angular.isNumber(index)) {
						files.push({
							sms: sms.data.local.list[index],
							indexAtServer: sms.data.local.list[index].index,
							indexAtLocal: index
						});
						indexesAtServer.push(sms.data.local.list[index].index);
					} else {
						sms.data.local.list.forEach(function(file, index) {
							if (file.checked === true) {
								files.push({
									sms: file,
									indexAtServer: file.index,
									indexAtLocal: index
								});
								indexesAtServer.push(file.index);
							}
						});
					}
					if (files.length <= 0) {
						tpService.promptService.toast.warning('SMS.CONTENT.DELETE_NONE_WARN');
					} else {
						tpService.promptService.popup.confirm('COMMON.CONTENT.DELETE_PROMPT', 'COMMON.CONTENT.DELETE', function callback(isOK) {
							if (isOK) {
								tpService.promptService.loading.show();
								sms.action.closeEdit();
								// delete sms at server
								deleteSMS(indexesAtServer, function(data) {
									tpService.promptService.loading.hide();
									if (!data || data.result !== 0) {
										tpService.promptService.toast.error('COMMON.CONTENT.DELETE_FAIL');
										return;
									}
									// delete sms at local
									var i = 0;
									files.forEach(function(file) {
										sms.data.local.list.splice(file.indexAtLocal - i, 1);
										i++;
									});
									smsShare.list = sms.data.local.list;
								});
							}
						});
					}
				},
				jumpToCompose: function() {
					if (sms.data.local.simStatus <= 2) {
						tpService.promptService.toast.error('SMS.CONTENT.NO_SIM');
					} else {
						tpService.linkService.gotoMod('sms-compose');
					}
				}
			};

			var updateView = {
				addSMS: function(data) {
					//tpService.promptService.loading.hide();
					if (!data || data.result !== 0) {
						$scope.$broadcast('scroll.infiniteScrollComplete');
						return;
					}
					if (data.messageList.length === 0 || sms.data.local.list.length >= data.totalNumber || data.messageList.length > (data.totalNumber - sms.data.local.list.length)) {
						sms.data.local.canLoadMoreFlag = false;
					} else {
						sms.data.local.list = sms.data.local.list.concat(data.messageList);
						smsShare.list = sms.data.local.list;
						$scope.$broadcast('scroll.infiniteScrollComplete');
						sms.data.local.page++;
					}
				},
				addNewSMS: function(data) {
					if (!data || data.result !== 0) {
						return;
					}
					// Note: As server index maybe grow by more than 1, so we should filter the duplicate sms.
					var newMessages = [];
					var indexesOfList = [];
					var indexesOfNew = [];
					for (var i in sms.data.local.list) {
						indexesOfList.push(sms.data.local.list[i].index);
					}
					for (var j in data.messageList) {
						indexesOfNew.push(data.messageList[j].index);
					}
					for (var k in indexesOfNew) {
						if (indexesOfList.indexOf(indexesOfNew[k]) > -1) {
							// find the first duplicate sms, stop traversal
							break;
						} else {
							newMessages.push(data.messageList[k]);
						}
					}
					sms.data.local.list = newMessages.concat(sms.data.local.list);
					smsShare.list = sms.data.local.list;
				}
			};

			function enterCallback() {
				sms.data.local.simStatus = tpService.dataSharingService.get('status').wan.simStatus;
				if (sms.data.local.simStatus === 4) {
					// when pin locked, jump to pin unlock page.
					tpService.linkService.gotoMod('network-pinUnlock');
				} else if (sms.data.local.simStatus === 6) {
					// when puk locked, jump to puk unlock page.
					tpService.linkService.gotoMod('network-pukUnlock');
				} else {
					updateSMSList();
					startLoopGetNewSMS();
				}
			}

			function beforeLeaveCallback() {
				stopLoopGetNewSMS();
			}

			function requestData(num, page, callback) {
				tpService.serverDataService.request({
					module: 'message',
					action: 2,
					data: {
						"amountPerPage": num,
						"box": 0,
						"pageNumber": page
					},
					callback: callback
				});
			}

			function updateSMSList() {
				var tempArr = [];
				var requestRecursively = function(beginPage) {
					requestData(smsShare.amountPerPage, beginPage, function(data) {
						if (!data || data.result !== 0) {
							return;
						}
						tempArr = tempArr.concat(data.messageList);
						if (tempArr.length < data.totalNumber && ++beginPage < sms.data.local.page) {
							requestRecursively(beginPage);
						} else {
							sms.data.local.list = tempArr;
							smsShare.list = sms.data.local.list;
						}
					});
				}
				requestRecursively(1);
			}

			function deleteSMS(indexArr, callback) {
				tpService.serverDataService.request({
					module: 'message',
					action: 5,
					data: {
						"box": 0,
						"deleteMessages": indexArr
					},
					callback: callback
				});
			}

			function startLoopGetNewSMS() {
				sms.loopHandler = setInterval(function() {
					requestData(1, 1, function(data) {
						if (!data || data.result !== 0) {
							return;
						}
						// no messageList
						if (data.messageList.length === 0) {
							return;
						}
						// real new sms count
						var countOfNewSMS = data.messageList[0].index - ((sms.data.local.list && sms.data.local.list[0] && sms.data.local.list[0].index) || 0);
						// update page number
						if (countOfNewSMS % smsShare.amountPerPage > 0) {
							sms.data.local.page += Number((countOfNewSMS / smsShare.amountPerPage + 1).toFixed());
						} else {
							sms.data.local.page += Number((countOfNewSMS / smsShare.amountPerPage).toFixed());
						}
						// update sms list
						if (countOfNewSMS > smsShare.amountPerPage || sms.data.local.list.length === 0) {
							// find more than amountPerPage new sms, for simple process, update all list
							updateSMSList();
						} else if (countOfNewSMS > 1) {
							// find more than one new sms, so request for more
							requestData(countOfNewSMS, 1, updateView.addNewSMS);
						} else if (countOfNewSMS === 1) {
							// find just one new sms
							updateView.addNewSMS(data);
						} else {
							// find none, do nothing
						}
					});
				}, 10000); // 10s
			}

			function stopLoopGetNewSMS() {
				if (sms.loopHandler) {
					clearInterval(sms.loopHandler);
				}
			}
		}
	])

	.controller('smsDetailCtrl', ['smsShare', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$stateParams',
		function(smsShare, tpService, tpUtil, tpProtocol, $scope, $stateParams) {
			var smsDetail = this;

			tpService.modService.initMod($scope, {
				enter: enterCallback
			});

			smsDetail.smsListIndex = $stateParams.smsListIndex;

			smsDetail.data = {
				local: {
					simStatus: null,
					detail: smsShare.list[smsDetail.smsListIndex]
				}
			};

			smsDetail.action = {
				jumpToCompose: function() {
					if (smsDetail.data.local.simStatus <= 2) {
						tpService.promptService.toast.error('SMS.CONTENT.NO_SIM');
						return;
					}
					tpService.linkService.gotoMod('sms-compose', {
						smsFrom: smsDetail.data.local.detail.from
					});
				},
			};

			function enterCallback() {
				smsDetail.data.local.simStatus = tpService.dataSharingService.get('status').wan.simStatus;
				markMessage(smsDetail.data.local.detail.index);
			}

			function markMessage(index) {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: 'message',
					action: 6,
					data: {
						"markReadMessage": index
					},
					callback: function(data) {
						//tpService.promptService.loading.hide();
						smsShare.list[smsDetail.smsListIndex].unread = false;
					}
				});
			}
		}
	])

	.controller('smsComposeCtrl', ['smsShare', 'tpService', 'tpUtil', 'tpProtocol', '$scope', '$stateParams',
		function(smsShare, tpService, tpUtil, tpProtocol, $scope, $stateParams) {
			var smsCompose = this;

			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			});

			function enterCallback() {
				if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
					// Refer to: http://localhost:4000/docs/api/page/keyboard/
					// If the content of your app (including the header) is being pushed up and
					// out of view on input focus, try setting cordova.plugins.Keyboard.disableScroll(true).
					// This does not disable scrolling in the Ionic scroll view, rather it
					// disables the native overflow scrolling that happens automatically as a
					// result of focusing on inputs below the keyboard.
					cordova.plugins.Keyboard.disableScroll(true);
				}
			}

			function beforeLeaveCallback() {
				if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
					cordova.plugins.Keyboard.disableScroll(false);
				}
			}

			smsCompose.data = {
				local: {
					to: $stateParams.smsFrom
				}
			};

			smsCompose.action = {
				send: function() {
					sendSms();
				}
			};

			function sendSms() {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: 'message',
					action: 3,
					data: {
						"sendMessage": {
							"sendTime": "",
							"textContent": smsCompose.data.local.content,
							"to": smsCompose.data.local.to
						}
					},
					callback: function(data) {
						//tpService.promptService.loading.hide();
						if (!data || data.result !== 0) {
							tpService.promptService.toast.error('SMS-COMPOSE.CONTENT.FAIL');
						} else {
							tpService.promptService.toast.success('SMS-COMPOSE.CONTENT.SUCCESS');
							tpService.linkService.goBack();
						}
					}
				});
			}
		}
	])

	.directive('smsCheckbox', [

		function() {
			var jqLite = angular.element;
			return {
				transclude: true,
				restrict: 'E',
				scope: {
					show: '=?',
					checked: '=?',
					allChecked: '=?'
				},
				link: function(scope, element, attrs) {
					function clickCallback(event) {
						if (jqLite(event.target)[0].localName == 'input') {
							return; /*let checkbox click callback first*/
						}
						scope.checked = element.find('input')[0].checked = !element.find('input')[0].checked;
						scope.$apply();
						event.stopPropagation();
					}
					scope.$watch('show', function(newValue, oldValue) {
						if (newValue === true) {
							element.parent()[0].addEventListener('click', clickCallback, true);
						} else if (newValue === false) {
							element.parent()[0].removeEventListener('click', clickCallback, true);
						}
					}, true);
				},
				template: '<label class="checkbox sms-checkbox"  ng-class="{false:\'invisible\'}[show]"><input type="checkbox" ng-model="checked"></label><div ng-transclude ng-class="{true:\'sms-checkbox-show\'}[show]"></div>'
			};
		}
	])

})();
