using { my.timesheet.auth as auth } from '../db/auth';
using { my.timesheet.Employees } from '../db/schema';


@impl: './auth-service.js'
service AuthenticationService {
    

    @open
    action generateOTP(linkToken: String) returns {
        success         : Boolean;
        message         : String;
        maskedEmail     : String;
        expiresIn       : Integer; 
        employeeData    : {
            employeeID  : String;
            firstName   : String;
            lastName    : String;
            email       : String;
        };
    };
 
    @open
    action verifyOTP(linkToken: String, otp: String) returns {
        success         : Boolean;
        message         : String;
        isValid         : Boolean;  
        accessToken     : String;
        expiresIn       : Integer;
        employeeData    : {
            employeeID      : String;
            firstName       : String;
            lastName        : String;
            email           : String;
            dashboardUrl    : String;
            linkToken       : String;
        };
    };
    

    @open
    action validateToken(accessToken: String) returns {
        success         : Boolean;
        message         : String;
        isValid         : Boolean;
        employeeData    : {
            employeeID  : String;
            firstName   : String;
            lastName    : String;
            email       : String;
        };
    };

    @open
    action retryOTP(linkToken: String) returns {
        success         : Boolean;
        message         : String;
        maskedEmail     : String;
        expiresIn       : Integer;
    };

    @open
    action decryptToken(linkToken: String) returns {
        success             : Boolean;
        message             : String;
        linkToken           : String;
        employeeID          : String;
        employeeExists      : Boolean;
        employeeDetails     : {
            employeeID      : String;
            firstName       : String;
            lastName        : String;
            email           : String;
            isActive        : Boolean;
        };
        dashboardLinkExists : Boolean;
        dashboardLinkActive : Boolean;
        error               : String;
    };
    
    @open
    action getLatestOTP(linkToken: String) returns {
        success         : Boolean;
        employeeID      : String;
        employeeName    : String;
        employeeEmail   : String;
        otp             : String;
        expiresAt       : DateTime;
        attemptCount    : Integer;
        maxAttempts     : Integer;
        isExpired       : Boolean;
        createdAt       : DateTime;
        message         : String;
    };

    @open
    action getEmployeeCredentials(linkToken: String) returns {
        success         : Boolean;
        message         : String;
        employeeData    : {
            employeeID      : String;   
            firstName       : String;
            lastName        : String;
            fullName        : String;
            email           : String;
            encryptedToken  : String;  
            maskedEmail     : String; 
        };
        otpData         : {
            otpSent         : Boolean;
            otp             : String; 
            maskedOTP       : String;  
            expiresAt       : DateTime;
            expiresIn       : Integer;  
            isExpired       : Boolean;
            attemptCount    : Integer;
            maxAttempts     : Integer;
            remainingAttempts : Integer;
        };
        dashboardInfo   : {
            dashboardUrl    : String;
            linkToken       : String;
            isActive        : Boolean;
        };
    };
}