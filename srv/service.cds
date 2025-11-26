using {my.timesheet as timesheet} from '../db/schema';
using from './user-api';

/**
 * Employee Service - For Employees to manage their timesheets
 */
@impl: './employee-service.js'
service EmployeeService @(requires: 'authenticated-user') {

  // ✅ CHANGED: email = $user.id instead of ID = $user.id
  @readonly
  entity MyProfile as
    select from timesheet.Employees {
      key ID,
          employeeID,
          firstName,
          lastName,
          email,
          isActive,
          userRole,
          managerID,
          createdAt,
          modifiedAt,
          createdBy,
          modifiedBy,
          managerID.firstName || ' ' || managerID.lastName as managerName  : String,
          managerID.email                                  as managerEmail : String
    }
    where
      email = $user.id ;
         // ✅ CHANGED


  @readonly
  @cds.redirection.target
  entity MyProjects as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    };

  @readonly
  entity AssignedProjectsList as
    select from timesheet.Projects {
      key ID,
          projectID,
          projectName,
          projectRole,
          status
    };

  @readonly
  entity AvailableActivities as
    select from timesheet.Activities {
      *,
      project.projectName,
      project.projectRole,
      project.ID as projectID : UUID
    }
    where
      status = 'Active';

  @readonly
  entity AvailableNonProjectTypes as
    select from timesheet.NonProjectTypes {
      *
    }
    where
      isActive = true;

  @readonly
  entity AvailableTaskTypes {
    key code          : String  @title: 'Task Code';
        name          : String  @title: 'Task Name';
        description   : String  @title: 'Description';
        isProjectTask : Boolean @title: 'For Project Work';
  };

  // ✅ CHANGED: employee.email = $user.id
  @cds.redirection.target
  entity MyTimesheets as
    projection on timesheet.Timesheets {
      key ID,
          timesheetID,
          weekStartDate,
          weekEndDate,
          task,
          taskDetails,
          totalWeekHours,
          status,
          isBillable,
          createdAt,
          modifiedAt,
          createdBy,
          modifiedBy,

          employee.ID                                        as employee_ID        : UUID,
          employee.firstName || ' ' || employee.lastName     as employeeName       : String,

          project.ID                                         as project_ID         : UUID,
          project.projectName                                as projectName        : String,
          project.projectRole                                as projectRole        : String,

          activity.ID                                        as activity_ID        : UUID,
          activity.activity                                  as activityName       : String,

          nonProjectType.ID                                  as nonProjectType_ID  : UUID,
          nonProjectType.typeName                            as nonProjectTypeName : String,

          approvedBy.ID                                      as approvedBy_ID      : UUID,
          approvedBy.firstName || ' ' || approvedBy.lastName as approvedByName     : String,
          approvalDate,

          mondayDate,
          mondayDay,
          mondayHours,
          mondayTaskDetails,

          tuesdayDate,
          tuesdayDay,
          tuesdayHours,
          tuesdayTaskDetails,

          wednesdayDate,
          wednesdayDay,
          wednesdayHours,
          wednesdayTaskDetails,

          thursdayDate,
          thursdayDay,
          thursdayHours,
          thursdayTaskDetails,

          fridayDate,
          fridayDay,
          fridayHours,
          fridayTaskDetails,

          saturdayDate,
          saturdayDay,
          saturdayHours,
          saturdayTaskDetails,

          sundayDate,
          sundayDay,
          sundayHours,
          sundayTaskDetails,
    }
    where
      employee.email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: employee.email = $user.id
  @readonly
  entity MyProgressSummary as
    select from timesheet.Timesheets {
      key ID,
          employee.ID         as employeeID  : UUID,
          employee.employeeID as empID       : String,
          project.ID          as projectID   : UUID,
          project.projectID   as projectCode : String,
          project.projectName,
          project.allocatedHours,
          project.startDate,
          project.endDate,
          totalWeekHours,
          project.projectRole,
          activity.activity   as activityName,
          activity.activityType,
          weekStartDate,
          weekEndDate,
          task,
          status,
          isBillable
    }
    where
      employee.email = $user.id;  // ✅ CHANGED

  @readonly
  entity BookedHoursOverview as projection on timesheet.Projects;

  @readonly
  entity ProjectEngagementDuration as projection on timesheet.Projects;

  // ✅ CHANGED: employee.email = $user.id
  @readonly
  entity MyDailySummary as
    select from timesheet.Timesheets {
      key ID,
          weekStartDate,
          weekEndDate,
          employee.ID         as employeeID  : UUID,
          mondayHours,
          mondayDate,
          mondayDay,
          tuesdayHours,
          tuesdayDate,
          tuesdayDay,
          wednesdayHours,
          wednesdayDate,
          wednesdayDay,
          thursdayHours,
          thursdayDate,
          thursdayDay,
          fridayHours,
          fridayDate,
          fridayDay,
          saturdayHours,
          saturdayDate,
          saturdayDay,
          sundayHours,
          sundayDate,
          sundayDay,
          totalWeekHours,
          task,
          project.projectName as projectName : String
    }
    where
      employee.email = $user.id;  // ✅ CHANGED

  action   submitTimesheet(timesheetID: String) returns String;
  action   updateTimesheet(timesheetID: String, weekData: String) returns String;
  function validateDailyHours(date: Date) returns Decimal;
  function getWeekBoundaries(date: Date) returns {
    weekStart : Date;
    weekEnd   : Date;
  };
}

