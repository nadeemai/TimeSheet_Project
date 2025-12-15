using { my.timesheet.auth as auth } from '../db/auth';
using { my.timesheet.Employees } from '../db/schema';

/**
 * Public Authentication Service - No authentication required
 * Handles OTP generation, verification, and JWT token management for employee dashboard access
 */
@impl: './auth-service.js'
service AuthenticationService {
    
    /**
     * Action 1: Generate and send OTP to employee email
     * Called when employee opens the dashboard link
     * Input: linkToken (encrypted employee ID from the dashboard URL)
     * Output: Success status and masked email address
     */
    @open
    action generateOTP(linkToken: String) returns {
        success         : Boolean;
        message         : String;
        maskedEmail     : String;
        expiresIn       : Integer;
    };
    
    /**
     * Action 2: Verify OTP and generate JWT access token
     * Called when employee submits OTP on verification page
     * Input: linkToken, OTP code
     * Output: JWT access token for dashboard access
     */
    @open
    action verifyOTP(linkToken: String, otp: String) returns {
        success         : Boolean;
        message         : String;
        accessToken     : String;
        expiresIn       : Integer;
        employeeData    : {
            employeeID  : String;
            firstName   : String;
            lastName    : String;
            email       : String;
        };
    };
    
    /**
     * Action 3: Validate JWT token
     * Called to check if employee's session is still valid
     * Input: JWT access token
     * Output: Validation status and employee details
     */
    @open
    action validateToken(accessToken: String) returns {
        success         : Boolean;
        message         : String;
        employeeData    : {
            employeeID  : String;
            firstName   : String;
            lastName    : String;
            email       : String;
        };
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
}