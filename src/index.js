const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { handleFonnteWebhook } = require('./controllers/webhookController');
const { processMessageWithAI } = require('./services/aiService');
const { callGasAction } = require('./services/gasClient');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan('dev'));

// 1. Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Knowhere Studio AI WhatsApp Middleware (Groq Multi-Agent)',
    primaryModel: config.MODELS.PRIMARY_MODEL,
    activeModels: config.getModelHierarchy(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 2. Fonnte Webhook Endpoint (Supports both POST for data and GET for verification)
app.post('/webhook/wa', handleFonnteWebhook);
app.get('/webhook/wa', (req, res) => res.status(200).json({ status: true, message: 'Fonnte webhook endpoint ready (GET)' }));
app.post('/webhook', handleFonnteWebhook);
app.get('/webhook', (req, res) => res.status(200).json({ status: true, message: 'Fonnte webhook endpoint ready (GET)' }));


// 3. Direct Test API Endpoint (bisa digunakan untuk debug tanpa WhatsApp)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sender = '6282214578132', mediaUrl = null, isImage = false, isAudio = false } = req.body;
    const reply = await processMessageWithAI({ sender, message, mediaUrl, isImage, isAudio });
    res.json({ success: true, reply });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Direct GAS Passthrough Test Endpoint
app.post('/api/gas', async (req, res) => {
  try {
    const { action, data } = req.body;
    const result = await callGasAction(action, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Server if not imported as module (Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(config.PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 KNOWHERE AI WHATSAPP MIDDLEWARE IS RUNNING!`);
    console.log(`📡 Port: ${config.PORT}`);
    console.log(`🤖 Primary AI Model: ${config.MODELS.PRIMARY_MODEL}`);
    console.log(`🔗 Webhook URL: http://localhost:${config.PORT}/webhook/wa`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
