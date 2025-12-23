const crypto = require('crypto');
const jwt = require('jsonwebtoken');



const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; 
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || '1234567890123456'; // 
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2024';

// OTP Configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const JWT_EXPIRY_HOURS = 24;



function decryptLinkToken(linkToken) {
    try {
        if (!linkToken || typeof linkToken !== 'string') {
            throw new Error('Invalid token format');
        }
        
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(ENCRYPTION_KEY),
            Buffer.from(ENCRYPTION_IV)
        );
        
        let decrypted = decipher.update(linkToken, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        console.log(`🔓 Decrypted token → Employee ID: "${decrypted}"`);
        return decrypted;
    } catch (error) {
        console.error('❌ Decryption error:', error);
        return null;
    }
}


function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


function maskEmail(email) {
    if (!email) return '';
        
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;
    
    const visibleChars = Math.min(3, Math.floor(username.length / 2));
    const maskedUsername = username.substring(0, visibleChars) + 
                          '*'.repeat(username.length - visibleChars);
    
    return `${maskedUsername}@${domain}`;
}

/**
 * Generate JWT access token
 */
function generateJWT(employee) {
    const payload = {
        employeeID: employee.employeeID,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        id: employee.ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (JWT_EXPIRY_HOURS * 3600)
    };
    
    return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verify JWT access token
 */
function verifyJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('❌ JWT verification error:', error);
        return null;
    }
}


