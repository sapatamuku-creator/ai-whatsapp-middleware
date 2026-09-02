require('dotenv').config();

const config = {
  PORT: process.env.PORT || 3000,
  
  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL !== 'gemini-2.5-flash') 
    ? process.env.GEMINI_MODEL 
    : 'gemini-1.5-flash',

  // Fonnte WhatsApp Gateway
  FONNTE_API_KEY: process.env.FONNTE_API_KEY || '',
  FONNTE_URL: 'https://api.fonnte.com/send',
  ADMIN_NUMBERS: (process.env.ADMIN_NUMBERS || '6282214578132').split(',').map(n => n.trim()),

  // Google Apps Script Headless API
  GAS_WEBAPP_URL: process.env.GAS_WEBAPP_URL || '',
  GAS_API_SECRET: process.env.GAS_API_SECRET || 'knowhere_secret_2026'
};

module.exports = config;
