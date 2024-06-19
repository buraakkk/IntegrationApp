sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    'sap/ui/model/Filter',
    'sap/ui/model/FilterOperator'
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, Filter, FilterOperator) {
        "use strict";

        return Controller.extend("integration.controller.Integration", {
            onInit: function () {

                this.oOwnerComponent = this.getOwnerComponent();

                this.oIntegrationModel = this.getOwnerComponent().getModel("integration");

                this.oIntegrationModel.read("/IntegrationPackages?$format=json", {
                    success: function (oData) {
                        this.processPackagesResults(oData);
                    }.bind(this),
                    error: function (oError) {
                        console.log(oError);
                    }
                });
                this.oIntegrationModel.read("/IntegrationRuntimeArtifacts?$format=json", {
                    success: function (oData) {
                        console.log(oData)
                    }.bind(this),
                    error: function (oError) {
                        console.log(oError);
                    }
                });
            },

            processPackagesResults: function (oData) {
                this.resultsArray = [];

                // Loop through each result in oData
                for (var i = 0; i < oData.results.length; i++) {
                    var resultObject = {};

                    // Save the "Id" and "Name" properties from each result
                    resultObject.Id = oData.results[i].Id;
                    resultObject.Name = oData.results[i].Name;
                    // Push the result object to the results array
                    this.resultsArray.push(resultObject);
                }
                // Add an empty item to represent the blank option
                var blankItem = { Id: "", Name: "" };
                this.resultsArray.unshift(blankItem);
                var oJsonModelPackage = new sap.ui.model.json.JSONModel();
                oJsonModelPackage.setData(this.resultsArray);
                this.getView().setModel(oJsonModelPackage, "packages");
                console.log(this.resultsArray);
                this.processDesingTimeArtifacts();
            },
            processDesingTimeArtifacts: function () {
                let artifactsArray = this.resultsArray;
                this.allArtifacts = [];
                var self = this;
                var counter = 0;

                for (var i = 0; i < artifactsArray.length; i++) {

                    let urlDesingTime = "/IntegrationPackages('" + artifactsArray[i].Id + "')/IntegrationDesigntimeArtifacts";
                    this.oIntegrationModel.read(urlDesingTime, {
                        success: function (oData) {
                            var artifactsForPackage = self.extractArtifacts(oData.results);
                            Array.prototype.push.apply(self.allArtifacts, artifactsForPackage);
                            counter++;
                            if (counter === artifactsArray.length) {
                                self.processRunTimeArtifacts(self.allArtifacts);
                            }
                        }.bind(this),
                        error: function (oError) {
                            console.log(oError);
                            counter++;
                            if (counter === artifactsArray.length) {
                                self.processRunTimeArtifacts(self.allArtifacts);
                            }
                        }
                    });
                }
            },
            processRunTimeArtifacts: function (allArtifacts) {
                var self = this; // Store reference to the current context
                var updatedArtifacts = []; // Array to hold the updated artifacts
                var runtimeUrl = "/IntegrationRuntimeArtifacts?$format=json";

                // Read the runtime artifacts URL
                self.oIntegrationModel.read(runtimeUrl, {
                    success: function (oDataRunTime) {
                        // Check if the runtime data is available
                        if (oDataRunTime) {
                            var runtimeArtifacts = oDataRunTime.results;

                            // Loop through allArtifacts to update with runtime versions
                            for (var i = 0; i < allArtifacts.length; i++) {
                                // Check if the artifact ID exists in the runtime data
                                var artifactId = allArtifacts[i].Id;
                                var runtimeArtifact = runtimeArtifacts.find(function (artifact) {
                                    return artifact.Id === artifactId;
                                });

                                // If runtime version is found, update the artifact
                                if (runtimeArtifact && runtimeArtifact.Version) {
                                    var updatedArtifact = Object.assign({}, allArtifacts[i]); // Create a copy of the artifact
                                    updatedArtifact.RuntimeVersion = runtimeArtifact.Version;
                                    updatedArtifacts.push(updatedArtifact);
                                } else {
                                    // If version data is not available, push the original artifact to the updatedArtifacts array
                                    updatedArtifacts.push(allArtifacts[i]);
                                }
                            }

                            // Return the updated array to the caller
                            self.createModelofTable(updatedArtifacts);
                        } else {
                            console.log("No runtime data available.");
                            // If runtime data is not available, return the original array to the caller
                            self.createModelofTable(allArtifacts);
                        }
                    },
                    error: function (oErrorRunTime) {
                        console.log("Error retrieving runtime data:", oErrorRunTime);
                        // If error occurs, return the original array to the caller
                        self.createModelofTable(allArtifacts);
                    }
                });
            },

            extractArtifacts: function (results) {
                var artifactsForPackage = []; // Array to hold artifacts for each package

                for (var i = 0; i < results.length; i++) {
                    var oResultArtifact = {};

                    // Save the "Id", "Version", "PackageId", and "Name" properties from each result
                    oResultArtifact.Id = results[i].Id;
                    oResultArtifact.Name = results[i].Name;
                    oResultArtifact.PackageId = results[i].PackageId;
                    oResultArtifact.Version = results[i].Version;
                    oResultArtifact.RuntimeVersion = null;

                    artifactsForPackage.push(oResultArtifact); // Push each artifact into the array
                }

                return artifactsForPackage;
            },

            createModelofTable: function (updatedArtifacts) {
                var oJsonModel = new sap.ui.model.json.JSONModel();
                oJsonModel.setData(updatedArtifacts);
                this.getView().setModel(oJsonModel, "artifactsModel");
            },

            handleF4Generic: function () {
                // Create a ValueHelpDialog instance
                var oValueHelpDialog = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
                    title: "Package ID Search Help",
                    supportMultiselect: false,
                    supportRanges: false,
                    key: "Id", // Specify the key for the value help dialog
                    descriptionKey: "Name", // Specify the description key for the value help dialog
                    ok: function (oControlEvent) {
                        var oSelectedItem = oControlEvent.getParameter("tokens")[0];
                        if (oSelectedItem) {
                            var sSelectedId = oSelectedItem.getProperty("key");
                            if (sSelectedId === "") {
                                this.getView().byId("_IDGenTable1").getBinding("items").filter([]);
                                this.getView().byId("_IDGenSearchField4").setValue("");
                            }
                            else {
                                var oFilter = new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.EQ, sSelectedId);
                                var oTable = this.getView().byId("_IDGenTable1");
                                var oBinding = oTable.getBinding("items");
                                oBinding.filter([oFilter]);
                                this.getView().byId("_IDGenSearchField4").setValue(oSelectedItem.getProperty("text"));
                            }
                        }
                        oValueHelpDialog.close();
                    }.bind(this),
                    cancel: function () {
                        oValueHelpDialog.close();
                    }
                });

                // Set up the search help dialog with data
                var oModel = this.getView().getModel("packages");
                oValueHelpDialog.getTable().setModel(oModel);
                oValueHelpDialog.getTable().bindRows("/");

                oValueHelpDialog.getTable().addColumn(new sap.ui.table.Column({
                    label: new sap.m.Label({ text: "Package ID" }),
                    template: new sap.m.Text().bindProperty("text", "Id")
                }));
                oValueHelpDialog.getTable().addColumn(new sap.ui.table.Column({
                    label: new sap.m.Label({ text: "Package Name" }),
                    template: new sap.m.Text().bindProperty("text", "Name")
                }));

                oValueHelpDialog.open();
            },


            onFilterPackage: function (oEvent) {
                this._applyFilter("PackageId", oEvent.getParameter("query"));
            },

            // Generic filter function
            _applyFilter: function (sFieldName, sQuery) {
                // Build filter array
                var aFilters = [];

                // Create filter for the specified field
                if (sQuery) {
                    var oFilter = new Filter(sFieldName, FilterOperator.Contains, sQuery);
                    aFilters.push(oFilter);
                }

                // Apply filters to the binding
                var oTable = this.getView().byId("_IDGenTable1");
                var oBinding = oTable.getBinding("items");
                oBinding.filter(aFilters);
            },

            onSort: function () {
                var oTable = this.getView().byId("_IDGenTable1");
                var oBinding = oTable.getBinding("items");
                var aSorters = [];
                var bSortDescending = false; // Default sorting order

                // Check if already sorted and determine sorting order
                if (oBinding.aSorters.length > 0 && oBinding.aSorters[0].sPath === "Id") {
                    // If already sorted by Id, reverse the sorting order
                    bSortDescending = !oBinding.aSorters[0].bDescending;
                }

                // Create sorter for Id column
                var oSorter = new sap.ui.model.Sorter("Id", bSortDescending);
                aSorters.push(oSorter);

                // Apply sorting to the binding
                oBinding.sort(aSorters);
            },

            onRefreshData: function () {
                var oTable = this.getView().byId("_IDGenTable1");
                var oBinding = oTable.getBinding("items");
                oBinding.refresh();
            }
        });
    });
