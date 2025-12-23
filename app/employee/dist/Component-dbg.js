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
            // this._checkCurrentUser();
            this._checkOTPVerification();
        },

        
// _checkCurrentUser: function () {
//     let oUserModel = this.getModel("userAPIService");

//     oUserModel.callFunction("/getCurrentUser", {
//         method: "GET",
//         success: (oData) => {
//             console.log("User API Response:", oData);

//             let user = oData.getCurrentUser;

//             if (user.authenticated && user.employeeFound) {
//                 // Store user in a global model
//                 this.setModel(new sap.ui.model.json.JSONModel(user), "currentUser");

//                 // Route to Employee Dashboard
//                 this.getRouter().navTo("employee", {}, true);
//             } 
//             else {
//                 sap.m.MessageBox.error(
//                     "User not authorized. Please contact admin."
//                 );
//             }
//         },
//         error: (oError) => {
//             console.error("User API Error:", oError);
//             sap.m.MessageToast.show("Unable to fetch user information.");
//         }
//     });
// },

_checkOTPVerification: function() {
            // Get current hash
            let sHash = window.location.hash;
           
            // If hash is empty or doesn't contain otp-verification, redirect to OTP
            if (!sHash || !sHash.includes("otp-verification")) {
                // Get encrypted employee ID (this should come from your authentication system)
                const sEncryptedId = this._getEncryptedEmployeeId();
               
                if (sEncryptedId) {
                    // Navigate to OTP verification
                    this.getRouter().navTo("otp-verification", {
                        encryptedId: sEncryptedId
                    }, true);
                } else {
                    // Handle error case
                    sap.m.MessageBox.error("Unable to verify employee identity. Please contact support.");
                }
            }
        },
       
        _getEncryptedEmployeeId: function() {
            // This method should return the encrypted employee ID
            // Implementation depends on your authentication system
            // For now, returning a placeholder
            return "ENCRYPTED_EMPLOYEE_ID";
        }

    });
});