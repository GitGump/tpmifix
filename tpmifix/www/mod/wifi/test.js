// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.wifi', function() {

	beforeEach(module('tpmifix.mod.wifi'));

	describe('wifiCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('wifiCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
