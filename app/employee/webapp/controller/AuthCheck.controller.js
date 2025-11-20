sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  return BaseController.extend("employee.controller.AuthCheck", {
      onInit: function () {
    this._validateUser();
},

_validateUser: function () {
    const oUserModel = this.getOwnerComponent().getModel("userAPIService");
    const oRouter = this.getOwnerComponent().getRouter();

    oUserModel.callFunction("/getCurrentUser", {
        method: "GET",
        success: (oData) => {
            console.log("User API Response:", oData);

            // Backend returns structure:
            // {
            //   getCurrentUser: { id, employeeID, firstName, authenticated, employeeFound }
            // }

            const user = oData?.getCurrentUser;

            if (!user) {
                sap.m.MessageBox.error("Invalid response from server.");
                return;
            }

            if (user.authenticated) {
                // 🎉 Auth successful → Go to Employee View
                oRouter.navTo("employee");
            } else if (user.authenticated && !user.employeeFound) {
                sap.m.MessageBox.error(
                    "Authenticated, but user not found in Employee Role Collection."
                );
            } else {
                sap.m.MessageBox.error("User failed authentication.");
            }
        },
        error: (err) => {
            console.error("User API Error:", err);
            sap.m.MessageBox.error("Unable to authenticate user.");
        }
    });
}


  });
});