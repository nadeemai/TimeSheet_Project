const SapCfMailer = require('sap-cf-mailer').default;

const DESTINATION_NAME = 'OUTLOOK_MAIL';

const MANAGER_EMAIL = 'jayant.kumar@sumodigitech.com';
const ADMIN_EMAIL   = 'pushpak.jha@sumodigitech.com';

let transporter;


function getTransporter() {
  if (!process.env.VCAP_SERVICES && process.env.NODE_ENV !== 'production') {
    console.warn('Mailer: running in DEV mode without VCAP_SERVICES, emails are simulated.');
    return {
      sendMail: async (opts) => {
        console.log('[DEV-ONLY] Simulated email send:', JSON.stringify(opts, null, 2));
        return { devMode: true };
      }
    };
  }

  if (!transporter) {
    transporter = new SapCfMailer(OUTLOOK_MAIL);
    console.log(`Mailer initialized using destination: ${OUTLOOK_MAIL}`);
  }
  return transporter;
}


async function sendMailSafe({ to, subject, text, html }) {
  try {
    const tr = getTransporter();

    const fromAddress = process.env.MAIL_FROM || 'no-reply@sumodigitech.com';

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html
    };

    const result = await tr.sendMail(mailOptions);
    console.log('Email sent successfully:', result);
    return result;
  } catch (err) {
    console.error('Error while sending email:', err);
    return null;
  }
}


async function notifyManagerAndAdmin({ subject, text, html }) {
  const recipients = [MANAGER_EMAIL, ADMIN_EMAIL].join(',');
  return sendMailSafe({ to: recipients, subject, text, html });
}

module.exports = {
  sendMailSafe,
  notifyManagerAndAdmin
};
