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
        newEntry: {},
        projects: [],
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
_getCurrentWeekMonday: function() {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const diff = day === 0 ? -6 : 1 - day; // go back to Monday
    const monday = new Date(today);
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
    const oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    const oView = this.getView();
    const oModel = oView.getModel("timeEntryModel");

    if (!oODataModel) {
        console.error("No OData model found");
        return;
    }

    BusyIndicator.show(0);

    // Set current week
    const monday = this._getCurrentWeekMonday();
    const selectedDateStr = monday.toISOString().split("T")[0];

   this._fetchWeekBoundaries(selectedDateStr)
    .then(week => {

        const weekStart = week.getWeekBoundaries.weekStart;
        const weekEnd = week.getWeekBoundaries.weekEnd;

        this._updateWeekDates(new Date(weekStart));

        oODataModel.read("/MyTimesheets", {
            success: function(oData) {
                BusyIndicator.hide();

                const allResults = oData.results || [];
                const weekDates = oModel.getProperty("/weekDates");

                // Compare values ignoring OData Date format noise
             


           const toDate = d => new Date(d); // convert "2025-11-17" to full Date object

const filtered = allResults.filter(item => {
  const itemStart = item.weekStartDate ? toDate(item.weekStartDate) : null;
  const itemEnd   = item.weekEndDate   ? toDate(item.weekEndDate)   : null;

  return itemStart?.getTime() === weekStart.getTime() &&
         itemEnd?.getTime()   === weekEnd.getTime();
});




                const formatted = filtered.map(item => ({
                    id: item.ID,
                    projectId: item.project_ID,
                    projectName: item.projectName,
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
                }));

                oModel.setProperty("/timeEntries", formatted);

                const dailyTotals = this._calculateDailyTotals(formatted);
                oModel.setProperty("/dailyTotals", dailyTotals);

                const totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
                oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

                const table = oView.byId("timesheetTable");
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
    const totals = {
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

    _formatDateForDisplay: function(oDate) {
    if (!oDate) return "";
    // convert string to Date if needed
    const dateObj = (typeof oDate === "string") ? new Date(oDate) : oDate;
    const options = { month: "short", day: "numeric" };
    return dateObj.toLocaleDateString("en-US", options); // e.g., "Nov 17, 25"
},

        onCancelNewEntry: function () {
            this._oAddEntryDialog.close();
        },
  onAddEntry: function () {
    var that = this;
    var oModel = this.getView().getModel("timeEntryModel");
    var oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");

    var today = new Date();
    var selectedDateStr = this._formatDateForModel(today);

    // Initialize newEntry with empty/default values
    oModel.setProperty("/newEntry", {
        selectedDate: selectedDateStr,
        projectId: "",      // <-- empty for placeholder
        projectName: "",    // <-- will be set when user selects
        workType: "",
        hours: "",
        taskDetails: "",
        dailyComments: {}
    });

    // Load Projects
    var loadProjects = new Promise(function (resolve) {
        oServiceModel.read("/MyProjects", {
            success: function (oData) {
                var aProjects = [];
                if (oData.results) {
                    aProjects = oData.results.map(p => ({
                        projectId: p.projectID,
                        projectName: p.projectName
                    }));
                }
                oModel.setProperty("/projects", aProjects);
                resolve();
            },
            error: function () {
                oModel.setProperty("/projects", []);
                resolve();
            }
        });
    });

    // Load Tasks
    var loadTasks = new Promise(function (resolve) {
        oServiceModel.read("/AvailableTaskTypes", {
            success: function (oData) {
                var aTasks = [];
                if (oData.results) {
                    aTasks = oData.results.map(t => ({ type: t.code, name: t.name }));
                }
                oModel.setProperty("/workTypes", aTasks);
                resolve();
            },
            error: function () {
                oModel.setProperty("/workTypes", []);
                resolve();
            }
        });
    });

    // Open the dialog after both projects and tasks are loaded
    Promise.all([loadProjects, loadTasks]).then(function () {
        if (!that._oAddEntryDialog) {
            that._oAddEntryDialog = sap.ui.xmlfragment(
                that.getView().getId(),
                "employee.Fragments.AddTimeEntry",
                that
            );
            that.getView().addDependent(that._oAddEntryDialog);
        }
        that._oAddEntryDialog.open();
    });
},

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
    var oModel = this.getView().getModel("timeEntryModel");
    var value = oEvent.getParameter("value"); // format dd/MM/yyyy

    if (!value) return;

    var day = this._dayPropertyFromDate(value); // ⬅ recalc weekday here

    var newEntry = oModel.getProperty("/newEntry");
    newEntry.selectedDate = value;
    newEntry.day = day;  // ⬅ update day

    oModel.setProperty("/newEntry", newEntry);
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
//     const employeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d491";

//     // Build backend filter for existing task
//     var filters = [
//         new sap.ui.model.Filter("employee_ID", sap.ui.model.FilterOperator.EQ, employeeID),
//         new sap.ui.model.Filter("task", sap.ui.model.FilterOperator.EQ, oNewEntry.workType)
//     ];

//     oService.read("/MyTimesheets", {
//         filters: filters,
//         success: function(oData) {
//             const results = oData?.results || [];
//             const existingEntry = results.length ? results[0] : null;

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

onSaveNewEntry: function () {
    var oModel = this.getView().getModel("timeEntryModel");
    var oNewEntry = oModel.getProperty("/newEntry") || {};
    var that = this;

     // Call validation
    if (!this._validateMandatoryFields(oNewEntry)) {
        return false; // Stop saving if validation fails
    }

    var hoursForDay = parseFloat(oNewEntry.hours) || 0;
    if (hoursForDay <= 0 || hoursForDay > 15) {
        sap.m.MessageBox.error("Hours must be between 0 and 15");
        return false;
    }

    var selectedDateStr = oNewEntry.selectedDate;
    var dayProp = this._dayPropertyFromDate(selectedDateStr); 
    var hoursProp = dayProp + "Hours";
    var taskProp = dayProp + "TaskDetails";

    // Always create a new object representing the entry for this save
    var newRow = {
        employee_ID: oNewEntry.employee_ID || null,
        project_ID: oNewEntry.projectId || null,
        projectName: oNewEntry.projectName ? oNewEntry.projectName : undefined,
        task: oNewEntry.workType || "",
        status: "Draft",
        isBillable: true,
        mondayHours: "0.00", mondayTaskDetails: "", mondayDate: null,
        tuesdayHours: "0.00", tuesdayTaskDetails: "", tuesdayDate: null,
        wednesdayHours: "0.00", wednesdayTaskDetails: "", wednesdayDate: null,
        thursdayHours: "0.00", thursdayTaskDetails: "", thursdayDate: null,
        fridayHours: "0.00", fridayTaskDetails: "", fridayDate: null,
        saturdayHours: "0.00", saturdayTaskDetails: "", saturdayDate: null,
        sundayHours: "0.00", sundayTaskDetails: "", sundayDate: null
    };

    // Set the selected day's hours and task details
    newRow[hoursProp] = hoursForDay;
    newRow[taskProp] = oNewEntry.taskDetails || "";

    // Call backend persistence; backend will decide whether to create or update
   this._fetchWeekBoundaries(selectedDateStr)
    .then(weekData => {
        return this._persistToBackend(newRow, selectedDateStr, weekData);
    })
    .then(() => {
        that._loadTimeEntriesFromBackend();
        sap.m.MessageToast.show("Timesheet saved!");
    })
    .catch(err => {
        console.error(err);
        sap.m.MessageBox.error("Failed to save timesheet.");
    });


    return true;
},
_persistToBackend: function (entry, selectedDateStr, weekData) {
    var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    const that = this;
    var dayProp = this._dayPropertyFromDate(selectedDateStr);
    if (!dayProp) return Promise.reject("Invalid day property");

    var oNewEntry = this.getView().getModel("timeEntryModel").getProperty("/newEntry") || {};
    var hours = Number(entry[dayProp + "Hours"]) || 0;
    var task = oNewEntry.taskDetails || "";
    entry[dayProp + "TaskDetails"] = task;

    const employeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d491";
    const weekStart = weekData.getWeekBoundaries.weekStart;
const weekEnd = weekData.getWeekBoundaries.weekEnd;


    // day map
    const dayMap = {
        monday: "mondayDate",
        tuesday: "tuesdayDate",
        wednesday: "wednesdayDate",
        thursday: "thursdayDate",
        friday: "fridayDate",
        saturday: "saturdayDate",
        sunday: "sundayDate"
    };
    const dayDateField = dayMap[dayProp];

    function toODataDate(str) {
        return `/Date(${new Date(str).getTime()})/`;
    }

    var payloadFull = {
        employee_ID: employeeID,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        project_ID: entry.project_ID || null,
        projectName: entry.projectName,
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
                const items = oData?.results || [];

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

const dayMap = {
    monday: "mondayDate",
    tuesday: "tuesdayDate",
    wednesday: "wednesdayDate",
    thursday: "thursdayDate",
    friday: "fridayDate",
    saturday: "saturdayDate",
    sunday: "sundayDate"
};

const dayDateField = dayMap[dayProp];

// Filter for same DATE only
const filteredItems = items.filter(i => {
    const storedDate = normalizeDate(i[dayDateField]);
    return storedDate && storedDate === selectedDateStr;
});

// Sum only hours of that date
let currentTotal = filteredItems.reduce((sum, i) =>
    sum + (Number(i[dayProp + "Hours"]) || 0), 0
);

// If same task exists, subtract before re-adding
const exist = filteredItems.find(x => x.task === payloadFull.task);
if (exist) {
    currentTotal -= Number(exist[dayProp + "Hours"]) || 0;
}

const dailyTotals = oModel.getProperty("/dailyTotals") || {};
const currentTotalForDay = Number(dailyTotals[dayProp] || 0);
const newHours = Number(hours) || 0;

const newTotalForDay = currentTotalForDay + newHours;

if (newTotalForDay > 15) {
    sap.m.MessageBox.error(
        `Slow down chief 😅 You can't log more than 15 hours on ${selectedDateStr}.`
    );
    if (that._oAddEntryDialog) that._oAddEntryDialog.close();
    return;
}



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
    const entries = await SELECT.from("MyTimesheets")
        .where({ employee_ID: employeeId, workDate: workDate });

    let total = 0;

    for (const e of entries) {
        total += Number(e.hours || 0);
    }

    if (existingTaskId) {
        const found = entries.find(x => x.ID === existingTaskId);
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

//     const employeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d490";
//     const workDateOData = this._formatDateForOData(selectedDateStr);
//     const { weekStart, weekEnd } = this._getWeekStartEndOData(selectedDateStr);


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
_getWeekStartEndOData: function (dateStr) {
    if (!dateStr) {
        console.warn("No date provided to _getWeekStartEndOData");
        return { weekStart: null, weekEnd: null };
    }

    let year, month, day;

    if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length !== 3) {
            console.warn("Invalid date format:", dateStr);
            return { weekStart: null, weekEnd: null };
        }

        // Detect format based on plausible month/day
        const first = Number(parts[0]);
        const second = Number(parts[1]);
        const third = Number(parts[2]);

        if (first > 12) {
            // Treat as DD/MM/YYYY
            day = first;
            month = second;
            year = third < 100 ? 2000 + third : third;
        } else if (second > 12) {
            // Treat as MM/DD/YYYY
            month = first;
            day = second;
            year = third < 100 ? 2000 + third : third;
        } else {
            // Default to MM/DD/YYYY
            month = first;
            day = second;
            year = third < 100 ? 2000 + third : third;
        }
    } else if (dateStr.includes("-")) {
        // Handle YYYY-MM-DD
        const parts = dateStr.split("-");
        if (parts.length !== 3) {
            console.warn("Invalid date format:", dateStr);
            return { weekStart: null, weekEnd: null };
        }
        [year, month, day] = parts.map(Number);
    } else {
        console.warn("Unknown date format:", dateStr);
        return { weekStart: null, weekEnd: null };
    }

    // Validate numeric ranges
    if (
        !year || !month || !day ||
        month < 1 || month > 12 ||
        day < 1 || day > 31
    ) {
        console.warn("Date values out of range:", dateStr);
        return { weekStart: null, weekEnd: null };
    }

    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) {
        console.warn("Invalid Date object created from:", dateStr);
        return { weekStart: null, weekEnd: null };
    }

    const jsDay = d.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = (jsDay === 0 ? -6 : 1 - jsDay);

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        weekStart: `/Date(${monday.getTime()})/`,
        weekEnd: `/Date(${sunday.getTime()})/`
    };
},
// -------------- helper functions -------------------



/**
 * Convert "YYYY-MM-DD" (or Date) to OData date string "YYYY-MM-DDT00:00:00"
 */
_formatDateForOData: function(dateStr) {
    if (!dateStr) return null;

    const [dd, mm, yyyy] = dateStr.split("/");
    return `datetime('${yyyy}-${mm}-${dd}T00:00:00')`;
},


/**
 * Return day property name for a given "YYYY-MM-DD"
 */
_dayPropertyFromDate: function (dateStr) {
    if (!dateStr) return undefined;

    let day, month, year;

    // Case 1: YYYY-MM-DD
    if (dateStr.includes("-")) {
        let parts = dateStr.split("-");
        if (parts.length !== 3) return undefined;

        year = parts[0];
        month = parts[1];
        day = parts[2];
    }
    // Case 2: DD/MM/YYYY or DD/MM/YY
    else if (dateStr.includes("/")) {
        let parts = dateStr.split("/");
        if (parts.length !== 3) return undefined;

        // Detect and swap if user supplied MM/DD/YY by mistake
        let p1 = parseInt(parts[0], 10); // could be day or month
        let p2 = parseInt(parts[1], 10);

        if (p1 <= 12 && p2 > 12) {
            // It's MM/DD/YY => convert to DD/MM/YY
            parts = [parts[1], parts[0], parts[2]];
        }

        day = parts[0];
        month = parts[1];
        year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
    } else {
        return undefined;
    }

    // Normalize date
    const dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
    if (isNaN(dateObj.getTime())) return undefined;

    const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
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




 onDayOverflowPress: function (oEvent) {
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

    // 🧩 Use ActionSheet instead of Menu
    if (!this._oDayActionSheet) {
        this._oDayActionSheet = new sap.m.ActionSheet({
            placement: sap.m.PlacementType.Auto,
            buttons: [
                new sap.m.Button({
                    text: "Edit Time",
                    icon: "sap-icon://edit",
                    press: this.onEditDayHours.bind(this)
                })
            ]
        });
        this.getView().addDependent(this._oDayActionSheet);
    }

    this._oDayActionSheet.openBy(oButton);
},

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
//     const oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
//     const oModel = this.getView().getModel("timeEntryModel");
//     const aEntries = oModel.getProperty("/timeEntries") || [];
//     const that = this;

//     const iIndex = aEntries.findIndex(entry => entry.id === oEntry.id);
//     if (iIndex === -1) {
//         sap.m.MessageBox.error("Entry not found");
//         return;
//     }

//     // 🟡 Set the hours to 0 locally first
//     aEntries[iIndex][sDay] = 0;
//     oModel.setProperty("/timeEntries", aEntries);

//     // 🟢 Prepare backend update
//     const oWeekDates = oModel.getProperty("/weekDates");
//     const oDayDate = oWeekDates ? oWeekDates[sDay] : new Date();
//     const sWorkDateStr = this._formatDateForModel(oDayDate);

//     const sEmployeeID = "a47ac10b-58cc-4372-a567-0e02b2c3d490";
//     const sProjectID = oEntry.projectId || oEntry.project_ID;
//     const sTask = oEntry.workType || oEntry.task;

//     const sFilter = `employee_ID eq '${sEmployeeID}' and project_ID eq '${sProjectID}' and task eq '${sTask}' and workDate eq datetime'${sWorkDateStr}T00:00:00'`;

//     sap.ui.core.BusyIndicator.show(0);
//     oServiceModel.read("/MyTimesheets", {
//         urlParameters: { $filter: sFilter },
//         success: function (oData) {
//             const existing = oData.results?.[0];
//             if (existing) {
//                 const oPayload = {
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
//                             const response = JSON.parse(oError.responseText);
//                             const message = response?.error?.message?.value || "Failed to delete hours";
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
//     const oModel = this.getView().getModel("timeEntryModel");
//     const oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
//     const aEntries = oModel.getProperty("/timeEntries") || [];

//     const that = this;
//     const iIndex = aEntries.findIndex(entry => entry.id === oEntry.id);

//     if (iIndex === -1) {
//         sap.m.MessageBox.error("Entry not found");
//         return;
//     }

//     const previousHours = aEntries[iIndex][sDay];
//     const previousTask = aEntries[iIndex][sDay + "TaskDetails"];

//     // Update UI temp
//     aEntries[iIndex][sDay] = Number(fNewHours) || 0;
//     aEntries[iIndex][sDay + "TaskDetails"] = sTaskDetails || "";
//     oModel.setProperty("/timeEntries", aEntries);

//     const sEmployeeID = oEntry.employee_ID;
//     const sProjectID = oEntry.projectId || oEntry.project_ID;
//     const sTask = oEntry.workType || oEntry.task;
//     const sWorkDateStr = this._formatDateForOData(oEntry[sDay + "Date"]);

//     // Payload
//    const oPayload = {
//   [`${sDay}Hours`]: Number(fNewHours) || 0,
//   [`${sDay}TaskDetails`]: sTaskDetails || ""
// };


//     sap.ui.core.BusyIndicator.show(0);

//     // ⭐ If backend ID exists → update directly
//     if (oEntry.id) {
//         const sPath = `/MyTimesheets(guid'${oEntry.id}')`;

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
    const oModel = this.getView().getModel("timeEntryModel");
    const oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    const aEntries = oModel.getProperty("/timeEntries") || [];

    const iIndex = aEntries.findIndex(entry => entry.id === oEntry.id);
    if (iIndex === -1) {
        sap.m.MessageBox.error("Entry not found");
        return;
    }

    function normalizeDate(oDataDate) {
    if (!oDataDate) return null;

    // Handle OData /Date(XXXXXXXXXX)/ format
    if (typeof oDataDate === "string" && oDataDate.startsWith("/Date(")) {
        const timestamp = parseInt(oDataDate.match(/\/Date\((\d+)\)\//)[1], 10);
        const d = new Date(timestamp);
        return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
    }

    if (oDataDate instanceof Date) {
        return oDataDate.toISOString().split("T")[0];
    }

    return null;
}

// Inside your _saveEditedDayHoursAuto function
const dayDateFieldMap = {
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday"
};

// const dayDateField = dayMap[sDay];
const selectedDateStr = oEntry.dates ? oEntry.dates[dayDateFieldMap[sDay]] : null;

// Get previous hours for this cell
const previousHours = selectedDateStr ? Number(oEntry[sDay + "Hours"] || 0) : 0;



// // Get the date string of the selected cell
// const selectedDateStr = oEntry[dayDateField] ? normalizeDate(oEntry[dayDateField]) : null;

// // Find the previous hours only if this entry’s date matches the selected date
// const previousHours = (() => {
//     if (!selectedDateStr) return 0;
//     return Number(oEntry[sDay + "Hours"] || 0);
// })();

    const newHours = Number(fNewHours) || 0;

    // ✅ Column-level validation: total hours for this day must not exceed 15
    const currentTotal = aEntries.reduce((sum, entry, idx) => {
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
const dailyTotals = oModel.getProperty("/dailyTotals") || {};
const currentTotalForDay = Number(dailyTotals[sDay] || 0);

// Calculate the new total if this cell is updated
const newTotalForDay = currentTotalForDay - previousHours + newHours;

// Column-level validation: total hours for the day must not exceed 15
if (newHours >= 15) {
    sap.m.MessageBox.error(`Total hours for ${sDay.charAt(0).toUpperCase() + sDay.slice(1)} cannot exceed 15.`);
    return;
}
if (newTotalForDay >= 15) {
    sap.m.MessageBox.error(`Total hours for ${sDay.charAt(0).toUpperCase() + sDay.slice(1)} cannot exceed 15.`);
    return;
}



    const previousTask = aEntries[iIndex][sDay + "TaskDetails"];
    const diff = newHours - previousHours;

    // 1️⃣ Update UI cell locally
    aEntries[iIndex][sDay] = newHours;
    aEntries[iIndex][sDay + "TaskDetails"] = sTaskDetails || "";
    oModel.setProperty("/timeEntries", aEntries);

    // 2️⃣ Prepare payload for backend
    const oPayload = {
        [`${sDay}Hours`]: newHours,
        [`${sDay}TaskDetails`]: sTaskDetails || ""
    };

    sap.ui.core.BusyIndicator.show(0);
    const sPath = oEntry.id ? `/MyTimesheets(guid'${oEntry.id}')` : "/MyTimesheets";

    const fnSuccess = () => {
        sap.ui.core.BusyIndicator.hide();
        sap.m.MessageToast.show(`${sDay.charAt(0).toUpperCase() + sDay.slice(1)} saved successfully`);

        // 3️⃣ Update totals immediately
        const dailyTotals = oModel.getProperty("/dailyTotals") || {};
        dailyTotals[sDay] = aEntries.reduce((sum, entry) => sum + Number(entry[sDay] || 0), 0);
        oModel.setProperty("/dailyTotals", dailyTotals);

        const totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
        oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

        // 4️⃣ Refresh time entries to show updated hours
        this._loadTimeEntriesFromBackend();
    };

    const fnError = () => {
        sap.ui.core.BusyIndicator.hide();
        // revert changes
        aEntries[iIndex][sDay] = previousHours;
        aEntries[iIndex][sDay + "TaskDetails"] = previousTask;
        oModel.setProperty("/timeEntries", aEntries);

        // revert totals
        const dailyTotals = oModel.getProperty("/dailyTotals") || {};
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
//     const current = parseFloat(oEditedEntry[sDay]) || 0;
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


 onEditDayHours: function () {
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
    for (var i = 0; i <= 24; i++) {
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
    contentHeight: "300px",
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
    if (!entry.workType || entry.workType.trim() === "") {
        sap.m.MessageBox.error("Please select Work Type.");
        return false;
    }

    // Check hours
    const hours = parseFloat(entry.hours);
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
    const match = /\/Date\((\d+)\)\//.exec(s);
    return match ? new Date(parseInt(match[1], 10)) : null;
},

_loadWeekEntries: function(mondayDate) {
    const oService = this.getOwnerComponent().getModel("timesheetServiceV2");
    const oModel = this.getView().getModel("timeEntryModel");

    const sWeekStart = this._formatDateForModel(mondayDate);
    const sWeekEnd = this._formatDateForModel(new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6));

    const rawFilter = `weekStartDate eq datetime'${sWeekStart}T00:00:00' and weekEndDate eq datetime'${sWeekEnd}T00:00:00'`;
    console.log("Filter:", rawFilter);

    oService.read("/MyTimesheets", {
        urlParameters: { "$filter": rawFilter },
        success: function(oData) {
            const results = oData.d?.results || oData.results || [];

            // Filter the response to make sure weekStartDate & weekEndDate match exactly
          const weekDataFromBackend = results.filter(item => {
    const itemWeekStart = item.weekStartDate ? new Date(item.weekStartDate).toISOString().split("T")[0] : null;
    const itemWeekEnd   = item.weekEndDate   ? new Date(item.weekEndDate).toISOString().split("T")[0]   : null;

    const start = new Date(sWeekStart).toISOString().split("T")[0];
    const end   = new Date(sWeekEnd).toISOString().split("T")[0];

    return itemWeekStart === start && itemWeekEnd === end;
});



            let weekData;

            if (weekDataFromBackend.length > 0) {
                // Map backend data
                weekData = weekDataFromBackend.map(item => ({
                    id: item.ID,
                    projectId: item.project_ID,
                    projectName: item.projectName,
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
                }));
            } else {
                // No matching week → create empty rows
                weekData = [];  // empty array removes all rows
    oModel.setProperty("/timeEntries", weekData);

    // Reset daily totals & total week hours
    const dailyTotals = { monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0, sunday:0 };
    oModel.setProperty("/dailyTotals", dailyTotals);
    oModel.setProperty("/totalWeekHours", 0);

    // Refresh the table binding
    const table = this.getView().byId("timesheetTable");
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
    const oModel = this.getView().getModel("timeEntryModel");

    // Set entries
    oModel.setProperty("/timeEntries", data);

    // Calculate daily totals
    const dailyTotals = this._calculateDailyTotals(data);
    oModel.setProperty("/dailyTotals", dailyTotals);

    // Total week hours
    const totalWeekHours = Object.values(dailyTotals).reduce((a,b) => a + b, 0);
    oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

    // Refresh table
    const table = this.getView().byId("timesheetTable");
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
    const oDP = this.byId("datePicker");
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

    this._updateWeekDates(monday);
    this._loadWeekEntries(monday);
    this._setDatePicker(monday);
},

onPreviousWeekTS: function() {
    var oModel = this.getView().getModel("timeEntryModel");
    var monday = new Date(oModel.getProperty("/weekDates/monday"));
    monday.setDate(monday.getDate() - 7);

    this._updateWeekDates(monday);
    this._loadWeekEntries(monday);
    this._setDatePicker(monday);
},

onCurrentWeekTS: function() {
    var monday = this._getCurrentWeekMonday();
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
    const newDate = oEvent.getSource().getDateValue();
    if (!newDate) return;

    // Compute Monday of the selected week
    const day = newDate.getDay(); // Sunday = 0
    const mondayDate = new Date(newDate);
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
