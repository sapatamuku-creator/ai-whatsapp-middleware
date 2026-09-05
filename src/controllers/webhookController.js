const { processMessageWithAI } = require('../services/aiService');
const { sendWhatsAppMessage } = require('../services/fonnteService');
const { isWorkingHoursWIB, formatCurrentDateTimeWIB } = require('../utils/timeHelper');
const config = require('../config');

/**
 * Controller untuk Webhook Fonnte WhatsApp
 */
async function handleFonnteWebhook(req, res) {
  try {
    const body = req.body || {};
    console.log('[INCOMING WEBHOOK BODY]:', JSON.stringify(body));

    let sender = body.sender || body.pengirim || body.from || body.phone || '';
    let rawMsg = body.message || body.pesan || body.text || '';
    let rawCaption = body.caption || '';
    let name = body.name || body.pushname || '';
    let mediaUrl = body.url || body.file || body.image || body.media || body.audio || body.media_url || '';

    // Normalisasi nomor pengirim
    sender = String(sender).trim();
    if (sender.startsWith('+')) {
      sender = sender.slice(1);
    }
    if (sender.startsWith('0')) {
      sender = '62' + sender.slice(1);
    }
    const cleanSender = sender.replace(/[^0-9]/g, '');

    if (!cleanSender) {
      console.warn('[WEBHOOK WARN] Sender empty or invalid, ignoring.');
      return res.status(200).json({ status: false, message: 'Invalid sender' });
    }

    // Tentukan hak akses: Super Admin Pribadi vs Publik
    const isSuperAdmin = cleanSender === config.PERSONAL_ADMIN_NUMBER;
    const nowWorkingHours = isWorkingHoursWIB();
    const wibFormatted = formatCurrentDateTimeWIB();

    console.log(`\n========================================`);
    console.log(`[INCOMING WHATSAPP] From: ${cleanSender} (${name || 'Customer'})`);
    console.log(`[ACCESS CHECK] isSuperAdmin: ${isSuperAdmin}, Waktu: ${wibFormatted}, Jam Kerja: ${nowWorkingHours}`);

    // GATEKEEPER 1: Klien Publik di Jam Kerja (07.00 - 17.00 WIB)
    // AI DILARANG MEMBALAS. Silent Drop karena sepenuhnya ditangani oleh Admin Manusia.
    if (!isSuperAdmin && nowWorkingHours) {
      console.log(`[SILENT DROP] Klien publik ${cleanSender} masuk di jam kerja operasional (07.00 - 17.00 WIB). AI tidak membalas.`);
      console.log(`========================================\n`);
      return res.status(200).json({
        status: true,
        message: 'Jam operasional kerja (07.00 - 17.00 WIB): Ditangani langsung oleh Admin Manusia',
        ignored: true,
        sender: cleanSender
      });
    }

    // Tentukan isi teks pesan (prioritaskan caption jika gambar ber-caption)
    let message = '';
    if (rawCaption && rawCaption.trim()) {
      message = rawCaption.trim();
    } else if (rawMsg && !/^\[?(image|photo|gambar|file|audio|media|sticker)\]?$/i.test(rawMsg.trim())) {
      message = rawMsg.trim();
    }

    const isAudio = !!mediaUrl && /\.(ogg|mp3|wav|m4a|opus)(\?.*)?$/i.test(mediaUrl) || (body.audio && !!mediaUrl);
    const isImage = !!mediaUrl && !isAudio;

    console.log(`Message: "${message}"`);
    if (mediaUrl) console.log(`Media URL: ${mediaUrl} (isImage: ${isImage}, isAudio: ${isAudio})`);
    console.log(`========================================\n`);

    // Jalankan pemrosesan Groq AI (Isolasi Mode Admin vs Publik)
    const replyText = await processMessageWithAI({
      sender: cleanSender,
      message: message,
      mediaUrl: mediaUrl,
      isImage: isImage,
      isAudio: isAudio,
      isAdmin: isSuperAdmin,
      senderName: name
    });

    if (!replyText || !replyText.trim()) {
      return res.status(200).json({
        status: true,
        message: 'No response required or silently processed',
        sender: cleanSender
      });
    }

    console.log(`[AI RESPONSE READY] Mengirimkan balasan ke ${cleanSender}...`);
    const sendResult = await sendWhatsAppMessage(cleanSender, replyText);

    return res.status(200).json({
      status: true,
      message: 'Processed successfully',
      sender: cleanSender,
      reply: replyText,
      fonnteResult: sendResult
    });

  } catch (err) {
    console.error('[WEBHOOK ERROR]:', err);
    return res.status(200).json({ status: false, error: err.message });
  }
}

module.exports = {
  handleFonnteWebhook
};