module.exports = cds.service.impl(async function() {
    const { 
        OTPVerification, 
        AuthToken, 
        EmployeeDashboardLink,
        AuthenticationLog 
    } = this.entities;
    
  
    const logAuthEvent = async (employeeID, eventType, eventStatus, errorMessage = null) => {
        try {
            await INSERT.into('my.timesheet.auth.AuthenticationLog').entries({
                employee_ID: employeeID,
                eventType: eventType,
                eventStatus: eventStatus,
                errorMessage: errorMessage
            });
            
            console.log(`🔐 Auth Log: ${eventType} - ${eventStatus}`);
        } catch (error) {
            console.error('❌ Failed to log auth event:', error);
        }
    };
    
    const sendOTPEmail = async (employee, otp) => {
        try {
            const { sendOTPEmail: emailSender } = require('./email_service');
            
            if (!emailSender) {
                console.warn('⚠️ OTP email function not available');
                return { success: false, error: 'Email service not configured' };
            }
            
            const emailResult = await emailSender({
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeEmail: employee.email,
                otp: otp,
                expiryMinutes: OTP_EXPIRY_MINUTES
            });
            
            return emailResult;
        } catch (error) {
            console.error('❌ Error sending OTP email:', error);
            return { success: false, error: error.message };
        }
    };
    

    
    this.on('generateOTP', async (req) => {
        console.log('🔐 generateOTP - Start (Auto-triggered by dashboard link)');
        const { linkToken } = req.data;
        
        try {
            // Validate input
            if (!linkToken) {
                console.log('❌ Missing link token');
                return {
                    success: false,
                    message: 'Link token is required',
                    maskedEmail: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Decrypt link token to get employee ID
            const employeeID = decryptLinkToken(linkToken);
            
            if (!employeeID) {
                console.log('❌ Invalid or corrupted link token');
                return {
                    success: false,
                    message: 'Invalid access link. Please contact your administrator.',
                    maskedEmail: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            console.log('✅ Decrypted employee ID:', employeeID);
            
            // Verify dashboard link exists in database
            const dashboardLink = await SELECT.one
                .from('my.timesheet.auth.EmployeeDashboardLink')
                .where({ linkToken: linkToken, isActive: true });
            
            if (!dashboardLink) {
                console.log('❌ Dashboard link not found or inactive');
                await logAuthEvent(null, 'OTP_REQUEST', 'FAILED', 'Dashboard link not found');
                return {
                    success: false,
                    message: 'Invalid or expired access link. Please contact your administrator.',
                    maskedEmail: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Get employee details
            const employee = await SELECT.one
                .from('my.timesheet.Employees')
                .where({ ID: dashboardLink.employee_ID, isActive: true });
            
            if (!employee) {
                console.log('❌ Employee not found or inactive');
                await logAuthEvent(dashboardLink.employee_ID, 'OTP_REQUEST', 'FAILED', 'Employee not found or inactive');
                return {
                    success: false,
                    message: 'Employee account not found or inactive. Please contact your administrator.',
                    maskedEmail: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            console.log('✅ Employee found:', employee.employeeID, employee.email);
            
            // Check if employee has Employee role
            if (employee.userRole_ID) {
                const role = await SELECT.one
                    .from('my.timesheet.UserRoles')
                    .where({ ID: employee.userRole_ID });
                
                if (!role || role.roleName !== 'Employee') {
                    console.log('❌ User is not an Employee');
                    await logAuthEvent(employee.ID, 'OTP_REQUEST', 'FAILED', 'Not an employee role');
                    return {
                        success: false,
                        message: 'This access method is only for employees. Please use the appropriate login portal.',
                        maskedEmail: '',
                        expiresIn: 0,
                        employeeData: null
                    };
                }
            }
            
            // Invalidate any existing OTPs for this employee
            await UPDATE('my.timesheet.auth.OTPVerification')
                .set({ isUsed: true })
                .where({ employee_ID: employee.ID, isUsed: false });
            
            // Generate new OTP
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);
            
            console.log('📧 Generated OTP:', otp, 'Expires at:', expiresAt);
            
            // Store OTP in database
            await INSERT.into('my.timesheet.auth.OTPVerification').entries({
                employee_ID: employee.ID,
                otp: otp,
                isVerified: false,
                expiresAt: expiresAt.toISOString(),
                attemptCount: 0,
                maxAttempts: OTP_MAX_ATTEMPTS,
                isUsed: false
            });
            
            console.log('💾 OTP stored in database');
            
            // Send OTP via email AUTOMATICALLY
            const emailResult = await sendOTPEmail(employee, otp);
            
            if (!emailResult.success) {
                console.warn('⚠️ Failed to send OTP email, but OTP was generated');
            } else {
                console.log('✅ OTP email sent successfully');
            }
            
            // Log successful OTP generation
            await logAuthEvent(employee.ID, 'OTP_GENERATED', 'SUCCESS', null);
            
            return {
                success: true,
                message: `OTP sent automatically to ${maskEmail(employee.email)}. Please check your email.`,
                maskedEmail: maskEmail(employee.email),
                expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
                employeeData: {
                    employeeID: employee.employeeID,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: maskEmail(employee.email)
                }
            };
            
        } catch (error) {
            console.error('❌ Error in generateOTP:', error);
            await logAuthEvent(null, 'OTP_REQUEST', 'ERROR', error.message);
            
            return {
                success: false,
                message: 'An error occurred while generating OTP. Please try again.',
                maskedEmail: '',
                expiresIn: 0,
                employeeData: null
            };
        }
    });
    
    this.on('verifyOTP', async (req) => {
        console.log('🔐 verifyOTP - Start');
        const { linkToken, otp } = req.data;
        
        try {
            // Validate input
            if (!linkToken || !otp) {
                console.log('❌ Missing linkToken or OTP');
                return {
                    success: false,
                    message: 'Link token and OTP are required',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Decrypt link token
            const employeeID = decryptLinkToken(linkToken);
            
            if (!employeeID) {
                console.log('❌ Invalid link token');
                return {
                    success: false,
                    message: 'Invalid access link',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Get dashboard link
            const dashboardLink = await SELECT.one
                .from('my.timesheet.auth.EmployeeDashboardLink')
                .where({ linkToken: linkToken, isActive: true });
            
            if (!dashboardLink) {
                console.log('❌ Dashboard link not found');
                return {
                    success: false,
                    message: 'Invalid access link',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Get employee
            const employee = await SELECT.one
                .from('my.timesheet.Employees')
                .where({ ID: dashboardLink.employee_ID, isActive: true });
            
            if (!employee) {
                console.log('❌ Employee not found');
                await logAuthEvent(dashboardLink.employee_ID, 'OTP_VERIFY', 'FAILED', 'Employee not found');
                return {
                    success: false,
                    message: 'Employee account not found',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Get latest OTP for this employee
            const otpRecords = await SELECT
                .from('my.timesheet.auth.OTPVerification')
                .where({ employee_ID: employee.ID, isUsed: false })
                .orderBy('createdAt desc');
            
            if (!otpRecords || otpRecords.length === 0) {
                console.log('❌ No valid OTP found');
                await logAuthEvent(employee.ID, 'OTP_VERIFY', 'FAILED', 'No OTP found');
                return {
                    success: false,
                    message: 'No valid OTP found. Please request a new one.',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            const otpRecord = otpRecords[0];
            
            // Check if OTP has expired
            const now = new Date();
            const expiresAt = new Date(otpRecord.expiresAt);
            
            if (now > expiresAt) {
                console.log('❌ OTP expired');
                await UPDATE('my.timesheet.auth.OTPVerification')
                    .set({ isUsed: true })
                    .where({ ID: otpRecord.ID });
                
                await logAuthEvent(employee.ID, 'OTP_VERIFY', 'FAILED', 'OTP expired');
                
                return {
                    success: false,
                    message: 'OTP has expired. Please click Retry to get a new one.',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Check attempt count
            if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
                console.log('❌ Maximum attempts exceeded');
                await UPDATE('my.timesheet.auth.OTPVerification')
                    .set({ isUsed: true })
                    .where({ ID: otpRecord.ID });
                
                await logAuthEvent(employee.ID, 'OTP_VERIFY', 'FAILED', 'Max attempts exceeded');
                
                return {
                    success: false,
                    message: 'Maximum verification attempts exceeded. Please click Retry to get a new OTP.',
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            // Verify OTP
            if (otpRecord.otp !== otp) {
                console.log('❌ Invalid OTP');
                
                // Increment attempt count
                await UPDATE('my.timesheet.auth.OTPVerification')
                    .set({ attemptCount: otpRecord.attemptCount + 1 })
                    .where({ ID: otpRecord.ID });
                
                await logAuthEvent(employee.ID, 'OTP_VERIFY', 'FAILED', 'Invalid OTP');
                
                const remainingAttempts = otpRecord.maxAttempts - otpRecord.attemptCount - 1;
                
                return {
                    success: false,
                    message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
                    isValid: false,
                    accessToken: '',
                    expiresIn: 0,
                    employeeData: null
                };
            }
            
            console.log('✅ OTP verified successfully');
            
            await UPDATE('my.timesheet.auth.OTPVerification')
                .set({ isVerified: true, isUsed: true })
                .where({ ID: otpRecord.ID });
            
            const accessToken = generateJWT(employee);
            const tokenExpiresAt = new Date(Date.now() + JWT_EXPIRY_HOURS * 3600000);
            
            await INSERT.into('my.timesheet.auth.AuthToken').entries({
                employee_ID: employee.ID,
                accessToken: accessToken,
                expiresAt: tokenExpiresAt.toISOString(),
                isRevoked: false
            });
            
            console.log('💾 Access token generated and stored');
            
            await logAuthEvent(employee.ID, 'OTP_VERIFY', 'SUCCESS', null);
            
            return {
                success: true,
                message: 'Authentication successful! Redirecting to dashboard...',
                isValid: true,
                accessToken: accessToken,
                expiresIn: JWT_EXPIRY_HOURS * 3600,
                employeeData: {
                    employeeID: employee.employeeID,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email,
                    dashboardUrl: dashboardLink.dashboardUrl,
                    linkToken: linkToken
                }
            };
            
        } catch (error) {
            console.error('❌ Error in verifyOTP:', error);
            
            return {
                success: false,
                message: 'An error occurred during verification. Please try again.',
                isValid: false,
                accessToken: '',
                expiresIn: 0,
                employeeData: null
            };
        }
    });
    

    this.on('retryOTP', async (req) => {
        console.log('🔁 retryOTP - User clicked Retry button');
        const { linkToken } = req.data;
        
 
        return await this.generateOTP(req);
    });
    

    
    this.on('validateToken', async (req) => {
        console.log('🔐 validateToken - Start');
        const { accessToken } = req.data;
        
        try {
            if (!accessToken) {
                return {
                    success: false,
                    message: 'Access token is required',
                    isValid: false,
                    employeeData: null
                };
            }
            
            // Verify JWT
            const decoded = verifyJWT(accessToken);
            
            if (!decoded) {
                console.log('❌ Invalid or expired token');
                return {
                    success: false,
                    message: 'Invalid or expired access token',
                    isValid: false,
                    employeeData: null
                };
            }
            
            // Check if token exists in database and is not revoked
            const tokenRecord = await SELECT.one
                .from('my.timesheet.auth.AuthToken')
                .where({ accessToken: accessToken, isRevoked: false });
            
            if (!tokenRecord) {
                console.log('❌ Token not found or revoked');
                return {
                    success: false,
                    message: 'Access token has been revoked',
                    isValid: false,
                    employeeData: null
                };
            }
            
            // Check if token has expired
            const now = new Date();
            const expiresAt = new Date(tokenRecord.expiresAt);
            
            if (now > expiresAt) {
                console.log('❌ Token expired');
                await UPDATE('my.timesheet.auth.AuthToken')
                    .set({ isRevoked: true })
                    .where({ ID: tokenRecord.ID });
                
                return {
                    success: false,
                    message: 'Access token has expired',
                    isValid: false,
                    employeeData: null
                };
            }
            
            // Get employee details
            const employee = await SELECT.one
                .from('my.timesheet.Employees')
                .where({ ID: decoded.id, isActive: true });
            
            if (!employee) {
                console.log('❌ Employee not found or inactive');
                return {
                    success: false,
                    message: 'Employee account not found or inactive',
                    isValid: false,
                    employeeData: null
                };
            }
            
            console.log('✅ Token validated successfully');
            
            return {
                success: true,
                message: 'Token is valid',
                isValid: true,
                employeeData: {
                    employeeID: employee.employeeID,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email
                }
            };
            
        } catch (error) {
            console.error('❌ Error in validateToken:', error);
            
            return {
                success: false,
                message: 'Token validation failed',
                isValid: false,
                employeeData: null
            };
        }
    });
    
  
    
    this.on('getLatestOTP', async (req) => {
        const { linkToken } = req.data;
        
        if (process.env.NODE_ENV === 'production') {
            return {
                success: false,
                message: 'This endpoint is disabled in production'
            };
        }
        
        try {
            const employeeID = decryptLinkToken(linkToken);
            
            if (!employeeID) {
                return {
                    success: false,
                    message: 'Invalid link token'
                };
            }
            
            const dashboardLink = await SELECT.one
                .from('my.timesheet.auth.EmployeeDashboardLink')
                .where({ linkToken: linkToken, isActive: true });
            
            if (!dashboardLink) {
                return {
                    success: false,
                    message: 'Dashboard link not found'
                };
            }
            
            const employee = await SELECT.one
                .from('my.timesheet.Employees')
                .where({ ID: dashboardLink.employee_ID });
            
            if (!employee) {
                return {
                    success: false,
                    message: 'Employee not found'
                };
            }
            
            const otpRecords = await SELECT
                .from('my.timesheet.auth.OTPVerification')
                .where({ employee_ID: employee.ID, isUsed: false })
                .orderBy('createdAt desc');
            
            if (!otpRecords || otpRecords.length === 0) {
                return {
                    success: false,
                    message: 'No OTP found for this employee'
                };
            }
            
            const latestOTP = otpRecords[0];
            
            return {
                success: true,
                employeeID: employee.employeeID,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeEmail: employee.email,
                otp: latestOTP.otp,
                expiresAt: latestOTP.expiresAt,
                attemptCount: latestOTP.attemptCount,
                maxAttempts: latestOTP.maxAttempts,
                isExpired: new Date() > new Date(latestOTP.expiresAt),
                createdAt: latestOTP.createdAt
            };
            
        } catch (error) {
            console.error('Error getting OTP:', error);
            return {
                success: false,
                message: 'Error retrieving OTP'
            };
        }
    });

    this.on('decryptToken', async (req) => {
        const { linkToken } = req.data;
        
        // SECURITY WARNING: This endpoint should NEVER be available in production
        if (process.env.NODE_ENV === 'production') {
            return {
                success: false,
                message: 'This endpoint is disabled in production'
            };
        }
        
        console.log('🔍 decryptToken - Start');
        console.log('📥 Received linkToken:', linkToken);
        
        try {
            if (!linkToken || typeof linkToken !== 'string') {
                return {
                    success: false,
                    message: 'Invalid token format - must be a string',
                    linkToken: linkToken,
                    employeeID: null
                };
            }
            
            const employeeID = decryptLinkToken(linkToken);
            
            if (!employeeID) {
                return {
                    success: false,
                    message: 'Failed to decrypt token - invalid encryption',
                    linkToken: linkToken,
                    employeeID: null
                };
            }
            
            console.log('✅ Decrypted employee ID:', employeeID);
            
            const employee = await SELECT.one
                .from('my.timesheet.Employees')
                .where({ employeeID: employeeID });
            
            const dashboardLink = await SELECT.one
                .from('my.timesheet.auth.EmployeeDashboardLink')
                .where({ linkToken: linkToken });
            
            return {
                success: true,
                message: 'Token decrypted successfully',
                linkToken: linkToken,
                employeeID: employeeID,
                employeeExists: !!employee,
                employeeDetails: employee ? {
                    employeeID: employee.employeeID,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email,
                    isActive: employee.isActive
                } : null,
                dashboardLinkExists: !!dashboardLink,
                dashboardLinkActive: dashboardLink?.isActive || false
            };
            
        } catch (error) {
            console.error('❌ Error in decryptToken:', error);
            return {
                success: false,
                message: `Error: ${error.message}`,
                linkToken: linkToken,
                employeeID: null,
                error: error.toString()
            };
        }
    });
    this.on('getEmployeeCredentials', async (req) => {
    console.log('🎫 getEmployeeCredentials - UI requesting employee credentials');
    const { linkToken } = req.data;
    
    try {
        // Validate input
        if (!linkToken) {
            console.log('❌ Missing link token');
            return {
                success: false,
                message: 'Link token is required',
                employeeData: null,
                otpData: null,
                dashboardInfo: null
            };
        }
        
        // Decrypt link token to get employee ID
        const employeeID = decryptLinkToken(linkToken);
        
        if (!employeeID) {
            console.log('❌ Invalid or corrupted link token');
            return {
                success: false,
                message: 'Invalid access link. Please contact your administrator.',
                employeeData: null,
                otpData: null,
                dashboardInfo: null
            };
        }
        
        console.log('✅ Decrypted employee ID:', employeeID);
        
        // Verify dashboard link exists in database
        const dashboardLink = await SELECT.one
            .from('my.timesheet.auth.EmployeeDashboardLink')
            .where({ linkToken: linkToken, isActive: true });
        
        if (!dashboardLink) {
            console.log('❌ Dashboard link not found or inactive');
            return {
                success: false,
                message: 'Invalid or expired access link. Please contact your administrator.',
                employeeData: null,
                otpData: null,
                dashboardInfo: null
            };
        }
        
        // Get employee details
        const employee = await SELECT.one
            .from('my.timesheet.Employees')
            .where({ ID: dashboardLink.employee_ID, isActive: true });
        
        if (!employee) {
            console.log('❌ Employee not found or inactive');
            return {
                success: false,
                message: 'Employee account not found or inactive. Please contact your administrator.',
                employeeData: null,
                otpData: null,
                dashboardInfo: null
            };
        }
        
        console.log('✅ Employee found:', employee.employeeID, employee.email);
        
        // Get latest OTP for this employee (if exists)
        const otpRecords = await SELECT
            .from('my.timesheet.auth.OTPVerification')
            .where({ employee_ID: employee.ID, isUsed: false })
            .orderBy('createdAt desc');
        
        let otpData = {
            otpSent: false,
            otp: null,
            maskedOTP: null,
            expiresAt: null,
            expiresIn: 0,
            isExpired: false,
            attemptCount: 0,
            maxAttempts: 3, // OTP_MAX_ATTEMPTS
            remainingAttempts: 3
        };
        
        if (otpRecords && otpRecords.length > 0) {
            const latestOTP = otpRecords[0];
            const now = new Date();
            const expiresAt = new Date(latestOTP.expiresAt);
            const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));
            const isExpired = now > expiresAt;
            
            // Mask OTP for display (show first 2 digits only)
            const maskedOTP = latestOTP.otp ? 
                latestOTP.otp.substring(0, 2) + '****' : 
                null;
            
            otpData = {
                otpSent: true,
                otp: latestOTP.otp, // Full OTP for authentication
                maskedOTP: maskedOTP, // Masked for display
                expiresAt: latestOTP.expiresAt,
                expiresIn: expiresIn,
                isExpired: isExpired,
                attemptCount: latestOTP.attemptCount,
                maxAttempts: latestOTP.maxAttempts,
                remainingAttempts: latestOTP.maxAttempts - latestOTP.attemptCount
            };
            
            console.log('📧 OTP found:', maskedOTP, 'Expires in:', expiresIn, 'seconds');
        } else {
            console.log('ℹ️ No OTP found for this employee yet');
        }
        
        // Prepare employee data
        const employeeData = {
            employeeID: employee.employeeID,
            firstName: employee.firstName,
            lastName: employee.lastName,
            fullName: `${employee.firstName} ${employee.lastName}`,
            email: employee.email,
            encryptedToken: linkToken,
            maskedEmail: maskEmail(employee.email)
        };
        
        // Prepare dashboard info
        const dashboardInfo = {
            dashboardUrl: dashboardLink.dashboardUrl,
            linkToken: linkToken,
            isActive: dashboardLink.isActive
        };
        
        console.log('✅ Employee credentials retrieved successfully');
        
        return {
            success: true,
            message: 'Employee credentials retrieved successfully',
            employeeData: employeeData,
            otpData: otpData,
            dashboardInfo: dashboardInfo
        };
        
    } catch (error) {
        console.error('❌ Error in getEmployeeCredentials:', error);
        
        return {
            success: false,
            message: 'An error occurred while retrieving credentials. Please try again.',
            employeeData: null,
            otpData: null,
            dashboardInfo: null
        };
    }
});
});