const cds = require('@sap/cds');

/**
 * ====================================================================
 * CORE EMAIL SENDING FUNCTION - Used by all other email functions
 * ====================================================================
 */
async function sendSimpleEmail() {
  try {
    const graphService = await cds.connect.to('Graph_API');

    const mailData = {
      message: {
        subject: "Test via cds.connect.to",
        body: {
          contentType: "HTML",
          content: "<p>This email was sent using the native <b>CAP REST Client</b>.</p>"
        },
        toRecipients: [
          {
            emailAddress: {
              address: "sumit.jhaldiyal@sumodigitech.com"
            }
          }
        ]
      },
      saveToSentItems: false
    };

    await graphService.send(
      'POST',
      '/users/pushpak.jha@risedx.com/sendMail',
      mailData
    );

    return "Email sent successfully";

  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
}

/**
 * ====================================================================
 * GENERIC EMAIL SENDER - Base function for all emails
 * ====================================================================
 */
async function sendEmail({ to, cc = [], subject, htmlContent }) {
    try {
        const graph = await cds.connect.to('Graph_API');
        const sender = 'pushpak.jha@risedx.com';
        
        const payload = {
            message: {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: htmlContent
                },
                toRecipients: to.map(email => ({
                    emailAddress: { address: email }
                })),
                ccRecipients: cc.map(email => ({
                    emailAddress: { address: email }
                }))
            },
            saveToSentItems: true
        };
        
        await graph.send('POST', `/users/${sender}/sendMail`, payload);
        
        console.log('✅ Email sent successfully to:', to);
        return {
            success: true,
            messageId: 'graph-api-success',
            recipients: to,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * ====================================================================
 * 1. TIMESHEET MODIFICATION EMAIL - When employee modifies timesheet
 * ====================================================================
 */
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
    console.log('📧 Sending timesheet modification notification...');
    
    const subject = `⚠️ Timesheet Modified - ${employeeName} (${employeeID})`;
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-card { background: white; border-left: 4px solid #f39c12; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .info-row:last-child { border-bottom: none; }
                .info-label { font-weight: bold; color: #f39c12; }
                .warning-box { background: #fff3cd; border-left: 4px solid #dd8100ff; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>⚠️ Timesheet Modified</h1>
                <p>Previously approved timesheet has been updated</p>
            </div>
            
            <div class="content">
                <p>Dear Manager,</p>
                
                <p>An employee has modified their previously approved timesheet. Please review the changes:</p>
                
                <div class="info-card">
                    <div class="info-row">
                        <span class="info-label">👤 Employee:</span>
                        <span><strong>${employeeName}</strong> (${employeeID})</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📅 Week Period:</span>
                        <span>${weekStartDate} to ${weekEndDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📋 Task:</span>
                        <span>${task}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📁 Project:</span>
                        <span>${projectInfo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">⏱️ Total Hours:</span>
                        <span><strong>${totalHours} hours</strong></span>
                    </div>
                </div>
                
                <div class="warning-box">
                    <p style="margin: 0;"><strong>⚠️ Action Required:</strong></p>
                    <p style="margin: 10px 0 0 0;">Please review and re-approve this modified timesheet in the Manager Dashboard.</p>
                </div>
                
                <p>Best regards,<br><strong>Timesheet Application</strong></p>
            </div>
            
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Sumo Digitech. All rights reserved.</p>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail({
        to: [managerEmail],
        subject: subject,
        htmlContent: htmlContent
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
    console.log('📧 Sending non-project request notification...');
    
    const isLeave = ['Personal Leave', 'Sick Leave', 'Half Day Leave'].includes(requestType);
    
    let requestIcon = '📝';
    let requestColor = '#3498db';
    
    if (isLeave) {
        requestIcon = '🏖️';
        requestColor = '#e74c3c';
    } else if (requestType.includes('Training') || requestType.includes('Certification')) {
        requestIcon = '📚';
        requestColor = '#9b59b6';
    } else if (requestType.includes('Soft Skills')) {
        requestIcon = '💡';
        requestColor = '#f39c12';
    }
    
    const subject = `${requestIcon} ${isLeave ? 'Leave Request' : 'Non-Project Request'} - ${employeeName}`;
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, ${requestColor} 0%, ${requestColor}dd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-card { background: white; border-left: 4px solid ${requestColor}; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .info-row:last-child { border-bottom: none; }
                .info-label { font-weight: bold; color: ${requestColor}; }
                .highlight-box { background: #e8f5e9; border: 2px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; }
                .duration-badge { display: inline-block; background: ${requestColor}; color: white; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${requestIcon} ${isLeave ? 'Leave Request' : 'Non-Project Activity Request'}</h1>
                <p>${requestType}</p>
            </div>
            
            <div class="content">
                <p>Dear Manager,</p>
                
                <p>${employeeName} has submitted a ${isLeave ? 'leave request' : 'non-project activity request'}. Please review the details below:</p>
                
                <div class="info-card">
                    <div class="info-row">
                        <span class="info-label">👤 Employee:</span>
                        <span><strong>${employeeName}</strong> (${employeeID})</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">${requestIcon} Request Type:</span>
                        <span><strong>${requestType}</strong> ${requestTypeID ? `(${requestTypeID})` : ''}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📅 Week Period:</span>
                        <span>${weekStartDate} to ${weekEndDate}</span>
                    </div>
                    ${isLeave ? `
                    <div class="info-row">
                        <span class="info-label">⏱️ Duration:</span>
                        <span><span class="duration-badge">${totalDays} day(s) / ${totalHours} hours</span></span>
                    </div>
                    ` : `
                    <div class="info-row">
                        <span class="info-label">⏱️ Total Hours:</span>
                        <span><strong>${totalHours} hours</strong></span>
                    </div>
                    `}
                    ${taskDetails ? `
                    <div class="info-row">
                        <span class="info-label">📝 Details:</span>
                        <span>${taskDetails}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="highlight-box">
                    <p style="margin: 0; font-size: 16px;">
                        <strong>✅ Action Required:</strong><br>
                        Please review and ${isLeave ? 'approve/reject this leave request' : 'approve this request'} in the Manager Dashboard.
                    </p>
                </div>
                
                <p>Best regards,<br><strong>Timesheet Application</strong></p>
            </div>
            
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Sumo Digitech. All rights reserved.</p>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail({
        to: [managerEmail],
        subject: subject,
        htmlContent: htmlContent
    });
}


async function sendWelcomeEmail({
    employeeName,
    employeeEmail,
    employeeID,
    dashboardUrl,
    managerName,
    linkToken
}) {
    console.log('📧 Sending welcome email with dashboard link...');
    
    const subject = `🎉 Welcome to Timesheet Application - Your Dashboard Access`;
    
    const htmlContent = `
       <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #ffffff;
      color: #333;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h2 {
      margin-bottom: 8px;
      font-size: 20px;
      color: #0b5ed7;
    }
    p {
      margin: 10px 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .details {
      margin: 16px 0;
      padding-left: 0;
      list-style: none;
    }
    .details li {
      margin-bottom: 6px;
    }
    .label {
      font-weight: bold;
    }
    .link {
      margin: 16px 0;
      padding: 10px;
      background: #f4f6f8;
      font-size: 12px;
      word-break: break-all;
    }
    .btn {
      display: inline-block;
      margin: 12px 0;
      padding: 10px 20px;
      background: #0b5ed7;
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
    }
    .note {
      margin-top: 16px;
      padding: 10px;
      background: #f8f9fa;
      font-size: 13px;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>

<body>
  <div class="container">
    <h2>Welcome to the Timesheet Application</h2>

    <p>Dear <strong>${employeeName}</strong>,</p>

    <p>Your employee account has been created successfully. Below are your details:</p>

    <ul class="details">
      <li><span class="label">Employee Name:</span> ${employeeName}</li>
      <li><span class="label">Employee ID:</span> ${employeeID}</li>
      <li><span class="label">Email:</span> ${employeeEmail}</li>
      ${managerName ? `<li><span class="label">Reporting Manager:</span> ${managerName}</li>` : ''}
    </ul>

    <p><strong>Your personal dashboard link:</strong></p>

    <a href="${dashboardUrl}" class="btn">Open Dashboard</a>

    <div class="link">${dashboardUrl}</div>

    <p><strong>How it works:</strong></p>
    <ol>
      <li>Open the dashboard link or your bookmarked link</li>
      <li>An OTP will be sent to this email</li>
      <li>Enter the OTP to access your dashboard</li>
      <li>Manage and submit your timesheet</li>
    </ol>

    <div class="note">
      <strong>Important:</strong>
      <ul>
        <li>Bookmark this link for future access</li>
        <li>Do not share your dashboard link</li>
        <li>OTP is required for every login</li>
        <li>OTP is valid for 10 minutes (3 attempts)</li>
      </ul>
    </div>

    <p>
      If you need help, please contact your manager or HR team.
    </p>

    <p>
      Regards,<br>
      <strong>Timesheet Application Team</strong><br>
      Sumo Digitech
    </p>

    <div class="footer">
      This is an automated email. Please do not reply.<br>
      © ${new Date().getFullYear()} Sumo Digitech
    </div>
  </div>
</body>
</html>

    `;
    
    return await sendEmail({
        to: [employeeEmail],
        cc: ['aditya.mishra@sumodigitech.com'],
        subject: subject,
        htmlContent: htmlContent
    });
}

/**
 * ====================================================================
 * 4. OTP EMAIL - Sent automatically when employee opens dashboard link
 * ====================================================================
 */
async function sendOTPEmail({
    employeeName,
    employeeEmail,
    otp,
    expiryMinutes
}) {
    console.log('📧 Sending OTP verification email to:', employeeEmail);
    
    const subject = `🔐 Your OTP Code: ${otp} - Timesheet Dashboard Access`;
    
    const htmlContent = `
       <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #ffffff;
      color: #333;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h2 {
      font-size: 20px;
      margin-bottom: 6px;
      color: #0b5ed7;
    }
    p {
      font-size: 14px;
      line-height: 1.5;
      margin: 10px 0;
    }
    .otp {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      margin: 16px 0;
      color: #0b5ed7;
    }
    .box {
      background: #f8f9fa;
      padding: 12px;
      margin: 16px 0;
      font-size: 13px;
    }
    .warning {
      color: #b02a37;
      font-weight: bold;
      margin-top: 16px;
    }
    ul {
      margin: 8px 0 8px 18px;
      padding: 0;
    }
    li {
      margin-bottom: 6px;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>

<body>
  <div class="container">
    <h2>Timesheet Dashboard OTP Verification</h2>

    <p>Dear <strong>${employeeName}</strong>,</p>

    <p>
      You requested access to your Timesheet Dashboard.
      Please use the OTP below to complete the verification.
    </p>

    <div class="otp">${otp}</div>

    <div class="box">
      <ul>
        <li>This OTP is valid for <strong>${expiryMinutes} minutes</strong></li>
        <li>You have <strong>3 attempts</strong> to enter the correct OTP</li>
        <li>Do not share this OTP with anyone</li>
        <li>If the OTP expires, use the <strong>Retry</strong> option to generate a new code</li>
      </ul>
    </div>

    <p class="warning">
      If you did not request this OTP, please ignore this email or contact your administrator immediately.
    </p>

    <p>
      Regards,<br>
      <strong>Timesheet Application Team</strong><br>
      Sumo Digitech
    </p>

    <div class="footer">
      This is an automated email. Please do not reply.<br>
      © ${new Date().getFullYear()} Sumo Digitech
    </div>
  </div>
</body>
</html>
    `;
    
    return await sendEmail({
        to: [employeeEmail],
        subject: subject,
        htmlContent: htmlContent
    });
}

/**
 * ====================================================================
 * TEST EMAIL FUNCTIONS
 * ====================================================================
 */
async function sendTestEmail(recipientEmail) {
    console.log('🧪 Sending test email to:', recipientEmail);
    
    const subject = '✅ Test Email - Timesheet Application';
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .success-box { background: #d4edda; border: 2px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>✅ Email Configuration Test</h1>
                <p>Microsoft Graph API Integration</p>
            </div>
            
            <div class="content">
                <div class="success-box">
                    <h2 style="color: #28a745; margin: 0;">🎉 Success!</h2>
                    <p style="margin: 10px 0 0 0;">Email system is working correctly.</p>
                </div>
                
                <p>This is a test email from the Timesheet Application.</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p><strong>Recipient:</strong> ${recipientEmail}</p>
                <p><strong>Email Service:</strong> Microsoft Graph API</p>
                
                <p>If you received this email, the email configuration is working properly!</p>
            </div>
            
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Sumo Digitech. All rights reserved.</p>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail({
        to: [recipientEmail],
        subject: subject,
        htmlContent: htmlContent
    });
}

module.exports = {
    sendSimpleEmail,
    sendEmail,
    notifyTimesheetModification,
    notifyNonProjectRequest,
    sendWelcomeEmail,
    sendOTPEmail,
    sendTestEmail
};