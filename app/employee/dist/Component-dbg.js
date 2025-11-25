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
    let oUserModel = this.getModel("userAPIService");

    oUserModel.callFunction("/getCurrentUser", {
        method: "GET",
        success: (oData) => {
            console.log("User API Response:", oData);

            let user = oData.getCurrentUser;

            if (user.authenticated && user.employeeFound) {
                // Store user in a global model
                this.setModel(new sap.ui.model.json.JSONModel(user), "currentUser");

                // Route to Employee Dashboard
                this.getRouter().navTo("Employee", {}, true);
            } 
            else {
                sap.m.MessageBox.error(
                    "User not authorized. Please contact admin."
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