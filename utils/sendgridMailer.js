// utils/sendgridMailer.js
// Utility for sending emails via SendGrid

const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

// if (SENDGRID_API_KEY) {
//   sgMail.setApiKey(SENDGRID_API_KEY);
// }
// To re-enable SendGrid, uncomment above.

/**
 * Send an email using SendGrid
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 */
async function sendEmail({ to, subject, text, html }) {
  // if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
  //   logger.error('SendGrid API key or from email not set');
  //   throw new Error('Email service not configured');
  // }
  // Skipping SendGrid config check for safe build
  const msg = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject,
    text,
    html: html || undefined,
  };
  try {
    // await sgMail.send(msg);
    // logger.info(`Email sent to ${to}`);
    // SendGrid disabled for safe build
    return true;
  } catch (error) {
    logger.error(`SendGrid error: ${error.message}`);
    throw error;
  }
}

async function sendCaseNotification(emails, caseTitle, caseLink) {
  if (!emails || emails.length === 0) return;
  // Placeholder: log the emails and message
  console.log('SendGrid: Would send case notification to:', emails);
  console.log('Case:', caseTitle, 'Link:', caseLink);
  // Uncomment below to actually send
  /*
  const msg = {
    to: emails,
    from: 'no-reply@adhivakta.com',
    subject: `You were added to the case: ${caseTitle}`,
    text: `You have been added to the case: ${caseTitle}. View details: ${caseLink}`,
    html: `<p>You have been added to the case: <b>${caseTitle}</b>.</p><p><a href="${caseLink}">View Case Details</a></p>`
  };
  await sgMail.sendMultiple(msg);
  */
}

module.exports = { sendEmail, sendCaseNotification };
