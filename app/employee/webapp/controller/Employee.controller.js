sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/BusyIndicator",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment",
  "sap/m/MenuItem",
  "sap/m/Menu",
  "sap/m/Dialog",
  "sap/m/MessageBox"


], (Controller, JSONModel, BusyIndicator, Fragment, MenuItem, Dialog, Menu, MessageToast, MessageBox) => {
  "use strict";

  return Controller.extend("employee.controller.Employee", {

    onInit: function () {
    var oView = this.getView(); // ✅ capture view reference
    var oModel = new sap.ui.model.json.JSONModel({
        selectedDate: this._formatDateForModel(new Date()),
        dailySummary: [],
        totalWeekHours: "0.00",
        currentWeek: "",
        isSubmitted: false,
        timeEntriesCount: 0,
        commentsCount: 0,
        timeEntries: [],
        hoursWorked: 0,
        isTaskDisabled: false,
        newEntry: {},
        projects: [],
        nonProjectTypeName: "",
        nonProjects: [],
        workTypes: [],
        workType: "",
        dailyTotals: {
            monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
            friday: 0, saturday: 0, sunday: 0
        },
        weekDates: this._generateWeekDates(new Date()),
    });
    oView.setModel(oModel, "timeEntryModel");

    // Load time entries
    this._loadTimeEntriesFromBackend();

   this._checkCurrentUser();
    // this._loadWeekEntries(today);

    // Load projects
    var oProjectModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    oProjectModel.read("/MyProjects", {
        success: function(oData) {
            var results = oData.d ? oData.d.results : oData.results;
            var mappedProjects = results.map(function(item) {
                return {
                    projectName: item.projectName,
                    status: item.status,
                    managerName: item.projectOwner && item.projectOwner.Name ? item.projectOwner.Name : "N/A"
                };
            });

            var oJSONModel = new sap.ui.model.json.JSONModel();
            oJSONModel.setData({ assignedProjects: mappedProjects });
            oView.setModel(oJSONModel, "assignedProjects"); // ✅ now bound correctly
        }.bind(this), // important: bind `this` if needed
        error: function(err) {
            console.error("Failed to load projects", err);
        }
    });

    this._loadReportData(oProjectModel, oView);

},
// _openDayEditDialogByInput: function(oInput) {
//     var sDay = oInput.data("day");
//     var iRowIndex = parseInt(oInput.data("rowIndex"), 10);

//     var oModel = this.getView().getModel("timeEntryModel");
//     var aEntries = oModel.getProperty("/timeEntries");

//     if (!aEntries || !aEntries[iRowIndex]) {
//         sap.m.MessageToast.show("No data found for " + sDay);
//         return;
//     }

//     var oEntry = aEntries[iRowIndex];

//     this._currentEditEntry = oEntry;
//     this._currentEditDay = sDay;

//     this.onEditDayHours();
// },

_checkCurrentUser: function () {
    let oUserModel = this.getOwnerComponent().getModel("userAPIService");

    oUserModel.callFunction("/getCurrentUser", {
        method: "GET",
        success: (oData) => {
            console.log("User API Response:", oData);

            if (oData.getCurrentUser.authenticated) {
                this.getOwnerComponent().getRouter().navTo("Employee");
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
},

_getCurrentWeekMonday: function() {
    let today = new Date();
    let day = today.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    let diff = day === 0 ? -6 : 1 - day; // go back to Monday
    let monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
},
_loadReportData: function(oModel, oView) {
    // 1️⃣ Booked Hours Overview
    oModel.read("/BookedHoursOverview", {
        success: function(oData) {
            // Safely extract results array
            var bookedHours = oData.d ? oData.d.results : oData.results;

            var oBookedHoursModel = new sap.ui.model.json.JSONModel();
            oBookedHoursModel.setData({ employeeProjectHours: bookedHours });

            oView.setModel(oBookedHoursModel, "bookedHoursModel");
        },
        error: function(err) {
            console.error("Failed to load Booked Hours Overview", err);
        }
    });

    // 2️⃣ Project Engagement Duration
    oModel.read("/ProjectEngagementDuration", {
        success: function(oData) {
            var durations = oData.d ? oData.d.results : oData.results;

            var oDurationModel = new sap.ui.model.json.JSONModel();
            oDurationModel.setData({ employeeProjectDurations: durations });

            oView.setModel(oDurationModel, "durationModel");
        },
        error: function(err) {
            console.error("Failed to load Project Engagement Duration", err);
        }
    });
},

_getReportData: function(){
    var oReportModel = this.getOwnerComponent().getModel()
},

    _generateWeekDates: function (oCurrentDate) {
    var oStart = new Date(oCurrentDate);
    oStart.setDate(oCurrentDate.getDate() - oCurrentDate.getDay() + 1); // Monday start

    var oWeekDates = {};
    var aDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    aDays.forEach((sDay, i) => {
        var oDate = new Date(oStart);
        oDate.setDate(oStart.getDate() + i);

        oWeekDates[sDay] = oDate;
        oWeekDates[sDay + "Formatted"] = this._formatDateForDisplay(oDate);
    });

    return oWeekDates;
},

// _formatDateForDisplay: function (oDate) {
//     return oDate.toLocaleDateString("en-GB", {
//         day: "2-digit",
//         month: "short",
//         year: "numeric"
//     });
// },


_loadTimeEntriesFromBackend: function () {
    let oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    let oView = this.getView();
    let oModel = oView.getModel("timeEntryModel");

    if (!oODataModel) {
        console.error("No OData model found");
        return;
    }

    BusyIndicator.show(0);

    // Set current week
    let monday = this._getCurrentWeekMonday();
    let selectedDateStr = monday.toISOString().split("T")[0];

   this._fetchWeekBoundaries(selectedDateStr)
    .then(week => {

        let weekStart = week.getWeekBoundaries.weekStart;
        let weekEnd = week.getWeekBoundaries.weekEnd;

        this._updateWeekDates(new Date(weekStart));

        oODataModel.read("/MyTimesheets", {
            success: function(oData) {
                BusyIndicator.hide();

                let allResults = oData.results || [];
                let weekDates = oModel.getProperty("/weekDates");

                // Compare values ignoring OData Date format noise
             


           let toDate = d => new Date(d); // convert "2025-11-17" to full Date object

let filtered = allResults.filter(item => {
  let itemStart = item.weekStartDate ? toDate(item.weekStartDate) : null;
  let itemEnd   = item.weekEndDate   ? toDate(item.weekEndDate)   : null;

  return itemStart?.getTime() === weekStart.getTime() &&
         itemEnd?.getTime()   === weekEnd.getTime();
});




                let formatted = filtered.map(item => {

    // Always ensure projectName holds the visible name
    let finalName =
        item.projectName && item.projectName.trim() !== ""
            ? item.projectName
            : (item.nonProjectTypeName || "");

    return {
        id: item.ID,

        projectId: item.project_ID,
        nonProjectId: item.nonProjectType_ID,

        // 👇 IMPORTANT: only this is bound to the table column
        projectName: finalName,

        // Keep originals if needed for edit dialog
        originalProjectName: item.projectName,
        originalNonProjectName: item.nonProjectTypeName,

        workType: item.task,
        status: item.status,

        weekStart: item.weekStartDate,
        weekEnd: item.weekEndDate,

        mondayHours: item.mondayHours,
        tuesdayHours: item.tuesdayHours,
        wednesdayHours: item.wednesdayHours,
        thursdayHours: item.thursdayHours,
        fridayHours: item.fridayHours,
        saturdayHours: item.saturdayHours,
        sundayHours: item.sundayHours,

        mondayTaskDetails: item.mondayTaskDetails,
        tuesdayTaskDetails: item.tuesdayTaskDetails,
        wednesdayTaskDetails: item.wednesdayTaskDetails,
        thursdayTaskDetails: item.thursdayTaskDetails,
        fridayTaskDetails: item.fridayTaskDetails,
        saturdayTaskDetails: item.saturdayTaskDetails,
        sundayTaskDetails: item.sundayTaskDetails,

        dates: weekDates
    };
});


                oModel.setProperty("/timeEntries", formatted);

                let dailyTotals = this._calculateDailyTotals(formatted);
                oModel.setProperty("/dailyTotals", dailyTotals);

                let totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
                oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

                let table = oView.byId("timesheetTable");
                table?.getBinding("items")?.refresh(true);

            }.bind(this),

            error: function(err) {
                BusyIndicator.hide();
                console.error(err);
                MessageToast.show("Failed to load timesheet");
            }
        });

    })
    .catch(err => {
        BusyIndicator.hide();
        console.error(err);
        MessageToast.show("Week boundary fetch failed");
    });

},


// Separate function to calculate daily totals
_calculateDailyTotals: function (timeEntries) {
    let totals = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0
    };

    timeEntries.forEach(entry => {
        totals.monday += parseFloat(entry.mondayHours || 0);
        totals.tuesday += parseFloat(entry.tuesdayHours || 0);
        totals.wednesday += parseFloat(entry.wednesdayHours || 0);
        totals.thursday += parseFloat(entry.thursdayHours || 0);
        totals.friday += parseFloat(entry.fridayHours || 0);
        totals.saturday += parseFloat(entry.saturdayHours || 0);
        totals.sunday += parseFloat(entry.sundayHours || 0);
    });

    return totals;
},
_formatDisplayDate: function (oDate) {
    if (!oDate) return "";
    try {
        return new Date(oDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    } catch (e) {
        return "";
    }
},

// validateDailyHours: function () {
//     var oModel = this.getView().getModel("timeEntryModel");
//     var aEntries = oModel.getProperty("/timeEntries") || [];

//     // Initialize day totals
//     var oDayTotals = {
//         monday: 0,
//         tuesday: 0,
//         wednesday: 0,
//         thursday: 0,
//         friday: 0,
//         saturday: 0,
//         sunday: 0
//     };

//     // Sum up hours for each day across all tasks
//     aEntries.forEach(function (entry) {
//         oDayTotals.monday += entry.monday || 0;
//         oDayTotals.tuesday += entry.tuesday || 0;
//         oDayTotals.wednesday += entry.wednesday || 0;
//         oDayTotals.thursday += entry.thursday || 0;
//         oDayTotals.friday += entry.friday || 0;
//         oDayTotals.saturday += entry.saturday || 0;
//         oDayTotals.sunday += entry.sunday || 0;
//     });

//     // Check limits for each day
//     var bIsValid = true;
//     Object.keys(oDayTotals).forEach(function (day) {
//         var total = oDayTotals[day];

//         if (total > 15) {
//             sap.m.MessageBox.error(
//                 `❌ Total hours for ${day.charAt(0).toUpperCase() + day.slice(1)} exceed the limit of 15 hours (Current: ${total})`
//             );
//             bIsValid = false;
//         } else if (total < 8 && total > 0) { 
//             // You can skip validation if total is 0 (means not filled yet)
//             sap.m.MessageBox.warning(
//                 `⚠️ Total hours for ${day.charAt(0).toUpperCase() + day.slice(1)} are less than the minimum required 8 hours (Current: ${total})`
//             );
//             bIsValid = false;
//         }
//     });

//     return bIsValid;
// },
    _formatDateForModel: function (oDate) {
            return oDate.getFullYear() + "-" +
                ("0" + (oDate.getMonth() + 1)).slice(-2) + "-" +
                ("0" + oDate.getDate()).slice(-2);
        },
    _getCurrentWeekDates: function () {
    let today = new Date();
    let day = today.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat

    // Calculate Monday of the current week
    let diffToMonday = day === 0 ? -6 : 1 - day;
    let monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    // Helper to format YYYY-MM-DD
    let format = d => d.toISOString().split("T")[0];

    let mondayStr = format(monday);
    let sundayStr = format(new Date(monday.getTime() + 6 * 86400000));

    return {
        weekStart: mondayStr,
        weekEnd: sundayStr,

        monday: mondayStr,
        tuesday: format(new Date(monday.getTime() + 1 * 86400000)),
        wednesday: format(new Date(monday.getTime() + 2 * 86400000)),
        thursday: format(new Date(monday.getTime() + 3 * 86400000)),
        friday: format(new Date(monday.getTime() + 4 * 86400000)),
        saturday: format(new Date(monday.getTime() + 5 * 86400000)),
        sunday: sundayStr
    };
},


    _formatDateForDisplay: function(oDate) {
    if (!oDate) return "";
    // convert string to Date if needed
    let dateObj = (typeof oDate === "string") ? new Date(oDate) : oDate;
    let options = { month: "short", day: "numeric" };
    return dateObj.toLocaleDateString("en-US", options); // e.g., "Nov 17, 25"
},

        onCancelNewEntry: function () {
            this._oAddEntryDialog.close();
        },
        _isFutureDate: function (selectedDateStr, weekStart, weekEnd) {
    let d = new Date(selectedDateStr);
    return d > new Date(weekEnd); // anything beyond this week
},
//   onAddEntry: function () {
//     var that = this;
//     var oModel = this.getView().getModel("timeEntryModel");
//     var oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");

//     var today = new Date();
//     var selectedDateStr = this._formatDateForModel(today);

//     // Initialize newEntry with empty/default values
//     oModel.setProperty("/newEntry", {
//         selectedDate: selectedDateStr,
//         projectId: "",      // <-- empty for placeholder
//         projectName: "",    // <-- will be set when user selects
//         workType: "",
//         nonProjectTypeID: "",
//         nonProjectTypeName: "",
//         hours: "",
//         taskDetails: "",
//         dailyComments: {}
//     });

//     // Load Projects
//     var loadProjects = new Promise(function (resolve) {
//         oServiceModel.read("/MyProjects", {
//             success: function (oData) {
//                 var aProjects = [];
//                 if (oData.results) {
//                     aProjects = oData.results.map(p => ({
//                         projectId: p.projectID,
//                         projectName: p.projectName
//                     }));
//                 }
//                 oModel.setProperty("/projects", aProjects);
//                 resolve();
//             },
//             error: function () {
//                 oModel.setProperty("/projects", []);
//                 resolve();
//             }
//         });
//     });

//     var loadNonProjects = new Promise(function(resolve){
//     oServiceModel.read("/AvailableNonProjectTypes", {
//         success: function(oData){
//             oModel.setProperty("/nonProjects", oData.results || []);
//             resolve();
//         },
//         error: function(){ oModel.setProperty("/nonProjects", []); resolve(); }
//     });
// });

// var loadNonProjectTasks = new Promise(function(resolve){
//     oServiceModel.read("/AvailableNonProjectTypes", {
//         success: function(oData){
//             oModel.setProperty("/nonProjectTasks", oData.results || []);
//             resolve();
//         },
//         error: function(){ oModel.setProperty("/nonProjectTasks", []); resolve(); }
//     });
// });


//     // Load Tasks
//     var loadTasks = new Promise(function (resolve) {
//         oServiceModel.read("/AvailableTaskTypes", {
//             success: function (oData) {
//                 var aTasks = [];
//                 if (oData.results) {
//                     aTasks = oData.results.map(t => ({ type: t.code, name: t.name }));
//                 }
//                 oModel.setProperty("/workTypes", aTasks);
//                 resolve();
//             },
//             error: function () {
//                 oModel.setProperty("/workTypes", []);
//                 resolve();
//             }
//         });
//     });

//     // Open the dialog after both projects and tasks are loaded
// Promise.all([loadProjects, loadTasks, loadNonProjects, loadNonProjectTasks]).then(function () {

//     let weekInfo = that._getCurrentWeekDates(); // you already have similar logic
//     let isFuture = that._isFutureDate(selectedDateStr, weekInfo.weekStart, weekInfo.weekEnd);
 

//     let allProjects = oModel.getProperty("/projects") || [];
//     let nonProjects = oModel.getProperty("/nonProjects") || []; // read from /NonProjectSet OData

//        let normalizedProjects = allProjects.map(p => ({
//     projectId: p.projectId,
//     projectName: p.projectName
// }));

// let normalizedNonProjects = nonProjects.map(np => ({
//     projectId: np.nonProjectTypeID,   // unique key for non-project
//     projectName: np.typeName          // normalize label
// }));
//     let allTasks = oModel.getProperty("/workTypes") || [];
//     let nonProjectTasks = oModel.getProperty("/nonProjectTasks") || []; // read from OData

//     if (isFuture) {
//         // only non-project allowed
//         oModel.setProperty("/projectsToShow", nonProjects);
//         oModel.setProperty("/tasksToShow", nonProjectTasks);
//     } else {
//         // current week → mix of both
//         oModel.setProperty("/projectsToShow", [...normalizedProjects,
//     ...normalizedNonProjects]);
//         oModel.setProperty("/tasksToShow", [...allTasks]);
//     }

//     oModel.setProperty("/tasksToShow", []);
// oModel.setProperty("/isTaskDisabled", true);


//     if (!that._oAddEntryDialog) {
//         that._oAddEntryDialog = sap.ui.xmlfragment(
//             that.getView().getId(),
//             "employee.Fragments.AddTimeEntry",
//             that
//         );
//         that.getView().addDependent(that._oAddEntryDialog);
//     }
//     that._oAddEntryDialog.open();
// });
// },

// onProjectChange: function (oEvent) {
//     let oModel = this.getView().getModel("timeEntryModel");
//     let selectedProjectId = oEvent.getSource().getSelectedKey();

//     let normalizedProjects = oModel.getProperty("/projects") || [];
//     let normalizedNonProjects = oModel.getProperty("/nonProjects") || [];
//     let allTasks = oModel.getProperty("/workTypes") || [];
//     let nonProjectTasks = oModel.getProperty("/nonProjectTasks") || [];

//     let isNonProjectSelected =
//         normalizedNonProjects.some(np => np.nonProjectTypeID === selectedProjectId);

//     if (isNonProjectSelected) {
//         // When non-project is selected
//         oModel.setProperty("/tasksToShow", []);  // or nonProjectTasks if needed
//         oModel.setProperty("/isTaskDisabled", true);
//     } else {
//         // Normal project selected
//         oModel.setProperty("/tasksToShow", allTasks);
//         oModel.setProperty("/isTaskDisabled", false);
//     }
// },

// Add this method to handle user project selection
// onProjectChange: function (oEvent) {
//     var oSelectedItem = oEvent.getParameter("selectedItem");
//     if (!oSelectedItem) return;

//     var oModel = this.getView().getModel("timeEntryModel");
//     var newEntry = oModel.getProperty("/newEntry") || {};

//     newEntry.projectId = oSelectedItem.getKey();
//     newEntry.projectName = oSelectedItem.getText(); // <-- set projectName too

//     oModel.setProperty("/newEntry", newEntry);
// },
onEntryDatePickerChange: function (oEvent) {
    var that = this;
    var oModel = this.getView().getModel("timeEntryModel");
    var oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");

    var value = oEvent.getParameter("value"); // dd/MM/yyyy
    if (!value) return;

    var day = this._dayPropertyFromDate(value);

    var newEntry = oModel.getProperty("/newEntry") || {};
    newEntry.selectedDate = value;
    newEntry.day = day;
    oModel.setProperty("/newEntry", newEntry);

    // Load all endpoints
    var loadProjects = new Promise(function (resolve) {
        oServiceModel.read("/MyProjects", {
            success: function (oData) {
                let aProjects = (oData.results || []).map(p => ({
                    id: p.ID,
                    name: p.projectName,
                    isNonProject: false
                }));
                oModel.setProperty("/projects", aProjects);
                resolve();
            },
            error: () => { oModel.setProperty("/projects", []); resolve(); }
        });
    });

    var loadNonProjects = new Promise(function (resolve) {
        oServiceModel.read("/AvailableNonProjectTypes", {
            success: function (oData) {
                let aNP = (oData.results || []).map(np => ({
                    id: np.ID,
                    name: np.typeName,
                    isNonProject: true
                }));
                oModel.setProperty("/nonProjects", aNP);
                resolve();
            },
            error: () => { oModel.setProperty("/nonProjects", []); resolve(); }
        });
    });

    var loadTasks = new Promise(function (resolve) {
        oServiceModel.read("/AvailableTaskTypes", {
            success: function (oData) {
                let aTasks = (oData.results || []).map(t => ({
                    type: t.code,
                    name: t.name
                }));
                oModel.setProperty("/workTypes", aTasks);
                resolve();
            },
            error: () => { oModel.setProperty("/workTypes", []); resolve(); }
        });
    });

    Promise.all([loadProjects, loadNonProjects, loadTasks]).then(function () {
        
        let weekInfo = that._getCurrentWeekDates();
        let isFuture = that._isFutureDate(value, weekInfo.weekStart, weekInfo.weekEnd);

        let allProjects = oModel.getProperty("/projects") || [];
        let allNonProjects = oModel.getProperty("/nonProjects") || [];
        let allTasks = oModel.getProperty("/workTypes") || [];

        if (isFuture) {
            // SHOW ONLY NON PROJECTS
            oModel.setProperty("/projectsToShow", allNonProjects);
            oModel.setProperty("/tasksToShow", []); // always disabled
            oModel.setProperty("/isTaskDisabled", true);

            // remove previously selected project if any
            if (newEntry.projectId) {
                newEntry.projectId = "";
                newEntry.projectName = "";
                oModel.setProperty("/newEntry", newEntry);
            }

        } else {
            // CURRENT WEEK → SHOW BOTH
             var projectsToShow = [
            ...allProjects.map(p => ({ id: p.id, name: p.name, isNonProject: false })),
            ...allNonProjects.map(np => ({ id: np.id, name: np.name, isNonProject: true }))
        ];
        oModel.setProperty("/projectsToShow", projectsToShow);

            // enable only if project selected
            // if (newEntry.projectId && !newEntry.nonProjectTypeID) {
            //     oModel.setProperty("/tasksToShow", allTasks);
            //     oModel.setProperty("/isTaskDisabled", false);
            // } else {
            //     // non-project selected OR nothing selected yet
            //     oModel.setProperty("/tasksToShow", []);
            //     oModel.setProperty("/isTaskDisabled", true);
            // }
        }
    });
},
// onSaveNewEntry: function () {
//     var oModel = this.getView().getModel("timeEntryModel");
//     var oNewEntry = oModel.getProperty("/newEntry") || {};
//     var that = this;

//     var hoursForDay = parseFloat(oNewEntry.hours) || 0;
//     if (hoursForDay <= 0 || hoursForDay > 15) {
//         sap.m.MessageBox.error("Hours must be between 0 and 15");
//         return false;
//     }

//     var selectedDateStr = oNewEntry.selectedDate;
//     var dayProp = this._dayPropertyFromDate(selectedDateStr); 
//     var hoursProp = dayProp + "Hours";
//     var taskProp = dayProp + "TaskDetails";

//     // 🔹 Always check backend first
//     var oService = this.getOwnerComponent().getModel("timesheetServiceV2");
//     let employeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d491";

//     // Build backend filter for existing task
//     var filters = [
//         new sap.ui.model.Filter("employee_ID", sap.ui.model.FilterOperator.EQ, employeeID),
//         new sap.ui.model.Filter("task", sap.ui.model.FilterOperator.EQ, oNewEntry.workType)
//     ];

//     oService.read("/MyTimesheets", {
//         filters: filters,
//         success: function(oData) {
//             let results = oData?.results || [];
//             let existingEntry = results.length ? results[0] : null;

//             if (existingEntry) {
//                 // Update only the selected day
//                 var payloadUpdate = {};
//                 payloadUpdate[hoursProp] = Number(hoursForDay).toFixed(2);
//                 payloadUpdate[taskProp] = oNewEntry.taskDetails || "";

//                 oService.update("/MyTimesheets(guid'" + existingEntry.ID + "')", payloadUpdate, {
//                     success: function() {
//                         sap.m.MessageToast.show("Entry updated successfully!");
//                         that._loadTimeEntriesFromBackend(); // Refresh model
//                     },
//                     error: function() {
//                         sap.m.MessageBox.error("Failed to update entry!");
//                     }
//                 });

//             } else {
//                 // Create new row
//                 var newRow = {
//                     employee_ID: employeeID,
//                     project_ID: oNewEntry.projectId || null,
//                     projectName: oNewEntry.projectName || "",
//                     task: oNewEntry.workType || "",
//                     status: "Draft",
//                     isBillable: true
//                 };

//                 // Init all days empty
//                 ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].forEach(day => {
//                     newRow[day + "Hours"] = "0.00";
//                     newRow[day + "TaskDetails"] = "";
//                     newRow[day + "Date"] = null;
//                 });

//                 // Set only selected day
//                 newRow[hoursProp] = Number(hoursForDay).toFixed(2);
//                 newRow[taskProp] = oNewEntry.taskDetails || "";
//                 newRow[dayProp + "Date"] = `/Date(${new Date(selectedDateStr).getTime()})/`;

//                 oService.create("/MyTimesheets", newRow, {
//                     success: function() {
//                         sap.m.MessageToast.show("New entry created!");
//                         that._loadTimeEntriesFromBackend();
//                     },
//                     error: function() {
//                         sap.m.MessageBox.error("Failed to create new entry!");
//                     }
//                 });
//             }
//         },
//         error: function(err) {
//             console.error(err);
//             sap.m.MessageBox.error("Failed to check existing entries!");
//         }
//     });

//     return true;
// },
_fetchWeekBoundaries: function (selectedDateStr) {
    var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    return new Promise((resolve, reject) => {
        oModel.callFunction("/getWeekBoundaries", {
            method: "GET",
            urlParameters: { workDate: selectedDateStr },
            success: function (oData) {
                resolve(oData);
            },
            error: reject
        });
    });
},
_fetchNonProjectBackendData: function (typeCode) {
    var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    return new Promise((resolve, reject) => {
        oModel.read("/AvailableNonProjectTypes", {
            success: function (oData) {
                let list = oData?.results || [];
                let found = list.find(t =>
                    t.Code === typeCode || t.ID === typeCode || t.Name === typeCode
                );

                if (!found) {
                    reject(`Non-Project type '${typeCode}' not found in backend`);
                } else {
                    resolve(found);
                }
            },
            error: reject
        });
    });
},
onAddEntry: function () {
    var that = this;
    var oModel = this.getView().getModel("timeEntryModel");
    var oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    var today = new Date();
    var startWeekDate = this._currentWeekStartDate || new Date();
var selectedDateStr = this._formatDateForModel(startWeekDate);

    // Initialize newEntry with empty/default values
    oModel.setProperty("/newEntry", {
        selectedDate: selectedDateStr,
        projectId: "",               // will hold MyProject ID
        projectName: "",             // will hold MyProject Name
        nonProjectTypeID: "",        // will hold NonProject ID
        nonProjectTypeName: "",      // will hold NonProject Name
        workType: "",
        hours: "",
        taskDetails: "",
        dailyComments: {}
    });

    // Load Projects
    var loadProjects = new Promise(function (resolve) {
        oServiceModel.read("/MyProjects", {
            success: function (oData) {
                var aProjects = oData.results.map(p => ({
                    projectId: p.ID,
                    projectName: p.projectName
                }));
                oModel.setProperty("/projects", aProjects);
                resolve();
            },
            error: function () {
                oModel.setProperty("/projects", []);
                resolve();
            }
        });
    });

    // Load Non-Projects
    var loadNonProjects = new Promise(function (resolve) {
        oServiceModel.read("/AvailableNonProjectTypes", {
            success: function (oData) {
                var aNonProjects = oData.results.map(np => ({
                    nonProjectTypeID: np.ID,
                    nonProjectTypeName: np.typeName
                }));
                oModel.setProperty("/nonProjects", aNonProjects);
                resolve();
            },
            error: function () {
                oModel.setProperty("/nonProjects", []);
                resolve();
            }
        });
    });

    // Load Task types
    var loadTasks = new Promise(function (resolve) {
        oServiceModel.read("/AvailableTaskTypes", {
            success: function (oData) {
                var aTasks = oData.results.map(t => ({
                    type: t.code,
                    name: t.name
                }));
                oModel.setProperty("/workTypes", aTasks);
                resolve();
            },
            error: function () {
                oModel.setProperty("/workTypes", []);
                resolve();
            }
        });
    });

    // Open dialog after all promises
    Promise.all([loadProjects, loadNonProjects, loadTasks]).then(function () {
         var startWeekDate = that._currentWeekStartDate || new Date(); // Monday of displayed week
var today = new Date();
today.setHours(0,0,0,0); // ignore time
startWeekDate.setHours(0,0,0,0);

var isFutureWeek = startWeekDate > today;
var allProjects = oModel.getProperty("/projects") || [];
var allNonProjects = oModel.getProperty("/nonProjects") || [];

if (isFutureWeek) {
    // Future week → only NON projects
    var projectsToShow = allNonProjects.map(np => ({ 
        id: np.nonProjectTypeID, 
        name: np.nonProjectTypeName, 
        isNonProject: true 
    }));
    oModel.setProperty("/projectsToShow", projectsToShow);
    oModel.setProperty("/tasksToShow", []); 
    oModel.setProperty("/isTaskDisabled", true);
} else {
    // Current week → show all projects
    var projectsToShow = [
        ...allProjects.map(p => ({ id: p.projectId, name: p.projectName, isNonProject: false })),
        ...allNonProjects.map(np => ({ id: np.nonProjectTypeID, name: np.nonProjectTypeName, isNonProject: true }))
    ];
    oModel.setProperty("/projectsToShow", projectsToShow);
    oModel.setProperty("/tasksToShow", oModel.getProperty("/workTypes") || []);
    oModel.setProperty("/isTaskDisabled", true); // can adjust if needed
}

    // oModel.setProperty("/projectsToShow", projectsToShow);
    // oModel.setProperty("/tasksToShow", oModel.getProperty("/workTypes") || []);
    // oModel.setProperty("/isTaskDisabled", true);

    if (!that._oAddEntryDialog) {
        that._oAddEntryDialog = sap.ui.xmlfragment(
            that.getView().getId(),
            "employee.Fragments.AddTimeEntry",
            that
        );
        that.getView().addDependent(that._oAddEntryDialog);
    }

    // 🔥 Reset fragment fields here
    that._oAddEntryDialog.getContent().forEach(function (control) {
        if (control.setValue) control.setValue("");        
        if (control.setSelectedKey) control.setSelectedKey(""); 
        if (control.setSelectedIndex) control.setSelectedIndex(-1);
    });

    that._oAddEntryDialog.open();
});

},
_getWeekStartDate: function(oDate) {
    var date = new Date(oDate);
    var day = date.getDay(); // Sunday=0, Monday=1...
    var diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when Sunday
    return new Date(date.setDate(diff));
},

// Handler for project/non-project selection
onProjectChange: function (oEvent) {
    var oModel = this.getView().getModel("timeEntryModel");
    var selectedItem = oEvent.getSource().getSelectedItem();
    if (!selectedItem) return;

    var key = selectedItem.getKey();
    var text = selectedItem.getText();
    var list = oModel.getProperty("/projectsToShow") || [];
    var selected = list.find(p => p.id === key);

    if (selected.isNonProject) {
        oModel.setProperty("/newEntry/nonProjectTypeID", key);
        oModel.setProperty("/newEntry/nonProjectTypeName", text);
        oModel.setProperty("/newEntry/projectId", "");
        oModel.setProperty("/newEntry/projectName", "");
        oModel.setProperty("/tasksToShow", []);
        oModel.setProperty("/isTaskDisabled", true);
    } else {
        oModel.setProperty("/newEntry/projectId", key);
        oModel.setProperty("/newEntry/projectName", text);
        oModel.setProperty("/newEntry/nonProjectTypeID", "");
        oModel.setProperty("/newEntry/nonProjectTypeName", "");
        oModel.setProperty("/tasksToShow", oModel.getProperty("/workTypes"));
        oModel.setProperty("/isTaskDisabled", false);
    }
},
onSaveNewEntry: function() {
    var oModel = this.getView().getModel("timeEntryModel");
    var oNewEntry = oModel.getProperty("/newEntry") || {};
    var that = this;

    // if (!this._validateMandatoryFields(oNewEntry)) return false;

    var hoursForDay = parseFloat(oNewEntry.hours) || 0;
    if (hoursForDay <= 0 || hoursForDay > 15) {
        sap.m.MessageBox.error("Hours must be between 0 and 15");
        return false;
    }

    var selectedDateStr = oNewEntry.selectedDate;
    var dayProp = this._dayPropertyFromDate(selectedDateStr); 
    var hoursProp = dayProp + "Hours";
    var taskProp = dayProp + "TaskDetails";

    // Prepare payload
    var newRow = {
        employee_ID: oNewEntry.employee_ID || null,
        project_ID: null,
        nonProjectType_ID: null,
        projectName: oNewEntry.projectName || "",
        nonProjectTypeName: oNewEntry.nonProjectTypeName,
        nonProjectTypeID: oNewEntry.nonProjectTypeID,
        task: oNewEntry.workType || "",
        status: "Draft",
        isBillable: oNewEntry.isBillable,
        mondayHours: "0.00", mondayTaskDetails: "", mondayDate: null,
        tuesdayHours: "0.00", tuesdayTaskDetails: "", tuesdayDate: null,
        wednesdayHours: "0.00", wednesdayTaskDetails: "", wednesdayDate: null,
        thursdayHours: "0.00", thursdayTaskDetails: "", thursdayDate: null,
        fridayHours: "0.00", fridayTaskDetails: "", fridayDate: null,
        saturdayHours: "0.00", saturdayTaskDetails: "", saturdayDate: null,
        sundayHours: "0.00", sundayTaskDetails: "", sundayDate: null
    };

    // Set hours and task for selected day
    newRow[hoursProp] = hoursForDay;
    newRow[taskProp] = oNewEntry.taskDetails || "";

    // Decide project vs non-project
    if (oNewEntry.isBillable) {
        // non-project
        newRow.nonProjectType_ID = oNewEntry.projectId;
        newRow.project_ID = null;
    } else {
        // real project
        newRow.project_ID = oNewEntry.projectId;
        newRow.nonProjectType_ID = null;
    }

    // Persist
    this._fetchWeekBoundaries(selectedDateStr)
        .then(weekData => that._persistToBackend(newRow, selectedDateStr, weekData))
        .then(() => {
            that._loadTimeEntriesFromBackend();
            sap.m.MessageToast.show("Timesheet saved!");
        })
        .catch(err => {
            console.error("❌ Error while creating entry: ", err);
            sap.m.MessageBox.error("Failed to save timesheet.");
        });

    return true;
},

_getWeekStartEndOData: async function (dateStr) {
    if (!dateStr) {
        console.warn("No date provided to _getWeekStartEndOData");
        return { weekStart: null, weekEnd: null };
    }

    // Convert short MM/DD/YY → YYYY-MM-DD so backend understands
    function normalizeInput(d) {
        if (/^\d{2}\/\d{2}\/\d{2}$/.test(d)) {
            let [mm, dd, yy] = d.split("/");
            return `20${yy}-${mm}-${dd}`; // → "2025-11-26"
        }
        return d; // return untouched YYYY-MM-DD or DD/MM/YYYY
    }

    let normalizedDate = normalizeInput(dateStr);

    try {
        let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
        let result = await new Promise((resolve, reject) => {
            oModel.callFunction("/getWeekBoundaries", {
                method: "GET",
                urlParameters: { workDate: normalizedDate },
                success: resolve,
                error: reject
            });
        });

        // Ensure backend returned valid boundaries
        if (!result?.weekStart || !result?.weekEnd) {
            console.warn("Backend did not return a valid week boundary for:", dateStr);
            return { weekStart: null, weekEnd: null };
        }

        return {
            weekStart: result.weekStart, // e.g. "2025-11-17"
            weekEnd: result.weekEnd      // e.g. "2025-11-23"
        };

    } catch (err) {
        console.error("Failed fetching week boundaries from backend:", err);
        return { weekStart: null, weekEnd: null };
    }
},

_persistToBackend: async function (entry, selectedDateStr, weekData) {
    var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    let that = this;
    var dayProp = this._dayPropertyFromDate(selectedDateStr);
    if (!dayProp) return Promise.reject("Invalid day property");

    var oNewEntry = this.getView().getModel("timeEntryModel").getProperty("/newEntry") || {};
    var hours = Number(entry[dayProp + "Hours"]) || 0;
    var task = oNewEntry.taskDetails || "";
    entry[dayProp + "TaskDetails"] = task;

    let employeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d491";
   // 🔹 Always compute week boundary for selected date
let weekBoundary = await this._getWeekStartEndOData(selectedDateStr);
console.log("Week boundary:", weekBoundary);

let weekStart = weekBoundary.weekStart;
let weekEnd = weekBoundary.weekEnd;




    // day map
    let dayMap = {
        monday: "mondayDate",
        tuesday: "tuesdayDate",
        wednesday: "wednesdayDate",
        thursday: "thursdayDate",
        friday: "fridayDate",
        saturday: "saturdayDate",
        sunday: "sundayDate"
    };
    let dayDateField = dayMap[dayProp];

    function toODataDate(str) {
        return `/Date(${new Date(str).getTime()})/`;
    }

    var payloadFull = {
        employee_ID: employeeID,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        project_ID: entry.project_ID || null,
        projectName: entry.projectName,
        nonProjectType_ID: entry.nonProjectTypeID,
        nonProjectTypeName: entry.nonProjectTypeName,
        task: entry.task,
        status: "Draft",
        isBillable: true,
        mondayHours: entry.mondayHours, mondayTaskDetails: entry.mondayTaskDetails || "", mondayDate: null,
        tuesdayHours: entry.tuesdayHours, tuesdayTaskDetails: entry.tuesdayTaskDetails || "", tuesdayDate: null,
        wednesdayHours: entry.wednesdayHours, wednesdayTaskDetails: entry.wednesdayTaskDetails || "", wednesdayDate: null,
        thursdayHours: entry.thursdayHours , thursdayTaskDetails: entry.thursdayTaskDetails || "", thursdayDate: null,
        fridayHours: entry.fridayHours, fridayTaskDetails: entry.fridayTaskDetails || "", fridayDate: null,
        saturdayHours: entry.saturdayHours, saturdayTaskDetails: entry.saturdayTaskDetails || "", saturdayDate: null,
        sundayHours: entry.sundayHours, sundayTaskDetails: entry.sundayTaskDetails || "", sundayDate: null
    };

    payloadFull[dayDateField] = toODataDate(selectedDateStr);

    var payloadUpdate = {
        [`${dayProp}Hours`]: hours.toFixed(2),
        [`${dayProp}TaskDetails`]: task
    };

    return new Promise((resolve, reject) => {
        oModel.read("/MyTimesheets", {
            filters: [ new sap.ui.model.Filter({ path: "employee_ID", operator: "EQ", value1: employeeID }) ],
            success: function (oData) {
                let items = oData?.results || [];

                // 🔹 Calculate total hours for this day/column
                // Convert OData date "/Date(1731887400000)/" → "2025-11-18"
function normalizeDate(d) {
    if (!d) return null;
    try {
        return new Date(d).toISOString().split("T")[0]; // → "2025-11-17"
    } catch(e) {
        return null;
    }
}

let dayMap = {
    monday: "mondayDate",
    tuesday: "tuesdayDate",
    wednesday: "wednesdayDate",
    thursday: "thursdayDate",
    friday: "fridayDate",
    saturday: "saturdayDate",
    sunday: "sundayDate"
};

let dayDateField = dayMap[dayProp];

// Filter for same DATE only
let filteredItems = items.filter(i => {
    let storedDate = normalizeDate(i[dayDateField]);
    return storedDate && storedDate === selectedDateStr;
});

// Sum only hours of that date
let currentTotal = filteredItems.reduce((sum, i) =>
    sum + (Number(i[dayProp + "Hours"]) || 0), 0
);

// If same task exists, subtract before re-adding
let exist = filteredItems.find(x => x.task === payloadFull.task);
if (exist) {
    currentTotal -= Number(exist[dayProp + "Hours"]) || 0;
}

let dailyTotals = oModel.getProperty("/dailyTotals") || {};
let currentTotalForDay = Number(dailyTotals[dayProp] || 0);
let newHours = Number(hours) || 0;

// DAILY LIMIT CHECK → Max 15 hrs per day
let newTotal = currentTotal + Number(hours);

if (newTotal > 15) {
    sap.m.MessageBox.error(
        `Woah steady there 😅 You can only log 15 hours max on ${selectedDateStr}.`
    );
    if (that._oAddEntryDialog) {
        that._oAddEntryDialog.close();
    }
    return;
}

// ---------------- PREVENT DUPLICATE PROJECT + TASK FOR SAME DATE ----------------
// let duplicate = items.find(i => {
//     let sameProject = 
//         (i.project_ID && i.project_ID === entry.project_ID) ||
//         (i.nonProjectType_ID && i.nonProjectType_ID === entry.nonProjectTypeID);

//     let sameTask = i.task === entry.task;

//     return sameProject && sameTask;
// });

// if (duplicate) {
//     sap.m.MessageBox.error(
//         "Bruh… you already logged this project & task for this date. No duplicates allowed. 😅"
//     );
//     if (that._oAddEntryDialog) {
//         that._oAddEntryDialog.close();
//     }
//     return;
// }



                if (exist) {
                    // Update existing
                    oModel.update("/MyTimesheets(guid'" + exist.ID + "')", payloadUpdate, {
                        success: function(oData){
                            if(that._oAddEntryDialog){ that._oAddEntryDialog.close(); }
                            sap.m.MessageToast.show("Timesheet updated successfully!");
                            resolve(oData);
                        },
                        error: reject
                    });
                } else {
                    // Create new
                    oModel.create("/MyTimesheets", payloadFull, {
                        success: function (data) {
                            if(that._oAddEntryDialog){ that._oAddEntryDialog.close(); }
                            oModel.setProperty("/projectsToShow", []);
oModel.setProperty("/tasksToShow", []);
                            sap.m.MessageToast.show("Timesheet saved!");
                            resolve(data);
                        },
                        error: function (err) {
                            sap.m.MessageBox.error("Failed to save timesheet. Check mandatory fields.");
                            reject(err);
                        }
                    });
                }
            },
            error: reject
        });
    });
},




 validateDailyHours: async function(employeeId, workDate, hoursToAdd, existingTaskId = null) {
    let entries = await SELECT.from("MyTimesheets")
        .where({ employee_ID: employeeId, workDate: workDate });

    let total = 0;

    for (let e of entries) {
        total += Number(e.hours || 0);
    }

    if (existingTaskId) {
        let found = entries.find(x => x.ID === existingTaskId);
        if (found) {
            total -= Number(found.hours || 0);
        }
    }

    return (total + hoursToAdd) <= 15;
},
// _persistToBackend: function (entry, selectedDateStr) {
//     var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");

//     // Ensure selectedDateStr is in DD/MM/YYYY format before processing
    

//     var dayProp = this._dayPropertyFromDate(selectedDateStr);
//     if (!dayProp) {
//         console.error("❌ dayProp is undefined for date:", selectedDateStr);
//         return Promise.reject("Invalid day property");
//     }

//     var oNewEntry = this.getView().getModel("timeEntryModel").getProperty("/newEntry") || {};

//     var hours = entry[dayProp + "Hours"];
//     var task = oNewEntry.taskDetails || "";

//     // Update UI model so UI stays in sync
//     entry[dayProp + "TaskDetails"] = task;

//     let employeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d490";
//     let workDateOData = this._formatDateForOData(selectedDateStr);
//     let { weekStart, weekEnd } = this._getWeekStartEndOData(selectedDateStr);


//     var payload = {
//         employee_ID: employeeID,
//         project_ID: entry.projectId,
//         task: entry.workType,
//         mondayHours: entry.mondayHours,
//         mondayTaskDetails: entry.mondayTaskDetails,
//         tuesdayHours: entry.tuesdayHours,
//         tuesdayTaskDetails: entry.tuesdayTaskDetails,
//         wednesdayHours: entry.wednesdayHours,
//          weekStartDate: weekStart,
//     weekEndDate: weekEnd,
//         wednesdayTaskDetails: entry.wednesdayTaskDetails,
//         thursdayHours: entry.thursdayHours,
//         thursdayTaskDetails: entry.thursdayTaskDetails,
//         fridayHours: entry.fridayHours,
//         fridayTaskDetails: entry.fridayTaskDetails,
//         saturdayHours: entry.saturdayHours,
//         saturdayTaskDetails: entry.saturdayTaskDetails,
//         sundayHours: entry.sundayHours,
//         sundayTaskDetails: entry.sundayTaskDetails,
//         status: "Draft",
//         isBillable: true
//     };

//     return new Promise((resolve, reject) => {
//         oModel.create("/MyTimesheets", payload, {
//             success: resolve,
//             error: reject
//         });
//     });
// },
_getWeekStartEndOData: async function (dateStr) {
    if (!dateStr) {
        console.warn("No date provided to _getWeekStartEndOData");
        return { weekStart: null, weekEnd: null };
    }

    let parsed = this._parseToDate(dateStr);
    if (!parsed) {
        return { weekStart: null, weekEnd: null };
    }

    // Determine if this selected date is in current week
    let today = new Date();
    let selectedWeek = this._getWeekRange(parsed);
    let currentWeek = this._getWeekRange(today);

    let isCurrentWeek =
        selectedWeek.start === currentWeek.start &&
        selectedWeek.end === currentWeek.end;

    if (isCurrentWeek) {
        console.warn("Selected date is in CURRENT week → Using Backend Boundaries");
        return await this._callBackendWeekBoundaryAPI(parsed);
    }

    console.warn("Selected date is NOT current week → Using Local Calculation");
    return this._calculateWeekBoundaryFromDate(parsed);
},
_parseToDate: function(dateStr) {
    try {
        let d;

        if (dateStr.includes("-")) {
            let p = dateStr.split("-");
            if (p.length !== 3) return null;
            d = new Date(p[0], p[1] - 1, p[2]);
        } else if (dateStr.includes("/")) {
            let p = dateStr.split("/");
            if (p.length !== 3) return null;
            let f = Number(p[0]), s = Number(p[1]), t = Number(p[2]);
            if (f > 12) {
                d = new Date(t < 100 ? 2000 + t : t, s - 1, f); // DD/MM/YYYY
            } else {
                d = new Date(t < 100 ? 2000 + t : t, f - 1, s); // MM/DD/YYYY
            }
        } else return null;

        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
},
_calculateWeekBoundaryFromDate: function(date) {
    let day = date.getDay();
    let diff = (day === 0 ? -6 : 1 - day);

    let monday = new Date(date);
    monday.setHours(5, 30, 0, 0);
    monday.setDate(date.getDate() + diff);

    let sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        weekStart: `/Date(${monday.getTime()})/`,
        weekEnd: `/Date(${sunday.getTime()})/`
    };
},
_getWeekRange: function(date) {
    let d = new Date(date);
    let diff = (d.getDay() === 0 ? -6 : 1 - d.getDay());

    let monday = new Date(d);
    monday.setDate(d.getDate() + diff);

    let sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    let fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    return { start: fmt(monday), end: fmt(sunday) };
},

// -------------- helper functions -------------------
_callBackendWeekBoundaryAPI: function (jsDateObj) {
    return new Promise((resolve, reject) => {
        try {
            if (!(jsDateObj instanceof Date) || isNaN(jsDateObj.getTime())) {
                console.warn("Invalid date supplied to backend week boundary call.");
                return resolve({ weekStart: null, weekEnd: null });
            }

            let yyyy = jsDateObj.getFullYear();
            let mm = String(jsDateObj.getMonth() + 1).padStart(2, "0");
            let dd = String(jsDateObj.getDate()).padStart(2, "0");
            let formatted = `${yyyy}-${mm}-${dd}`;   // Backend-friendly format

            let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
            let sPath = `/getWeekBoundaries?date='${formatted}'`;

            oModel.read(sPath, {
                success: (oData) => {
                    if (oData && oData.getWeekBoundaries.weekStart && oData.getWeekBoundaries.weekEnd) {
                        resolve({
                            weekStart: oData.getWeekBoundaries.weekStart,
                            weekEnd: oData.getWeekBoundaries.weekEnd
                        });
                    } else {
                        console.warn("Backend returned no week boundary values");
                        resolve({ weekStart: null, weekEnd: null });
                    }
                },
                error: (err) => {
                    console.error("Backend week boundary error:", err);
                    resolve({ weekStart: null, weekEnd: null });
                }
            });
        } catch (err) {
            console.error("Unhandled error calling week boundary API:", err);
            resolve({ weekStart: null, weekEnd: null });
        }
    });
},


/**
 * Convert "YYYY-MM-DD" (or Date) to OData date string "YYYY-MM-DDT00:00:00"
 */
_formatDateForOData: function(dateStr) {
    if (!dateStr) return null;

    let [dd, mm, yyyy] = dateStr.split("/");
    return `datetime('${yyyy}-${mm}-${dd}T00:00:00')`;
},


/**
 * Return day property name for a given "YYYY-MM-DD"
 */
_dayPropertyFromDate: function (dateStr) {
    if (!dateStr) return undefined;

    let day, month, year;

    // Normalize: trim extra spaces
    dateStr = dateStr.trim();

    // Case 1: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        [year, month, day] = dateStr.split("-");
    }

    // Case 2: DD/MM/YYYY or DD/MM/YY
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
        let parts = dateStr.split("/");

        // Fix reversed input like MM/DD/YY
        let p1 = parseInt(parts[0], 10);
        let p2 = parseInt(parts[1], 10);

        // If first part can be month and second is >12 → swap (user typo)
        if (p1 <= 12 && p2 > 12) {
            parts = [parts[1], parts[0], parts[2]];
        }

        day = parts[0].padStart(2, "0");
        month = parts[1].padStart(2, "0");
        year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
    }

    else {
        return undefined;
    }

    // Build VALID date → this fixes next month/year transitions
    let dateObj = new Date(Number(year), Number(month) - 1, Number(day));

    // Validate the letructed date strictly
    if (
        isNaN(dateObj.getTime()) ||
        dateObj.getFullYear() !== Number(year) ||
        dateObj.getMonth() + 1 !== Number(month) ||
        dateObj.getDate() !== Number(day)
    ) {
        return undefined;
    }

    let map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return map[dateObj.getDay()];
},


_mergePersistResultsIntoModel: function(results, aEntries, oModel) {
    var that = this;

    results.forEach(function(r) {
        // find entry matching project + workType
        var matching = aEntries.find(function(row) {
            return (row.projectId || null) === (r.response && r.response.project_ID || row.projectId) &&
                   (row.workType || "") === (r.response && r.response.task || row.workType);
        });

        // If no matching row found, fallback to first row with same workType
        if (!matching) {
            matching = aEntries.find(function(row) {
                return row.workType === (r.response && r.response.task) || row.workType === (r.workType || row.workType);
            });
        }

        // Determine day property from r.workDate
        var dayProp = that._dayPropertyFromDate(r.workDate);

        if (matching) {
            // ensure shapes exist
            matching.dailyTotals = matching.dailyTotals || {monday:0,tuesday:0,wednesday:0,thursday:0,friday:0,saturday:0,sunday:0};
            matching.dailyComments = matching.dailyComments || {monday:"",tuesday:"",wednesday:"",thursday:"",friday:"",saturday:"",sunday:""};

            // write values
            matching.dailyTotals[dayProp] = parseFloat(r.hours || 0);
            matching.dailyComments[dayProp] = r.taskDetails || "";

            // if server returned projectName or projectName present in response, update
            if (r.response && r.response.projectName) matching.projectName = r.response.projectName;
            if (r.response && r.response.ID) matching.id = matching.id && matching.id.startsWith("temp-") ? r.response.ID : matching.id;

        } else {
            // no existing row -> create one from r.response / payload
            var newRow = {
                id: r.response && r.response.ID ? r.response.ID : ("srv-" + Date.now()),
                projectId: r.response && r.response.project_ID ? r.response.project_ID : null,
                projectName: r.response && r.response.projectName ? r.response.projectName : (r.projectName || "Unknown"),
                workType: r.response && r.response.task ? r.response.task : (r.workType || ""),
                dailyTotals: {monday:0,tuesday:0,wednesday:0,thursday:0,friday:0,saturday:0,sunday:0},
                dailyComments: {monday:"",tuesday:"",wednesday:"",thursday:"",friday:"",saturday:"",sunday:""}
            };
            newRow.dailyTotals[dayProp] = parseFloat(r.hours || 0);
            newRow.dailyComments[dayProp] = r.taskDetails || "";
            aEntries.push(newRow);
        }
    });

    // update model and refresh table binding so UI immediately reflects server state
    oModel.setProperty("/timeEntries", aEntries);
    var oTable = this.getView().byId("timesheetTable");
    if (oTable && oTable.getBinding("items")) oTable.getBinding("items").refresh();
},




//Overflow button
//  onDayOverflowPress: function (oEvent) {
//     var oButton = oEvent.getSource();
//     var sDay = oButton.data("day");
//     var oContext = oButton.getBindingContext("timeEntryModel");

//     if (!oContext) {
//         sap.m.MessageToast.show("Unable to get entry data");
//         return;
//     }

//     var oEntry = oContext.getObject();
//     this._currentEditEntry = oEntry;
//     this._currentEditDay = sDay;

//     // 🧩 Use ActionSheet instead of Menu
//     if (!this._oDayActionSheet) {
//         this._oDayActionSheet = new sap.m.ActionSheet({
//             placement: sap.m.PlacementType.Auto,
//             buttons: [
//                 new sap.m.Button({
//                     text: "Edit Time",
//                     icon: "sap-icon://edit",
//                     press: this.onEditDayHours.bind(this)
//                 })
//             ]
//         });
//         this.getView().addDependent(this._oDayActionSheet);
//     }

//     this._oDayActionSheet.openBy(oButton);
// },

// onDeleteDayHours: function () {
//     var oEntry = this._currentEditEntry;
//     var sDay = this._currentEditDay;

//     if (!oEntry || !sDay) {
//         sap.m.MessageToast.show("Unable to delete. Please try again.");
//         return;
//     }

//     var fCurrentHours = parseFloat(oEntry[sDay]) || 0;

//     sap.m.MessageBox.confirm(
//         "Delete " + fCurrentHours.toFixed(2) + " hours for " +
//         this._capitalize(sDay) + "?\n\nProject: " + oEntry.projectName +
//         "\nWork Type: " + oEntry.workTypeName,
//         {
//             title: "Confirm Deletion",
//             onClose: function (oAction) {
//                 if (oAction === sap.m.MessageBox.Action.OK) {
//                     this._deleteHoursAuto(oEntry, sDay);
//                 }
//             }.bind(this)
//         }
//     );
// },

// _deleteHoursAuto: function (oEntry, sDay) {
//     let oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
//     let oModel = this.getView().getModel("timeEntryModel");
//     let aEntries = oModel.getProperty("/timeEntries") || [];
//     let that = this;

//     let iIndex = aEntries.findIndex(entry => entry.id === oEntry.id);
//     if (iIndex === -1) {
//         sap.m.MessageBox.error("Entry not found");
//         return;
//     }

//     // 🟡 Set the hours to 0 locally first
//     aEntries[iIndex][sDay] = 0;
//     oModel.setProperty("/timeEntries", aEntries);

//     // 🟢 Prepare backend update
//     let oWeekDates = oModel.getProperty("/weekDates");
//     let oDayDate = oWeekDates ? oWeekDates[sDay] : new Date();
//     let sWorkDateStr = this._formatDateForModel(oDayDate);

//     let sEmployeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d490";
//     let sProjectID = oEntry.projectId || oEntry.project_ID;
//     let sTask = oEntry.workType || oEntry.task;

//     let sFilter = `employee_ID eq '${sEmployeeID}' and project_ID eq '${sProjectID}' and task eq '${sTask}' and workDate eq datetime'${sWorkDateStr}T00:00:00'`;

//     sap.ui.core.BusyIndicator.show(0);
//     oServiceModel.read("/MyTimesheets", {
//         urlParameters: { $filter: sFilter },
//         success: function (oData) {
//             let existing = oData.results?.[0];
//             if (existing) {
//                 let oPayload = {
//                     hoursWorked: 0,
//                     status: "Draft"
//                 };

//                 // PATCH existing entry to set hours = 0
//                 oServiceModel.remove(`/MyTimesheets(guid'${existing.ID}')`, oPayload, {
//                     method: "PATCH",
//                     success: function () {
//                         sap.ui.core.BusyIndicator.hide();
//                         sap.m.MessageToast.show(`${that._capitalize(sDay)} hours deleted successfully`);
//                         that._loadTimeEntriesFromBackend();
//                     },
//                     error: function (oError) {
//                         sap.ui.core.BusyIndicator.hide();
//                         try {
//                             let response = JSON.parse(oError.responseText);
//                             let message = response?.error?.message?.value || "Failed to delete hours";
//                             sap.m.MessageBox.error(message);
//                         } catch (err) {
//                             sap.m.MessageBox.error("Unexpected error during deletion");
//                         }
//                         console.error("❌ Delete (zero-update) failed:", oError);
//                     }
//                 });
//             } else {
//                 sap.ui.core.BusyIndicator.hide();
//                 sap.m.MessageBox.error("No record found for this day to delete.");
//             }
//         },
//         error: function (err) {
//             sap.ui.core.BusyIndicator.hide();
//             console.error("❌ Error checking existing entry:", err);
//             sap.m.MessageBox.error("Failed to verify existing entries before deletion.");
//         }
//     });
// },


// working
// _saveEditedDayHoursAuto: function (oEntry, sDay, fNewHours, sTaskDetails) {
//     let oModel = this.getView().getModel("timeEntryModel");
//     let oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
//     let aEntries = oModel.getProperty("/timeEntries") || [];

//     let that = this;
//     let iIndex = aEntries.findIndex(entry => entry.id === oEntry.id);

//     if (iIndex === -1) {
//         sap.m.MessageBox.error("Entry not found");
//         return;
//     }

//     let previousHours = aEntries[iIndex][sDay];
//     let previousTask = aEntries[iIndex][sDay + "TaskDetails"];

//     // Update UI temp
//     aEntries[iIndex][sDay] = Number(fNewHours) || 0;
//     aEntries[iIndex][sDay + "TaskDetails"] = sTaskDetails || "";
//     oModel.setProperty("/timeEntries", aEntries);

//     let sEmployeeID = oEntry.employee_ID;
//     let sProjectID = oEntry.projectId || oEntry.project_ID;
//     let sTask = oEntry.workType || oEntry.task;
//     let sWorkDateStr = this._formatDateForOData(oEntry[sDay + "Date"]);

//     // Payload
//    let oPayload = {
//   [`${sDay}Hours`]: Number(fNewHours) || 0,
//   [`${sDay}TaskDetails`]: sTaskDetails || ""
// };


//     sap.ui.core.BusyIndicator.show(0);

//     // ⭐ If backend ID exists → update directly
//     if (oEntry.id) {
//         let sPath = `/MyTimesheets(guid'${oEntry.id}')`;

//         oServiceModel.update(sPath, oPayload, {
//             method: "PATCH",
//             success: function () {
//                 sap.ui.core.BusyIndicator.hide();
//                 sap.m.MessageToast.show(`${that._capitalize(sDay)} updated successfully`);
//                 that._loadTimeEntriesFromBackend();
//             },
//             error: function () {
//                 sap.ui.core.BusyIndicator.hide();
//                 aEntries[iIndex][sDay] = previousHours;
//                 aEntries[iIndex][sDay + "TaskDetails"] = previousTask;
//                 oModel.setProperty("/timeEntries", aEntries);
//                 sap.m.MessageBox.error("Failed to update entry");
//             }
//         });

//         return;
//     }

//     // ⭐ If NO backend ID → create new entry
//     oServiceModel.create("/MyTimesheets", oPayload, {
//         success: function () {
//             sap.ui.core.BusyIndicator.hide();
//             sap.m.MessageToast.show(`${that._capitalize(sDay)} entry created successfully`);
//             that._loadTimeEntriesFromBackend();
//         },
//         error: function () {
//             sap.ui.core.BusyIndicator.hide();
//             aEntries[iIndex][sDay] = previousHours;
//             aEntries[iIndex][sDay + "TaskDetails"] = previousTask;
//             oModel.setProperty("/timeEntries", aEntries);
//             sap.m.MessageBox.error("Failed to create entry");
//         }
//     });
// },


_saveEditedDayHoursAuto: function (oEntry, sDay, fNewHours, sTaskDetails) {
    let oModel = this.getView().getModel("timeEntryModel");
    let oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    let aEntries = oModel.getProperty("/timeEntries") || [];

    let iIndex = aEntries.findIndex(entry => entry.id === oEntry.id);
    if (iIndex === -1) {
        sap.m.MessageBox.error("Entry not found");
        return;
    }

    function normalizeDate(oDataDate) {
    if (!oDataDate) return null;

    // Handle OData /Date(XXXXXXXXXX)/ format
    if (typeof oDataDate === "string" && oDataDate.startsWith("/Date(")) {
        let timestamp = parseInt(oDataDate.match(/\/Date\((\d+)\)\//)[1], 10);
        let d = new Date(timestamp);
        return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
    }

    if (oDataDate instanceof Date) {
        return oDataDate.toISOString().split("T")[0];
    }

    return null;
}

// Inside your _saveEditedDayHoursAuto function
let dayDateFieldMap = {
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday"
};

// let dayDateField = dayMap[sDay];
let selectedDateStr = oEntry.dates ? oEntry.dates[dayDateFieldMap[sDay]] : null;

// Get previous hours for this cell
let previousHours = selectedDateStr ? Number(oEntry[sDay + "Hours"] || 0) : 0;



// // Get the date string of the selected cell
// let selectedDateStr = oEntry[dayDateField] ? normalizeDate(oEntry[dayDateField]) : null;

// // Find the previous hours only if this entry’s date matches the selected date
// let previousHours = (() => {
//     if (!selectedDateStr) return 0;
//     return Number(oEntry[sDay + "Hours"] || 0);
// })();

    let newHours = Number(fNewHours) || 0;

    // ✅ Column-level validation: total hours for this day must not exceed 15
    let currentTotal = aEntries.reduce((sum, entry, idx) => {
        if (idx === iIndex) {
            // use newHours for the cell being updated
            return sum + newHours;
        }
        return sum + Number(entry[sDay] || 0);
    }, 0);

    if (currentTotal >= 16) {
        sap.m.MessageBox.error(`Total hours for ${sDay.charAt(0).toUpperCase() + sDay.slice(1)} cannot exceed 15.`);
        return;
    }

    // Get current daily total for this column
let dailyTotals = oModel.getProperty("/dailyTotals") || {};
let currentTotalForDay = Number(dailyTotals[sDay] || 0);

// Calculate the new total if this cell is updated
let newTotalForDay = currentTotalForDay - previousHours + newHours;

// Column-level validation: total hours for the day must not exceed 15
if (newHours >= 15) {
    sap.m.MessageBox.error(`Total hours for ${sDay.charAt(0).toUpperCase() + sDay.slice(1)} cannot exceed 15.`);
    return;
}
if (newTotalForDay >= 15) {
    sap.m.MessageBox.error(`Total hours for ${sDay.charAt(0).toUpperCase() + sDay.slice(1)} cannot exceed 15.`);
    return;
}



    let previousTask = aEntries[iIndex][sDay + "TaskDetails"];
    let diff = newHours - previousHours;

    // 1️⃣ Update UI cell locally
    aEntries[iIndex][sDay] = newHours;
    aEntries[iIndex][sDay + "TaskDetails"] = sTaskDetails || "";
    oModel.setProperty("/timeEntries", aEntries);

    // 2️⃣ Prepare payload for backend
    let oPayload = {
        [`${sDay}Hours`]: newHours,
        [`${sDay}TaskDetails`]: sTaskDetails || ""
    };

    sap.ui.core.BusyIndicator.show(0);
    let sPath = oEntry.id ? `/MyTimesheets(guid'${oEntry.id}')` : "/MyTimesheets";

    let fnSuccess = () => {
        sap.ui.core.BusyIndicator.hide();
        sap.m.MessageToast.show(`${sDay.charAt(0).toUpperCase() + sDay.slice(1)} saved successfully`);

        // 3️⃣ Update totals immediately
        let dailyTotals = oModel.getProperty("/dailyTotals") || {};
        dailyTotals[sDay] = aEntries.reduce((sum, entry) => sum + Number(entry[sDay] || 0), 0);
        oModel.setProperty("/dailyTotals", dailyTotals);

        let totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
        oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

        // 4️⃣ Refresh time entries to show updated hours
        this._loadTimeEntriesFromBackend();
    };

    let fnError = () => {
        sap.ui.core.BusyIndicator.hide();
        // revert changes
        aEntries[iIndex][sDay] = previousHours;
        aEntries[iIndex][sDay + "TaskDetails"] = previousTask;
        oModel.setProperty("/timeEntries", aEntries);

        // revert totals
        let dailyTotals = oModel.getProperty("/dailyTotals") || {};
        dailyTotals[sDay] = aEntries.reduce((sum, entry) => sum + Number(entry[sDay] || 0), 0);
        oModel.setProperty("/dailyTotals", dailyTotals);
        oModel.setProperty("/totalWeekHours", Object.values(dailyTotals).reduce((a, b) => a + b, 0).toFixed(2));

        sap.m.MessageBox.error("Failed to save entry");
    };

    if (oEntry.id) {
        oServiceModel.update(sPath, oPayload, { method: "PATCH", success: fnSuccess, error: fnError });
    } else {
        oServiceModel.create(sPath, oPayload, { success: fnSuccess, error: fnError });
    }
},
// validateDailyHours: function (sDay, fNewHours, aEntries, oEditedEntry) {
//     let total = 0;

//     aEntries.forEach(entry => {
//         if (entry[sDay]) {
//             total += parseFloat(entry[sDay]) || 0;
//         }
//     });

//     // adjust for edited entry
//     let current = parseFloat(oEditedEntry[sDay]) || 0;
//     total = total - current + fNewHours;

//     if (total > 15) {
//         sap.m.MessageBox.error(`Total hours for ${this._capitalize(sDay)} cannot exceed 15 (Current: ${total.toFixed(2)})`);
//         return false;
//     }
//     return true;
// },




_capitalize: function (sText) {
    if (!sText || typeof sText !== "string") return "";
    return sText.charAt(0).toUpperCase() + sText.slice(1).toLowerCase();
},


 onEditDailyHours: function (oEvent) {
    var oButton = oEvent.getSource();
    var sDay = oButton.data("day");
    var oContext = oButton.getBindingContext("timeEntryModel");

    if (!oContext) {
        sap.m.MessageToast.show("Unable to get entry data");
        return;
    }

    var oEntry = oContext.getObject();
    this._currentEditEntry = oEntry;
    this._currentEditDay = sDay;
    var oEntry = this._currentEditEntry;
    var sDay = this._currentEditDay;

    if (!oEntry || !sDay) {
        sap.m.MessageToast.show("Unable to edit. Please try again.");
        return;
    }

    // derive field names
    var sHoursField = sDay + "Hours";
    var sTaskField = sDay + "TaskDetails";
    var sDateField = sDay + "Date";

    // safely read values
    var fCurrentHours = Number(oEntry[sHoursField]) || 0;
    var sCurrentTask = oEntry[sTaskField] || "";

    // format date ONLY if exists
var oW = this.getView().getModel("timeEntryModel").getProperty("/weekDates");
var sDateRaw = oW[sDay]; // actual date, e.g. 2025-11-16T00:00:00

var sDateValue = "";
if (sDateRaw) {
    try {
        var oDate = new Date(sDateRaw);
        sDateValue = oDate.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric"
        }); 
        // Result: "Nov 16, 2025"
    } catch (e) {
        console.warn("⚠ Failed to format date:", sDateRaw, e);
        sDateValue = ""; 
    }
}




    // Dropdown values 0–24
    var aHourOptions = [];
    for (var i = 0; i <= 15; i++) {
        aHourOptions.push(new sap.ui.core.Item({
            key: i.toString(),
            text: i + " hour" + (i !== 1 ? "s" : "")
        }));
    }

    // create controls with references
    var oHoursCombo = new sap.m.ComboBox({
        selectedKey: fCurrentHours.toString(),
        items: aHourOptions
    });

    var oTaskArea = new sap.m.TextArea({
        value: sCurrentTask,
        rows: 4,
        placeholder: "Describe work done..."
    });

  var oDialog = new sap.m.Dialog({
    title: "Edit " + this._capitalize(sDay) + " Entry",
    contentWidth: "350px",
    titleAlignment: "Center",
    content: [
        new sap.m.VBox({
            items: [
                // Date Field
                new sap.m.VBox({
                    items: [
                        new sap.m.Label({ 
                            text: "Date:",
                            design: "Bold"
                        }).addStyleClass("sapUiTinyMarginBottom"),
                        new sap.m.Input({ 
                            value: sDateValue, 
                            editable: false 
                        })
                    ]
                }).addStyleClass("sapUiTinyMarginBottom"),

                // Project Field
                new sap.m.VBox({
                    items: [
                        new sap.m.Label({ 
                            text: "Project:",
                            design: "Bold"
                        }).addStyleClass("sapUiTinyMarginBottom"),
                        new sap.m.Input({ 
                            value: oEntry.projectName, 
                            editable: false 
                        })
                    ]
                }).addStyleClass("sapUiTinyMarginBottom"),

                // Task Type Field
                new sap.m.VBox({
                    items: [
                        new sap.m.Label({ 
                            text: "Task Type:",
                            design: "Bold"
                        }).addStyleClass("sapUiTinyMarginBottom"),
                        new sap.m.Input({ 
                            value: oEntry.workType, 
                            editable: false 
                        })
                    ]
                }).addStyleClass("sapUiTinyMarginBottom"),

                // Hours Field
                new sap.m.VBox({
                    items: [
                        new sap.m.Label({ 
                            text: "Hours:",
                            design: "Bold",
                            required: true
                        }).addStyleClass("sapUiTinyMarginBottom"),
                        oHoursCombo
                    ]
                }).addStyleClass("sapUiTinyMarginBottom"),

                // Task Details Field
                new sap.m.VBox({
                    items: [
                        new sap.m.Label({ 
                            text: "Task Details:",
                            design: "Bold"
                        }).addStyleClass("sapUiTinyMarginBottom"),
                        oTaskArea.setRows(4).setWidth("100%")
                    ]
                })
            ]
        }).addStyleClass("sapUiMediumMarginBeginEnd sapUiSmallMarginTopBottom")
    ],
    beginButton: new sap.m.Button({
        text: "Save",
        type: "Emphasized",
        icon: "sap-icon://save",
        press: function () {
            var fNewHours = Number(oHoursCombo.getSelectedKey());
            var sTaskDetails = oTaskArea.getValue();

            if (isNaN(fNewHours) || fNewHours < 0 || fNewHours > 24) {
                sap.m.MessageBox.error("Please select valid hours between 0 and 24");
                return;
            }

            this._saveEditedDayHoursAuto(oEntry, sDay, fNewHours, sTaskDetails);
            oDialog.close();
        }.bind(this)
    }),
    endButton: new sap.m.Button({
        text: "Cancel",
        icon: "sap-icon://decline",
        press: function () { 
            oDialog.close(); 
        }
    }),
    afterClose: function () { 
        oDialog.destroy(); 
    }
});

    this.getView().addDependent(oDialog);
    
    oDialog.open();

    
},

_validateMandatoryFields: function(entry) {
    if (!entry) {
        sap.m.MessageBox.error("No entry data found.");
        return false;
    }

    // Check project
    if (!entry.projectId || entry.projectId.trim() === "") {
        sap.m.MessageBox.error("Please select a Project.");
        return false;
    }

    // Check work type / task
    // if (!entry.workType || entry.workType.trim() === "") {
    //     sap.m.MessageBox.error("Please select Work Type.");
    //     return false;
    // }

    // Check hours
    let hours = parseFloat(entry.hours);
    if (isNaN(hours) || hours <= 0 || hours > 15) {
        sap.m.MessageBox.error("Hours must be between 0 and 15.");
        return false;
    }

    // Optional: check task details
    if (!entry.taskDetails || entry.taskDetails.trim() === "") {
        sap.m.MessageBox.error("Please enter Task Details.");
        return false;
    }

    // Optional: dailyComments check (if required)
    // if (!entry.dailyComments || Object.keys(entry.dailyComments).length === 0) {
    //     sap.m.MessageBox.error("Please enter daily comments.");
    //     return false;
    // }

    return true; // All validations passed
},

// _resetOrLoadWeekEntries: function(oDate) {
//     var oView = this.getView();
//     var oModel = oView.getModel("timeEntryModel");
//     var oMaster = oView.getModel("masterEntriesModel");

//     var weekKey = this._formatDateForModel(oDate); // Monday as key
//     var allEntries = oMaster.getProperty("/allTimeEntries") || {};

//     // If we already have entries for this week, load them
//     var aEntries = allEntries[weekKey];
//     if (!aEntries) {
//         // No entries → create new from current model
//         aEntries = oModel.getProperty("/timeEntries") || [];
//         aEntries.forEach(function(entry){
//             entry.dailyTotals = { monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0, sunday:0 };
//             entry.dailyComments = { monday:"", tuesday:"", wednesday:"", thursday:"", friday:"", saturday:"", sunday:"" };
//         });
//         allEntries[weekKey] = JSON.parse(JSON.stringify(aEntries));
//         oMaster.setProperty("/allTimeEntries", allEntries);
//     }

//     // Load entries into working model
//     oModel.setProperty("/timeEntries", JSON.parse(JSON.stringify(aEntries)));

//     // Recalculate totals for display
//     var totals = { monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0, sunday:0 };
//     aEntries.forEach(function(entry){
//         totals.monday += entry.dailyTotals?.monday || 0;
//         totals.tuesday += entry.dailyTotals?.tuesday || 0;
//         totals.wednesday += entry.dailyTotals?.wednesday || 0;
//         totals.thursday += entry.dailyTotals?.thursday || 0;
//         totals.friday += entry.dailyTotals?.friday || 0;
//         totals.saturday += entry.dailyTotals?.saturday || 0;
//         totals.sunday += entry.dailyTotals?.sunday || 0;
//     });
//     oModel.setProperty("/dailyTotals", totals);

//     // Also store current week key in model for reference
//     oModel.setProperty("/currentWeekKey", weekKey);

//     // Refresh table
//     var oTable = oView.byId("timesheetTable");
//     if (oTable && oTable.getBinding("items")) {
//         oTable.getBinding("items").refresh();
//     }
// },
// Utility: parse OData /Date(XXXX)/ to JS Date
_parseODataDate: function(s) {
    if (!s) return null;
    let match = /\/Date\((\d+)\)\//.exec(s);
    return match ? new Date(parseInt(match[1], 10)) : null;
},

_loadWeekEntries: function(mondayDate) {
    let oService = this.getOwnerComponent().getModel("timesheetServiceV2");
    let oModel = this.getView().getModel("timeEntryModel");

    let sWeekStart = this._formatDateForModel(mondayDate);
    let sWeekEnd = this._formatDateForModel(new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6));

    let rawFilter = `weekStartDate eq datetime'${sWeekStart}T00:00:00' and weekEndDate eq datetime'${sWeekEnd}T00:00:00'`;
    console.log("Filter:", rawFilter);

    oService.read("/MyTimesheets", {
        urlParameters: { "$filter": rawFilter },
        success: function(oData) {
            sap.ui.core.BusyIndicator.hide();
            let results = oData.d?.results || oData.results || [];

            // Filter the response to make sure weekStartDate & weekEndDate match exactly
          let weekDataFromBackend = results.filter(item => {
    let itemWeekStart = item.weekStartDate ? new Date(item.weekStartDate).toISOString().split("T")[0] : null;
    let itemWeekEnd   = item.weekEndDate   ? new Date(item.weekEndDate).toISOString().split("T")[0]   : null;

    let start = new Date(sWeekStart).toISOString().split("T")[0];
    let end   = new Date(sWeekEnd).toISOString().split("T")[0];

    return itemWeekStart === start && itemWeekEnd === end;
});



            let weekData;

           if (weekDataFromBackend.length > 0) {

    weekData = weekDataFromBackend.map(item => {
        
        // If projectName is empty → use nonProjectTypeName instead
        let finalProjectName = item.projectName 
                                 ? item.projectName 
                                 : item.nonProjectTypeName || "";

        return {
            id: item.ID,
            projectId: item.project_ID,
            projectName: finalProjectName,   // 🔥 THIS IS THE FIX
            nonProjectType_ID: item.nonProjectType_ID,
            nonProjectTypeName: item.nonProjectTypeName,
            workType: item.task || "",
            status: item.status || "",
            weekStart: this._parseODataDate(item.weekStartDate),
            weekEnd: this._parseODataDate(item.weekEndDate),
            mondayHours: item.mondayHours || 0,
            tuesdayHours: item.tuesdayHours || 0,
            wednesdayHours: item.wednesdayHours || 0,
            thursdayHours: item.thursdayHours || 0,
            fridayHours: item.fridayHours || 0,
            saturdayHours: item.saturdayHours || 0,
            sundayHours: item.sundayHours || 0,
            mondayTaskDetails: item.mondayTaskDetails || "",
            tuesdayTaskDetails: item.tuesdayTaskDetails || "",
            wednesdayTaskDetails: item.wednesdayTaskDetails || "",
            thursdayTaskDetails: item.thursdayTaskDetails || "",
            fridayTaskDetails: item.fridayTaskDetails || "",
            saturdayTaskDetails: item.saturdayTaskDetails || "",
            sundayTaskDetails: item.sundayTaskDetails || "",
            dates: oModel.getProperty("/weekDates")
        };

        
    });

} else {
    // No matching week → show nothing
    weekData = [];
    oModel.setProperty("/timeEntries", weekData);

    oModel.setProperty("/dailyTotals", {
        monday:0, tuesday:0, wednesday:0, thursday:0,
        friday:0, saturday:0, sunday:0
    });
    oModel.setProperty("/totalWeekHours", 0);

    let table = this.getView().byId("timesheetTable");
    table?.getBinding("items")?.refresh(true);
}


            // Apply week data to the table
            this._applyWeekData(weekData);

        }.bind(this),
        error: function(err) {
            console.error("Failed to load week entries", err);
        }.bind(this)
    });
},


_applyWeekData: function(data) {
    let oModel = this.getView().getModel("timeEntryModel");

    // Set entries
    oModel.setProperty("/timeEntries", data);

    // Calculate daily totals
    let dailyTotals = this._calculateDailyTotals(data);
    oModel.setProperty("/dailyTotals", dailyTotals);

    // Total week hours
    let totalWeekHours = Object.values(dailyTotals).reduce((a,b) => a + b, 0);
    oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

    // Refresh table
    let table = this.getView().byId("timesheetTable");
    table?.getBinding("items")?.refresh(true);
},
_toODataDate: function (dateStr) {
    return `/Date(${new Date(dateStr).getTime()})/`;
},
_clearWeekEntries: function () {
    var oModel = this.getView().getModel("timeEntryModel");
    var emptyTotals = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };

    oModel.setProperty("/dailyTotals", emptyTotals);
    oModel.setProperty("/timeEntries", []);
    oModel.setProperty("/totalWeekHours", "0.00");
},

_setDatePicker: function(oDate) {
    let oDP = this.byId("datePicker");
    if (oDP && oDate) {
        oDP.setDateValue(oDate);
    }
},

// _applyWeekData: function (aEntries) {
//     var oModel = this.getView().getModel("timeEntryModel");
//     var totals = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };

//     aEntries.forEach(function (entry) {
//         totals.monday += Number(entry.mondayHours || 0);
//         totals.tuesday += Number(entry.tuesdayHours || 0);
//         totals.wednesday += Number(entry.wednesdayHours || 0);
//         totals.thursday += Number(entry.thursdayHours || 0);
//         totals.friday += Number(entry.fridayHours || 0);
//         totals.saturday += Number(entry.saturdayHours || 0);
//         totals.sunday += Number(entry.sundayHours || 0);
//     });

//     oModel.setProperty("/dailyTotals", totals);
//     oModel.setProperty("/timeEntries", aEntries);
//     oModel.setProperty("/totalWeekHours", Object.values(totals).reduce((a, b) => a + b, 0).toFixed(2));
// },

// ✅ 2. KEEP your week navigation functions as-is
onNextWeekTS: function() {
    var oModel = this.getView().getModel("timeEntryModel");
    var monday = new Date(oModel.getProperty("/weekDates/monday"));
    monday.setDate(monday.getDate() + 7);
oModel.setProperty("/isNextWeek", true);
this._currentWeekStartDate = monday;
sap.ui.core.BusyIndicator.show(0)
    this._updateWeekDates(monday);
    this._loadWeekEntries(monday);
    this._setDatePicker(monday);
},

onPreviousWeekTS: function() {
    sap.ui.core.BusyIndicator.show(0)
    var oModel = this.getView().getModel("timeEntryModel");
    var monday = new Date(oModel.getProperty("/weekDates/monday"));
    monday.setDate(monday.getDate() - 7);
oModel.setProperty("/isNextWeek", false);
this._currentWeekStartDate = monday;
    this._updateWeekDates(monday);
    this._loadWeekEntries(monday);
    this._setDatePicker(monday);
},

onCurrentWeekTS: function() {
    sap.ui.core.BusyIndicator.show(0)
    var monday = this._getCurrentWeekMonday();
   this._currentWeekStartDate = monday;
    this._updateWeekDates(monday);
    this._loadWeekEntries(monday);
    this._setDatePicker(monday)
},


_updateDailyTotals: function(){
    var oModel = this.getView().getModel("timeEntryModel");
    var aEntries = oModel.getProperty("/timeEntries") || [];
    var totals = {
        monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
        friday: 0, saturday: 0, sunday: 0
    };

    aEntries.forEach(function(entry){
        totals.monday += entry.monday || 0;
        totals.tuesday += entry.tuesday || 0;
        totals.wednesday += entry.wednesday || 0;
        totals.thursday += entry.thursday || 0;
        totals.friday += entry.friday || 0;
        totals.saturday += entry.saturday || 0;
        totals.sunday += entry.sunday || 0;
    });

    oModel.setProperty("/dailyTotals", totals);
},
onDatePickerChange: function (oEvent) {
    sap.ui.core.BusyIndicator.show(0)
    let newDate = oEvent.getSource().getDateValue();
    if (!newDate) return;

    // Compute Monday of the selected week
    let day = newDate.getDay(); // Sunday = 0
    let mondayDate = new Date(newDate);
    mondayDate.setDate(newDate.getDate() - (day === 0 ? 6 : day - 1));
    this._updateWeekDates(mondayDate)
    // Call the existing loadWeekEntries logic
    this._loadWeekEntries(mondayDate);
},
      _updateWeekDates: function(oDate) {
    var oModel = this.getView().getModel("timeEntryModel");
    
    var monday = this._getMonday(oDate); // helper to get Monday from any date
    var weekDates = {};
    ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].forEach((day,i) => {
        let d = new Date(monday);
        d.setDate(d.getDate() + i);
        weekDates[day] = this._formatDateForModel(d);
        weekDates[day + "Formatted"] = this._formatDateDisplay(d);
        weekDates[day + "IsFuture"] = d > new Date();
    });

    oModel.setProperty("/weekDates", weekDates);

    var sCurrentWeek = weekDates.mondayFormatted + " - " + weekDates.sundayFormatted + " " + monday.getFullYear();
    oModel.setProperty("/currentWeek", sCurrentWeek);

    var today = new Date();
    oModel.setProperty("/isCurrentWeek", today >= monday && today <= new Date(monday.getTime() + 6*24*60*60*1000));
},
_getMonday: function(oDate) {
    var day = oDate.getDay();
    var diff = oDate.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(oDate);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    return monday;
},

 _formatDateDisplay: function (oDate) {
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return months[oDate.getMonth()] + " " + ("0" + oDate.getDate()).slice(-2);
        },




onTaskDetailPress: function (oEvent) {
    try {
        var oButton = oEvent.getSource();
        var oBindingContext = oButton.getBindingContext("timeEntryModel");

        if (!oBindingContext) {
            sap.m.MessageToast.show("Unable to get binding context");
            return;
        }

        var oEntry = oBindingContext.getObject();
        var oModel = this.getView().getModel("timeEntryModel");
        var oWeekDates = oModel.getProperty("/weekDates");

        if (!oWeekDates) {
            sap.m.MessageToast.show("Week dates not available");
            return;
        }

        // Ensure dailyComments exists
        oEntry.dailyComments = oEntry.dailyComments || {};

   var that = this; // if needed inside controller

var aDays = [
    { name: "Monday",    hours: oEntry.mondayHours || 0,    comment: oEntry.mondayTaskDetails || "No task details",    date: that._formatDateForDisplay(oWeekDates.monday) },
    { name: "Tuesday",   hours: oEntry.tuesdayHours || 0,   comment: oEntry.tuesdayTaskDetails || "No task details",   date: that._formatDateForDisplay(oWeekDates.tuesday) },
    { name: "Wednesday", hours: oEntry.wednesdayHours || 0, comment: oEntry.wednesdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.wednesday) },
    { name: "Thursday",  hours: oEntry.thursdayHours || 0,  comment: oEntry.thursdayTaskDetails || "No task details",  date: that._formatDateForDisplay(oWeekDates.thursday) },
    { name: "Friday",    hours: oEntry.fridayHours || 0,    comment: oEntry.fridayTaskDetails || "No task details",    date: that._formatDateForDisplay(oWeekDates.friday) },
    { name: "Saturday",  hours: oEntry.saturdayHours || 0,  comment: oEntry.saturdayTaskDetails || "No task details",  date: that._formatDateForDisplay(oWeekDates.saturday) },
    { name: "Sunday",    hours: oEntry.sundayHours || 0,    comment: oEntry.sundayTaskDetails || "No task details",    date: that._formatDateForDisplay(oWeekDates.sunday) }
];



var getHoursColorClass = function(hours) {
    if (hours === 0) {
        return "tsHoursRed";      // red
    } else if (hours > 0 && hours < 8) {
        return "tsHoursOrange";   // orange
    } else if (hours >= 8 && hours <= 15) {
        return "tsHoursGreen";    // green
    }
    return ""; // default no class
};

var aItems = aDays.map(function(oDay, index) {
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
                        text: `${oDay.hours} hrs`,
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
                new sap.m.ToolbarSeparator().addStyleClass("tsSeparator")
            ] : [])
        ]
    }).addStyleClass("tsDayCard");
});




        var oDialog = new sap.m.Dialog({
            title: "Week Task Details",
            contentWidth: "300px",  // fixed width
    contentHeight: "70vh",  // max height of dialog
    stretchOnPhone: true,
            content: new sap.m.VBox({ items: aItems }),
            endButton: new sap.m.Button({
                text: "Close",
                press: function() { oDialog.close(); }
            }),
            afterClose: function() { oDialog.destroy(); }
        });

        this.getView().addDependent(oDialog);
        oDialog.open();

    } catch (oError) {
        console.error("Error in onTaskDetailPress:", oError);
    }
},


  onProjectSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oProject = oSelectedItem.getBindingContext().getObject();
                MessageToast.show("Selected project: " + oProject.projectName + " (Manager: " + oProject.managerName + ")");
            }
        },


