const { processMessageWithAI } = require('../services/aiService');
const { sendWhatsAppMessage } = require('../services/fonnteService');
const config = require('../config');

/**
 * Controller untuk Webhook Fonnte WhatsApp
 */
async function handleFonnteWebhook(req, res) {
  // 1. Balas HTTP 200 ke Fonnte secepat kilat (<50ms) agar koneksi tidak pernah timeout
  res.status(200).json({ status: true, message: 'Message received and processing in background' });

  try {
    const body = req.body || {};
    let sender = body.sender || body.pengirim || body.from || body.phone || '';
    let rawMsg = body.message || body.pesan || body.text || '';
    let rawCaption = body.caption || '';
    let name = body.name || body.pushname || '';
    let mediaUrl = body.url || body.file || body.image || body.media || body.audio || body.media_url || '';

    // Normalisasi nomor pengirim
    if (sender.startsWith('0')) {
      sender = '62' + sender.slice(1);
    }
    const cleanSender = sender.replace(/[^0-9]/g, '');

    // Cek apakah pesan berasal dari Admin yang terdaftar (jika dikonfigurasi)
    if (config.ADMIN_NUMBERS.length > 0 && !config.ADMIN_NUMBERS.includes(cleanSender)) {
      console.log(`[WEBHOOK] Pesan diabaikan dari nomor non-admin: ${cleanSender}`);
      return;
    }

    // Tentukan isi teks pesan (prioritaskan caption jika gambar ber-caption)
    let message = '';
    if (rawCaption && rawCaption.trim()) {
      message = rawCaption.trim();
    } else if (rawMsg && !/^\[?(image|photo|gambar|file|audio|media|sticker)\]?$/i.test(rawMsg.trim())) {
      message = rawMsg.trim();
    }

    const isImage = !!mediaUrl && !/\.(ogg|mp3|wav|m4a|opus)(\?.*)?$/i.test(mediaUrl);

    console.log(`\n========================================`);
    console.log(`[INCOMING WHATSAPP] From: ${cleanSender} (${name})`);
    console.log(`Message: "${message}"`);
    if (mediaUrl) console.log(`Media URL: ${mediaUrl} (isImage: ${isImage})`);
    console.log(`========================================\n`);

    // Jalankan pemrosesan AI Multimodal + Tool Calling
    const replyText = await processMessageWithAI({
      sender: cleanSender,
      message: message,
      mediaUrl: mediaUrl,
      isImage: isImage
    });

    console.log(`[AI RESPONSE READY] Mengirimkan balasan ke ${cleanSender}...`);
    await sendWhatsAppMessage(cleanSender, replyText);

  } catch (err) {
    console.error('[WEBHOOK ERROR]:', err);
  }
}

module.exports = {
  handleFonnteWebhook
};
