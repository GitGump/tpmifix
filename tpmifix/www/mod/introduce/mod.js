(function() {
	'use strict';

	/**
	 * @description
	 * Introduce is module that shows up when app firstly opened.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.introduce
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.introduce', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol', 'tpmifix.mod.home'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('introduce', {
					url: '/introduce',
					templateUrl: 'mod/introduce/mod.html',
					controller: 'introduceCtrl'
				})
		}
	])

	.controller('introduceCtrl', ['tpService', 'tpUtil', 'tpProtocol', '$scope', 'homeValue',
		function(tpService, tpUtil, tpProtocol, $scope, homeValue) {
			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback
			}, true);
			$scope.data = {
				local: {
					images: {
						walkthrough_bg_01: tpService.modService.getModImgUrl('walkthrough_bg_01.png'),
						walkthrough_01: tpService.modService.getModImgUrl('walkthrough_01.png'),
						walkthrough_bg_02: tpService.modService.getModImgUrl('walkthrough_bg_02.png'),
						walkthrough_02: tpService.modService.getModImgUrl('walkthrough_02.png'),
						walkthrough_bg_03: tpService.modService.getModImgUrl('walkthrough_bg_03.png'),
						walkthrough_03: tpService.modService.getModImgUrl('walkthrough_03.png')
					},
				},
				server: {},
				backup: {}
			};

			function enterCallback() {
				tpService.linkService.preventAutoJumpWhenError();
				homeValue.preventFactoryJump = true;
			}

			function beforeLeaveCallback() {
				tpService.linkService.allowAutoJumpWhenError();
				homeValue.preventFactoryJump = false;
			}
		}
	])

})();
