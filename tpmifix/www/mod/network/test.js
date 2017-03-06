// test case, for e.g. jasmine in the future.

describe('tpmifix.mod.network', function() {

	beforeEach(module('tpmifix.mod.network'));

	describe('networkCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkDialUpTypeCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkDialUpTypeCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkNetworkModeCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope, tpService) {
			tpService.dataSharingService.set('status', {deviceInfo: {productID: "09610001"}});
			scope = $rootScope.$new();
			ctrl = $controller('networkNetworkModeCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkApnManageCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkApnManageCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkAddApnCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkAddApnCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkEditApnCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkEditApnCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkPinManageCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkPinManageCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkChangePinCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkChangePinCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkPinUnlockCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkPinUnlockCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});

	describe('networkPukUnlockCtrl', function() {

		var ctrl, scope;

		beforeEach(inject(function($controller, $rootScope) {
			scope = $rootScope.$new();
			ctrl = $controller('networkPukUnlockCtrl', {$scope: scope});
		}));

		it('controller should exist', function() {
			expect(ctrl).toBeDefined();
		});
	});
});
