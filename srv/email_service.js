const nodemailer = require('nodemailer');
const xsenv = require('@sap/xsenv');

const DESTINATION_NAME = 'sap_process_automation_mail';
const MANAGER_EMAIL = 'jayant.kumar@sumodigitech.com';
const ADMIN_EMAIL = 'pushpak.jha@sumodigitech.com';
const FROM_EMAIL = 'pushpak.jha@risedx.com';

let transporter = null;
let initializationAttempted = false;
let initializationError = null;

async function getOAuth2AccessToken(destinationConfig) {
  try {
    console.log('Fetching OAuth2 access token...');

    const tokenUrl = destinationConfig.tokenServiceURL;
    const clientId = destinationConfig.clientId;
    const clientSecret = destinationConfig.clientSecret;

    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error('Missing OAuth2 credentials in destination configuration');
    }

    console.log('   tokenServiceURL:', tokenUrl);
    console.log('   clientId (first 8 chars):', clientId.substring(0, 8) + '****');
    console.log('   scope:', destinationConfig.scope || '<<none>>');

    const axios = require('axios');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    if (destinationConfig.scope) {
      params.append('scope', destinationConfig.scope);
    }

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('OAuth2 token obtained successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to obtain OAuth2 token:', error.response?.status, error.response?.data || error.message);
    throw new Error(`OAuth2 token fetch failed: ${error.message}`);
  }
}

async function getDestinationConfig() {
  try {
    console.log('Reading destination configuration from BTP...');

    const services = xsenv.getServices({ dest: { tag: 'destination' } });
    const destCredentials = services.dest;

    if (!destCredentials) {
      throw new Error('Destination service not bound. Check mta.yaml configuration.');
    }

    console.log('Destination service credentials loaded');
    console.log('   destCredentials.uri:', destCredentials.uri);
    console.log('   destCredentials.url:', destCredentials.url);

    const axios = require('axios');

    const destServiceToken = await getDestinationServiceToken(destCredentials);
    console.log('Destination service token obtained');

    const destServiceUrl = destCredentials.uri;

    const listResp = await axios.get(
      `${destServiceUrl}/destination-configuration/v1/destinations`,
      {
        headers: {
          Authorization: `Bearer ${destServiceToken}`
        }
      }
    );

    console.log('Destinations visible to this instance:');
    for (const d of listResp.data.destinations || []) {
      console.log(`   - ${d.Name}`);
    }

    console.log(`Fetching destination "${DESTINATION_NAME}"...`);

    const response = await axios.get(
      `${destServiceUrl}/destination-configuration/v1/destinations/${DESTINATION_NAME}`,
      {
        headers: {
          Authorization: `Bearer ${destServiceToken}`
        }
      }
    );

    const destination = response.data.destinationConfiguration;
    console.log('Destination configuration loaded:', DESTINATION_NAME);

    const config = {
      host: destination['mail.smtp.host'],
      port: parseInt(destination['mail.smtp.port'] || '587'),
      secure: destination['mail.smtp.port'] === '465',
      tokenServiceURL: destination.tokenServiceURL,
      clientId: destination.clientId,
      clientSecret: destination.clientSecret,
      scope: destination.scope,
      user: destination['mail.user'] || destination.User,
      from: destination['mail.from'] || FROM_EMAIL
    };

    if (!config.host) {
      throw new Error('SMTP host not configured in destination');
    }
    if (!config.tokenServiceURL || !config.clientId || !config.clientSecret) {
      throw new Error('OAuth2 credentials not configured in destination');
    }

    console.log('Destination config validated:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      hasTokenUrl: !!config.tokenServiceURL,
      hasClientId: !!config.clientId
    });

    return config;

  } catch (error) {
    console.error('Failed to read destination configuration:', error.message);
    throw error;
  }
}


