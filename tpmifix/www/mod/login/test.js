// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.login', function() {

	beforeEach(module('tpmifix.mod.login'));

	describe('loginCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('loginCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