onProfilePress: function () {
    var oDataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    var oView = this.getView();

    if (!oDataModel) {
        sap.m.MessageBox.error("OData model not found. Please check your manifest configuration.");
        return;
    }

    sap.ui.core.BusyIndicator.show(0);

    oDataModel.read("/MyProfile", {
        success: function (oData) {
            sap.ui.core.BusyIndicator.hide();

            // Check if we have results array
            if (!oData || !oData.results || !oData.results.length) {
                sap.m.MessageBox.warning("No profile data found.");
                return;
            }

            // Take the first element from results
            var oRawProfile = oData.results[0];

            // Map fields for fragment
            var oProfile = {
                employeeID: oRawProfile.employeeID || "",
                firstName: oRawProfile.firstName || "",
                lastName: oRawProfile.lastName || "",
                email: oRawProfile.email || "",
                managerName: oRawProfile.managerName || "",
                managerEmail: oRawProfile.managerEmail || "",
                activeStatus: oRawProfile.isActive ? "Yes" : "No",
                changedBy: oRawProfile.modifiedBy || "",
                userRole: oRawProfile.userRole && oRawProfile.userRole.__deferred ? "N/A" : (oRawProfile.userRole || "")
            };

            // Create JSONModel for fragment
            var oProfileModel = new sap.ui.model.json.JSONModel({ profile: oProfile });

            // Load fragment if not already loaded
            if (!this._oProfileDialog) {
                this._oProfileDialog = sap.ui.xmlfragment(
                    "employee.Fragments.ProfileDialog",
                    this
                );
                oView.addDependent(this._oProfileDialog);
            }

            // Set model to fragment
            this._oProfileDialog.setModel(oProfileModel, "view");

            // Optional: set employee name in header
            var oEmployeeNameText = oView.byId("employeeNameText");
            if (oEmployeeNameText) {
                oEmployeeNameText.setText(oProfile.firstName + " " + oProfile.lastName);
            }

            // Open fragment dialog
            this._oProfileDialog.open();

        }.bind(this),
        error: function (oError) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Failed to load profile data.");
            console.error(oError);
        }
    });
},
onCloseProfileDialog: function () {
    if (this._oProfileDialog) {
        this._oProfileDialog.close();
    }
},

 onInfoPress: function () {
    var oView = this.getView();

    // Check if dialog already exists
    if (!this._oCommentOptionsDialog) {
        // Create dialog instance from fragment
        this._oCommentOptionsDialog = sap.ui.xmlfragment(
            oView.getId(),                    // optional ID prefix
            "employee.Fragments.CommentOptions", // fragment path
            this                               // controller as event handler
        );

        // Add fragment as dependent to view
        oView.addDependent(this._oCommentOptionsDialog);
    }

    // Initialize comment data every time before opening
    this._initializeCommentData();

    // Open dialog
    this._oCommentOptionsDialog.open();
},



   _initializeCommentData: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/currentCommentType", "daily");
            oModel.setProperty("/selectedDay", "monday");
            oModel.setProperty("/dailyCommentText", "");
            oModel.setProperty("/weeklyCommentText", "");
            oModel.setProperty("/monthlyCommentText", "");
            oModel.setProperty("/newCommentText", "");
            oModel.setProperty("/needInput", false);

            var aProjects = oModel.getProperty("/projects");
            var aWorkTypes = oModel.getProperty("/workTypes");
            if (aProjects && aProjects.length > 0) {
                oModel.setProperty("/selectedProject", aProjects[0].id);
            }
            if (aWorkTypes && aWorkTypes.length > 0) {
                oModel.setProperty("/selectedWorkType", aWorkTypes[0].type);
            }
            oModel.setProperty("/selectedStatus", "todo");
            oModel.setProperty("/selectedPriority", "medium");

            var today = new Date();
            var todayStr = today.getFullYear() + "-" +
                ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
                ("0" + today.getDate()).slice(-2);
            oModel.setProperty("/dueDateStart", todayStr);
            oModel.setProperty("/dueDateEnd", todayStr);
        },

  onSettingsPress: function () {
            MessageBox.information("Timesheet Settings:\n\n- Working hours: 8 hours/day\n- Future bookings allowed for Leave/Training only\n- Manager notifications for approved entry changes");
        },

    onViewReports: function () {
    var oDataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    var oView = this.getView();

    if (!oDataModel) {
        sap.m.MessageBox.error("OData model not found. Please check your manifest configuration.");
        return;
    }

    sap.ui.core.BusyIndicator.show(0);

    oDataModel.read("/MyProgressSummary", {
        success: function (oData) {
            sap.ui.core.BusyIndicator.hide();

           if (!oData || !oData.results || !oData.results.length) {
                sap.m.MessageBox.warning("No profile data found.");
                return;
            }

            // Take the first element from results
            var aResults = oData.results;

            // Group data by projectID
            var oProjects = {};
            aResults.forEach(function (oEntry) {
                if (!oProjects[oEntry.projectID]) {
                    oProjects[oEntry.projectID] = {
                        projectName: oEntry.projectName,
                        managerName: "N/A", // you can map from another source if available
                        totalHours: 0,
                        startDate: oEntry.startDate,
                        endDate: oEntry.endDate,
                        status: oEntry.status
                    };
                }
                // Sum up hoursWorked
                oProjects[oEntry.projectID].totalHours += parseFloat(oEntry.hoursWorked || 0);
                // Optionally, update status if you want the latest or worst status
                oProjects[oEntry.projectID].status = oEntry.status;
            });

            // Build report string
            var sReport = "Progress Reports:\n\n";
            Object.values(oProjects).forEach(function (oProject) {
                sReport += "Project: " + oProject.projectName + "\n";
                sReport += "Total Hours Worked: " + oProject.totalHours + "\n";
               sReport += "Start Date: " + this._formatODataDate(oProject.startDate) + "\n";
sReport += "End Date: " + this._formatODataDate(oProject.endDate) + "\n";
                sReport += "Status: " + oProject.status + "\n\n";
            }.bind(this));

            // Show MessageBox
            sap.m.MessageBox.information(sReport, { title: "Project Progress Summary" });

        }.bind(this),
        error: function (oError) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Failed to load progress summary.");
            console.error(oError);
        }
    });
},

// Helper function to format OData /Date(…) format to dd-mm-yyyy
_formatODataDate: function(oDate) {
    if (!oDate) return "";

    // If it's a string in /Date(…)/ format, convert
    if (typeof oDate === "string" && oDate.indexOf("/Date(") === 0) {
        var iTime = parseInt(oDate.replace(/\/Date\((\d+)\)\//, "$1"), 10);
        oDate = new Date(iTime);
    }

    // If it's already a Date object, just format
    if (oDate instanceof Date) {
        var sDay = ("0" + oDate.getDate()).slice(-2);
        var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
        var sYear = oDate.getFullYear();
        return sDay + "-" + sMonth + "-" + sYear;
    }

    return "";
}






  });
});
