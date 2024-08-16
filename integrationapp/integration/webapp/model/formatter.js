sap.ui.define([], function () {
    "use strict";

    return {
        getUniqueArtifactIds: function (artifactsModel) {
            if (!artifactsModel) {
                return [];
            }
            var aData = artifactsModel.getProperty("/results");
            var aUniqueIds = [...new Set(aData.map(item => item.Id))];
            return aUniqueIds.map(id => ({ key: id, text: id }));
        },

        getUniquePackageIds: function (artifactsModel) {
            if (!artifactsModel) {
                return [];
            }
            var aData = artifactsModel.getProperty("/results");
            var aUniqueIds = [...new Set(aData.map(item => item.PackageId))];
            return aUniqueIds.map(id => ({ key: id, text: id }));
        }
    };
});