async function getDestinationServiceToken(destCredentials) {
  try {
    const axios = require('axios');
    const tokenUrl = destCredentials.url + '/oauth/token';
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(tokenUrl, params, {
      auth: {
        username: destCredentials.clientid,
        password: destCredentials.clientsecret
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get destination service token:', error.message);
    throw error;
  }
}

async function getTransporter() {
  if (process.env.NODE_ENV === 'development' || !process.env.VCAP_SERVICES) {
    console.log('[DEV MODE] Email service running in simulation mode');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.log('   VCAP_SERVICES:', process.env.VCAP_SERVICES ? 'exists' : 'not found');
    return {
      sendMail: async (opts) => {
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│         📧 SIMULATED EMAIL (DEV MODE)          │');
        console.log('└─────────────────────────────────────────────────┘');
        console.log('  To:', opts.to);
        console.log('  CC:', opts.cc || 'None');
        console.log('  Subject:', opts.subject);
        console.log('  Body Preview:', (opts.text || '').substring(0, 150));
        console.log('  Attachments:', opts.attachments?.length || 0);
        console.log('─────────────────────────────────────────────────');
        return { 
          messageId: `dev-${Date.now()}@localhost`,
          devMode: true,
          accepted: Array.isArray(opts.to) ? opts.to : [opts.to]
        };
      }
    };
  }

  console.log('[PRODUCTION MODE] Initializing nodemailer with OAuth2...');

  if (initializationError && initializationAttempted) {
    console.error('Previous initialization failed:', initializationError);
    throw initializationError;
  }

  if (!transporter && !initializationAttempted) {
    initializationAttempted = true;
    try {
      console.log('🔧 Loading destination configuration...');
      
      const config = await getDestinationConfig();
      
      console.log('Obtaining OAuth2 access token...');
      const accessToken = await getOAuth2AccessToken(config);

      console.log('🔧 Creating nodemailer transporter with OAuth2...');
      
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          type: 'OAuth2',
          user: config.user,
          accessToken: accessToken
        },
        tls: {
          rejectUnauthorized: false 
        }
      });

  
      await transporter.verify();
      
      console.log(`Nodemailer OAuth2 transporter initialized successfully`);
      console.log(`   SMTP Host: ${config.host}:${config.port}`);
      console.log(`   Authentication: OAuth2ClientCredentials`);
      console.log(`   User: ${config.user}`);
      
      initializationError = null;
      
      return transporter;

    } catch (error) {
      initializationError = new Error(`OAuth2 Email service initialization failed: ${error.message}`);
      console.error(' Failed to initialize OAuth2 email transporter');
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
      console.error('─────────────────────────────────────────────────');
      console.error('TROUBLESHOOTING STEPS FOR OAUTH2:');
      console.error('   1. Verify destination exists in BTP Cockpit:');
      console.error('      Connectivity → Destinations → sap_process_automation_mail');
      console.error('   2. Check OAuth2 destination properties:');
      console.error('      Required Properties:');
      console.error('        - Type: MAIL');
      console.error('        - Authentication: OAuth2ClientCredentials');
      console.error('        - tokenServiceURL: <your-oauth2-token-endpoint>');
      console.error('        - clientId: <your-client-id>');
      console.error('        - clientSecret: <your-client-secret>');
      console.error('        - mail.smtp.host: <your-smtp-server>');
      console.error('        - mail.smtp.port: 587 or 465');
      console.error('        - mail.user: <email-account-for-oauth2>');
      console.error('        - mail.from: pushpak.jha@risedx.com');
      console.error('      Optional:');
      console.error('        - scope: <required-oauth2-scopes>');
      console.error('   3. Test destination connection in BTP Cockpit');
      console.error('   4. Verify destination service binding in mta.yaml');
      console.error('   5. Check OAuth2 token endpoint accessibility');
      console.error('   6. Verify client credentials have mail sending permissions');
      console.error('─────────────────────────────────────────────────');
      throw initializationError;
    }
  }
  
  return transporter;
}


