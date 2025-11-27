sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/MenuItem",
    "sap/m/Menu",
    "sap/m/Dialog",
    "sap/m/MessageBox",


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

            //    this._checkCurrentUser();
            // this._loadWeekEntries(today);

            // Load projects
            var oProjectModel = this.getOwnerComponent().getModel("timesheetServiceV2");
            oProjectModel.read("/MyProjects", {
                success: function (oData) {
                    var results = oData.d ? oData.d.results : oData.results;
                    var mappedProjects = results.map(function (item) {
                        return {
                            projectName: item.projectName,
                            status: item.status,
                            managerName: item.projectOwnerName
                        };
                    });

                    var oJSONModel = new sap.ui.model.json.JSONModel();
                    oJSONModel.setData({ assignedProjects: mappedProjects });
                    oView.setModel(oJSONModel, "assignedProjects");
                }.bind(this), // important: bind `this` if needed
                error: function (err) {
                    console.error("Failed to load projects", err);
                }
            });

            this._loadReportData(oProjectModel, oView);

        },

        
        


        _getCurrentWeekMonday: function () {
            let today = new Date();
            let day = today.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
            let diff = day === 0 ? -6 : 1 - day; // go back to Monday
            let monday = new Date(today);
            monday.setDate(today.getDate() + diff);
            monday.setHours(0, 0, 0, 0);
            return monday;
        },
        onRefreshAnalytics: function () {
    console.log("Refreshing Reports…");

    var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    var oView = this.getView();

    sap.ui.core.BusyIndicator.show();
    
    this._loadReportData(oModel, oView);

    setTimeout(() => {
        sap.ui.core.BusyIndicator.hide();
        sap.m.MessageToast.show("Report data updated ✨");
    }, 1000);
},

