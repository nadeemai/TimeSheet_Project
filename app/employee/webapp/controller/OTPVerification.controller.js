sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, JSONModel, BusyIndicator) {
  "use strict";

  return Controller.extend("employee.controller.OTPVerification", {

    onInit: function () {
      const oGlobalModel = new sap.ui.model.json.JSONModel({
                EncryptedID: ""
           });
            this.getView().setModel(oGlobalModel, "globalModel");
      const oRoute = this.getOwnerComponent()
        .getRouter()
        .getRoute("otp-verification");

      oRoute.attachPatternMatched(this._onRouteMatched, this);
    },

    // 🔹 Step 1: Extract token & trigger OTP generation
 _onRouteMatched: async function () {
  try {
    const sHash = window.location.hash || "";

    // hash examples:
    // "#/"
    // "#/e4977ed8a797696718cb50430b1db736"

    const aParts = sHash.split("/");
    const sEncryptedId = aParts.length > 1 ? aParts[1] : null;

    if (!sEncryptedId) {
      // No token → OTP page loaded normally (this is OK)
      return;
    }

    this._linkToken = sEncryptedId;

    this.getView()
      .getModel("globalModel")
      .setProperty("/EncryptedID", sEncryptedId);

    // Reset UI
    this.byId("otpInput").setValue("");
    this.byId("verifyButton").setEnabled(false);
    this.byId("messageText").setText("");

    sap.ui.core.BusyIndicator.show(0);

    // 🔥 Generate OTP
    const response = await fetch(
      "/odata/v4/authentication/generateOTP",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkToken: sEncryptedId })
      }
    );

    const data = await response.json();
    sap.ui.core.BusyIndicator.hide();

    if (!data.success) {
      sap.m.MessageBox.error("Unable to generate OTP. Link may be expired.");
      return;
    }

    this.byId("messageText")
      .setText(`OTP sent to ${data.maskedEmail}`);

    sap.m.MessageToast.show("OTP generated successfully");

  } catch (e) {
    sap.ui.core.BusyIndicator.hide();
    sap.m.MessageBox.error("Unable to process OTP request.");
    console.error(e);
  }
},

    onOTPChange: function (oEvent) {
      const sValue = oEvent.getParameter("value");
      this.byId("verifyButton").setEnabled(sValue.length === 6);
    },

    // 🔹 Step 2: Verify OTP
    onVerifyOTP: async function () {
      const sOTP = this.byId("otpInput").getValue();

      if (sOTP.length !== 6) {
        MessageBox.error("Please enter a valid 6-digit OTP");
        return;
      }

      try {
        BusyIndicator.show(0);

        const response = await fetch(
          "/odata/v4/authentication/verifyOTP",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              linkToken: this._linkToken,
              otp: sOTP
            })
          }
        );

        const data = await response.json();
        BusyIndicator.hide();

        if (!data.success) {
          MessageBox.error("Invalid OTP. Please try again.");
          return;
        }

        // ✅ Store auth state
        this._setUserAuthenticated(data.employeeId);

        // ✅ Route to employee dashboard
        this.getOwnerComponent()
          .getRouter()
          .navTo("employee", {
            employeeId: data.employeeId
          }, true);

      } catch (e) {
        BusyIndicator.hide();
        MessageBox.error("OTP verification failed.");
        console.error(e);
      }
    },

    onResendOTP: async function () {
      try {
        BusyIndicator.show(0);

        await fetch(
          "/odata/v4/authentication/resendOTP",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linkToken: this._linkToken })
          }
        );

        BusyIndicator.hide();
        MessageToast.show("OTP has been resent.");

      } catch (e) {
        BusyIndicator.hide();
        MessageBox.error("Unable to resend OTP.");
      }
    },

    _setUserAuthenticated: function (sEmployeeId) {
      const oAuthModel = new sap.ui.model.json.JSONModel({
        employeeId: sEmployeeId,
        authenticated: true
      });

      this.getOwnerComponent().setModel(oAuthModel, "currentUser");
    }
  });
});
