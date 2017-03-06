// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.tools', function() {

	beforeEach(module('tpmifix.mod.tools'));

	describe('toolsCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('toolsCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
