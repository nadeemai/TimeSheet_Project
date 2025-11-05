using { my.timesheet as timesheet } from '../db/schema';

/**
 * Employee Service - For Employees to manage their timesheets
 */
@(requires: 'Employee')
@impl: './employee-service.js'
service EmployeeService {

  // Employee Profile
  @readonly
  entity MyProfile as select from timesheet.Employees {
    *,
    managerID.firstName || ' ' || managerID.lastName as managerName : String,
    managerID.email as managerEmail : String
  } where ID = $user.id;

  // ✅ My Projects - Simple view, aggregation done in handler
  @readonly
  @cds.redirection.target
  entity MyProjects as projection on timesheet.Projects;

  // Available Activities - can be filtered by project
  @readonly
  entity AvailableActivities as select from timesheet.Activities {
    *,
    project.projectName,
    project.projectRole,
    project.ID as projectID : UUID
  } where status = 'Active';

  // Available Non-Project Types
  @readonly
  entity AvailableNonProjectTypes as select from timesheet.NonProjectTypes {
    *
  } where isActive = true;

  // My Timesheets - employees can work on any project
  @cds.redirection.target
  entity MyTimesheets as select from timesheet.Timesheets {
    *,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    activity.activity as activityName : String,
    project.projectName as projectName : String,
    project.projectRole as projectRole : String,
    nonProjectType.typeName as nonProjectTypeName : String,
    approvedBy.firstName || ' ' || approvedBy.lastName as approvedByName : String
  } where employee.ID = $user.id;

  // Progress summary for Reports view
  @readonly
  entity MyProgressSummary as select from timesheet.Timesheets {
    key ID,
    employee.ID as employeeID : UUID,
    employee.employeeID as empID : String,
    project.ID as projectID : UUID,
    project.projectID as projectCode : String,
    project.projectName,
    project.allocatedHours,
    project.startDate,
    project.endDate,
    hoursWorked,
    project.projectRole,
    activity.activity as activityName,
    activity.activityType,
    workDate,
    task,
    status,
    isBillable
  } where employee.ID = $user.id;

  // ✅ Booked Hours Overview - Simple view, aggregation in handler
  @readonly
  entity BookedHoursOverview as projection on timesheet.Projects;

  // ✅ Project Engagement Duration - Simple view, calculations in handler
  @readonly
  entity ProjectEngagementDuration as projection on timesheet.Projects;

  // Daily summary
  @readonly
  entity MyDailySummary as select from timesheet.Timesheets {
    key ID,
    workDate,
    employee.ID as employeeID : UUID,
    hoursWorked as totalHours : Decimal(4,2),
    task
  } where employee.ID = $user.id;

  // Actions
  action submitTimesheet(timesheetID: String) returns String;
  action updateTimesheet(timesheetID: String, hours: Decimal, taskDetails: String) returns String;

  // Function
  function validateDailyHours(date: Date) returns Decimal;
}

/**
 * Manager Service - For Managers to assign projects and monitor team
 */
@(requires: 'Manager')
@impl: './manager-service.js'
service ManagerService {

  @readonly
  @cds.redirection.target
  entity MyManagerProfile as select from timesheet.Employees {
    *
  } where ID = $user.id;

  @readonly
  entity MyTeam as select from timesheet.Employees {
    *,
    managerID.firstName || ' ' || managerID.lastName as managerName : String
  } where managerID.ID = $user.id;

  @cds.redirection.target
  entity MyProjects as select from timesheet.Projects {
    *,
    projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
  } where projectOwner.ID = $user.id;

  @readonly
  @cds.redirection.target
  entity TeamTimesheets as select from timesheet.Timesheets {
    *,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    employee.employeeID as employeeEmpID : String,
    project.projectName,
    project.projectRole,
    activity.activity as activityName : String,
    nonProjectType.typeName as nonProjectTypeName : String
  } where employee.managerID.ID = $user.id;

  @readonly
  entity MyNotifications as select from timesheet.Notifications {
    *,
    recipient.firstName || ' ' || recipient.lastName as recipientName : String
  } where recipient.ID = $user.id;

  @readonly
  entity TeamProgressReport as select from timesheet.Timesheets {
    key ID,
    employee.ID as employeeID : UUID,
    employee.employeeID as empID : String,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    project.ID as projectID : UUID,
    project.projectID as projID : String,
    project.projectName,
    project.projectRole,
    project.allocatedHours,
    activity.activity as activityName,
    activity.activityType as activityType : String,
    workDate,
    hoursWorked as totalBookedHours : Decimal(10,2),
    task,
    status
  } where employee.managerID.ID = $user.id;

  @readonly
  entity ProjectSummary as select from timesheet.Projects {
    key ID as projectID : UUID,
    projectID as projID : String,
    projectName,
    projectRole,
    allocatedHours,
    startDate,
    endDate,
    status
  } where projectOwner.ID = $user.id;

  @readonly
  entity AllEmployees as select from timesheet.Employees {
    *,
    userRole.roleName as roleName : String
  } where isActive = true;

  @readonly
  entity AllProjects as select from timesheet.Projects {
    *
  } where status = 'Active';

  // Manager Actions
  action approveTimesheet(timesheetID: String) returns String;
  action rejectTimesheet(timesheetID: String, reason: String) returns String;
  action assignProjectToEmployee(employeeID: String, projectID: String) returns String;
}

