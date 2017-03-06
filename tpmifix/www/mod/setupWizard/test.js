// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.setupWizard', function() {

	beforeEach(module('tpmifix.mod.setupWizard'));

	describe('setupWizardCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('setupWizardCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('setupWizardLoginCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('setupWizardLoginCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('setupWizardWifiCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('setupWizardWifiCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('setupWizardEndCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('setupWizardEndCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
