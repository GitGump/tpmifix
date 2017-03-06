// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.introduce', function() {

	beforeEach(module('tpmifix.mod.introduce'));

	describe('introduceCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('introduceCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
