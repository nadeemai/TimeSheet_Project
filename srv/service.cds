using {my.timesheet as timesheet} from '../db/schema';
using from './user-api';

@impl: './employee-service.js'
service EmployeeService @(requires: 'authenticated-user') {

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
          managerID.email                                  as managerEmail : String,
           userRole.roleName                                as roleName        : String,
          userRole.roleID                                  as roleID          : String,
          userRole.description                             as roleDescription : String
    
    }
    where
      email = $user.id ;


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
  entity AvailableLeaveTypes as
    select from timesheet.LeaveTypes {
      *
    }
    where
      isActive = true;

  @readonly
  entity MyLeaveBalance as
    select from timesheet.EmployeeLeaveBalance {
      key ID,
          employee.ID                                as employee_ID    : UUID,
          employee.employeeID                        as employeeCode   : String,
          employee.firstName || ' ' || employee.lastName as employeeName : String,
          leaveType.ID                               as leaveType_ID   : UUID,
          leaveType.leaveTypeID                      as leaveTypeCode  : String,
          leaveType.typeName                         as leaveTypeName  : String,
          year,
          totalLeaves,
          usedLeaves,
          remainingLeaves
    }
    where
      employee.email = $user.id;

  @readonly
  entity AvailableTaskTypes {
    key code          : String  @title: 'Task Code';
        name          : String  @title: 'Task Name';
        description   : String  @title: 'Description';
        isProjectTask : Boolean @title: 'For Project Work';
  };

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

           leaveType.ID                                       as leaveType_ID       : UUID,
        leaveType.typeName                                 as leaveTypeName      : String,
        leaveType.leaveTypeID                              as leaveTypeCode      : String,


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
      employee.email = $user.id;  

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
      employee.email = $user.id; 

  @readonly
  entity BookedHoursOverview as projection on timesheet.Projects;

  @readonly
  entity ProjectEngagementDuration as projection on timesheet.Projects;

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
      employee.email = $user.id; 

     @readonly
  entity AvailableDocuments as
    select from timesheet.Documents {
      key ID,
          documentID,
          documentName,
          documentType,
          description,
          fileName,
          mimeType,
          fileSize,
          category,
          version,
          isActive,
          createdAt,
          modifiedAt,
          uploadedBy.firstName || ' ' || uploadedBy.lastName as uploadedByName : String
    }
    where isActive = true;

  @readonly
  entity ApprovalFlow {
    key category        : String  @title: 'Category';
        weekStartDate   : Date    @title: 'Week Start Date';
        weekEndDate     : Date    @title: 'Week End Date';
        totalHours      : Decimal(10,2) @title: 'Total Hours Pending Approval';
        timesheetCount  : Integer @title: 'Number of Timesheets';
  };

  action   submitTimesheet(timesheetID: String) returns String;
  action   updateTimesheet(timesheetID: String, weekData: String) returns String;
  function validateDailyHours(date: Date) returns Decimal;
  function getWeekBoundaries(date: Date) returns {
    weekStart : Date;
    weekEnd   : Date;
  };
  function downloadDocument(documentID: String) returns {
    fileName    : String;
    mimeType    : String;
    content     : LargeBinary;
  };
  action testMail() returns String;
  action testEmailConfiguration() returns String;
  action testNonProjectEmail() returns String;
  action testModificationEmail() returns String;
  function checkEmailHealth() returns String;
}


@(requires: 'Manager')
@impl: './manager-service.js'
service ManagerService {
  @readonly
  @cds.redirection.target
  entity MyManagerProfile as
    select from timesheet.Employees {
      *
    }
    where
      email = $user.id; 


  @readonly
  entity MyTeam as
    select from timesheet.Employees {
      *,
      managerID.firstName || ' ' || managerID.lastName as managerName : String
    }
    where
      managerID.email = $user.id; 

 
  @cds.redirection.target
  entity MyProjects as
    select from timesheet.Projects {
      *,
      projectOwner.firstName || ' ' || projectOwner.lastName as projectOwnerName : String
    }
    where
      projectOwner.email = $user.id;

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
      employee.managerID.email = $user.id;  

  @readonly
  entity MyNotifications as
    select from timesheet.Notifications {
      *,
      recipient.firstName || ' ' || recipient.lastName as recipientName : String
    }
    where
      recipient.email = $user.id; 


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
      employee.managerID.email = $user.id; 


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
      projectOwner.email = $user.id;  

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

  

  @cds.redirection.target
  entity AssignedProjects as
    select from timesheet.ProjectAssignments {
      key ID,
          employee.employeeID                                as employeeID    : String,
          employee.firstName || ' ' || employee.lastName     as employeeName  : String,
          project.projectID                                  as projectID     : String,
          project.projectName                                as projectName   : String,
          assignedBy.firstName || ' ' || assignedBy.lastName as assignedBy    : String,
          isActive
    }
    where
      assignedBy.email = $user.id;

  action approveTimesheet(timesheetID: String) returns String;
  action rejectTimesheet(timesheetID: String, reason: String) returns String;
  action assignProjectToEmployee(employeeID: String, projectID: String) returns String;
}


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

    @readonly
entity OverallProgressSummary as projection on timesheet.Projects;

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
  entity RoleSummary as
    select from timesheet.UserRoles {
      ID,
      roleID,
      roleName,
      description
    };

  @readonly
  entity LeaveSummary as
    select from timesheet.EmployeeLeaveBalance {
      key ID,
          employee.ID                                    as employeeID       : UUID,
          employee.employeeID                            as empID            : String,
          employee.firstName || ' ' || employee.lastName as employeeName     : String,
          employee.email                                 as employeeEmail    : String,
          leaveType.leaveTypeID                          as leaveTypeID      : String,
          leaveType.typeName                             as leaveTypeName    : String,
          year,
          totalLeaves,
          usedLeaves,
          remainingLeaves,
          createdAt,
          modifiedAt
    };

  @cds.redirection.target
  entity LeaveTypes as
    select from timesheet.LeaveTypes {
      *
    };

@cds.redirection.target
entity EmployeeLeaveBalance as
  select from timesheet.EmployeeLeaveBalance {
    *,
    employee.firstName || ' ' || employee.lastName as employeeName     : String,
    employee.employeeID                            as employeeEmpID    : String,
    employee.userRole.roleName                     as userRoleName     : String,
    employee.userRole.roleID                       as userRoleID       : String
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
    
    @cds.redirection.target
  entity Documents as
    select from timesheet.Documents {
      *,
      uploadedBy.firstName || ' ' || uploadedBy.lastName as uploadedByName : String
    };

  action uploadDocument(
    documentName: String,
    documentType: String,
    description: String,
    fileName: String,
    mimeType: String,
    content: LargeBinary,
    category: String,
    version: String,
    accessLevel: String
  ) returns String;
  action deleteDocument(documentID: String) returns String;
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
  action initializeLeaveBalances(year: Integer) returns String;
}