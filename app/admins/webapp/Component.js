sap.ui.define([
    "sap/ui/core/UIComponent",
    "admins/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("admins.Component", {
        metadata: {
            manifest: "json"
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.getRouter().initialize();

            this._checkCurrentUser();
        },

        _checkCurrentUser() {
            let oUserModel = this.getModel("userAPIService");

            oUserModel.callFunction("/getCurrentUser", {
                method: "GET",
                success: (oData) => {
                    console.log(oData)
                    let user = oData.getCurrentUser;

                    if (user.authenticated && user.role === "Admin") {
                        console.log(`${user.authenticated} & ${user.role}`)
                        this.setModel(new sap.ui.model.json.JSONModel(user), "currentUser");
                        this.getRouter().navTo("admins", {}, true);
                    } else {
                        sap.m.MessageBox.error("Not authorized as Admin.");
                    }
                },
                error: e => sap.m.MessageToast.show("User API Error")
            });
        }
    });
});
