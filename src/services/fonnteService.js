const axios = require('axios');
const config = require('../config');

/**
 * Send WhatsApp text message via Fonnte Gateway
 */
async function sendWhatsAppMessage(target, message, url = null) {
  if (!config.FONNTE_API_KEY) {
    console.warn('[FONNTE] FONNTE_API_KEY is not configured.');
    return { status: false, message: 'API Key missing' };
  }

  const cleanTarget = String(target).replace(/[^0-9]/g, '');

  try {
    const payload = {
      target: cleanTarget,
      message: message
    };

    if (url) {
      payload.url = url;
    }

    const response = await axios.post(config.FONNTE_URL, payload, {
      headers: {
        Authorization: config.FONNTE_API_KEY
      },
      timeout: 15000
    });

    console.log(`[FONNTE SENT] To ${cleanTarget}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`[FONNTE ERROR] Failed to send message to ${cleanTarget}:`, error.message);
    return { status: false, error: error.message };
  }
}

module.exports = { sendWhatsAppMessage };
