require('dotenv').config();

const config = {
  PORT: process.env.PORT || 3000,
  
  // Groq AI Multi-Agent Matrix (Sinkron 100% dengan Code.gs & Groq Console)
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  GROQ_BACKUP_MODEL: process.env.GROQ_BACKUP_MODEL || 'qwen/qwen3.8-27b',
  GROQ_FAST_MODEL: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
  GROQ_EXTRACTOR_MODEL: process.env.GROQ_EXTRACTOR_MODEL || 'qwen/qwen3.8-27b',
  GROQ_ANALYST_MODEL: process.env.GROQ_ANALYST_MODEL || 'groq/compound',
  GROQ_VOICE_MODEL: process.env.GROQ_VOICE_MODEL || 'whisper-large-v3-turbo',

  // Groq Endpoints
  GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_WHISPER_URL: 'https://api.groq.com/openai/v1/audio/transcriptions',

  // Fonnte WhatsApp Gateway
  FONNTE_API_KEY: process.env.FONNTE_API_KEY || '',
  FONNTE_URL: 'https://api.fonnte.com/send',
  ADMIN_NUMBERS: (process.env.ADMIN_NUMBERS || '').split(',').map(n => n.trim().replace(/[^0-9]/g, '')).filter(Boolean),

  // Google Apps Script Headless API
  GAS_WEBAPP_URL: process.env.GAS_WEBAPP_URL || '',
  GAS_API_SECRET: process.env.GAS_API_SECRET || 'knowhere_secret_2026'
};

module.exports = config;
