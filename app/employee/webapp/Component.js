sap.ui.define([
    "sap/ui/core/UIComponent",
    "employee/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("employee.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
            this._checkCurrentUser();
        },

        
_checkCurrentUser: function () {
    let oUserModel = this.getOwnerComponent().getModel("userAPIService");

    oUserModel.callFunction("/getCurrentUser", {
        method: "GET",
        success: (oData) => {
            console.log("User API Response:", oData);

            if (oData.getCurrentUser.authenticated) {
                 this.getRouter().navTo("Employee");
            } else {
                sap.m.MessageBox.error(
                    "User is authenticated but not found in Employee Role Collection."
                );
            }
        },
        error: (oError) => {
            console.error("User API Error:", oError);
            sap.m.MessageToast.show("Unable to fetch user information.");
        }
    });
}
    });
});