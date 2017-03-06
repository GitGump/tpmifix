(function() {
	'use strict';

	/**
	 * @description
	 * Protocol process module.
	 *
	 * Input and parse the protocol specification file (local or server), then output json object.
	 *
	 * @memberof tpmifix
	 * @ngdoc overview
	 * @name tpmifix.protocol
	 */
	angular.module('tpmifix.protocol', [])

	/**
	 * @description
	 * Protocol constant.
	 *
	 * @memberof tpmifix.protocol
	 */
	.constant('protocolConstant', {
		APP: {
			NAME: 'tpMiFi-X',
			VER: '0.2.0'
		},
		PROTOCOL: {
			SPEC: {
				NAME: '?',
				VER: '?',
				URL: '?'
			}
		},
		PRODUCT: {
			TR961_5200L_V1: {
				ID: '09610001',
				VER: {
					MIN: '1.0.11'
				}
			},
			TR961_5200L_V2: {
				ID: '09610002',
				VER: {
					MIN: '1.0.3'
				}
			},
			TR961_5200L_V3: {
				ID: '09610003',
				VER: {
					MIN: '1.0.5'
				}
			},
			TR961_5200L_V4: {
				ID: '09610004',
				VER: {
					MIN: '1.0.0'
				}
			},
			TR961_2500L_CM_CU_V1: {
				ID: '09610101',
				VER: {
					MIN: '1.0.10'
				}
			},
			TR961_2000_ALL_V1: {
				ID: '09610401',
				VER: {
					MIN: '1.0.0'
				}
			}
		}
	})

	/**
	 * @description
	 * Protocol value.
	 *
	 * @memberof tpmifix.protocol
	 */
	.value('protocolValue', {})

	/**
	 * @description
	 * Protocol specification service.
	 *
	 * @memberof tpmifix.protocol
	 * @ngdoc service
	 * @name protocolSpecService
	 * @requires $http
	 * @requires $log
	 */
	.factory('protocolSpecService', ['$http', '$log',
		function($http, $log) {
			/**
			 * @description
			 * Get protocol file (local or server) by url, and invoke parser to process.
			 *
			 * @memberof protocolSpecService
			 * @param {string} url The protocol file url.
			 * @param {function} parser The protocol parser function.
			 * @param {string} field The protocol part/field name you want.
			 * @param {function} callback The callback function, invoked with arg `{json-object} data` after parse.
			 */
			var get = function(url, parser, field, callback) {
				$http.get(url)
					.success(function(data, status, headers, config, statusText) {
						parser(data, field, callback);
						return;
					})
					.error(function(data, status, headers, config, statusText) {
						$log.error('protocolSpecService:get(' + url + '): fail to get protocol file!');
						return;
					})
			}

			/**
			 * @description
			 * Parse protocol file, to get special field.
			 *
			 * @memberof protocolSpecService
			 * @param {string} data The protocol (file) content (data).
			 * @param {string} field The protocol part/field name you want.
			 * @param {function} callback The callback function, invoked with arg `{json-object} data` after parse.
			 */
			var parse = function(data, field, callback) {
				if (!data) {
					return;
				}
				var regex = new RegExp(field + '$\n^(\{$\n(.*\n)*?^\})$\n', 'm');
				callback(angular.toJson(data.match(regex)[1]));
			}

			/**
			 * @description
			 * Get response field (in dntcase, it's "@EXPECT") as json obj.
			 *
			 * @memberof protocolSpecService
			 * @param {string} url The protocol file url.
			 * @param {function} callback The callback function, invoked with arg `{json-object} data` after parse.
			 */
			var getFieldResponse = function(url, callback) {
				get(url, parse, "@EXPECT", callback);
			}

			return {
				get: get,
				parse: parse,
				getFieldResponse: getFieldResponse
			}
		}
	])

	/**
	 * @description
	 * Protocol bundle.
	 *
	 * Bundle all protocols into one protocol.
	 * Other module can depend on `tpProtocol` and use any API under it, like `tpProtocol.xxx.yyy()`.
	 * Html can use `tpProtocol.xxx.yyy()` directly as it has been exported to `$rootScope`.
	 *
	 * @example
	 * tpProtocol.protocolSpecService.getFieldResponse("dntcase/status/spec/case_status_action_0", function(resObj) {
	 *     $scope.data.status = tpUtil.initUtil.initLoading(resObj);
	 * });
	 *
	 * @memberof tpmifix.protocol
	 * @ngdoc service
	 * @name tpProtocol
	 * @requires $rootScope
	 * @requires protocolConstant
	 * @requires protocolValue
	 * @requires protocolSpecService
	 */
	.factory('tpProtocol', ['$rootScope', '$window', 'protocolConstant', 'protocolValue', 'protocolSpecService',
		function($rootScope, $window, protocolConstant, protocolValue, protocolSpecService) {
			var api = {
				protocolConstant: protocolConstant,
				protocolValue: protocolValue,
				protocolSpecService: protocolSpecService
			}

			// Export service to html
			$rootScope.tpProtocol = api;
			// Export browser window
			$window.tpProtocol = api;
			return api;
		}
	])

})();
