// const twilio = require('twilio');
// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); // Uncomment and set your API keys

async function sendCaseNotification(phones, caseTitle, caseLink) {
  if (!phones || phones.length === 0) return;
  // Placeholder: log the phones and message
  console.log('Twilio: Would send WhatsApp notification to:', phones);
  console.log('Case:', caseTitle, 'Link:', caseLink);
  // Uncomment below to actually send
  /*
  for (const phone of phones) {
    await client.messages.create({
      from: 'whatsapp:+14155238886', // Your Twilio WhatsApp number
      to: `whatsapp:${phone}`,
      body: `You have been added to the case: ${caseTitle}. View details: ${caseLink}`
    });
  }
  */
}

module.exports = { sendCaseNotification }; 