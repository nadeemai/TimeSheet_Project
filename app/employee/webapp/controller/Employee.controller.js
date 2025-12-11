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
                allowedLeaveHours: [],
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
                }.bind(this),
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

            // Project Engagement Duration
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

            oModel.read("/ApprovalFlow", {
                success: function(oData){
                    var oEntryModel = oData.results;

                    var oEntryJSONModel = new sap.ui.model.json.JSONModel();
                    oEntryJSONModel.setData({employeeTotalEntry : oEntryModel})
                }
            })
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

    _parseAnyDate: function (str) {
    if (!str) return null;

    str = String(str).trim();

    // Case 1 → ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        let [yyyy, mm, dd] = str.split("T")[0].split("-").map(Number);
        return new Date(yyyy, mm - 1, dd);
    }

    // Case 2 → WorkZone MM/DD/YY
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
        let [mm, dd, yy] = str.split("/").map(Number);
        return new Date(2000 + yy, mm - 1, dd); // always 20xx
    }

    // Case 3 → MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        let [mm, dd, yyyy] = str.split("/").map(Number);
        return new Date(yyyy, mm - 1, dd);
    }

    // Case 4 → DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        let [dd, mm, yyyy] = str.split("/").map(Number);
        return new Date(yyyy, mm - 1, dd);
    }

    // fallback
    let d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
},


