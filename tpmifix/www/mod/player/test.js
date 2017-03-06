// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.player', function() {

	beforeEach(module('tpmifix.mod.player'));

	describe('playerCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('playerCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
