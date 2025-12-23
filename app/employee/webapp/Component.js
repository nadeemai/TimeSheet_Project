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

       init: function () {
  UIComponent.prototype.init.apply(this, arguments);

  this.setModel(models.createDeviceModel(), "device");

  // 🔐 Global auth model
  // const oAuthModel = new sap.ui.model.json.JSONModel({
  //   encryptedEmployeeId: ""
  // });
  // this.setModel(oAuthModel, "authModel");

  this.getRouter().initialize();
  // this._checkOTPVerification();
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

// _checkOTPVerification: function () {
//   const sHash = window.location.hash;

//   // If already on OTP page, do nothing
//   if (sHash && sHash.includes("OTPVerification")) {
//     return;
//   }

//   // Read encrypted ID from model (or generate once)
//   let sEncryptedId =
//     this.getModel("authModel").getProperty("/encryptedEmployeeId");

//   if (!sEncryptedId) {
//     sEncryptedId = this._getEncryptedEmployeeId();
//   }

//   if (sEncryptedId) {
//     this.getRouter().navTo(
//       "otp-verification",
//       { encryptedId: sEncryptedId },
//       true
//     );
//   } else {
//     sap.m.MessageBox.error(
//       "Unable to verify employee identity. Please contact support."
//     );
//   }
// },
       
//        _getEncryptedEmployeeId: function () {
//   const sEncryptedId = "e4977ed8a797696718cb50430b1db736"; // example

//   // Store in model
//   this.getModel("authModel")
//       .setProperty("/encryptedEmployeeId", sEncryptedId);

//   return sEncryptedId;
// }

    });
});