/**
 * Manager Service - For Managers to assign projects and monitor team
 */
@(requires: 'Manager')
@impl: './manager-service.js'
service ManagerService {

  // ✅ CHANGED: email = $user.id
  @readonly
  @cds.redirection.target
  entity MyManagerProfile as
    select from timesheet.Employees {
      *
    }
    where
      email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: managerID.email = $user.id
  @readonly
  entity MyTeam as
    select from timesheet.Employees {
      *,
      managerID.firstName || ' ' || managerID.lastName as managerName : String
    }
    where
      managerID.email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: projectOwner.email = $user.id
  @cds.redirection.target
  entity MyProjects as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    }
    where
      projectOwner.email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: employee.managerID.email = $user.id
  @readonly
  @cds.redirection.target
  entity TeamTimesheets as
    select from timesheet.Timesheets {
      *,
      employee.firstName || ' ' || employee.lastName as employeeName       : String,
      employee.employeeID                            as employeeEmpID      : String,
      project.projectName,
      project.projectRole,
      activity.activity                              as activityName       : String,
      nonProjectType.typeName                        as nonProjectTypeName : String
    }
    where
      employee.managerID.email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: recipient.email = $user.id
  @readonly
  entity MyNotifications as
    select from timesheet.Notifications {
      *,
      recipient.firstName || ' ' || recipient.lastName as recipientName : String
    }
    where
      recipient.email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: employee.managerID.email = $user.id
  @readonly
  entity TeamProgressReport as
    select from timesheet.Timesheets {
      key ID,
          employee.ID                                    as employeeID       : UUID,
          employee.employeeID                            as empID            : String,
          employee.firstName || ' ' || employee.lastName as employeeName     : String,
          project.ID                                     as projectID        : UUID,
          project.projectID                              as projID           : String,
          project.projectName,
          project.projectRole,
          project.allocatedHours,
          activity.activity                              as activityName,
          activity.activityType                          as activityType     : String,
          weekStartDate,
          weekEndDate,
          totalWeekHours                                 as totalBookedHours : Decimal(10, 2),
          task,
          status
    }
    where
      employee.managerID.email = $user.id;  // ✅ CHANGED

  // ✅ CHANGED: projectOwner.email = $user.id
  @readonly
  entity ProjectSummary as
    select from timesheet.Projects {
      key ID        as projectID : UUID,
          projectID as projID    : String,
          projectName,
          projectRole,
          allocatedHours,
          startDate,
          endDate,
          status
    }
    where
      projectOwner.email = $user.id;  // ✅ CHANGED

  @readonly
  entity AvailableManagers as
    select from timesheet.Employees {
      *,
      userRole.roleName as roleName : String
    }
    where
          isActive          = true
      and userRole.roleName = 'Manager';

  @readonly
  entity AllEmployees as
    select from timesheet.Employees {
      *,
      userRole.roleName as roleName : String
    }
    where
      isActive = true;

  @readonly
  entity AllProjects as
    select from timesheet.Projects {
      *
    }
    where
      status = 'Active';

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
  entity Employees as
    select from timesheet.Employees {
      *,
      managerID.firstName || ' ' || managerID.lastName as managerName : String,
      userRole.roleName                                as roleName    : String
    } order by employeeID asc;

  @cds.redirection.target
  entity ProjectAssignments as
    select from timesheet.ProjectAssignments {
      *,
      employee.firstName || ' ' || employee.lastName     as employeeName   : String,
      employee.employeeID                                as employeeEmpID  : String,
      project.projectName,
      project.projectID                                  as projectCode    : String,
      assignedBy.firstName || ' ' || assignedBy.lastName as assignedByName : String
    };

  @cds.redirection.target
  entity UserRoles as
    select from timesheet.UserRoles {
      *
    };

  @cds.redirection.target
  entity Activities as
    select from timesheet.Activities {
      *,
      project.projectName,
      project.projectRole
    };

  @cds.redirection.target
  entity NonProjectTypes as
    select from timesheet.NonProjectTypes {
      *
    };

  @cds.redirection.target
  entity Projects as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    };

  @readonly
  @cds.redirection.target
  entity Timesheets as
    select from timesheet.Timesheets {
      *,
      employee.firstName || ' ' || employee.lastName                     as employeeName       : String,
      employee.employeeID                                                as employeeEmpID      : String,
      employee.managerID.firstName || ' ' || employee.managerID.lastName as employeeManager    : String,
      project.projectName,
      project.projectRole,
      activity.activity                                                  as activityName       : String,
      nonProjectType.typeName                                            as nonProjectTypeName : String
    };

  @readonly
  entity Notifications as
    select from timesheet.Notifications {
      *,
      recipient.firstName || ' ' || recipient.lastName as recipientName : String
    };

  @readonly
  entity OverallProgressReport as
    select from timesheet.Timesheets {
      key ID,
          employee.managerID.ID                                              as managerID        : UUID,
          employee.managerID.employeeID                                      as managerEmpID     : String,
          employee.managerID.firstName || ' ' || employee.managerID.lastName as managerName      : String,
          employee.ID                                                        as employeeID       : UUID,
          employee.employeeID                                                as empID            : String,
          employee.firstName || ' ' || employee.lastName                     as employeeName     : String,
          project.ID                                                         as projectID        : UUID,
          project.projectID                                                  as projID           : String,
          project.projectName,
          project.projectRole,
          project.allocatedHours,
          project.budget,
          activity.activity                                                  as activityName,
          activity.activityType                                              as activityType     : String,
          weekStartDate,
          weekEndDate,
          totalWeekHours                                                     as totalBookedHours : Decimal(10, 2),
          task,
          taskDetails,
          status
    };

  @readonly
  entity RoleSummary as
    select from timesheet.UserRoles {
      ID,
      roleID,
      roleName,
      description
    };

  @readonly
  entity AvailableManagers as
    select from timesheet.Employees {
      *,
      userRole.roleName as roleName : String
    }
    where
          isActive          = true
      and userRole.roleName = 'Manager';

  action createEmployee(employeeID: String, firstName: String, lastName: String, email: String, managerEmployeeID: String, roleID: String) returns String;
  action createRole(roleID: String, roleName: String, description: String) returns String;
  action createActivity(activityID: String, activity: String, activityType: String, projectID: String, isBillable: Boolean, plannedHours: Integer, startDate: Date, endDate: Date) returns String;
  action createNonProjectType(nonProjectTypeID: String, typeName: String, description: String, isBillable: Boolean) returns String;
  action createProject(projectID: String, projectName: String, description: String, startDate: Date, endDate: Date, projectRole: String, budget: Decimal, allocatedHours: Integer, projectOwnerID: String, isBillable: Boolean) returns String;
  action assignEmployeeToManager(employeeID: String, managerEmployeeID: String) returns String;
  action assignProjectToEmployee(employeeID: String, projectID: String) returns String;
  action deactivateEmployee(employeeID: String) returns String;
  action deactivateManager(employeeID: String) returns String;
  action updateEmployeeDetails(employeeID: String, firstName: String, lastName: String, email: String) returns String;
  action updateRoleDetails(roleID: String, roleName: String, description: String) returns String;
  action updateActivity(activityID: String, activity: String, activityType: String, projectID: String, isBillable: Boolean, plannedHours: Integer, startDate: Date, endDate: Date, status: String) returns String;
  action updateNonProjectType(nonProjectTypeID: String, typeName: String, description: String, isBillable: Boolean, isActive: Boolean) returns String;
  action updateProject(projectID: String, projectName: String, description: String, projectRole: String, budget: Decimal, allocatedHours: Integer, status: String) returns String;
  action approveTimesheet(timesheetID: String) returns String;
  action rejectTimesheet(timesheetID: String, reason: String) returns String;
  action deleteEmployeeTimesheets(employeeID: String) returns String;
  action deleteEmployeeTimesheetsByStatus(employeeID: String, status: String) returns String;
  action deleteTimesheet(timesheetID: String) returns String;
  action deleteTimesheetsByWeek(employeeID: String, weekStartDate: Date) returns String;
  action deleteAllTimesheets() returns String;
  action unassignProjectFromEmployee(employeeID: String, projectID: String) returns String;
  action deleteEmployee(employeeID: String) returns String;
  action changeEmployeeRole(employeeID: String, newRoleID: String) returns String;
}