_calculateWeek: function (date) {
    if (!(date instanceof Date) || isNaN(date)) return null;

    let d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let day = d.getDay(); // 0 = Sun, 1 = Mon

    // If Sunday → go back 6 days; else → back to Monday
    let diffToMonday = (day === 0 ? -6 : 1 - day);

    // Monday
    let monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    // Sunday
    let sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { weekStart: monday, weekEnd: sunday };
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

            let selectedDateStr = oModel.getProperty("/selectedDate");

            if (!selectedDateStr) {
                // fallback only on very first load
                let monday = this._getCurrentWeekMonday();
                selectedDateStr = monday.toISOString().split("T")[0];
            }


            this._fetchWeekBoundaries(selectedDateStr)
                .then(week => {

                     let backendStart = new Date(week.getWeekBoundaries.weekStart);
    let backendEnd = new Date(week.getWeekBoundaries.weekEnd);

    

    // Convert selected date properly first:
    let sel = this._parseAnyDate(selectedDateStr);   // we'll add function below

    // Calculate correct Monday → Sunday for selected date
    let calc = this._calculateWeek(sel);

    let calcStart = calc.weekStart;
    let calcEnd = calc.weekEnd;

  
    let useBackend =
        sel >= backendStart &&
        sel <= backendEnd;

    let finalStart = useBackend ? backendStart : calcStart;
    let finalEnd   = useBackend ? backendEnd   : calcEnd;

    console.log("🏁 FINAL Week Start:", finalStart);
    console.log("🏁 FINAL Week End:", finalEnd);

    // Now update UI using FINAL weekStart
    this._updateWeekDates(finalStart);

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


                            let toDate = d => new Date(d); // convert "2025-11-17" to full Date object
function normalizeToLocalMidnight(d) {
    if (!(d instanceof Date)) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

                            let filtered = allResults.filter(item => {
                               let itemStart = item.weekStartDate 
    ? normalizeToLocalMidnight(new Date(item.weekStartDate)) 
    : null;

let itemEnd = item.weekEndDate 
    ? normalizeToLocalMidnight(new Date(item.weekEndDate)) 
    : null;

let fs = normalizeToLocalMidnight(finalStart);
let fe = normalizeToLocalMidnight(finalEnd);


                              return itemStart?.getTime() === fs.getTime() &&
       itemEnd?.getTime() === fe.getTime();

                            });





                            let formatted = filtered.map(item => {

                                const isLeaveEntry =
    (item.nonProjectTypeName && item.nonProjectTypeName.toLowerCase().includes("leave")) ||
    (item.task && item.task.toLowerCase().includes("leave"));

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

                                    dates: weekDates,

                                    // UI logic for leave button color
mondayIsLeave: isLeaveEntry && Number(item.mondayHours) > 0,
tuesdayIsLeave: isLeaveEntry && Number(item.tuesdayHours) > 0,
wednesdayIsLeave: isLeaveEntry && Number(item.wednesdayHours) > 0,
thursdayIsLeave: isLeaveEntry && Number(item.thursdayHours) > 0,
fridayIsLeave: isLeaveEntry && Number(item.fridayHours) > 0,

// weekends cannot have leave → always false
saturdayIsLeave: false,
sundayIsLeave: false,


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


      _isFutureDate: function (selectedDateStr, weekStartStr, weekEndStr) {

    // --- convert date string into Date object ---
    function parseFlexibleDate(str) {
    if (!str) return null;

    // If already a Date
    if (str instanceof Date) {
        const d = new Date(str.getFullYear(), str.getMonth(), str.getDate());
        d.setHours(0,0,0,0);
        return d;
    }

    // If UI5 may pass object like { value: "2026-01-19" }
    if (typeof str === "object") {
        str = str.value || str.date || null;
        if (!str) return null;
    }

    if (typeof str !== "string") return null;
    str = str.trim();

    // 1) ISO YYYY-MM-DD or ISO datetime
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const clean = str.split("T")[0];
        const [yyyy, mm, dd] = clean.split("-").map(Number);
        const d = new Date(yyyy, mm - 1, dd);
        d.setHours(0,0,0,0);
        return isNaN(d.getTime()) ? null : d;
    }

    // 2) DD/MM/YYYY (unambiguous)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split("/").map(Number);
        const d = new Date(yyyy, mm - 1, dd);
        d.setHours(0,0,0,0);
        return isNaN(d.getTime()) ? null : d;
    }

    // 3) Short form with two-digit year: M/D/YY or D/M/YY (ambiguous)
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
        let [p1, p2, yy] = str.split("/").map(Number);
        const yyyy = 2000 + yy;

        // If first part > 12 -> first is day (DD/MM/YY)
        if (p1 > 12 && p2 <= 12) {
            const d = new Date(yyyy, p2 - 1, p1);
            d.setHours(0,0,0,0);
            return isNaN(d.getTime()) ? null : d;
        }

        // If second part > 12 -> second is day -> MM/DD/YY (Workzone style)
        if (p2 > 12 && p1 <= 12) {
            const d = new Date(yyyy, p1 - 1, p2);
            d.setHours(0,0,0,0);
            return isNaN(d.getTime()) ? null : d;
        }

        // Both <= 12 -> treat as MM/DD/YY (Workzone) — safer for your deployment
        const d = new Date(yyyy, p1 - 1, p2);
        d.setHours(0,0,0,0);
        return isNaN(d.getTime()) ? null : d;
    }

    // 4) Fallback to Date parse (rare)
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return d;
}


    let selectedDate = parseFlexibleDate(selectedDateStr);
    let today = new Date();

    // Normalize time to 00:00 to avoid time-zone issues
    selectedDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    // Parse weekStart/weekEnd (ISO)
    let ws = new Date(weekStartStr);
    let we = new Date(weekEndStr);
    ws.setHours(0,0,0,0);
    we.setHours(0,0,0,0);

    // --- Year comparison ---
    if (selectedDate.getFullYear() > today.getFullYear()) return true;
    if (selectedDate.getFullYear() < today.getFullYear()) return false;

    // --- Month comparison ---
    if (selectedDate.getMonth() > today.getMonth()) return true;
    if (selectedDate.getMonth() < today.getMonth()) return false;

    // --- SAME YEAR + SAME MONTH ---

    // if selected date is > today → FUTURE (even inside current week)
    if (selectedDate > today) return true;

    // if inside same week and <= today → NOT future
    if (selectedDate >= ws && selectedDate <= we) return false;

    //  same month but outside week → future
    return true;
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

    let weekInfo = that._getCurrentWeekDates();
    let isFuture = that._isFutureDate(value, weekInfo.weekStart, weekInfo.weekEnd);
    let isInsideCurrentWeek = that._isDateInsideWeek(value, weekInfo.weekStart, weekInfo.weekEnd);
    let isPastBeforeWeek = this._isPastBeforeWeek(value, weekInfo.weekStart);

    function getWeekdayFromDate(dateStr) {
    function parseFlexibleDate(str) {
        if (!str) return null;

        // Already Date object
        if (str instanceof Date) return new Date(str.getFullYear(), str.getMonth(), str.getDate());

        // Trim and normalize
        str = String(str).trim();

        // ISO YYYY-MM-DD (safe)
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const [yyyy, mm, dd] = str.split("T")[0].split("-").map(Number);
            return new Date(yyyy, mm - 1, dd);
        }

        // Slash formats
        if (str.includes("/")) {
            const parts = str.split("/").map(s => s.trim());
            if (parts.length !== 3) return new Date(str);

            const [p1, p2, p3] = parts;
            const n1 = Number(p1), n2 = Number(p2);
            const yearPart = p3;

            // If year is 4 digits → assume DD/MM/YYYY (India)
            if (/^\d{4}$/.test(yearPart)) {
                const yyyy = Number(yearPart);
                const dd = n1;
                const mm = n2;
                return new Date(yyyy, mm - 1, dd);
            }

            // If year is 2 digits → Workzone style likely MM/DD/YY,
            // but if first part > 12 then it's DD/MM/YY
            if (/^\d{2}$/.test(yearPart)) {
                const yyyy = 2000 + Number(yearPart);
                if (n1 > 12) {
                    // DD/MM/YY
                    return new Date(yyyy, n2 - 1, n1);
                } else {
                    // MM/DD/YY (assume Workzone)
                    return new Date(yyyy, n1 - 1, n2);
                }
            }

            // Fallback: try to interpret as DD/MM/YYYY if ambiguous
            // (most likely for your users)
            const yyyy = Number(yearPart.length === 2 ? "20" + yearPart : yearPart);
            return new Date(yyyy, n2 - 1, n1);
        }

        // Fallback to Date parsing
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    const d = parseFlexibleDate(dateStr);
    if (!d || isNaN(d.getTime())) return null;

    const days = [
        "sunday", "monday", "tuesday", "wednesday",
        "thursday", "friday", "saturday"
    ];
    return days[d.getDay()];
}

    let selectedDay = getWeekdayFromDate(value);
    let isWeekend = (selectedDay === "saturday" || selectedDay === "sunday");

    let allowedNonProjects = allNonProjects.filter(np => !np.isLeave);
    let projectsToShow = [];

    if (isPastBeforeWeek) {
    projectsToShow = [
        ...allProjects,
        ...allNonProjects        
    ];

    oModel.setProperty("/projectsToShow", projectsToShow);
    oModel.setProperty("/tasksToShow", []);
    oModel.setProperty("/isTaskDisabled", true);
    return;
}


if (isInsideCurrentWeek) {

    if (!isWeekend) {
        // Weekday inside current week → show everything
        projectsToShow = [...allProjects, ...allNonProjects];
    } else {
        // Weekend inside current week → exclude leave
        projectsToShow = [
            ...allProjects,
            ...allowedNonProjects
        ];
    }
}
else {
    if (!isWeekend) {
        // Weekday future outside → only non-projects + leave
        projectsToShow = [...allNonProjects];
    } else {
        // Weekend future outside → only non-projects without leave
        projectsToShow = [...allowedNonProjects];
    }
}

oModel.setProperty("/projectsToShow", projectsToShow);
oModel.setProperty("/tasksToShow", []);
oModel.setProperty("/isTaskDisabled", true);


});



        },
        _isPastBeforeWeek: function (dateStr, weekStart) {
    const normalize = (d) => {
        const nd = new Date(d);
        nd.setHours(0, 0, 0, 0);
        return nd;
    };

    const selected = normalize(dateStr);
    const start = normalize(weekStart);

    return selected < start;  
},

   _isDateInsideWeek: function(dateStr, weekStart, weekEnd) {

    const normalize = (d) => {
        if (!d) return null;
        const nd = new Date(d);
        nd.setHours(0, 0, 0, 0);
        return nd;
    };

    const selected = normalize(dateStr);
    const start = normalize(weekStart);
    const end = normalize(weekEnd);

    if (!selected || !start || !end) return false;

    return selected >= start && selected <= end;
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

            let defaultHours = [];
for (let i = 1; i <= 15; i++) {
    defaultHours.push({ key: String(i), text: String(i) });
}
oModel.setProperty("/allowedLeaveHours", defaultHours);


            // Initialize newEntry with empty/default values
            oModel.setProperty("/newEntry", {
                selectedDate: selectedDateStr,
                projectId: "",              
                projectName: "",            
                nonProjectTypeID: "",       
                nonProjectTypeName: "",     
                workType: "",
                leaveType: "",
                leaveTypeName: "",
                hours: "",
                taskDetails: "",
                dailyComments: {},
                isHoursEditable: false,
                isLeaveSelected: false
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

            var loadLeaveTypes = new Promise(function (resolve) {
    oServiceModel.read("/AvailableLeaveTypes", {
        success: function (oData) {
            var aLeaves = oData.results.map(l => ({
                id: l.ID,
                name: l.typeName
            }));
            oModel.setProperty("/leaveTypes", aLeaves);
            resolve();
        },
        error: function () {
            oModel.setProperty("/leaveTypes", []);
            resolve();
        }
    });
});


            // Open dialog after all promises
         Promise.all([loadProjects, loadNonProjects, loadTasks, loadLeaveTypes]).then(function () {

    var startWeekDate = that._currentWeekStartDate || new Date(); // Monday of displayed week
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    startWeekDate.setHours(0, 0, 0, 0);

    // Selected DATE for Add Entry (day inside the week)
    var selectedDateStr = oModel.getProperty("/newEntry/selectedDate");
    var selectedDate = new Date(selectedDateStr);
    selectedDate.setHours(0, 0, 0, 0);

    var dayIndex = selectedDate.getDay(); // 0 Sun - 6 Sat
    var isWeekend = (dayIndex === 6 || dayIndex === 0); // Sat/Sun
    var isFutureWeek = startWeekDate > today;

    var allProjects = oModel.getProperty("/projects") || [];
    var allNonProjects = oModel.getProperty("/nonProjects") || [];


    if (isFutureWeek || isWeekend) {
       
        var projectsToShow = allNonProjects.map(np => ({
            id: np.nonProjectTypeID,
            name: np.nonProjectTypeName,
            isNonProject: true
        }));

        oModel.setProperty("/projectsToShow", projectsToShow);
        oModel.setProperty("/tasksToShow", []);          // disable task dropdown
        oModel.setProperty("/isTaskDisabled", true);
    } else {
        var projectsToShow = [
            ...allProjects.map(p => ({
                id: p.projectId,
                name: p.projectName,
                isNonProject: false
            })),
            ...allNonProjects.map(np => ({
                id: np.nonProjectTypeID,
                name: np.nonProjectTypeName,
                isNonProject: true
            }))
        ];

        oModel.setProperty("/projectsToShow", projectsToShow);
        oModel.setProperty("/tasksToShow", oModel.getProperty("/workTypes") || []);
        oModel.setProperty("/isTaskDisabled", false);
    }
    if (!that._oAddEntryDialog) {
        that._oAddEntryDialog = sap.ui.xmlfragment(
            that.getView().getId(),
            "employee.Fragments.AddTimeEntry",
            that
        );
        that.getView().addDependent(that._oAddEntryDialog);
    }

    // Reset fragment UI controls
   let p = sap.ui.getCore().byId(that.getView().getId() + "--projectShow");

if (p) p.setSelectedKey("");
oModel.setProperty("/isHoursEditable", true);



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

    const isLeave = text.toLowerCase() === "leave";

    if (isLeave) {
        newEntry.isLeaveSelected = true;
        newEntry.leaveType = "";
        newEntry.workType = "";

        // Disable task
        oModel.setProperty("/tasksToShow", []);
        oModel.setProperty("/isTaskDisabled", true);

        // Hours disabled until user selects leave type
        oModel.setProperty("/newEntry/hours", "");
        oModel.setProperty("/isHoursEditable", false);

        // set leave as non-project
        newEntry.nonProjectTypeID = key;
        newEntry.nonProjectTypeName = text;
        newEntry.projectId = "";
        newEntry.projectName = "";
    }
    else if (selected.isNonProject) {
        newEntry.isLeaveSelected = false;

        newEntry.nonProjectTypeID = key;
        newEntry.nonProjectTypeName = text;

        newEntry.projectId = "";
        newEntry.projectName = "";
        newEntry.workType = "";

        oModel.setProperty("/tasksToShow", []);
        oModel.setProperty("/isTaskDisabled", true);

        // Hours editable
        oModel.setProperty("/isHoursEditable", true);
    }
    else {
        newEntry.isLeaveSelected = false;

        newEntry.projectId = key;
        newEntry.projectName = text;

        newEntry.nonProjectTypeID = "";
        newEntry.nonProjectTypeName = "";
        newEntry.workType = "";

        oModel.setProperty("/tasksToShow", oModel.getProperty("/workTypes") || []);
        oModel.setProperty("/isTaskDisabled", false);

        // Hours editable
        oModel.setProperty("/isHoursEditable", true);
    }

    oModel.setProperty("/newEntry", newEntry);
},


onLeaveTypeChange: function (oEvent) {
    var oModel = this.getView().getModel("timeEntryModel");
    var selectedKey = oEvent.getSource().getSelectedKey();

    var leaveTypes = oModel.getProperty("/leaveTypes") || [];
    var selectedLeave = leaveTypes.find(l => l.id === selectedKey);

    var newEntry = oModel.getProperty("/newEntry") || {};

    if (selectedLeave) {
        newEntry.leaveType = selectedKey;    
        newEntry.leaveTypeName = selectedLeave.name;
    }

    let selName = (selectedLeave?.name || "").toLowerCase();

    if (selName.includes("personal") || selName.includes("sick")) {
        // Full leave types → allow 4 and 8
        oModel.setProperty("/allowedLeaveHours", [
            { key: "4", text: "4 hours" },
            { key: "8", text: "8 hours" }
        ]);

        newEntry.hours = ""; // user must select
        oModel.setProperty("/isHoursEditable", true);
    }
    else if (selName.includes("half")) {
        // Half-day leave → ONLY 4 hours
        oModel.setProperty("/allowedLeaveHours", [
            { key: "4", text: "4 hours" }
        ]);

        newEntry.hours = "";
        oModel.setProperty("/isHoursEditable", true);
    }
    else {
        // Normal non-project → hours 0–15
        let list = [];
        for (let i = 0; i <= 15; i++) {
            list.push({ key: String(i), text: `${i} hours` });
        }

        oModel.setProperty("/allowedLeaveHours", list);
        newEntry.hours = "";
        oModel.setProperty("/isHoursEditable", true);
    }

    oModel.setProperty("/newEntry", newEntry);
},

        onSaveNewEntry: function () {
            sap.ui.core.BusyIndicator.show(0);
            var oModel = this.getView().getModel("timeEntryModel");
            var oNewEntry = oModel.getProperty("/newEntry") || {};
            var that = this;

            if (!this._validateMandatoryFields(oNewEntry)) {
                sap.ui.core.BusyIndicator.hide();
                return false;
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

            const existingEntries = oModel.getProperty("/timeEntries") || [];
            let isDuplicate = false;

            existingEntries.forEach(e => {
                if (e.workType === oNewEntry.workType &&
                    (e.projectName === oNewEntry.projectName ||
                        e.nonProjectTypeName === oNewEntry.nonProjectTypeName)) {
                    isDuplicate = true;
                }
            });

            if (isDuplicate) {
                sap.m.MessageBox.warning("This entry already exists 👀");
                if (this._oAddEntryDialog) {
                    this._oAddEntryDialog.close();
                    sap.ui.core.BusyIndicator.hide();
                }
                return;
            }

            // Prepare payload
            var newRow = {
                project_ID: null,
                nonProjectType_ID: null,
                projectName: oNewEntry.projectName || "",
                nonProjectTypeName: oNewEntry.nonProjectTypeName,
                nonProjectTypeID: oNewEntry.nonProjectTypeID,
                task: oNewEntry.isLeaveSelected ? "Leave" : oNewEntry.workType,
    leaveType_ID: oNewEntry.isLeaveSelected ? oNewEntry.leaveType : null,
    leaveTypeName: oNewEntry.isLeaveSelected ? oNewEntry.leaveTypeName : null,
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

//  VALIDATION → Prevent multiple leave entries for same day

if (oNewEntry.isLeaveSelected) {

    const timeEntries = oModel.getProperty("/timeEntries") || [];

    const dayProp = this._dayPropertyFromDate(oNewEntry.selectedDate);
    const hoursProp = dayProp + "Hours";

    const alreadyLeave = timeEntries.some(e => {
        let isLeave = e.workType && e.workType.toLowerCase().includes("leave");
        let hasHours = Number(e[hoursProp]) > 0;

        return isLeave && hasHours; // TRUE only if leave entry already exists
    });

    if (alreadyLeave) {
        sap.m.MessageBox.error("Leave already applied for this day.");
        sap.ui.core.BusyIndicator.hide();
        if (that._oAddEntryDialog) that._oAddEntryDialog.close();
        return;
    }
}



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
                    sap.ui.core.BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("❌ Error while creating entry: ", err);
                    // sap.m.MessageBox.error("Failed to save timesheet.");
                });

            return true;
        },



      _resetNewEntryFields: function () {
    let oModel = this.getView().getModel("timeEntryModel");

    oModel.setProperty("/newEntry", {
        selectedDate: oModel.getProperty("/newEntry/selectedDate"), // keep same date
        projectId: "",
        projectName: "",
        nonProjectTypeID: "",
        nonProjectTypeName: "",
        workType: "",
        leaveType: "",
        leaveTypeName: "",
        isLeaveSelected: false,
        isNonProjectSelected: false,
        isBillable: false,
        taskDetails: "",
        hours: "",
        isHoursEditable: false
    });

    // Also reset dropdown states
    oModel.setProperty("/tasksToShow", []);  // hide task dropdown
    oModel.setProperty("/isTaskDisabled", true);
    oModel.setProperty("/isHoursEditable", true); // disable task
},
        onSaveAndNewEntry: function () {
            sap.ui.core.BusyIndicator.show(0);
            var oModel = this.getView().getModel("timeEntryModel");
            var oNewEntry = oModel.getProperty("/newEntry") || {};
            var that = this;

            if (!this._validateMandatoryFields(oNewEntry)) {
                sap.ui.core.BusyIndicator.hide()
                return false;
            }

            // Validate hours
            var hoursForDay = parseFloat(oNewEntry.hours) || 0;
            if (hoursForDay <= 0 || hoursForDay > 15) {
                sap.m.MessageBox.error("Hours must be between 0 and 15");
                sap.ui.core.BusyIndicator.hide()
                return false;
            }

            var selectedDateStr = oNewEntry.selectedDate;
            var dayProp = this._dayPropertyFromDate(selectedDateStr);
            var hoursProp = dayProp + "Hours";
            var taskProp = dayProp + "TaskDetails";
            const existingEntries = oModel.getProperty("/timeEntries") || [];
            let isDuplicate = false;

            existingEntries.forEach(e => {
                if (e.workType === oNewEntry.workType &&
                    (e.projectName === oNewEntry.projectName ||
                        e.nonProjectTypeName === oNewEntry.nonProjectTypeName)) {
                    isDuplicate = true;
                }
            });

            if (isDuplicate) {
                sap.m.MessageBox.warning("This entry already exists 👀");
                if (this._oAddEntryDialog) {
                    this._oAddEntryDialog.close();
                    sap.ui.core.BusyIndicator.hide();
                }
                return;
            }
            // Prepare new row
            var newRow = {
                project_ID: null,
                nonProjectType_ID: null,
                projectName: oNewEntry.projectName || "",
                nonProjectTypeName: oNewEntry.nonProjectTypeName,
                nonProjectTypeID: oNewEntry.nonProjectTypeID,
                   task: oNewEntry.isLeaveSelected ? "Leave" : oNewEntry.workType,
    leaveType_ID: oNewEntry.isLeaveSelected ? oNewEntry.leaveType : null,
    leaveTypeName: oNewEntry.isLeaveSelected ? oNewEntry.leaveTypeName : null,
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

            if (oNewEntry.isLeaveSelected) {

    const timeEntries = oModel.getProperty("/timeEntries") || [];

    const dayProp = this._dayPropertyFromDate(oNewEntry.selectedDate);
    const hoursProp = dayProp + "Hours";

    const alreadyLeave = timeEntries.some(e => {
        let isLeave = e.workType && e.workType.toLowerCase().includes("leave");
        let hasHours = Number(e[hoursProp]) > 0;

        return isLeave && hasHours; // TRUE only if leave entry already exists
    });

    if (alreadyLeave) {
        sap.m.MessageBox.error("Leave already applied for this day.");
        sap.ui.core.BusyIndicator.hide();
        if (that._oAddEntryDialog) that._oAddEntryDialog.close();
        return;
    }
}

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
                    // Instead reset fields for new entry
                    that._resetNewEntryFields();
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Saved! Add another entry.");
                })
                .catch(err => {
                    console.error("❌ Error while saving entry: ", err);
                    if (this._oAddEntryDialog) {
                        this._oAddEntryDialog.close()
                        sap.ui.core.BusyIndicator.hide();
                    }
                    // sap.m.MessageBox.error("Failed to save timesheet.");
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

  
function parseParts(str) {
    if (!str) return null;

    // If already Date
    if (str instanceof Date) {
        return {
            yyyy: str.getFullYear(),
            mm: str.getMonth() + 1,
            dd: str.getDate()
        };
    }

    // UI5 object {value: "..."}
    if (typeof str === "object") str = str.value || str.date;
    if (!str) return null;

    // 1️WorkZone format FIRST → MM/DD/YY
  
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
        let [mm, dd, yy] = str.split("/").map(Number);

        // WorkZone ALWAYS sends MM/DD/YY
        return {
            yyyy: 2000 + yy,
            mm,
            dd
        };
    }


    // 2️ Standard DD/MM/YYYY
    
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split("/").map(Number);
        return { yyyy, mm, dd };
    }

    
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [yyyy, mm, dd] = str.split("-").map(Number);
        return { yyyy, mm, dd };
    }

    // fallback
    const d = new Date(str);
    return isNaN(d.getTime())
        ? null
        : { yyyy: d.getFullYear(), mm: d.getMonth() + 1, dd: d.getDate() };
}



    // Convert YYYY-MM-DD parts → JS UTC date → V2 /Date(x)/
    function partsToV2(parts) {
        const utc = Date.UTC(parts.yyyy, parts.mm - 1, parts.dd);
        return `/Date(${utc})/`;
    }

    // Compute week boundaries in UTC-safe mode
    function calcWeek(parts) {
        let d = new Date(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd));
        let day = d.getUTCDay(); // 0 = Sun ... 1 = Mon
        let diffToMonday = (day === 0 ? -6 : 1 - day);

        let ws = new Date(d);
        ws.setUTCDate(d.getUTCDate() + diffToMonday);

        let we = new Date(ws);
        we.setUTCDate(ws.getUTCDate() + 6);

        return {
            weekStart: { yyyy: ws.getUTCFullYear(), mm: ws.getUTCMonth() + 1, dd: ws.getUTCDate() },
            weekEnd: { yyyy: we.getUTCFullYear(), mm: we.getUTCMonth() + 1, dd: we.getUTCDate() }
        };
    }


    const selParts = parseParts(selectedDateStr);
    const selUTC = Date.UTC(selParts.yyyy, selParts.mm - 1, selParts.dd);

    const backendStartParts = parseParts(weekData.getWeekBoundaries.weekStart);
    const backendEndParts = parseParts(weekData.getWeekBoundaries.weekEnd);

    const backendStartUTC = Date.UTC(backendStartParts.yyyy, backendStartParts.mm - 1, backendStartParts.dd);
    const backendEndUTC = Date.UTC(backendEndParts.yyyy, backendEndParts.mm - 1, backendEndParts.dd);

    let useBackend =
        selUTC >= backendStartUTC &&
        selUTC <= backendEndUTC;

    let finalStartParts, finalEndParts;

    if (useBackend) {
        console.warn("➡ Using BACKEND week boundaries");
        finalStartParts = backendStartParts;
        finalEndParts = backendEndParts;
    } else {
        console.warn("➡ Calculating NEW week boundaries");
        const range = calcWeek(selParts);
        finalStartParts = range.weekStart;
        finalEndParts = range.weekEnd;
    }

    const weekStartV2 = partsToV2(finalStartParts);
    const weekEndV2 = partsToV2(finalEndParts);

    console.log("FINAL WeekStart V2:", weekStartV2);
    console.log("FINAL WeekEnd   V2:", weekEndV2);




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

    // --- CREATE PAYLOAD ---
    var payloadFull = {
        employee_ID: employeeID,
        weekStartDate: weekStartV2,
        weekEndDate: weekEndV2,
        project_ID: entry.project_ID || null,
        projectName: entry.projectName,
        nonProjectType_ID: entry.nonProjectTypeID,
        nonProjectTypeName: entry.nonProjectTypeName,
         task: oNewEntry.isLeaveSelected ? "Leave" : oNewEntry.workType,
    leaveType_ID: oNewEntry.isLeaveSelected ? oNewEntry.leaveType : null,
    leaveTypeName: oNewEntry.isLeaveSelected ? oNewEntry.leaveTypeName : null,
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

                   function normalizeAnyDate(input) {
    if (!input) return null;

    // CASE 1 → JS Date object
    if (input instanceof Date && !isNaN(input)) {
        return input.toISOString().split("T")[0]; // yyyy-mm-dd
    }

    // CASE 2 → V2 format /Date(###)/
    let match = /\/Date\((\-?\d+)/.exec(input);
    if (match) {
        const ms = Number(match[1]);
        return new Date(ms).toISOString().split("T")[0];
    }

    // CASE 3 → ISO 2025-12-04
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return input;
    }

    // CASE 4 → DD/MM/YYYY or MM/DD/YYYY
    if (input.includes("/")) {
        let [a, b, c] = input.split("/");

        // fix year
        if (c.length === 2) c = "20" + c;

        // heuristic:
        // if month > 12 → input is DD/MM/YYYY
        if (Number(a) > 12) {
            return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
        }

        // otherwise assume MM/DD/YYYY (Workzone)
        return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    }

    // fallback
    let d = new Date(input);
    if (!isNaN(d)) {
        return d.toISOString().split("T")[0];
    }

    return null;
}
                 let selectedISO = normalizeAnyDate(selectedDateStr);

let filteredItems = items.filter(i => {
    let storedISO = normalizeAnyDate(i[dayDateField]);
    return storedISO && selectedISO && storedISO === selectedISO;
});

                // ---------------- DAILY LIMIT CHECK ----------------
                let currentTotal = filteredItems.reduce((sum, i) =>
                    sum + (Number(i[dayProp + "Hours"]) || 0), 0
                );

                let newTotal = currentTotal + Number(hours);

                if (newTotal > 15) {
                    sap.m.MessageBox.error(`You can only log 15 hours max on ${selectedDateStr}.`);
                    if (that._oAddEntryDialog) that._oAddEntryDialog.close();
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                // ---------------- SAME PROJECT + SAME TASK CHECK ----------------
                function isSameProjectRow(i, entry) {
                    const iProject = i.project_ID || null;
                    const iNonProj = i.nonProjectType_ID || null;

                    const eProject = entry.project_ID || null;
                    const eNonProj = entry.nonProjectTypeID || null;

                    const sameTask =
                        (i.task || "").trim().toLowerCase() === (entry.task || "").trim().toLowerCase();

                    if (iProject && eProject) return sameTask && iProject === eProject;
                    if (iNonProj && eNonProj) return sameTask && iNonProj === eNonProj;
                    return false;
                }

                let exist = filteredItems.find(i => isSameProjectRow(i, entry));

                if (exist) {
                    sap.m.MessageBox.error(
                        "A timesheet entry for this Project + Task + Date already exists.\nDuplicates are not allowed."
                    );
                    if (that._oAddEntryDialog) that._oAddEntryDialog.close();
                    sap.ui.core.BusyIndicator.hide();
                    return; 
                }

                // ---------------- CREATE NEW ROW ----------------
                oModel.create("/MyTimesheets", payloadFull, {
                    success: function (data) {

                        let timeEntryModel = that.getView().getModel("timeEntryModel");

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

                        oModel.setProperty("/projectsToShow", []);
                        oModel.setProperty("/tasksToShow", []);

                        entry[dayProp + "Hours"] = null;
                        entry[dayProp + "TaskDetails"] = "";

                        sap.m.MessageToast.show("Timesheet saved!");
                        resolve(data);
                    },

                    error: function (err) {
                        sap.m.MessageBox.error("Timesheet Already Exists.");
                        sap.ui.core.BusyIndicator.hide();
                        reject(err);
                    }
                });
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
                "mondayHours", "tuesdayHours", "wednesdayHours",
                "thursdayHours", "fridayHours", "saturdayHours", "sundayHours"
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

  function parseParts(str) {
    if (!str) return null;

    // If already Date
    if (str instanceof Date) {
        return {
            yyyy: str.getFullYear(),
            mm: str.getMonth() + 1,
            dd: str.getDate()
        };
    }

    // UI5 object {value: "..."}
    if (typeof str === "object") str = str.value || str.date;
    if (!str) return null;

   
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
        let [mm, dd, yy] = str.split("/").map(Number);

        // WorkZone ALWAYS sends MM/DD/YY
        return {
            yyyy: 2000 + yy,
            mm,
            dd
        };
    }


    //  Standard DD/MM/YYYY
  
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split("/").map(Number);
        return { yyyy, mm, dd };
    }

    //  ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [yyyy, mm, dd] = str.split("-").map(Number);
        return { yyyy, mm, dd };
    }

    // fallback
    const d = new Date(str);
    return isNaN(d.getTime())
        ? null
        : { yyyy: d.getFullYear(), mm: d.getMonth() + 1, dd: d.getDate() };
}



    // Convert YYYY-MM-DD parts → JS UTC date → V2 /Date(x)/
    function partsToV2(parts) {
        const utc = Date.UTC(parts.yyyy, parts.mm - 1, parts.dd);
        return `/Date(${utc})/`;
    }

    // Compute week boundaries in UTC-safe mode
    function calcWeek(parts) {
        let d = new Date(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd));
        let day = d.getUTCDay(); // 0 = Sun ... 1 = Mon
        let diffToMonday = (day === 0 ? -6 : 1 - day);

        let ws = new Date(d);
        ws.setUTCDate(d.getUTCDate() + diffToMonday);

        let we = new Date(ws);
        we.setUTCDate(ws.getUTCDate() + 6);

        return {
            weekStart: { yyyy: ws.getUTCFullYear(), mm: ws.getUTCMonth() + 1, dd: ws.getUTCDate() },
            weekEnd: { yyyy: we.getUTCFullYear(), mm: we.getUTCMonth() + 1, dd: we.getUTCDate() }
        };
    }


 
    const selParts = parseParts(selectedDateStr);
    const selUTC = Date.UTC(selParts.yyyy, selParts.mm - 1, selParts.dd);

    const backendStartParts = parseParts(weekData.getWeekBoundaries.weekStart);
    const backendEndParts = parseParts(weekData.getWeekBoundaries.weekEnd);

    const backendStartUTC = Date.UTC(backendStartParts.yyyy, backendStartParts.mm - 1, backendStartParts.dd);
    const backendEndUTC = Date.UTC(backendEndParts.yyyy, backendEndParts.mm - 1, backendEndParts.dd);

    let useBackend =
        selUTC >= backendStartUTC &&
        selUTC <= backendEndUTC;

    let finalStartParts, finalEndParts;

    if (useBackend) {
        console.warn("➡ Using BACKEND week boundaries");
        finalStartParts = backendStartParts;
        finalEndParts = backendEndParts;
    } else {
        console.warn("➡ Calculating NEW week boundaries");
        const range = calcWeek(selParts);
        finalStartParts = range.weekStart;
        finalEndParts = range.weekEnd;
    }

    const weekStartV2 = partsToV2(finalStartParts);
    const weekEndV2 = partsToV2(finalEndParts);

    console.log("FINAL WeekStart V2:", weekStartV2);
    console.log("FINAL WeekEnd   V2:", weekEndV2);


  



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

            function toODataDateSafe(dateStr) {
    const p = parseParts(dateStr);   // use your correct parseParts() here

    if (!p) return null;

    const utc = Date.UTC(p.yyyy, p.mm - 1, p.dd);

    return `/Date(${utc})/`;
}


            var oUser = this.getOwnerComponent().getModel("currentUser").getData();
            let employeeID = oUser.id;

            var payloadFull = {
                employee_ID: employeeID,
                weekStartDate: weekStartV2,
                weekEndDate: weekEndV2,
                project_ID: entry.project_ID || null,
                projectName: entry.projectName,
                nonProjectType_ID: entry.nonProjectTypeID,
                nonProjectTypeName: entry.nonProjectTypeName,
                task: oNewEntry.isLeaveSelected ? "Leave" : oNewEntry.workType,
    leaveType_ID: oNewEntry.isLeaveSelected ? oNewEntry.leaveType : null,
    leaveTypeName: oNewEntry.isLeaveSelected ? oNewEntry.leaveTypeName : null,
                isBillable: true,
                mondayHours: entry.mondayHours, mondayTaskDetails: entry.mondayTaskDetails || "", mondayDate: null,
                tuesdayHours: entry.tuesdayHours, tuesdayTaskDetails: entry.tuesdayTaskDetails || "", tuesdayDate: null,
                wednesdayHours: entry.wednesdayHours, wednesdayTaskDetails: entry.wednesdayTaskDetails || "", wednesdayDate: null,
                thursdayHours: entry.thursdayHours, thursdayTaskDetails: entry.thursdayTaskDetails || "", thursdayDate: null,
                fridayHours: entry.fridayHours, fridayTaskDetails: entry.fridayTaskDetails || "", fridayDate: null,
                saturdayHours: entry.saturdayHours, saturdayTaskDetails: entry.saturdayTaskDetails || "", saturdayDate: null,
                sundayHours: entry.sundayHours, sundayTaskDetails: entry.sundayTaskDetails || "", sundayDate: null
            };

            payloadFull[dayDateField] = toODataDateSafe(selectedDateStr);

            return new Promise((resolve, reject) => {
                oModel.read("/MyTimesheets", {
                    filters: [new sap.ui.model.Filter({ path: "employee_ID", operator: "EQ", value1: employeeID })],

                    success: function (oData) {
                        let items = oData?.results || [];

                        // Convert OData date -> yyyy-mm-dd
               function normalizeAnyDate(input) {
    if (!input) return null;

    // CASE 1 → JS Date object
    if (input instanceof Date && !isNaN(input)) {
        return input.toISOString().split("T")[0]; // yyyy-mm-dd
    }

    // CASE 2 → V2 format /Date(###)/
    let match = /\/Date\((\-?\d+)/.exec(input);
    if (match) {
        const ms = Number(match[1]);
        return new Date(ms).toISOString().split("T")[0];
    }

    // CASE 3 → ISO 2025-12-04
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return input;
    }

    // CASE 4 → DD/MM/YYYY or MM/DD/YYYY
    if (input.includes("/")) {
        let [a, b, c] = input.split("/");

        // fix year
        if (c.length === 2) c = "20" + c;

        // heuristic:
        // if month > 12 → input is DD/MM/YYYY
        if (Number(a) > 12) {
            return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
        }

        // otherwise assume MM/DD/YYYY (Workzone)
        return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    }

    // fallback
    let d = new Date(input);
    if (!isNaN(d)) {
        return d.toISOString().split("T")[0];
    }

    return null;
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

              let selectedISO = normalizeAnyDate(selectedDateStr);

let filteredItems = items.filter(i => {
    let storedISO = normalizeAnyDate(i[dayDateField]);
    return storedISO && selectedISO && storedISO === selectedISO;
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
                                sap.ui.core.BusyIndicator.hide();
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
                                const oTable = that.byId("timesheetTable");
        if (oTable) {
            const binding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (binding) binding.refresh(true);
        }
                                resolve(data);
                            },
                            error: function (err) {
                                sap.m.MessageBox.error("Timesheet Already Exist");
                                sap.ui.core.BusyIndicator.hide();
                                if (that._oAddEntryDialog) { that._oAddEntryDialog.close(); }
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

        _formatDateForOData: function (dateStr) {
            if (!dateStr) return null;

            let [dd, mm, yyyy] = dateStr.split("/");
            return `datetime('${yyyy}-${mm}-${dd}T00:00:00')`;
        },


       
     _dayPropertyFromDate: function (dateStr) {
    if (!dateStr) return undefined;

    
    if (dateStr instanceof Date) {
        if (isNaN(dateStr.getTime())) return undefined;
        return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][dateStr.getDay()];
    }

    if (typeof dateStr === "object") {
        dateStr = dateStr.value || dateStr.date;
        if (!dateStr) return undefined;
    }

    let day, month, year;

    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        [year, month, day] = dateStr.split("-");
        day = Number(day);
        month = Number(month);
        year = Number(year);
    }

   
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        let [dd, mm, yyyy] = dateStr.split("/").map(Number);
        day = dd; month = mm; year = yyyy;
    }

   
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
        let [p1, p2, y] = dateStr.split("/");

        // Fix year
        if (y.length === 2) y = "20" + y;

        let mm = Number(p1);
        let dd = Number(p2);

        
        if (mm <= 12 && dd <= 31) {
            day = dd;
            month = mm;
            year = Number(y);
        } 
        else {
          
            day = mm;
            month = dd;
            year = Number(y);
        }
    }

    else {
        console.warn("Invalid date format:", dateStr);
        return undefined;
    }

   
    let dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) {
        console.warn("Invalid date object:", dateStr);
        return undefined;
    }


    let map = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    return map[dateObj.getDay()];
},



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



           
            let newHours = Number(fNewHours) || 0;

           
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

        

            // If editing hours to 0, task details must be removed
            if (newHours === 0) {
                if (aEntries[iIndex][sDay + "TaskDetails"]) {
                    sap.m.MessageBox.warning(
                        "Task details will be removed when hours are set to 0."
                    );
                }
                sTaskDetails = "";
            }


            let previousTask = aEntries[iIndex][sDay + "TaskDetails"];
            let diff = newHours - previousHours;

          
            aEntries[iIndex][sDay] = newHours;
            aEntries[iIndex][sDay + "TaskDetails"] = sTaskDetails || "";
            oModel.setProperty("/timeEntries", aEntries);

       
            let oPayload = {
                [`${sDay}Hours`]: newHours,
                [`${sDay}TaskDetails`]: sTaskDetails || ""
            };

            sap.ui.core.BusyIndicator.show(0);
            let sPath = oEntry.id ? `/MyTimesheets(guid'${oEntry.id}')` : "/MyTimesheets";

            let fnSuccess = () => {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageToast.show(`${sDay.charAt(0).toUpperCase() + sDay.slice(1)} saved successfully`);

           
                let dailyTotals = oModel.getProperty("/dailyTotals") || {};
                dailyTotals[sDay] = aEntries.reduce((sum, entry) => sum + Number(entry[sDay] || 0), 0);
                oModel.setProperty("/dailyTotals", dailyTotals);

                let totalWeekHours = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
                oModel.setProperty("/totalWeekHours", totalWeekHours.toFixed(2));

               
                this._loadTimeEntriesFromBackend();
            };

            let fnError = () => {
                sap.ui.core.BusyIndicator.hide();
              
                aEntries[iIndex][sDay] = previousHours;
                aEntries[iIndex][sDay + "TaskDetails"] = previousTask;
                oModel.setProperty("/timeEntries", aEntries);

          
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


        // onEditDailyHours: function (oEvent) {
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
        //     var oEntry = this._currentEditEntry;
        //     var sDay = this._currentEditDay;

        //     if (!oEntry || !sDay) {
        //         sap.m.MessageToast.show("Unable to edit. Please try again.");
        //         return;
        //     }

        //     // derive field names
        //     var sHoursField = sDay + "Hours";
        //     var sTaskField = sDay + "TaskDetails";
        //     var sDateField = sDay + "Date";

        //     // safely read values
        //     var fCurrentHours = Number(oEntry[sHoursField]) || 0;
        //     var sCurrentTask = oEntry[sTaskField] || "";

        //     // format date ONLY if exists
        //     var oW = this.getView().getModel("timeEntryModel").getProperty("/weekDates");
        //     var sDateRaw = oW[sDay]; // actual date, e.g. 2025-11-16T00:00:00

        //     var sDateValue = "";
        //     if (sDateRaw) {
        //         try {
        //             var oDate = new Date(sDateRaw);
        //             sDateValue = oDate.toLocaleDateString("en-US", {
        //                 month: "short",
        //                 day: "2-digit",
        //                 year: "numeric"
        //             });
        //             // Result: "Nov 16, 2025"
        //         } catch (e) {
        //             console.warn("⚠ Failed to format date:", sDateRaw, e);
        //             sDateValue = "";
        //         }
        //     }




        //     // Dropdown values 0–24
        //     var aHourOptions = [];
        //     for (var i = 0; i <= 15; i++) {
        //         aHourOptions.push(new sap.ui.core.Item({
        //             key: i.toString(),
        //             text: i + " hour" + (i !== 1 ? "s" : "")
        //         }));
        //     }

        //     // create controls with references
        //     var oHoursCombo = new sap.m.ComboBox({
        //         selectedKey: fCurrentHours.toString(),
        //         items: aHourOptions
        //     });

        //     var oTaskArea = new sap.m.TextArea({
        //         value: sCurrentTask,
        //         rows: 4,
        //         placeholder: "Describe work done..."
        //     });

        //     var oDialog = new sap.m.Dialog({
        //         title: "Edit " + this._capitalize(sDay) + " Entry",
        //         contentWidth: "350px",
        //         titleAlignment: "Center",
        //         content: [
        //             new sap.m.VBox({
        //                 items: [
        //                     // Date Field
        //                     new sap.m.VBox({
        //                         items: [
        //                             new sap.m.Label({
        //                                 text: "Date:",
        //                                 design: "Bold"
        //                             }).addStyleClass("sapUiTinyMarginBottom"),
        //                             new sap.m.Input({
        //                                 value: sDateValue,
        //                                 editable: false
        //                             })
        //                         ]
        //                     }).addStyleClass("sapUiTinyMarginBottom"),

        //                     // Project Field
        //                     new sap.m.VBox({
        //                         items: [
        //                             new sap.m.Label({
        //                                 text: "Project:",
        //                                 design: "Bold"
        //                             }).addStyleClass("sapUiTinyMarginBottom"),
        //                             new sap.m.Input({
        //                                 value: oEntry.projectName,
        //                                 editable: false
        //                             })
        //                         ]
        //                     }).addStyleClass("sapUiTinyMarginBottom"),

        //                     // Task Type Field
        //                     new sap.m.VBox({
        //                         items: [
        //                             new sap.m.Label({
        //                                 text: "Task Type:",
        //                                 design: "Bold"
        //                             }).addStyleClass("sapUiTinyMarginBottom"),
        //                             new sap.m.Input({
        //                                 value: oEntry.workType,
        //                                 editable: false
        //                             })
        //                         ]
        //                     }).addStyleClass("sapUiTinyMarginBottom"),

        //                     // Hours Field
        //                     new sap.m.VBox({
        //                         items: [
        //                             new sap.m.Label({
        //                                 text: "Hours:",
        //                                 design: "Bold",
        //                                 required: true
        //                             }).addStyleClass("sapUiTinyMarginBottom"),
        //                             oHoursCombo
        //                         ]
        //                     }).addStyleClass("sapUiTinyMarginBottom"),

        //                     // Task Details Field
        //                     new sap.m.VBox({
        //                         items: [
        //                             new sap.m.Label({
        //                                 text: "Task Details:",
        //                                 design: "Bold",
        //                                 required: true
        //                             }).addStyleClass("sapUiTinyMarginBottom"),
        //                             oTaskArea.setRows(4).setWidth("100%")
        //                         ]
        //                     })
        //                 ]
        //             }).addStyleClass("sapUiMediumMarginBeginEnd sapUiSmallMarginTopBottom")
        //         ],
        //         beginButton: new sap.m.Button({
        //             text: "Save",
        //             type: "Emphasized",
        //             icon: "sap-icon://save",
        //             press: function () {
        //                 var fNewHours = Number(oHoursCombo.getSelectedKey());
        //                 var sTaskDetails = oTaskArea.getValue();

        //                 if (isNaN(fNewHours) || fNewHours < 0 || fNewHours > 24) {
        //                     sap.m.MessageBox.error("Please select valid hours between 0 and 24");
        //                     return;
        //                 }
        //                 if (!sTaskDetails) {
        //                     sap.m.MessageBox.warning("Task Details can't be empty. Write what you did");
        //                     sap.ui.core.BusyIndicator.hide();
        //                     return;
        //                 }
        //                 this._saveEditedDayHoursAuto(oEntry, sDay, fNewHours, sTaskDetails);
        //                 oDialog.close();
        //             }.bind(this)
        //         }),
        //         endButton: new sap.m.Button({
        //             text: "Cancel",
        //             icon: "sap-icon://decline",
        //             press: function () {
        //                 oDialog.close();
        //             }
        //         }),
        //         afterClose: function () {
        //             oDialog.destroy();
        //         }
        //     });

        //     this.getView().addDependent(oDialog);

        //     oDialog.open();


        // },

//         onEditDailyHours: function (oEvent) {
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

//     if (!oEntry || !sDay) {
//         sap.m.MessageToast.show("Unable to edit. Please try again.");
//         return;
//     }

 
//     var sHoursField = sDay + "Hours";
//     var sTaskField = sDay + "TaskDetails";

//     var fCurrentHours = Number(oEntry[sHoursField]) || 0;
//     var sCurrentTask = oEntry[sTaskField] || "";

//     var weekDates = this.getView().getModel("timeEntryModel").getProperty("/weekDates") || {};
//     var rawDate = weekDates[sDay];
//     var displayDate = "";

//     try {
//         if (rawDate) {
//             var dt = new Date(rawDate);
//             displayDate = dt.toLocaleDateString("en-US", {
//                 month: "short",
//                 day: "2-digit",
//                 year: "numeric"
//             });
//         }
//     } catch (e) {
//         console.warn("Date formatting failed: ", rawDate, e);
//     }

//     const isLeaveEntry =
//         (oEntry.nonProjectTypeName && oEntry.nonProjectTypeName.toLowerCase().includes("leave")) ||
//         (oEntry.workType && ["personal", "sick", "half", "leave"].some(x =>
//             oEntry.workType.toLowerCase().includes(x)
//         ));

//     // ---------------------------------------------------------
//     // Dropdown values 0–15 Hours
//     // ---------------------------------------------------------
//     var aHourOptions = [];
//     for (var i = 0; i <= 15; i++) {
//         aHourOptions.push(new sap.ui.core.Item({
//             key: i.toString(),
//             text: i + " hour" + (i === 1 ? "" : "s")
//         }));
//     }


//     var oHoursCombo = new sap.m.ComboBox({
//         selectedKey: fCurrentHours.toString(),
//         items: aHourOptions,
//         width: "100%",
//         enabled: !isLeaveEntry
//     });

  
//     var oTaskArea = new sap.m.TextArea({
//         value: sCurrentTask,
//         rows: 4,
//         placeholder: "Describe work done...",
//         width: "100%",
//         editable: !isLeaveEntry
//     });

   
//     var oDialog = new sap.m.Dialog({
//         title: "Edit " + this._capitalize(sDay) + " Entry",
//         contentWidth: "350px",
//         titleAlignment: "Center",

//         content: [
//             new sap.m.VBox({
//                 items: [

//                     // DATE
//                     new sap.m.VBox({
//                         items: [
//                             new sap.m.Label({ text: "Date:", design: "Bold" }),
//                             new sap.m.Input({ value: displayDate, editable: false })
//                         ]
//                     }).addStyleClass("sapUiSmallMarginBottom"),

//                     // PROJECT or NON-PROJECT
//                     new sap.m.VBox({
//                         items: [
//                             new sap.m.Label({ text: "Project:", design: "Bold" }),
//                             new sap.m.Input({
//                                 value: oEntry.projectName || oEntry.nonProjectTypeName,
//                                 editable: false
//                             })
//                         ]
//                     }).addStyleClass("sapUiSmallMarginBottom"),

//                     // TASK TYPE or LEAVE TYPE
//                     new sap.m.VBox({
//                         items: [
//                             new sap.m.Label({
//                                 text: isLeaveEntry ? "Leave Type:" : "Task Type:",
//                                 design: "Bold"
//                             }),
//                             new sap.m.Input({
//                                 value: oEntry.workType, // leaveTypeName OR task
//                                 editable: false
//                             })
//                         ]
//                     }).addStyleClass("sapUiSmallMarginBottom"),

//                     // HOURS
//                     new sap.m.VBox({
//                         items: [
//                             new sap.m.Label({
//                                 text: "Hours:",
//                                 design: "Bold",
//                                 required: !isLeaveEntry
//                             }),
//                             oHoursCombo
//                         ]
//                     }).addStyleClass("sapUiSmallMarginBottom"),

//                     // TASK DETAILS
//                     new sap.m.VBox({
//                         items: [
//                             new sap.m.Label({
//                                 text: isLeaveEntry ? "Leave Details:" : "Task Details:",
//                                 design: "Bold",
//                                 required: !isLeaveEntry
//                             }),
//                             oTaskArea
//                         ]
//                     })
//                 ]
//             }).addStyleClass("sapUiMediumMarginBeginEnd sapUiSmallMarginTopBottom")
//         ],

//         // ---------------------------------------------------------
//         // SAVE BUTTON — blocked when leave entry (no editing allowed)
//         // ---------------------------------------------------------
//         beginButton: new sap.m.Button({
//             text: "Save",
//             type: "Emphasized",
//             icon: "sap-icon://save",

//             press: function () {

//                 if (isLeaveEntry) {
//                     sap.m.MessageToast.show("Leave entries cannot be edited.");
//                     oDialog.close();
//                     return;
//                 }

//                 var newHours = Number(oHoursCombo.getSelectedKey());
//                 var newDetails = oTaskArea.getValue();

//                 if (isNaN(newHours) || newHours < 0 || newHours > 24) {
//                     sap.m.MessageBox.error("Select hours between 0 and 24");
//                     return;
//                 }
//                 if (!newDetails.trim()) {
//                     sap.m.MessageBox.warning("Task details cannot be empty.");
//                     return;
//                 }

//                 this._saveEditedDayHoursAuto(oEntry, sDay, newHours, newDetails);
//                 oDialog.close();
//             }.bind(this)
//         }),

//         endButton: new sap.m.Button({
//             text: "Cancel",
//             icon: "sap-icon://decline",
//             press: function () { oDialog.close(); }
//         }),

//         afterClose: function () { oDialog.destroy(); }
//     });

//     this.getView().addDependent(oDialog);
//     oDialog.open();
// },


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

    if (!oEntry || !sDay) {
        sap.m.MessageToast.show("Unable to edit. Please try again.");
        return;
    }

    // Detect if THIS day already has a leave entry
let currentDayIsLeave = false;

switch (sDay) {
    case "monday": currentDayIsLeave = oEntry.mondayIsLeave; break;
    case "tuesday": currentDayIsLeave = oEntry.tuesdayIsLeave; break;
    case "wednesday": currentDayIsLeave = oEntry.wednesdayIsLeave; break;
    case "thursday": currentDayIsLeave = oEntry.thursdayIsLeave; break;
    case "friday": currentDayIsLeave = oEntry.fridayIsLeave; break;
}

// If this exact day already has a leave entry → block updates completely
if (currentDayIsLeave) {
    sap.m.MessageToast.show("Leave is already applied for this day. It cannot be modified.");
    return;   
}


    var sHoursField = sDay + "Hours";
    var sTaskField = sDay + "TaskDetails";

    var fCurrentHours = Number(oEntry[sHoursField]) || 0;
    var sCurrentTask = oEntry[sTaskField] || "";

    var weekDates = this.getView().getModel("timeEntryModel").getProperty("/weekDates") || {};
    var rawDate = weekDates[sDay];
    var displayDate = "";

    try {
        if (rawDate) {
            var dt = new Date(rawDate);
            displayDate = dt.toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric"
            });
        }
    } catch (e) {
        console.warn("Date formatting failed: ", rawDate, e);
    }

    
    // Detect leave entry
   
    const isLeaveEntry =
        (oEntry.nonProjectTypeName && oEntry.nonProjectTypeName.toLowerCase().includes("leave")) ||
        (oEntry.workType && ["personal", "sick", "half", "leave"].some(x =>
            oEntry.workType.toLowerCase().includes(x)
        ));
    
    // Block ONLY IF: Weekend + Leave entry
if ((sDay === "saturday" || sDay === "sunday") && isLeaveEntry) {
    return;
}


    
    const isLeaveDay = isLeaveEntry && fCurrentHours > 0;

    // If leave day → hide everything and disable editing
    const leaveHoursAllowed = ["4", "8"];
    // Determine which hours to show for leave types
let aHourOptions = [];

if (isLeaveDay) {

    sap.m.MessageToast.show("Leave entry cannot be edited for this day.");

} else if (isLeaveEntry) {

    // Normalize leave type
    let leaveTypeLower = (oEntry.workType || "").toLowerCase();

    if (leaveTypeLower.includes("half")) {
        // ⭐ Half Day Leave → 4 hours ONLY
        aHourOptions.push(new sap.ui.core.Item({ key: "4", text: "4" }));

    } else if (leaveTypeLower.includes("personal") || leaveTypeLower.includes("sick")) {
        // ⭐ Personal or Sick → 4 & 8 hours
        ["4", "8"].forEach(h => {
            aHourOptions.push(new sap.ui.core.Item({ key: h, text: h }));
        });

    } else {
        // Default leave fallback → allow 4 & 8
        ["4", "8"].forEach(h => {
            aHourOptions.push(new sap.ui.core.Item({ key: h, text: h }));
        });
    }

} else {
    // ⭐ Normal task (not leave) → allow 0–15 hours
    for (let i = 0; i <= 15; i++) {
        aHourOptions.push(new sap.ui.core.Item({
            key: i.toString(),
            text: i + " hour" + (i === 1 ? "" : "s")
        }));
    }
}


    

    var oHoursCombo = new sap.m.ComboBox({
        selectedKey: fCurrentHours.toString(),
        items: aHourOptions,
        placeholder: "Select Hours",
        width: "100%",
        enabled: !isLeaveDay
    });

    // --------------------------
    // Task details
    // --------------------------
    var oTaskArea = new sap.m.TextArea({
        value: isLeaveEntry ? sCurrentTask : sCurrentTask,
        rows: 4,
        placeholder: "Describe work done...",
        width: "100%",
        editable: !isLeaveDay
    });

    
    // Build dialog
    var oDialog = new sap.m.Dialog({
        title: "Edit " + this._capitalize(sDay) + " Entry",
        contentWidth: "350px",
        titleAlignment: "Center",

        content: [
            new sap.m.VBox({
                items: [

                    // DATE
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: "Date:", design: "Bold" }),
                            new sap.m.Input({ value: displayDate, editable: false })
                        ]
                    }).addStyleClass("sapUiSmallMarginBottom"),

                    // PROJECT/NON-PROJECT
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: "Project:", design: "Bold" }),
                            new sap.m.Input({
                                value: oEntry.projectName || oEntry.nonProjectTypeName,
                                editable: false
                            })
                        ]
                    }).addStyleClass("sapUiSmallMarginBottom"),

                    // TASK/LEAVE TYPE
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({
                                text: isLeaveEntry ? "Leave Type:" : "Task Type:",
                                design: "Bold"
                            }),
                            new sap.m.Input({
                                value: oEntry.workType,
                                editable: false
                            })
                        ]
                    }).addStyleClass("sapUiSmallMarginBottom"),

                    // HOURS (Hidden if leave day)
                    new sap.m.VBox({
                        visible: !isLeaveDay,
                        items: [
                            new sap.m.Label({
                                text: "Hours:",
                                design: "Bold",
                                required: !isLeaveEntry
                            }),
                            oHoursCombo
                        ]
                    }).addStyleClass("sapUiSmallMarginBottom"),

                    // TASK DETAILS (Hidden if leave day)
                    new sap.m.VBox({
                        visible: !isLeaveDay,
                        items: [
                            new sap.m.Label({
                                text: isLeaveEntry ? "Leave Details:" : "Task Details:",
                                design: "Bold",
                                required: !isLeaveEntry
                            }),
                            oTaskArea
                        ]
                    })
                ]
            }).addStyleClass("sapUiMediumMarginBeginEnd sapUiSmallMarginTopBottom")
        ],

       
        // SAVE BUTTON
        beginButton: new sap.m.Button({
            text: "Save",
            type: "Emphasized",
            icon: "sap-icon://save",

            press: function () {

                // --- Get all existing entries from model ---


                if (isLeaveDay) {
                    sap.m.MessageToast.show("Leave already applied for this day. Editing is not allowed.");
                    oDialog.close();
                    return;
                }

                if (isLeaveEntry) {
                    let newHours = oHoursCombo.getSelectedKey();
                    let taskDetails = oTaskArea.getValue();

                    if (!leaveHoursAllowed.includes(newHours)) {
                        sap.m.MessageBox.error("Only 4 or 8 hours allowed for Leave.");
                        return;
                    }

                    if(!taskDetails){
                        sap.m.MessageBox.error("Leave Details Manadaory");
                        return;
                    }

                    let allEntries = this.getView().getModel("timeEntryModel").getProperty("/timeEntries") || [];

// Map day → field name
let dayHoursField = sDay + "Hours";

// Check if ANY OTHER entry has leave on this same day
let anotherLeaveExists = allEntries.some(e => {
    if (e.id === oEntry.id) return false; // skip same row
    return (
        e.workType &&
        e.workType.toLowerCase().includes("leave") &&
        Number(e[dayHoursField]) > 0
    );
});

if (anotherLeaveExists) {
    sap.m.MessageBox.error(
        `Leave is already applied for ${this._capitalize(sDay)}`
    );
    oDialog.close();
    return; 
}


                    this._saveEditedDayHoursAuto(oEntry, sDay, Number(newHours), taskDetails);
                    oDialog.close();
                    return;
                }

                // NORMAL TASK SAVE
                var newHours = Number(oHoursCombo.getSelectedKey());
                var newDetails = oTaskArea.getValue();

                if (isNaN(newHours) || newHours < 0 || newHours > 24) {
                    sap.m.MessageBox.error("Select hours between 0 and 24");
                    return;
                }
                if (!newDetails.trim()) {
                    sap.m.MessageBox.warning("Task details cannot be empty.");
                    return;
                }

                this._saveEditedDayHoursAuto(oEntry, sDay, newHours, newDetails);
                oDialog.close();
            }.bind(this)
        }),

        endButton: new sap.m.Button({
            text: "Cancel",
            icon: "sap-icon://decline",
            press: function () { oDialog.close(); }
        }),

        afterClose: function () { oDialog.destroy(); }
    });

    this.getView().addDependent(oDialog);
    oDialog.open();
},

        _validateMandatoryFields: function (entry) {
            if (!entry) {
                sap.m.MessageBox.error("No entry data found.");
                return false;
            }

            const hasProject = entry.projectId && entry.projectId.trim() !== "";
            const hasNonProject = entry.nonProjectTypeID && entry.nonProjectTypeID.trim() !== "";

            // Project / Non-Project Selection Check
            if (!hasProject && !hasNonProject) {
                sap.m.MessageBox.error("Please select a Project or Non-Project Activity.");
                return false;
            }

            // Work type check ONLY if Project is chosen
            if (hasProject) {
                if (!entry.workType || entry.workType.trim() === "") {
                    sap.m.MessageBox.error("Work Type is required when Project is selected.");
                    return false;
                }
            }

            // Hours
            let hours = parseFloat(entry.hours);
            if (isNaN(hours) || hours <= 0 || hours > 15) {
                sap.m.MessageBox.error("Hours must be between 1 and 15.");
                return false;
            }

            // Task Details (always needed)
            if (!entry.taskDetails || entry.taskDetails.trim() === "") {
                sap.m.MessageBox.error("Please enter Task Details.");
                return false;
            }

            return true; // All validations passed 👍
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

                            const isLeaveEntry =
    (item.nonProjectTypeName && item.nonProjectTypeName.toLowerCase().includes("leave")) ||
    (item.task && item.task.toLowerCase().includes("leave"));

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
                                dates: oModel.getProperty("/weekDates"),

                                mondayIsLeave: isLeaveEntry && Number(item.mondayHours) > 0,
tuesdayIsLeave: isLeaveEntry && Number(item.tuesdayHours) > 0,
wednesdayIsLeave: isLeaveEntry && Number(item.wednesdayHours) > 0,
thursdayIsLeave: isLeaveEntry && Number(item.thursdayHours) > 0,
fridayIsLeave: isLeaveEntry && Number(item.fridayHours) > 0,

// weekends cannot have leave → always false
saturdayIsLeave: false,
sundayIsLeave: false,

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

                    // Validate data
                    if (!oData || !oData.results || !oData.results.length) {
                        sap.m.MessageBox.warning("No profile data found.");
                        return;
                    }

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
                        userRole: oRawProfile.roleName || ""
                    };

                    // JSONModel for fragment
                    var oProfileModel = new sap.ui.model.json.JSONModel({ profile: oProfile });

                    // Load fragment if not already loaded
                    if (!this._oProfileDialog) {
                        // Use createId() for unique prefix to avoid ID clashes
                        this._oProfileDialog = sap.ui.xmlfragment(
                            this.createId("profileDialogFrag"),
                            "employee.Fragments.ProfileDialog",
                            this
                        );
                        oView.addDependent(this._oProfileDialog);
                    }

                    // Set model to fragment
                    this._oProfileDialog.setModel(oProfileModel, "view");

                    // Optional: set employee name inside fragment


                    // Open the dialog
                    this._oProfileDialog.open();

                }.bind(this),
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.error("Failed to load profile data.");
                    console.error("Profile load error:", oError);
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
        },


    onOpenLeaveBalance: function () {
    var oView = this.getView();
    var that = this;

    // Create JSON model if not exists
    if (!this._leaveBalanceModel) {
        this._leaveBalanceModel = new sap.ui.model.json.JSONModel();
        oView.setModel(this._leaveBalanceModel, "leaveBalanceModel");
    }

    var oModel = that.getOwnerComponent().getModel("timesheetServiceV2");

    oModel.read("/MyLeaveBalance", {
        success: function (oData) {

            var aResults = oData.results || [];

            // Extract employee info from first item
            var employeeName = aResults.length > 0 ? aResults[0].employeeName : "";
            var year = aResults.length > 0 ? aResults[0].year : "";

            // Prepare final JSON model structure
            var oFinalData = {
                employeeName: employeeName,
                year: year,
                leaves: aResults  
            };

            that._leaveBalanceModel.setData(oFinalData);

            // Open dialog
            that._openLeaveBalanceFragment();
        },
        error: function () {
            sap.m.MessageToast.show("Failed to load leave balance");
        }
    });
},

