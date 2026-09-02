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

  // Fonnte WhatsApp Gateway
  FONNTE_API_KEY: process.env.FONNTE_API_KEY || '',
  FONNTE_URL: 'https://api.fonnte.com/send',
  ADMIN_NUMBERS: (process.env.ADMIN_NUMBERS || '').split(',').map(n => n.trim().replace(/[^0-9]/g, '')).filter(Boolean),

  // Google Apps Script Headless API
  GAS_WEBAPP_URL: process.env.GAS_WEBAPP_URL || '',
  GAS_API_SECRET: process.env.GAS_API_SECRET || 'knowhere_secret_2026'
};

module.exports = config;