onTabSelect: function (oEvent) {
    var selectedKey = oEvent.getParameter("key");

    if (selectedKey === "reportsTab") {
        console.log("Reports tab activated → refreshing data");

        var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
        var oView = this.getView();

        sap.ui.core.BusyIndicator.show();

        this._loadReportData(oModel, oView);

        setTimeout(() => {
            sap.ui.core.BusyIndicator.hide();
        }, 800);
    }
},

        _loadReportData: function (oModel, oView) {

            oModel.read("/BookedHoursOverview", {
                success: function (oData) {

                    var bookedHours = oData.d ? oData.d.results : oData.results;

                    var oBookedHoursModel = new sap.ui.model.json.JSONModel();
                    oBookedHoursModel.setData({ employeeProjectHours: bookedHours });

                    oView.setModel(oBookedHoursModel, "bookedHoursModel");
                },
                error: function (err) {
                    console.error("Failed to load Booked Hours Overview", err);
                }
            });

            // 2️Project Engagement Duration
            oModel.read("/ProjectEngagementDuration", {
                success: function (oData) {
                    var durations = oData.d ? oData.d.results : oData.results;

                    var oDurationModel = new sap.ui.model.json.JSONModel();
                    oDurationModel.setData({ employeeProjectDurations: durations });

                    oView.setModel(oDurationModel, "durationModel");
                },
                error: function (err) {
                    console.error("Failed to load Project Engagement Duration", err);
                }
            });
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

    _checkRowDeleteEligibility: function (row) {
    return (
        (parseFloat(row.mondayHours) || 0) === 0 &&
        (parseFloat(row.tuesdayHours) || 0) === 0 &&
        (parseFloat(row.wednesdayHours) || 0) === 0 &&
        (parseFloat(row.thursdayHours) || 0) === 0 &&
        (parseFloat(row.fridayHours) || 0) === 0 &&
        (parseFloat(row.saturdayHours) || 0) === 0 &&
        (parseFloat(row.sundayHours) || 0) === 0
    );
},


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
                        success: function (oData) {
                            BusyIndicator.hide();

                            let allResults = oData.results || [];
                            let totalWeekHoursSum = allResults.reduce((sum, item) => {
                                let hrs = parseFloat(item.totalWeekHours) || 0;
                                return sum + hrs;
                            }, 0);

                            let oModel = this.getView().getModel("timeEntryModel");
                            oModel.setProperty("/totalWeekHours", totalWeekHoursSum);
                            let weekDates = oModel.getProperty("/weekDates");

                            // Compare values ignoring OData Date format noise



                            let toDate = d => new Date(d); // convert "2025-11-17" to full Date object

                            let filtered = allResults.filter(item => {
                                let itemStart = item.weekStartDate ? toDate(item.weekStartDate) : null;
                                let itemEnd = item.weekEndDate ? toDate(item.weekEndDate) : null;

                                return itemStart?.getTime() === weekStart.getTime() &&
                                    itemEnd?.getTime() === weekEnd.getTime();
                            });




                            let formatted = filtered.map(item => {

                                // Always ensure projectName holds the visible name
                                let finalName =
                                    item.projectName && item.projectName.trim() !== ""
                                        ? item.projectName
                                        : (item.nonProjectTypeName || "");

                                return {
                                    id: item.ID,
                                    totalWeekHours: item.totalWeekHours,
                                    projectId: item.project_ID,
                                    nonProjectId: item.nonProjectType_ID,

                                    // IMPORTANT: only this is bound to the table column
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


                            formatted.forEach(row => {
                                row.canDelete = this._checkRowDeleteEligibility(row);
                            });
                            oModel.setProperty("/timeEntries", formatted);

                            let dailyTotals = this._calculateDailyTotals(formatted);
                            oModel.setProperty("/dailyTotals", dailyTotals);

                            // NEW: Check delete button visibility
// let showDelete = this._hasZeroHourEntry(dailyTotals);
// oModel.setProperty("/showDeleteButton", showDelete);

                            let totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
                            oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

                            let table = oView.byId("timesheetTable");
                            table?.getBinding("items")?.refresh(true);

                        }.bind(this),

                        error: function (err) {
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


        _formatDateForDisplay: function (oDate) {
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


        onEntryDatePickerChange: function (oEvent) {
    var that = this;
    var oModel = this.getView().getModel("timeEntryModel");
    var oServiceModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    var value = oEvent.getParameter("value");
    if (!value) return;

    var day = this._dayPropertyFromDate(value); // "monday", "saturday", etc.
    var newEntry = oModel.getProperty("/newEntry") || {};
    newEntry.selectedDate = value;
    newEntry.day = day;
    oModel.setProperty("/newEntry", newEntry);

    // Load data
    var loadProjects = new Promise(resolve => {
        oServiceModel.read("/MyProjects", {
            success: oData => {
                let projects = (oData.results || []).map(p => ({
                    id: p.ID,
                    name: p.projectName,
                    isNonProject: false
                }));
                oModel.setProperty("/projects", projects);
                resolve();
            },
            error: () => { oModel.setProperty("/projects", []); resolve(); }
        });
    });

    var loadNonProjects = new Promise(resolve => {
        oServiceModel.read("/AvailableNonProjectTypes", {
            success: oData => {
                let nonProjects = (oData.results || []).map(np => ({
                    id: np.ID,
                    name: np.typeName,
                    isNonProject: true,
                    isLeave: np.typeName.toLowerCase().includes("leave") || np.typeName === "Sick Leave"
                }));
                oModel.setProperty("/nonProjects", nonProjects);
                resolve();
            },
            error: () => { oModel.setProperty("/nonProjects", []); resolve(); }
        });
    });

    var loadTasks = new Promise(resolve => {
        oServiceModel.read("/AvailableTaskTypes", {
            success: oData => {
                let tasks = (oData.results || []).map(t => ({
                    type: t.code,
                    name: t.name
                }));
                oModel.setProperty("/workTypes", tasks);
                resolve();
            },
            error: () => { oModel.setProperty("/workTypes", []); resolve(); }
        });
    });

  Promise.all([loadProjects, loadNonProjects, loadTasks]).then(() => {
    let allProjects = oModel.getProperty("/projects") || [];
    let allNonProjects = oModel.getProperty("/nonProjects") || [];
    let allTasks = oModel.getProperty("/workTypes") || [];

    let selectedDay = newEntry.day; // 👈 use stored value (no undefined surprise)
    let weekInfo = that._getCurrentWeekDates();
    let isFuture = that._isFutureDate(value, weekInfo.weekStart, weekInfo.weekEnd);
    let isWeekend = selectedDay === "saturday" || selectedDay === "sunday";

    let projectsToShow = [];

    let allowedNonProjects = allNonProjects.filter(np => !np.isLeave); 
    // 👆 always exclude leave initially; we add later only where allowed

    if (isFuture) {
        if (isWeekend) {
            // Future Weekend → only NON-LEAVE non-projects
            projectsToShow = allowedNonProjects.map(np => ({
                id: np.id,
                name: np.name,
                isNonProject: true
            }));
        } else {
            // Future Weekday → All non-projects allowed (leave included)
            projectsToShow = allNonProjects.map(np => ({
                id: np.id,
                name: np.name,
                isNonProject: true
            }));
        }

        oModel.setProperty("/isTaskDisabled", true);
        oModel.setProperty("/tasksToShow", []);
    }
    else if (isWeekend) {
        // Current/past Weekend → Projects + NON-LEAVE non-projects
        projectsToShow = [
            ...allProjects.map(p => ({
                id: p.id,
                name: p.name,
                isNonProject: false
            })),
            ...allowedNonProjects.map(np => ({
                id: np.id,
                name: np.name,
                isNonProject: true
            }))
        ];

        oModel.setProperty("/isTaskDisabled", true);
        oModel.setProperty("/tasksToShow", []);
    }
    else {
        // Normal current/past Weekday → All allowed
        projectsToShow = [
            ...allProjects,
            ...allNonProjects
        ];
        oModel.setProperty("/isTaskDisabled", true);
        oModel.setProperty("/tasksToShow", []);
    }

    oModel.setProperty("/projectsToShow", projectsToShow);

    // Validate selection still exists
    let valid = projectsToShow.some(p => p.id === (newEntry.projectId || newEntry.nonProjectTypeID));
    if (!valid) {
        newEntry.projectId = "";
        newEntry.projectName = "";
        newEntry.nonProjectTypeID = "";
        newEntry.nonProjectTypeName = "";
        newEntry.workType = "";
        oModel.setProperty("/newEntry", newEntry);
        oModel.setProperty("/isTaskDisabled", true);
        oModel.setProperty("/tasksToShow", []);
    }
});


},

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
                today.setHours(0, 0, 0, 0); // ignore time
                startWeekDate.setHours(0, 0, 0, 0);

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


        // Handler for project/non-project selection
        onProjectChange: function (oEvent) {
    var oModel = this.getView().getModel("timeEntryModel");
    var oSelectedItem = oEvent.getSource().getSelectedItem();
    if (!oSelectedItem) return;

    var key = oSelectedItem.getKey();
    var text = oSelectedItem.getText();
    var projectsToShow = oModel.getProperty("/projectsToShow") || [];
    var selected = projectsToShow.find(p => p.id === key);
    if (!selected) return;

    var newEntry = oModel.getProperty("/newEntry") || {};

    if (selected.isNonProject) {
        // Non-project selected → disable task
        oModel.setProperty("/newEntry/nonProjectTypeID", key);
        oModel.setProperty("/newEntry/nonProjectTypeName", text);
        oModel.setProperty("/newEntry/projectId", "");
        oModel.setProperty("/newEntry/projectName", "");
        oModel.setProperty("/newEntry/workType", "");
        oModel.setProperty("/tasksToShow", []);
        oModel.setProperty("/isTaskDisabled", true);
    } else {
        // Real project selected → enable task dropdown
        oModel.setProperty("/newEntry/projectId", key);
        oModel.setProperty("/newEntry/projectName", text);
        oModel.setProperty("/newEntry/nonProjectTypeID", "");
        oModel.setProperty("/newEntry/nonProjectTypeName", "");
        oModel.setProperty("/newEntry/workType", "");

        oModel.setProperty("/tasksToShow", oModel.getProperty("/workTypes") || []);
        oModel.setProperty("/isTaskDisabled", false);
    }

    oModel.setProperty("/newEntry", newEntry);
},
        onSaveNewEntry: function () {
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

        _resetNewEntryFields: function () {
    let oModel = this.getView().getModel("timeEntryModel");

    oModel.setProperty("/newEntry", {
        projectId: "",
        projectName: "",
        nonProjectTypeID: "",
        nonProjectTypeName: "",
        workType: "",
        isBillable: false,
        taskDetails: "",
        hours: "",
        selectedDate: oModel.getProperty("/newEntry/selectedDate") // keep same date
    });
},

        onSaveAndNewEntry: function () {
    var oModel = this.getView().getModel("timeEntryModel");
    var oNewEntry = oModel.getProperty("/newEntry") || {};
    var that = this;

    // Validate hours
    var hoursForDay = parseFloat(oNewEntry.hours) || 0;
    if (hoursForDay <= 0 || hoursForDay > 15) {
        sap.m.MessageBox.error("Hours must be between 0 and 15");
        return false;
    }

    var selectedDateStr = oNewEntry.selectedDate;
    var dayProp = this._dayPropertyFromDate(selectedDateStr);
    var hoursProp = dayProp + "Hours";
    var taskProp = dayProp + "TaskDetails";

    // Prepare new row
    var newRow = {
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

    // Set selected day's values
    newRow[hoursProp] = hoursForDay;
    newRow[taskProp] = oNewEntry.taskDetails || "";

    // Switch project mode
    if (oNewEntry.isBillable) {
        newRow.nonProjectType_ID = oNewEntry.projectId;
    } else {
        newRow.project_ID = oNewEntry.projectId;
    }

    // Main pipeline (same as Save)
    this._fetchWeekBoundaries(selectedDateStr)
        .then(weekData => that._persistToBackendNew(newRow, selectedDateStr, weekData))
        .then(() => {
            that._loadTimeEntriesFromBackend();

            // 🔥 Do NOT close dialog
            // that._oAddEntryDialog.close(); ❌ removed

            // 🔄 Instead reset fields for new entry
            that._resetNewEntryFields();

            sap.m.MessageToast.show("Saved! Add another entry.");
        })
        .catch(err => {
            console.error("❌ Error while saving entry: ", err);
            sap.m.MessageBox.error("Failed to save timesheet.");
        });

    return true;
},
 _persistToBackendNew: async function (entry, selectedDateStr, weekData) {
            var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
            let that = this;
            var dayProp = this._dayPropertyFromDate(selectedDateStr);
            if (!dayProp) return Promise.reject("Invalid day property");

            var oNewEntry = this.getView().getModel("timeEntryModel").getProperty("/newEntry") || {};
            var hours = Number(entry[dayProp + "Hours"]) || 0;
            var task = oNewEntry.taskDetails || "";
            entry[dayProp + "TaskDetails"] = task;

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

            var oUser = this.getOwnerComponent().getModel("currentUser").getData();
            let employeeID = oUser.id;

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
                thursdayHours: entry.thursdayHours, thursdayTaskDetails: entry.thursdayTaskDetails || "", thursdayDate: null,
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
                    filters: [new sap.ui.model.Filter({ path: "employee_ID", operator: "EQ", value1: employeeID })],
                    success: function (oData) {
                        let items = oData?.results || [];

                        // 🔹 Calculate total hours for this day/column
                        // Convert OData date "/Date(1731887400000)/" → "2025-11-18"
                        function normalizeDate(d) {
                            if (!d) return null;
                            try {
                                return new Date(d).toISOString().split("T")[0]; // → "2025-11-17"
                            } catch (e) {
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
                                success: function (oData) {
                                    if (that._oAddEntryDialog) { that._oAddEntryDialog.close(); }
                                    sap.m.MessageToast.show("Timesheet updated successfully!");
                                    resolve(oData);
                                },
                                error: reject
                            });
                        } else {
                            // Create new
                           oModel.create("/MyTimesheets", payloadFull, {
    success: function (data) {

        // RESET FORM MODEL COMPLETELY
        let timeEntryModel = that.getView().getModel("timeEntryModel");

        // Reset newEntry object (project, nonproject, task, hours, taskDetails, etc.)
        timeEntryModel.setProperty("/newEntry", {
            project_ID: null,
            projectName: "",
            nonProjectTypeID: null,
            nonProjectTypeName: "",
            task: "",
            taskDetails: "",
            mondayHours: null,
            tuesdayHours: null,
            wednesdayHours: null,
            thursdayHours: null,
            fridayHours: null,
            saturdayHours: null,
            sundayHours: null
        });

        // Reset project/task dropdown lists
        oModel.setProperty("/projectsToShow", []);
        oModel.setProperty("/tasksToShow", []);

        // Reset hours & taskDetails on entry object
        entry[dayProp + "Hours"] = null;
        entry[dayProp + "TaskDetails"] = "";

        // RESET SELECTED DATE BACK TO ORIGINAL DATE
        // timeEntryModel.setProperty("/selectedDate", selectedDateStr);

        // If dialog exists → close & reopen cleanly
        // if (that._oAddEntryDialog) {
        //     that._oAddEntryDialog.close();
        // }

        sap.m.MessageToast.show("Timesheet saved! Form reset successfully.");
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

      onDeleteRows: function (oEvent) {
    let row = oEvent.getSource().getBindingContext("timeEntryModel").getObject();
    this._deleteEntryIfZero(row);
},

_deleteEntryIfZero: function (entry) {

    sap.ui.core.BusyIndicator.show(0);

    const dayKeys = [
        "mondayHours","tuesdayHours","wednesdayHours",
        "thursdayHours","fridayHours","saturdayHours","sundayHours"
    ];

    // Check this ONE row only
    let allZero = dayKeys.every(day => Number(entry[day] || 0) === 0);

    if (!allZero) {
        sap.m.MessageBox.information("Cannot delete — this row has hours.");
        sap.ui.core.BusyIndicator.hide();
        return;
    }

    // If all hours = 0 → DELETE
    const oOData = this.getOwnerComponent().getModel("timesheetServiceV2");
    const sPath = "/MyTimesheets('" + entry.id + "')";
    const that = this;

    oOData.remove(sPath, {
        success: function () {
            // Remove locally without refreshing the whole page
            let aEntries = that.getView().getModel("timeEntryModel").getProperty("/timeEntries") || [];
            let filtered = aEntries.filter(e => e.id !== entry.id);

            that.getView().getModel("timeEntryModel").setProperty("/timeEntries", filtered);

            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("Deleted successfully.");
        },
        error: function (err) {
            console.error("Delete failed", err);
            sap.ui.core.BusyIndicator.hide();
        }
    });
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

    // Always compute week boundary
    let weekBoundary = await this._getWeekStartEndOData(selectedDateStr);
    let weekStart = weekBoundary.weekStart;
    let weekEnd = weekBoundary.weekEnd;

    // Day map
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

    var oUser = this.getOwnerComponent().getModel("currentUser").getData();
    let employeeID = oUser.id;

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
        thursdayHours: entry.thursdayHours, thursdayTaskDetails: entry.thursdayTaskDetails || "", thursdayDate: null,
        fridayHours: entry.fridayHours, fridayTaskDetails: entry.fridayTaskDetails || "", fridayDate: null,
        saturdayHours: entry.saturdayHours, saturdayTaskDetails: entry.saturdayTaskDetails || "", saturdayDate: null,
        sundayHours: entry.sundayHours, sundayTaskDetails: entry.sundayTaskDetails || "", sundayDate: null
    };

    payloadFull[dayDateField] = toODataDate(selectedDateStr);

    return new Promise((resolve, reject) => {
        oModel.read("/MyTimesheets", {
            filters: [new sap.ui.model.Filter({ path: "employee_ID", operator: "EQ", value1: employeeID })],

            success: function (oData) {
                let items = oData?.results || [];

                // Convert OData date -> yyyy-mm-dd
                function normalizeDate(d) {
                    if (!d) return null;
                    try {
                        return new Date(d).toISOString().split("T")[0];
                    } catch (e) {
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

                // Sum only hours for limit validation
                let currentTotal = filteredItems.reduce((sum, i) =>
                    sum + (Number(i[dayProp + "Hours"]) || 0), 0
                );

                let newTotal = currentTotal + Number(hours);

                if (newTotal > 15) {
                    sap.m.MessageBox.error(
                        `You can only log 15 hours max on ${selectedDateStr}.`
                    );
                    if (that._oAddEntryDialog) {
                        that._oAddEntryDialog.close();
                    }
                    return;
                }

                // ---------------- ALWAYS CREATE (update removed fully) ----------------
                oModel.create("/MyTimesheets", payloadFull, {
                    success: function (data) {
                        if (that._oAddEntryDialog) { that._oAddEntryDialog.close(); }
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
            },
            error: reject
        });
    });
},




        validateDailyHours: async function (employeeId, workDate, hoursToAdd, existingTaskId = null) {
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
        _parseToDate: function (dateStr) {
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
        _calculateWeekBoundaryFromDate: function (date) {
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
        _getWeekRange: function (date) {
            let d = new Date(date);
            let diff = (d.getDay() === 0 ? -6 : 1 - d.getDay());

            let monday = new Date(d);
            monday.setDate(d.getDate() + diff);

            let sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            let fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
        _formatDateForOData: function (dateStr) {
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

        _validateMandatoryFields: function (entry) {
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

        _parseODataDate: function (s) {
            if (!s) return null;
            let match = /\/Date\((\d+)\)\//.exec(s);
            return match ? new Date(parseInt(match[1], 10)) : null;
        },

        _loadWeekEntries: function (mondayDate) {
            let oService = this.getOwnerComponent().getModel("timesheetServiceV2");
            let oModel = this.getView().getModel("timeEntryModel");

            let sWeekStart = this._formatDateForModel(mondayDate);
            let sWeekEnd = this._formatDateForModel(new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6));

            let rawFilter = `weekStartDate eq datetime'${sWeekStart}T00:00:00' and weekEndDate eq datetime'${sWeekEnd}T00:00:00'`;
            console.log("Filter:", rawFilter);

            oService.read("/MyTimesheets", {
                urlParameters: { "$filter": rawFilter },
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    let results = oData.d?.results || oData.results || [];

                    // Filter the response to make sure weekStartDate & weekEndDate match exactly
                    let weekDataFromBackend = results.filter(item => {
                        let itemWeekStart = item.weekStartDate ? new Date(item.weekStartDate).toISOString().split("T")[0] : null;
                        let itemWeekEnd = item.weekEndDate ? new Date(item.weekEndDate).toISOString().split("T")[0] : null;

                        let start = new Date(sWeekStart).toISOString().split("T")[0];
                        let end = new Date(sWeekEnd).toISOString().split("T")[0];

                        return itemWeekStart === start && itemWeekEnd === end;
                    });





                    let weekData;

                   if (weekDataFromBackend.length > 0) {
    weekData = weekDataFromBackend.map(item => {
        let finalProjectName = item.projectName
            ? item.projectName
            : item.nonProjectTypeName || "";

        return {
            id: item.ID,
            totalWeekHours: item.totalWeekHours,
            projectId: item.project_ID,
            projectName: finalProjectName,
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

    // 🧨 New delete eligibility check!!
    weekData.forEach(row => {
        row.canDelete = this._checkRowDeleteEligibility(row);
    });
}
 else {
                        // No matching week → show nothing
                        weekData = [];
                        oModel.setProperty("/timeEntries", weekData);

                        oModel.setProperty("/dailyTotals", {
                            monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
                            friday: 0, saturday: 0, sunday: 0
                        });
                        oModel.setProperty("/totalWeekHours", 0);

                        let table = this.getView().byId("timesheetTable");
                        table?.getBinding("items")?.refresh(true);
                    }


                    // Apply week data to the table
                    this._applyWeekData(weekData);

                }.bind(this),
                error: function (err) {
                    console.error("Failed to load week entries", err);
                }.bind(this)
            });
        },


        _applyWeekData: function (data) {
            let oModel = this.getView().getModel("timeEntryModel");

            // Set entries
            oModel.setProperty("/timeEntries", data);

            // Calculate daily totals
            let dailyTotals = this._calculateDailyTotals(data);
            oModel.setProperty("/dailyTotals", dailyTotals);

            // Total week hours
            let totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
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

        _setDatePicker: function (oDate) {
            let oDP = this.byId("datePicker");
            if (oDP && oDate) {
                oDP.setDateValue(oDate);
            }
        },

        onNextWeekTS: function () {
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

        onPreviousWeekTS: function () {
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

        onCurrentWeekTS: function () {
            sap.ui.core.BusyIndicator.show(0)
            var monday = this._getCurrentWeekMonday();
            this._currentWeekStartDate = monday;
            this._updateWeekDates(monday);
            this._loadWeekEntries(monday);
            this._setDatePicker(monday)
        },


        _updateDailyTotals: function () {
            var oModel = this.getView().getModel("timeEntryModel");
            var aEntries = oModel.getProperty("/timeEntries") || [];
            var totals = {
                monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
                friday: 0, saturday: 0, sunday: 0
            };

            aEntries.forEach(function (entry) {
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
        _updateWeekDates: function (oDate) {
            var oModel = this.getView().getModel("timeEntryModel");

            var monday = this._getMonday(oDate); // helper to get Monday from any date
            var weekDates = {};
            ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach((day, i) => {
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
            oModel.setProperty("/isCurrentWeek", today >= monday && today <= new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000));
        },
        _getMonday: function (oDate) {
            var day = oDate.getDay();
            var diff = oDate.getDate() - day + (day === 0 ? -6 : 1);
            var monday = new Date(oDate);
            monday.setDate(diff);
            monday.setHours(0, 0, 0, 0);
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
                    { name: "Monday", hours: oEntry.mondayHours || 0, comment: oEntry.mondayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.monday) },
                    { name: "Tuesday", hours: oEntry.tuesdayHours || 0, comment: oEntry.tuesdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.tuesday) },
                    { name: "Wednesday", hours: oEntry.wednesdayHours || 0, comment: oEntry.wednesdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.wednesday) },
                    { name: "Thursday", hours: oEntry.thursdayHours || 0, comment: oEntry.thursdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.thursday) },
                    { name: "Friday", hours: oEntry.fridayHours || 0, comment: oEntry.fridayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.friday) },
                    { name: "Saturday", hours: oEntry.saturdayHours || 0, comment: oEntry.saturdayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.saturday) },
                    { name: "Sunday", hours: oEntry.sundayHours || 0, comment: oEntry.sundayTaskDetails || "No task details", date: that._formatDateForDisplay(oWeekDates.sunday) }
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
                        press: function () { oDialog.close(); }
                    }),
                    afterClose: function () { oDialog.destroy(); }
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
                        userRole: oRawProfile.roleName
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

    if (!oDataModel) {
        sap.m.MessageBox.error("OData model not found. Fix your manifest my dude.");
        return;
    }

    sap.ui.core.BusyIndicator.show(0);

    oDataModel.read("/BookedHoursOverview", {
        success: function (oData) {
            sap.ui.core.BusyIndicator.hide();

            if (!oData || !oData.results || !oData.results.length) {
                sap.m.MessageBox.warning("Bro, no booked hours data found.");
                return;
            }

            let aResults = oData.results;

            // Build clean report UI text
            let sReport = "📊 Project Booked Hours Report\n\n";

            aResults.forEach(function (oProject) {
                sReport += "📌 Project: " + oProject.Project + "\n";
                sReport += "🕒 Allocated Hours: " + oProject.AllocatedHours + "\n";
                sReport += "⏱️ Booked Hours: " + oProject.BookedHours + "\n";
                sReport += "💡 Remaining Hours: " + oProject.RemainingHours + "\n";
                sReport += "📈 Utilization: " + oProject.Utilization + "\n";
                sReport += "──────────────────────────────\n";
            });

            sap.m.MessageBox.information(sReport, {
                title: "Booked Hours Overview"
            });
        },
        error: function (oError) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Failed to load Booked Hours Overview.");
            console.error("OData Error: ", oError);
        }
    });
},

        // Helper function to format OData /Date(…) format to dd-mm-yyyy
        _formatODataDate: function (oDate) {
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
