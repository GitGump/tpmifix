// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.account', function() {

	beforeEach(module('tpmifix.mod.account'));

	describe('accountCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('accountCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
