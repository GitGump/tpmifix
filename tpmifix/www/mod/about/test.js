// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.about', function() {

	beforeEach(module('tpmifix.mod.about'));

	describe('aboutCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('aboutCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