async function refreshTransporter() {
  console.log('Refreshing OAuth2 token and transporter...');
  transporter = null;
  initializationAttempted = false;
  initializationError = null;
  return await getTransporter();
}

async function sendMail({ subject, body, to, cc, attachment, text }) {
  console.log('sendMail called (OAuth2 via nodemailer)');
  console.log('   To:', to);
  console.log('   Subject:', subject);
  
  try {
    const recipients = Array.isArray(to) ? to : [to];
    const ccRecipients = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    
    let attachments = [];
    if (attachment) {
      attachments = Array.isArray(attachment) ? attachment : [attachment];
    }

    if (!recipients.length) {
      throw new Error('At least one recipient email is required');
    }
    if (!subject || subject.trim() === '') {
      throw new Error('Email subject is required');
    }
    if (!body && !text) {
      throw new Error('Email body (text) is required');
    }

    console.log('Email parameters validated');

    console.log('🔧 Getting OAuth2 nodemailer transporter...');
    let tr = await getTransporter();
    console.log('OAuth2 Transporter obtained');

    const mailOptions = {
      from: FROM_EMAIL,
      to: recipients,
      subject: subject.trim(),
      text: text || body,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      attachments: attachments.length > 0 ? attachments : undefined
    };

    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│      📧 SENDING EMAIL (OAuth2 PRODUCTION)      │');
    console.log('└─────────────────────────────────────────────────┘');
    console.log('  Authentication: OAuth2ClientCredentials');
    console.log('  Transport: Nodemailer');
    console.log('  From:', FROM_EMAIL);
    console.log('  To:', recipients.join(', '));
    if (ccRecipients.length > 0) {
      console.log('  CC:', ccRecipients.join(', '));
    }
    console.log('  Subject:', subject);
    console.log('  Has Text:', !!(text || body));
    console.log('  Attachments:', attachments.length);
    console.log('─────────────────────────────────────────────────');

    console.log('Calling nodemailer sendMail with OAuth2...');
    
    let result;
    try {
      result = await tr.sendMail(mailOptions);
    } catch (sendError) {
      if (sendError.message.includes('token') || sendError.message.includes('401') || sendError.message.includes('authentication')) {
        console.log('Token may be expired, refreshing and retrying...');
        tr = await refreshTransporter();
        result = await tr.sendMail(mailOptions);
      } else {
        throw sendError;
      }
    }
    
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│   ✅ EMAIL SENT SUCCESSFULLY (OAuth2)           │');
    console.log('└─────────────────────────────────────────────────┘');
    console.log('  Message ID:', result.messageId || 'N/A');
    console.log('  Response:', result.response || 'N/A');
    console.log('  Accepted:', result.accepted || []);
    console.log('  Rejected:', result.rejected || []);
    console.log('  Authentication: OAuth2ClientCredentials');
    console.log('─────────────────────────────────────────────────');
    
    return {
      success: true,
      messageId: result.messageId,
      recipients: recipients,
      accepted: result.accepted,
      rejected: result.rejected,
      timestamp: new Date().toISOString(),
      devMode: false,
      authType: 'OAuth2ClientCredentials'
    };

  } catch (error) {
    console.error('┌─────────────────────────────────────────────────┐');
    console.error('│      ❌ EMAIL SENDING FAILED (OAuth2)           │');
    console.error('└─────────────────────────────────────────────────┘');
    console.error('  Error:', error.message);
    console.error('  Type:', error.constructor.name);
    console.error('  Stack:', error.stack);
    
    if (error.message.includes('token') || error.message.includes('OAuth') || error.message.includes('401') || error.message.includes('authentication')) {
      console.error('─────────────────────────────────────────────────');
      console.error('OAUTH2 AUTHENTICATION ERROR DETECTED:');
      console.error('   1. Verify Token Service URL is correct');
      console.error('   2. Check Client ID and Client Secret');
      console.error('   3. Ensure OAuth2 scopes include mail sending permission');
      console.error('   4. Test token endpoint manually');
      console.error('   5. Verify mail.user matches OAuth2 account');
      console.error('   6. Check if OAuth2 app has SMTP access enabled');
    }
    
    console.error('─────────────────────────────────────────────────');
    
    return {
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
      authType: 'OAuth2ClientCredentials'
    };
  }
}


