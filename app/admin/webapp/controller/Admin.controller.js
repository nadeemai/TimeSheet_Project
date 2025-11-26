sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/Select",
  "sap/ui/core/Item",
  "sap/m/Input",
  "sap/m/DatePicker",
  "sap/m/Button",
  "sap/m/Dialog",
  "sap/m/Text",
  "sap/m/Label",
  "sap/ui/layout/form/SimpleForm",
  "sap/m/ToolbarSpacer",
  "sap/m/Toolbar",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/m/VBox",
  "sap/m/ComboBox",
  "sap/ui/core/BusyIndicator"
], function (Controller, MessageToast, JSONModel, Fragment, MessageBox, Filter, FilterOperator, Select, Item, Input, DatePicker, Button, Dialog, Text, Label, SimpleForm, ToolbarSpacer, Toolbar, ODataModel, VBox, ComboBox, BusyIndicator) {
  "use strict";

  return Controller.extend("admin.controller.Admin", {

    onInit: function () {
      // Initialize main model for UI data
      var oModel = new JSONModel({
        users: [],
        projects: [],
        projectHours: [],
        managerTeams: [],
        projectDurations: [],
        selectedEmployee: "",
        selectedDate: new Date(), // Add selectedDate property for DatePicker
        // Timesheet data
        currentWeekStart: this._getWeekStart(new Date()),
        weekDays: [],
        timesheetEntries: [],
        employeeProjects: [], // Store projects for selected employee
        weekDates: {}, // Add weekDates property for the new onTaskDetailPress function
        // Add overall progress data
        overallProgress: {
          totalBookedHours: 0,
          totalAllocatedHours: 0,
          totalRemainingHours: 0,
          averageUtilization: 0
        }
      });
      this.getView().setModel(oModel);

      // Load initial data from OData services
      this._loadEmployees();
      this._loadProjects();
      this._loadOverallProgress(); // Load overall progress data

      // Initialize timesheet
      this._initializeTimesheet();

      // Restore selected employee from localStorage if available
      var storedEmployeeId = localStorage.getItem("selectedEmployeeId");
      if (storedEmployeeId) {
        oModel.setProperty("/selectedEmployee", storedEmployeeId);
        // Load timesheet for the stored employee immediately
        var weekStart = oModel.getProperty("/currentWeekStart");
        var weekEnd = this._getWeekEnd(weekStart);
        this._loadAdminTimesheetData(storedEmployeeId, weekStart, weekEnd);
      }
    },

    onLogoutPress: function () {
  var that = this;

  // Show confirmation popup
  MessageBox.confirm(
    "Are you sure you want to logout?",
    {
      title: "Confirm Logout",
      icon: MessageBox.Icon.QUESTION,
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,
      onClose: function (sAction) {
        if (sAction === MessageBox.Action.OK) {
          // User confirmed logout
          that._performLogout();
        }
      }
    }
  );
},

// Helper function to perform the actual logout
_performLogout: function () {
  // Show busy indicator
  BusyIndicator.show(0);
  
  try {
    // Clear localStorage (especially the selected employee)
    localStorage.removeItem("selectedEmployeeId");
    localStorage.clear();
    
    // Clear sessionStorage if used
    sessionStorage.clear();
    
    // Reset the model to initial state
    var oModel = this.getView().getModel();
    if (oModel) {
      oModel.setData({
        users: [],
        projects: [],
        projectHours: [],
        managerTeams: [],
        projectDurations: [],
        selectedEmployee: "",
        selectedDate: new Date(),
        currentWeekStart: this._getWeekStart(new Date()),
        weekDays: [],
        timesheetEntries: [],
        employeeProjects: [],
        weekDates: {},
        overallProgress: {
          totalBookedHours: 0,
          totalAllocatedHours: 0,
          totalRemainingHours: 0,
          averageUtilization: 0
        }
      });
    }
    
    // Show success message
    MessageToast.show("Logged out successfully");
    
    // Navigate to login page after a short delay
    var that = this;
    setTimeout(function() {
      // Get router and navigate to login route
      var oRouter = that.getOwnerComponent().getRouter();
      if (oRouter) {
        // Replace the history so user can't go back with browser back button
        oRouter.navTo("RouteLogin", {}, true);
      } else {
        // Fallback: reload the app or redirect to login
        window.location.href = "/index.html";
      }
      BusyIndicator.hide();
    }, 1000);
    
  } catch (error) {
    console.error("Error during logout:", error);
    BusyIndicator.hide();
    MessageToast.show("Error during logout. Please try again.");
  }
},

    onAnalyticsPress: function () {
      var that = this;

      // Create dialog only once
      if (!this._oAnalyticsDialog) {

        // Outer container
        var oContentVBox = new sap.m.VBox({
          items: [

            // Section Header: Progress Reports
            new sap.m.Title({
              text: "Progress Reports:",
              
            }).addStyleClass("sapUiSmallMarginTop sapUiSmallMarginBottom sapUiSmallMarginBegin"),

            // Dynamic project list container
            new sap.m.VBox(this.createId("projectListContainer"))
              .addStyleClass("sapUiSmallMarginBegin sapUiSmallMarginEnd sapUiTinyMarginBottom")
          ]
        });

        // Scroll wrapper
        var oScroll = new sap.m.ScrollContainer({
          width: "100%",
          height: "100%",
          vertical: true,
          content: [oContentVBox]
        });

        // Dialog UI
        this._oAnalyticsDialog = new sap.m.Dialog({
          title: "Project Progress Summary",
          icon: "sap-icon://message-information",
          type: "Message",
          contentWidth: "420px",
          contentHeight: "70vh",
          stretch: sap.ui.Device.system.phone,
          verticalScrolling: false,
          content: [oScroll],
          beginButton: new sap.m.Button({
            text: "OK",
            type: "Emphasized",
            press: function () {
              that._oAnalyticsDialog.close();
            }
          })
        });

        this.getView().addDependent(this._oAnalyticsDialog);
      }

      // Open dialog
      this._oAnalyticsDialog.open();

      // Show loading icon
      var oContainer = this.byId("projectListContainer");
      oContainer.removeAllItems();
      oContainer.addItem(
        new sap.m.BusyIndicator({
          size: "2rem"
        }).addStyleClass("sapUiMediumMargin")
      );

      // Call OData service
      var oModel = this.getOwnerComponent().getModel("adminService");

      oModel.read("/Projects", {
        success: function (oData) {
          var aProjects = oData.results || [];

          oContainer.removeAllItems();

          if (aProjects.length === 0) {
            oContainer.addItem(new sap.m.Text({ text: "No projects found." }));
            return;
          }

          aProjects.forEach(function (oProj, index) {
            var sName = oProj.projectName || "Unnamed Project";
            var sStart = oProj.startDate ?
              new Date(oProj.startDate).toLocaleDateString("en-GB") : "";
            var sEnd = oProj.endDate ?
              new Date(oProj.endDate).toLocaleDateString("en-GB") : "";
            var sStatus = oProj.status || "Draft";
            var iHours = oProj.usedHours || 0;

            // Project block (same style as screenshot)
            var oBlock = new sap.m.VBox({
              items: [
                new sap.m.Title({
                  text: "Project: " + sName,
                  level: "H6"
                }).addStyleClass("sapUiTinyMarginBottom"),

                new sap.m.FormattedText({
                  htmlText:
                    "<strong>Total Hours Worked:</strong> " + iHours + "<br>" +
                    "<strong>Start Date:</strong> " + sStart + "<br>" +
                    "<strong>End Date:</strong> " + sEnd + "<br>" +
                    "<strong>Status:</strong> " + sStatus
                })
              ]
            }).addStyleClass("sapUiSmallMarginBottom sapUiTinyMarginBeginEnd");

            oContainer.addItem(oBlock);

            // Separator (except after last item)
            if (index < aProjects.length - 1) {
              oContainer.addItem(
                new sap.m.HBox({
                  height: "1px"
                }).addStyleClass("separatorLine")
              );
            }
          });
        },

        error: function () {
          oContainer.removeAllItems();
          oContainer.addItem(
            new sap.m.MessageStrip({
              text: "Failed to load project data.",
              type: "Error",
              showIcon: true
            })
          );
        }
      });
    },


    // ------------------------------------------------------------------
    // 2. Notification Button → Show all Notifications from /Notifications
    // ------------------------------------------------------------------
    onNotificationPress: function () {
      if (!this._oNotificationDialog) {
        this._oNotificationDialog = new sap.m.Dialog({
          title: "Notifications",
          contentWidth: "80%",
          contentHeight: "75vh",
          stretch: sap.ui.Device.system.phone,
          content: new sap.m.List({
            id: this.createId("notificationList"),
            noDataText: "No notifications found",
            mode: sap.m.ListMode.None,
            items: {
              path: "/notifications",
              template: new sap.m.StandardListItem({
                title: "{title}",
                description: "{message}",
                info: "{createdAt}",
                infoState: "{= ${read} ? 'Success' : 'Warning' }",
                icon: "{= ${read} ? 'sap-icon://message-success' : 'sap-icon://message-information' }"
              })
            }
          }),
          beginButton: new sap.m.Button({
            text: "Close",
            press: function () {
              this._oNotificationDialog.close();
            }.bind(this)
          }),
          afterClose: function () {
            // keep data – will be refreshed on next open
          }
        });

        this.getView().addDependent(this._oNotificationDialog);
      }

      // Show + busy
      this._oNotificationDialog.open();
      this.byId("notificationList").setBusy(true);

      var oODataModel = this.getOwnerComponent().getModel("adminService");

      oODataModel.read("/Notifications", {
        success: function (oData) {
          var aNotifications = oData.results || oData.value || [];

          // Sort newest first
          aNotifications.sort(function (a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });

          // Optional: format date nicely
          aNotifications.forEach(function (n) {
            if (n.createdAt) {
              var oDate = new Date(n.createdAt);
              n.createdAt = oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            n.title = n.title || "Notification";
            n.message = n.message || "";
            n.read = n.read === true;
          });

          var oJSONModel = new sap.ui.model.json.JSONModel({ notifications: aNotifications });
          this.byId("notificationList").setModel(oJSONModel);
          this.byId("notificationList").setBusy(false);
        }.bind(this),
        error: function (oError) {
          this.byId("notificationList").setBusy(false);
          sap.m.MessageToast.show("Error loading Notifications: " + (oError.message || "Unknown error"));
        }.bind(this)
      });
    },

  _loadOverallProgress: function () {
  var oModel = this.getOwnerComponent().getModel("adminService");
  var oViewModel = this.getView().getModel();

  BusyIndicator.show(0);

  oModel.read("/OverallProgressReport", {
    success: function (oData) {
      BusyIndicator.hide();

      var aEntries = oData.results || [];
      var oProjectMap = {};  // To remove duplicates & group by project

      aEntries.forEach(function (oItem) {
        var sProjectId = oItem.projectID || "unknown";
        var sProjectName = oItem.projectName || "Unknown Project";

        var nAllocated = parseFloat(oItem.allocatedHours) || 0;
        var nBookedRaw = parseFloat(oItem.totalBookedHours) || 0;

        // CRITICAL: Your backend returns "1.00" for draft/no real booking → show as 0
        var nBooked = (nBookedRaw >= 2) ? Math.round(nBookedRaw) : 0;
        var nRemaining = nAllocated - nBooked;

        // Keep only the entry with highest allocated hours per project (eliminates duplicates)
        if (!oProjectMap[sProjectId] || nAllocated > (oProjectMap[sProjectId].allocatedHours || 0)) {
          oProjectMap[sProjectId] = {
            project: sProjectName,  // This binds to the "Project" column in the table
            allocatedHours: nAllocated,
            bookedHours: nBooked,
            remainingHours: nRemaining > 0 ? nRemaining : 0,
            // Including additional fields from the endpoint that might be needed
            projectID: sProjectId,
            activityName: oItem.activityName,
            budget: oItem.budget,
            employeeID: oItem.employeeID,
            employeeName: oItem.employeeName,
            managerID: oItem.managerID,
            managerName: oItem.managerName,
            status: oItem.status,
            task: oItem.task
          };
        }
      });

      // Convert map → array
      var aProjectHours = Object.keys(oProjectMap).map(function (key) {
        return oProjectMap[key];
      });

      // Sort alphabetically by project name (exact match to your UI)
      aProjectHours.sort(function (a, b) {
        return a.project.localeCompare(b.project);
      });

      // Bind to table
      oViewModel.setProperty("/projectHours", aProjectHours);

      // Calculate overall totals
      var nTotalAllocated = aProjectHours.reduce((sum, p) => sum + p.allocatedHours, 0);
      var nTotalBooked = aProjectHours.reduce((sum, p) => sum + p.bookedHours, 0);
      var nTotalRemaining = nTotalAllocated - nTotalBooked;
      var nAvgUtilization = nTotalAllocated > 0 ? Math.round((nTotalBooked / nTotalAllocated) * 100) : 0;

      oViewModel.setProperty("/overallProgress", {
        totalAllocatedHours: nTotalAllocated,
        totalBookedHours: nTotalBooked,
        totalRemainingHours: nTotalRemaining,
        averageUtilization: nAvgUtilization
      });

      oViewModel.refresh(true);
    },

    error: function (oError) {
      BusyIndicator.hide();
      console.error("Error loading OverallProgressReport:", oError);
      MessageToast.show("Failed to load project analytics data");

      oViewModel.setProperty("/projectHours", []);
      oViewModel.setProperty("/overallProgress", {
        totalAllocatedHours: 0,
        totalBookedHours: 0,
        totalRemainingHours: 0,
        averageUtilization: 0
      });
    }
  });
},

    // Replace the existing onTaskDetailPress with this improved version
    onTaskDetailPress: function (oEvent) {
      try {
        var oButton = oEvent.getSource();
        var oBindingContext = oButton.getBindingContext();

        if (!oBindingContext) {
          sap.m.MessageToast.show("Unable to get binding context");
          return;
        }

        var oEntry = oBindingContext.getObject();
        var oModel = this.getView().getModel();
        var oWeekDates = this._getWeekDates(); // Get week dates from model

        if (!oWeekDates) {
          sap.m.MessageToast.show("Week dates not available");
          return;
        }

        // Ensure dailyComments exists
        oEntry.dailyComments = oEntry.dailyComments || {};

        var that = this; // if needed inside controller

        var aDays = [
          { name: "Monday", hours: oEntry.monday || 0, comment: oEntry.mondayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.monday) },
          { name: "Tuesday", hours: oEntry.tuesday || 0, comment: oEntry.tuesdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.tuesday) },
          { name: "Wednesday", hours: oEntry.wednesday || 0, comment: oEntry.wednesdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.wednesday) },
          { name: "Thursday", hours: oEntry.thursday || 0, comment: oEntry.thursdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.thursday) },
          { name: "Friday", hours: oEntry.friday || 0, comment: oEntry.fridayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.friday) },
          { name: "Saturday", hours: oEntry.saturday || 0, comment: oEntry.saturdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.saturday) },
          { name: "Sunday", hours: oEntry.sunday || 0, comment: oEntry.sundayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.sunday) }
        ];

        var getHoursColorClass = function (hours) {
          if (hours === 0) {
            return "tsHoursRed";      // red
          } else if (hours > 0 && hours < 8) {
            return "tsHoursOrange";   // orange
          } else if (hours >= 8 && hours <= 15) {
            return "tsHoursGreen";    // green
          }
          return ""; // default no class
        };

        var aItems = aDays.map(function (oDay, index) {
          return new sap.m.VBox({
            width: "100%",
            items: [
              new sap.m.HBox({
                justifyContent: "SpaceBetween",
                items: [
                  new sap.m.Text({
                    text: `${oDay.name} (${oDay.date})`,
                    design: "Bold"
                  }),
                  new sap.m.Text({
                    text: `${oDay.hours.toFixed(2)} hrs`,
                    design: "Bold"
                  })
                    .addStyleClass(getHoursColorClass(oDay.hours))
                ]
              }).addStyleClass("tsDayHeader"),

              new sap.m.Text({
                text: oDay.comment,
                wrapping: true
              }).addStyleClass("tsDayComment"),

              ...(index < aDays.length - 1 ? [
                new sap.m.HBox({
                  height: "1px",
                  class: "tsSeparator"
                })
              ] : [])
            ]
          }).addStyleClass("tsDayCard");
        });

        // Create a dialog with a custom style class to match the image
        var oDialog = new sap.m.Dialog({
          title: "Week Task Details",
          contentWidth: "320px",  // adjusted width to match image
          contentHeight: "70vh",  // max height of dialog
          stretchOnPhone: true,
          content: new sap.m.VBox({
            items: aItems,
            class: "sapUiResponsiveMargin"
          }),
          endButton: new sap.m.Button({
            text: "Close",
            press: function () { oDialog.close(); }
          }),
          afterClose: function () { oDialog.destroy(); }
        });

        // Add custom CSS styles to match the image exactly
        var sCustomCSS = `
      .tsDayCard {
        margin-bottom: 12px;
        padding: 12px;
        border-radius: 6px;
        background-color: #f8f9fa;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      
      .tsDayHeader {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .tsDayComment {
        margin-top: 8px;
        color: #555;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .tsSeparator {
        margin: 12px 0;
        background-color: #e0e0e0;
        width: 100%;
      }
      
      .tsHoursRed {
        color: #e74c3c;
        font-weight: bold;
      }
      
      .tsHoursOrange {
        color: #f39c12;
        font-weight: bold;
      }
      
      .tsHoursGreen {
        color: #27ae60;
        font-weight: bold;
      }
    `;

        // Create a style element and append it to the head if it doesn't exist
        if (!document.getElementById('taskDetailStyles')) {
          var oStyle = document.createElement('style');
          oStyle.id = 'taskDetailStyles';
          oStyle.innerHTML = sCustomCSS;
          document.head.appendChild(oStyle);
        }

        this.getView().addDependent(oDialog);
        oDialog.open();

      } catch (oError) {
        console.error("Error in onTaskDetailPress:", oError);
      }
    },

    // Helper function to format date for display
    _formatDateForDisplay: function (date) {
      if (!date) return "";
      var oDate = new Date(date);
      var options = { month: 'short', day: 'numeric', year: 'numeric' };
      return oDate.toLocaleDateString('en-US', options);
    },

    // Helper function to get week dates
    _getWeekDates: function () {
      var oModel = this.getView().getModel();
      var currentWeekStart = new Date(oModel.getProperty("/currentWeekStart"));

      var weekDates = {
        monday: new Date(currentWeekStart),
        tuesday: new Date(currentWeekStart),
        wednesday: new Date(currentWeekStart),
        thursday: new Date(currentWeekStart),
        friday: new Date(currentWeekStart),
        saturday: new Date(currentWeekStart),
        sunday: new Date(currentWeekStart)
      };

      // Set each day of the week
      weekDates.tuesday.setDate(weekDates.tuesday.getDate() + 1);
      weekDates.wednesday.setDate(weekDates.wednesday.getDate() + 2);
      weekDates.thursday.setDate(weekDates.thursday.getDate() + 3);
      weekDates.friday.setDate(weekDates.friday.getDate() + 4);
      weekDates.saturday.setDate(weekDates.saturday.getDate() + 5);
      weekDates.sunday.setDate(weekDates.sunday.getDate() + 6);

      return weekDates;
    },

    // Initialize timesheet with week days
    _initializeTimesheet: function () {
      let oModel = this.getView().getModel();
      let currentWeekStart = new Date(oModel.getProperty("/currentWeekStart"));

      // 1️⃣ Generate week days
      let weekDays = [];
      for (let i = 0; i < 7; i++) {
        let date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        weekDays.push(this._formatDay(date));
      }
      oModel.setProperty("/weekDays", weekDays);

      // 2️⃣ Compute weekEnd
      let weekEnd = this._getWeekEnd(currentWeekStart);

      // 3️⃣ If an employee is already selected, load their data
      let selectedEmployee = oModel.getProperty("/selectedEmployee");

      if (selectedEmployee) {
        console.log("Loading timesheet for employee:", selectedEmployee);
        this._loadAdminTimesheetData(selectedEmployee, currentWeekStart, weekEnd);
      }
    },

    // Format day for display
    _formatDay: function (date) {
      var options = { month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    },

    // Get the start of the week (Monday)
    _getWeekStart: function (date) {
      var d = new Date(date);
      var day = d.getDay();
      var diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    },

    _loadAdminTimesheetData: function (employeeId, weekStart, weekEnd) {
      let oModel = this.getOwnerComponent().getModel("adminService");
      let that = this;
      let oViewModel = this.getView().getModel();

      // Show loading indicator
      BusyIndicator.show(0);

      // Normalize dates for comparison
      let normalizeDate = (date) => {
        if (!date) return "";
        return new Date(date).toISOString().split('T')[0];
      };

      let weekStartStr = normalizeDate(weekStart);
      let weekEndStr = normalizeDate(weekEnd);

      console.log("Loading timesheet data:", {
        employeeId,
        weekStart: weekStartStr,
        weekEnd: weekEndStr
      });

      // Create filters for employee and date range
      let aFilters = [
        new Filter("employeeEmpID", FilterOperator.EQ, employeeId),
        new Filter("weekStartDate", FilterOperator.LE, weekEndStr),
        new Filter("weekEndDate", FilterOperator.GE, weekStartStr)
      ];

      oModel.read("/Timesheets", {
        filters: aFilters,
        success: function (oData) {
          let allResults = oData.results || [];

          // Filter by employee and date range
          let employeeEntries = allResults.filter(item => {
            // Check if employee matches
            if (item.employeeEmpID !== employeeId) {
              return false;
            }

            // Check if the timesheet entry falls within the selected week
            let entryWeekStart = normalizeDate(item.weekStartDate);
            let entryWeekEnd = normalizeDate(item.weekEndDate);

            // Check if the entry's week overlaps with the selected week
            return entryWeekStart <= weekEndStr && entryWeekEnd >= weekStartStr;
          });

          console.log("Filtered entries:", employeeEntries);

          // Format table structure
          let formatted = that._formatAdminTimesheet(employeeEntries);

          // Bind table data
          oViewModel.setProperty("/timesheetEntries", formatted);

          // Weekly total
          let totalWeekHours = formatted.reduce((sum, row) => sum + row.totalHours, 0);
          oViewModel.setProperty("/totalWeekHours", totalWeekHours);

          console.log("Filtered Week Data", formatted);

          // Hide loading indicator
          BusyIndicator.hide();
        },
        error: function (oError) {
          console.error("Error loading timesheet data:", oError);
          MessageToast.show("Error loading timesheet data");
          BusyIndicator.hide();
        }
      });
    },

    _formatAdminTimesheet: function (entries) {
      return entries.map(item => {
        // Choose correct name
        let finalProjectName =
          item.projectName && item.projectName.trim() !== ""
            ? item.projectName
            : (item.nonProjectTypeName || "Non-Project");

        // Convert hours to number (avoid strings like "7.00")
        const num = v => (v ? parseFloat(v) : 0);

        return {
          project: finalProjectName,
          task: item.task || "",
          taskDetails: item.taskDetails || "",
          mondayTaskDetails: item.mondayTaskDetails || "",
          tuesdayTaskDetails: item.tuesdayTaskDetails || "",
          wednesdayTaskDetails: item.wednesdayTaskDetails || "",
          thursdayTaskDetails: item.thursdayTaskDetails || "",
          fridayTaskDetails: item.fridayTaskDetails || "",
          saturdayTaskDetails: item.saturdayTaskDetails || "",
          sundayTaskDetails: item.sundayTaskDetails || "",

          monday: num(item.mondayHours),
          tuesday: num(item.tuesdayHours),
          wednesday: num(item.wednesdayHours),
          thursday: num(item.thursdayHours),
          friday: num(item.fridayHours),
          saturday: num(item.saturdayHours),
          sunday: num(item.sundayHours),

          totalHours:
            num(item.mondayHours) +
            num(item.tuesdayHours) +
            num(item.wednesdayHours) +
            num(item.thursdayHours) +
            num(item.fridayHours) +
            num(item.saturdayHours) +
            num(item.sundayHours)
        };
      });
    },

    // Load timesheet entries from backend
    _loadTimesheetEntriesFromBackend: function (employeeId) {
      var oModel = this.getView().getModel();
      var that = this;
      var currentWeekStart = oModel.getProperty("/currentWeekStart");

      // Format dates for OData query
      var weekStartStr = this._formatDateForOData(currentWeekStart);
      var weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      var weekEndStr = this._formatDateForOData(weekEnd);

      // Query timesheet entries for the employee and week
      var oDataModel = this.getOwnerComponent().getModel("adminService");
      var aFilters = [
        new Filter("employeeID", FilterOperator.EQ, employeeId),
        new Filter("date", FilterOperator.BT, weekStartStr, weekEndStr)
      ];

      oDataModel.read("/Timesheets", {
        filters: aFilters,
        success: function (oData) {
          var aTimesheets = oData.results || [];
          var aEmployeeProjects = oModel.getProperty("/employeeProjects") || [];
          var aTimesheetEntries = [];

          // Create a map of existing timesheet entries by project
          var timesheetMap = {};
          aTimesheets.forEach(function (timesheet) {
            var projectId = timesheet.projectID;
            if (!timesheetMap[projectId]) {
              timesheetMap[projectId] = {
                projectId: projectId,
                project: timesheet.projectName || "",
                task: timesheet.task || "General",
                taskDetails: timesheet.taskDetails || "",
                monday: "0.00",
                tuesday: "0.00",
                wednesday: "0.00",
                thursday: "0.00",
                friday: "0.00",
                saturday: "0.00",
                sunday: "0.00",
                totalHours: "0.00"
              };
            }

            // Add hours for the specific day
            var date = new Date(timesheet.date);
            var dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
            var dayName = that._getDayName(dayOfWeek);

            if (dayName && timesheet.hours) {
              timesheetMap[projectId][dayName] = parseFloat(timesheet.hours).toFixed(2);
            }
          });

          // Calculate total hours for each project
          Object.keys(timesheetMap).forEach(function (projectId) {
            var entry = timesheetMap[projectId];
            var totalHours = 0;
            var days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

            for (var i = 0; i < days.length; i++) {
              var hours = parseFloat(entry[days[i]]) || 0;
              totalHours += hours;
            }

            entry.totalHours = totalHours.toFixed(2);
            aTimesheetEntries.push(entry);
          });

          // Add entries for projects that don't have timesheet data yet
          aEmployeeProjects.forEach(function (project) {
            if (!timesheetMap[project.projectId]) {
              aTimesheetEntries.push({
                projectId: project.projectId,
                project: project.name,
                task: "General",
                taskDetails: "Work on " + project.name,
                monday: "0.00",
                tuesday: "0.00",
                wednesday: "0.00",
                thursday: "0.00",
                friday: "0.00",
                saturday: "0.00",
                sunday: "0.00",
                totalHours: "0.00"
              });
            }
          });

          oModel.setProperty("/timesheetEntries", aTimesheetEntries);
        },
        error: function (oError) {
          console.error("Error loading timesheet entries:", oError);
          MessageToast.show("Error loading timesheet data");

          // Fallback to creating empty entries if backend fails
          var aEmployeeProjects = oModel.getProperty("/employeeProjects") || [];
          var aTimesheetEntries = [];

          aEmployeeProjects.forEach(function (project) {
            aTimesheetEntries.push({
              projectId: project.projectId,
              project: project.name,
              task: "General",
              taskDetails: "Work on " + project.name,
              monday: "0.00",
              tuesday: "0.00",
              wednesday: "0.00",
              thursday: "0.00",
              friday: "0.00",
              saturday: "0.00",
              sunday: "0.00",
              totalHours: "0.00"
            });
          });

          oModel.setProperty("/timesheetEntries", aTimesheetEntries);
        }
      });
    },

    // Format date for OData query
    _formatDateForOData: function (date) {
      var month = (date.getMonth() + 1).toString().padStart(2, '0');
      var day = date.getDate().toString().padStart(2, '0');
      return date.getFullYear() + "-" + month + "-" + day;
    },

    // Get day name from day number
    _getDayName: function (dayNumber) {
      // Convert day number (0=Sunday, 1=Monday, etc.) to property name
      switch (dayNumber) {
        case 1: return "monday";
        case 2: return "tuesday";
        case 3: return "wednesday";
        case 4: return "thursday";
        case 5: return "friday";
        case 6: return "saturday";
        case 0: return "sunday";
        default: return null;
      }
    },

    // Load projects assigned to a specific employee
    _loadEmployeeProjects: function (employeeId) {
      var oModel = this.getView().getModel();
      var allProjects = oModel.getProperty("/projects") || [];

      // Filter projects where the employee is the project owner or team member
      var employeeProjects = allProjects.filter(function (project) {
        return project.managerId === employeeId ||
          (project.teamMembers && project.teamMembers.includes(employeeId));
      });

      oModel.setProperty("/employeeProjects", employeeProjects);
    },

    // Handle employee selection change - Updated to handle Enter key
    onEmployeeChange: function (oEvent) {
      let oViewModel = this.getView().getModel();

      // 1️ get selected employee id
      let employeeId = oEvent.getParameter("selectedItem") ?
        oEvent.getParameter("selectedItem").getKey() :
        oEvent.getSource().getSelectedKey();

      // 2️store selected employee in model and localStorage
      oViewModel.setProperty("/selectedEmployee", employeeId);
      localStorage.setItem("selectedEmployeeId", employeeId); // Store for persistence

      let weekStart = oViewModel.getProperty("/currentWeekStart");

      // 5️⃣ Compute week end (weekStart + 6 days)
      let weekEnd = this._getWeekEnd(weekStart);
      // 3️⃣ clear old rows
      oViewModel.setProperty("/timesheetEntries", []);
      oViewModel.setProperty("/totalWeekHours", 0);

      this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
    },

    _getWeekEnd: function (weekStart) {
      let end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return end;
    },

    // Handle hours input change - Updated to match the first image
    // Handle hours input change - Updated to match the first image with non-editable fields
    onHourButtonPress: function (oEvent) {
      try {
        var oButton = oEvent.getSource();
        var oBindingContext = oButton.getBindingContext();

        if (!oBindingContext) {
          sap.m.MessageToast.show("Unable to get binding context");
          return;
        }

        var oEntry = oBindingContext.getObject();
        var oModel = this.getView().getModel();
        var aWeekDays = oModel.getProperty("/weekDays") || [];

        // Get the day from the button's custom data
        var sDay = oButton.data("day");
        if (!sDay) {
          // Try to extract day from binding path or other source
          var sBindingPath = oButton.getBindingPath("text");
          if (sBindingPath) {
            sDay = sBindingPath.toLowerCase();
          } else {
            sap.m.MessageToast.show("Unable to determine day");
            return;
          }
        }

        // Get the date for the specific day
        var iDayIndex = this._getDayIndex(sDay);
        var sDate = aWeekDays[iDayIndex] || this._getDefaultDate(iDayIndex);

        // Get current hours for the day
        var fCurrentHours = oEntry[sDay] || 0;

        // Get week dates for proper date formatting
        var oWeekDates = this._getWeekDates();
        var sFormattedDate = this._formatDateForDisplay(oWeekDates[sDay]);

        // Create or reuse dialog
        if (!this._oHourEditDialog) {
          // Create hour options for dropdown (0-15 hours)
          var aHourOptions = [];
          for (var i = 0; i <= 15; i++) {
            aHourOptions.push(new sap.ui.core.Item({
              key: i.toString(),
              text: i + " hour" + (i !== 1 ? "s" : "")
            }));
          }

          this._oHourEditDialog = new sap.m.Dialog({
            title: "Edit " + this._capitalize(sDay) + " Entry",
            contentWidth: "350px",
            titleAlignment: "Center",
            content: [
              new sap.m.VBox({
                items: [
                  // Date Field - NON-EDITABLE
                  new sap.m.VBox({
                    items: [
                      new sap.m.Label({
                        text: "Date:",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new sap.m.Input({
                        value: "{/editData/date}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),

                  // Project Field - NON-EDITABLE
                  new sap.m.VBox({
                    items: [
                      new sap.m.Label({
                        text: "Project:",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new sap.m.Input({
                        value: "{/editData/projectName}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),

                  // Task Type Field - NON-EDITABLE
                  new sap.m.VBox({
                    items: [
                      new sap.m.Label({
                        text: "Task",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new sap.m.Input({
                        value: "{/editData/taskType}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),

                  // Hours Field - NON-EDITABLE
                  new sap.m.VBox({
                    items: [
                      new sap.m.Label({
                        text: "Hours:",
                        design: "Bold",
                        required: true
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new sap.m.Input({
                        value: "{/editData/hours}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),

                  // Task Details Field - NON-EDITABLE
                  new sap.m.VBox({
                    items: [
                      new sap.m.Label({
                        text: "Task Details:",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new sap.m.TextArea({
                        value: "{/editData/taskDetails}",
                        rows: 4,
                        width: "100%",
                        editable: false
                      })
                    ]
                  })
                ]
              }).addStyleClass("sapUiMediumMarginBeginEnd sapUiSmallMarginTopBottom")
            ],
            beginButton: new sap.m.Button({
              text: "Close",
              type: "Emphasized",
              press: function () {
                this._oHourEditDialog.close();
              }.bind(this)
            })
          });

          this.getView().addDependent(this._oHourEditDialog);
        }

        // Get available projects for display
        var aProjects = oModel.getProperty("/projects") || [];

        // Find the current project name
        var sProjectName = oEntry.project || "";
        if (oEntry.projectId) {
          var oCurrentProject = aProjects.find(function (project) {
            return (project.projectId === oEntry.projectId) || (project.ID === oEntry.projectId);
          });
          if (oCurrentProject) {
            sProjectName = oCurrentProject.name || oCurrentProject.projectName;
          }
        }

        // Get day-specific task details from the entry
        var sDayTaskDetailsField = sDay + "TaskDetails";
        var sTaskDetails = oEntry[sDayTaskDetailsField] || oEntry.taskDetails || "";

        // Set up edit data model with real data from backend
        var oEditModel = new sap.ui.model.json.JSONModel({
          editData: {
            // Entry identification
            entryIndex: oBindingContext.getPath().split("/")[2],
            entryId: oEntry.ID,
            day: sDay,
            dayName: this._getDayDisplayName(sDay),
            date: sFormattedDate, // Use properly formatted date

            // Form fields with real data from backend
            projectName: sProjectName,
            projectId: oEntry.projectId,
            taskType: oEntry.task || "", // Get task type from backend
            hours: fCurrentHours > 0 ? fCurrentHours.toString() : "0", // Use actual hours from backend
            taskDetails: sTaskDetails // Use actual task details from backend
          }
        });

        this._oHourEditDialog.setModel(oEditModel);

        // Update dialog title with actual day name
        var sDayName = this._getDayDisplayName(sDay);
        this._oHourEditDialog.setTitle("Edit " + sDayName + " Entry");

        this._oHourEditDialog.open();

      } catch (oError) {
        console.error("Error in onHourButtonPress:", oError);
        sap.m.MessageToast.show("Error opening edit dialog");
      }
    },

    // Helper function to validate hours input
    _validateHours: function (oEvent) {
      var sValue = oEvent.getSource().getValue();
      var oDialogModel = this._oHourEditDialog.getModel();
      var oEditData = oDialogModel.getProperty("/editData");

      // Validate hours
      if (sValue === "" || sValue === null || sValue === undefined) {
        oEditData.hoursState = "Error";
      } else {
        var fHours = parseFloat(sValue);
        if (isNaN(fHours) || fHours < 0 || fHours > 24) {
          oEditData.hoursState = "Error";
        } else {
          oEditData.hoursState = "None";
        }
      }

      oDialogModel.setProperty("/editData", oEditData);
    },

    // Helper function to save the hour entry - Updated to save day-specific task details
    _saveHourEntry: function () {
      try {
        var oDialogModel = this._oHourEditDialog.getModel();
        var oEditData = oDialogModel.getProperty("/editData");

        // Validate hours
        if (oEditData.hoursState === "Error" || !oEditData.hours || isNaN(oEditData.hours)) {
          sap.m.MessageToast.show("Please enter valid hours between 0 and 24");
          return;
        }

        var fHours = parseFloat(oEditData.hours);
        if (fHours < 0 || fHours > 24) {
          sap.m.MessageToast.show("Hours must be between 0 and 24");
          return;
        }

        // Update the main model
        var oMainModel = this.getView().getModel();
        var aTimesheetEntries = oMainModel.getProperty("/timesheetEntries");

        // Find the entry to update
        var oEntryToUpdate = aTimesheetEntries[oEditData.entryIndex];
        if (!oEntryToUpdate) {
          sap.m.MessageToast.show("Error: Entry not found");
          return;
        }

        // Update the specific day's hours
        oEntryToUpdate[oEditData.day] = fHours;

        // Update day-specific task details
        var sDayTaskDetailsField = oEditData.day + "TaskDetails";
        oEntryToUpdate[sDayTaskDetailsField] = oEditData.taskDetails;

        // Update other fields
        oEntryToUpdate.task = oEditData.taskType;
        oEntryToUpdate.taskDetails = oEditData.taskDetails;

        // Recalculate total hours
        var totalHours = 0;
        var days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

        for (var i = 0; i < days.length; i++) {
          var hours = parseFloat(oEntryToUpdate[days[i]]) || 0;
          totalHours += hours;
        }

        oEntryToUpdate.totalHours = totalHours.toFixed(2);

        // Update the main model
        oMainModel.setProperty("/timesheetEntries", aTimesheetEntries);

        sap.m.MessageToast.show(oEditData.dayName + " entry updated successfully");

        // Close dialog
        this._oHourEditDialog.close();

        // Optional: Trigger backend save
        this._saveTimesheetToBackend();

      } catch (oError) {
        console.error("Error saving hour entry:", oError);
        sap.m.MessageToast.show("Error saving entry");
      }
    },

    // Helper function to capitalize first letter
    _capitalize: function (sString) {
      if (!sString) return "";
      return sString.charAt(0).toUpperCase() + sString.slice(1);
    },

    // Helper function to get day index
    _getDayIndex: function (sDay) {
      var dayMap = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
      };
      return dayMap[sDay] || 0;
    },

    // Helper function to get display name for day
    _getDayDisplayName: function (sDay) {
      var dayNames = {
        "monday": "Monday",
        "tuesday": "Tuesday",
        "wednesday": "Wednesday",
        "thursday": "Thursday",
        "friday": "Friday",
        "saturday": "Saturday",
        "sunday": "Sunday"
      };
      return dayNames[sDay] || "Day";
    },

    // Helper function for default dates
    _getDefaultDate: function (iIndex) {
      var defaultDates = ["Nov 17", "Nov 18", "Nov 19", "Nov 20", "Nov 21", "Nov 22", "Nov 23"];
      return defaultDates[iIndex] || "Unknown Date";
    },

    // Navigate to previous week
    onPreviousWeek: function () {
      let oModel = this.getView().getModel();

      // 1️⃣ Get current week start
      let currentWeekStart = new Date(oModel.getProperty("/currentWeekStart"));

      if (isNaN(currentWeekStart)) {
        console.error("Invalid week start:", oModel.getProperty("/currentWeekStart"));
        return;
      }

      // 2️⃣ Move week start back by 7 days
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);

      // 3️⃣ Save the updated week start
      oModel.setProperty("/currentWeekStart", currentWeekStart);

      // Update the selectedDate in the DatePicker to match the week start
      oModel.setProperty("/selectedDate", currentWeekStart);

      // 4️⃣ Compute clean weekStart & weekEnd
      let weekStart = new Date(currentWeekStart);
      let weekEnd = this._getWeekEnd(weekStart);

      // 5️⃣ Update week days UI
      this._updateWeekDays(weekStart);

      // 6️⃣ Load Timesheet Records for this week
      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      }
    },

    // Navigate to current week
    onCurrentWeek: function () {
      let oModel = this.getView().getModel();

      let weekStart = this._getWeekStart(new Date());
      oModel.setProperty("/currentWeekStart", weekStart);

      // Update the selectedDate in the DatePicker to match the current week
      oModel.setProperty("/selectedDate", weekStart);

      let weekEnd = this._getWeekEnd(weekStart);
      this._updateWeekDays(weekStart);

      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      }
    },

    onNextWeek: function () {
      let oModel = this.getView().getModel();

      // 1️⃣ Get current week start
      let currentWeekStart = new Date(oModel.getProperty("/currentWeekStart"));

      if (isNaN(currentWeekStart)) {
        console.error("Invalid week start:", oModel.getProperty("/currentWeekStart"));
        return;
      }

      // 2️⃣ Move week start back by 7 days
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);

      // 3️⃣ Save the updated week start
      oModel.setProperty("/currentWeekStart", currentWeekStart);

      // Update the selectedDate in the DatePicker to match the week start
      oModel.setProperty("/selectedDate", currentWeekStart);

      // 4️⃣ Compute clean weekStart & weekEnd
      let weekStart = new Date(currentWeekStart);
      let weekEnd = this._getWeekEnd(weekStart);

      // 5️⃣ Update week days UI
      this._updateWeekDays(weekStart);

      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      }
    },

    // CORRECTED: DatePicker change function with proper week filtering
    onDatePickerChange: function (oEvent) {
      BusyIndicator.show(0);

      let selectedDate = oEvent.getParameter("value");
      if (!selectedDate) {
        BusyIndicator.hide();
        return;
      }

      // Parse the date string to a Date object
      let dateValue = new Date(selectedDate);
      if (isNaN(dateValue.getTime())) {
        BusyIndicator.hide();
        return;
      }

      let oModel = this.getView().getModel();

      // Calculate Monday (start of week)
      let weekStart = this._getWeekStart(dateValue);

      // Save weekStart in model
      oModel.setProperty("/currentWeekStart", weekStart);

      // Also update the selectedDate to maintain the DatePicker value
      oModel.setProperty("/selectedDate", dateValue);

      // Update week days label UI
      this._updateWeekDays(weekStart);

      // Compute week end
      let weekEnd = this._getWeekEnd(weekStart);

      console.log("DatePicker changed:", {
        selectedDate: selectedDate,
        dateValue: dateValue,
        weekStart: weekStart,
        weekEnd: weekEnd,
        formattedWeekStart: this._formatDateForOData(weekStart),
        formattedWeekEnd: this._formatDateForOData(weekEnd)
      });

      // Load time entries for the selected employee
      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      } else {
        MessageToast.show("Please select an employee first");
      }

      BusyIndicator.hide();
    },

    _updateWeekDays: function (weekStart) {
      let oModel = this.getView().getModel();
      let start = new Date(weekStart);

      let days = [];
      for (let i = 0; i < 7; i++) {
        let d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(this._formatDay(d));
      }

      oModel.setProperty("/weekDays", days);
    },

    // Record time - Save timesheet to backend
    onRecordTime: function () {
      var oModel = this.getView().getModel();
      var selectedEmployee = oModel.getProperty("/selectedEmployee");
      var timesheetEntries = oModel.getProperty("/timesheetEntries");
      var currentWeekStart = oModel.getProperty("/currentWeekStart");

      if (!selectedEmployee) {
        MessageToast.show("Please select an employee first");
        return;
      }

      // Save timesheet data to backend
      this._saveTimesheetToBackend(selectedEmployee, timesheetEntries, currentWeekStart);
    },

    // Save timesheet data to backend
    _saveTimesheetToBackend: function (employeeId, timesheetEntries, weekStart) {
      var oDataModel = this.getOwnerComponent().getModel("adminService");
      var that = this;

      // First, delete existing timesheet entries for this employee and week
      var weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      var weekStartStr = this._formatDateForOData(weekStart);
      var weekEndStr = this._formatDateForOData(weekEnd);

      var aFilters = [
        new Filter("employeeID", FilterOperator.EQ, employeeId),
        new Filter("date", FilterOperator.BT, weekStartStr, weekEndStr)
      ];

      // Read existing entries to delete them
      oDataModel.read("/Timesheets", {
        filters: aFilters,
        success: function (oData) {
          var aExistingEntries = oData.results || [];
          var deletePromises = [];

          // Delete existing entries
          aExistingEntries.forEach(function (entry) {
            var deletePromise = new Promise(function (resolve, reject) {
              oDataModel.remove("/Timesheets('" + entry.ID + "')", {
                success: resolve,
                error: reject
              });
            });
            deletePromises.push(deletePromise);
          });

          // After all deletions are complete, create new entries
          Promise.all(deletePromises).then(function () {
            var createPromises = [];
            var days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

            // Create new timesheet entries
            timesheetEntries.forEach(function (entry) {
              days.forEach(function (day, index) {
                var hours = parseFloat(entry[day]) || 0;
                if (hours > 0) {
                  var date = new Date(weekStart);
                  date.setDate(date.getDate() + index);

                  var timesheetData = {
                    employeeID: employeeId,
                    projectID: entry.projectId,
                    projectName: entry.project,
                    task: entry.task,
                    taskDetails: entry[day + "TaskDetails"] || entry.taskDetails || "",
                    date: that._formatDateForOData(date),
                    hours: hours,
                    weekStartDate: weekStartStr,
                    weekEndDate: weekEndStr
                  };

                  var createPromise = new Promise(function (resolve, reject) {
                    oDataModel.create("/Timesheets", timesheetData, {
                      success: resolve,
                      error: reject
                    });
                  });
                  createPromises.push(createPromise);
                }
              });
            });

            // Wait for all creations to complete
            Promise.all(createPromises).then(function () {
              MessageToast.show("Timesheet recorded successfully for employee: " + employeeId);
              // Reload timesheet data to reflect changes
              that._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
            }).catch(function (error) {
              console.error("Error creating timesheet entries:", error);
              MessageToast.show("Error saving some timesheet entries");
            });
          }).catch(function (error) {
            console.error("Error deleting existing timesheet entries:", error);
            MessageToast.show("Error updating timesheet entries");
          });
        },
        error: function (oError) {
          console.error("Error reading existing timesheet entries:", oError);
          MessageToast.show("Error updating timesheet entries");
        }
      });
    },

    // Helper function to generate valid UUID
    _generateUUID: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    // Load Employees from OData service
    _loadEmployees: function () {
      var oModel = this.getOwnerComponent().getModel("adminService");
      var that = this;

      oModel.read("/Employees", {
        success: function (oData) {
          var aEmployees = oData.value || oData.results || [];
          console.log("Raw Employees Data from OData:", aEmployees);

          var aFormattedUsers = that._formatEmployeeData(aEmployees);

          var allowedRoles = ["Employee", "Manager"];

          var aEmployeeOnly = aFormattedUsers.filter(user =>
            allowedRoles.includes(user.roleName)
          );

          var oViewModel = that.getView().getModel();
          oViewModel.setProperty("/users", aEmployeeOnly);
          if (aFormattedUsers.length > 0) {
            // Check if we have a stored employee ID
            let storedEmployeeId = localStorage.getItem("selectedEmployeeId");
            let defaultEmployeeId = storedEmployeeId || aFormattedUsers[0].userId;
            oViewModel.setProperty("/selectedEmployee", defaultEmployeeId);

            // Load timesheet for this employee immediately
            let weekStart = oViewModel.getProperty("/currentWeekStart");
            let weekEnd = that._getWeekEnd(weekStart);
            that._loadAdminTimesheetData(defaultEmployeeId, weekStart, weekEnd);
          }

          oViewModel.refresh(true);
          that._refreshAnalyticsData();

          MessageToast.show("Employees loaded successfully: " + aFormattedUsers.length + " users");
        },
        error: function (oError) {
          console.error("Error loading employees:", oError);
          MessageToast.show("Error loading employees data");
        }
      });
    },


    // Load Projects from OData service
    _loadProjects: function () {
      var oModel = this.getOwnerComponent().getModel("adminService");
      var that = this;

      oModel.read("/Projects", {
        success: function (oData) {
          var aProjects = oData.value || oData.results || [];
          console.log("Raw Projects Data from OData:", aProjects);

          var aFormattedProjects = that._formatProjectData(aProjects);
          console.log("Formatted Projects for UI:", aFormattedProjects);

          var oViewModel = that.getView().getModel();
          oViewModel.setProperty("/projects", aFormattedProjects);
          oViewModel.refresh(true); // Force refresh to update table
          that._refreshAnalyticsData();

          MessageToast.show("Projects loaded successfully: " + aFormattedProjects.length + " projects");
        },
        error: function (oError) {
          console.error("Error loading projects:", oError);
          MessageToast.show("Error loading projects data");
        }
      });
    },

    // Format employee data from OData to UI model
    _formatEmployeeData: function (aEmployees) {

    // First pass: Normalize all user records
    let aFormattedUsers = aEmployees.map(function (employee) {

        // ----- ROLE MAPPING -----
        let role =
            employee.roleName ||
            employee.Role ||
            employee.role ||
            employee.accessLevel ||
            "Employee";

        // Normalize role text
        role = role.toLowerCase().includes("admin")
            ? "Admin"
            : role.toLowerCase().includes("manager")
                ? "Manager"
                : "Employee";

        return {
            // IDs
            userId: employee.employeeID || employee.EmployeeID || employee.ID,
            backendId: employee.ID || employee.id || "",

            // Basic Info
            firstName: employee.firstName || employee.FirstName || "",
            lastName: employee.lastName || employee.LastName || "",
            email: employee.email || employee.Email || "",

            // Role
            role: role,
            roleName: role,

            // Manager Relations
            managerId: employee.managerID_ID || employee.ManagerID || employee.managerId || "",
            managerName: employee.managerName || employee.ManagerName || "",

            // Status
            status: employee.isActive ? "Active" : "Inactive"
        };
    });

    // ----- SECOND PASS: FIX MANAGER NAMES -----
    aFormattedUsers.forEach(function (user) {
        if (user.managerId) {
            const mgr = aFormattedUsers.find(m => m.userId === user.managerId);

            if (mgr) {
                user.managerName = mgr.firstName + " " + mgr.lastName;
            } else if (!user.managerName) {
                user.managerName = "Unknown Manager";
            }
        } else {
            user.managerName = ""; // No manager
        }
    });

    return aFormattedUsers;
},


    // Format project data from OData to UI model
    // Update the _formatProjectData function in Admin.controller.js:

    _formatProjectData: function (aProjects) {
      var that = this;
      var aUsers = this.getView().getModel().getProperty("/users") || [];

      return aProjects.map(function (project) {
        console.log("Processing project:", project);

        // Extract and parse numeric values properly
        var budget = parseFloat(project.budget) || 0;
        var allocatedHours = parseFloat(project.allocatedHours) || 0;
        var usedHours = parseFloat(project.usedHours) || 0;

        // Get manager name
        var managerName = "Unknown Manager";
        var managerId = project.projectOwner_ID || "";

        // Try to find manager in users list
        if (managerId) {
          var manager = aUsers.find(user => user.userId === managerId);
          if (manager) {
            managerName = manager.firstName + " " + manager.lastName;
          }
        }

        var formattedProject = {
          projectId: project.projectID || project.ID,
          name: project.projectName || "Unknown Project",
          description: project.description || "",
          managerId: managerId,
          managerName: managerName,
          budget: budget,
          allocatedHours: allocatedHours,
          usedHours: usedHours,
          startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "2025-01-01",
          endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "2025-12-31",
          status: project.status || "Active",
          client: project.client || "Internal",
          isBillable: project.isBillable !== undefined ? project.isBillable : true,
          teamMembers: [] // Initialize empty team members array
        };

        console.log("Formatted project:", formattedProject);
        return formattedProject;
      });
    },

    // User Management Functions
    onAddUser: function () {
      this._loadUserDialog("create");
    },

    onEditUser: function (oEvent) {
      var oSelectedUser = oEvent.getSource().getBindingContext().getObject();
      this._loadUserDialog("edit", oSelectedUser);
    },

    onToggleUserStatus: function (oEvent) {
      var oSelectedUser = oEvent.getSource().getBindingContext().getObject();
      var oModel = this.getView().getModel();
      var aUsers = oModel.getProperty("/users");

      var oUser = aUsers.find(user => user.userId === oSelectedUser.userId);
      if (oUser) {
        oUser.status = oUser.status === "Active" ? "Inactive" : "Active";
        oModel.setProperty("/users", aUsers);
        oModel.refresh(true); // Force refresh to update table

        // Update in OData service
        this._updateEmployeeInOData(oUser, false);
      }
    },

   _loadUserDialog: async function (sMode, oUserData) {

    const managerList = await this._loadAvailableManagers();

    const oViewModel = new JSONModel({
        mode: sMode,
        userData: oUserData ? JSON.parse(JSON.stringify(oUserData)) : {
            firstName: "",
            lastName: "",
            email: "",
            role: "",
            managerId: "",
            managerName: "",
            status: "Active"
        },
        availableManagers: managerList
    });

    if (!this._oUserDialog) {
        this._oUserDialog = new Dialog({
            title: sMode === "create" ? "Create New User" : "Edit User",
            contentWidth: "500px",
            content: [
                new SimpleForm({
                    layout: "ResponsiveGridLayout",
                    editable: true,
                    content: [
                        new Label({ text: "First Name" }),
                        new Input({ value: "{/userData/firstName}", required: true, placeholder: "Enter First Name" }),

                        new Label({ text: "Last Name" }),
                        new Input({ value: "{/userData/lastName}", required: true, placeholder: "Enter Last Name" }),

                        new Label({ text: "Email" }),
                        new Input({ value: "{/userData/email}", type: "Email", required: true, placeholder: "Enter Email" }),

                        new Label({ text: "Role" }),
                        new Select({
                            selectedKey: "{/userData/role}",
                            placeholder: "Select Role",
                            items: [
                                new Item({ key: "Employee", text: "Employee" }),
                                new Item({ key: "Manager", text: "Manager" }),
                                new Item({ key: "Admin", text: "Admin" })
                            ]
                        }),

                        new Label({ text: "Manager" }),
                        new Select({
                            selectedKey: "{/userData/managerId}",
                            forceSelection: false,
                            items: {
                                path: "/availableManagers",
                                template: new Item({
                                    key: "{ID}",
                                    text: "{firstName} {lastName}"
                                })
                            },
                            showSecondaryValues: true,
                            change: function (oEvent) {
                               const oItem = oEvent.getSource().getSelectedItem();
        if (!oItem) return; // chill if nothing selected

        const oDialog = this.getParent().getParent().getParent();
        const oVM = oDialog.getModel();

        const data = oItem.getBindingContext().getObject();

        oVM.setProperty("/userData/managerId", data.ID);
        oVM.setProperty("/userData/managerName",
            data.firstName + " " + data.lastName
        );
                            }
                        }),

                        new Label({ text: "Status" }),
                        new Select({
                            selectedKey: "{/userData/status}",
                            items: [
                                new Item({ key: "Active", text: "Active" }),
                                new Item({ key: "Inactive", text: "Inactive" })
                            ]
                        })
                    ]
                })
            ],
            beginButton: new Button({
                text: "Save",
                press: this.onSaveUser.bind(this)
            }),
            endButton: new Button({
                text: "Cancel",
                press: this.onCancelUser.bind(this)
            })
        });

        this.getView().addDependent(this._oUserDialog);
    }

    this._oUserDialog.setModel(oViewModel);
    this._oUserDialog.open();
},
_loadAvailableManagers: function () {
    return new Promise((resolve, reject) => {
        const oModel = this.getOwnerComponent().getModel("adminService");

        oModel.read("/AvailableManagers", {
            success: function (oData) {
                // Handle both OData V2 and CAP response formats
                const list = 
                    oData.results ||   // V2
                    oData.value   ||   // CAP
                    [];

                resolve(list);
            },
            error: function (err) {
                console.error("Failed loading managers", err);
                reject(err);
            }
        });
    });
},
_getManagersList: function () {
  var oModel = this.getView().getModel();
  var aUsers = oModel.getProperty("/users");

  return aUsers
    .filter(user => user.role === "Manager" && user.status === "Active")
    .map(m => ({
        ID: m.backendId,     // GUID (match managerId)
        firstName: m.firstName,
        lastName: m.lastName
    }));
},

    // Update local model immediately with correct role and manager name
   onSaveUser: function () {
      var oDialog = this._oUserDialog;
      var oViewModel = oDialog.getModel();
      var oUserData = JSON.parse(JSON.stringify(oViewModel.getProperty("/userData")));
      var sMode = oViewModel.getProperty("/mode");

      // Validate required fields
      if (!oUserData.firstName || !oUserData.lastName || !oUserData.email || !oUserData.role) {
        MessageToast.show("Please fill in all required fields");
        return;
      }

      // Validate email format
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(oUserData.email)) {
        MessageToast.show("Please enter a valid email address");
        return;
      }

      // Check for duplicate email (excluding current user in edit mode)
      var oModel = this.getView().getModel();
      var aUsers = oModel.getProperty("/users").slice();
      var bEmailExists = aUsers.some(user =>
        user.email === oUserData.email &&
        (sMode === "create" || user.userId !== oUserData.userId)
      );
      if (bEmailExists) {
        MessageToast.show("Email address already exists");
        return;
      }

      // Update local model immediately with correct role and manager name
      if (sMode === "edit") {
        var aUsers = oModel.getProperty("/users");
        var iIndex = aUsers.findIndex(user => user.userId === oUserData.userId);
        if (iIndex !== -1) {
          // Update the user in the local model with ALL fields including role
          aUsers[iIndex] = {
            ...aUsers[iIndex],
            firstName: oUserData.firstName,
            lastName: oUserData.lastName,
            email: oUserData.email,
            role: oUserData.role, // This was missing - now role updates immediately
            roleName: oUserData.roleName, // Add roleName field for backend compatibility
            managerId: oUserData.managerId,
            status: oUserData.status
          };

          // Update manager name if managerId changed or is set
         let managerList = oViewModel.getProperty("/availableManagers");

if (!oUserData.managerId && oUserData.managerName) {
    let manager = managerList.find(m =>
        (m.firstName + " " + m.lastName).trim() === oUserData.managerName.trim()
    );

    if (manager) {
        oUserData.managerId = manager.ID; 
    }
}

          oModel.setProperty("/users", aUsers);
          oModel.refresh(true); // Force refresh to update table
          MessageToast.show("User updated successfully in UI");
        }
      } else if (sMode === "create") {
        // For new users, add to local model temporarily
        // Set manager name for new user
       // Get full manager object from availableManagers
        MessageToast.show("User added successfully in UI");
      }

      // Then update in OData service WITHOUT automatic refresh
      if (sMode === "create") {
        this._createEmployeeInOData(oUserData, false); // Don't refresh after create
      } else {
        this._updateEmployeeInOData(oUserData, false); // Don't refresh after update
      }

      oDialog.close();
    },


    // Create employee in OData service
    _createEmployeeInOData: function (oUserData, bRefresh = true) {
    var oModel = this.getOwnerComponent().getModel("adminService");
    var that = this;

    var oEmployeeData = {
        firstName: oUserData.firstName,
        lastName: oUserData.lastName,
        email: oUserData.email,
        roleName: oUserData.role,
        managerID_ID: oUserData.managerId || null,
        isActive: oUserData.status === "Active"
    };

    console.log("Creating employee with payload:", oEmployeeData);

    oModel.create("/Employees", oEmployeeData, {
        success: function (oData) {
            MessageToast.show("User created successfully");

            // 🧠 Add new employee instantly in UI without refresh
            let oViewModel = that.getView().getModel();
            let aUsers = oViewModel.getProperty("/users") || [];

            // Backend returns new ID
            const backendId = oData.ID;

            // 🔍 Find manager for name resolution
            const manager = aUsers.find(u => u.backendId === oEmployeeData.managerID_ID);

            // New UI entry
            const newUser = {
                backendId: backendId,
                userId: oData.employeeID || backendId, // fallback
                firstName: oEmployeeData.firstName,
                lastName: oEmployeeData.lastName,
                email: oEmployeeData.email,
                role: oEmployeeData.roleName,
                roleName: oEmployeeData.roleName,
                managerId: oEmployeeData.managerID_ID,
                managerName: manager ? manager.firstName + " " + manager.lastName : "",
                status: oEmployeeData.isActive ? "Active" : "Inactive"
            };

            // 💥 Push only ONCE into UI model
            aUsers.push(newUser);
            oViewModel.setProperty("/users", aUsers);

            // Optional backend reload
            // if (bRefresh) {
            //     that._loadEmployees();
            // }
        },
        error: function (error) {
            console.error("Create failed:", error);
            MessageToast.show("Error creating user");
        }
    });
},


    // Update employee in OData service with comprehensive field mapping and optional refresh
   _updateEmployeeInOData: function (oUserData, bRefresh = true) {
  var oModel = this.getOwnerComponent().getModel("adminService");
  var that = this;

  // Step 1: Get Role ID
  this._getUserRoleIdByName(oUserData.role)
    .then(function (roleGuid) {

      // Step 2: Get Manager EmployeeID
      return that._getManagerEmployeeId(oUserData.managerId)
        .then(function (managerEmployeeId) {

          // Step 3: Read backend Employees
          oModel.read("/Employees", {
            success: function (oData) {
              var oMatch = oData.results.find(emp => emp.employeeID === oUserData.userId);
              if (!oMatch) {
                MessageToast.show("Employee not found.");
                return;
              }

              var backendId = oMatch.ID;

              // Step 4: Build Final Payload
              var oEmployeePayload = {
                firstName: oUserData.firstName,
                lastName: oUserData.lastName,
                email: oUserData.email,
                userRole_ID: roleGuid,
                managerID_ID: managerEmployeeId,   // <-- EMPLOYEE ID from AvailableManagers
                managerName: oUserData.managerName,
                isActive: oUserData.status === "Active"
              };

              var sPath = "/Employees('" + backendId + "')";

              // Step 5: Update backend
              oModel.update(sPath, oEmployeePayload, {
                success: function () {

  MessageToast.show("User updated successfully.");

  // Update UI instantly (NO REFRESH)
  var oViewModel = that.getView().getModel();
  var aUsers = oViewModel.getProperty("/users");

  let idx = aUsers.findIndex(u => u.userId === oUserData.userId);
  if (idx !== -1) {

    aUsers[idx].firstName = oUserData.firstName;
    aUsers[idx].lastName = oUserData.lastName;
    aUsers[idx].email = oUserData.email;

    aUsers[idx].role = oUserData.role;
    aUsers[idx].roleName = oUserData.role;

    // Update manager details
    aUsers[idx].managerId = oUserData.managerId;
    aUsers[idx].managerName = oUserData.managerName;

    aUsers[idx].status = oUserData.status;

    aUsers[idx].backendId = backendId;
  }

  oViewModel.setProperty("/users", aUsers);

}

              });
            }
          });
        });
    });
},

_getUserRoleIdByName: function (roleName) {
  return new Promise((resolve, reject) => {
    var oModel = this.getOwnerComponent().getModel("adminService");

    oModel.read("/UserRoles", {
      success: function (oData) {
        if (!oData.results) return reject("No UserRoles found");

        let match = oData.results.find(r => r.roleName === roleName);

        if (!match) return reject("Role not found: " + roleName);

        resolve(match.ID); // return GUID for userRole_ID
      },
      error: reject
    });
  });
},

_getManagerEmployeeId: function (managerGuid) {
  return new Promise((resolve, reject) => {
    var oModel = this.getOwnerComponent().getModel("adminService");

    oModel.read("/AvailableManagers", {
      success: function (oData) {
        let list = oData.results || [];

        let match = list.find(m => m.ID === managerGuid);
        if (!match) {
          resolve(null);
          return;
        }

        resolve(match.ID);  // <-- THIS is what you must send
      },
      error: reject
    });
  });
},

    onCancelUser: function () {
      if (this._oUserDialog) {
        this._oUserDialog.close();
      }
    },

    // Project Management Functions
    onAddProject: function () {
      this._loadProjectDialog("create");
    },

    onEditProject: function (oEvent) {
      var oSelectedProject = oEvent.getSource().getBindingContext().getObject();
      this._loadProjectDialog("edit", oSelectedProject);
    },

    onDeleteProject: function (oEvent) {
      var oSelectedProject = oEvent.getSource().getBindingContext().getObject();

      MessageBox.confirm(
        "Are you sure you want to delete project '" + oSelectedProject.name + "'?",
        {
          title: "Delete Project",
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._deleteProjectInOData(oSelectedProject);
            }
          }.bind(this)
        }
      );
    },

    _loadProjectDialog: function (sMode, oProjectData) {
      if (!this._oProjectDialog) {
        this._oProjectDialog = new Dialog({
          title: sMode === "create" ? "Create New Project" : "Edit Project",
          contentWidth: "600px",
          content: [
            new SimpleForm({
              layout: "ResponsiveGridLayout",
              editable: true,
              content: [
                new Label({ text: "Project Name" }),
                new Input({
                  value: "{/projectData/name}",
                  required: true,
                  valueStateText: "Project Name is required"
                }),

                // new Label({ text: "Description" }),
                // new Input({ value: "{/projectData/description}" }),

                new Label({ text: "Project Manager" }),
                new Select({
                  selectedKey: "{/projectData/managerId}",
                  items: {
                    path: "/managers",
                    template: new Item({
                      key: "{userId}",
                      text: "{firstName} {lastName}"
                    })
                  },
                  required: true
                }),

                new Label({ text: "Budget ($)" }),
                new Input({
                  value: "{/projectData/budget}",
                  type: "Number",
                  valueStateText: "Budget must be a number"
                }),

                new Label({ text: "Allocated Hours" }),
                new Input({
                  value: "{/projectData/allocatedHours}",
                  type: "Number",
                  required: true,
                  valueStateText: "Allocated Hours is required"
                }),

                // new Label({ text: "Used Hours" }),
                // new Input({
                //   value: "{/projectData/usedHours}",
                //   type: "Number",
                //   valueStateText: "Used Hours must be a number"
                // }),

                new Label({ text: "Start Date" }),
                new DatePicker({
                  value: "{/projectData/startDate}",
                  valueFormat: "yyyy-MM-dd",
                  required: true
                }),

                new Label({ text: "End Date" }),
                new DatePicker({
                  value: "{/projectData/endDate}",
                  valueFormat: "yyyy-MM-dd",
                  required: true
                }),

                // new Label({ text: "Client" }),
                // new Input({ value: "{/projectData/client}" }),

                new Label({ text: "Status" }),
                new Select({
                  selectedKey: "{/projectData/status}",
                  items: [
                    new Item({ key: "Planning", text: "Planning" }),
                    new Item({ key: "Active", text: "Active" }),
                    new Item({ key: "On Hold", text: "On Hold" }),
                    new Item({ key: "Completed", text: "Completed" }),
                    new Item({ key: "Cancelled", text: "Cancelled" })
                  ],
                  required: true
                })
              ]
            })
          ],
          beginButton: new Button({
            text: "Save",
            type: "Emphasized",
            press: this.onSaveProject.bind(this)
          }),
          endButton: new Button({
            text: "Cancel",
            press: this.onCancelProject.bind(this)
          })
        });

        this.getView().addDependent(this._oProjectDialog);
      }

      // Set up the model for the dialog
      var oViewModel = new JSONModel({
        mode: sMode,
        projectData: oProjectData ? JSON.parse(JSON.stringify(oProjectData)) : {
          ID: "",
          name: "",
          projectID: "",
          description: "",
          managerId: "",
          budget: 0,
          allocatedHours: 0,
          usedHours: 0,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          client: "",
          status: "Planning"
        },
        managers: this._getManagersList()
      });

      this._oProjectDialog.setModel(oViewModel);
      this._oProjectDialog.open();
    },

    // Save project with immediate UI update for manager name
    onSaveProject: function () {
      var oDialog = this._oProjectDialog;
      var oViewModel = oDialog.getModel();
      var oProjectData = JSON.parse(JSON.stringify(oViewModel.getProperty("/projectData")));
      var sMode = oViewModel.getProperty("/mode");

      // Validate required fields
      if (!oProjectData.name || !oProjectData.managerId || !oProjectData.startDate || !oProjectData.endDate || !oProjectData.allocatedHours) {
        MessageToast.show("Please fill in all required fields");
        return;
      }

      // Parse numeric values
      oProjectData.budget = parseFloat(oProjectData.budget) || 0;
      oProjectData.allocatedHours = parseFloat(oProjectData.allocatedHours) || 0;
      oProjectData.usedHours = parseFloat(oProjectData.usedHours) || 0;

      // Validate dates
      var startDate = new Date(oProjectData.startDate);
      var endDate = new Date(oProjectData.endDate);
      if (endDate <= startDate) {
        MessageToast.show("End date must be after start date");
        return;
      }

      // Validate hours
      if (oProjectData.usedHours < 0 || oProjectData.allocatedHours < 0) {
        MessageToast.show("Hours cannot be negative");
        return;
      }

      if (oProjectData.usedHours > oProjectData.allocatedHours) {
        MessageToast.show("Used hours cannot exceed allocated hours");
        return;
      }

      // Update local model immediately with manager name
      if (sMode === "edit") {
        var oModel = this.getView().getModel();
        var aProjects = oModel.getProperty("/projects");
        var iIndex = aProjects.findIndex(project => project.projectId === oProjectData.projectId);

        if (iIndex !== -1) {
          // Get manager name from managers list
          var managers = this._getManagersList();
          var selectedManager = managers.find(manager => manager.userId === oProjectData.managerId);
          var managerName = selectedManager ? selectedManager.firstName + " " + selectedManager.lastName : "Unknown Manager";

          // Update project in local model
          aProjects[iIndex] = {
            ...aProjects[iIndex],
            name: oProjectData.name,
            description: oProjectData.description,
            managerId: oProjectData.managerId,
            managerName: managerName, // Set the manager name immediately
            budget: oProjectData.budget,
            allocatedHours: oProjectData.allocatedHours,
            usedHours: oProjectData.usedHours,
            startDate: oProjectData.startDate,
            endDate: oProjectData.endDate,
            client: oProjectData.client,
            status: oProjectData.status
          };

          oModel.setProperty("/projects", aProjects);
          oModel.refresh(true);
          MessageToast.show("Project updated successfully in UI");
        }
      } else if (sMode === "create") {
        // For new projects, add to local model temporarily
        var oModel = this.getView().getModel();
        var aProjects = oModel.getProperty("/projects");

        // Get manager name from managers list
        var managers = this._getManagersList();
        var selectedManager = managers.find(manager => manager.userId === oProjectData.managerId);
        var managerName = selectedManager ? selectedManager.firstName + " " + selectedManager.lastName : "Unknown Manager";

        var newProjectId = "PRJ" + Math.floor(Math.random() * 100000).toString().padStart(5, "0");
        var newProject = {
          projectId: newProjectId,
          name: oProjectData.name,
          description: oProjectData.description,
          managerId: oProjectData.managerId,
          managerName: managerName, // Set the manager name immediately
          budget: oProjectData.budget,
          allocatedHours: oProjectData.allocatedHours,
          usedHours: oProjectData.usedHours,
          startDate: oProjectData.startDate,
          endDate: oProjectData.endDate,
          client: oProjectData.client,
          status: oProjectData.status,
          isBillable: true,
          teamMembers: []
        };

        aProjects.push(newProject);
        oModel.setProperty("/projects", aProjects);
        oModel.refresh(true);
        MessageToast.show("Project added successfully in UI");
      }

      // Then update in OData service WITHOUT automatic refresh
      if (sMode === "create") {
        this._createProjectInOData(oProjectData, false); // Don't refresh after create
      } else {
        this._updateProjectInOData(oProjectData, false); // Don't refresh after update
      }

      oDialog.close();
    },

    // Create project in OData service
    _createProjectInOData: function (oProjectData, bRefresh = true) {
      var oModel = this.getOwnerComponent().getModel("adminService");
      var that = this;

      var oProjectPayload = {
        projectName: oProjectData.name,
        description: oProjectData.description || "",
        projectOwner_ID: oProjectData.managerId,
        budget: parseFloat(oProjectData.budget) || 0,
        allocatedHours: parseFloat(oProjectData.allocatedHours) || 0,
        startDate: oProjectData.startDate,
        endDate: oProjectData.endDate,
        status: oProjectData.status,
        isBillable: true
      };

      console.log("Creating project with payload:", oProjectPayload);

      oModel.create("/Projects", oProjectPayload, {
        success: function (oData) {
          MessageToast.show("Project created successfully");
          // Only refresh if explicitly requested
          if (bRefresh) {
            that._loadProjects();
          }
        },
        error: function (oError) {
          console.error("Error creating project:", oError);
          MessageToast.show("Error creating project");
          // Only refresh if explicitly requested
          if (bRefresh) {
            that._loadProjects();
          }
        }
      });
    },

    // Update project in OData service
    _updateProjectInOData: function (oProjectData, bRefresh = true) {
      var oModel = this.getOwnerComponent().getModel("adminService");
      var that = this;

      if (!oProjectData.projectId) {
        MessageToast.show("Missing projectId. Cannot update.");
        console.warn("No projectId found in projectData:", oProjectData);
        return;
      }

      // 1️⃣ Read all projects and find backend CUID
      oModel.read("/Projects", {
        success: function (oData) {
          if (!oData.results || !oData.results.length) {
            MessageToast.show("No projects found in backend.");
            return;
          }

          // 2️⃣ Find backend entry by projectId (display value)
          var backendItem = oData.results.find(p => p.projectID === oProjectData.projectId);

          if (!backendItem) {
            MessageToast.show("Project not found in backend. Cannot update.");
            console.warn("No backend match for projectId:", oProjectData.projectId);
            return;
          }

          // 3️⃣ Use backend CUID
          var backendId = backendItem.ID;

          if (!backendId) {
            MessageToast.show("Backend Project ID missing. Cannot update.");
            console.error("Backend item has no ID field:", backendItem);
            return;
          }

          // 4️⃣ Create Update Payload
          var oProjectPayload = {
            projectName: oProjectData.name,
            description: oProjectData.description || "",
            projectOwner_ID: oProjectData.managerId,
            budget: parseFloat(oProjectData.budget) || 0,
            allocatedHours: parseFloat(oProjectData.allocatedHours) || 0,
            startDate: oProjectData.startDate,
            endDate: oProjectData.endDate,
            status: oProjectData.status
          };

          var sPath = "/Projects('" + backendId + "')";

          console.log("Updating project:", backendId, oProjectPayload);

          // 5️⃣ Perform Update
          oModel.update(sPath, oProjectPayload, {
            success: function () {
              MessageToast.show("Project updated successfully");
              // Only refresh if explicitly requested
              if (bRefresh) {
                that._loadProjects();
              }
            },
            error: function (oError) {
              console.error("Error updating project:", oError);
              MessageToast.show("Error updating project");
              // Only refresh if explicitly requested
              if (bRefresh) {
                that._loadProjects();
              }
            }
          });
        },

        error: function (err) {
          console.error("Error reading Projects:", err);
          MessageToast.show("Failed to fetch backend projects.");
        }
      });
    },

    // Delete project in OData service
    // Update the _deleteProjectInOData function in Admin.controller.js:

    _deleteProjectInOData: function (oProjectData) {
      var oModel = this.getOwnerComponent().getModel("adminService");
      var that = this;

      // Step 1: Read all Projects to find the correct backend ID
      oModel.read("/Projects", {
        success: function (oData) {
          if (!oData.results || oData.results.length === 0) {
            MessageToast.show("No projects found. Cannot delete.");
            return;
          }

          // Step 2: Find the matching project by projectId (display ID)
          var oMatch = oData.results.find(function (proj) {
            return proj.projectID === oProjectData.projectId;
          });

          if (!oMatch) {
            MessageToast.show("Project not found. Cannot delete.");
            console.warn("No backend match for projectId:", oProjectData.projectId);
            return;
          }

          var backendId = oMatch.ID;
          var sPath = "/Projects('" + backendId + "')";

          console.log("Deleting project with backend ID:", backendId);

          // Step 3: Delete with valid backend CUID
          oModel.remove(sPath, {
            success: function () {
              MessageToast.show("Project deleted successfully");
              that._loadProjects();
            },
            error: function (oError) {
              console.error("Error deleting project:", oError);
              MessageToast.show("Error deleting project");
            }
          });
        },
        error: function (oError) {
          console.error("Error loading projects:", oError);
          MessageToast.show("Error fetching project list");
        }
      });
    },

    onCancelProject: function () {
      if (this._oProjectDialog) {
        this._oProjectDialog.close();
      }
    },

    // Analytics Functions
    onRefreshAnalytics: function () {
      this._refreshAnalyticsData();
      MessageToast.show("Analytics data refreshed");
    },

    // In your Admin.controller.js, update the _refreshAnalyticsData function:
    // In your Admin.controller.js, update the _refreshAnalyticsData function:

    _refreshAnalyticsData: function () {
      var oModel = this.getView().getModel();
      var aProjects = oModel.getProperty("/projects") || [];
      var aUsers = oModel.getProperty("/users") || [];

      // Update project hours data
      var aProjectHours = aProjects.map(function (project) {
        var bookedHours = project.usedHours || 0;
        var allocatedHours = project.allocatedHours || 0;
        var remainingHours = allocatedHours - bookedHours;
        var utilization = allocatedHours > 0 ? Math.round((bookedHours / allocatedHours) * 100) : 0;

        return {
          projectId: project.projectId,
          projectName: project.name,
          allocatedHours: allocatedHours,
          bookedHours: bookedHours,
          remainingHours: remainingHours,
          utilization: utilization
        };
      });

      // Update manager teams data
      var aManagerTeams = this._getManagersList().map(function (manager) {
        var aTeamMembers = aUsers.filter(user =>
          user.managerId === manager.userId && user.status === "Active"
        );
        var aManagerProjects = aProjects.filter(project =>
          project.managerId === manager.userId
        );

        var totalBookedHours = aManagerProjects.reduce(function (sum, project) {
          return sum + (project.usedHours || 0);
        }, 0);

        var totalAllocatedHours = aManagerProjects.reduce(function (sum, project) {
          return sum + (project.allocatedHours || 0);
        }, 0);

        var avgUtilization = totalAllocatedHours > 0 ?
          Math.round((totalBookedHours / totalAllocatedHours) * 100) : 0;

        return {
          managerId: manager.userId,
          managerName: manager.firstName + " " + manager.lastName,
          teamSize: aTeamMembers.length,
          totalProjects: aManagerProjects.length,
          totalBookedHours: totalBookedHours,
          avgUtilization: avgUtilization
        };
      });

      // Update project durations data with proper date handling
      var aProjectDurations = aProjects.map(function (project) {
        // Ensure dates are properly handled - keep as Date objects
        var startDate = project.startDate ? new Date(project.startDate) : null;
        var endDate = project.endDate ? new Date(project.endDate) : null;
        var today = new Date();

        // Calculate duration in days
        var durationDays = 0;
        if (startDate && endDate) {
          durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        }

        // Calculate days remaining
        var daysRemaining = 0;
        if (endDate) {
          daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        }

        // Determine timeline status
        var timelineStatus = "On Track";
        if (project.status === "Completed") {
          timelineStatus = "Completed";
        } else if (daysRemaining < 0) {
          timelineStatus = "Delayed";
        } else if (daysRemaining < 14) {
          timelineStatus = "At Risk";
        }

        return {
          projectId: project.projectId,
          projectName: project.name,
          // Keep dates as Date objects for proper formatting in the view
          startDate: startDate,
          endDate: endDate,
          durationDays: durationDays,
          daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
          timelineStatus: timelineStatus
        };
      });

      // Calculate overall progress from project data
      var totalBookedHours = aProjects.reduce(function (sum, project) {
        return sum + (project.usedHours || 0);
      }, 0);

      var totalAllocatedHours = aProjects.reduce(function (sum, project) {
        return sum + (project.allocatedHours || 0);
      }, 0);

      var totalRemainingHours = totalAllocatedHours - totalBookedHours;
      var averageUtilization = totalAllocatedHours > 0 ? Math.round((totalBookedHours / totalAllocatedHours) * 100) : 0;

      // Update the overall progress data
      oModel.setProperty("/overallProgress", {
        totalBookedHours: totalBookedHours,
        totalAllocatedHours: totalAllocatedHours,
        totalRemainingHours: totalRemainingHours,
        averageUtilization: averageUtilization
      });

      oModel.setProperty("/projectHours", aProjectHours);
      oModel.setProperty("/managerTeams", aManagerTeams);
      oModel.setProperty("/projectDurations", aProjectDurations);
      oModel.refresh(true);

      // Also refresh the overall progress data from the backend
      this._loadOverallProgress();
    },

    // Utility Functions
    formatCurrency: function (fValue) {
      if (fValue === null || fValue === undefined || isNaN(fValue)) {
        return "$0.00";
      }
      var value = parseFloat(fValue);
      return "$" + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    // Refresh functions to reload the entire page
    onRefreshUsers: function () {
      this._loadEmployees();
      MessageToast.show("Users data refreshed");
    },

    onRefreshProjects: function () {
      this._loadProjects();
      MessageToast.show("Projects data refreshed");
    },

    // Function to refresh the entire page
    onRefreshPage: function () {
      window.location.reload();
    }
  });
});