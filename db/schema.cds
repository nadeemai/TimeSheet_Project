namespace my.timesheet;

using { cuid, managed } from '@sap/cds/common';

/**
 * Employee Master Entity
 */
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

/**
 * User Roles Entity
 */
entity UserRoles : cuid, managed {
    roleID          : String(10) @title: 'Role ID';
    roleName        : String(20) @title: 'Role Name' @mandatory; // Employee, Manager, Admin
    description     : String(200) @title: 'Description';
    employees       : Association to many Employees on employees.userRole = $self;
}

/**
 * Project Master Entity
 */
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

/**
 * Non-Project Types Master Entity
 */
entity NonProjectTypes : cuid, managed {
    nonProjectTypeID : String(10) @title: 'Non-Project Type ID';
    typeName        : String(50) @title: 'Type Name' @mandatory; // Training, Soft Skills, Leave, etc.
    description     : String(500) @title: 'Description';
    isBillable      : Boolean @title: 'Billable' default false;
    isActive        : Boolean @title: 'Active Status' default true;
}

/**
 * Activity Master Entity 
 */
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

/**
 * Timesheet Transactional Entity 
 */
entity Timesheets : cuid, managed {
    timesheetID     : String(10) @title: 'Timesheet ID';
    employee        : Association to Employees @title: 'Employee' @mandatory;
    activity        : Association to Activities @title: 'Activity';
    project         : Association to Projects @title: 'Project';
    nonProjectType  : Association to NonProjectTypes @title: 'Non-Project Type';
    workDate        : Date @title: 'Work Date' @mandatory;
    hoursWorked     : Decimal(4,2) @title: 'Hours Worked' @mandatory;
    task            : String(50) @title: 'Task'; // Designing, Testing, Leave, etc.
    taskDetails     : String(500) @title: 'Task Details/Activity Description' @mandatory;
    status          : String(20) @title: 'Status' default 'Draft'; // Draft, Submitted, Approved, Rejected
    approvedBy      : Association to Employees @title: 'Approved By (Manager)';
    approvalDate    : DateTime @title: 'Approval Date';
    isBillable      : Boolean @title: 'Billable' default true;
}

/**
 * Notification Entity
 */
entity Notifications : cuid, managed {
    notificationID  : String(10) @title: 'Notification ID';
    recipient       : Association to Employees @title: 'Recipient';
    message         : String(500) @title: 'Message';
    notificationType: String(50) @title: 'Type';
    isRead          : Boolean @title: 'Read Status' default false;
    relatedEntity   : String(50) @title: 'Related Entity';
    relatedEntityID : String(36) @title: 'Related Entity ID';
}

/**
 * View for Employee Progress Report
 */
entity EmployeeProgressView as projection on Timesheets {
    key ID,
    employee,
    project,
    activity,
    workDate,
    hoursWorked,
    task,
    taskDetails,
    status
};

/**
 * View for Manager Dashboard
 */
entity ManagerDashboardView as projection on Timesheets {
    key ID,
    employee.firstName || ' ' || employee.lastName as employeeName : String,
    project.projectName,
    project.projectRole as projectRole : String,
    activity.activity as activityName,
    workDate,
    hoursWorked,
    task,
    status,
    taskDetails
};
