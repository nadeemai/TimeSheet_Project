sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Text",
  "sap/m/VBox",
  "sap/m/Input",
  "sap/m/Label",
  "sap/m/Select",
  "sap/ui/core/Item",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/core/Fragment",
  "sap/m/StandardListItem",
  "sap/m/List",
  "sap/m/Slider",
  "sap/m/MultiComboBox",
  "sap/m/ProgressIndicator",
  "sap/m/ObjectNumber",
  "sap/m/ObjectStatus",
  "sap/m/DatePicker",
  "sap/m/GenericTile",
  "sap/m/TileContent",
  "sap/m/NumericContent",
  "sap/m/Panel",
  "sap/m/Toolbar",
  "sap/m/Title",
  "sap/m/ToolbarSpacer",
  "sap/m/SearchField",
  "sap/ui/table/Column",
  "sap/ui/table/Table",
  "sap/viz/ui5/controls/VizFrame",
  "sap/viz/ui5/data/FlattenedDataset",
  "sap/viz/ui5/data/DimensionDefinition",
  "sap/viz/ui5/data/MeasureDefinition",
  "sap/m/IconTabFilter",
  "sap/m/HBox",
  "sap/m/Image",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/model/FilterType"
], function (Controller, JSONModel, MessageToast, Dialog, Button, Text, VBox, Input, Label, Select, Item, Filter, FilterOperator, Fragment, StandardListItem, List, Slider, MultiComboBox, ProgressIndicator, ObjectNumber, ObjectStatus, DatePicker, GenericTile, TileContent, NumericContent, Panel, Toolbar, Title, ToolbarSpacer, SearchField, Column, Table, VizFrame, FlattenedDataset, DimensionDefinition, MeasureDefinition, IconTabFilter, HBox, Image, MessageBox, BusyIndicator, FilterType) {
  "use strict";

  return Controller.extend("manager.controller.Manager", {

    onInit: function () {
      // MAIN VIEW MODEL INITIALIZATION
      let oVM = new JSONModel({
        users: [], // employee list
        selectedEmployee: "", // selected emp ID
        selectedEmployeeName: "", // selected emp name
        currentWeekStart: this._getMonday(new Date()), // start of this week
        timesheetEntries: [], // table rows
        totalWeekHours: 0, // weekly total
        teamProgressReport: [],
        projectSummary: [],
        hasNoTimesheetData: false, // default
        selectedDate: this._formatDateForDatePicker(this._getMonday(new Date())),
        weekDays: [],
        projectsData: [], // Projects data with assigned employees
        searchAvailableEmployeeText: "", // Search text for available employees
        searchAssignedEmployeeText: "" // Search text for assigned employees
      });
      this.getView().setModel(oVM);

      // Initialize week days
      this._updateWeekDays(oVM.getProperty("/currentWeekStart"));

      // Load employees and projects
      this._loadEmployees();
      this._loadProjectsWithAssignments();

      this._loadReports()

      // Initialize selection tracking
      this._selectedEmployeesByProject = {};

      var storedEmployeeId = localStorage.getItem("selectedEmployeeId");
      if (storedEmployeeId) {
        oVM.setProperty("/selectedEmployee", storedEmployeeId);
      }
    },
    
    onSearchProject: function (oEvent) {
      var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
      var oVBox = this.byId("projectVBox");
      var oBinding = oVBox.getBinding("items");
 
      if (sQuery) {
        var oFilter = new sap.ui.model.Filter({
          path: "projectName",
          operator: sap.ui.model.FilterOperator.Contains,
          value1: sQuery,
          caseSensitive: false
        });
        oBinding.filter([oFilter]);
      } else {
        oBinding.filter([]);
      }
    },

    onAssignProject: function() {
      // Create a dialog if it doesn't exist yet
      if (!this._oAssignProjectDialog) {
        this._oAssignProjectDialog = sap.ui.xmlfragment(
          this.createId("assignProjectDialogFrag"),
          "manager.Fragments.AssignProjectDialog",
          this
        );
        this.getView().addDependent(this._oAssignProjectDialog);
      }
      
      // Create a model for the dialog
      let oDialogModel = new JSONModel({
        projects: [],
        employees: [],
        selectedProject: "",
        selectedEmployee: "",
        searchProject: "",
        searchEmployee: ""
      });
      this._oAssignProjectDialog.setModel(oDialogModel);
      
      // Load projects and employees
      this._loadProjectsForAssignment(oDialogModel);
      this._loadEmployeesForAssignment(oDialogModel);
      
      // Clear previous selections
      oDialogModel.setProperty("/selectedProject", "");
      oDialogModel.setProperty("/selectedEmployee", "");
      
      // Open the dialog
      this._oAssignProjectDialog.open();
    },

 _loadReports: function () {
    let oReportModel = this.getOwnerComponent().getModel("timesheetServiceV2");
    let oVM = this.getView().getModel();
    let that = this;

    sap.ui.core.BusyIndicator.show(0)

    oReportModel.read("/TeamProgressReport", {
        success: function (oData) {
            let raw = oData.results || [];

            // Format and prepare final model
            let formatted = that._formatTeamProgressReport(raw);

            // Save to JSON model
            oVM.setProperty("/teamProgressReport", formatted);
            sap.ui.core.BusyIndicator.hide()
        },
        error: function (oError) {
            console.error("Failed to load report:", oError);
            sap.ui.core.BusyIndicator.hide();
        }
    });


    oReportModel.read("/ProjectSummary", {
      success: function(oData){
        let rawData = oData.results || [];

        //Format Project Summary Model 
        let formatted = that._formatProjectSummaryReport(rawData)

        oVM.setProperty("/projectSummary", formatted);
      },
      error: function(oError){
        console.log("Failed To Load Project Summart", oError)
      }
    })

    
},
_formatTeamProgressReport: function (rows) {
    return rows.map(r => ({
        id: r.ID,
        employeeName: r.employeeName || "",
        empID: r.empID || "",
        projectName: r.projectName || "",
        projectRole: r.projectRole || "",
        task: r.task || "",
        allocatedHours: Number(r.allocatedHours || 0),
        totalBookedHours: Number(r.bookedHours || 0),
        remainingHours : Number(r.remainingHours || 0),
        utilization: (r.utilization || 0),
        weekStartDate: this._formatDate(r.weekStartDate),
        weekEndDate: this._formatDate(r.weekEndDate),
        status: r.status || ""
    }));
},

_formatProjectSummaryReport: function(rowsData) {
  return rowsData.map(r => ({
    projectID: r.projectID || "",
    projID: r.projID || "",
    projectName: r.projectName || "",
    projectRole: r.projectRole || "",
    allocatedHours: Number(r.allocatedHours || 0),
    startDate: this._formatDate(r.startDate),
    endDate: this._formatDate(r.endDate),
    duration: Number(r.duration || 0),
    remainingDays: Number(r.remainingDays || 0),
    status: r.status || ""
  }));
},

// Helper for date formatting
_formatDate: function (d) {
    if (!d) return "";
    let date = new Date(d);
    return date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
},

 onTabSelect: function (oEvent) {
            var selectedKey = oEvent.getParameter("key");

            if (selectedKey === "reportsTab") {
                console.log("Reports tab activated → refreshing data");

                // var oModel = this.getOwnerComponent().getModel("adminService");
                // var oView = this.getView();

                sap.ui.core.BusyIndicator.show();

                this._loadReports();

                setTimeout(() => {
                    sap.ui.core.BusyIndicator.hide();
                }, 800);
            }
        },

    // Function to load projects for assignment
    _loadProjectsForAssignment: function(oDialogModel) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      
      BusyIndicator.show(0);
      oModel.read("/MyProjects", {
        success: (oData) => {
          BusyIndicator.hide();
          let projects = oData.results || [];
          
          // Format projects properly
          projects = projects.map(p => ({
            id: p.projectID || p.ID,
            name: p.projectName || p.name || "Unnamed Project",
            description: p.description || ""
          }));
          
          oDialogModel.setProperty("/projects", projects);
          console.log("Projects loaded for assignment:", projects);
        },
        error: (oError) => {
          BusyIndicator.hide();
          MessageBox.error("Failed to load projects.");
          console.error("Error loading projects:", oError);
        }
      });
    },

    // Function to load employees for assignment
    _loadEmployeesForAssignment: function(oDialogModel) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      
      BusyIndicator.show(0);
      oModel.read("/MyTeam", {
        success: (oData) => {
          BusyIndicator.hide();
          let employees = oData.results || oData.value || [];
          
          // Filter to only show active employees
          employees = employees
            .filter(e => e.isActive !== false)
            .map(e => ({
              employeeID: e.employeeID || e.ID,
              fullName: `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Unknown Employee",
              firstName: e.firstName || "",
              lastName: e.lastName || "",
              isActive: e.isActive,
              email: e.email || ""
            }));
          
          oDialogModel.setProperty("/employees", employees);
          console.log("Employees loaded for assignment:", employees);
        },
        error: (oError) => {
          BusyIndicator.hide();
          MessageBox.error("Failed to load employees.");
          console.error("Error loading employees:", oError);
        }
      });
    },

    // Function to confirm project assignment
    onAssignProjectConfirm: function() {
      let oDialogModel = this._oAssignProjectDialog.getModel();
      let sProjectId = oDialogModel.getProperty("/selectedProject");
      let sEmployeeId = oDialogModel.getProperty("/selectedEmployee");
      
      if (!sProjectId || !sEmployeeId) {
        MessageToast.show("Please select both a project and an employee.");
        return;
      }
      
      // Get project and employee details
      let aProjects = oDialogModel.getProperty("/projects");
      let aEmployees = oDialogModel.getProperty("/employees");
      
      let oProject = aProjects.find(p => p.id === sProjectId);
      let oEmployee = aEmployees.find(e => e.employeeID === sEmployeeId);
      
      if (!oProject || !oEmployee) {
        MessageToast.show("Invalid selection. Please try again.");
        return;
      }
      
      // Show confirmation
      MessageBox.confirm(
        `Assign ${oEmployee.fullName} to ${oProject.name}?`,
        {
          onClose: (sAction) => {
            if (sAction === MessageBox.Action.OK) {
              this._assignProjectToEmployee(oProject, oEmployee);
            }
          }
        }
      );
    },

    // Function to cancel project assignment
    onAssignProjectCancel: function() {
      this._oAssignProjectDialog.close();
    },

    // Function to actually assign project to employee
    _assignProjectToEmployee: function(oProject, oEmployee) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let that = this;
      
      BusyIndicator.show(0);
      
      // Create assignment payload
      let oPayload = {
        projectID: oProject.id,
        employeeID: oEmployee.employeeID
        // assignmentDate: new Date().toISOString().split('T')[0],
        // status: "Assigned"
      };
      
      console.log("Creating assignment with payload:", oPayload);
      
      // Create the assignment in the backend
      oModel.create("/assignProjectToEmployee", oPayload, {
        success: function(oData) {
          BusyIndicator.hide();
          MessageToast.show(`Successfully assigned ${oEmployee.fullName} to ${oProject.name}`);
          console.log("Assignment successful:", oData);
          
          // Close the dialog
          that._oAssignProjectDialog.close();
          
          // Clear dialog selections
          let oDialogModel = that._oAssignProjectDialog.getModel();
          oDialogModel.setProperty("/selectedProject", "");
          oDialogModel.setProperty("/selectedEmployee", "");
          
          // Refresh the projects data IMMEDIATELY
          that._loadProjectsWithAssignments();
          
          // Also refresh the view to ensure UI updates
          setTimeout(function() {
            that.getView().getModel().refresh(true);
          }, 500);
        },
        error: function(oError) {
          BusyIndicator.hide();
          let sErrorMessage = oError.message || "Unknown error";
          console.error("Assignment error details:", oError);
          
          // Try to get more specific error message
          if (oError.response && oError.response.body) {
            try {
              let oErrorBody = JSON.parse(oError.response.body);
              sErrorMessage = oErrorBody.error && oErrorBody.error.message 
                ? oErrorBody.error.message 
                : sErrorMessage;
            } catch (e) {
              // If parsing fails, use the original message
            }
          }
          
          MessageBox.error("Failed to assign project: " + sErrorMessage);
        }
      });
    },

    // Load projects with their assigned employees
    _loadProjectsWithAssignments: function () {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let oViewModel = this.getView().getModel();

      if (!oModel) {
        MessageBox.error("OData model not found.");
        return;
      }

      BusyIndicator.show(0);

      // Read both projects and assignments in parallel
      Promise.all([
        new Promise((resolve, reject) => {
          oModel.read("/MyProjects", {
            success: resolve,
            error: reject
          });
        }),
        new Promise((resolve, reject) => {
          oModel.read("/AssignedProjects", {
            success: resolve,
            error: (err) => {
              // Don't reject on error, just return empty array
              resolve({results: []});
            }
          });
        })
      ])
      .then(([projectsData, assignmentsData]) => {
        let projects = projectsData.results || [];
        let assignments = assignmentsData.results || [];
        
        console.log("Projects loaded:", projects);
        console.log("Assignments loaded:", assignments);
        
        // Group assignments by project ID
        let assignmentsByProject = {};
        assignments.forEach(assignment => {
          let projectId = assignment.projectID;
          if (!assignmentsByProject[projectId]) {
            assignmentsByProject[projectId] = [];
          }
          assignmentsByProject[projectId].push({
            ID: assignment.ID,
            projectID: assignment.projectID,
            employeeID: assignment.employeeID,
            employeeName: assignment.employeeName || "Unknown Employee",
            assignmentDate: assignment.assignmentDate || new Date().toISOString().split('T')[0],
            status: assignment.status || "Assigned"
          });
        });

        // Enhance projects with assigned employees
        let enhancedProjects = projects.map(project => {
          let projectId = project.projectID || project.ID;
          let assignedEmployees = assignmentsByProject[projectId] || [];
          
          return {
            projectID: projectId,
            projectName: project.projectName || project.name || "Unnamed Project",
            description: project.description || "",
            status: project.status || "Active",
            assignedEmployees: assignedEmployees,
            assignedEmployeeIds: assignedEmployees.map(e => e.employeeID),
            totalAssigned: assignedEmployees.length
          };
        });

        oViewModel.setProperty("/projectsData", enhancedProjects);
        BusyIndicator.hide();
        
        console.log("Projects with assignments updated:", enhancedProjects);
        
        // Force refresh of UI bindings
        setTimeout(() => {
          oViewModel.refresh(true);
        }, 100);
      })
      .catch((oError) => {
        BusyIndicator.hide();
        MessageBox.error("Failed to load projects.");
        console.error("Error loading projects:", oError);
      });
    },

    // Load assignments for projects (alternative method)
    _loadAssignmentsForProjects: function (projectsData) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let oViewModel = this.getView().getModel();
      let that = this;

      oModel.read("/AssignedProjects", {
        success: function (oData) {
          let assignments = oData.results || [];
          console.log("All assignments loaded:", assignments);
          
          // Group assignments by project ID
          let assignmentsByProject = {};
          assignments.forEach(assignment => {
            let projectId = assignment.projectID;
            if (!assignmentsByProject[projectId]) {
              assignmentsByProject[projectId] = [];
            }
            assignmentsByProject[projectId].push({
              ID: assignment.ID,
              projectID: assignment.projectID,
              employeeID: assignment.employeeID,
              employeeName: assignment.employeeName || "Unknown Employee",
              assignmentDate: assignment.assignmentDate || new Date().toISOString().split('T')[0],
              status: assignment.status || "Assigned"
            });
          });

          // Enhance projects with assigned employees
          let enhancedProjects = projectsData.map(project => {
            let projectId = project.projectID || project.ID;
            let assignedEmployees = assignmentsByProject[projectId] || [];
            
            return {
              projectID: projectId,
              projectName: project.projectName || project.name || "Unnamed Project",
              description: project.description || "",
              status: project.status || "Active",
              assignedEmployees: assignedEmployees,
              assignedEmployeeIds: assignedEmployees.map(e => e.employeeID),
              totalAssigned: assignedEmployees.length
            };
          });

          oViewModel.setProperty("/projectsData", enhancedProjects);
          BusyIndicator.hide();
          
          console.log("Projects with assignments updated:", enhancedProjects);
          
          // Force refresh of UI bindings
          setTimeout(() => {
            oViewModel.refresh(true);
          }, 100);
        },
        error: function (oError) {
          BusyIndicator.hide();
          console.error("Error loading assignments:", oError);
          
          // If assignments fail, still show projects
          let enhancedProjects = projectsData.map(project => {
            let projectId = project.projectID || project.ID;
            return {
              projectID: projectId,
              projectName: project.projectName || project.name || "Unnamed Project",
              description: project.description || "",
              status: project.status || "Active",
              assignedEmployees: [],
              assignedEmployeeIds: [],
              totalAssigned: 0
            };
          });
          
          oViewModel.setProperty("/projectsData", enhancedProjects);
          
          setTimeout(() => {
            oViewModel.refresh(true);
          }, 100);
        }
      });
    },

    // Function to remove a project assignment
    onRemoveProjectAssignment: function(oEvent) {
      let oButton = oEvent.getSource();
      let oBindingContext = oButton.getBindingContext();
      
      if (!oBindingContext) {
        MessageToast.show("Unable to get binding context");
        return;
      }
      
      let oAssignment = oBindingContext.getObject();
      
      MessageBox.confirm(
        `Are you sure you want to remove ${oAssignment.employeeName} from this project?`,
        {
          onClose: function(sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._removeProjectAssignment(oAssignment);
            }
          }.bind(this)
        }
      );
    },

    // Function to actually remove project assignment
    _removeProjectAssignment: function(oAssignment) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let that = this;
      
      if (!oAssignment.ID) {
        MessageToast.show("Invalid assignment ID.");
        return;
      }
      
      BusyIndicator.show(0);
      
      // Remove the assignment in the backend
      oModel.remove("/AssignedProjects(" + oAssignment.ID + ")", {
        success: function() {
          BusyIndicator.hide();
          MessageToast.show("Project assignment removed successfully");
          
          // Refresh the projects data
          that._loadProjectsWithAssignments();
        },
        error: function(oError) {
          BusyIndicator.hide();
          MessageBox.error("Failed to remove project assignment: " + (oError.message || "Unknown error"));
          console.error("Remove assignment error:", oError);
        }
      });
    },

    // Formatter for assignment status
    formatAssignmentStatusState: function(sStatus) {
      if (!sStatus) return "None";
      
      switch (sStatus.toLowerCase()) {
        case "assigned":
          return "Success";
        case "in progress":
          return "Warning";
        case "completed":
          return "Information";
        case "cancelled":
          return "Error";
        default:
          return "None";
      }
    },

    // Helper to find parent panel
    _findParentPanel: function (oControl) {
      while (oControl && !(oControl instanceof Panel)) {
        oControl = oControl.getParent();
      }
      return oControl;
    },

    // Employee selection change handler in available employees list
    onEmployeeSelectionChange: function (oEvent) {
      let oList = oEvent.getSource();
      let oPanel = this._findParentPanel(oList);
      let oProjectContext = oPanel.getBindingContext();
      
      if (!oProjectContext) {
        MessageToast.show("Unable to get project context");
        return;
      }
      
      let sProjectId = oProjectContext.getObject().projectID || oProjectContext.getObject().ID;
      let aSelectedItems = oList.getSelectedItems();
      let aSelectedEmployeeIds = aSelectedItems.map(function (oItem) {
        let oContext = oItem.getBindingContext();
        return oContext ? oContext.getObject().userId : null;
      }).filter(function (sId) { return sId !== null; });
      
      // Store selected employees for this project
      if (!this._selectedEmployeesByProject) {
        this._selectedEmployeesByProject = {};
      }
      this._selectedEmployeesByProject[sProjectId] = aSelectedEmployeeIds;
      
      console.log("Selected employees for project", sProjectId, ":", aSelectedEmployeeIds);
    },

    // Assign selected employees to project (from panel)
    onAssignToProject: function (oEvent) {
      let oButton = oEvent.getSource();
      let oPanel = this._findParentPanel(oButton);
      let oProjectContext = oPanel.getBindingContext();
      
      if (!oProjectContext) {
        MessageToast.show("Unable to get project context");
        return;
      }
      
      let oProject = oProjectContext.getObject();
      let sProjectId = oProject.projectID || oProject.ID;
      let aSelectedEmployeeIds = (this._selectedEmployeesByProject && this._selectedEmployeesByProject[sProjectId]) || [];
      
      if (aSelectedEmployeeIds.length === 0) {
        MessageToast.show("Please select at least one employee to assign.");
        return;
      }
      
      // Get selected employees from users list
      let aUsers = this.getView().getModel().getProperty("/users");
      let aSelectedEmployees = aSelectedEmployeeIds.map(function (sId) {
        return aUsers.find(function (oUser) {
          return oUser.userId === sId;
        });
      }).filter(function (oEmp) { return oEmp !== undefined; });
      
      if (aSelectedEmployees.length === 0) {
        MessageToast.show("No valid employees selected.");
        return;
      }
      
      // Confirm assignment
      MessageBox.confirm(
        `Assign ${aSelectedEmployees.length} employee(s) to ${oProject.projectName}?`,
        {
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._assignMultipleEmployeesToProject(oProject, aSelectedEmployees);
            }
          }.bind(this)
        }
      );
    },

    // Actually assign multiple employees to project
    _assignMultipleEmployeesToProject: function (oProject, aSelectedEmployees) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let that = this;
      
      BusyIndicator.show(0);
      
      // Create array of promises for each assignment
      let aPromises = aSelectedEmployees.map(function (oEmployee) {
        return new Promise(function (resolve, reject) {
          let oPayload = {
            projectID: oProject.projectID || oProject.ID,
            employeeID: oEmployee.userId,
            employeeName: `${oEmployee.firstName} ${oEmployee.lastName}`,
            assignmentDate: new Date().toISOString().split('T')[0],
            status: "Assigned"
          };
          
          console.log("Creating assignment:", oPayload);
          
          oModel.create("/AssignedProjects", oPayload, {
            success: function (oData) {
              resolve(oData);
            },
            error: function (oError) {
              reject({ employee: oEmployee, error: oError });
            }
          });
        });
      });
      
      // Wait for all assignments to complete
      Promise.all(aPromises.map(p => p.catch(e => e)))
        .then(function (results) {
          BusyIndicator.hide();
          
          // Check for errors
          let errors = results.filter(r => r && r.error);
          if (errors.length > 0) {
            MessageToast.show(`Assigned ${aSelectedEmployees.length - errors.length} employees, ${errors.length} failed.`);
            console.error("Assignment errors:", errors);
          } else {
            MessageToast.show(`Successfully assigned ${aSelectedEmployees.length} employee(s) to project.`);
          }
          
          // Clear selection
          if (that._selectedEmployeesByProject) {
            that._selectedEmployeesByProject[oProject.projectID || oProject.ID] = [];
          }
          
          // Clear list selection
          let oPanel = that._findPanelByProjectId(oProject.projectID || oProject.ID);
          if (oPanel) {
            let oList = that._findAvailableEmployeesList(oPanel);
            if (oList) {
              oList.removeSelections();
            }
          }
          
          // Refresh project assignments
          that._loadProjectsWithAssignments();
        })
        .catch(function (oError) {
          BusyIndicator.hide();
          MessageBox.error("Failed to assign employees.");
          console.error("Multiple assignment error:", oError);
        });
    },

    // Helper to find panel by project ID
    _findPanelByProjectId: function (sProjectId) {
      let oView = this.getView();
      let aControls = oView.getContent();
      
      for (let i = 0; i < aControls.length; i++) {
        let oControl = aControls[i];
        if (oControl instanceof Panel) {
          let oBindingContext = oControl.getBindingContext();
          if (oBindingContext) {
            let oProject = oBindingContext.getObject();
            if ((oProject.projectID === sProjectId) || (oProject.ID === sProjectId)) {
              return oControl;
            }
          }
        }
      }
      return null;
    },

    // Helper to find available employees list in panel
    _findAvailableEmployeesList: function (oPanel) {
      if (!oPanel) return null;
      
      // Navigate to find the list - adjust based on your XML structure
      let oContent = oPanel.getContent();
      for (let i = 0; i < oContent.length; i++) {
        let oItem = oContent[i];
        if (oItem instanceof VBox || oItem instanceof HBox) {
          let oSubItems = oItem.getItems();
          for (let j = 0; j < oSubItems.length; j++) {
            if (oSubItems[j] instanceof List) {
              // Check if this is the available employees list
              if (oSubItems[j].getBindingPath("items") === "{/users}") {
                return oSubItems[j];
              }
            }
          }
        }
      }
      return null;
    },

    // Remove employee from project
    onRemoveFromProject: function (oEvent) {
      let oButton = oEvent.getSource();
      let oRow = oButton.getBindingContext();
      
      if (!oRow) {
        MessageToast.show("Unable to get binding context");
        return;
      }
      
      let oAssignment = oRow.getObject();
      let oPanel = this._findParentPanel(oButton);
      let oProjectContext = oPanel ? oPanel.getBindingContext() : null;
      
      let sProjectName = oProjectContext ? oProjectContext.getObject().projectName : "the project";
      
      MessageBox.confirm(
        `Remove ${oAssignment.employeeName} from ${sProjectName}?`,
        {
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._removeEmployeeFromProject(oAssignment);
            }
          }.bind(this)
        }
      );
    },

    // Actually remove employee from project
    _removeEmployeeFromProject: function (oAssignment) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let that = this;
      
      if (!oAssignment.ID) {
        MessageToast.show("Invalid assignment ID.");
        return;
      }
      
      BusyIndicator.show(0);
      
      // Delete the assignment
      oModel.remove("/AssignedProjects(" + oAssignment.ID + ")", {
        success: function () {
          BusyIndicator.hide();
          MessageToast.show("Employee removed from project");
          
          // Refresh project assignments
          that._loadProjectsWithAssignments();
        },
        error: function (oError) {
          BusyIndicator.hide();
          MessageBox.error("Failed to remove assignment: " + (oError.message || "Unknown error"));
          console.error("Remove error:", oError);
        }
      });
    },

    // Formatter for short date display
    formatShortDate: function (sDate) {
      if (!sDate) return "";
      let oDate = new Date(sDate);
      return oDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    // Formatter to filter available employees list
    filterAvailableEmployees: function (sName, sQuery) {
      if (!sQuery) return true;
      return sName.toLowerCase().includes(sQuery.toLowerCase());
    },

    // Formatter to filter assigned employees list
    filterAssignedEmployees: function (sName, sQuery) {
      if (!sQuery) return true;
      return sName.toLowerCase().includes(sQuery.toLowerCase());
    },

    // Keep all your existing methods from the original controller
    // They remain exactly the same...
    _getMonday: function (d) {
      d = new Date(d);
      let day = d.getDay(),
        diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      return new Date(d.setDate(diff));
    },

    _getWeekStart: function (date) {
      var d = new Date(date);
      var day = d.getDay();
      var diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    },

    _getWeekEnd: function (weekStart) {
      let end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return end;
    },

    _formatDateForOData: function (date) {
      if (!date) return "";
      return "/Date(" + date.getTime() + ")/";
    },

    _formatDateForDatePicker: function (oDate) {
      if (!oDate) return "";
      let year = oDate.getFullYear();
      let month = String(oDate.getMonth() + 1).padStart(2, '0');
      let day = String(oDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    _formatDay: function (date) {
      let options = { weekday: 'short', month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
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

    onDatePickerChange: function (oEvent) {
    

    let oDatePicker = oEvent.getSource();
    let dateValue = oDatePicker.getDateValue();

    if (!dateValue || isNaN(dateValue.getTime())) {
        BusyIndicator.hide();
        return;
    }

    
    dateValue = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());

    let oModel = this.getView().getModel();

    // Compute weekStart AFTER fixing date
    let weekStart = this._getWeekStart(dateValue);

    // Save weekStart in model
    oModel.setProperty("/currentWeekStart", weekStart);

    oModel.setProperty("/selectedDate", this._formatDateForDatePicker(dateValue));

    // Update labels
    this._updateWeekDays(weekStart);

    // Compute weekEnd (correct now)
    let weekEnd = this._getWeekEnd(weekStart);

    console.log("DatePicker changed:", {
        selectedDate: dateValue,
        weekStart,
        weekEnd
    });

    // Load timesheet data
    let employeeId = oModel.getProperty("/selectedEmployee");

    if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
    } else {
        MessageToast.show("Please select an employee first");
    }

    
},

    onProfilePress: function () {
      let oDataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let oView = this.getView();
      if (!oDataModel) {
        MessageBox.error("OData model not found.");
        return;
      }
      BusyIndicator.show(0);
      oDataModel.read("/MyManagerProfile", {
        success: (oData) => {
          BusyIndicator.hide();
          if (!oData?.results?.length) {
            MessageBox.warning("No profile data found.");
            return;
          }
          let p = oData.results[0];
          let oProfileModel = new JSONModel({
            profile: {
              employeeID: p.employeeID || "",
              firstName: p.firstName || "",
              lastName: p.lastName || "",
              email: p.email || "",
              managerName: p.managerName || "",
              managerEmail: p.managerEmail || "",
              activeStatus: p.isActive ? "Yes" : "No",
              changedBy: p.modifiedBy || "",
              userRole: p.roleName || ""
            }
          });
          if (!this._oProfileDialog) {
            this._oProfileDialog = sap.ui.xmlfragment(
              this.createId("profileDialogFrag"),
              "manager.Fragments.ProfileDialog",
              this
            );
            oView.addDependent(this._oProfileDialog);
          }
          this._oProfileDialog.setModel(oProfileModel, "view");
          this._oProfileDialog.open();
        },
        error: (oError) => {
          BusyIndicator.hide();
          MessageBox.error("Failed to load profile data.");
          console.error(oError);
        }
      });
    },

    onCloseProfileDialog: function () {
      if (this._oProfileDialog) {
        this._oProfileDialog.close();
      }
    },

    _loadAdminTimesheetData: function (employeeId, weekStart, weekEnd) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let oVM = this.getView().getModel();
      let that = this;
      BusyIndicator.show(0);

       let normalize = function(date) {
    if (!date) return "";

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;   // local YYYY-MM-DD
};
      let start = normalize(weekStart);
      let end = normalize(weekEnd);

      // Build filters
      let filters = [
        new Filter("employeeEmpID", FilterOperator.EQ, employeeId),
        new Filter("weekStartDate", FilterOperator.LE, start),
        new Filter("weekEndDate", FilterOperator.GE, end)
      ];

      oModel.read("/TeamTimesheets", {
        filters,
        success: function (oData) {
          let rows = oData.results || [];
          let valid = rows.filter(r =>
            r.employeeEmpID === employeeId &&
            normalize(r.weekStartDate) <= end &&
            normalize(r.weekEndDate) >= start
          );
          console.log("Filtered Timesheet:", valid);
          let formatted = that._formatAdminTimesheet(valid);
          oVM.setProperty("/timesheetEntries", formatted);
          let total = formatted.reduce((s, x) => s + x.totalHours, 0);
          oVM.setProperty("/totalWeekHours", total);
          BusyIndicator.hide();
        },
        error: function () {
          BusyIndicator.hide();
          MessageToast.show("Error loading timesheet.");
          oVM.setProperty("/timesheetEntries", []);
        }
      });
    },

    _formatAdminTimesheet: function (entries) {
      let num = v => Number(v || 0);
      return entries.map(item => {
        let finalProjectName =
          item.projectName && item.projectName.trim() !== ""
            ? item.projectName
            : (item.nonProjectTypeName || "Non-Project");
        return {
          // Backend ID for update operations
          ID: item.ID,
          employeeEmpID: item.employeeEmpID,
          weekStartDate: item.weekStartDate,
          weekEndDate: item.weekEndDate,

          // Display fields
          project: finalProjectName,
          task: item.task || "",
          monday: num(item.mondayHours),
          tuesday: num(item.tuesdayHours),
          wednesday: num(item.wednesdayHours),
          thursday: num(item.thursdayHours),
          friday: num(item.fridayHours),
          saturday: num(item.saturdayHours),
          sunday: num(item.sundayHours),
          mondayTaskDetails: item.mondayTaskDetails || "",
          tuesdayTaskDetails: item.tuesdayTaskDetails || "",
          wednesdayTaskDetails: item.wednesdayTaskDetails || "",
          thursdayTaskDetails: item.thursdayTaskDetails || "",
          fridayTaskDetails: item.fridayTaskDetails || "",
          saturdayTaskDetails: item.saturdayTaskDetails || "",
          sundayTaskDetails: item.sundayTaskDetails || "",
          totalHours:
            num(item.mondayHours) +
            num(item.tuesdayHours) +
            num(item.wednesdayHours) +
            num(item.thursdayHours) +
            num(item.fridayHours) +
            num(item.saturdayHours) +
            num(item.sundayHours),
          // Status field
          status: item.status || "Draft"
        };
      });
    },

    // New formatter for status state
    formatStatusState: function (sStatus) {
      if (!sStatus) return "None";

      switch (sStatus.toLowerCase()) {
        case "approved":
          return "Success";
        case "rejected":
          return "Error";
        case "submitted":
          return "Warning";
        default:
          return "None";
      }
    },

    // New function to update timesheet status
    _updateTimesheetStatus: function (entryId, newStatus) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let oVM = this.getView().getModel();
      let that = this;

      BusyIndicator.show(0);

      // Update the status in the backend
      oModel.update("/TeamTimesheets(" + entryId + ")", {
        status: newStatus
      }, {
        success: function () {
          BusyIndicator.hide();
          MessageToast.show("Timesheet status updated to " + newStatus);

          // Refresh the data
          let employeeId = oVM.getProperty("/selectedEmployee");
          let weekStart = oVM.getProperty("/currentWeekStart");
          let weekEnd = that._getWeekEnd(weekStart);
          that._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
        },
        error: function (oError) {
          BusyIndicator.hide();
          MessageBox.error("Failed to update timesheet status: " + (oError.message || "Unknown error"));
        }
      });
    },

    // Handler for Approve button
    onApproveTimesheet: function (oEvent) {
      let oButton = oEvent.getSource();
      let oBindingContext = oButton.getBindingContext();

      if (!oBindingContext) {
        MessageToast.show("Unable to get binding context");
        return;
      }

      let oEntry = oBindingContext.getObject();
      let entryId = oEntry.ID;

      if (!entryId) {
        MessageToast.show("Invalid timesheet entry");
        return;
      }

      // Show confirmation dialog
      MessageBox.confirm(
        "Are you sure you want to approve this timesheet?",
        {
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._updateTimesheetStatus(entryId, "Approved");
            }
          }.bind(this)
        }
      );
    },

    // Handler for Reject button
    onRejectTimesheet: function (oEvent) {
      let oButton = oEvent.getSource();
      let oBindingContext = oButton.getBindingContext();

      if (!oBindingContext) {
        MessageToast.show("Unable to get binding context");
        return;
      }

      let oEntry = oBindingContext.getObject();
      let entryId = oEntry.ID;

      // Show dialog (no reason sent to backend)
      if (!this._oRejectDialog) {
        this._oRejectDialog = new sap.m.Dialog({
          title: "Reject Timesheet",
          type: "Message",
          content: [
            new sap.m.Text({ text: "Are you sure you want to reject this timesheet?" })
          ],
          beginButton: new sap.m.Button({
            text: "Reject",
            type: "Reject",
            press: function () {
              this._updateTimesheetStatus(entryId, "Rejected");
              this._oRejectDialog.close();
            }.bind(this)
          }),
          endButton: new sap.m.Button({
            text: "Cancel",
            press: function () {
              this._oRejectDialog.close();
            }
          })
        });
        this.getView().addDependent(this._oRejectDialog);
      }

      this._oRejectDialog.open();
    },

    _loadEmployees: function () {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let that = this;
      let oVM = this.getView().getModel();
      BusyIndicator.show(0);
      oModel.read("/MyTeam", {
        success: function (oData) {
          let list = oData.value || oData.results || [];
          // Normalize employees
          let users = that._formatEmployeeData(list);
          // Only employees
          let allowed = ["Employee"];
          let filtered = users.filter(u => allowed.includes(u.roleName));
          oVM.setProperty("/users", filtered);

          // Load timesheet data for ALL employees
          that._markEmployeesWithTimesheetStatus(filtered);
          BusyIndicator.hide();
        },
        error: function () {
          BusyIndicator.hide();
          MessageToast.show("Failed to load employees.");
        }
      });
    },

    _markEmployeesWithTimesheetStatus: function (employees) {
      let oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      let oVM = this.getView().getModel();
      let that = this;
      let weekStart = oVM.getProperty("/currentWeekStart");
      let weekEnd = this._getWeekEnd(weekStart);
      let normalize = d => d ? new Date(d).toISOString().split("T")[0] : "";
      let start = normalize(weekStart);
      let end = normalize(weekEnd);

      oModel.read("/TeamTimesheets", {
        success: function (oData) {
          let rows = oData.results || [];
          let valid = rows.filter(r =>
            normalize(r.weekStartDate) <= end &&
            normalize(r.weekEndDate) >= start
          );
          // Match Timesheet.employeeEmpID with Employee.userId
          let employeesWithEntries = new Set(valid.map(r => r.employeeEmpID));
          employees.forEach(emp => {
            emp.hasNoTimesheetData = !employeesWithEntries.has(emp.userId);
          });
          oVM.setProperty("/users", employees);
          oVM.refresh(true);
        },
        error: function () {
          // If error, mark all as having no data
          employees.forEach(emp => {
            emp.hasNoTimesheetData = true;
          });
          oVM.setProperty("/users", employees);
        }
      });
    },

    _formatEmployeeData: function (aEmployees) {
      // First pass: Normalize all user records
      let aFormattedUsers = aEmployees.map(function (employee) {
        // ROLE MAPPING
        let role =
          employee.roleName ||
          employee.Role ||
          employee.role ||
          employee.accessLevel ||
          "Employee";
        // Normalize role text
        role = role.toLowerCase().includes("admin") ?
          "Admin" :
          role.toLowerCase().includes("manager") ?
            "Manager" :
            "Employee";

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

      // SECOND PASS: FIX MANAGER NAMES
      aFormattedUsers.forEach(function (user) {
        if (user.managerId) {
          let mgr = aFormattedUsers.find(m => m.userId === user.managerId);
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

    onEmployeeListSelect: function (oEvent) {
      let oItem = oEvent.getParameter("listItem");
      let oCtx = oItem.getBindingContext(); // Main model context
      if (!oCtx) {
        console.warn("No binding context found for employee list item.");
        return;
      }
      let employeeId = oCtx.getProperty("userId");
      let first = oCtx.getProperty("firstName") || "";
      let last = oCtx.getProperty("lastName") || "";
      let employeeName = first + " " + last;
      let oVM = this.getView().getModel();

      // Update selected user
      oVM.setProperty("/selectedEmployee", employeeId);
      oVM.setProperty("/selectedEmployeeName", employeeName);

      // Save selection
      localStorage.setItem("selectedEmployeeId", employeeId);

      // Load week time entries for selected employee
      let weekStart = oVM.getProperty("/currentWeekStart");
      let weekEnd = this._getWeekEnd(weekStart);
      this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
    },

    onSearchEmployee: function (oEvent) {
      let sQuery = oEvent.getParameter("newValue")?.toLowerCase() || "";
      let oList = this.byId("employeeList");
      let oBinding = oList.getBinding("items");
      if (!oBinding) return;

      // Multi-field filter (firstName + lastName)
      let oFilter = new Filter({
        filters: [
          new Filter("firstName", FilterOperator.Contains, sQuery),
          new Filter("lastName", FilterOperator.Contains, sQuery)
        ],
        and: false // OR logic — match either
      });
      if (sQuery) {
        oBinding.filter([oFilter]);
      } else {
        oBinding.filter([]); // reset filter
      }
    },

    // New formatter for project status
    formatProjectStatusState: function (sStatus) {
      if (!sStatus) return "None";

      switch (sStatus.toLowerCase()) {
        case "active":
        case "in progress":
          return "Success";
        case "completed":
          return "Information";
        case "on hold":
        case "pending":
          return "Warning";
        case "cancelled":
        case "closed":
          return "Error";
        default:
          return "None";
      }
    },

    // Update onGenerateReport to refresh projects data
    onGenerateReport: function () {
      this._loadProjectsWithAssignments();
      MessageToast.show("Project report generated");
    },

    onPreviousWeek: function () {
      let oModel = this.getView().getModel();
      let oDatePicker = this.getView().byId("datePicker");

      // Get current week start
      let currentWeekStart = new Date(oModel.getProperty("/currentWeekStart"));
      if (isNaN(currentWeekStart)) {
        console.error("Invalid week start:", oModel.getProperty("/currentWeekStart"));
        return;
      }

      // Move week start back by 7 days
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);

      // Save the updated week start
      oModel.setProperty("/currentWeekStart", currentWeekStart);

      // Update the selectedDate in the DatePicker to match the week start
      oModel.setProperty("/selectedDate", this._formatDateForDatePicker(currentWeekStart));

      // Explicitly set the date picker value to ensure UI update
      if (oDatePicker) {
        oDatePicker.setDateValue(currentWeekStart);
      }

      // Compute clean weekStart & weekEnd
      let weekStart = new Date(currentWeekStart);
      let weekEnd = this._getWeekEnd(weekStart);

      // Update week days UI
      this._updateWeekDays(weekStart);

      // Load Timesheet Records for this week
      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      }
    },

    onCurrentWeek: function () {
      let oModel = this.getView().getModel();
      let oDatePicker = this.getView().byId("datePicker");
      let weekStart = this._getWeekStart(new Date());

      oModel.setProperty("/currentWeekStart", weekStart);

      // Update the selectedDate in the DatePicker to match the current week
      oModel.setProperty("/selectedDate", this._formatDateForDatePicker(weekStart));

      // Explicitly set the date picker value to ensure UI update
      if (oDatePicker) {
        oDatePicker.setDateValue(weekStart);
      }

      let weekEnd = this._getWeekEnd(weekStart);
      this._updateWeekDays(weekStart);

      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      }
    },

    onNextWeek: function () {
      let oModel = this.getView().getModel();
      let oDatePicker = this.getView().byId("datePicker");

      // Get current week start
      let currentWeekStart = new Date(oModel.getProperty("/currentWeekStart"));
      if (isNaN(currentWeekStart)) {
        console.error("Invalid week start:", oModel.getProperty("/currentWeekStart"));
        return;
      }

      // Move week start forward by 7 days
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);

      // Save the updated week start
      oModel.setProperty("/currentWeekStart", currentWeekStart);

      // Update the selectedDate in the DatePicker to match the week start
      oModel.setProperty("/selectedDate", this._formatDateForDatePicker(currentWeekStart));

      // Explicitly set the date picker value to ensure UI update
      if (oDatePicker) {
        oDatePicker.setDateValue(currentWeekStart);
      }

      // Compute clean weekStart & weekEnd
      let weekStart = new Date(currentWeekStart);
      let weekEnd = this._getWeekEnd(weekStart);

      // Update week days UI
      this._updateWeekDays(weekStart);

      let employeeId = oModel.getProperty("/selectedEmployee");
      if (employeeId) {
        this._loadAdminTimesheetData(employeeId, weekStart, weekEnd);
      }
    },

    onTaskDetailPress: function (oEvent) {
      try {
        var oButton = oEvent.getSource();
        var oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
          MessageToast.show("Unable to get binding context");
          return;
        }
        var oEntry = oBindingContext.getObject();
        var oModel = this.getView().getModel();
        var oWeekDates = this._getWeekDates(); // Get week dates from model
        if (!oWeekDates) {
          MessageToast.show("Week dates not available");
          return;
        }

        // Ensure dailyComments exists
        oEntry.dailyComments = oEntry.dailyComments || {};
        var that = this; // if needed inside controller
        var aDays = [{
          name: "Monday",
          hours: oEntry.monday || 0,
          comment: oEntry.mondayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.monday)
        },
        {
          name: "Tuesday",
          hours: oEntry.tuesday || 0,
          comment: oEntry.tuesdayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.tuesday)
        },
        {
          name: "Wednesday",
          hours: oEntry.wednesday || 0,
          comment: oEntry.wednesdayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.wednesday)
        },
        {
          name: "Thursday",
          hours: oEntry.thursday || 0,
          comment: oEntry.thursdayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.thursday)
        },
        {
          name: "Friday",
          hours: oEntry.friday || 0,
          comment: oEntry.fridayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.friday)
        },
        {
          name: "Saturday",
          hours: oEntry.saturday || 0,
          comment: oEntry.saturdayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.saturday)
        },
        {
          name: "Sunday",
          hours: oEntry.sunday || 0,
          comment: oEntry.sundayTaskDetails || "No task details",
          date: that._formatDateForDisplay(oWeekDates.sunday)
        }
        ];

        var getHoursColorClass = function (hours) {
          if (hours === 0) {
            return "tsHoursRed"; // red
          } else if (hours > 0 && hours < 8) {
            return "tsHoursOrange"; // orange
          } else if (hours >= 8 && hours <= 15) {
            return "tsHoursGreen"; // green
          }
          return ""; // default no class
        };

        var aItems = aDays.map(function (oDay, index) {
          return new VBox({
            width: "100%",
            items: [
              new HBox({
                justifyContent: "SpaceBetween",
                items: [
                  new Text({
                    text: `${oDay.name} (${oDay.date})`,
                    design: "Bold"
                  }),
                  new Text({
                    text: `${oDay.hours.toFixed(2)} hrs`,
                    design: "Bold"
                  }).addStyleClass(getHoursColorClass(oDay.hours))
                ]
              }).addStyleClass("tsDayHeader"),
              new Text({
                text: oDay.comment,
                wrapping: true
              }).addStyleClass("tsDayComment"),
              ...(index < aDays.length - 1 ? [
                new HBox({
                  height: "1px",
                  class: "tsSeparator"
                })
              ] : [])
            ]
          }).addStyleClass("tsDayCard");
        });

        // Create a dialog with a custom style class to match the image
        var oDialog = new Dialog({
          title: "Week Task Details",
          contentWidth: "320px", // adjusted width to match image
          contentHeight: "70vh", // max height of dialog
          stretchOnPhone: true,
          content: new VBox({
            items: aItems,
            class: "sapUiResponsiveMargin"
          }),
          endButton: new Button({
            text: "Close",
            press: function () {
              oDialog.close();
            }
          }),
          afterClose: function () {
            oDialog.destroy();
          }
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

    onHourButtonPress: function (oEvent) {
      try {
        var oButton = oEvent.getSource();
        var oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
          MessageToast.show("Unable to get binding context");
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
            MessageToast.show("Unable to determine day");
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
            aHourOptions.push(new Item({
              key: i.toString(),
              text: i + " hour" + (i !== 1 ? "s" : "")
            }));
          }

          this._oHourEditDialog = new Dialog({
            title: "Edit " + this._capitalize(sDay) + " Entry",
            contentWidth: "350px",
            titleAlignment: "Center",
            content: [
              new VBox({
                items: [
                  // Date Field - NON-EDITABLE
                  new VBox({
                    items: [
                      new Label({
                        text: "Date:",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new Input({
                        value: "{/editData/date}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),
                  // Project Field - NON-EDITABLE
                  new VBox({
                    items: [
                      new Label({
                        text: "Project:",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new Input({
                        value: "{/editData/projectName}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),
                  // Task Type Field - NON-EDITABLE
                  new VBox({
                    items: [
                      new Label({
                        text: "Task",
                        design: "Bold"
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new Input({
                        value: "{/editData/taskType}",
                        editable: false
                      })
                    ]
                  }).addStyleClass("sapUiTinyMarginBottom"),
                  // Hours Field - NON-EDITABLE
                  new VBox({
                    items: [
                      new Label({
                        text: "Hours:",
                        design: "Bold",
                        required: true
                      }).addStyleClass("sapUiTinyMarginBottom"),
                      new Input({
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
            beginButton: new Button({
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
        var oEditModel = new JSONModel({
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
        MessageToast.show("Error opening edit dialog");
      }
    },

    _capitalize: function (sString) {
      if (!sString) return "";
      return sString.charAt(0).toUpperCase() + sString.slice(1);
    },

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

    _getDayIndex: function (sDay) {
      var dayMap = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6
      };
      return dayMap[sDay] || 0;
    },

    _formatDateForDisplay: function (date) {
      if (!date) return "";
      var oDate = new Date(date);
      var options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      };
      return oDate.toLocaleDateString('en-US', options);
    },

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

    formatVarianceState: function (nVariance) {
      if (nVariance > 10) {
        return "Error"; // Significantly over budget
      } else if (nVariance > 0) {
        return "Warning"; // Slightly over budget
      } else if (nVariance < -10) {
        return "Warning"; // Significantly under budget
      } else {
        return "Success"; // Within acceptable range
      }
    },

    // Add missing notification handler
    onNotificationPress: function () {
      MessageToast.show("Notifications feature not implemented yet");
    }

  });
});