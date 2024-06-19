/*global QUnit*/

sap.ui.define([
	"integration/controller/Integration.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Integration Controller");

	QUnit.test("I should test the Integration controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
