sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/DatePicker",
    "sap/m/TimePicker",
    "sap/ui/core/Item",
    "sap/ui/core/format/DateFormat",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/date/UI5Date",
    "sap/ui/core/Fragment",
    "sap/m/Token",
    "sap/m/SuggestionItem",
    "sap/m/MultiInput",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Label",
    "sap/ui/unified/CalendarAppointment",
    "sap/m/ColumnListItem",
    "sap/m/Column",
    "sap/m/Table",
    "sap/m/MultiComboBox",
    "sap/m/CustomListItem",
    "sap/m/Select"
], function (Controller, JSONModel, MessageToast, Dialog, Button, Input, TextArea, DatePicker, TimePicker, Item, DateFormat, Filter, FilterOperator, UI5Date, Fragment, Token, SuggestionItem, MultiInput, VBox, HBox, Text, Label, CalendarAppointment, ColumnListItem, Column, Table, MultiComboBox, CustomListItem, Select) {
    "use strict";

    return Controller.extend("manager.com.manager.controller.Manager", {
        roles: {
            manager: "manager",
            employee: "employee"
        },

        onInit: function () {
            var oData = this._generateSampleData();
            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel);

            // Store original data for filtering
            this._oOriginalPeopleData = JSON.parse(JSON.stringify(oData.people));
            this._sCurrentPersonKey = "all"; // Track current person selection

            // this._updateCurrentIntervalText();
            // this._populatePersonSelect();
            // this._updateMiniCalendar();
            // this._updateTimesheetSummary();

            var oAttendeesModel = new JSONModel({
                value: [
                    { name: "Portal Admin", email: "donotreply@risedx.com", status: "Free" },
                    { name: "Pushpak Jha", email: "pushpak.jha@risedx.com", status: "Busy" }
                ]
            });
            this.getView().setModel(oAttendeesModel, "attendees");

            var today = new Date();
            today.setDate(1); // Start from first day of month for month view
            // this.byId("planningCalendar").setStartDate(today);

            // this._applyTeamsMonthViewStyling();
        },

        onAfterRendering: function () {
            this._applyTeamsMonthViewStyling();
            var oPlanningCalendar = this.byId("planningCalendar");
            if (oPlanningCalendar) {
                setTimeout(function () {
                    oPlanningCalendar.rerender();
                }, 100);
            }
        },

        _generateSampleData: function () {
            var today = new Date();
            var startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            return {
                startDate: startOfMonth,
                projects: [
                    { id: "1", name: "Design Project", requiredSkills: ["Design"] },
                    { id: "2", name: "Development", requiredSkills: ["Development"] },
                    { id: "3", name: "Testing", requiredSkills: ["Testing"] },
                    { id: "4", name: "Management", requiredSkills: ["Management"] }
                ],
                calendars: [
                    { name: "My Calendar", selected: true },
                    { name: "Team Schedule", selected: true },
                    { name: "Holidays", selected: false },
                    { name: "Personal", selected: true }
                ],
                people: [
                    { name: "Abhishek Jha", role: "Team Member", skillSet: ["Design"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Abhishek Jha", "Design Project", startOfMonth) },
                    { name: "Aman Anand", role: "Team Member", skillSet: ["Development"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Aman Anand", "Development", startOfMonth) },
                    { name: "Ayushi Khanokar", role: "Team Member", skillSet: ["Testing"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Ayushi Khanokar", "Testing", startOfMonth) },
                    { name: "Jayant Kumar", role: "Team Member", skillSet: ["Development"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Jayant Kumar", "Development", startOfMonth) },
                    { name: "Mohd Aakib", role: "Team Member", skillSet: ["Design"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Mohd Aakib", "Design", startOfMonth) },
                    { name: "Mohammed Nadeem Abbas", role: "Team Member", skillSet: ["Development"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Mohammed Nadeem Abbas", "Development", startOfMonth) },
                    { name: "Pushkar Kumar Jha", role: "Team Member", skillSet: ["Testing"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Pushkar Kumar Jha", "Testing", startOfMonth) },
                    { name: "Pushpak Jha", role: "Team Member", skillSet: ["Design"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Pushpak Jha", "Design", startOfMonth) },
                    { name: "Shivam Shrivastav", role: "Team Member", skillSet: ["Development"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Shivam Shrivastav", "Development", startOfMonth) },
                    { name: "Suraj Mishra", role: "Team Member", skillSet: ["Management"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Suraj Mishra", "Project Management", startOfMonth) },
                    { name: "Swarupa Patil", role: "Project tester", skillSet: ["Testing"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Swarupa Patil", "Design", startOfMonth) },
                    { name: "Tanu Singh", role: "Team Member", skillSet: ["Testing"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Tanu Singh", "Testing", startOfMonth) },
                    { name: "Vikash Ojha", role: "Team Member", skillSet: ["Development"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Vikash Ojha", "Development", startOfMonth) },
                    { name: "Vikrant Raj", role: "Project Manager", skillSet: ["Management"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("Vikrant Raj", "Design", startOfMonth) },
                    { name: "YK Yugal Kishore", role: "Team Lead", skillSet: ["Management"], assignedProjects: [], timesheetStatus: "Pending", appointments: this._generateMonthAppointmentsForPerson("YK Yugal Kishore", "Management", startOfMonth) }
                ]
            };
        },

        _generateMonthAppointmentsForPerson: function (personName, project, startOfMonth) {
            var appointments = [];
            var daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
            var projectId = this._getProjectIdForPerson(personName);
            var projectName = project; // Keep existing for compatibility

            // Generate appointments for each day in the month
            for (var day = 1; day <= daysInMonth; day++) {
                var currentDate = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day);
                var dayOfWeek = currentDate.getDay();

                // Skip weekends (Saturday = 6, Sunday = 0)
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    var startHour = 9;
                    var hoursPerDay = this._getRandomHours(6, 9); // Random hours between 6-9 to test color coding
                    var endHour = startHour + hoursPerDay;
                    var task = this._getTaskForDay(day);

                    // Main work appointment
                    appointments.push({
                        id: this._generateAppointmentId(),
                        start: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day, startHour, 0),
                        end: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day, endHour, 0),
                        title: projectName + " - " + task,
                        info: personName + " - " + hoursPerDay + "h work",
                        type: "Type0" + (day % 5 + 1),
                        tentative: false,
                        color: this._getColorForAppointment(hoursPerDay, personName, false),
                        icon: "sap-icon://workflow-tasks",
                        projectId: projectId,
                        isImportant: false,
                        comments: "Working on " + task
                    });

                    // Project management task (shorter appointment)
                    appointments.push({
                        id: this._generateAppointmentId(),
                        start: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day, 10, 0),
                        end: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day, 11, 0),
                        title: "Project Management",
                        info: personName + " - Daily tasks",
                        type: "Type07",
                        tentative: false,
                        color: this._getColorForAppointment(1, personName, false),
                        icon: "sap-icon://project-definition",
                        projectId: "pm",
                        isImportant: false,
                        comments: "Daily project management tasks"
                    });

                    // Client meeting on specific days (like in your image)
                    if (day % 7 === 2) { // Every Tuesday
                        appointments.push({
                            id: this._generateAppointmentId(),
                            start: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day, 14, 0),
                            end: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day, 15, 0),
                            title: "Client Meeting",
                            info: personName + " - Weekly sync",
                            type: "Type09",
                            tentative: false,
                            color: this._getColorForAppointment(1, personName, true),
                            icon: "sap-icon://meeting-room",
                            projectId: "cm",
                            isImportant: true,
                            comments: "Weekly client synchronization meeting"
                        });
                    }
                }
            }

            return appointments;
        },

        _getProjectIdForPerson: function (personName) {
            return "1"; // Default
        },

        _generateAppointmentId: function () {
            return 'appt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        _getRandomHours: function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },

        _formatTime: function (oDate) {
            return DateFormat.getTimeInstance({ pattern: "h a" }).format(oDate);
        },

        _getTaskForDay: function (dayIndex) {
            var tasks = ["Design system", "Mockup designs", "User testing", "Documentation", "Client meeting", "Code review", "Planning", "Development", "Testing", "Deployment"];
            return tasks[dayIndex % tasks.length];
        },

        _addDays: function (date, days, hours, minutes) {
            var newDate = new Date(date);
            newDate.setDate(newDate.getDate() + days);
            newDate.setHours(hours, minutes, 0, 0);
            return newDate;
        },

        // Updated color coding logic
        _getColorForAppointment: function (hours, personName, isImportant) {
            if (isImportant) {
                return "#0070F2"; // Blue for important tasks
            }

            // For ALL employees (including managers when working as employees)
            // Red for less than 8 hours of work
            if (hours < 8) {
                return "#FF0000"; // Red for less than 8 hours
            } else if (hours >= 8) {
                return "#2B7D2B"; // Green for 8+ hours
            } else {
                return "#6A6A6A"; // Grey for any other case
            }
        },

        // Helper function to check if a person is a manager
        _isManager: function (personName) {
            var managers = ["Vikrant Raj", "YK Yugal Kishore"]; // Add other managers as needed
            return managers.includes(personName);
        },

        _populatePersonSelect: function () {
            var oPersonSelect = this.byId("personSelect");
            // oPersonSelect.removeAllItems();
            oPersonSelect.addItem(new Item({ key: "all", text: "All Members" }));

            // this._oOriginalPeopleData.forEach(function (oPerson) {
            //     oPersonSelect.addItem(new Item({ key: oPerson.name, text: oPerson.name }));
            // });

            // Set the current selection
            // oPersonSelect.setSelectedKey(this._sCurrentPersonKey);
        },

        // _updateCurrentIntervalText: function () {
        //     var oPlanningCalendar = this.byId("planningCalendar");
        //     var oStartDate = oPlanningCalendar.getStartDate();
        //     var sViewKey = oPlanningCalendar.getViewKey();

        //     if (sViewKey === "Day") {
        //         // this.byId("currentInterval").setText(DateFormat.getDateInstance({pattern: "EEEE, MMMM d, yyyy"}).format(oStartDate));
        //         // this.byId("currentIntervalMain").setText(DateFormat.getDateInstance({pattern: "EEEE, MMMM d, yyyy"}).format(oStartDate));
        //     } else if (sViewKey === "Week") {
        //         var oEndDate = new Date(oStartDate);
        //         oEndDate.setDate(oStartDate.getDate() + 6);
        //         // this.byId("currentInterval").setText(DateFormat.getDateInstance({pattern: "MMM d"}).format(oStartDate) + " - " + DateFormat.getDateInstance({pattern: "MMM d, yyyy"}).format(oEndDate));
        //         // this.byId("currentIntervalMain").setText(DateFormat.getDateInstance({pattern: "MMM d"}).format(oStartDate) + " - " + DateFormat.getDateInstance({pattern: "MMM d, yyyy"}).format(oEndDate));
        //     } else if (sViewKey === "Month") {
        //         // this.byId("currentInterval").setText(DateFormat.getDateInstance({pattern: "MMMM yyyy"}).format(oStartDate));
        //         // this.byId("currentIntervalMain").setText(DateFormat.getDateInstance({pattern: "MMMM yyyy"}).format(oStartDate));
        //     }
        // },

        _updateMiniCalendar: function () {
            var oPlanningCalendar = this.byId("planningCalendar");
            var oStartDate = oPlanningCalendar.getStartDate();
            // if (this.byId("miniCalendar")) {
            //     this.byId("miniCalendar").setSelectedDate(oStartDate);
            // }
        },

        _calculateWorkingDays: function (startOfMonth) {
            var year = startOfMonth.getFullYear();
            var month = startOfMonth.getMonth();
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            var count = 0;
            for (var day = 1; day <= daysInMonth; day++) {
                var date = new Date(year, month, day);
                if (date.getDay() !== 0 && date.getDay() !== 6) {
                    count++;
                }
            }
            return count;
        },

        _updateTimesheetSummary: function () {
            var oModel = this.getView().getModel();
            var aPeople = oModel.getProperty("/people");
            var iBillableHours = 0, iNonBillableHours = 0;
            var oStartDate = this.byId("planningCalendar").getStartDate();
            var workingDays = this._calculateWorkingDays(oStartDate);
            var expectedPerPerson = 8 * workingDays;

            aPeople.forEach(function (oPerson) {
                var totalH = 0;
                var billableH = 0;
                oPerson.appointments.forEach(function (oAppointment) {
                    var hours = (new Date(oAppointment.end) - new Date(oAppointment.start)) / (1000 * 60 * 60);
                    totalH += hours;
                    if (oAppointment.projectId !== "pm" && oAppointment.projectId !== "cm") {
                        billableH += hours;
                    }
                });
                iBillableHours += billableH;
                iNonBillableHours += totalH - billableH;

                var totalHours = Math.floor(totalH);
                var totalMinutes = Math.round((totalH - Math.floor(totalH)) * 60);
                oPerson.totalHours = totalHours + "h " + totalMinutes + "m";

                oPerson.billableHours = billableH;
                oPerson.alert = billableH < expectedPerPerson * 0.8 ? "Potential underutilization and delay" : "";
            });

            var billableHours = Math.floor(iBillableHours);
            var billableMinutes = Math.round((iBillableHours - billableHours) * 60);
            var nonBillableHours = Math.floor(iNonBillableHours);
            var nonBillableMinutes = Math.round((iNonBillableHours - nonBillableHours) * 60);

            this.byId("billableText").setText("Billable time: " + billableHours + "h " + billableMinutes + "m");
            this.byId("nonBillableText").setText("Non-billable: " + nonBillableHours + "h " + nonBillableMinutes + "m");

            // Update alerts box
            var oAlertsBox = this.byId("alertsBox");
            oAlertsBox.removeAllItems();
            aPeople.forEach(function (oPerson) {
                if (oPerson.alert) {
                    oAlertsBox.addItem(new Text({
                        text: oPerson.name + ": " + oPerson.alert,
                        class: "sapUiThemeText-invert" // For styling, adjust as needed
                    }));
                }
            });

            oModel.refresh(true);
        },

        // _applyTeamsMonthViewStyling: function () {
        //     var oPlanningCalendar = this.byId("planningCalendar");
        //     // Remove all styling classes first
        //     // oPlanningCalendar.removeStyleClass("teams-month-view");
        //     // oPlanningCalendar.removeStyleClass("teams-week-view");
        //     // oPlanningCalendar.removeStyleClass("teams-day-view");

        //     // Add appropriate styling based on current view
        //     // if (oPlanningCalendar.getViewKey() === "Month") {
        //     //     oPlanningCalendar.addStyleClass("teams-month-view");
        //     // } else if (oPlanningCalendar.getViewKey() === "Week") {
        //     //     oPlanningCalendar.addStyleClass("teams-week-view");
        //     // } else {
        //     //     oPlanningCalendar.addStyleClass("teams-day-view");
        //     // }
        // },

        getUserRole: function () {
            return this.roles.manager;
        },

        onTodayPress: function () {
            var oPlanningCalendar = this.byId("planningCalendar");
            var today = new Date();

            if (oPlanningCalendar.getViewKey() === "Month") {
                today.setDate(1); // Start from first day of month
            }

            oPlanningCalendar.setStartDate(today);
            this.getView().getModel().setProperty("/startDate", today);

            // Update appointments for the new month if in month view
            if (oPlanningCalendar.getViewKey() === "Month") {
                this._updateAppointmentsForMonth(today);
            }

            this._updateCurrentIntervalText();
            this._updateMiniCalendar();
            this._updateTimesheetSummary();
            MessageToast.show("Navigated to today");
        },

        onPrevPress: function () {
            var oPlanningCalendar = this.byId("planningCalendar");
            var oStartDate = oPlanningCalendar.getStartDate();
            var sViewKey = oPlanningCalendar.getViewKey();

            var oNewStartDate = new Date(oStartDate);
            if (sViewKey === "Day") {
                oNewStartDate.setDate(oStartDate.getDate() - 1);
            } else if (sViewKey === "Week") {
                oNewStartDate.setDate(oStartDate.getDate() - 7);
            } else if (sViewKey === "Month") {
                oNewStartDate.setMonth(oStartDate.getMonth() - 1);
            }

            oPlanningCalendar.setStartDate(oNewStartDate);
            this.getView().getModel().setProperty("/startDate", oNewStartDate);

            // Update appointments for the new month if in month view
            if (sViewKey === "Month") {
                this._updateAppointmentsForMonth(oNewStartDate);
            }

            this._updateCurrentIntervalText();
            this._updateMiniCalendar();
            this._updateTimesheetSummary();
        },

        onNextPress: function () {
            var oPlanningCalendar = this.byId("planningCalendar");
            var oStartDate = oPlanningCalendar.getStartDate();
            var sViewKey = oPlanningCalendar.getViewKey();

            var oNewStartDate = new Date(oStartDate);
            if (sViewKey === "Day") {
                oNewStartDate.setDate(oStartDate.getDate() + 1);
            } else if (sViewKey === "Week") {
                oNewStartDate.setDate(oStartDate.getDate() + 7);
            } else if (sViewKey === "Month") {
                oNewStartDate.setMonth(oStartDate.getMonth() + 1);
            }

            oPlanningCalendar.setStartDate(oNewStartDate);
            this.getView().getModel().setProperty("/startDate", oNewStartDate);

            // Update appointments for the new month if in month view
            if (sViewKey === "Month") {
                this._updateAppointmentsForMonth(oNewStartDate);
            }

            this._updateCurrentIntervalText();
            this._updateMiniCalendar();
            this._updateTimesheetSummary();
        },

        onDateSelect: function (oEvent) {
            var oSelectedDate = oEvent.getParameter("date");
            var oPlanningCalendar = this.byId("planningCalendar");

            if (oPlanningCalendar.getViewKey() === "Month") {
                // In month view, just update the start date to maintain month view
                var firstDayOfMonth = new Date(oSelectedDate.getFullYear(), oSelectedDate.getMonth(), 1);
                oPlanningCalendar.setStartDate(firstDayOfMonth);
                this.getView().getModel().setProperty("/startDate", firstDayOfMonth);

                // Update appointments for the new month
                this._updateAppointmentsForMonth(firstDayOfMonth);
            } else {
                oPlanningCalendar.setStartDate(oSelectedDate);
                this.getView().getModel().setProperty("/startDate", oSelectedDate);
            }

            this._updateCurrentIntervalText();
            this._updateMiniCalendar();
            this._updateTimesheetSummary();

            var sFormattedDate = DateFormat.getDateInstance({ pattern: "EEEE, MMMM d, yyyy" }).format(oSelectedDate);
            MessageToast.show("Selected date: " + sFormattedDate);
        },

        onViewChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            var oPlanningCalendar = this.byId("planningCalendar");
            oPlanningCalendar.setViewKey(sSelectedKey);

            var oStartDate = new Date();

            if (sSelectedKey === "Day") {
                // Keep current day
            } else if (sSelectedKey === "Week") {
                // Start from Monday of current week
                var dayOfWeek = oStartDate.getDay();
                var diff = oStartDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                oStartDate.setDate(diff);
            } else if (sSelectedKey === "Month") {
                // Start from first day of month
                oStartDate.setDate(1);
            }

            oPlanningCalendar.setStartDate(oStartDate);
            this.getView().getModel().setProperty("/startDate", oStartDate);

            // Update appointments for the new month if switching to month view
            if (sSelectedKey === "Month") {
                this._updateAppointmentsForMonth(oStartDate);
            }

            this._updateCurrentIntervalText();
            this._updateMiniCalendar();
            this._updateTimesheetSummary();
            this._applyTeamsMonthViewStyling();

            MessageToast.show("View changed to: " + sSelectedKey);
        },

        onPersonChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            var oModel = this.getView().getModel();

            // Store the current selection
            this._sCurrentPersonKey = sSelectedKey;

            if (sSelectedKey === "all") {
                // Reset to all original people data
                oModel.setProperty("/people", JSON.parse(JSON.stringify(this._oOriginalPeopleData)));
            } else {
                // Filter to show only selected person
                var oSelectedPerson = this._oOriginalPeopleData.find(function (oPerson) {
                    return oPerson.name === sSelectedKey;
                });
                if (oSelectedPerson) {
                    oModel.setProperty("/people", [JSON.parse(JSON.stringify(oSelectedPerson))]);
                }
            }

            this._updateTimesheetSummary();
            MessageToast.show("Showing schedule for: " + (sSelectedKey === "all" ? "All Members" : sSelectedKey));
        },

        onAppointmentSelect: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");
            var oRow = oEvent.getParameter("row");
            var oRowContext = oRow.getBindingContext();
            var sPersonName = oRowContext.getProperty("name");
            var oApptContext = oAppointment.getBindingContext();
            var sTask = oApptContext.getProperty("title");
            var sComments = oApptContext.getProperty("comments");

            var oDialog = new Dialog({
                title: "Appointment Details",
                content: new VBox({
                    items: [
                        new Label({ text: "Employee:" }),
                        new Text({ text: sPersonName }),
                        new Label({ text: "Task:" }),
                        new Text({ text: sTask }),
                        new Label({ text: "Comments:" }),
                        new Text({ text: sComments })
                    ]
                }),
                beginButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                })
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onAppointmentDrop: function (oEvent) {
            var oDroppedAppointment = oEvent.getParameter("appointment");
            var oNewStartDate = oEvent.getParameter("startDate");
            var oNewEndDate = oEvent.getParameter("endDate");
            var oRow = oEvent.getParameter("row");

            // Find and update the appointment in the model
            var oModel = this.getView().getModel();
            var aPeople = oModel.getProperty("/people");
            var oSourcePerson, oTargetPerson, oAppointment;

            // Find the appointment and source person
            for (var i = 0; i < aPeople.length; i++) {
                var oPerson = aPeople[i];
                var aAppointments = oPerson.appointments;

                for (var j = 0; j < aAppointments.length; j++) {
                    var oCurrentAppointment = aAppointments[j];

                    // Compare appointment data to find the dropped one
                    if (this._areAppointmentsEqual(oCurrentAppointment, oDroppedAppointment)) {
                        oSourcePerson = oPerson;
                        oAppointment = oCurrentAppointment;
                        break;
                    }
                }

                if (oAppointment) break;
            }

            if (!oAppointment) return;

            // Find target person if dropped on a different row
            if (oRow) {
                var oRowBindingContext = oRow.getBindingContext();
                if (oRowBindingContext) {
                    var sRowPath = oRowBindingContext.getPath();
                    var aRowPathParts = sRowPath.split("/");
                    var iPersonIndex = parseInt(aRowPathParts[2], 10);
                    oTargetPerson = aPeople[iPersonIndex];
                }
            }

            // If dropped on a different person, move the appointment
            if (oTargetPerson && oTargetPerson !== oSourcePerson) {
                // Remove from source person
                var index = oSourcePerson.appointments.indexOf(oAppointment);
                if (index > -1) {
                    oSourcePerson.appointments.splice(index, 1);
                }

                // Calculate new hours
                var hours = this._calculateHours(oNewStartDate, oNewEndDate);

                // Add to target person
                oTargetPerson.appointments.push({
                    id: oAppointment.id,
                    start: new Date(oNewStartDate),
                    end: new Date(oNewEndDate),
                    title: oAppointment.title,
                    info: oTargetPerson.name + " - " + hours.toFixed(1) + "h work",
                    type: oAppointment.type,
                    tentative: oAppointment.tentative,
                    color: this._getColorForAppointment(hours, oTargetPerson.name, oAppointment.isImportant),
                    icon: oAppointment.icon,
                    projectId: oAppointment.projectId,
                    isImportant: oAppointment.isImportant,
                    comments: oAppointment.comments
                });

                // Update original data for filtering
                this._updateOriginalDataAfterDrop(oSourcePerson.name, oTargetPerson.name, oAppointment, oNewStartDate, oNewEndDate, hours);
            } else {
                // Update the appointment dates if dropped on the same person
                oAppointment.start = new Date(oNewStartDate);
                oAppointment.end = new Date(oNewEndDate);

                // Update hours info
                var hours = this._calculateHours(oNewStartDate, oNewEndDate);
                oAppointment.info = oSourcePerson.name + " - " + hours.toFixed(1) + "h work";

                // Update color based on new hours and person
                oAppointment.color = this._getColorForAppointment(hours, oSourcePerson.name, oAppointment.isImportant);

                // Update original data
                this._updateOriginalDataAfterResize(oSourcePerson.name, oAppointment.id, oNewStartDate, oNewEndDate, hours);
            }

            // Refresh the model
            oModel.refresh(true);
            this._updateTimesheetSummary();

            MessageToast.show("Appointment moved to: " +
                DateFormat.getDateTimeInstance({ pattern: "MMM d, h:mm a" }).format(oNewStartDate));
        },

        onAppointmentResize: function (oEvent) {
            var oResizedAppointment = oEvent.getParameter("appointment");
            var oNewStartDate = oEvent.getParameter("startDate");
            var oNewEndDate = oEvent.getParameter("endDate");

            // Find and update the appointment in the model
            var oModel = this.getView().getModel();
            var aPeople = oModel.getProperty("/people");

            for (var i = 0; i < aPeople.length; i++) {
                var oPerson = aPeople[i];
                var aAppointments = oPerson.appointments;

                for (var j = 0; j < aAppointments.length; j++) {
                    var oAppointment = aAppointments[j];

                    // Compare appointment data to find the resized one
                    if (this._areAppointmentsEqual(oAppointment, oResizedAppointment)) {
                        // Update the appointment dates
                        oAppointment.start = new Date(oNewStartDate);
                        oAppointment.end = new Date(oNewEndDate);

                        // Update hours info
                        var hours = this._calculateHours(oNewStartDate, oNewEndDate);
                        oAppointment.info = oPerson.name + " - " + hours.toFixed(1) + "h work";

                        // Update color based on new hours and person
                        oAppointment.color = this._getColorForAppointment(hours, oPerson.name, oAppointment.isImportant);

                        // Update original data
                        this._updateOriginalDataAfterResize(oPerson.name, oAppointment.id, oNewStartDate, oNewEndDate, hours);

                        break;
                    }
                }
            }

            // Refresh the model
            oModel.refresh(true);
            this._updateTimesheetSummary();

            var hours = this._calculateHours(oNewStartDate, oNewEndDate);
            MessageToast.show("Appointment resized: " + hours.toFixed(1) + " hours");
        },

        onAppointmentCreate: function (oEvent) {
            var oRow = oEvent.getParameter("row");
            var oStartDate = oEvent.getParameter("startDate");
            var oEndDate = oEvent.getParameter("endDate");

            // Get the person for this row
            var oRowBindingContext = oRow.getBindingContext();
            if (!oRowBindingContext) {
                return;
            }

            var oModel = this.getView().getModel();
            var sRowPath = oRowBindingContext.getPath();
            var aRowPathParts = sRowPath.split("/");
            var iPersonIndex = parseInt(aRowPathParts[2], 10);

            // Create a new appointment
            var aPeople = oModel.getProperty("/people");
            var oPerson = aPeople[iPersonIndex];

            var hours = this._calculateHours(oStartDate, oEndDate);
            var newAppointment = {
                id: this._generateAppointmentId(),
                start: new Date(oStartDate),
                end: new Date(oEndDate),
                title: "New Appointment",
                info: oPerson.name + " - " + hours.toFixed(1) + "h work",
                type: "Type06",
                tentative: false,
                color: this._getColorForAppointment(hours, oPerson.name, false),
                icon: "sap-icon://create",
                projectId: this._getProjectIdForPerson(oPerson.name),
                isImportant: false,
                comments: "Newly created appointment"
            };

            oPerson.appointments.push(newAppointment);

            // Also update original data
            this._updateOriginalDataAfterCreate(oPerson.name, newAppointment);

            oModel.refresh(true);
            this._updateTimesheetSummary();
            MessageToast.show("New appointment created for " + oPerson.name);
        },

        // New function to handle interval selection
        handleIntervalSelect: function (oEvent) {
            var oPC = oEvent.getSource(),
                oStartDate = oEvent.getParameter("startDate"),
                oEndDate = oEvent.getParameter("endDate"),
                oRow = oEvent.getParameter("row"),
                oModel = this.getView().getModel(),
                oData = oModel.getData(),
                iIndex = -1,
                hours = this._calculateHours(oStartDate, oEndDate),
                oAppointment = {
                    id: this._generateAppointmentId(),
                    start: oStartDate,
                    end: oEndDate,
                    title: "New Appointment",
                    info: "",
                    type: "Type09",
                    tentative: false,
                    color: this._getColorForAppointment(hours, "", false),
                    icon: "sap-icon://create",
                    isImportant: false,
                    comments: "Newly created appointment from interval"
                },
                aSelectedRows,
                i;

            if (oRow) {
                iIndex = oPC.indexOfRow(oRow);
                if (iIndex >= 0) {
                    oAppointment.info = oData.people[iIndex].name + " - " + hours.toFixed(1) + "h work";
                    oAppointment.color = this._getColorForAppointment(hours, oData.people[iIndex].name, oAppointment.isImportant);
                    oAppointment.projectId = this._getProjectIdForPerson(oData.people[iIndex].name);
                    oData.people[iIndex].appointments.push(oAppointment);
                    this._updateOriginalDataAfterCreate(oData.people[iIndex].name, oAppointment);
                }
            } else {
                aSelectedRows = oPC.getSelectedRows();
                for (i = 0; i < aSelectedRows.length; i++) {
                    iIndex = oPC.indexOfRow(aSelectedRows[i]);
                    if (iIndex >= 0) {
                        var personAppointment = JSON.parse(JSON.stringify(oAppointment));
                        personAppointment.info = oData.people[iIndex].name + " - " + hours.toFixed(1) + "h work";
                        personAppointment.color = this._getColorForAppointment(hours, oData.people[iIndex].name, personAppointment.isImportant);
                        personAppointment.projectId = this._getProjectIdForPerson(oData.people[iIndex].name);
                        oData.people[iIndex].appointments.push(personAppointment);
                        this._updateOriginalDataAfterCreate(oData.people[iIndex].name, personAppointment);
                    }
                }
            }

            oModel.setData(oData);
            this._updateTimesheetSummary();
            MessageToast.show("New appointment created");
        },

        _calculateHours: function (startDate, endDate) {
            return (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60);
        },

        _areAppointmentsEqual: function (oModelAppointment, oUIAppointment) {
            // Compare by ID if available
            if (oModelAppointment.id && oUIAppointment.data && oUIAppointment.data.id) {
                return oModelAppointment.id === oUIAppointment.data.id;
            }

            // Fallback to comparing properties if ID is not available
            return oModelAppointment.title === oUIAppointment.getTitle() &&
                new Date(oModelAppointment.start).getTime() === oUIAppointment.getStartDate().getTime() &&
                new Date(oModelAppointment.end).getTime() === oUIAppointment.getEndDate().getTime();
        },

        _updateAppointmentsForMonth: function (startOfMonth) {
            // Generate new appointments for all people for the new month
            var aNewPeople = this._oOriginalPeopleData.map(function (oPerson) {
                return {
                    name: oPerson.name,
                    role: oPerson.role,
                    skillSet: oPerson.skillSet,
                    assignedProjects: oPerson.assignedProjects,
                    timesheetStatus: oPerson.timesheetStatus,
                    appointments: this._generateMonthAppointmentsForPerson(
                        oPerson.name,
                        oPerson.role,
                        startOfMonth
                    )
                };
            }.bind(this));

            // Update the original people array
            this._oOriginalPeopleData = aNewPeople;

            // Apply the current filter
            this._applyCurrentFilter();

            // Update the model
            this.getView().getModel().setProperty("/startDate", startOfMonth);

            // Update other UI elements
            this._updateTimesheetSummary();
            this._updateMiniCalendar();
        },

        _applyCurrentFilter: function () {
            var oModel = this.getView().getModel();

            if (this._sCurrentPersonKey === "all") {
                oModel.setProperty("/people", JSON.parse(JSON.stringify(this._oOriginalPeopleData)));
            } else {
                var oSelectedPerson = this._oOriginalPeopleData.find(function (oPerson) {
                    return oPerson.name === this._sCurrentPersonKey;
                }.bind(this));
                oModel.setProperty("/people", oSelectedPerson ? [JSON.parse(JSON.stringify(oSelectedPerson))] : []);
            }
        },

        // New helper methods to update original data
        _updateOriginalDataAfterDrop: function (sourcePersonName, targetPersonName, appointment, newStartDate, newEndDate, hours) {
            // Remove from source person in original data
            var sourcePerson = this._oOriginalPeopleData.find(function (person) {
                return person.name === sourcePersonName;
            });

            if (sourcePerson) {
                var appointmentIndex = sourcePerson.appointments.findIndex(function (appt) {
                    return appt.id === appointment.id;
                });

                if (appointmentIndex > -1) {
                    sourcePerson.appointments.splice(appointmentIndex, 1);
                }
            }

            // Add to target person in original data
            var targetPerson = this._oOriginalPeopleData.find(function (person) {
                return person.name === targetPersonName;
            });

            if (targetPerson) {
                targetPerson.appointments.push({
                    id: appointment.id,
                    start: new Date(newStartDate),
                    end: new Date(newEndDate),
                    title: appointment.title,
                    info: targetPersonName + " - " + hours.toFixed(1) + "h work",
                    type: appointment.type,
                    tentative: appointment.tentative,
                    color: this._getColorForAppointment(hours, targetPersonName, appointment.isImportant),
                    icon: appointment.icon,
                    projectId: appointment.projectId,
                    isImportant: appointment.isImportant,
                    comments: appointment.comments
                });
            }
        },

        _updateOriginalDataAfterResize: function (personName, appointmentId, newStartDate, newEndDate, hours) {
            var person = this._oOriginalPeopleData.find(function (p) {
                return p.name === personName;
            });

            if (person) {
                var appointment = person.appointments.find(function (appt) {
                    return appt.id === appointmentId;
                });

                if (appointment) {
                    appointment.start = new Date(newStartDate);
                    appointment.end = new Date(newEndDate);
                    appointment.info = personName + " - " + hours.toFixed(1) + "h work";
                    appointment.color = this._getColorForAppointment(hours, personName, appointment.isImportant);
                }
            }
        },

        _updateOriginalDataAfterCreate: function (personName, newAppointment) {
            var person = this._oOriginalPeopleData.find(function (p) {
                return p.name === personName;
            });

            if (person) {
                person.appointments.push(JSON.parse(JSON.stringify(newAppointment)));
            }
        },

        onNewRequestPress: function () {
            var oPlanningCalendar = this.byId("planningCalendar");
            var oStartDate = new Date(oPlanningCalendar.getStartDate());
            var oModel = this.getView().getModel();
            var aPeople = oModel.getProperty("/people");

            if (aPeople.length === 0) return;

            var oPerson = aPeople[0];
            var start = new Date(oStartDate);
            start.setHours(9, 0, 0, 0);
            var end = new Date(oStartDate);
            end.setHours(10, 0, 0, 0);
            var hours = this._calculateHours(start, end);

            var newAppointment = {
                id: this._generateAppointmentId(),
                start: start,
                end: end,
                title: "New Request",
                info: oPerson.name + " - New request created",
                type: "Type06",
                tentative: false,
                color: this._getColorForAppointment(hours, oPerson.name, false),
                icon: "sap-icon://create",
                projectId: this._getProjectIdForPerson(oPerson.name),
                isImportant: false,
                comments: "New request comments"
            };

            oPerson.appointments.unshift(newAppointment);

            // Update original data
            this._updateOriginalDataAfterCreate(oPerson.name, newAppointment);

            oModel.refresh(true);
            this._updateTimesheetSummary();
            MessageToast.show("New Request created for " + oPerson.name);
        },

        onPersonNamePress: function (oEvent) {
            var sPersonName = oEvent.getSource().getTitle();
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("memberTasks", {
                personName: encodeURIComponent(sPersonName)
            });
        },

        onAssignProject: function () {
            var oView = this.getView();
            var that = this;

            if (!this._oAssignDialog) {
                // Create list to show already assigned projects
                var oAssignedList = new sap.m.List("assignedProjectList", {
                    headerText: "Already Assigned Projects",
                    items: {
                        path: "/assignedProjects",
                        template: new sap.m.StandardListItem({
                            title: "{name}"
                        })
                    }
                });

                // Create dialog
                this._oAssignDialog = new sap.m.Dialog({
                    title: "Assign Project",
                    contentWidth: "500px",
                    contentHeight: "400px",
                    resizable: true,
                    draggable: true,
                    content: new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: "Select Person" }),
                            new sap.m.Select("personSelectAssign", {
                                width: "100%",
                                items: {
                                    path: "/people",
                                    template: new sap.ui.core.Item({
                                        key: "{name}",
                                        text: "{name}"
                                    })
                                },
                                change: function (oEvent) {
                                    // Update assigned project list when person changes
                                    var sPersonName = oEvent.getSource().getSelectedKey();
                                    var oPerson = that._oOriginalPeopleData.find(function (p) {
                                        return p.name === sPersonName;
                                    });

                                    if (oPerson) {
                                        var oData = oView.getModel().getData();
                                        var aAssigned = oPerson.assignedProjects.map(function (projId) {
                                            return oData.projects.find(function (p) {
                                                return p.id === projId;
                                            });
                                        }).filter(Boolean);

                                        // Update list model for assigned projects
                                        var oListModel = new sap.ui.model.json.JSONModel({
                                            assignedProjects: aAssigned
                                        });
                                        oAssignedList.setModel(oListModel);
                                    }
                                }
                            }),

                            new sap.m.Label({ text: "Select Projects to Assign" }),
                            new sap.m.MultiComboBox("projectCombo", {
                                width: "100%",
                                items: {
                                    path: "/projects",
                                    template: new sap.ui.core.Item({
                                        key: "{id}",
                                        text: "{name}"
                                    })
                                }
                            }),

                            new sap.m.ToolbarSeparator(),
                            oAssignedList
                        ]
                    }),
                    beginButton: new sap.m.Button({
                        text: "Assign",
                        type: "Emphasized",
                        press: function () {
                            var sPersonName = sap.ui.getCore().byId("personSelectAssign").getSelectedKey();
                            var aProjectIds = sap.ui.getCore().byId("projectCombo").getSelectedKeys();
                            var oPerson = that._oOriginalPeopleData.find(function (p) {
                                return p.name === sPersonName;
                            });

                            if (oPerson) {
                                var oData = oView.getModel().getData();

                                aProjectIds.forEach(function (id) {
                                    var oProject = oData.projects.find(function (p) {
                                        return p.id === id;
                                    });
                                    if (oProject) {
                                        // Check skill match
                                        var bMatch = oProject.requiredSkills.some(function (skill) {
                                            return oPerson.skillSet.includes(skill);
                                        });
                                        if (!bMatch) {
                                            sap.m.MessageToast.show("Skill mismatch for project " + oProject.name);
                                            return;
                                        }

                                        // Check availability (max 160 hours/month)
                                        var totalH = oPerson.appointments.reduce(function (sum, appt) {
                                            return sum + that._calculateHours(appt.start, appt.end);
                                        }, 0);
                                        if (totalH > 160) {
                                            sap.m.MessageToast.show("No availability for " + oPerson.name);
                                            return;
                                        }

                                        if (!oPerson.assignedProjects.includes(id)) {
                                            oPerson.assignedProjects.push(id);
                                        }
                                    }
                                });

                                that._applyCurrentFilter();
                                sap.m.MessageToast.show("Projects assigned to " + sPersonName);

                                // Refresh list to show updated assignments
                                var aUpdatedAssigned = oPerson.assignedProjects.map(function (projId) {
                                    return oData.projects.find(function (p) {
                                        return p.id === projId;
                                    });
                                }).filter(Boolean);

                                var oListModel = new sap.ui.model.json.JSONModel({
                                    assignedProjects: aUpdatedAssigned
                                });
                                oAssignedList.setModel(oListModel);
                            }

                            that._oAssignDialog.close();
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAssignDialog.close();
                        }
                    })
                });

                oView.addDependent(this._oAssignDialog);
            }

            this._oAssignDialog.open();
        },

        onViewReports: function () {
            var oModel = this.getView().getModel();
            var oData = oModel.getData();
            var aReports = [];
            oData.projects.forEach(function (oProject) {
                oData.people.forEach(function (oPerson) {
                    var aAppts = oPerson.appointments.filter(function (oAppt) {
                        return oAppt.projectId === oProject.id;
                    });
                    if (aAppts.length > 0) {
                        var totalHours = aAppts.reduce(function (sum, appt) {
                            return sum + this._calculateHours(appt.start, appt.end);
                        }.bind(this), 0);
                        var minStartTime = Math.min(...aAppts.map(function (appt) { return new Date(appt.start).getTime(); }));
                        var maxEndTime = Math.max(...aAppts.map(function (appt) { return new Date(appt.end).getTime(); }));
                        var minStart = new Date(minStartTime);
                        var maxEnd = new Date(maxEndTime);
                        var duration = (maxEnd - minStart) / (1000 * 60 * 60 * 24) + 1; // inclusive days
                        aReports.push({
                            projectId: oProject.id,
                            projectName: oProject.name,
                            employeeName: oPerson.name,
                            hours: totalHours,
                            duration: duration.toFixed(0) + " days"
                        });
                    }
                }.bind(this));
            }.bind(this));
            var oReportModel = new JSONModel({ projectReports: aReports });
            this.getView().setModel(oReportModel, "reports");

            var oProjectSelect = new Select({
                selectedKey: "all",
                items: [new Item({ key: "all", text: "All Projects" })].concat(oData.projects.map(function (p) {
                    return new Item({ key: p.id, text: p.name });
                })),
                change: this._applyReportFilters.bind(this)
            });

            var oEmployeeSelect = new Select({
                selectedKey: "all",
                items: [new Item({ key: "all", text: "All Employees" })].concat(oData.people.map(function (p) {
                    return new Item({ key: p.name, text: p.name });
                })),
                change: this._applyReportFilters.bind(this)
            });

            var oTable = new Table({
                columns: [
                    new Column({ header: new Label({ text: "Project" }) }),
                    new Column({ header: new Label({ text: "Employee" }) }),
                    new Column({ header: new Label({ text: "Booked Hours" }) }),
                    new Column({ header: new Label({ text: "Engagement Duration" }) })
                ]
            });
            oTable.bindItems({
                path: "reports>/projectReports",
                template: new ColumnListItem({
                    cells: [
                        new Text({ text: "{reports>projectName}" }),
                        new Text({ text: "{reports>employeeName}" }),
                        new Text({ text: "{reports>hours} h" }),
                        new Text({ text: "{reports>duration}" })
                    ]
                })
            });

            var oDialog = new Dialog({
                title: "Project-Wise Reports",
                content: new VBox({
                    items: [
                        new HBox({
                            items: [
                                new Label({ text: "Project: ", labelFor: oProjectSelect }),
                                oProjectSelect,
                                new Label({ text: "Employee: ", labelFor: oEmployeeSelect }),
                                oEmployeeSelect
                            ]
                        }),
                        oTable
                    ]
                }),
                beginButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                })
            });
            this.getView().addDependent(oDialog);
            oDialog.open();

            // Store references for filtering
            this._oReportTable = oTable;
            this._oProjectSelect = oProjectSelect;
            this._oEmployeeSelect = oEmployeeSelect;
        },

        _applyReportFilters: function () {
            var sProjectId = this._oProjectSelect.getSelectedKey();
            var sEmployee = this._oEmployeeSelect.getSelectedKey();
            var aFilters = [];

            if (sProjectId !== "all") {
                aFilters.push(new Filter("projectId", FilterOperator.EQ, sProjectId));
            }
            if (sEmployee !== "all") {
                aFilters.push(new Filter("employeeName", FilterOperator.EQ, sEmployee));
            }

            this._oReportTable.getBinding("items").filter(aFilters);
        },

        onReviewTimesheets: function () {
            var oEmployeeSelect = new Select({
                selectedKey: "all",
                items: [new Item({ key: "all", text: "All Employees" })].concat(this._oOriginalPeopleData.map(function (p) {
                    return new Item({ key: p.name, text: p.name });
                })),
                change: this._applyTimesheetFilters.bind(this)
            });

            var aRoles = [...new Set(this._oOriginalPeopleData.map(function (p) { return p.role; }))];
            var oRoleSelect = new Select({
                selectedKey: "all",
                items: [new Item({ key: "all", text: "All Roles" })].concat(aRoles.map(function (r) {
                    return new Item({ key: r, text: r });
                })),
                change: this._applyTimesheetFilters.bind(this)
            });

            var oTable = new Table({
                columns: [
                    new Column({ header: new Label({ text: "Employee" }) }),
                    new Column({ header: new Label({ text: "Role" }) }),
                    new Column({ header: new Label({ text: "Total Hours" }) }),
                    new Column({ header: new Label({ text: "Status" }) }),
                    new Column({ header: new Label({ text: "Alert" }) }),
                    new Column({ header: new Label({ text: "Action" }) })
                ]
            });
            oTable.bindItems({
                path: "/people",
                template: new ColumnListItem({
                    cells: [
                        new Text({ text: "{name}" }),
                        new Text({ text: "{role}" }),
                        new Text({ text: "{totalHours}" }),
                        new Text({ text: "{timesheetStatus}" }),
                        new Text({ text: "{alert}" }),
                        new Button({
                            text: "{= ${timesheetStatus} === 'Pending' ? 'Approve' : 'Approved' }",
                            type: "{= ${timesheetStatus} === 'Pending' ? 'Accept' : 'Default' }",
                            enabled: "{= ${timesheetStatus} === 'Pending' }",
                            press: this._onApproveTimesheet.bind(this)
                        })
                    ]
                })
            });

            var oDialog = new Dialog({
                title: "Review Timesheets",
                content: new VBox({
                    items: [
                        new HBox({
                            items: [
                                new Label({ text: "Employee: ", labelFor: oEmployeeSelect }),
                                oEmployeeSelect,
                                new Label({ text: "Role: ", labelFor: oRoleSelect }),
                                oRoleSelect
                            ]
                        }),
                        oTable
                    ]
                }),
                beginButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                })
            });
            this.getView().addDependent(oDialog);
            oDialog.open();

            // Store references for filtering
            this._oTimesheetTable = oTable;
            this._oTimesheetEmployeeSelect = oEmployeeSelect;
            this._oTimesheetRoleSelect = oRoleSelect;
        },

        _applyTimesheetFilters: function () {
            var sEmployee = this._oTimesheetEmployeeSelect.getSelectedKey();
            var sRole = this._oTimesheetRoleSelect.getSelectedKey();
            var aFilters = [];

            if (sEmployee !== "all") {
                aFilters.push(new Filter("name", FilterOperator.EQ, sEmployee));
            }
            if (sRole !== "all") {
                aFilters.push(new Filter("role", FilterOperator.EQ, sRole));
            }

            this._oTimesheetTable.getBinding("items").filter(aFilters);
        },

        _onApproveTimesheet: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oPerson = oContext.getObject();
            oPerson.timesheetStatus = "Approved";
            this.getView().getModel().refresh(true);
            MessageToast.show("Timesheet approved for " + oPerson.name);
            this._updateTimesheetSummary();
        }
    });
});