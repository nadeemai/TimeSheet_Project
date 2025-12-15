namespace my.timesheet.auth;

using { cuid, managed } from '@sap/cds/common';
using { my.timesheet.Employees } from '../db/schema';

entity OTPVerification : cuid, managed {
    employee        : Association to Employees @title: 'Employee';
    otp             : String(6) @title: 'OTP Code' @mandatory;
    isVerified      : Boolean @title: 'Verification Status' default false;
    expiresAt       : DateTime @title: 'OTP Expiry Time' @mandatory;
    attemptCount    : Integer @title: 'Verification Attempts' default 0;
    maxAttempts     : Integer @title: 'Maximum Attempts' default 3;
    isUsed          : Boolean @title: 'Is Used' default false;
}


entity AuthToken : cuid, managed {
    employee        : Association to Employees @title: 'Employee' @mandatory;
    accessToken     : String(1000) @title: 'JWT Access Token' @mandatory;
    expiresAt       : DateTime @title: 'Token Expiry Time' @mandatory;
    isRevoked       : Boolean @title: 'Token Revoked' default false;
}


entity EmployeeDashboardLink : cuid, managed {
    employee        : Association to Employees @title: 'Employee' @mandatory;
    linkToken       : String(255) @title: 'Encrypted Link Token' @mandatory;
    dashboardUrl    : String(1000) @title: 'Full Dashboard URL' @mandatory;
    isActive        : Boolean @title: 'Link Active Status' default true;
}


entity AuthenticationLog : cuid, managed {
    employee        : Association to Employees @title: 'Employee';
    eventType       : String(50) @title: 'Event Type' @mandatory;
    eventStatus     : String(20) @title: 'Event Status' @mandatory;
    errorMessage    : String(1000) @title: 'Error Message';
}