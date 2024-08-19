sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter",
    "sap/m/p13n/Engine",
    "sap/m/p13n/SelectionController",
    "sap/m/p13n/SortController",
    "sap/m/p13n/FilterController",
    "sap/m/p13n/MetadataHelper",
    "sap/m/table/ColumnWidthController",
    "sap/ui/core/library",
    "sap/ui/model/Sorter",
    "sap/ui/comp/smartvariants/PersonalizableInfo",
  ],
  function (
    Controller,
    JSONModel,
    MessageToast,
    Spreadsheet,
    Filter,
    FilterOperator,
    formatter,
    Engine,
    SelectionController,
    SortController,
    FilterController,
    MetadataHelper,
    ColumnWidthController,
    coreLibrary,
    Sorter
  ) {
    "use strict";

    return Controller.extend("integration.controller.Integration", {
      formatter: formatter,

      onInit: function () {
        this.oOwnerComponent = this.getOwnerComponent();
        this.oIntegrationModel =
          this.getOwnerComponent().getModel("integration");
        this.oQualityModel = this.getOwnerComponent().getModel("quality");
        this.oTestModel = this.getOwnerComponent().getModel("test");
        this.bQualityModelAvailable = false;
        this.bTestModelAvailable = false;

        var oViewModel = new JSONModel({
          worklistTableTitle:
            this._getResourceBundle().getText("worklistTableTitle"),
        });
        this.getView().setModel(oViewModel, "worklistView");

        var filtersModel = new JSONModel({ PackageId: "" });
        this.getView().setModel(filtersModel, "filtersModel");

        this._registerForP13n();

        this.oIntegrationModel.read("/IntegrationPackages?$format=json", {
          success: function (oData) {
            this.processPackagesResults(oData);
          }.bind(this),
          error: function (oError) {
            console.log(oError);
          },
        });

        // Read the Quality Model to check if it's available
        this.oQualityModel.read("/IntegrationPackages?$format=json", {
          success: function (oData) {
            // If the quality model is successfully read, set the flag to true
            this.bQualityModelAvailable = true;
          }.bind(this),
          error: function (oError) {
            // If there's an error, the flag remains false (default)
            console.log("Quality Model read failed:", oError);
          },
        });

        // Read the Test Model to check if it's available
        this.oTestModel.read("/IntegrationPackages?$format=json", {
          success: function (oData) {
            // If the test model is successfully read, set the flag to true
            this.bTestModelAvailable = true;
          }.bind(this),
          error: function (oError) {
            // If there's an error, the flag remains false (default)
            console.log("Quality Model read failed:", oError);
          },
        });
      },

      processPackagesResults: function (oData) {
        this.resultsArray = [];
        for (var i = 0; i < oData.results.length; i++) {
          var resultObject = {};
          resultObject.Id = oData.results[i].Id;
          resultObject.Name = oData.results[i].Name;
          this.resultsArray.push(resultObject);
        }
        var oJsonModelPackage = new sap.ui.model.json.JSONModel();
        oJsonModelPackage.setData(this.resultsArray);
        this.getView().setModel(oJsonModelPackage, "packages");
        this.processDesingTimeArtifacts();
      },

      processDesingTimeArtifacts: function () {
        let artifactsArray = this.resultsArray;
        this.allArtifacts = [];
        var self = this;
        var counter = 0;

        for (var i = 0; i < artifactsArray.length; i++) {
          let packageName = artifactsArray[i].Name;
          let urlDesingTime =
            "/IntegrationPackages('" +
            artifactsArray[i].Id +
            "')/IntegrationDesigntimeArtifacts";
          this.oIntegrationModel.read(urlDesingTime, {
            success: function (oData) {
              var artifactsForPackage = self.extractArtifacts(
                oData.results,
                packageName
              );
              Array.prototype.push.apply(
                self.allArtifacts,
                artifactsForPackage
              );
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
            },
          });
        }
      },
      getUniqueValues: function (array, property) {
        var uniqueValues = [];
        var uniqueMap = {};

        array.forEach(function (item) {
          var value = item[property];
          if (!uniqueMap[value]) {
            uniqueMap[value] = true;
            uniqueValues.push({ key: value, text: value });
          }
        });

        return uniqueValues;
      },

      processRunTimeArtifacts: function (allArtifacts) {
        var self = this; // Store reference to the current context
        var updatedArtifacts = []; // Array to hold the updated artifacts
        var runtimeUrl = "/IntegrationRuntimeArtifacts?$format=json";

        // Read the runtime artifacts URL
        self.oIntegrationModel.read(runtimeUrl, {
          success: function (oDataRunTime) {
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
                var updatedArtifact = Object.assign({}, allArtifacts[i]); 
                updatedArtifact.RuntimeVersion = runtimeArtifact.Version;
                updatedArtifact.Status = runtimeArtifact.Status;
                updatedArtifacts.push(updatedArtifact);
              } else {
                // If version data is not available, push the original artifact to the updatedArtifacts array
                updatedArtifacts.push(allArtifacts[i]);
              }
            }
            if (!self.bQualityModelAvailable) {
              self.byId("_IDGenColumn16").setVisible(false);
              self.byId("_IDGenColumn17").setVisible(false);
              MessageToast.show(
                "The quality system is currently unavailable. As a result, the related columns have been hidden.",
                { duration: 5000 }
              );
            }
            self.processControlNextModels(updatedArtifacts, true);
          },
          error: function (oErrorRunTime) {
            console.log("Error retrieving runtime data:", oErrorRunTime);
            self.processControlNextModels(updatedArtifacts);
          },
        });
      },

      processQualityModel: function (integrationArtifacts) {
        var self = this;
        var runtimeQualityUrl = "/IntegrationRuntimeArtifacts?$format=json";

        this.oQualityModel.read("/IntegrationPackages?$format=json", {
          success: function (oDataQuality) {
            let qualityPackages = oDataQuality.results;

            if (!qualityPackages || qualityPackages.length === 0) {
              console.log("No quality packages found or invalid response.");
              self.createModelofTable(integrationArtifacts);
              return;
            }

            for (var i = 0; i < qualityPackages.length; i++) {
              let packageName = qualityPackages[i].Name;
              let urlDesingTime =
                "/IntegrationPackages('" +
                qualityPackages[i].Id +
                "')/IntegrationDesigntimeArtifacts";
              self.oQualityModel.read(urlDesingTime, {
                success: function (oDataDesignTime) {
                  for (var j = 0; j < oDataDesignTime.results.length; j++) {
                    var qualityArtifact = oDataDesignTime.results[j];
                    var integrationArtifact = integrationArtifacts.find(
                      function (artifact) {
                        return artifact.Id === qualityArtifact.Id;
                      }
                    );

                    if (integrationArtifact) {
                      integrationArtifact.designtimeQuality =
                        qualityArtifact.Version;
                    }
                  }

                  self.oQualityModel.read(runtimeQualityUrl, {
                    success: function (oDataRuntimeQuality) {
                      let runtimeQualityArtifacts = oDataRuntimeQuality.results;

                      for (var k = 0; k < runtimeQualityArtifacts.length; k++) {
                        var qualityRuntimeArtifact = runtimeQualityArtifacts[k];
                        var integrationArtifact = integrationArtifacts.find(
                          function (artifact) {
                            return artifact.Id === qualityRuntimeArtifact.Id;
                          }
                        );

                        if (integrationArtifact) {
                          integrationArtifact.runtimeQuality =
                            qualityRuntimeArtifact.Version;
                        }
                      }
                      // self.createModelofTable(integrationArtifacts);
                      self.processControlNextModels(
                        integrationArtifacts,
                        false
                      );
                    },
                    error: function (oError) {
                      console.log("Runtime of quality error is " + oError);
                      // self.createModelofTable(integrationArtifacts);
                      self.processControlNextModels(
                        integrationArtifacts,
                        false
                      );
                    },
                  });
                },
                error: function (oError) {
                  console.log("Designtime of quality error is " + oError);
                  // self.createModelofTable(integrationArtifacts);
                  self.processControlNextModels(integrationArtifacts, false);
                },
              });
            }
          },
          error: function (oErrorQuality) {
            console.log("Package of quality error is " + oErrorQuality);
            self.processControlNextModels(true, integrationArtifacts);
          },
        });
      },

      processTestModel: function (integrationArtifacts) {
        var self = this;
        var runtimeTestUrl = "/IntegrationRuntimeArtifacts?$format=json";

        this.oTestModel.read("/IntegrationPackages?$format=json", {
          success: function (oDataQuality) {
            let qualityPackages = oDataQuality.results;

            if (!qualityPackages || qualityPackages.length === 0) {
              console.log("No quality packages found or invalid response.");
              self.createModelofTable(integrationArtifacts);
              return;
            }

            for (var i = 0; i < qualityPackages.length; i++) {
              let packageName = qualityPackages[i].Name;
              let urlDesingTime =
                "/IntegrationPackages('" +
                qualityPackages[i].Id +
                "')/IntegrationDesigntimeArtifacts";
              self.oTestModel.read(urlDesingTime, {
                success: function (oDataDesignTime) {
                  for (var j = 0; j < oDataDesignTime.results.length; j++) {
                    var testArtifact = oDataDesignTime.results[j];
                    var integrationArtifact = integrationArtifacts.find(
                      function (artifact) {
                        return artifact.Id === testArtifact.Id;
                      }
                    );

                    if (integrationArtifact) {
                      integrationArtifact.designtimeTest = testArtifact.Version;
                    }
                  }

                  self.oTestModel.read(runtimeTestUrl, {
                    success: function (oDataRuntimeTest) {
                      let runtimeTestArtifacts = oDataRuntimeTest.results;

                      for (var k = 0; k < runtimeTestArtifacts.length; k++) {
                        var qualityRuntimeArtifact = runtimeTestArtifacts[k];
                        var integrationArtifact = integrationArtifacts.find(
                          function (artifact) {
                            return artifact.Id === qualityRuntimeArtifact.Id;
                          }
                        );

                        if (integrationArtifact) {
                          integrationArtifact.runtimeTest =
                            qualityRuntimeArtifact.Version;
                        }
                      }
                      self.createModelofTable(integrationArtifacts);
                    },
                    error: function (oError) {
                      console.log("Runtime of test error is " + oError);
                      self.createModelofTable(integrationArtifacts);
                    },
                  });
                },
                error: function (oError) {
                  console.log("Designtime of test error is " + oError);
                  self.createModelofTable(integrationArtifacts);
                },
              });
            }
          },
          error: function (oErrorQuality) {
            console.log("Package of test error is " + oErrorQuality);
            self.createModelofTable(integrationArtifacts);
          },
        });
      },

      processControlNextModels: function (
        integrationArtifacts,
        isQualtyRequired
      ) {
        var self = this;
        if (self.bQualityModelAvailable && isQualtyRequired) {
          self.processQualityModel(integrationArtifacts);
        } else {
          if (self.bTestModelAvailable) {
            self.processTestModel(integrationArtifacts);
          } else {
            self.byId("_IDGenColumn18").setVisible(false);
            self.byId("_IDGenColumn19").setVisible(false);
            MessageToast.show(
              "The test system is currently unavailable. As a result, the related columns have been hidden.",
              { duration: 5000 }
            );
            self.createModelofTable(integrationArtifacts);
          }
        }
      },

      convertTimestampToDate: function (timestamp) {
        var timestampInt = parseInt(timestamp, 10);
        var date = new Date(timestampInt);
        var options = {
          year: "numeric",
          month: "long",
          day: "numeric",
        };
        return date.toLocaleDateString("en-US", options);
      },

      extractArtifacts: function (results, packageName) {
        var artifactsForPackage = [];
        for (var i = 0; i < results.length; i++) {
          var oResultArtifact = {};
          oResultArtifact.Id = results[i].Id;
          oResultArtifact.Name = results[i].Name;
          oResultArtifact.PackageId = results[i].PackageId;
          oResultArtifact.Version = results[i].Version;
          oResultArtifact.RuntimeVersion = null;
          oResultArtifact.designtimeQuality = null;
          oResultArtifact.runtimeQuality = null;
          oResultArtifact.designtimeTest = null;
          oResultArtifact.runtimeTest = null;
          oResultArtifact.Description = results[i].Description;
          oResultArtifact.CreatedAt = results[i].CreatedAt;
          oResultArtifact.CreatedAt = this.convertTimestampToDate(
            results[i].CreatedAt
          );
          oResultArtifact.Status = null;
          oResultArtifact.PackageName = packageName;
          artifactsForPackage.push(oResultArtifact);
        }
        return artifactsForPackage;
      },

      createModelofTable: function (updatedArtifacts) {
        var oJsonModel = new sap.ui.model.json.JSONModel();
        oJsonModel.setData(updatedArtifacts);
        this.getView().setModel(oJsonModel, "artifactsModel");
      },

      onRefreshData: function () {
        var oTable = this.getView().byId("_IDGenTable1");
        var oBinding = oTable.getBinding("items");
        oBinding.refresh();
        MessageToast.show("Table data refreshed successfully");
      },

      // onExportToExcel: function () {
      //   var oTable = this.getView().byId("_IDGenTable1");
      //   var oBinding = oTable.getBinding("items");
      //   // Get all items from the binding
      //   var aAllItems = oBinding.getContexts().map(function (oContext) {
      //     return oContext.getObject();
      //   });
      //   // Create a spreadsheet
      //   var oSpreadsheet = new Spreadsheet({
      //     workbook: {
      //       columns: [
      //         { label: "Artifact ID", property: "Id" },
      //         { label: "Artifact Name", property: "Name" },
      //         { label: "Description", property: "Description" },
      //         { label: "Package Id", property: "PackageId" },
      //         { label: "Package Name", property: "PackageName" },
      //         { label: "DesignTime Version", property: "Version" },
      //         { label: "Runtime Version", property: "RuntimeVersion" },
      //         { label: "Created Date", property: "CreatedAt" },
      //       ],
      //     },
      //     dataSource: aAllItems,
      //   });

      //   // Download the spreadsheet
      //   oSpreadsheet
      //     .build()
      //     .then(function () {
      //       MessageToast.show("Excel export complete.");
      //     })
      //     .catch(function (e) {
      //       MessageToast.show("Error exporting to Excel: " + e.message);
      //     });
      // },

      onExportToExcel: function () {
        var oTable = this.getView().byId("_IDGenTable1");
        var oBinding = oTable.getBinding("items");
        var oColumnMapping = {
          _IDGenColumn1: { label: "Artifact ID", property: "Id" },
          _IDGenColumn2: { label: "Artifact Name", property: "Name" },
          _IDGenColumn14: { label: "Package Name", property: "PackageName" },
          _IDGenColumn4: { label: "DesignTime Version", property: "Version" },
          _IDGenColumn9: {label: "Runtime Version",property: "RuntimeVersion",},
          _IDGenColumn16: { label: "Design time(Q)", property: "designtimeQuality" },
          _IDGenColumn17: {label: "Runtime(Q)",property: "runtimeQuality",},
          _IDGenColumn18: { label: "Design time(T)", property: "designtimeTest" },
          _IDGenColumn19: {label: "Runtime(T)",property: "runtimeTest",},
          _IDGenColumn11: { label: "Description", property: "Description" },
          _IDGenColumn3: { label: "Package Id", property: "PackageId" },
          _IDGenColumn10: { label: "Created Date", property: "CreatedAt" },
          _IDGenColumn23: { label: "Status", property: "Status" },
        };

        // Get the user's column selection
        var aColumns = oTable.getColumns();
        var aSelectedColumns = [];
        var aColumnDefinitions = [];

        aColumns.forEach(function (oColumn) {
          if (oColumn.getVisible()) {
            var sColumnId = oColumn.getId().split("--")[2];
            if (oColumnMapping[sColumnId]) {
              aSelectedColumns.push(sColumnId);
              aColumnDefinitions.push({
                label: oColumnMapping[sColumnId].label,
                property: oColumnMapping[sColumnId].property,
              });
            }
          }
        });

        // Get all items from the binding
        var aAllItems = oBinding.getContexts().map(function (oContext) {
          return oContext.getObject();
        });

        // Create a spreadsheet with selected columns
        var oSpreadsheet = new Spreadsheet({
          workbook: {
            columns: aColumnDefinitions,
          },
          dataSource: aAllItems,
        });

        // Download the spreadsheet
        oSpreadsheet
          .build()
          .then(function () {
            MessageToast.show("Excel export complete.");
          })
          .catch(function (e) {
            MessageToast.show("Error exporting to Excel: " + e.message);
          });
      },

      openPersoDialog: function (oEvt) {
        this._openPersoDialog(
          ["Columns", "Sorter", "Filter"],
          oEvt.getSource()
        );
      },

      onItemsBindingChange: function (oEvent) {
        var sTitle = this._getResourceBundle().getText(
          "worklistTableTitleCount",
          [oEvent.getSource().iLength]
        );
        this.getView()
          .getModel("worklistView")
          .setProperty("/worklistTableTitle", sTitle);
      },

      _registerForP13n: function () {
        const oTable = this.byId("_IDGenTable1");
        this.oMetadataHelper = new MetadataHelper([
          {
            key: "_IDGenColumn1",
            label: "Artifacts ID",
            path: "Id",
          },
          {
            key: "_IDGenColumn2",
            label: "Artifact Name",
            path: "Name",
          },
          {
            key: "_IDGenColumn14",
            label: "Package Name",
            path: "PackageName",
          },
          {
            key: "_IDGenColumn4",
            label: "Designtime Version",
            path: "Version",
          },
          {
            key: "_IDGenColumn9",
            label: "Runtime Version",
            path: "RuntimeVersion",
          },
          {
            key: "_IDGenColumn16",
            label: "Design time(Q)",
            path: "designtimeQuality",
          },
          {
            key: "_IDGenColumn17",
            label: "Runtime(Q)",
            path: "runtimeQuality",
          },
          {
            key: "_IDGenColumn18",
            label: "Design time(T)",
            path: "designtimeTest",
          },
          {
            key: "_IDGenColumn19",
            label: "Runtime(T)",
            path: "runtimeTest",
          },
          {
            key: "_IDGenColumn11",
            label: "Description",
            path: "Description",
          },
          {
            key: "_IDGenColumn3",
            label: "Package Id",
            path: "PackageId",
          },
          {
            key: "_IDGenColumn10",
            label: "Created At",
            path: "CreatedAt",
          },
          {
            key: "_IDGenColumn23",
            label: "Status",
            path: "Status",
          },
        ]);

        Engine.getInstance().register(oTable, {
          helper: this.oMetadataHelper,
          controller: {
            Columns: new SelectionController({
              targetAggregation: "columns",
              control: oTable,
            }),
            Sorter: new SortController({
              control: oTable,
            }),
            ColumnWidth: new ColumnWidthController({
              control: oTable,
            }),
            Filter: new FilterController({
              control: oTable,
            }),
          },
        });

        Engine.getInstance().attachStateChange(
          this.handleStateChange.bind(this)
        );
      },

      handleStateChange: function (oEvt) {
        const oTable = this._getArtifactsTable();
        const oState = oEvt.getParameter("state");
        if (!oState) {
          return;
        }
        this.updateColumns(oState);
        const aFilter = this.createFilters(oState);
        const aSorter = this.createSorters(oState, []);
        const oBinding = oTable.getBinding("items");
        oBinding.filter(aFilter);
        oBinding.sort(aSorter);
        oBinding.refresh();
        // this.updateItems();
      },

      updateItems: function () {
        const oTable = this._getArtifactsTable();
        const oBinding = oTable.getBinding("items");
        var oColumnMapping = {
          _IDGenColumn1: { label: "Artifact ID", property: "Id" },
          _IDGenColumn2: { label: "Artifact Name", property: "Name" },
          _IDGenColumn14: { label: "Package Name", property: "PackageName" },
          _IDGenColumn4: { label: "DesignTime Version", property: "Version" },
          _IDGenColumn9: {
            label: "Runtime Version",
            property: "RuntimeVersion",
          },
          _IDGenColumn11: { label: "Description", property: "Description" },
          _IDGenColumn3: { label: "Package Id", property: "PackageId" },
          _IDGenColumn10: { label: "Created Date", property: "CreatedAt" },
        };
        // Get the user's column selection
        var aColumns = oTable.getColumns();
        var aSelectedColumns = [];
        var aColumnDefinitions = [];

        aColumns.forEach(function (oColumn) {
          if (oColumn.getVisible()) {
            var sColumnId = oColumn.getId().split("--")[2];
            if (oColumnMapping[sColumnId]) {
              aSelectedColumns.push(sColumnId);
              aColumnDefinitions.push({
                label: oColumnMapping[sColumnId].label,
                property: oColumnMapping[sColumnId].property,
              });
            }
          }
        });

        // Get all items from the binding
        var aAllItems = oBinding.getContexts().map(function (oContext) {
          return oContext.getObject();
        });

        // Yeni model için veri yapısını oluştur
        var aUpdatedItems = aAllItems.map(function (oItem) {
          var oNewItem = {};
          aColumnDefinitions.forEach(function (oColumnDef) {
            oNewItem[oColumnDef.property] = oItem[oColumnDef.property];
          });
          return oNewItem;
        });

        var hasValidData =
          aUpdatedItems.length > 0 &&
          !aUpdatedItems.every(function (item) {
            return Object.keys(item).length === 0;
          });

        if (hasValidData) {
          var oModel = this.getView().getModel("artifactsModel");
          oModel.setProperty("/", aUpdatedItems);
          oTable.setModel(oModel);
          // oTable.bindColumns("/columns", function (sId, oContext) {
          //   var sColumnId = oContext.getObject().columnId;
          //   return new sap.ui.table.Column({
          //     id: sColumnId,
          //     label: sColumnId,
          //     template: sColumnId,
          //     sortProperty: sColumnId,
          //     filterProperty: sColumnId,
          //   });
          // });
          // oTable.bindRows("/rows");
          // var oModel = new sap.ui.model.json.JSONModel();
          // oModel.setData({
          //     columns : aColumnDefinitions,
          //     rows    : aUpdatedItems
          // });
          // this.getView().setModel(oModel, "artifactsModel");
        } else {
          console.log("Güncellenmiş veri mevcut değil veya veri geçersiz.");
        }
      },

      createFilters: function (oState) {
        const aFilter = [];
        Object.keys(oState.Filter).forEach((sFilterKey) => {
          const filterPath = this.oMetadataHelper.getProperty(sFilterKey).path;
          oState.Filter[sFilterKey].forEach(function (oConditon) {
            aFilter.push(
              new Filter(filterPath, oConditon.operator, oConditon.values[0])
            );
          });
        });
        return aFilter;
      },

      createSorters: function (oState, aExistingSorter) {
        const aSorter = aExistingSorter || [];
        oState.Sorter.forEach(
          function (oSorter) {
            const oExistingSorter = aSorter.find(
              function (oSort) {
                return (
                  oSort.sPath ===
                  this.oMetadataHelper.getProperty(oSorter.key).path
                );
              }.bind(this)
            );

            if (oExistingSorter) {
              oExistingSorter.bDescending = !!oSorter.descending;
            } else {
              aSorter.push(
                new Sorter(
                  this.oMetadataHelper.getProperty(oSorter.key).path,
                  oSorter.descending
                )
              );
            }
          }.bind(this)
        );

        oState.Sorter.forEach(
          function (oSorter) {
            const oCol = this.byId(oSorter.key);
            if (oSorter.sorted !== false) {
              oCol.setSortIndicator(
                oSorter.descending
                  ? coreLibrary.SortOrder.Descending
                  : coreLibrary.SortOrder.Ascending
              );
            }
          }.bind(this)
        );

        return aSorter;
      },

      updateColumns: function (oState) {
        const oTable = this._getArtifactsTable();

        oTable.getAggregation("columns").forEach(function (oColumn) {
          oColumn.setVisible(false);
          const columnKey = this._getKey(oColumn);
          oColumn.setWidth(oState.ColumnWidth[columnKey] || "auto");
          oColumn.setSortIndicator(coreLibrary.SortOrder.None);
        }, this);

        oState.Columns.forEach(
          function (oProp, iIndex) {
            const oCol = this.byId(oProp.key);
            oCol.setVisible(true);
            oTable.removeColumn(oCol);
            oTable.insertColumn(oCol, iIndex);
          }.bind(this)
        );
      },

      beforeOpenColumnMenu: function (oEvt) {
        const oMenu = this.byId("menu");
        const oColumn = oEvt.getParameter("openBy");
        const oSortItem = oMenu.getQuickActions()[0].getItems()[0];
        const oGroupItem = oMenu.getQuickActions()[1].getItems()[0];

        oSortItem.setKey(this._getKey(oColumn));
        oSortItem.setLabel(oColumn.getHeader().getText());
        oSortItem.setSortOrder(oColumn.getSortIndicator());

        oGroupItem.setKey(this._getKey(oColumn));
        oGroupItem.setLabel(oColumn.getHeader().getText());
        oGroupItem.setGrouped(oColumn.data("grouped"));
      },

      _getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },

      _getKey: function (oControl) {
        return this.getView().getLocalId(oControl.getId());
      },

      _openPersoDialog: function (aPanels, oSource) {
        const oTable = this.byId("_IDGenTable1");

        Engine.getInstance().show(oTable, aPanels, {
          contentHeight: aPanels.length > 1 ? "50rem" : "35rem",
          contentWidth: aPanels.length > 1 ? "45rem" : "32rem",
          source: oSource || oTable,
        });
      },

      _getArtifactsTable: function () {
        return this.byId("_IDGenTable1");
      },

      onFilterChange: function (oEvent) {
        var oMultiComboBox = this.byId("packageIdComboBox");
        var aSelectedKeys = oMultiComboBox.getSelectedKeys();

        var aFilters = [];
        if (aSelectedKeys.length > 0) {
          aSelectedKeys.forEach(function (sKey) {
            aFilters.push(
              new Filter("PackageId", FilterOperator.Contains, sKey)
            );
          });
        }

        var oTable = this.byId("_IDGenTable1");
        var oBinding = oTable.getBinding("items");
        oBinding.filter(
          aFilters.length > 0
            ? new Filter({ filters: aFilters, and: false })
            : []
        );
      },

      onSearch: function (oEvent) {
        var sQuery = oEvent.getParameter("query");
        var aFilters = [];

        if (sQuery) {
          aFilters.push(
            new Filter({
              filters: [
                new Filter("Id", FilterOperator.Contains, sQuery),
                new Filter("Name", FilterOperator.Contains, sQuery),
                new Filter("Description", FilterOperator.Contains, sQuery),
                new Filter("PackageId", FilterOperator.Contains, sQuery),
              ],
              and: false,
            })
          );
        }

        var oTable = this.getView().byId("_IDGenTable1");
        var oBinding = oTable.getBinding("items");
        oBinding.filter(aFilters);
      },
    });
  }
);