async function notifyManagerAndAdmin({ subject, text, body }) {
  const recipients = [MANAGER_EMAIL, ADMIN_EMAIL];
  
  console.log('notifyManagerAndAdmin called (OAuth2)');
  console.log('   Recipients:', recipients);
  
  return await sendMail({
    to: recipients,
    subject,
    text: text || body
  });
}


async function notifyTimesheetModification({ 
  employeeName, 
  employeeID, 
  weekStartDate, 
  weekEndDate, 
  task, 
  projectInfo, 
  totalHours,
  managerEmail 
}) {
  console.log('notifyTimesheetModification called (OAuth2)');
  console.log('   Employee:', employeeName, `(${employeeID})`);
  console.log('   Manager Email:', managerEmail);
  
  const subject = `Timesheet Modified - ${employeeName} (${employeeID})`;
  
  const text = `
TIMESHEET MODIFIED

${employeeName} has modified a previously submitted/approved timesheet entry.

DETAILS:
---------
Employee: ${employeeName} (${employeeID})
Week Period: ${weekStartDate} to ${weekEndDate}
Task Type: ${task}
Project/Activity: ${projectInfo}
Total Hours: ${totalHours} hours
Status: Modified - Requires Review

ACTION REQUIRED:
Please review the modified timesheet entry and approve or reject the changes in the Timesheet Management System.

---
This is an automated notification from the Timesheet Management System.
Authentication: OAuth2ClientCredentials (Nodemailer)
Sent: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST
  `;

  return await sendMail({
    to: managerEmail,
    subject,
    text
  });
}


async function notifyNonProjectRequest({ 
  employeeName, 
  employeeID, 
  requestType, 
  requestTypeID,
  weekStartDate, 
  weekEndDate, 
  totalHours,
  totalDays,
  taskDetails,
  managerEmail 
}) {
  console.log('notifyNonProjectRequest called (OAuth2)');
  console.log('   Employee:', employeeName, `(${employeeID})`);
  console.log('   Request Type:', requestType);
  console.log('   Manager Email:', managerEmail);
  
  
  let icon = '';
  
  if (requestType.toLowerCase().includes('leave')) {
    icon = '';
  } else if (requestType.toLowerCase().includes('training') || requestType.toLowerCase().includes('certification')) {
    icon = '';
  } else if (requestType.toLowerCase().includes('soft skill')) {
    icon = '';
  }

  const subject = `${icon} New ${requestType} Request - ${employeeName} (${employeeID})`;
  
  const text = `
${icon} ${requestType.toUpperCase()} REQUEST

${employeeName} has submitted a new ${requestType} request for your approval.

DETAILS:
---------
Employee: ${employeeName} (${employeeID})
Request Type: ${requestType} (${requestTypeID})
Week Period: ${weekStartDate} to ${weekEndDate}
Total Hours: ${totalHours} hours (≈ ${totalDays} days)
Details/Reason: ${taskDetails}
Status: Pending Approval

ACTION REQUIRED:
Please review this ${requestType.toLowerCase()} request and approve or reject it in the Timesheet Management System.

---
This is an automated notification from the Timesheet Management System.
Authentication: OAuth2ClientCredentials (Nodemailer)
Sent: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST
  `;

  return await sendMail({
    to: managerEmail,
    subject,
    text
  });
}

module.exports = {
  sendMail,
  notifyManagerAndAdmin,
  notifyTimesheetModification,
  notifyNonProjectRequest
};