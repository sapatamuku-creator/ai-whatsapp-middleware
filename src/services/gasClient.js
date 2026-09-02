const axios = require('axios');
const config = require('../config');

/**
 * Client to invoke Headless GAS API
 */
async function callGasAction(action, data = {}) {
  if (!config.GAS_WEBAPP_URL) {
    throw new Error('GAS_WEBAPP_URL is not configured in .env');
  }

  const payload = {
    action: action,
    data: data,
    secret: config.GAS_API_SECRET
  };

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`[GAS_CLIENT] Invoking action "${action}" (Attempt ${attempt}/${maxRetries})...`);
      const response = await axios.post(config.GAS_WEBAPP_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000,
        maxRedirects: 5
      });

      if (response.data && typeof response.data === 'object') {
        return response.data;
      }

      // If GAS returned string that needs JSON parsing
      if (typeof response.data === 'string') {
        try {
          return JSON.parse(response.data);
        } catch (e) {
          return { success: true, raw: response.data };
        }
      }

      return response.data;
    } catch (error) {
      console.error(`[GAS_CLIENT ERROR] Action "${action}" failed:`, error.message);
      if (attempt >= maxRetries) {
        return {
          success: false,
          error: `Gagal berkomunikasi dengan Google Apps Script: ${error.message}`
        };
      }
      // Exponential backoff wait
      await new Promise(res => setTimeout(res, 1500 * attempt));
    }
  }
}

module.exports = { callGasAction };
