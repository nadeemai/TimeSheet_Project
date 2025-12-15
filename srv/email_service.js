const { readServiceBindingServices } = require('@sap/xsenv/lib/serviceBindingService');

const SapCfMailer = require('sap-cf-mailer').default;


async function sendSimpleEmail() {
    try {
    const transporter = new SapCfMailer("MAIL");
    console.log('last try+++++++++++++++++++++++++++')
    await transporter.sendMail({
        to: 'aditya.mishra@sumodigitech.com',
        subject: 'Simple Test Email',
        html: '<p>This is a simple test email from Timesheet App.</p>'
    });
  
    return `Email sent successfully to aditya.mishra@sumodigitech.com`;
  } catch (err) {
    console.error(`Error in sendMail: ${err}`);
    return `Error in sendMail: ${err}`;
  }

}

module.exports = { sendSimpleEmail };