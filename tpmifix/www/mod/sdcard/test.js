// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.sdcard', function() {

	beforeEach(module('tpmifix.mod.sdcard'));

	describe('sdcardCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('sdcardCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
