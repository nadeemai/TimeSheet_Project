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
  "sap/m/Toolbar"
], function(Controller, MessageToast, JSONModel, Fragment, MessageBox, Filter, FilterOperator, Select, Item, Input, DatePicker, Button, Dialog, Text, Label, SimpleForm, ToolbarSpacer, Toolbar) {
  "use strict";

  return Controller.extend("admin.com.admin.controller.Admin", {
    
    onInit: function() {
      // Initialize main model with updated data
      var oModel = new JSONModel({
        users: this._getSampleUsers(),
        projects: this._getSampleProjects(),
        projectHours: this._getProjectHoursData(),
        managerTeams: this._getManagerTeamsData(),
        projectDurations: this._getProjectDurationsData()
      });
      this.getView().setModel(oModel);
    },

    // Sample data generation methods
    _getSampleUsers: function() {
      return [
        {
          userId: "ADMIN001",
          firstName: "System",
          lastName: "Administrator",
          email: "admin@company.com",
          role: "Admin",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "IT",
          accessLevel: "Admin"
        },
        {
          userId: "EMP001",
          firstName: "John",
          lastName: "Smith",
          email: "john.smith@company.com",
          role: "Employee",
          managerId: "MGR001",
          managerName: "Sarah Johnson",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP002",
          firstName: "Alice",
          lastName: "Brown",
          email: "alice.brown@company.com",
          role: "Employee",
          managerId: "MGR001",
          managerName: "Sarah Johnson",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP003",
          firstName: "Robert",
          lastName: "Davis",
          email: "robert.davis@company.com",
          role: "Employee",
          managerId: "MGR002",
          managerName: "Michael Chen",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP004",
          firstName: "Emma",
          lastName: "Wilson",
          email: "emma.wilson@company.com",
          role: "Employee",
          managerId: "MGR003",
          managerName: "Emily Rodriguez",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP005",
          firstName: "James",
          lastName: "Miller",
          email: "james.miller@company.com",
          role: "Employee",
          managerId: "MGR001",
          managerName: "Sarah Johnson",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP006",
          firstName: "Sophia",
          lastName: "Garcia",
          email: "sophia.garcia@company.com",
          role: "Employee",
          managerId: "MGR004",
          managerName: "David Williams",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP007",
          firstName: "William",
          lastName: "Martinez",
          email: "william.martinez@company.com",
          role: "Employee",
          managerId: "MGR003",
          managerName: "Emily Rodriguez",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP008",
          firstName: "Olivia",
          lastName: "Lee",
          email: "olivia.lee@company.com",
          role: "Employee",
          managerId: "MGR002",
          managerName: "Michael Chen",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP009",
          firstName: "Ethan",
          lastName: "Thompson",
          email: "ethan.thompson@company.com",
          role: "Employee",
          managerId: "MGR005",
          managerName: "Jessica Anderson",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "EMP010",
          firstName: "Ava",
          lastName: "White",
          email: "ava.white@company.com",
          role: "Employee",
          managerId: "MGR006",
          managerName: "Robert Taylor",
          status: "Active",
          department: "Development",
          accessLevel: "Employee"
        },
        {
          userId: "MGR001",
          firstName: "Sarah",
          lastName: "Johnson",
          email: "sarah.johnson@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        },
        {
          userId: "MGR002",
          firstName: "Michael",
          lastName: "Chen",
          email: "michael.chen@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        },
        {
          userId: "MGR003",
          firstName: "Emily",
          lastName: "Rodriguez",
          email: "emily.rodriguez@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        },
        {
          userId: "MGR004",
          firstName: "David",
          lastName: "Williams",
          email: "david.williams@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        },
        {
          userId: "MGR005",
          firstName: "Jessica",
          lastName: "Anderson",
          email: "jessica.anderson@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        },
        {
          userId: "MGR006",
          firstName: "Robert",
          lastName: "Taylor",
          email: "robert.taylor@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        },
        {
          userId: "MGR007",
          firstName: "Lisa",
          lastName: "Martinez",
          email: "lisa.martinez@company.com",
          role: "Manager",
          managerId: null,
          managerName: null,
          status: "Active",
          department: "Development",
          accessLevel: "Manager"
        }
      ];
    },

    _getSampleProjects: function() {
      return [
        {
          projectId: "PRJ001",
          name: "E-Commerce Platform",
          description: "Development of new e-commerce platform with payment integration",
          managerId: "MGR001",
          managerName: "Sarah Johnson",
          budget: 500000,
          allocatedHours: 2400,
          usedHours: 0,
          startDate: "2024-02-01",
          endDate: "2024-08-31",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ002",
          name: "Mobile Banking App",
          description: "iOS and Android mobile banking application",
          managerId: "MGR001",
          managerName: "Sarah Johnson",
          budget: 750000,
          allocatedHours: 3200,
          usedHours: 0,
          startDate: "2024-03-01",
          endDate: "2024-09-30",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ003",
          name: "CRM System Upgrade",
          description: "Upgrade existing CRM system to latest version",
          managerId: "MGR002",
          managerName: "Michael Chen",
          budget: 350000,
          allocatedHours: 1800,
          usedHours: 0,
          startDate: "2024-01-15",
          endDate: "2024-06-30",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ004",
          name: "Data Analytics Dashboard",
          description: "Business intelligence and analytics dashboard",
          managerId: "MGR003",
          managerName: "Emily Rodriguez",
          budget: 420000,
          allocatedHours: 2000,
          usedHours: 0,
          startDate: "2024-02-15",
          endDate: "2024-07-31",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ005",
          name: "Cloud Migration",
          description: "Migrate on-premise infrastructure to AWS cloud",
          managerId: "MGR004",
          managerName: "David Williams",
          budget: 850000,
          allocatedHours: 3600,
          usedHours: 0,
          startDate: "2024-03-01",
          endDate: "2024-10-31",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ006",
          name: "HR Portal",
          description: "Employee self-service HR portal",
          managerId: "MGR005",
          managerName: "Jessica Anderson",
          budget: 280000,
          allocatedHours: 1600,
          usedHours: 0,
          startDate: "2024-01-01",
          endDate: "2024-05-31",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ007",
          name: "Inventory Management System",
          description: "Warehouse inventory tracking system",
          managerId: "MGR006",
          managerName: "Robert Taylor",
          budget: 380000,
          allocatedHours: 2200,
          usedHours: 0,
          startDate: "2024-02-10",
          endDate: "2024-08-15",
          status: "Active",
          client: "Internal",
          teamMembers: []
        },
        {
          projectId: "PRJ008",
          name: "Customer Support Portal",
          description: "24/7 customer support and ticketing system",
          managerId: "MGR007",
          managerName: "Lisa Martinez",
          budget: 320000,
          allocatedHours: 1920,
          usedHours: 0,
          startDate: "2024-01-20",
          endDate: "2024-07-20",
          status: "Active",
          client: "Internal",
          teamMembers: []
        }
      ];
    },

    _getProjectHoursData: function() {
      return [
        {
          projectId: "PRJ001",
          projectName: "E-Commerce Platform",
          allocatedHours: 2400,
          bookedHours: 0,
          remainingHours: 2400,
          utilization: 0
        },
        {
          projectId: "PRJ002",
          projectName: "Mobile Banking App",
          allocatedHours: 3200,
          bookedHours: 0,
          remainingHours: 3200,
          utilization: 0
        },
        {
          projectId: "PRJ003",
          projectName: "CRM System Upgrade",
          allocatedHours: 1800,
          bookedHours: 0,
          remainingHours: 1800,
          utilization: 0
        },
        {
          projectId: "PRJ004",
          projectName: "Data Analytics Dashboard",
          allocatedHours: 2000,
          bookedHours: 0,
          remainingHours: 2000,
          utilization: 0
        },
        {
          projectId: "PRJ005",
          projectName: "Cloud Migration",
          allocatedHours: 3600,
          bookedHours: 0,
          remainingHours: 3600,
          utilization: 0
        },
        {
          projectId: "PRJ006",
          projectName: "HR Portal",
          allocatedHours: 1600,
          bookedHours: 0,
          remainingHours: 1600,
          utilization: 0
        },
        {
          projectId: "PRJ007",
          projectName: "Inventory Management System",
          allocatedHours: 2200,
          bookedHours: 0,
          remainingHours: 2200,
          utilization: 0
        },
        {
          projectId: "PRJ008",
          projectName: "Customer Support Portal",
          allocatedHours: 1920,
          bookedHours: 0,
          remainingHours: 1920,
          utilization: 0
        }
      ];
    },

    _getManagerTeamsData: function() {
      return [
        {
          managerId: "MGR001",
          managerName: "Sarah Johnson",
          teamSize: 3,
          totalProjects: 2,
          totalBookedHours: 0,
          avgUtilization: 0
        },
        {
          managerId: "MGR002",
          managerName: "Michael Chen",
          teamSize: 2,
          totalProjects: 1,
          totalBookedHours: 0,
          avgUtilization: 0
        },
        {
          managerId: "MGR003",
          managerName: "Emily Rodriguez",
          teamSize: 2,
          totalProjects: 1,
          totalBookedHours: 0,
          avgUtilization: 0
        },
        {
          managerId: "MGR004",
          managerName: "David Williams",
          teamSize: 1,
          totalProjects: 1,
          totalBookedHours: 0,
          avgUtilization: 0
        },
        {
          managerId: "MGR005",
          managerName: "Jessica Anderson",
          teamSize: 1,
          totalProjects: 1,
          totalBookedHours: 0,
          avgUtilization: 0
        },
        {
          managerId: "MGR006",
          managerName: "Robert Taylor",
          teamSize: 1,
          totalProjects: 1,
          totalBookedHours: 0,
          avgUtilization: 0
        },
        {
          managerId: "MGR007",
          managerName: "Lisa Martinez",
          teamSize: 0,
          totalProjects: 1,
          totalBookedHours: 0,
          avgUtilization: 0
        }
      ];
    },

    _getProjectDurationsData: function() {
      return [
        {
          projectId: "PRJ001",
          projectName: "E-Commerce Platform",
          startDate: "2024-02-01",
          endDate: "2024-08-31",
          durationDays: 212,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ002",
          projectName: "Mobile Banking App",
          startDate: "2024-03-01",
          endDate: "2024-09-30",
          durationDays: 214,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ003",
          projectName: "CRM System Upgrade",
          startDate: "2024-01-15",
          endDate: "2024-06-30",
          durationDays: 167,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ004",
          projectName: "Data Analytics Dashboard",
          startDate: "2024-02-15",
          endDate: "2024-07-31",
          durationDays: 167,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ005",
          projectName: "Cloud Migration",
          startDate: "2024-03-01",
          endDate: "2024-10-31",
          durationDays: 245,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ006",
          projectName: "HR Portal",
          startDate: "2024-01-01",
          endDate: "2024-05-31",
          durationDays: 151,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ007",
          projectName: "Inventory Management System",
          startDate: "2024-02-10",
          endDate: "2024-08-15",
          durationDays: 187,
          daysRemaining: 0,
          timelineStatus: "On Track"
        },
        {
          projectId: "PRJ008",
          projectName: "Customer Support Portal",
          startDate: "2024-01-20",
          endDate: "2024-07-20",
          durationDays: 182,
          daysRemaining: 0,
          timelineStatus: "On Track"
        }
      ];
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
        oModel.refresh(); // Ensure table updates
        MessageToast.show(`User ${oUser.status.toLowerCase()} successfully`);
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
                new Input({ value: "{/userData/firstName}", required: true, valueStateText: "First Name is required" }),
                
                new Label({ text: "Last Name" }),
                new Input({ value: "{/userData/lastName}", required: true, valueStateText: "Last Name is required" }),
                
                new Label({ text: "Email" }),
                new Input({ value: "{/userData/email}", type: "Email", required: true, valueStateText: "Valid Email is required" }),
                
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
                    template: new Item({ key: "{userId}", text: "{firstName} {lastName}" })
                  },
                  forceSelection: false // Allow empty selection
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
      var oUserData = JSON.parse(JSON.stringify(oViewModel.getProperty("/userData"))); // Deep copy to avoid reference issues
      var sMode = oViewModel.getProperty("/mode");
      
      var oModel = this.getView().getModel();
      var aUsers = oModel.getProperty("/users").slice(); // Create a copy to trigger binding update
      
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
      var bEmailExists = aUsers.some(user => user.email === oUserData.email && (sMode === "create" || user.userId !== oUserData.userId));
      if (bEmailExists) {
        MessageToast.show("Email address already exists");
        return;
      }
      
      if (sMode === "create") {
        // Generate new user ID
        var sRolePrefix = oUserData.role.substring(0, 3).toUpperCase();
        var iMaxId = 0;
        
        aUsers.forEach(function(user) {
          if (user.userId.startsWith(sRolePrefix)) {
            var iId = parseInt(user.userId.substring(3)) || 0;
            if (iId > iMaxId) iMaxId = iId;
          }
        });
        
        oUserData.userId = sRolePrefix + String(iMaxId + 1).padStart(3, '0');
        oUserData.status = oUserData.status || "Active"; // Ensure status is set
        aUsers.push(oUserData);
      } else {
        // Update existing user
        var iIndex = aUsers.findIndex(user => user.userId === oUserData.userId);
        if (iIndex !== -1) {
          aUsers[iIndex] = oUserData;
        }
      }
      
      // Update manager names for employees
      aUsers.forEach(function(user) {
        if (user.role === "Employee" && user.managerId) {
          var oManager = aUsers.find(m => m.userId === user.managerId);
          if (oManager) {
            user.managerName = oManager.firstName + " " + oManager.lastName;
          } else {
            user.managerId = null;
            user.managerName = null;
          }
        }
      });
      
      // Update the model and refresh to ensure table updates
      oModel.setProperty("/users", aUsers);
      oModel.refresh(true); // Force table refresh
      oDialog.close();
      MessageToast.show(`User ${sMode === 'create' ? 'created' : 'updated'} successfully`);
      
      // Refresh manager teams data to reflect any changes
      this._refreshAnalyticsData();
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
        `Are you sure you want to delete project "${oSelectedProject.name}"?`,
        {
          title: "Delete Project",
          onClose: function(sAction) {
            if (sAction === MessageBox.Action.OK) {
              var oModel = this.getView().getModel();
              var aProjects = oModel.getProperty("/projects");
              var aFilteredProjects = aProjects.filter(project => project.projectId !== oSelectedProject.projectId);
              
              oModel.setProperty("/projects", aFilteredProjects);
              oModel.refresh(true); // Ensure table updates
              this._refreshAnalyticsData();
              MessageToast.show("Project deleted successfully");
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
                new Input({value: "{/projectData/name}", required: true}),
                
                new Label({text: "Description"}),
                new Input({value: "{/projectData/description}"}),
                
                new Label({text: "Project Manager"}),
                new Select({
                  selectedKey: "{/projectData/managerId}",
                  items: {
                    path: "/managers",
                    template: new Item({key: "{userId}", text: "{firstName} {lastName}"})
                  }
                }),
                
                new Label({text: "Budget ($)"}),
                new Input({value: "{/projectData/budget}", type: "Number"}),
                
                new Label({text: "Allocated Hours"}),
                new Input({value: "{/projectData/allocatedHours}", type: "Number"}),
                
                new Label({text: "Start Date"}),
                new DatePicker({value: "{/projectData/startDate}", valueFormat: "yyyy-MM-dd"}),
                
                new Label({text: "End Date"}),
                new DatePicker({value: "{/projectData/endDate}", valueFormat: "yyyy-MM-dd"}),
                
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
      
      // Set up the model for the dialog
      var oViewModel = new JSONModel({
        mode: sMode,
        projectData: oProjectData ? JSON.parse(JSON.stringify(oProjectData)) : {},
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
      
      var oModel = this.getView().getModel();
      var aProjects = oModel.getProperty("/projects").slice();
      
      // Validate required fields
      if (!oProjectData.name) {
        MessageToast.show("Project name is required");
        return;
      }
      
      if (sMode === "create") {
        // Generate new project ID
        var iMaxId = 0;
        aProjects.forEach(function(project) {
          var iId = parseInt(project.projectId.substring(3)) || 0;
          if (iId > iMaxId) iMaxId = iId;
        });
        
        oProjectData.projectId = "PRJ" + String(iMaxId + 1).padStart(3, '0');
        oProjectData.usedHours = 0;
        oProjectData.teamMembers = [];
        aProjects.push(oProjectData);
      } else {
        // Update existing project
        var iIndex = aProjects.findIndex(project => project.projectId === oProjectData.projectId);
        if (iIndex !== -1) {
          aProjects[iIndex] = oProjectData;
        }
      }
      
      // Update manager names
      aProjects.forEach(function(project) {
        var oManager = this._getManagersList().find(m => m.userId === project.managerId);
        if (oManager) {
          project.managerName = oManager.firstName + " " + oManager.lastName;
        }
      }.bind(this));
      
      oModel.setProperty("/projects", aProjects);
      oModel.refresh(true);
      this._refreshAnalyticsData();
      oDialog.close();
      MessageToast.show(`Project ${sMode === 'create' ? 'created' : 'updated'} successfully`);
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
      var aProjects = oModel.getProperty("/projects");
      var aUsers = oModel.getProperty("/users");
      
      // Update project hours data
      var aProjectHours = aProjects.map(function(project) {
        return {
          projectId: project.projectId,
          projectName: project.name,
          allocatedHours: project.allocatedHours,
          bookedHours: project.usedHours,
          remainingHours: project.allocatedHours - project.usedHours,
          utilization: Math.round((project.usedHours / project.allocatedHours) * 100) || 0
        };
      });
      
      // Update manager teams data
      var aManagerTeams = this._getManagersList().map(function(manager) {
        var aTeamMembers = aUsers.filter(user => user.managerId === manager.userId && user.status === "Active");
        var aManagerProjects = aProjects.filter(project => project.managerId === manager.userId);
        
        var totalBookedHours = 0;
        aManagerProjects.forEach(function(project) {
          totalBookedHours += project.usedHours;
        });
        
        var totalAllocatedHours = 0;
        aManagerProjects.forEach(function(project) {
          totalAllocatedHours += project.allocatedHours;
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
      
      oModel.setProperty("/projectHours", aProjectHours);
      oModel.setProperty("/managerTeams", aManagerTeams);
      oModel.setProperty("/projectDurations", aProjectDurations);
      oModel.refresh(true);
    },

    // Utility Functions
    formatCurrency: function(fValue) {
      if (!fValue) return "$0.00";
      return "$" + fValue.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    onRefreshUsers: function() {
      var oModel = this.getView().getModel();
      oModel.refresh(true);
      MessageToast.show("Users data refreshed");
    },

    onRefreshProjects: function() {
      var oModel = this.getView().getModel();
      oModel.refresh(true);
      MessageToast.show("Projects data refreshed");
    }
  });
});