/**
 * Admin Service - For Administrators to manage system
 */
@(requires: 'Admin')
@impl: './admin-service.js'
service AdminService {

  @cds.redirection.target
  entity Employees as select from timesheet.Employees {
    *,
    managerID.firstName || ' ' || managerID.lastName as managerName : String,
    userRole.roleName as roleName : String
  };

  @cds.redirection.target
  entity UserRoles as select from timesheet.UserRoles {
    *
  };

  @cds.redirection.target
  entity Activities as select from timesheet.Activities {
    *,
    project.projectName,
    project.projectRole
  };

  @cds.redirection.target
  entity NonProjectTypes as select from timesheet.NonProjectTypes {
    *
  };

  @cds.redirection.target
  entity Projects as select from timesheet.Projects {
    *,
    projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
  };

  @readonly
  @cds.redirection.target
  entity Timesheets as select from timesheet.Timesheets {
    *,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    employee.employeeID as employeeEmpID : String,
    employee.managerID.firstName || ' ' || employee.managerID.lastName as employeeManager : String,
    project.projectName,
    project.projectRole,
    activity.activity as activityName : String,
    nonProjectType.typeName as nonProjectTypeName : String
  };

  @readonly
  entity Notifications as select from timesheet.Notifications {
    *,
    recipient.firstName || ' ' || recipient.lastName as recipientName : String
  };

  @readonly
  entity OverallProgressReport as select from timesheet.Timesheets {
    key ID,
    employee.managerID.ID as managerID : UUID,
    employee.managerID.employeeID as managerEmpID : String,
    employee.managerID.firstName || ' ' || employee.managerID.lastName as managerName : String,
    employee.ID as employeeID : UUID,
    employee.employeeID as empID : String,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    project.ID as projectID : UUID,
    project.projectID as projID : String,
    project.projectName,
    project.projectRole,
    project.allocatedHours,
    project.budget,
    activity.activity as activityName,
    activity.activityType as activityType : String,
    workDate,
    hoursWorked as totalBookedHours : Decimal(10,2),
    task,
    taskDetails,
    status
  };

  @readonly
  entity RoleSummary as select from timesheet.UserRoles {
    ID,
    roleID,
    roleName,
    description
  };

  // Admin Actions
  action createEmployee(employeeID: String, firstName: String, lastName: String,
    email: String, managerEmployeeID: String, roleID: String) returns String;
  action createRole(roleID: String, roleName: String, description: String) returns String;
  action createActivity(activityID: String, activity: String, activityType: String, 
    projectID: String, isBillable: Boolean, plannedHours: Integer, startDate: Date, endDate: Date) returns String;
  action createNonProjectType(nonProjectTypeID: String, typeName: String, description: String, isBillable: Boolean) returns String;
  action createProject(projectID: String, projectName: String, description: String, 
    startDate: Date, endDate: Date, projectRole: String, budget: Decimal, allocatedHours: Integer, 
    projectOwnerID: String, isBillable: Boolean) returns String;
  action assignEmployeeToManager(employeeID: String, managerEmployeeID: String) returns String;
  action assignProjectToEmployee(employeeID: String, projectID: String) returns String;
  action deactivateEmployee(employeeID: String) returns String;
  action deactivateManager(employeeID: String) returns String;
  action updateEmployeeDetails(employeeID: String, firstName: String, lastName: String, email: String) returns String;
  action updateRoleDetails(roleID: String, roleName: String, description: String) returns String;
  action updateActivity(activityID: String, activity: String, activityType: String, 
    projectID: String, isBillable: Boolean, plannedHours: Integer, startDate: Date, endDate: Date, status: String) returns String;
  action updateNonProjectType(nonProjectTypeID: String, typeName: String, description: String, isBillable: Boolean, isActive: Boolean) returns String;
  action updateProject(projectID: String, projectName: String, description: String, 
    projectRole: String, budget: Decimal, allocatedHours: Integer, status: String) returns String;
  action approveTimesheet(timesheetID: String) returns String;
  action rejectTimesheet(timesheetID: String, reason: String) returns String;
}