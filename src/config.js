require('dotenv').config();
const { MODEL_REGISTRY, getActiveModelHierarchy } = require('./models');

const config = {
  PORT: process.env.PORT || 3000,
  
  // Groq API Key & Endpoints
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_WHISPER_URL: 'https://api.groq.com/openai/v1/audio/transcriptions',

  // Models Registry (Terpusat di src/models.js)
  MODELS: MODEL_REGISTRY,
  getModelHierarchy: getActiveModelHierarchy,

  // Fonnte WhatsApp Gateway & Access Control
  FONNTE_API_KEY: process.env.FONNTE_API_KEY || '',
  FONNTE_URL: 'https://api.fonnte.com/send',
  PERSONAL_ADMIN_NUMBER: process.env.PERSONAL_ADMIN_NUMBER || '6282214578132',
  VENDOR_ADMIN_NUMBER: process.env.VENDOR_ADMIN_NUMBER || '6287864752163',
  ADMIN_NUMBERS: (process.env.ADMIN_NUMBERS || '6282214578132').split(',').map(n => n.trim().replace(/[^0-9]/g, '')).filter(Boolean),

  // Jam Kerja Operasional Admin (WIB)
  WORK_START_HOUR_WIB: 7,  // 07.00 WIB
  WORK_END_HOUR_WIB: 17,   // 17.00 WIB

  // Rekening Resmi Knowhere Studio (Untuk DP Klien Publik)
  BANK_ACCOUNTS: [
    { bank: 'BCA', norek: '7746263472', atasNama: 'Gildan Novianto Syahrir Sobirin' },
    { bank: 'BRI', norek: '428201014655530', atasNama: 'Gildan novianto Syahrir S.' }
  ],
  DEFAULT_DP_AMOUNT: 500000,
  OFFICIAL_WEBSITE_URL: 'https://sapatamu.id/vendor/knowhere-studio',

  // Google Apps Script Headless API
  GAS_WEBAPP_URL: process.env.GAS_WEBAPP_URL || '',
  GAS_API_SECRET: process.env.GAS_API_SECRET || 'knowhere_secret_2026'
};

module.exports = config;
