// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.device', function() {

	beforeEach(module('tpmifix.mod.device'));

	describe('deviceCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('deviceCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