_openLeaveBalanceFragment: function () {
    if (!this._leaveBalFrag) {
        this._leaveBalFrag = sap.ui.xmlfragment(
            "employee.Fragments.LeaveBalance",
            this
        );
        this.getView().addDependent(this._leaveBalFrag);
    }

    // Get employee name from model
    var sName = this._leaveBalanceModel.getProperty("/employeeName") || "";

    // Set title as "Leave Balance - Name"
    this._leaveBalFrag.setTitle("Leave Balance – " + sName);

    this._leaveBalFrag.open();
},



onCloseLeaveBalance: function () {
    this._leaveBalFrag.close();
},

onDownloadDocument: function () {
    const oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    const that = this;

    sap.ui.core.BusyIndicator.show(0);

    // 1️⃣ Read Available Documents
    oModel.read("/AvailableDocuments", {
        success: function (oData) {
            sap.ui.core.BusyIndicator.hide();

            if (!oData.results || oData.results.length === 0) {
                sap.m.MessageToast.show("No documents available for download");
                return;
            }

            // 2️⃣ Always use the first document (common PDF)
            const documentID = oData.results[0].documentID;

            console.log("Document ID from backend:", documentID);

            if (!documentID) {
                sap.m.MessageToast.show("Document ID missing from backend");
                return;
            }

            // 3️⃣ Now call download function
            that._downloadDocument(documentID);
        },

        error: function () {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("Failed to fetch document list");
        }
    });
},

_downloadDocument: function (documentID) {

    sap.ui.core.BusyIndicator.show(0);

    const url = `/odata/v4/employee/downloadDocument?documentID='${documentID}'`;

    fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    })
    .then(async response => {
        sap.ui.core.BusyIndicator.hide();

        if (!response.ok) {
            sap.m.MessageToast.show("Document download failed");
            return;
        }

        const res = await response.json();

        const bytes = atob(res.content).split("").map(c => c.charCodeAt(0));
        const blob = new Blob([new Uint8Array(bytes)], { type: res.mimeType });

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = res.fileName;
        a.click();
        URL.revokeObjectURL(blobUrl);
    })
    .catch(err => {
        sap.ui.core.BusyIndicator.hide();
        console.error("Download error", err);
        sap.m.MessageToast.show("Download failed");
    });
}














    });
});
