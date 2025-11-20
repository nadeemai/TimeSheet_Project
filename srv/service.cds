using {my.timesheet as timesheet} from '../db/schema';
using from './user-api';

/**
 * Employee Service - For Employees to manage their timesheets
 */
@impl: './employee-service.js'
service EmployeeService @(requires: 'authenticated-user') {

  // Employee Profile
  @readonly
  entity MyProfile                 as
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
      ID = $user.id;


  @readonly
  @cds.redirection.target
  entity MyProjects                as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    };

  // Helper for UI - List of assigned projects
  @readonly
  entity AssignedProjectsList      as
    select from timesheet.Projects {
      key ID,
          projectID,
          projectName,
          projectRole,
          status
    };

  // Available Activities - can be filtered by project
  @readonly
  entity AvailableActivities       as
    select from timesheet.Activities {
      *,
      project.projectName,
      project.projectRole,
      project.ID as projectID : UUID
    }
    where
      status = 'Active';

  // Available Non-Project Types
  @readonly
  entity AvailableNonProjectTypes  as
    select from timesheet.NonProjectTypes {
      *
    }
    where
      isActive = true;

  // Available Task Types for dropdown
  @readonly
  entity AvailableTaskTypes {
    key code          : String  @title: 'Task Code';
        name          : String  @title: 'Task Name';
        description   : String  @title: 'Description';
        isProjectTask : Boolean @title: 'For Project Work';
  };

  //  My Timesheets
  @cds.redirection.target
  entity MyTimesheets              as
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

          // Employee info
          employee.ID                                        as employee_ID        : UUID,
          employee.firstName || ' ' || employee.lastName     as employeeName       : String,

          // Project info
          project.ID                                         as project_ID         : UUID,
          project.projectName                                as projectName        : String,
          project.projectRole                                as projectRole        : String,

          // Activity info
          activity.ID                                        as activity_ID        : UUID,
          activity.activity                                  as activityName       : String,

          // Non-project type info
          nonProjectType.ID                                  as nonProjectType_ID  : UUID,
          nonProjectType.typeName                            as nonProjectTypeName : String,

          // Approval info
          approvedBy.ID                                      as approvedBy_ID      : UUID,
          approvedBy.firstName || ' ' || approvedBy.lastName as approvedByName     : String,
          approvalDate,

          //  Monday data
          mondayDate,
          mondayDay,
          mondayHours,
          mondayTaskDetails,

          // Tuesday data
          tuesdayDate,
          tuesdayDay,
          tuesdayHours,
          tuesdayTaskDetails,

          //  Wednesday data
          wednesdayDate,
          wednesdayDay,
          wednesdayHours,
          wednesdayTaskDetails,

          // Thursday data
          thursdayDate,
          thursdayDay,
          thursdayHours,
          thursdayTaskDetails,

          // Friday data
          fridayDate,
          fridayDay,
          fridayHours,
          fridayTaskDetails,

          // Saturday data
          saturdayDate,
          saturdayDay,
          saturdayHours,
          saturdayTaskDetails,

          //Sunday data
          sundayDate,
          sundayDay,
          sundayHours,
          //
          sundayTaskDetails,

    // // Associations for CREATE/UPDATE
    // employee,
    // project,
    // activity,
    // nonProjectType,
    // approvedBy

    }
    where
      employee.ID = $user.id;

  // Progress summary for Reports view
  @readonly
  entity MyProgressSummary         as
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
      employee.ID = $user.id;

  //Booked Hours Overview
  @readonly
  entity BookedHoursOverview       as projection on timesheet.Projects;

  // Project Engagement Duration
  @readonly
  entity ProjectEngagementDuration as projection on timesheet.Projects;

  // Daily summary with date filter capability
  @readonly
  entity MyDailySummary            as
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
      employee.ID = $user.id;

  // Actions
  action   submitTimesheet(timesheetID: String)                                                                                        returns String;
  action   updateTimesheet(timesheetID: String, weekData: String)                                                                      returns String; //  accepts weekly data as JSON

  //Function to validate daily hours for a specific date
  function validateDailyHours(date: Date)                                                                                              returns Decimal;

  //  Function to get week boundaries for a date
  function getWeekBoundaries(date: Date)                                                                                               returns {
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

  @readonly
  @cds.redirection.target
  entity MyManagerProfile   as
    select from timesheet.Employees {
      *
    }
    where
      ID = $user.id;

  @readonly
  entity MyTeam             as
    select from timesheet.Employees {
      *,
      managerID.firstName || ' ' || managerID.lastName as managerName : String
    }
    where
      managerID.ID = $user.id;

  @cds.redirection.target
  entity MyProjects         as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    }
    where
      projectOwner.ID = $user.id;

  @readonly
  @cds.redirection.target
  entity TeamTimesheets     as
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
      employee.managerID.ID = $user.id;

  @readonly
  entity MyNotifications    as
    select from timesheet.Notifications {
      *,
      recipient.firstName || ' ' || recipient.lastName as recipientName : String
    }
    where
      recipient.ID = $user.id;

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
      employee.managerID.ID = $user.id;

  @readonly
  entity ProjectSummary     as
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
      projectOwner.ID = $user.id;

  //Get only employees who can be managers (for dropdown)
  @readonly
  entity AvailableManagers  as
    select from timesheet.Employees {
      *,
      userRole.roleName as roleName : String
    }
    where
          isActive          = true
      and userRole.roleName = 'Manager';

  @readonly
  entity AllEmployees       as
    select from timesheet.Employees {
      *,
      userRole.roleName as roleName : String
    }
    where
      isActive = true;

  @readonly
  entity AllProjects        as
    select from timesheet.Projects {
      *
    }
    where
      status = 'Active';

  // Manager Actions
  action approveTimesheet(timesheetID: String)                                                                                         returns String;
  action rejectTimesheet(timesheetID: String, reason: String)                                                                          returns String;
  action assignProjectToEmployee(employeeID: String, projectID: String)                                                                returns String;
}

