sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/type/Float",
    "sap/m/Dialog",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/ComboBox",
    "sap/m/Input",
    "sap/m/Button",
    "sap/ui/core/Item",
    "sap/ui/core/routing/History",
    "sap/ui/core/Fragment",
    "sap/m/DateRangeSelection",
    "sap/m/CheckBox",
    "sap/m/TextArea",
    "sap/m/SegmentedButton",
    "sap/m/SegmentedButtonItem"
], function(Controller, MessageBox, MessageToast, JSONModel, FloatType, Dialog, VBox, Label,
    ComboBox, Input, Button, Item, History, Fragment, DateRangeSelection, CheckBox, TextArea,
    SegmentedButton, SegmentedButtonItem) {
    "use strict";
    return Controller.extend("admin.com.admin.controller.Employee", {
        onInit: function() {
            this._oV2Model = this.getOwnerComponent().getModel("timesheetservicev2");
            this._oLocalModel = new JSONModel({
                totalWeekHours: "0.00",
                selectedDate: null,
                isCurrentWeek: true,
                weekDates: {},
                workTypes: [
                    { type: "DESIGN", name: "Designing" },
                    { type: "DEVELOP", name: "Developing" },
                    { type: "TEST", name: "Testing" },
                    { type: "DEPLOY", name: "Deployment" },
                    { type: "MEETING", name: "Meetings" },
                    { type: "DOCUMENTATION", name: "Documentation" },
                    { type: "LEAVE", name: "Leave" },
                    { type: "TRAINING", name: "Training" }
                ]
            });
            this.getView().setModel(this._oLocalModel, "oLocalModel");

            this._initializeCurrentWeek();
            this._loadTimesheetData();
        }
            this._initializeModel();
            this._initializeCurrentWeek();
            this._calculateAllTotals();
            this._updateCounts();
            this._updateProjectEngagement();
            // Initialize router
            this._oRouter = this.getOwnerComponent().getRouter();
            if (!this._oRouter) {
                this._oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            }
        },

        
        // Formatter function to calculate row total
        formatRowTotal: function(monday, tuesday, wednesday, thursday, friday, saturday, sunday) {
            var total = (parseFloat(monday) || 0) +
                (parseFloat(tuesday) || 0) +
                (parseFloat(wednesday) || 0) +
                (parseFloat(thursday) || 0) +
                (parseFloat(friday) || 0) +
                (parseFloat(saturday) || 0) +
                (parseFloat(sunday) || 0);
            return total.toFixed(2);
        },
        _initializeModel: function() {
            var oModel = new JSONModel({
                currentWeek: "Oct 20 - Oct 26 2025",
                totalWeekHours: "0.00",
                isSubmitted: false,
                timeEntriesCount: "0",
                commentsCount: "0",
                selectedDate: null,
                isCurrentWeek: true, // Added to track current week state
                assignedProjects: [
                    {
                        projectId: "b47ac10b-58cc-4372-a567-0e02b2c3d500",
                        projectName: "E-Commerce Platform",
                        managerName: "Sarah Johnson",
                        status: "Active",
                        startDate: "2024-02-01",
                        endDate: "2024-08-31",
                        allocatedHours: 2400
                    },
                    {
                        projectId: "P002",
                        projectName: "Mobile App - Customer Portal",
                        managerName: "Sarah Johnson",
                        status: "Active",
                        startDate: "2022-10-01",
                        endDate: "2023-02-28",
                        allocatedHours: 3200
                    },
                    {
                        projectId: "P003",
                        projectName: "HR System Upgrade",
                        managerName: "Mike Brown",
                        status: "On Hold",
                        startDate: "2022-08-15",
                        endDate: "2022-11-30",
                        allocatedHours: 1800
                    },
                    {
                        projectId: "e47ac10b-58cc-4372-a567-0e02b2c3d530",
                        projectName: "Leave",
                        managerName: "Sarah Johnson",
                        status: "Active",
                        startDate: "2024-01-01",
                        endDate: "2024-12-31",
                        allocatedHours: 1600
                    }
                ],
                workTypes: [
                    { type: "DESIGN", name: "Designing" },
                    { type: "DEVELOP", name: "Developing" },
                    { type: "TEST", name: "Testing" },
                    { type: "DEPLOY", name: "Deployment" },
                    { type: "MEETING", name: "Meetings" },
                    { type: "DOCUMENTATION", name: "Documentation" },
                    { type: "LEAVE", name: "Leave" },
                    { type: "TRAINING", name: "Training" }
                ],
                timeEntries: [
                    {
                        id: "d47ac10b-58cc-4372-a567-0e02b2c3d522",
                        projectId: "b47ac10b-58cc-4372-a567-0e02b2c3d500",
                        projectName: "E-Commerce Platform",
                        workTypeName: "Designing",
                        workType: "DESIGN",
                        monday: 0,
                        tuesday: 8.0,
                        wednesday: 0,
                        thursday: 0,
                        friday: 0,
                        saturday: 0,
                        sunday: 0,
                        comment: "Created responsive UI components for product catalog",
                        isApproved: true,
                        isFutureDay: false
                    },
                    {
                        id: "d47ac10b-58cc-4372-a567-0e02b2c3d523",
                        projectId: "b47ac10b-58cc-4372-a567-0e02b2c3d500",
                        projectName: "E-Commerce Platform",
                        workTypeName: "Developing",
                        workType: "DEVELOP",
                        monday: 0,
                        tuesday: 0,
                        wednesday: 8.0,
                        thursday: 0,
                        friday: 0,
                        saturday: 0,
                        sunday: 0,
                        comment: "Implemented shopping cart functionality with React",
                        isApproved: true,
                        isFutureDay: false
                    },
                    {
                        id: "d47ac10b-58cc-4372-a567-0e02b2c3d540",
                        projectId: "e47ac10b-58cc-4372-a567-0e02b2c3d530",
                        projectName: "Leave",
                        workTypeName: "Leave",
                        workType: "LEAVE",
                        monday: 0,
                        tuesday: 4,
                        wednesday: 0,
                        thursday: 0,
                        friday: 0,
                        saturday: 0,
                        sunday: 0,
                        comment: "Annual Leave - Family vacation",
                        isApproved: true,
                        isFutureDay: false
                    }
                ],
                dailyTotals: {
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 0,
                    sunday: 0
                },
                dailyComments: [
                    { day: "Monday", comment: "", lastUpdated: "" },
                    { day: "Tuesday", comment: "Worked on design and development tasks for E-Commerce Platform.", lastUpdated: "2024-10-02 18:00" },
                    { day: "Wednesday", comment: "", lastUpdated: "" },
                    { day: "Thursday", comment: "", lastUpdated: "" },
                    { day: "Friday", comment: "", lastUpdated: "" },
                    { day: "Saturday", comment: "", lastUpdated: "" },
                    { day: "Sunday", comment: "", lastUpdated: "" }
                ],
                projectEngagement: [],
                weekDates: {
                    monday: "2025-10-20",
                    tuesday: "2025-10-21",
                    wednesday: "2025-10-22",
                    thursday: "2025-10-23",
                    friday: "2025-10-24",
                    saturday: "2025-10-25",
                    sunday: "2025-10-26",
                    mondayFormatted: "Oct 20",
                    tuesdayFormatted: "Oct 21",
                    wednesdayFormatted: "Oct 22",
                    thursdayFormatted: "Oct 23",
                    fridayFormatted: "Oct 24",
                    saturdayFormatted: "Oct 25",
                    sundayFormatted: "Oct 26"
                },
                editEntry: {},
                newEntry: {
                    selectedDate: "2025-10-25",
                    projectId: "",
                    workType: "",
                    hours: "8", // Default hours value
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 0,
                    sunday: 0,
                    comment: "",
                    taskDetails: "" // Add taskDetails property
                },
                newDailyComment: {
                    day: "",
                    comment: ""
                },
                employeeProjectHours: [],
                employeeProjectDurations: [],
                // COMMENT DIALOG DATA
                currentCommentType: "daily",
                selectedDay: "Monday",
                dailyCommentText: "",
                weeklyCommentText: "",
                monthlyCommentText: "",
                currentMonth: "October 2025",
                // Changed from assignees to projects for the first dropdown
                projects: [
                    { id: "b47ac10b-58cc-4372-a567-0e02b2c3d500", name: "E-Commerce Platform" },
                    { id: "P002", name: "Mobile App - Customer Portal" },
                    { id: "P003", name: "HR System Upgrade" },
                    { id: "e47ac10b-58cc-4372-a567-0e02b2c3d530", name: "Leave" }
                ],
                selectedProject: "b47ac10b-58cc-4372-a567-0e02b2c3d500",
                dueDateStart: null,
                dueDateEnd: null,
                // Changed from projects to workTypes for the second dropdown
                workTypes: [
                    { type: "DESIGN", name: "Designing" },
                    { type: "DEVELOP", name: "Developing" },
                    { type: "TEST", name: "Testing" },
                    { type: "DEPLOY", name: "Deployment" },
                    { type: "MEETING", name: "Meetings" },
                    { type: "DOCUMENTATION", name: "Documentation" },
                    { type: "LEAVE", name: "Leave" },
                    { type: "TRAINING", name: "Training" }
                ],
                selectedWorkType: "DESIGN",
                statusOptions: [
                    { key: "todo", text: "To Do" },
                    { key: "inprogress", text: "In Progress" },
                    { key: "done", text: "Done" },
                    { key: "review", text: "Under Review" }
                ],
                selectedStatus: "todo",
                priorityOptions: [
                    { key: "low", text: "Low" },
                    { key: "medium", text: "Medium" },
                    { key: "high", text: "High" },
                    { key: "urgent", text: "Urgent" }
                ],
                selectedPriority: "medium",
                needInput: false,
                newCommentText: "",
                existingComments: [
                    { author: "John Smith", date: "17th Feb 2024", text: "I'll do that task now, you can start working on another task!" },
                    { author: "John Smith", date: "Just Now", text: "Hello!" }
                ],
                // Properties for comment editing
                editCommentText: "",
                editCommentId: ""
            });
            this.getView().setModel(oModel);
            this._calculateAllTotals();
            this._updateCounts();
            this._updateProjectEngagement();
            this._updateReportsData();
        },
        _initializeCurrentWeek: function() {
            var today = new Date("2025-10-27T07:28:00Z");
            var oModel = this.getView().getModel();
            oModel.setProperty("/selectedDate", this._formatDateForModel(today));
            oModel.setProperty("/isCurrentWeek", true); // Set initial state to current week
            this._updateWeekDates(today);
        },
        _updateWeekDates: function(oDate) {
            var oModel = this.getView().getModel();
            var startDate = new Date(oDate);
            var day = startDate.getDay();
            var diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
            var monday = new Date(startDate.setDate(diff));
            var tuesday = new Date(monday);
            tuesday.setDate(monday.getDate() + 1);
            var wednesday = new Date(monday);
            wednesday.setDate(monday.getDate() + 2);
            var thursday = new Date(monday);
            thursday.setDate(monday.getDate() + 3);
            var friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);
            var saturday = new Date(monday);
            saturday.setDate(monday.getDate() + 5);
            var sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            var oWeekDates = {
                monday: this._formatDateForModel(monday),
                tuesday: this._formatDateForModel(tuesday),
                wednesday: this._formatDateForModel(wednesday),
                thursday: this._formatDateForModel(thursday),
                friday: this._formatDateForModel(friday),
                saturday: this._formatDateForModel(saturday),
                sunday: this._formatDateForModel(sunday),
                mondayFormatted: this._formatDateDisplay(monday),
                tuesdayFormatted: this._formatDateDisplay(tuesday),
                wednesdayFormatted: this._formatDateDisplay(wednesday),
                thursdayFormatted: this._formatDateDisplay(thursday),
                fridayFormatted: this._formatDateDisplay(friday),
                saturdayFormatted: this._formatDateDisplay(saturday),
                sundayFormatted: this._formatDateDisplay(sunday)
            };
            var sCurrentWeek = this._formatDateDisplay(monday) + " - " + this._formatDateDisplay(sunday) + " " + sunday.getFullYear();
            oModel.setProperty("/weekDates", oWeekDates);
            oModel.setProperty("/currentWeek", sCurrentWeek);
            
            // Check if this is the current week
            var today = new Date("2025-10-27T07:28:00Z");
            var isCurrentWeek = today >= monday && today <= sunday;
            oModel.setProperty("/isCurrentWeek", isCurrentWeek);
            
            Object.keys(oWeekDates).forEach(function(sDay) {
                if (sDay.endsWith("Formatted")) return;
                var dayDate = new Date(oWeekDates[sDay]);
                var isFuture = dayDate > new Date("2025-10-27T07:28:00Z");
                oWeekDates[sDay + "IsFuture"] = isFuture;
            });
            oModel.setProperty("/weekDates", oWeekDates);
        },
        _formatDateForModel: function(oDate) {
            return oDate.getFullYear() + "-" +
                ("0" + (oDate.getMonth() + 1)).slice(-2) + "-" +
                ("0" + oDate.getDate()).slice(-2);
        },
        _formatDateDisplay: function(oDate) {
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return months[oDate.getMonth()] + " " + ("0" + oDate.getDate()).slice(-2);
        },
        _updateCounts: function() {
            var oModel = this.getView().getModel();
            var aEntries = oModel.getProperty("/timeEntries");
            var aComments = oModel.getProperty("/dailyComments");
            var iCommentsWithText = aComments.filter(function(comment) {
                return comment.comment && comment.comment.trim() !== "";
            }).length;
            oModel.setProperty("/timeEntriesCount", aEntries.length.toString());
            oModel.setProperty("/commentsCount", iCommentsWithText.toString());
        },
        // COMMENT DIALOG FUNCTIONS
        onInfoPress: function() {
            if (!this._oCommentOptionsDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "admin.com.admin.Fragments.CommentOptions",
                    controller: this
                }).then(function(oDialog) {
                    this._oCommentOptionsDialog = oDialog;
                    this.getView().addDependent(this._oCommentOptionsDialog);
                    // Initialize comment data
                    this._initializeCommentData();
                    this._oCommentOptionsDialog.open();
                }.bind(this)).catch(function(oError) {
                    MessageBox.error("Error loading comment dialog. Please try again.");
                });
            } else {
                this._initializeCommentData();
                this._oCommentOptionsDialog.open();
            }
        },
        _initializeCommentData: function() {
            var oModel = this.getView().getModel();
            // Reset form data
            oModel.setProperty("/currentCommentType", "daily");
            oModel.setProperty("/selectedDay", "Monday");
            oModel.setProperty("/dailyCommentText", "");
            oModel.setProperty("/weeklyCommentText", "");
            oModel.setProperty("/monthlyCommentText", "");
            oModel.setProperty("/newCommentText", "");
            oModel.setProperty("/needInput", false);
            // Set default values for dropdowns - use first item from each list
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
            // Set current date for due date
            var today = new Date();
            var todayStr = today.getFullYear() + "-" +
                ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
                ("0" + today.getDate()).slice(-2);
            oModel.setProperty("/dueDateStart", todayStr);
            oModel.setProperty("/dueDateEnd", todayStr);
        },
        onCommentTypeSelect: function(oEvent) {
            var sKey = oEvent.getParameter("key");
            var oModel = this.getView().getModel();
            oModel.setProperty("/currentCommentType", sKey);
            MessageToast.show("Switched to " + sKey + " comments");
        },
        onAddNewComment: function() {
            var oModel = this.getView().getModel();
            var sNewComment = oModel.getProperty("/newCommentText");
            if (!sNewComment || sNewComment.trim() === "") {
                MessageBox.error("Please enter a comment");
                return;
            }
            // Add new comment to existing comments
            var aExistingComments = oModel.getProperty("/existingComments") || [];
            aExistingComments.push({
                author: "You",
                date: "Just Now",
                text: sNewComment
            });
            oModel.setProperty("/existingComments", aExistingComments);
            oModel.setProperty("/newCommentText", "");
            MessageToast.show("Comment added successfully");
        },
        onSaveCommentOption: function() {
            var oModel = this.getView().getModel();
            var sCommentType = oModel.getProperty("/currentCommentType");
            if (sCommentType === "daily") {
                this._saveDailyComment();
            } else if (sCommentType === "weekly") {
                this._saveWeeklyComment();
            } else if (sCommentType === "monthly") {
                this._saveMonthlyComment();
            }
        },
        // Add this function to handle saving comments to the timesheet
        _saveCommentToTimesheet: function(sComment, sType, sProjectName, sWorkTypeName) {
            var oModel = this.getView().getModel();
            var aTimeEntries = oModel.getProperty("/timeEntries");
            // Create a new time entry for the comment
            var oCommentEntry = {
                id: "c" + Date.now(), // Unique ID for comment entry
                projectId: "comment", // Special ID for comments
                projectName: sProjectName || "Comment",
                workTypeName: sWorkTypeName || (sType + " Comment"),
                workType: "COMMENT",
                monday: 0,
                tuesday: 0,
                wednesday: 0,
                thursday: 0,
                friday: 0,
                saturday: 0,
                sunday: 0,
                comment: sComment,
                isApproved: true,
                isFutureDay: false,
                isCommentEntry: true // Flag to identify comment entries
            };
            // Add the comment entry to the time entries
            aTimeEntries.push(oCommentEntry);
            oModel.setProperty("/timeEntries", aTimeEntries);
            // Refresh the table
            var oTable = this.getView().byId("timesheetTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
            MessageToast.show(sType + " comment saved to timesheet");
        },
        _saveDailyComment: function() {
            var oModel = this.getView().getModel();
            var sComment = oModel.getProperty("/dailyCommentText");
            var sProject = oModel.getProperty("/selectedProject");
            var sWorkType = oModel.getProperty("/selectedWorkType");
            var sStatus = oModel.getProperty("/selectedStatus");
            var sPriority = oModel.getProperty("/selectedPriority");
            var bNeedInput = oModel.getProperty("/needInput");
            var sSelectedDay = oModel.getProperty("/selectedDay");
            // Validation
            if (!sComment || sComment.trim() === "") {
                MessageBox.error("Please enter a description for the daily comment");
                return;
            }
            if (!sProject) {
                MessageBox.error("Please select a project");
                return;
            }
            if (!sWorkType) {
                MessageBox.error("Please select a work type");
                return;
            }
            // Get display values
            var aProjects = oModel.getProperty("/projects");
            var aWorkTypes = oModel.getProperty("/workTypes");
            var aStatusOptions = oModel.getProperty("/statusOptions");
            var aPriorityOptions = oModel.getProperty("/priorityOptions");
            var oSelectedProject = aProjects.find(function(item) { return item.id === sProject; });
            var oSelectedWorkType = aWorkTypes.find(function(item) { return item.type === sWorkType; });
            var oSelectedStatus = aStatusOptions.find(function(item) { return item.key === sStatus; });
            var oSelectedPriority = aPriorityOptions.find(function(item) { return item.key === sPriority; });
            // Prepare comment data
            var oCommentData = {
                type: "daily",
                day: sSelectedDay,
                project: oSelectedProject ? oSelectedProject.name : "Unknown",
                workType: oSelectedWorkType ? oSelectedWorkType.name : "Unknown",
                status: oSelectedStatus ? oSelectedStatus.text : "Unknown",
                priority: oSelectedPriority ? oSelectedPriority.text : "Unknown",
                dueDateStart: oModel.getProperty("/dueDateStart"),
                dueDateEnd: oModel.getProperty("/dueDateEnd"),
                description: sComment,
                needInput: bNeedInput,
                timestamp: new Date().toISOString()
            };
            // Log for debugging
            console.log("Saving daily comment:", oCommentData);
            // Format comment for display with both project and work type
            var sFormattedComment = "[" + sSelectedDay + "] " + sComment +
                "\nProject: " + (oSelectedProject ? oSelectedProject.name : "Unknown") +
                "\nWork Type: " + (oSelectedWorkType ? oSelectedWorkType.name : "Unknown") +
                "\nStatus: " + (oSelectedStatus ? oSelectedStatus.text : "Unknown") +
                "\nPriority: " + (oSelectedPriority ? oSelectedPriority.text : "Unknown");
            // Update daily comments in the model
            var aDailyComments = oModel.getProperty("/dailyComments") || [];
            var oDayComment = aDailyComments.find(function(comment) {
                return comment.day === sSelectedDay;
            });
            var now = new Date();
            var timeStr = now.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            if (oDayComment) {
                oDayComment.comment = sComment;
                oDayComment.lastUpdated = timeStr;
            } else {
                aDailyComments.push({
                    day: sSelectedDay,
                    comment: sComment,
                    lastUpdated: timeStr
                });
            }
            oModel.setProperty("/dailyComments", aDailyComments);
            this._updateCounts();
            // Save comment to timesheet with project and work type
            this._saveCommentToTimesheet(
                sFormattedComment,
                "Daily",
                oSelectedProject ? oSelectedProject.name : "Unknown",
                oSelectedWorkType ? oSelectedWorkType.name : "Unknown"
            );
            if (this._oCommentOptionsDialog) {
                this._oCommentOptionsDialog.close();
            }
        },
        _saveWeeklyComment: function() {
            var oModel = this.getView().getModel();
            var sComment = oModel.getProperty("/weeklyCommentText");
            var sProject = oModel.getProperty("/selectedProject");
            var sWorkType = oModel.getProperty("/selectedWorkType");
            if (!sComment || sComment.trim() === "") {
                MessageBox.error("Please enter a weekly summary");
                return;
            }
            // Get display values
            var aProjects = oModel.getProperty("/projects");
            var aWorkTypes = oModel.getProperty("/workTypes");
            var oSelectedProject = aProjects.find(function(item) { return item.id === sProject; });
            var oSelectedWorkType = aWorkTypes.find(function(item) { return item.type === sWorkType; });
            var oCommentData = {
                type: "weekly",
                week: oModel.getProperty("/currentWeek"),
                project: oSelectedProject ? oSelectedProject.name : "Unknown",
                workType: oSelectedWorkType ? oSelectedWorkType.name : "Unknown",
                summary: sComment,
                timestamp: new Date().toISOString()
            };
            // Log for debugging
            console.log("Saving weekly comment:", oCommentData);
            // Format comment for display with both project and work type
            var sFormattedComment = "[Weekly Summary - " + oModel.getProperty("/currentWeek") + "]\n" + sComment +
                "\nProject: " + (oSelectedProject ? oSelectedProject.name : "Unknown") +
                "\nWork Type: " + (oSelectedWorkType ? oSelectedWorkType.name : "Unknown");
            // Add to existing comments as a special entry
            var aExistingComments = oModel.getProperty("/existingComments") || [];
            aExistingComments.push({
                author: "You",
                date: "Weekly Summary - " + new Date().toLocaleDateString(),
                text: "[WEEKLY] " + sComment
            });
            oModel.setProperty("/existingComments", aExistingComments);
            // Save comment to timesheet with project and work type
            this._saveCommentToTimesheet(
                sFormattedComment,
                "Weekly",
                oSelectedProject ? oSelectedProject.name : "Unknown",
                oSelectedWorkType ? oSelectedWorkType.name : "Unknown"
            );
            if (this._oCommentOptionsDialog) {
                this._oCommentOptionsDialog.close();
            }
        },
        _saveMonthlyComment: function() {
            var oModel = this.getView().getModel();
            var sComment = oModel.getProperty("/monthlyCommentText");
            var sProject = oModel.getProperty("/selectedProject");
            var sWorkType = oModel.getProperty("/selectedWorkType");
            if (!sComment || sComment.trim() === "") {
                MessageBox.error("Please enter a monthly review");
                return;
            }
            // Get display values
            var aProjects = oModel.getProperty("/projects");
            var aWorkTypes = oModel.getProperty("/workTypes");
            var oSelectedProject = aProjects.find(function(item) { return item.id === sProject; });
            var oSelectedWorkType = aWorkTypes.find(function(item) { return item.type === sWorkType; });
            var oCommentData = {
                type: "monthly",
                month: oModel.getProperty("/currentMonth"),
                project: oSelectedProject ? oSelectedProject.name : "Unknown",
                workType: oSelectedWorkType ? oSelectedWorkType.name : "Unknown",
                review: sComment,
                timestamp: new Date().toISOString()
            };
            // Log for debugging
            console.log("Saving monthly comment:", oCommentData);
            // Format comment for display with both project and work type
            var sFormattedComment = "[Monthly Review - " + oModel.getProperty("/currentMonth") + "]\n" + sComment +
                "\nProject: " + (oSelectedProject ? oSelectedProject.name : "Unknown") +
                "\nWork Type: " + (oSelectedWorkType ? oSelectedWorkType.name : "Unknown");
            // Add to existing comments as a special entry
            var aExistingComments = oModel.getProperty("/existingComments") || [];
            aExistingComments.push({
                author: "You",
                date: "Monthly Review - " + new Date().toLocaleDateString(),
                text: "[MONTHLY] " + sComment
            });
            oModel.setProperty("/existingComments", aExistingComments);
            // Save comment to timesheet with project and work type
            this._saveCommentToTimesheet(
                sFormattedComment,
                "Monthly",
                oSelectedProject ? oSelectedProject.name : "Unknown",
                oSelectedWorkType ? oSelectedWorkType.name : "Unknown"
            );
            if (this._oCommentOptionsDialog) {
                this._oCommentOptionsDialog.close();
            }
        },
        onCancelCommentOption: function() {
            if (this._oCommentOptionsDialog) {
                this._oCommentOptionsDialog.close();
            }
        },
        // Day selection for daily comments
        onDaySelect: function(oEvent) {
            var oModel = this.getView().getModel();
            var sSelectedKey = oEvent.getParameter("selectedKey");
            oModel.setProperty("/selectedDay", sSelectedKey);
            // Load existing comment for selected day if any
            var aDailyComments = oModel.getProperty("/dailyComments") || [];
            var oDayComment = aDailyComments.find(function(comment) {
                return comment.day === sSelectedKey;
            });
            if (oDayComment && oDayComment.comment) {
                oModel.setProperty("/dailyCommentText", oDayComment.comment);
            } else {
                oModel.setProperty("/dailyCommentText", "");
            }
        },
        // Comment management functions
        onEditComment: function(oEvent) {
            var oButton = oEvent.getSource();
            var oBindingContext = oButton.getBindingContext();
            if (!oBindingContext) return;
            var oEntry = oBindingContext.getObject();
            var oModel = this.getView().getModel();
            // Set the comment text in the model for editing
            oModel.setProperty("/editCommentText", oEntry.comment);
            oModel.setProperty("/editCommentId", oEntry.id);
            if (!this._oEditCommentDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "admin.com.admin.Fragments.EditComment",
                    controller: this
                }).then(function(oDialog) {
                    this._oEditCommentDialog = oDialog;
                    this.getView().addDependent(this._oEditCommentDialog);
                    this._oEditCommentDialog.open();
                }.bind(this));
            } else {
                this._oEditCommentDialog.open();
            }
        },
        onSaveEditedComment: function() {
            var oModel = this.getView().getModel();
            var sCommentText = oModel.getProperty("/editCommentText");
            var sCommentId = oModel.getProperty("/editCommentId");
            if (!sCommentText || sCommentText.trim() === "") {
                MessageBox.error("Comment cannot be empty");
                return;
            }
            var aTimeEntries = oModel.getProperty("/timeEntries");
            var oCommentEntry = aTimeEntries.find(function(entry) {
                return entry.id === sCommentId;
            });
            if (oCommentEntry) {
                oCommentEntry.comment = sCommentText;
                oModel.setProperty("/timeEntries", aTimeEntries);
                // Refresh the table
                var oTable = this.getView().byId("timesheetTable");
                if (oTable && oTable.getBinding("items")) {
                    oTable.getBinding("items").refresh();
                }
                MessageToast.show("Comment updated successfully");
            }
            if (this._oEditCommentDialog) {
                this._oEditCommentDialog.close();
            }
        },
        onCancelEditComment: function() {
            if (this._oEditCommentDialog) {
                this._oEditCommentDialog.close();
            }
        },
        onDeleteComment: function(oEvent) {
            var oButton = oEvent.getSource();
            var oBindingContext = oButton.getBindingContext();
            if (!oBindingContext) return;
            var oEntry = oBindingContext.getObject();
            MessageBox.confirm("Are you sure you want to delete this comment?", {
                title: "Delete Comment",
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        var oModel = this.getView().getModel();
                        var aTimeEntries = oModel.getProperty("/timeEntries");
                        var iIndex = aTimeEntries.findIndex(function(entry) {
                            return entry.id === oEntry.id;
                        });
                        if (iIndex > -1) {
                            aTimeEntries.splice(iIndex, 1);
                            oModel.setProperty("/timeEntries", aTimeEntries);
                            // Refresh the table
                            var oTable = this.getView().byId("timesheetTable");
                            if (oTable && oTable.getBinding("items")) {
                                oTable.getBinding("items").refresh();
                            }
                            MessageToast.show("Comment deleted successfully");
                        }
                    }
                }.bind(this)
            });
        },
        onCommentLiveChange: function(oEvent) {
            // This function can be used for live validation if needed
        },
        // EXISTING FUNCTIONS (keep all your existing functions)
        onTabSelect: function(oEvent) {
            var sKey = oEvent.getParameter("key");
            MessageToast.show("Switched to " + sKey + " tab");
            // If switching to reports tab, update the reports data
            if (sKey === "reports") {
                this._updateReportsData();
            }
        },
        onAddEntry: function() {
            var oModel = this.getView().getModel();
            var oNewEntry = {
                selectedDate: this._formatDateForModel(new Date()),
                projectId: "",
                workType: "",
                hours: "8", // Default hours value
                monday: 0,
                tuesday: 0,
                wednesday: 0,
                thursday: 0,
                friday: 0,
                saturday: 0,
                sunday: 0,
                comment: "",
                taskDetails: "" // Add taskDetails property
            };
            oModel.setProperty("/newEntry", oNewEntry);
            if (!this._oAddEntryDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "admin.com.admin.Fragments.AddTimeEntry",
                    controller: this
                }).then(function(oDialog) {
                    this._oAddEntryDialog = oDialog;
                    this.getView().addDependent(this._oAddEntryDialog);
                    this._oAddEntryDialog.open();
                }.bind(this));
            } else {
                this._oAddEntryDialog.open();
            }
        },
        // Function to handle date picker change in the fragment
        onEntryDatePickerChange: function(oEvent) {
            var oDatePicker = oEvent.getSource();
            var sDate = oDatePicker.getValue();
            if (sDate) {
                var selectedDate = new Date(sDate);
                var oModel = this.getView().getModel();
                oModel.setProperty("/newEntry/selectedDate", this._formatDateForModel(selectedDate));
                // Check if the selected date is within the current week
                var oWeekDates = oModel.getProperty("/weekDates");
                var monday = new Date(oWeekDates.monday);
                var sunday = new Date(oWeekDates.sunday);
                if (selectedDate < monday || selectedDate > sunday) {
                    MessageBox.warning("The selected date is outside the current week. Please select a date within " +
                        this._formatDateDisplay(monday) + " - " + this._formatDateDisplay(sunday));
                }
            }
        },
        // Function to handle hours change in the fragment
        onFragmentHoursChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var sValue = oSource.getValue();
            // Validate that the input is a number between 0 and 24
            if (sValue && (parseFloat(sValue) < 0 || parseFloat(sValue) > 24)) {
                MessageBox.alert("Hours must be between 0 and 24");
                oSource.setValue("0");
                return;
            }
            // Recalculate totals
            this._calculateAllTotals();
        },
        // Function to handle task details live change
        onTaskDetailsLiveChange: function(oEvent) {
            var oTextArea = oEvent.getSource();
            var sValue = oTextArea.getValue();
            var oModel = this.getView().getModel();
            
            // Update the task details in the model
            oModel.setProperty("/newEntry/taskDetails", sValue);
            
            // Optionally provide visual feedback when approaching the limit
            if (sValue.length >= 45) {
                oTextArea.addStyleClass("sapUiFieldWarning");
            } else {
                oTextArea.removeStyleClass("sapUiFieldWarning");
            }
        },
        // Function to save time entry (extracted from onSaveNewEntry)
        _saveTimeEntry: function() {
            var oModel = this.getView().getModel();
            var oNewEntry = oModel.getProperty("/newEntry");
            
            // Validation
            if (!oNewEntry.projectId || oNewEntry.projectId.trim() === "") {
                MessageBox.error("Please select a project");
                return false;
            }
            if (!oNewEntry.workType || oNewEntry.workType.trim() === "") {
                MessageBox.error("Please select a work type");
                return false;
            }
            if (!oNewEntry.hours || oNewEntry.hours.trim() === "") {
                MessageBox.error("Please select hours");
                return false;
            }
            
            // Get the selected date and determine the day of the week
            var selectedDate = new Date(oNewEntry.selectedDate);
            var dayOfWeek = selectedDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
            
            // Map dayOfWeek to our property names
            var dayMap = {
                0: "sunday",
                1: "monday",
                2: "tuesday",
                3: "wednesday",
                4: "thursday",
                5: "friday",
                6: "saturday"
            };
            var dayProperty = dayMap[dayOfWeek];
            
            // Get the hours for the selected day
            var hoursForDay = parseFloat(oNewEntry.hours) || 0;
            
            if (hoursForDay === 0) {
                MessageBox.error("Please enter hours for at least one day");
                return false;
            }
            
            // Get existing entries
            var aEntries = oModel.getProperty("/timeEntries");
            
            // Check if there's already an entry with the same project and work type
            var existingEntryIndex = aEntries.findIndex(function(entry) {
                return entry.projectId === oNewEntry.projectId && entry.workType === oNewEntry.workType;
            });
            
            if (existingEntryIndex !== -1) {
                // Update existing entry
                var existingEntry = aEntries[existingEntryIndex];
                
                // If the entry is approved, notify the manager
                if (existingEntry.isApproved) {
                    this._notifyManagerOfChange(existingEntry, "Time entry modified");
                }
                
                // Update the hours for the selected day
                existingEntry[dayProperty] = hoursForDay;
                
                // Update the comment/task details
                existingEntry.comment = oNewEntry.taskDetails || "";
                
                // Update the model
                oModel.setProperty("/timeEntries", aEntries);
            } else {
                // Create a new entry
                var sNewId = "d47ac10b-58cc-4372-a567-0e02b2c3d" + (500 + aEntries.length);
                var oProject = oModel.getProperty("/assignedProjects").find(function(p) {
                    return p.projectId === oNewEntry.projectId;
                });
                var oWorkType = oModel.getProperty("/workTypes").find(function(w) {
                    return w.type === oNewEntry.workType;
                });
                
                // Create a new entry object with all days set to 0
                var oTimeEntry = {
                    id: sNewId,
                    projectId: oNewEntry.projectId,
                    projectName: oProject ? oProject.projectName : "",
                    workType: oNewEntry.workType,
                    workTypeName: oWorkType ? oWorkType.name : "",
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 0,
                    sunday: 0,
                    comment: oNewEntry.taskDetails || "",
                    isApproved: false,
                    isFutureDay: false
                };
                
                // Set the hours for the selected day
                oTimeEntry[dayProperty] = hoursForDay;
                
                // Add the new entry to the array
                aEntries.push(oTimeEntry);
                oModel.setProperty("/timeEntries", aEntries);
            }
            
            // Update totals and refresh the table
            this._calculateAllTotals();
            this._updateCounts();
            this._updateProjectEngagement();
            this._updateReportsData();
            
            var oTable = this.getView().byId("timesheetTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
            
            MessageToast.show(existingEntryIndex !== -1 ? "Time entry updated successfully" : "Time entry added successfully");
            return true;
        },
        // Modified onSaveNewEntry function
        onSaveNewEntry: function() {
            if (this._saveTimeEntry()) {
                this._oAddEntryDialog.close();
            }
        },
        // New onSaveAndNewEntry function
        onSaveAndNewEntry: function() {
            if (this._saveTimeEntry()) {
                // Reset the form
                var oModel = this.getView().getModel();
                oModel.setProperty("/newEntry", {
                    selectedDate: this._formatDateForModel(new Date()),
                    projectId: "",
                    workType: "",
                    hours: "8", // Default hours value
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 0,
                    sunday: 0,
                    comment: "",
                    taskDetails: "" // Add taskDetails property
                });
                // Keep the dialog open for new entry
                MessageToast.show("Time entry saved. Ready for new entry.");
            }
        },
        onCancelNewEntry: function() {
            this._oAddEntryDialog.close();
        },
        onEditEntry: function(oEvent) {
            var oButton = oEvent.getSource();
            var oBindingContext = oButton.getBindingContext();
            if (!oBindingContext) return;
            var oEntry = oBindingContext.getObject();
            var oModel = this.getView().getModel();
            oModel.setProperty("/editEntry", JSON.parse(JSON.stringify(oEntry)));
            if (!this._oEditEntryDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "admin.com.admin.Fragments.EditTimeEntry",
                    controller: this
                }).then(function(oDialog) {
                    this._oEditEntryDialog = oDialog;
                    this.getView().addDependent(this._oEditEntryDialog);
                    this._oEditEntryDialog.open();
                }.bind(this));
            } else {
                this._oEditEntryDialog.open();
            }
        },
        onCancelEditEntry: function() {
            if (this._oEditEntryDialog) {
                this._oEditEntryDialog.close();
            }
        },
        onSaveEditedEntry: function() {
            var oModel = this.getView().getModel();
            var oEditEntry = oModel.getProperty("/editEntry");
            var aEntries = oModel.getProperty("/timeEntries");
            if (!oEditEntry.projectId || oEditEntry.projectId.trim() === "") {
                MessageBox.error("Please select a project");
                return;
            }
            if (!oEditEntry.workType || oEditEntry.workType.trim() === "") {
                MessageBox.error("Please select a work type");
                return;
            }
            var totalHours = parseFloat(oEditEntry.monday || 0) +
                parseFloat(oEditEntry.tuesday || 0) +
                parseFloat(oEditEntry.wednesday || 0) +
                parseFloat(oEditEntry.thursday || 0) +
                parseFloat(oEditEntry.friday || 0) +
                parseFloat(oEditEntry.saturday || 0) +
                parseFloat(oEditEntry.sunday || 0);
            if (totalHours === 0) {
                MessageBox.error("Please enter hours for at least one day");
                return;
            }
            var iIndex = aEntries.findIndex(function(entry) {
                return entry.id === oEditEntry.id;
            });
            if (iIndex > -1) {
                if (aEntries[iIndex].isApproved) {
                    this._notifyManagerOfChange(aEntries[iIndex], "Time entry modified");
                }
                var oProject = oModel.getProperty("/assignedProjects").find(function(p) {
                    return p.projectId === oEditEntry.projectId;
                });
                var oWorkType = oModel.getProperty("/workTypes").find(function(w) {
                    return w.type === oEditEntry.workType;
                });
                oEditEntry.projectName = oProject ? oProject.projectName : "";
                oEditEntry.workTypeName = oWorkType ? oWorkType.name : "";
                Object.keys(oEditEntry).forEach(function(key) {
                    aEntries[iIndex][key] = oEditEntry[key];
                });
                oModel.setProperty("/timeEntries", aEntries);
                this._calculateAllTotals();
                this._updateProjectEngagement();
                this._updateReportsData();
                var oTable = this.getView().byId("timesheetTable");
                if (oTable && oTable.getBinding("items")) {
                    oTable.getBinding("items").refresh();
                }
                this._oEditEntryDialog.close();
                MessageToast.show("Time entry updated successfully");
            }
        },
        onDeleteEntry: function(oEvent) {
            var oContext = oEvent.getParameter("listItem").getBindingContext();
            if (!oContext) return;
            var oEntry = oContext.getObject();
            if (oEntry.isApproved) {
                MessageBox.warning("Cannot delete approved entry. Please contact your manager.");
                return;
            }
            MessageBox.confirm("Are you sure you want to delete this time entry?", {
                title: "Delete Entry",
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        var oModel = this.getView().getModel();
                        var aEntries = oModel.getProperty("/timeEntries");
                        var iIndex = aEntries.findIndex(function(entry) {
                            return entry.id === oEntry.id;
                        });
                        if (iIndex > -1) {
                            aEntries.splice(iIndex, 1);
                            oModel.setProperty("/timeEntries", aEntries);
                            this._calculateAllTotals();
                            this._updateCounts();
                            this._updateProjectEngagement();
                            this._updateReportsData();
                            var oTable = this.getView().byId("timesheetTable");
                            if (oTable && oTable.getBinding("items")) {
                                oTable.getBinding("items").refresh();
                            }
                            MessageToast.show("Time entry deleted");
                        }
                    }
                }.bind(this)
            });
        },
        onHoursChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var sValue = oSource.getValue();
            if (sValue && (parseFloat(sValue) < 0 || parseFloat(sValue) > 24)) {
                MessageBox.alert("Hours must be between 0 and 24");
                oSource.setValue("0");
                return;
            }
            this._calculateAllTotals();
            this._validateDailyHours();
        },
        _calculateAllTotals: function() {
            var oModel = this.getView().getModel();
            var aEntries = oModel.getProperty("/timeEntries");
            var oTotals = {
                monday: 0,
                tuesday: 0,
                wednesday: 0,
                thursday: 0,
                friday: 0,
                saturday: 0,
                sunday: 0
            };
            aEntries.forEach(function(oEntry) {
                oTotals.monday += parseFloat(oEntry.monday) || 0;
                oTotals.tuesday += parseFloat(oEntry.tuesday) || 0;
                oTotals.wednesday += parseFloat(oEntry.wednesday) || 0;
                oTotals.thursday += parseFloat(oEntry.thursday) || 0;
                oTotals.friday += parseFloat(oEntry.friday) || 0;
                oTotals.saturday += parseFloat(oEntry.saturday) || 0;
                oTotals.sunday += parseFloat(oEntry.sunday) || 0;
            });
            var fWeekTotal = Object.values(oTotals).reduce(function(sum, hours) {
                return sum + hours;
            }, 0);
            oModel.setProperty("/dailyTotals", oTotals);
            oModel.setProperty("/totalWeekHours", fWeekTotal.toFixed(2));
            this._updateProjectEngagement();
        },
        _updateProjectEngagement: function() {
            var oModel = this.getView().getModel();
            var aEntries = oModel.getProperty("/timeEntries");
            var aProjects = oModel.getProperty("/assignedProjects");
            var aEngagement = [];
            aProjects.forEach(function(oProject) {
                var aProjectEntries = aEntries.filter(function(oEntry) {
                    return oEntry.projectId === oProject.projectId;
                });
                var fTotalHours = aProjectEntries.reduce(function(total, oEntry) {
                    return total + (parseFloat(oEntry.monday) || 0) +
                        (parseFloat(oEntry.tuesday) || 0) +
                        (parseFloat(oEntry.wednesday) || 0) +
                        (parseFloat(oEntry.thursday) || 0) +
                        (parseFloat(oEntry.friday) || 0) +
                        (parseFloat(oEntry.saturday) || 0) +
                        (parseFloat(oEntry.sunday) || 0);
                }, 0);
                aEngagement.push({
                    projectName: oProject.projectName,
                    managerName: oProject.managerName,
                    totalHours: fTotalHours.toFixed(2),
                    engagementDuration: this._calculateEngagementDuration(oProject.startDate, oProject.endDate),
                    status: oProject.status
                });
            }.bind(this));
            oModel.setProperty("/projectEngagement", aEngagement);
        },
        _updateReportsData: function() {
            var oModel = this.getView().getModel();
            var aEntries = oModel.getProperty("/timeEntries");
            var aProjects = oModel.getProperty("/assignedProjects");
            var today = new Date("2025-10-27T07:28:00Z");
            // Booked Hours Overview
            var aEmployeeProjectHours = aProjects.map(function(project) {
                var aProjectEntries = aEntries.filter(function(entry) {
                    return entry.projectId === project.projectId;
                });
                var bookedHours = aProjectEntries.reduce(function(total, entry) {
                    return total + (parseFloat(entry.monday) || 0) +
                        (parseFloat(entry.tuesday) || 0) +
                        (parseFloat(entry.wednesday) || 0) +
                        (parseFloat(entry.thursday) || 0) +
                        (parseFloat(entry.friday) || 0) +
                        (parseFloat(entry.saturday) || 0) +
                        (parseFloat(entry.sunday) || 0);
                }, 0);
                var utilization = project.allocatedHours > 0 ? Math.round((bookedHours / project.allocatedHours) * 100) : 0;
                return {
                    projectName: project.projectName,
                    allocatedHours: project.allocatedHours,
                    bookedHours: bookedHours,
                    remainingHours: project.allocatedHours - bookedHours,
                    utilization: utilization
                };
            });
            oModel.setProperty("/employeeProjectHours", aEmployeeProjectHours);
            // Project Engagement Duration
            var aEmployeeProjectDurations = aProjects.map(function(project) {
                var startDate = new Date(project.startDate);
                var endDate = new Date(project.endDate);
                var durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                var daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                var timelineStatus = project.status === "Completed" ? "Completed" :
                    project.status === "On Hold" ? "On Hold" :
                    daysRemaining < 0 ? "Delayed" :
                    daysRemaining < 14 ? "At Risk" : "On Track";
                return {
                    projectName: project.projectName,
                    startDate: project.startDate,
                    endDate: project.endDate,
                    durationDays: durationDays,
                    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
                    timelineStatus: timelineStatus
                };
            });
            oModel.setProperty("/employeeProjectDurations", aEmployeeProjectDurations);
        },
        _calculateEngagementDuration: function(sStartDate, sEndDate) {
            var oStart = new Date(sStartDate);
            var oEnd = new Date(sEndDate);
            var iMonths = (oEnd.getFullYear() - oStart.getFullYear()) * 12 +
                (oEnd.getMonth() - oStart.getMonth());
            if (iMonths === 0) {
                var iDays = Math.floor((oEnd - oStart) / (1000 * 60 * 60 * 24));
                return iDays + " days";
            } else if (iMonths < 12) {
                return iMonths + " months";
            } else {
                var iYears = Math.floor(iMonths / 12);
                var iRemainingMonths = iMonths % 12;
                return iYears + " year" + (iYears > 1 ? "s" : "") +
                    (iRemainingMonths > 0 ? " " + iRemainingMonths + " months" : "");
            }
        },
        _validateDailyHours: function() {
            var oModel = this.getView().getModel();
            var oTotals = oModel.getProperty("/dailyTotals");
            var oWeekDates = oModel.getProperty("/weekDates");
            var today = new Date("2025-10-27T07:28:00Z");
            var aWarnings = [];
            Object.keys(oTotals).forEach(function(sDay) {
                var fHours = oTotals[sDay];
                var sDateKey = sDay + "IsFuture";
                var isFutureDay = oWeekDates[sDateKey];
                if (!isFutureDay && fHours < 8 && fHours > 0) {
                    aWarnings.push(sDay + " has only " + fHours.toFixed(2) + " hours (minimum 8 required)");
                }
            });
            if (aWarnings.length > 0) {
                console.warn("Hours validation warnings:", aWarnings);
            }
        },
        onProjectSelect: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oProject = oSelectedItem.getBindingContext().getObject();
                MessageToast.show("Selected project: " + oProject.projectName + " (Manager: " + oProject.managerName + ")");
            }
        },
        onProjectChange: function(oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedKey");
            var oEntry = oEvent.getSource().getBindingContext().getObject();
            if (oEntry.isApproved) {
                this._notifyManagerOfChange(oEntry, "Project changed to: " + sSelectedKey);
            }
            this._calculateAllTotals();
            this._updateProjectEngagement();
            this._updateReportsData();
        },
        onWorkTypeChange: function(oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedKey");
            var oEntry = oEvent.getSource().getBindingContext().getObject();
            if (oEntry.isApproved) {
                this._notifyManagerOfChange(oEntry, "Work type changed to: " + sSelectedKey);
            }
            this._calculateAllTotals();
            this._updateProjectEngagement();
            this._updateReportsData();
        },
        _notifyManagerOfChange: function(oEntry, sChangeDescription) {
            MessageBox.information("Change notification sent to manager: " + sChangeDescription);
            console.log("Manager notified of change:", sChangeDescription, oEntry);
        },
        onSaveDraft: function() {
            this._calculateAllTotals();
            this._updateCounts();
            this._updateProjectEngagement();
            this._updateReportsData();
            var oModel = this.getView().getModel();
            var iEntries = oModel.getProperty("/timeEntries").length;
            var fTotalHours = oModel.getProperty("/totalWeekHours");
            MessageToast.show("Timesheet saved successfully! " + iEntries + " entries, " + fTotalHours + " total hours");
            this.getView().byId("timesheetTable").getBinding("items").refresh();
        },
        onSubmitApproval: function() {
            if (this._validateTimesheet()) {
                MessageBox.confirm("Are you sure you want to submit this timesheet for approval? Once submitted, changes will require manager approval.", {
                    title: "Submit for Approval",
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            var oModel = this.getView().getModel();
                            var aEntries = oModel.getProperty("/timeEntries");
                            aEntries.forEach(function(oEntry) {
                                oEntry.isApproved = true;
                            });
                            oModel.setProperty("/isSubmitted", true);
                            oModel.setProperty("/timeEntries", aEntries);
                            MessageToast.show("Timesheet submitted for approval");
                            this._updateProjectEngagement();
                            this._updateCounts();
                            this._updateReportsData();
                            this.getView().byId("timesheetTable").getBinding("items").refresh();
                            var oTimesheetData = {
                                currentWeek: oModel.getProperty("/currentWeek"),
                                totalWeekHours: oModel.getProperty("/totalWeekHours"),
                                isSubmitted: oModel.getProperty("/isSubmitted"),
                                timeEntriesCount: oModel.getProperty("/timeEntriesCount"),
                                commentsCount: oModel.getProperty("/commentsCount"),
                                timeEntries: oModel.getProperty("/timeEntries"),
                                dailyTotals: oModel.getProperty("/dailyTotals"),
                                dailyComments: oModel.getProperty("/dailyComments"),
                                assignedProjects: oModel.getProperty("/assignedProjects"),
                                workTypes: oModel.getProperty("/workTypes")
                            };
                            if (this._oRouter) {
                                this._oRouter.navTo("admin", {
                                    timesheetData: encodeURIComponent(JSON.stringify(oTimesheetData))
                                });
                            } else {
                                var oHashChanger = sap.ui.core.routing.HashChanger.getInstance();
                                oHashChanger.setHash("/admin");
                                MessageToast.show("Timesheet submitted. Navigation to admin page completed.");
                            }
                        }
                    }.bind(this)
                });
            }
        },
        _validateTimesheet: function() {
            var oModel = this.getView().getModel();
            var oTotals = oModel.getProperty("/dailyTotals");
            var oWeekDates = oModel.getProperty("/weekDates");
            var aEntries = oModel.getProperty("/timeEntries");
            var bIsValid = true;
            var aWarnings = [];
            var aErrors = [];
            aEntries.forEach(function(oEntry, index) {
                if (!oEntry.projectId || oEntry.projectId.trim() === "") {
                    aErrors.push("Entry " + (index + 1) + ": Project is mandatory.");
                }
                if (!oEntry.workType || oEntry.workType.trim() === "") {
                    aErrors.push("Entry " + (index + 1) + ": Work Type is mandatory.");
                }
                if (parseFloat(oEntry.monday) === 0 && parseFloat(oEntry.tuesday) === 0 &&
                    parseFloat(oEntry.wednesday) === 0 && parseFloat(oEntry.thursday) === 0 &&
                    parseFloat(oEntry.friday) === 0 && parseFloat(oEntry.saturday) === 0 &&
                    parseFloat(oEntry.sunday) === 0) {
                    aErrors.push("Entry " + (index + 1) + ": At least one day's hours must be entered.");
                }
            });
            Object.keys(oTotals).forEach(function(sDay) {
                var fHours = oTotals[sDay];
                var sDateKey = sDay + "IsFuture";
                var isFutureDay = oWeekDates[sDateKey];
                if (!isFutureDay && fHours < 8 && fHours > 0) {
                    aWarnings.push(sDay + " has only " + fHours.toFixed(2) + " hours (minimum 8 required for past dates)");
                }
                if (fHours > 24) {
                    bIsValid = false;
                    aErrors.push(sDay + " has more than 24 hours. Please correct the entries.");
                    return false;
                }
            });
            if (aErrors.length > 0) {
                MessageBox.error(aErrors.join("\n"), {
                    title: "Validation Errors",
                    onClose: function() {
                        bIsValid = false;
                    }
                });
                return false;
            }
            if (aWarnings.length > 0) {
                MessageBox.warning(aWarnings.join("\n") + "\n\nYou can still submit, but please ensure you meet the 8-hour requirement for past dates.", {
                    title: "Validation Warnings",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.CANCEL) {
                            bIsValid = false;
                        }
                    }
                });
            }
            return bIsValid;
        },
        onViewReports: function() {
            var oModel = this.getView().getModel();
            var aEngagement = oModel.getProperty("/projectEngagement");
            var sReport = "Progress Reports:\n\n";
            aEngagement.forEach(function(oProject) {
                sReport += "Project: " + oProject.projectName + "\n";
                sReport += "Manager: " + oProject.managerName + "\n";
                sReport += "Total Hours: " + oProject.totalHours + "\n";
                sReport += "Duration: " + oProject.engagementDuration + "\n";
                sReport += "Status: " + oProject.status + "\n\n";
            });
            MessageBox.information(sReport);
        },
        onPreviousWeekTS: function() {
            var oModel = this.getView().getModel();
            var oWeekDates = oModel.getProperty("/weekDates");
            var mondayDate = new Date(oWeekDates.monday);
            mondayDate.setDate(mondayDate.getDate() - 7);
            this._updateWeekDates(mondayDate);
            // Update the selected date to the Monday of the new week
            oModel.setProperty("/selectedDate", this._formatDateForModel(mondayDate));
            MessageToast.show("Navigated to previous week");
        },
        onCurrentWeekTS: function() {
            var today = new Date("2025-10-27T07:28:00Z");
            this._updateWeekDates(today);
            // Update the selected date to today
            var oModel = this.getView().getModel();
            oModel.setProperty("/selectedDate", this._formatDateForModel(today));
            MessageToast.show("Navigated to current week");
        },
        onNextWeekTS: function() {
            var oModel = this.getView().getModel();
            var oWeekDates = oModel.getProperty("/weekDates");
            var mondayDate = new Date(oWeekDates.monday);
            mondayDate.setDate(mondayDate.getDate() + 7);
            this._updateWeekDates(mondayDate);
            // Update the selected date to the Monday of the new week
            oModel.setProperty("/selectedDate", this._formatDateForModel(mondayDate));
            MessageToast.show("Navigated to next week");
        },
        onDatePickerChange: function(oEvent) {
            var sDate = oEvent.getParameter("value");
            if (sDate) {
                var selectedDate = new Date(sDate);
                this._updateWeekDates(selectedDate);
                MessageToast.show("Week updated for selected date: " + sDate);
            }
        },
        onPreviousWeek: function() {
            this.onPreviousWeekTS();
        },
        onNextWeek: function() {
            this.onNextWeekTS();
        },
        onToday: function() {
            this.onCurrentWeekTS();
        },
        onSettingsPress: function() {
            MessageBox.information("Timesheet Settings:\n\n- Working hours: 8 hours/day\n- Future bookings allowed for Leave/Training only\n- Manager notifications for approved entry changes");
        },
        onLogoutPress: function() {
            MessageBox.confirm("Are you sure you want to logout?", {
                title: "Logout",
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        MessageToast.show("Logged out successfully");
                    }
                }
            });
        }
    });
});