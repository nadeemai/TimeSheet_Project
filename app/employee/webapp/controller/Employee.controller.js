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
      // Set the main OData model to the view
      var oModel = this.getOwnerComponent().getModel();
      this.getView().setModel(oModel);
      
      // Initialize analytics model
      var oAnalyticsModel = new JSONModel({
        projectHours: [],
        managerTeams: [],
        projectDurations: []
      });
      this.getView().setModel(oAnalyticsModel, "analytics");
      
      // Load initial data
      this._loadInitialData();
    },

    _loadInitialData: function() {
      var oModel = this.getView().getModel();
      
      // Trigger data loading by binding the tables
      var oUsersTable = this.byId("usersTable");
      var oProjectsTable = this.byId("projectsTable");
      
      if (oUsersTable) {
        oUsersTable.bindRows({
          path: "/Employees",
          parameters: {
            expand: "manager"
          }
        });
      }
      
      if (oProjectsTable) {
        oProjectsTable.bindRows({
          path: "/Projects",
          parameters: {
            expand: "manager"
          }
        });
      }
      
      // Load data for analytics
      this._loadDataAndComputeAnalytics();
    },

    _loadDataAndComputeAnalytics: function() {
      var oDataModel = this.getView().getModel();
      
      // Read Employees data
      oDataModel.read("/Employees", {
        urlParameters: {
          "$expand": "manager"
        },
        success: function(oData) {
          this._employeesData = oData.results;
          console.log("Loaded employees:", this._employeesData);
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
          console.log("Loaded projects:", this._projectsData);
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
      var oBindingContext = oEvent.getSource().getBindingContext();
      if (oBindingContext) {
        var oSelectedUser = oBindingContext.getObject();
        this._loadUserDialog("edit", oSelectedUser);
      } else {
        MessageToast.show("Please select a user to edit");
      }
    },

    onToggleUserStatus: function(oEvent) {
      var oBindingContext = oEvent.getSource().getBindingContext();
      if (oBindingContext) {
        var oSelectedUser = oBindingContext.getObject();
        var oODataModel = this.getView().getModel();
        var sPath = oBindingContext.getPath();
        
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
      } else {
        MessageToast.show("Please select a user to update status");
      }
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
                  value: "{viewModel>/userData/firstName}", 
                  required: true
                }),
                
                new Label({ text: "Last Name" }),
                new Input({ 
                  value: "{viewModel>/userData/lastName}", 
                  required: true
                }),
                
                new Label({ text: "Email" }),
                new Input({ 
                  value: "{viewModel>/userData/email}", 
                  type: "Email", 
                  required: true
                }),
                
                new Label({ text: "Role" }),
                new Select({
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
                  selectedKey: "{viewModel>/userData/managerId}",
                  forceSelection: false,
                  items: {
                    path: "/Employees",
                    template: new Item({
                      key: "{userId}",
                      text: "{firstName} {lastName}"
                    }),
                    filters: [new Filter("role", FilterOperator.EQ, "Manager")]
                  }
                }),
                
                new Label({ text: "Department" }),
                new Input({ 
                  value: "{viewModel>/userData/department}"
                }),
                
                new Label({ text: "Access Level" }),
                new Select({
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
        userData: oUserData ? {
          userId: oUserData.userId,
          firstName: oUserData.firstName || "",
          lastName: oUserData.lastName || "",
          email: oUserData.email || "",
          role: oUserData.role || "Employee",
          managerId: oUserData.managerId || "",
          department: oUserData.department || "",
          accessLevel: oUserData.accessLevel || "Employee",
          status: oUserData.status || "Active"
        } : {
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
      this._oUserDialog.setTitle(sMode === "create" ? "Create New User" : "Edit User");
      this._oUserDialog.open();
    },

    onSaveUser: function() {
      var oDialog = this._oUserDialog;
      var oViewModel = oDialog.getModel("viewModel");
      var oUserData = oViewModel.getProperty("/userData");
      var sMode = oViewModel.getProperty("/mode");
      var oODataModel = this.getView().getModel();
      
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
      
      if (sMode === "create") {
        // Remove userId for new users (let backend generate it)
        delete oUserData.userId;
        
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
        var sPath = "/Employees('" + oUserData.userId + "')";
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
      var oBindingContext = oEvent.getSource().getBindingContext();
      if (oBindingContext) {
        var oSelectedProject = oBindingContext.getObject();
        this._loadProjectDialog("edit", oSelectedProject);
      } else {
        MessageToast.show("Please select a project to edit");
      }
    },

    onDeleteProject: function(oEvent) {
      var oBindingContext = oEvent.getSource().getBindingContext();
      if (oBindingContext) {
        var oSelectedProject = oBindingContext.getObject();
        var sPath = oBindingContext.getPath();
        
        MessageBox.confirm(
          "Are you sure you want to delete project '" + (oSelectedProject.name || oSelectedProject.projectName) + "'?",
          {
            title: "Delete Project",
            onClose: function(sAction) {
              if (sAction === MessageBox.Action.OK) {
                var oODataModel = this.getView().getModel();
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
      } else {
        MessageToast.show("Please select a project to delete");
      }
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
                  value: "{viewModel>/projectData/name}", 
                  required: true
                }),
                
                new Label({text: "Description"}),
                new Input({
                  value: "{viewModel>/projectData/description}"
                }),
                
                new Label({text: "Project Manager"}),
                new Select({
                  selectedKey: "{viewModel>/projectData/managerId}",
                  forceSelection: false,
                  items: {
                    path: "/Employees",
                    template: new Item({
                      key: "{userId}",
                      text: "{firstName} {lastName}"
                    }),
                    filters: [new Filter("role", FilterOperator.EQ, "Manager")]
                  }
                }),
                
                new Label({text: "Budget ($)"}),
                new Input({
                  value: "{viewModel>/projectData/budget}", 
                  type: "Number"
                }),
                
                new Label({text: "Allocated Hours"}),
                new Input({
                  value: "{viewModel>/projectData/allocatedHours}", 
                  type: "Number"
                }),
                
                new Label({text: "Start Date"}),
                new DatePicker({
                  value: "{viewModel>/projectData/startDate}", 
                  valueFormat: "yyyy-MM-dd",
                  displayFormat: "MMM dd, yyyy"
                }),
                
                new Label({text: "End Date"}),
                new DatePicker({
                  value: "{viewModel>/projectData/endDate}", 
                  valueFormat: "yyyy-MM-dd",
                  displayFormat: "MMM dd, yyyy"
                }),
                
                new Label({text: "Client"}),
                new Input({
                  value: "{viewModel>/projectData/client}"
                }),
                
                new Label({text: "Status"}),
                new Select({
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
        projectData: oProjectData ? {
          projectId: oProjectData.projectId,
          name: oProjectData.name || "",
          description: oProjectData.description || "",
          managerId: oProjectData.managerId || "",
          budget: oProjectData.budget || 0,
          allocatedHours: oProjectData.allocatedHours || 0,
          startDate: oProjectData.startDate || "",
          endDate: oProjectData.endDate || "",
          client: oProjectData.client || "",
          status: oProjectData.status || "Planning"
        } : {
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
      this._oProjectDialog.setTitle(sMode === "create" ? "Create New Project" : "Edit Project");
      this._oProjectDialog.open();
    },

    onSaveProject: function() {
      var oDialog = this._oProjectDialog;
      var oViewModel = oDialog.getModel("viewModel");
      var oProjectData = oViewModel.getProperty("/projectData");
      var sMode = oViewModel.getProperty("/mode");
      var oODataModel = this.getView().getModel();
      
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
        // Remove projectId for new projects (let backend generate it)
        delete oProjectData.projectId;
        
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
        var sPath = "/Projects('" + oProjectData.projectId + "')";
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
          remainingHours: Math.max(0, allocatedHours - usedHours),
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
        var startDate = project.startDate ? new Date(project.startDate) : new Date();
        var endDate = project.endDate ? new Date(project.endDate) : new Date();
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
      if (fValue === null || fValue === undefined) return "$0.00";
      return "$" + parseFloat(fValue).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    onRefreshUsers: function() {
      var oODataModel = this.getView().getModel();
      oODataModel.refresh();
      this._loadDataAndComputeAnalytics();
      MessageToast.show("Users data refreshed");
    },

    onRefreshProjects: function() {
      var oODataModel = this.getView().getModel();
      oODataModel.refresh();
      this._loadDataAndComputeAnalytics();
      MessageToast.show("Projects data refreshed");
    },
    
    // Format manager name for display
    formatManagerName: function(manager) {
      if (!manager) return "";
      return (manager.firstName || "") + " " + (manager.lastName || "");
    }
  });
});