/**
 * Admin Service - For Administrators to manage system
 */
@(requires: 'Admin')
@impl: './admin-service.js'
service AdminService {

  @cds.redirection.target
  entity Employees             as
    select from timesheet.Employees {
      *,
      managerID.firstName || ' ' || managerID.lastName as managerName : String,
      userRole.roleName                                as roleName    : String
    };

  @cds.redirection.target
  entity ProjectAssignments    as
    select from timesheet.ProjectAssignments {
      *,
      employee.firstName || ' ' || employee.lastName     as employeeName   : String,
      employee.employeeID                                as employeeEmpID  : String,
      project.projectName,
      project.projectID                                  as projectCode    : String,
      assignedBy.firstName || ' ' || assignedBy.lastName as assignedByName : String
    };


  @cds.redirection.target
  entity UserRoles             as
    select from timesheet.UserRoles {
      *
    };

  @cds.redirection.target
  entity Activities            as
    select from timesheet.Activities {
      *,
      project.projectName,
      project.projectRole
    };

  @cds.redirection.target
  entity NonProjectTypes       as
    select from timesheet.NonProjectTypes {
      *
    };

  @cds.redirection.target
  entity Projects              as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    };

  @readonly
  @cds.redirection.target
  entity Timesheets            as
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
  entity Notifications         as
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
  entity RoleSummary           as
    select from timesheet.UserRoles {
      ID,
      roleID,
      roleName,
      description
    };

  @readonly
  entity AvailableManagers     as
    select from timesheet.Employees {
      *,
      userRole.roleName as roleName : String
    }
    where
          isActive          = true
      and userRole.roleName = 'Manager';

  // Admin Actions
  action createEmployee(employeeID: String,
                        firstName: String,
                        lastName: String,
                        email: String,
                        managerEmployeeID: String,
                        roleID: String)                                                                                                returns String;

  action createRole(roleID: String, roleName: String, description: String)                                                             returns String;

  action createActivity(activityID: String,
                        activity: String,
                        activityType: String,
                        projectID: String,
                        isBillable: Boolean,
                        plannedHours: Integer,
                        startDate: Date,
                        endDate: Date)                                                                                                 returns String;

  action createNonProjectType(nonProjectTypeID: String, typeName: String, description: String, isBillable: Boolean)                    returns String;

  action createProject(projectID: String,
                       projectName: String,
                       description: String,
                       startDate: Date,
                       endDate: Date,
                       projectRole: String,
                       budget: Decimal,
                       allocatedHours: Integer,
                       projectOwnerID: String,
                       isBillable: Boolean)                                                                                            returns String;

  action assignEmployeeToManager(employeeID: String, managerEmployeeID: String)                                                        returns String;
  action assignProjectToEmployee(employeeID: String, projectID: String)                                                                returns String;
  action deactivateEmployee(employeeID: String)                                                                                        returns String;
  action deactivateManager(employeeID: String)                                                                                         returns String;
  action updateEmployeeDetails(employeeID: String, firstName: String, lastName: String, email: String)                                 returns String;
  action updateRoleDetails(roleID: String, roleName: String, description: String)                                                      returns String;

  action updateActivity(activityID: String,
                        activity: String,
                        activityType: String,
                        projectID: String,
                        isBillable: Boolean,
                        plannedHours: Integer,
                        startDate: Date,
                        endDate: Date,
                        status: String)                                                                                                returns String;

  action updateNonProjectType(nonProjectTypeID: String, typeName: String, description: String, isBillable: Boolean, isActive: Boolean) returns String;

  action updateProject(projectID: String,
                       projectName: String,
                       description: String,
                       projectRole: String,
                       budget: Decimal,
                       allocatedHours: Integer,
                       status: String)                                                                                                 returns String;

  action approveTimesheet(timesheetID: String)                                                                                         returns String;
  action rejectTimesheet(timesheetID: String, reason: String)                                                                          returns String;
  action deleteEmployeeTimesheets(employeeID: String)                                                                                  returns String;
  action deleteEmployeeTimesheetsByStatus(employeeID: String, status: String)                                                          returns String;
  action deleteTimesheet(timesheetID: String)                                                                                          returns String;
  action deleteTimesheetsByWeek(employeeID: String, weekStartDate: Date)                                                               returns String;
  action deleteAllTimesheets()                                                                                                         returns String;
  action unassignProjectFromEmployee(employeeID: String, projectID: String)                                                            returns String;
}