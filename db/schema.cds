namespace my.timesheet;

using { cuid, managed } from '@sap/cds/common';


entity Employees : cuid, managed {
    employeeID      : String(10) @title: 'Employee ID';
    firstName       : String(50) @title: 'First Name' @mandatory;
    lastName        : String(50) @title: 'Last Name' @mandatory;
    email           : String(100) @title: 'Email' @mandatory;
    isActive        : Boolean @title: 'Active Status' default true;
    userRole        : Association to UserRoles @title: 'User Role';
    managerID       : Association to Employees @title: 'Reporting Manager';
    timesheets      : Association to many Timesheets on timesheets.employee = $self;
}


entity UserRoles : cuid, managed {
    roleID          : String(10) @title: 'Role ID';
    roleName        : String(20) @title: 'Role Name' @mandatory; // Employee, Manager, Admin
    description     : String(200) @title: 'Description';
    employees       : Association to many Employees on employees.userRole = $self;
}


entity Projects : cuid, managed {
    projectID       : String(10) @title: 'Project ID';
    projectName     : String(100) @title: 'Project Name' @mandatory;
    description     : String(500) @title: 'Description';
    startDate       : Date @title: 'Start Date' @mandatory;
    endDate         : Date @title: 'End Date' @mandatory;
    budget          : Decimal(15,2) @title: 'Budget';
    allocatedHours  : Integer @title: 'Allocated Hours';
    status          : String(20) @title: 'Status' default 'Active';
    projectRole     : String(50) @title: 'Project Role'; // Designing, Developing, Testing, Deployment
    projectOwner    : Association to Employees @title: 'Project Owner';
    projectApprover : Association to Employees @title: 'Project Approver';
    projectSponsor  : Association to Employees @title: 'Project Sponsor';
    isBillable      : Boolean @title: 'Billable' default true;
}

entity ProjectAssignments : cuid, managed {
    employee        : Association to Employees @title: 'Employee' @mandatory;
    project         : Association to Projects @title: 'Project' @mandatory;
    assignedBy      : Association to Employees @title: 'Assigned By';
    assignedDate    : DateTime @title: 'Assignment Date' default $now;
    isActive        : Boolean @title: 'Active Assignment' default true;
}

entity NonProjectTypes : cuid, managed {
    nonProjectTypeID : String(10) @title: 'Non-Project Type ID';
    typeName        : String(50) @title: 'Type Name' @mandatory; // Training, Soft Skills, Leave, etc.
    description     : String(500) @title: 'Description';
    isBillable      : Boolean @title: 'Billable' default false;
    isActive        : Boolean @title: 'Active Status' default true;
}

entity Activities : cuid, managed {
    activityID      : String(10) @title: 'Activity ID';
    activity        : String(100) @title: 'Activity Name' @mandatory;
    activityType    : String(20) @title: 'Activity Type'; // Project, NonProject
    project         : Association to Projects @title: 'Project';
    isBillable      : Boolean @title: 'Billable';
    plannedHours    : Integer @title: 'Planned Hours';
    startDate       : Date @title: 'Start Date';
    endDate         : Date @title: 'End Date';
    status          : String(20) @title: 'Status' default 'Active'; // Active, Inactive, Completed
}

entity Timesheets : cuid, managed {
    timesheetID     : String(10) @title: 'Timesheet ID';
    employee        : Association to Employees @title: 'Employee' @mandatory;
    activity        : Association to Activities @title: 'Activity';
    project         : Association to Projects @title: 'Project';
    nonProjectType  : Association to NonProjectTypes @title: 'Non-Project Type';
    
 
    weekStartDate   : Date @title: 'Week Start Date' @mandatory; // Monday of the week
    weekEndDate     : Date @title: 'Week End Date' @mandatory;   // Sunday of the week
    
    task            : String(50) @title: 'Task'; // Designing, Testing, Leave, etc.
    taskDetails     : String(500) @title: 'General Task Details'; // Overall description for the week
    

    mondayHours     : Decimal(4,2) @title: 'Monday Hours' default 0;
    mondayDate      : Date @title: 'Monday Date';
    mondayDay       : String(10) @title: 'Monday Day' default 'Monday';
    mondayTaskDetails : String(500) @title: 'Monday Task Details';
    

    tuesdayHours    : Decimal(4,2) @title: 'Tuesday Hours' default 0;
    tuesdayDate     : Date @title: 'Tuesday Date';
    tuesdayDay      : String(10) @title: 'Tuesday Day' default 'Tuesday';
    tuesdayTaskDetails : String(500) @title: 'Tuesday Task Details';
    

    wednesdayHours  : Decimal(4,2) @title: 'Wednesday Hours' default 0;
    wednesdayDate   : Date @title: 'Wednesday Date';
    wednesdayDay    : String(10) @title: 'Wednesday Day' default 'Wednesday';
    wednesdayTaskDetails : String(500) @title: 'Wednesday Task Details';
    

    thursdayHours   : Decimal(4,2) @title: 'Thursday Hours' default 0;
    thursdayDate    : Date @title: 'Thursday Date';
    thursdayDay     : String(10) @title: 'Thursday Day' default 'Thursday';
    thursdayTaskDetails : String(500) @title: 'Thursday Task Details';
    

    fridayHours     : Decimal(4,2) @title: 'Friday Hours' default 0;
    fridayDate      : Date @title: 'Friday Date';
    fridayDay       : String(10) @title: 'Friday Day' default 'Friday';
    fridayTaskDetails : String(500) @title: 'Friday Task Details'; 
    

    saturdayHours   : Decimal(4,2) @title: 'Saturday Hours' default 0;
    saturdayDate    : Date @title: 'Saturday Date';
    saturdayDay     : String(10) @title: 'Saturday Day' default 'Saturday';
    saturdayTaskDetails : String(500) @title: 'Saturday Task Details'; 
    

    sundayHours     : Decimal(4,2) @title: 'Sunday Hours' default 0;
    sundayDate      : Date @title: 'Sunday Date';
    sundayDay       : String(10) @title: 'Sunday Day' default 'Sunday';
    sundayTaskDetails : String(500) @title: 'Sunday Task Details'; 
    

    totalWeekHours  : Decimal(5,2) @title: 'Total Week Hours' default 0;
    
    status          : String(20) @title: 'Status' default 'Draft'; // Draft, Submitted, Approved, Rejected
    approvedBy      : Association to Employees @title: 'Approved By (Manager)';
    approvalDate    : DateTime @title: 'Approval Date';
    isBillable      : Boolean @title: 'Billable' default true;
}

entity Notifications : cuid, managed {
    notificationID  : String(10) @title: 'Notification ID';
    recipient       : Association to Employees @title: 'Recipient';
    message         : String(500) @title: 'Message';
    notificationType: String(50) @title: 'Type';
    isRead          : Boolean @title: 'Read Status' default false;
    relatedEntity   : String(50) @title: 'Related Entity';
    relatedEntityID : String(36) @title: 'Related Entity ID';
}
entity EmployeeProgressView as projection on Timesheets {
    key ID,
    employee,
    project,
    activity,
    weekStartDate,
    weekEndDate,
    totalWeekHours,
    task,
    taskDetails,
    status
};
entity ManagerDashboardView as projection on Timesheets {
    key ID,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    project.projectName,
    project.projectRole as projectRole : String,
    activity.activity as activityName,
    weekStartDate,
    weekEndDate,
    totalWeekHours,
    task,
    status,
    taskDetails
};