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
  "sap/ui/model/odata/v2/ODataModel"
], function(Controller, MessageToast, JSONModel, Fragment, MessageBox, Filter, FilterOperator, Select, Item, Input, DatePicker, Button, Dialog, Text, Label, SimpleForm, ToolbarSpacer, Toolbar, ODataModel) {
  "use strict";

  return Controller.extend("employee.com.employee.controller.Employee", {
    
    onInit: function() {
      // Initialize analytics model
      var oAnalyticsModel = new JSONModel({
        projectHours: [],
        managerTeams: [],
        projectDurations: []
      });
      this.getView().setModel(oAnalyticsModel, "analytics");
      
      // Load data and compute analytics
      this._loadDataAndComputeAnalytics();
    },

    _loadDataAndComputeAnalytics: function() {
      var oDataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      
      // Read Employees data
      oDataModel.read("/Employees", {
        urlParameters: {
          "$expand": "manager"
        },
        success: function(oData) {
          this._employeesData = oData.results;
          this._computeAnalyticsIfReady();
        }.bind(this),
        error: function(oError) {
          MessageToast.show("Error loading employees data");
          console.error("Error loading employees:", oError);
        }
      });
      
      // Read Projects data
      oDataModel.read("/Projects", {
        urlParameters: {
          "$expand": "manager"
        },
        success: function(oData) {
          this._projectsData = oData.results;
          this._computeAnalyticsIfReady();
        }.bind(this),
        error: function(oError) {
          MessageToast.show("Error loading projects data");
          console.error("Error loading projects:", oError);
        }
      });
    },

    _computeAnalyticsIfReady: function() {
      if (this._employeesData && this._projectsData) {
        this._refreshAnalyticsData();
      }
    },

    // User Management Functions
    onAddUser: function() {
      this._loadUserDialog("create");
    },

    onEditUser: function(oEvent) {
      var oSelectedUser = oEvent.getSource().getBindingContext().getObject();
      this._loadUserDialog("edit", oSelectedUser);
    },

    onToggleUserStatus: function(oEvent) {
      var oSelectedUser = oEvent.getSource().getBindingContext().getObject();
      var oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var sPath = "/Employees(userId='" + oSelectedUser.userId + "')";
      
      var oUpdatedUser = {
        status: oSelectedUser.status === "Active" ? "Inactive" : "Active"
      };
      
      oODataModel.update(sPath, oUpdatedUser, {
        success: function() {
          oODataModel.refresh();
          this._loadDataAndComputeAnalytics();
          MessageToast.show("User status updated successfully");
        }.bind(this),
        error: function(oError) {
          MessageToast.show("Error updating user status");
          console.error("Error:", oError);
        }
      });
    },

    _loadUserDialog: function(sMode, oUserData) {
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
                new Input({ 
                  id: "firstNameInput",
                  value: "{viewModel>/userData/firstName}", 
                  required: true
                }),
                
                new Label({ text: "Last Name" }),
                new Input({ 
                  id: "lastNameInput",
                  value: "{viewModel>/userData/lastName}", 
                  required: true
                }),
                
                new Label({ text: "Email" }),
                new Input({ 
                  id: "emailInput",
                  value: "{viewModel>/userData/email}", 
                  type: "Email", 
                  required: true
                }),
                
                new Label({ text: "Role" }),
                new Select({
                  id: "roleSelect",
                  selectedKey: "{viewModel>/userData/role}",
                  items: [
                    new Item({ key: "Employee", text: "Employee" }),
                    new Item({ key: "Manager", text: "Manager" }),
                    new Item({ key: "Admin", text: "Admin" })
                  ],
                  required: true
                }),
                
                new Label({ text: "Manager" }),
                new Select({
                  id: "managerSelect",
                  selectedKey: "{viewModel>/userData/managerId}",
                  forceSelection: false,
                  items: {
                    path: "timesheetServiceV2>/Employees",
                    template: new Item({
                      key: "{timesheetServiceV2>userId}",
                      text: "{timesheetServiceV2>firstName} {timesheetServiceV2>lastName}"
                    }),
                    filters: [new Filter("role", FilterOperator.EQ, "Manager")]
                  }
                }),
                
                new Label({ text: "Department" }),
                new Input({ 
                  id: "departmentInput",
                  value: "{viewModel>/userData/department}"
                }),
                
                new Label({ text: "Access Level" }),
                new Select({
                  id: "accessLevelSelect",
                  selectedKey: "{viewModel>/userData/accessLevel}",
                  items: [
                    new Item({ key: "Employee", text: "Employee" }),
                    new Item({ key: "Manager", text: "Manager" }),
                    new Item({ key: "Admin", text: "Admin" })
                  ],
                  required: true
                }),
                
                new Label({ text: "Status" }),
                new Select({
                  id: "statusSelect",
                  selectedKey: "{viewModel>/userData/status}",
                  items: [
                    new Item({ key: "Active", text: "Active" }),
                    new Item({ key: "Inactive", text: "Inactive" })
                  ],
                  required: true
                })
              ]
            })
          ],
          beginButton: new Button({
            text: "Save",
            type: "Emphasized",
            press: this.onSaveUser.bind(this)
          }),
          endButton: new Button({
            text: "Cancel",
            press: this.onCancelUser.bind(this)
          })
        });
        
        this.getView().addDependent(this._oUserDialog);
      }
      
      // Set up the view model for the dialog
      var oViewModel = new JSONModel({
        mode: sMode,
        userData: oUserData ? JSON.parse(JSON.stringify(oUserData)) : {
          firstName: "",
          lastName: "",
          email: "",
          role: "Employee",
          managerId: "",
          department: "",
          accessLevel: "Employee",
          status: "Active"
        }
      });
      
      this._oUserDialog.setModel(oViewModel, "viewModel");
      
      // Update dialog title
      this._oUserDialog.setTitle(sMode === "create" ? "Create New User" : "Edit User");
      
      this._oUserDialog.open();
    },

    onSaveUser: function() {
      var oDialog = this._oUserDialog;
      var oViewModel = oDialog.getModel("viewModel");
      var oUserData = JSON.parse(JSON.stringify(oViewModel.getProperty("/userData")));
      var sMode = oViewModel.getProperty("/mode");
      var oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      
      // Validate required fields
      if (!oUserData.firstName || !oUserData.lastName || !oUserData.email || !oUserData.role || !oUserData.accessLevel) {
        MessageToast.show("Please fill in all required fields");
        return;
      }
      
      // Validate email format
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(oUserData.email)) {
        MessageToast.show("Please enter a valid email address");
        return;
      }
      
      if (sMode === "create") {
        oODataModel.create("/Employees", oUserData, {
          success: function() {
            oODataModel.refresh();
            this._loadDataAndComputeAnalytics();
            oDialog.close();
            MessageToast.show("User created successfully");
          }.bind(this),
          error: function(oError) {
            MessageToast.show("Error creating user");
            console.error("Error:", oError);
          }
        });
      } else {
        var sPath = "/Employees(userId='" + oUserData.userId + "')";
        oODataModel.update(sPath, oUserData, {
          success: function() {
            oODataModel.refresh();
            this._loadDataAndComputeAnalytics();
            oDialog.close();
            MessageToast.show("User updated successfully");
          }.bind(this),
          error: function(oError) {
            MessageToast.show("Error updating user");
            console.error("Error:", oError);
          }
        });
      }
    },

    onCancelUser: function() {
      if (this._oUserDialog) {
        this._oUserDialog.close();
      }
    },

    // Project Management Functions
    onAddProject: function() {
      this._loadProjectDialog("create");
    },

    onEditProject: function(oEvent) {
      var oSelectedProject = oEvent.getSource().getBindingContext().getObject();
      this._loadProjectDialog("edit", oSelectedProject);
    },

    onDeleteProject: function(oEvent) {
      var oSelectedProject = oEvent.getSource().getBindingContext().getObject();
      var sPath = "/Projects(projectId='" + oSelectedProject.projectId + "')";
      
      MessageBox.confirm(
        "Are you sure you want to delete project '" + oSelectedProject.name + "'?",
        {
          title: "Delete Project",
          onClose: function(sAction) {
            if (sAction === MessageBox.Action.OK) {
              var oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
              oODataModel.remove(sPath, {
                success: function() {
                  oODataModel.refresh();
                  this._loadDataAndComputeAnalytics();
                  MessageToast.show("Project deleted successfully");
                }.bind(this),
                error: function(oError) {
                  MessageToast.show("Error deleting project");
                  console.error("Error:", oError);
                }
              });
            }
          }.bind(this)
        }
      );
    },

    _loadProjectDialog: function(sMode, oProjectData) {
      if (!this._oProjectDialog) {
        this._oProjectDialog = new Dialog({
          title: sMode === "create" ? "Create New Project" : "Edit Project",
          contentWidth: "600px",
          content: [
            new SimpleForm({
              layout: "ResponsiveGridLayout",
              editable: true,
              content: [
                new Label({text: "Project Name"}),
                new Input({
                  id: "projectNameInput",
                  value: "{viewModel>/projectData/name}", 
                  required: true
                }),
                
                new Label({text: "Description"}),
                new Input({
                  id: "projectDescInput",
                  value: "{viewModel>/projectData/description}"
                }),
                
                new Label({text: "Project Manager"}),
                new Select({
                  id: "projectManagerSelect",
                  selectedKey: "{viewModel>/projectData/managerId}",
                  forceSelection: false,
                  items: {
                    path: "timesheetServiceV2>/Employees",
                    template: new Item({
                      key: "{timesheetServiceV2>userId}",
                      text: "{timesheetServiceV2>firstName} {timesheetServiceV2>lastName}"
                    }),
                    filters: [new Filter("role", FilterOperator.EQ, "Manager")]
                  }
                }),
                
                new Label({text: "Budget ($)"}),
                new Input({
                  id: "projectBudgetInput",
                  value: "{viewModel>/projectData/budget}", 
                  type: "Number"
                }),
                
                new Label({text: "Allocated Hours"}),
                new Input({
                  id: "projectAllocatedHoursInput",
                  value: "{viewModel>/projectData/allocatedHours}", 
                  type: "Number"
                }),
                
                new Label({text: "Start Date"}),
                new DatePicker({
                  id: "projectStartDatePicker",
                  value: "{viewModel>/projectData/startDate}", 
                  valueFormat: "yyyy-MM-dd",
                  displayFormat: "MMM dd, yyyy"
                }),
                
                new Label({text: "End Date"}),
                new DatePicker({
                  id: "projectEndDatePicker",
                  value: "{viewModel>/projectData/endDate}", 
                  valueFormat: "yyyy-MM-dd",
                  displayFormat: "MMM dd, yyyy"
                }),
                
                new Label({text: "Client"}),
                new Input({
                  id: "projectClientInput",
                  value: "{viewModel>/projectData/client}"
                }),
                
                new Label({text: "Status"}),
                new Select({
                  id: "projectStatusSelect",
                  selectedKey: "{viewModel>/projectData/status}",
                  items: [
                    new Item({key: "Planning", text: "Planning"}),
                    new Item({key: "Active", text: "Active"}),
                    new Item({key: "On Hold", text: "On Hold"}),
                    new Item({key: "Completed", text: "Completed"}),
                    new Item({key: "Cancelled", text: "Cancelled"})
                  ]
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
      
      // Set up the view model for the dialog
      var oViewModel = new JSONModel({
        mode: sMode,
        projectData: oProjectData ? JSON.parse(JSON.stringify(oProjectData)) : {
          name: "",
          description: "",
          managerId: "",
          budget: 0,
          allocatedHours: 0,
          startDate: "",
          endDate: "",
          client: "",
          status: "Planning"
        }
      });
      
      this._oProjectDialog.setModel(oViewModel, "viewModel");
      
      // Update dialog title
      this._oProjectDialog.setTitle(sMode === "create" ? "Create New Project" : "Edit Project");
      
      this._oProjectDialog.open();
    },

    onSaveProject: function() {
      var oDialog = this._oProjectDialog;
      var oViewModel = oDialog.getModel("viewModel");
      var oProjectData = JSON.parse(JSON.stringify(oViewModel.getProperty("/projectData")));
      var sMode = oViewModel.getProperty("/mode");
      var oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      
      // Validate required fields
      if (!oProjectData.name) {
        MessageToast.show("Project name is required");
        return;
      }
      
      // Convert numeric values
      if (oProjectData.budget) {
        oProjectData.budget = parseFloat(oProjectData.budget);
      }
      if (oProjectData.allocatedHours) {
        oProjectData.allocatedHours = parseFloat(oProjectData.allocatedHours);
      }
      
      if (sMode === "create") {
        oODataModel.create("/Projects", oProjectData, {
          success: function() {
            oODataModel.refresh();
            this._loadDataAndComputeAnalytics();
            oDialog.close();
            MessageToast.show("Project created successfully");
          }.bind(this),
          error: function(oError) {
            MessageToast.show("Error creating project");
            console.error("Error:", oError);
          }
        });
      } else {
        var sPath = "/Projects(projectId='" + oProjectData.projectId + "')";
        oODataModel.update(sPath, oProjectData, {
          success: function() {
            oODataModel.refresh();
            this._loadDataAndComputeAnalytics();
            oDialog.close();
            MessageToast.show("Project updated successfully");
          }.bind(this),
          error: function(oError) {
            MessageToast.show("Error updating project");
            console.error("Error:", oError);
          }
        });
      }
    },

    onCancelProject: function() {
      if (this._oProjectDialog) {
        this._oProjectDialog.close();
      }
    },

    // Analytics Functions
    onRefreshAnalytics: function() {
      this._loadDataAndComputeAnalytics();
      MessageToast.show("Analytics data refreshed");
    },

    _refreshAnalyticsData: function() {
      if (!this._employeesData || !this._projectsData) {
        return;
      }
      
      var aEmployees = this._employeesData;
      var aProjects = this._projectsData;
      
      // Update project hours data
      var aProjectHours = aProjects.map(function(project) {
        var allocatedHours = project.allocatedHours || 0;
        var usedHours = project.usedHours || 0;
        return {
          projectId: project.projectId,
          projectName: project.name,
          allocatedHours: allocatedHours,
          bookedHours: usedHours,
          remainingHours: allocatedHours - usedHours,
          utilization: allocatedHours > 0 ? Math.round((usedHours / allocatedHours) * 100) : 0
        };
      });
      
      // Update manager teams data
      var aManagers = aEmployees.filter(function(user) { 
        return user.role === "Manager" && user.status === "Active"; 
      });
      
      var aManagerTeams = aManagers.map(function(manager) {
        var aTeamMembers = aEmployees.filter(function(user) { 
          return user.managerId === manager.userId && user.status === "Active"; 
        });
        
        var aManagerProjects = aProjects.filter(function(project) { 
          return project.managerId === manager.userId; 
        });
        
        var totalBookedHours = 0;
        var totalAllocatedHours = 0;
        
        aManagerProjects.forEach(function(project) {
          totalBookedHours += project.usedHours || 0;
          totalAllocatedHours += project.allocatedHours || 0;
        });
        
        return {
          managerId: manager.userId,
          managerName: manager.firstName + " " + manager.lastName,
          teamSize: aTeamMembers.length,
          totalProjects: aManagerProjects.length,
          totalBookedHours: totalBookedHours,
          avgUtilization: totalAllocatedHours > 0 ? Math.round((totalBookedHours / totalAllocatedHours) * 100) : 0
        };
      });
      
      // Update project durations data
      var aProjectDurations = aProjects.map(function(project) {
        var startDate = new Date(project.startDate);
        var endDate = new Date(project.endDate);
        var today = new Date();
        
        var durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        var daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        
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
          startDate: project.startDate,
          endDate: project.endDate,
          durationDays: durationDays,
          daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
          timelineStatus: timelineStatus
        };
      });
      
      var oAnalyticsModel = this.getView().getModel("analytics");
      oAnalyticsModel.setProperty("/projectHours", aProjectHours);
      oAnalyticsModel.setProperty("/managerTeams", aManagerTeams);
      oAnalyticsModel.setProperty("/projectDurations", aProjectDurations);
    },

    // Utility Functions
    formatCurrency: function(fValue) {
      if (!fValue) return "$0.00";
      return "$" + parseFloat(fValue).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    onRefreshUsers: function() {
      var oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      oODataModel.refresh();
      this._loadDataAndComputeAnalytics();
      MessageToast.show("Users data refreshed");
    },

    onRefreshProjects: function() {
      var oODataModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      oODataModel.refresh();
      this._loadDataAndComputeAnalytics();
      MessageToast.show("Projects data refreshed");
    }
  });
});