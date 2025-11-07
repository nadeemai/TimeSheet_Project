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
      // Initialize main model for UI data
      var oModel = new JSONModel({
        users: [],
        projects: [],
        projectHours: [],
        managerTeams: [],
        projectDurations: []
      });
      this.getView().setModel(oModel);

      // Load initial data from OData services
      this._loadEmployees();
      this._loadProjects();
    },

    // Load Employees from OData service
    _loadEmployees: function() {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      oModel.read("/Employees", {
        success: function(oData) {
          var aEmployees = oData.value || oData.results || [];
          console.log("Raw Employees Data:", aEmployees);
          
          var aFormattedUsers = that._formatEmployeeData(aEmployees);
          
          var oViewModel = that.getView().getModel();
          oViewModel.setProperty("/users", aFormattedUsers);
          that._refreshAnalyticsData();
        },
        error: function(oError) {
          console.error("Error loading employees:", oError);
          MessageToast.show("Error loading employees data");
        }
      });
    },

    // Load Projects from OData service - FIXED
    _loadProjects: function() {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      oModel.read("/Projects", {
        success: function(oData) {
          var aProjects = oData.value || oData.results || [];
          console.log("Raw Projects Data from OData:", aProjects);
          
          var aFormattedProjects = that._formatProjectData(aProjects);
          console.log("Formatted Projects for UI:", aFormattedProjects);
          
          var oViewModel = that.getView().getModel();
          oViewModel.setProperty("/projects", aFormattedProjects);
          oViewModel.refresh(true); // Force refresh
          that._refreshAnalyticsData();
          
          MessageToast.show("Projects loaded successfully: " + aFormattedProjects.length + " projects");
        },
        error: function(oError) {
          console.error("Error loading projects:", oError);
          MessageToast.show("Error loading projects data");
        }
      });
    },

    // Format employee data from OData to UI model
    _formatEmployeeData: function(aEmployees) {
      return aEmployees.map(function(employee) {
        return {
          userId: employee.employeeID || employee.EmployeeID,
          firstName: employee.firstName || employee.FirstName || "",
          lastName: employee.lastName || employee.LastName || "",
          email: employee.email || employee.Email || "",
          role: employee.roleName || employee.Role || "Employee",
          managerId: employee.managerID_ID || employee.ManagerID || "",
          managerName: employee.managerName || employee.ManagerName || "",
          status: employee.isActive ? "Active" : "Inactive",
          department: employee.department || employee.Department || "",
          accessLevel: employee.accessLevel || "Employee"
        };
      });
    },

    // Format project data from OData to UI model - COMPLETELY FIXED
    _formatProjectData: function(aProjects) {
      return aProjects.map(function(project) {
        console.log("Processing project:", project);
        
        // Extract and parse numeric values properly
        var budget = parseFloat(project.budget) || 0;
        var allocatedHours = parseFloat(project.allocatedHours) || 0;
        var usedHours = parseFloat(project.usedHours) || 0;
        
        var formattedProject = {
          projectId: project.projectID || project.ID || "PRJ001",
          name: project.projectName || "Unknown Project",
          description: project.description || "",
          managerId: project.projectOwner_ID || "",
          managerName: project.projectOwnerName || "Unknown Manager",
          budget: budget,
          allocatedHours: allocatedHours,
          usedHours: usedHours,
          startDate: project.startDate || "2025-01-01",
          endDate: project.endDate || "2025-12-31",
          status: project.status || "Active",
          client: project.client || "Internal",
          isBillable: project.isBillable !== undefined ? project.isBillable : true,
          teamMembers: []
        };
        
        console.log("Formatted project:", formattedProject);
        return formattedProject;
      });
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
      var oModel = this.getView().getModel();
      var aUsers = oModel.getProperty("/users");
      
      var oUser = aUsers.find(user => user.userId === oSelectedUser.userId);
      if (oUser) {
        oUser.status = oUser.status === "Active" ? "Inactive" : "Active";
        oModel.setProperty("/users", aUsers);
        
        // Update in OData service
        this._updateEmployeeInOData(oUser);
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
                  value: "{/userData/firstName}", 
                  required: true, 
                  valueStateText: "First Name is required" 
                }),
                
                new Label({ text: "Last Name" }),
                new Input({ 
                  value: "{/userData/lastName}", 
                  required: true, 
                  valueStateText: "Last Name is required" 
                }),
                
                new Label({ text: "Email" }),
                new Input({ 
                  value: "{/userData/email}", 
                  type: "Email", 
                  required: true, 
                  valueStateText: "Valid Email is required" 
                }),
                
                new Label({ text: "Role" }),
                new Select({
                  selectedKey: "{/userData/role}",
                  items: [
                    new Item({ key: "Employee", text: "Employee" }),
                    new Item({ key: "Manager", text: "Manager" }),
                    new Item({ key: "Admin", text: "Admin" })
                  ],
                  required: true
                }),
                
                new Label({ text: "Manager" }),
                new Select({
                  selectedKey: "{/userData/managerId}",
                  items: {
                    path: "/managers",
                    template: new Item({ 
                      key: "{userId}", 
                      text: "{firstName} {lastName}" 
                    })
                  },
                  forceSelection: false
                }),
                
                new Label({ text: "Department" }),
                new Input({ value: "{/userData/department}" }),
                
                new Label({ text: "Access Level" }),
                new Select({
                  selectedKey: "{/userData/accessLevel}",
                  items: [
                    new Item({ key: "Employee", text: "Employee" }),
                    new Item({ key: "Manager", text: "Manager" }),
                    new Item({ key: "Admin", text: "Admin" })
                  ],
                  required: true
                }),
                
                new Label({ text: "Status" }),
                new Select({
                  selectedKey: "{/userData/status}",
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
      
      // Set up the model for the dialog
      var oViewModel = new JSONModel({
        mode: sMode,
        userData: oUserData ? JSON.parse(JSON.stringify(oUserData)) : {
          firstName: "",
          lastName: "",
          email: "",
          role: "Employee",
          managerId: "",
          managerName: "",
          department: "",
          accessLevel: "Employee",
          status: "Active"
        },
        managers: this._getManagersList()
      });
      
      this._oUserDialog.setModel(oViewModel);
      this._oUserDialog.open();
    },

    _getManagersList: function() {
      var oModel = this.getView().getModel();
      var aUsers = oModel.getProperty("/users");
      return aUsers.filter(user => user.role === "Manager" && user.status === "Active");
    },

    onSaveUser: function() {
      var oDialog = this._oUserDialog;
      var oViewModel = oDialog.getModel();
      var oUserData = JSON.parse(JSON.stringify(oViewModel.getProperty("/userData")));
      var sMode = oViewModel.getProperty("/mode");
      
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
      
      if (sMode === "create") {
        this._createEmployeeInOData(oUserData);
      } else {
        this._updateEmployeeInOData(oUserData);
      }
      
      oDialog.close();
    },

    // Create employee in OData service
    _createEmployeeInOData: function(oUserData) {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      var oEmployeeData = {
        employeeID: "EMP" + Date.now(),
        firstName: oUserData.firstName,
        lastName: oUserData.lastName,
        email: oUserData.email,
        roleName: oUserData.role,
        managerID_ID: oUserData.managerId || null,
        isActive: oUserData.status === "Active",
        department: oUserData.department || ""
      };
      
      oModel.create("/Employees", oEmployeeData, {
        success: function(oData) {
          MessageToast.show("User created successfully");
          that._loadEmployees();
        },
        error: function(oError) {
          console.error("Error creating employee:", oError);
          MessageToast.show("Error creating user");
        }
      });
    },

    // Update employee in OData service
    _updateEmployeeInOData: function(oUserData) {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      var oEmployeeData = {
        firstName: oUserData.firstName,
        lastName: oUserData.lastName,
        email: oUserData.email,
        roleName: oUserData.role,
        managerID_ID: oUserData.managerId || null,
        isActive: oUserData.status === "Active",
        department: oUserData.department || ""
      };
      
      var sPath = "/Employees('" + oUserData.userId + "')";
      
      oModel.update(sPath, oEmployeeData, {
        success: function(oData) {
          MessageToast.show("User updated successfully");
          that._loadEmployees();
        },
        error: function(oError) {
          console.error("Error updating employee:", oError);
          MessageToast.show("Error updating user");
        }
      });
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
      
      MessageBox.confirm(
        "Are you sure you want to delete project '" + oSelectedProject.name + "'?",
        {
          title: "Delete Project",
          onClose: function(sAction) {
            if (sAction === MessageBox.Action.OK) {
              this._deleteProjectInOData(oSelectedProject);
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
                  value: "{/projectData/name}", 
                  required: true,
                  valueStateText: "Project Name is required"
                }),
                
                new Label({text: "Description"}),
                new Input({value: "{/projectData/description}"}),
                
                new Label({text: "Project Manager"}),
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
                
                new Label({text: "Budget ($)"}),
                new Input({
                  value: "{/projectData/budget}", 
                  type: "Number",
                  valueStateText: "Budget must be a number"
                }),
                
                new Label({text: "Allocated Hours"}),
                new Input({
                  value: "{/projectData/allocatedHours}", 
                  type: "Number",
                  required: true,
                  valueStateText: "Allocated Hours is required"
                }),
                
                new Label({text: "Used Hours"}),
                new Input({
                  value: "{/projectData/usedHours}", 
                  type: "Number",
                  valueStateText: "Used Hours must be a number"
                }),
                
                new Label({text: "Start Date"}),
                new DatePicker({
                  value: "{/projectData/startDate}", 
                  valueFormat: "yyyy-MM-dd",
                  required: true
                }),
                
                new Label({text: "End Date"}),
                new DatePicker({
                  value: "{/projectData/endDate}", 
                  valueFormat: "yyyy-MM-dd",
                  required: true
                }),
                
                new Label({text: "Client"}),
                new Input({value: "{/projectData/client}"}),
                
                new Label({text: "Status"}),
                new Select({
                  selectedKey: "{/projectData/status}",
                  items: [
                    new Item({key: "Planning", text: "Planning"}),
                    new Item({key: "Active", text: "Active"}),
                    new Item({key: "On Hold", text: "On Hold"}),
                    new Item({key: "Completed", text: "Completed"}),
                    new Item({key: "Cancelled", text: "Cancelled"})
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
          name: "",
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

    onSaveProject: function() {
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
      
      if (sMode === "create") {
        this._createProjectInOData(oProjectData);
      } else {
        this._updateProjectInOData(oProjectData);
      }
      
      oDialog.close();
    },

    // Create project in OData service
    _createProjectInOData: function(oProjectData) {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      var oProjectPayload = {
        projectID: "PRJ" + Date.now(),
        projectName: oProjectData.name,
        description: oProjectData.description || "",
        projectOwner_ID: oProjectData.managerId,
        budget: parseFloat(oProjectData.budget) || 0,
        allocatedHours: parseFloat(oProjectData.allocatedHours) || 0,
        usedHours: parseFloat(oProjectData.usedHours) || 0,
        startDate: oProjectData.startDate,
        endDate: oProjectData.endDate,
        status: oProjectData.status,
        isBillable: true
      };
      
      console.log("Creating project with payload:", oProjectPayload);
      
      oModel.create("/Projects", oProjectPayload, {
        success: function(oData) {
          MessageToast.show("Project created successfully");
          that._loadProjects();
        },
        error: function(oError) {
          console.error("Error creating project:", oError);
          MessageToast.show("Error creating project");
        }
      });
    },

    // Update project in OData service
    _updateProjectInOData: function(oProjectData) {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      var oProjectPayload = {
        projectName: oProjectData.name,
        description: oProjectData.description || "",
        projectOwner_ID: oProjectData.managerId,
        budget: parseFloat(oProjectData.budget) || 0,
        allocatedHours: parseFloat(oProjectData.allocatedHours) || 0,
        usedHours: parseFloat(oProjectData.usedHours) || 0,
        startDate: oProjectData.startDate,
        endDate: oProjectData.endDate,
        status: oProjectData.status
      };
      
      var sPath = "/Projects('" + oProjectData.projectId + "')";
      
      console.log("Updating project with payload:", oProjectPayload);
      
      oModel.update(sPath, oProjectPayload, {
        success: function(oData) {
          MessageToast.show("Project updated successfully");
          that._loadProjects();
        },
        error: function(oError) {
          console.error("Error updating project:", oError);
          MessageToast.show("Error updating project");
        }
      });
    },

    // Delete project in OData service
    _deleteProjectInOData: function(oProjectData) {
      var oModel = this.getOwnerComponent().getModel("timesheetServiceV2");
      var that = this;
      
      var sPath = "/Projects('" + oProjectData.projectId + "')";
      
      oModel.remove(sPath, {
        success: function(oData) {
          MessageToast.show("Project deleted successfully");
          that._loadProjects();
        },
        error: function(oError) {
          console.error("Error deleting project:", oError);
          MessageToast.show("Error deleting project");
        }
      });
    },

    onCancelProject: function() {
      if (this._oProjectDialog) {
        this._oProjectDialog.close();
      }
    },

    // Analytics Functions
    onRefreshAnalytics: function() {
      this._refreshAnalyticsData();
      MessageToast.show("Analytics data refreshed");
    },

    _refreshAnalyticsData: function() {
      var oModel = this.getView().getModel();
      var aProjects = oModel.getProperty("/projects") || [];
      var aUsers = oModel.getProperty("/users") || [];
      
      // Update project hours data
      var aProjectHours = aProjects.map(function(project) {
        var utilization = project.allocatedHours > 0 ? 
          Math.round((project.usedHours / project.allocatedHours) * 100) : 0;
          
        return {
          projectId: project.projectId,
          projectName: project.name,
          allocatedHours: project.allocatedHours,
          bookedHours: project.usedHours,
          remainingHours: project.allocatedHours - project.usedHours,
          utilization: utilization
        };
      });
      
      // Update manager teams data
      var aManagerTeams = this._getManagersList().map(function(manager) {
        var aTeamMembers = aUsers.filter(user => 
          user.managerId === manager.userId && user.status === "Active"
        );
        var aManagerProjects = aProjects.filter(project => 
          project.managerId === manager.userId
        );
        
        var totalBookedHours = aManagerProjects.reduce(function(sum, project) {
          return sum + (project.usedHours || 0);
        }, 0);
        
        var totalAllocatedHours = aManagerProjects.reduce(function(sum, project) {
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
      
      oModel.setProperty("/projectHours", aProjectHours);
      oModel.setProperty("/managerTeams", aManagerTeams);
      oModel.setProperty("/projectDurations", aProjectDurations);
      oModel.refresh(true);
    },

    // Utility Functions - FIXED formatCurrency
    formatCurrency: function(fValue) {
      if (fValue === null || fValue === undefined || isNaN(fValue)) {
        return "$0.00";
      }
      var value = parseFloat(fValue);
      return "$" + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    onRefreshUsers: function() {
      this._loadEmployees();
      MessageToast.show("Users data refreshed");
    },

    onRefreshProjects: function() {
      this._loadProjects();
      MessageToast.show("Projects data refreshed");
    }
  });
});