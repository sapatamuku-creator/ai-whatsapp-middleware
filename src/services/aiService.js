const axios = require('axios');
const config = require('../config');
const { groqTools } = require('../tools/definitions');
const { callGasAction } = require('./gasClient');
const { sendWhatsAppMessage } = require('./fonnteService');
const { formatCurrentDateTimeWIB } = require('../utils/timeHelper');

// ============================================
// SYSTEM PROMPTS (ISOLASI ADMIN vs PUBLIK)
// ============================================

const SYSTEM_PROMPT_ADMIN = `
Kamu adalah NOVA, Executive AI Business Assistant untuk Knowhere Studio (vendor dokumentasi pernikahan & fotografi profesional di Bandung).
Kamu saat ini sedang berkomunikasi langsung dengan SUPER ADMIN / PEMILIK PRIBADI Knowhere Studio.

HAK AKSES:
- Kamu memiliki akses 24/7 penuh dan tidak terbatas ke seluruh tools database headless Google Apps Script (GAS).
- Kamu berhak menjalankan Tool Calling untuk cek omset ('getMonthlyOmset'), tambah booking ('addBooking'), update pembayaran DP/pelunasan ('updatePayment'), cek rincian bayar ('getPaymentSummary'), buat invoice PDF resmi ('generatePdfInvoice'), dan sinkronisasi Google Calendar/Drive.
- Saat Super Admin mengirimkan foto bukti transfer dan meminta invoice atau update pembayaran, segera panggil tool yang relevan dengan parameter bukti_url yang tersedia.

FORMAT BALASAN:
- Bahasa Indonesia yang profesional, padat, lugas, dan terstruktur.
- Format WhatsApp: *tebal*, _miring_, emoji yang relevan.
- Selalu sertakan link Google Drive PDF Invoice dan Folder Klien jika tersedia dari hasil tool.
`;

const SYSTEM_PROMPT_PUBLIC = `
Kamu adalah NOVA, Virtual Customer Care Assistant untuk Knowhere Studio (vendor dokumentasi pernikahan & fotografi profesional di Bandung).
Kamu sedang melayani KLIEN PUBLIK di luar jam operasional admin.

BATASAN & WHITELIST KETAT:
1. PRICELIST RESMI: Berikan informasi paket dan harga HANYA berdasarkan katalog resmi berikut:
   - Wedding Day (Akad + Resepsi):
     • NOER BASICS 1 (Photo Only): Rp 1.900.000
     • NOER BASICS 2 (Photo & Video): Rp 2.900.000 [BEST SELLER]
     • NOER PREMIUM (Photo & Video): Rp 3.900.000 [BEST SELLER]
     • NOER PLATINUM (Photo & Video): Rp 4.900.000
     • NOER DELUXE (Photo & Video + SDE): Rp 6.900.000
     • Add-On Video Cinematic: 1-2 Menit (Rp 1.500.000), 2-3 Menit (Rp 1.700.000)
   - Prewedding:
     • NOER BASICS 1 (Photo Only): Rp 1.800.000
     • NOER PREMIUM (Photo & Video): Rp 2.800.000
     • NOER DELUXE (Photo, Video & Drone): Rp 3.400.000
     • Add-On Video Cinematic: 1-2 Menit (Rp 1.300.000), 2-3 Menit (Rp 1.500.000)
   - Engagement:
     • NOER BASICS 1 (Photo Only): Rp 900.000
     • NOER BASICS 2 (Photo & Video): Rp 1.400.000
     • NOER PREMIUM (Photo & Video): Rp 1.800.000
     • NOER DELUXE (Photo & Video): Rp 2.400.000
     • Add-On Video Cinematic: 1-2 Menit (Rp 1.000.000), 2-3 Menit (Rp 1.300.000)
   - Wedding Party:
     • NOER PREMIUM (Photo & Video): Rp 2.900.000
     • NOER DELUXE (Photo & Video): Rp 3.900.000
   - Maternity:
     • NOER BASICS (Photo Only): Rp 900.000
     • NOER PREMIUM (Photo & Video): Rp 1.400.000
   - Siraman:
     • NOER BASICS 1 (Photo Only): Rp 900.000
     • NOER BASICS 2 (Photo & Video): Rp 1.400.000
     • NOER PREMIUM (Photo & Video): Rp 1.600.000
     • NOER DELUXE (Photo & Video): Rp 1.800.000

2. TAUTAN RESMI:
   Jika klien menanyakan detail atau rincian lengkap paket, selalu berikan link katalog resmi:
   🔗 https://sapatamu.id/vendor/knowhere-studio
   (Sampaikan bahwa rincian produk, output liputan, dan portofolio lengkap tertera di link tersebut).

3. FORMULIR PEMESANAN & SYARAT PENGUNCIAN SLOT (DP):
   Jika klien ingin memesan / booking slot tanggal acara:
   a. Berikan formulir pemesanan berikut untuk disalin dan dilengkapi oleh klien:
      📋 *FORMULIR PEMESANAN SLOT KNOWHERE STUDIO*
      Silakan lengkapi data berikut:
      - Nama Lengkap:
      - Nomor WhatsApp:
      - Jenis Acara (Wedding / Prewedding / Engagement / dll):
      - Paket yang Dipilih:
      - Tanggal Acara:
      - Waktu / Jam Acara:
      - Lokasi / Venue Acara:
      - Catatan Khusus:
   b. Informasikan bahwa untuk mengunci slot tanggal (maksimal kuota 2 event per hari), klien wajib membayarkan Down Payment (DP) awal sebesar *Rp 500.000* ke rekening resmi:
      🏦 *BCA: 7746263472* a/n *Gildan Novianto Syahrir Sobirin*
      🏦 *BRI: 428201014655530* a/n *Gildan novianto Syahrir S.*
   c. Mintakan klien untuk mengirimkan kembali formulir yang sudah diisi beserta foto bukti transfer DP ke chat WhatsApp ini.

4. ALUR JIKA KLIEN SUDAH MENGISI FORMULIR ATAU BAYAR DP:
   Sampaikan dengan ramah dan sopan bahwa data pemesanan dan konfirmasi pembayaran sudah diterima dengan baik, dan akan diverifikasi serta di-input resmi oleh admin kami pada jam operasional kerja (mulai pukul 07.00 WIB).

5. LARANGAN KERAS:
   - DILARANG KERAS mengarang atau mengubah harga di luar katalog resmi.
   - DILARANG membuat paket kustom atau memberikan diskon tanpa persetujuan admin.
   - DILARANG membocorkan data nama atau jadwal pemesan lain.
   - Untuk hal-hal di luar katalog, negosiasi khusus, atau pertanyaan kompleks, jawab ramah:
     "Untuk hal ini mohon ditunggu ya kak, akan didiskusikan dan dijawab langsung oleh admin kami saat jam operasional (mulai pukul 07.00 WIB)."
`;

/**
 * Memory percakapan per user (In-Memory Map, rolling window)
 */
const userSessions = new Map();

function getSessionHistory(sender, isAdmin = false) {
  const targetPrompt = isAdmin ? SYSTEM_PROMPT_ADMIN : SYSTEM_PROMPT_PUBLIC;
  
  if (!userSessions.has(sender)) {
    userSessions.set(sender, {
      isAdmin: isAdmin,
      history: [{ role: 'system', content: targetPrompt }]
    });
  }

  const session = userSessions.get(sender);
  // Reset jika role berganti antara admin dan publik
  if (session.isAdmin !== isAdmin) {
    session.isAdmin = isAdmin;
    session.history = [{ role: 'system', content: targetPrompt }];
  }

  return session.history;
}

function appendToSession(sender, role, content, extra = {}, isAdmin = false) {
  const history = getSessionHistory(sender, isAdmin);
  history.push({ role, content, ...extra });
  
  const targetPrompt = isAdmin ? SYSTEM_PROMPT_ADMIN : SYSTEM_PROMPT_PUBLIC;

  // Jaga ukuran history agar token tetap ramping dan tidak pernah 413
  if (history.length > 8) {
    const recent = history.slice(history.length - 6);
    userSessions.set(sender, {
      isAdmin: isAdmin,
      history: [
        { role: 'system', content: targetPrompt },
        ...recent
      ]
    });
  }
}

/**
 * Kompresi dan sanitasi hasil data dari Google Apps Script agar hemat token & anti Error 413
 */
function sanitizeAndCompressGasResult(gasResult) {
  if (!gasResult) return JSON.stringify({ success: false, message: 'No data returned' });

  if (Array.isArray(gasResult)) {
    const trimmed = gasResult.map(row => {
      if (typeof row === 'object' && row !== null) {
        return {
          nama: row.nama || row.Nama || row.name || row.client || '',
          tanggal: row.tanggal || row.Tanggal || row.date || '',
          layanan: row.layanan || row.Layanan || '',
          paket: row.paket || row.Paket || '',
          harga: Number(row.harga || row.Harga || row['Harga Paket'] || 0),
          dpTotal: (Number(row.dp1 || row.DP1 || 0) + Number(row.dp2 || row.DP2 || 0) + Number(row.dp3 || row.DP3 || 0) + Number(row.dp4 || row.DP4 || 0)),
          sisa: Number(row.sisa || row.Sisa || row['Sisa Pembayaran'] || 0),
          status: row.status || row.Status || ''
        };
      }
      return row;
    });

    const str = JSON.stringify(trimmed);
    if (str.length > 15000) {
      return str.substring(0, 15000) + '... (data diringkas)';
    }
    return str;
  }

  const str = JSON.stringify(gasResult);
  if (str.length > 20000) {
    return str.substring(0, 20000) + '... (data diringkas)';
  }
  return str;
}

/**
 * Transkrip Voice Note WhatsApp via Groq Whisper API (whisper-large-v3-turbo)
 */
async function transcribeAudioGroq(audioUrl) {
  if (!config.GROQ_API_KEY) {
    return { success: false, message: 'GROQ_API_KEY belum dikonfigurasi' };
  }

  try {
    console.log(`[GROQ_WHISPER] Mengunduh audio VN dari ${audioUrl}...`);
    const audioResp = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 25000
    });

    const formData = new FormData();
    const audioBlob = new Blob([audioResp.data], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'voice_note.ogg');
    formData.append('model', config.MODELS.VOICE_MODEL);
    formData.append('language', 'id');
    formData.append('response_format', 'json');

    console.log(`[GROQ_WHISPER] Mengirim ke Groq Whisper (${config.MODELS.VOICE_MODEL})...`);
    const res = await axios.post(config.GROQ_WHISPER_URL, formData, {
      headers: {
        'Authorization': `Bearer ${config.GROQ_API_KEY}`
      },
      timeout: 30000
    });

    if (res.data && res.data.text) {
      console.log(`[GROQ_WHISPER SUCCESS] Hasil transkrip: "${res.data.text}"`);
      return { success: true, text: res.data.text };
    }

    return { success: false, error: 'Tidak ada teks yang dihasilkan' };
  } catch (err) {
    console.error('[GROQ_WHISPER ERROR]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Panggil Groq Chat Completion API dengan Auto-Failover Matrix Terpusat (src/models.js)
 */
async function callGroqChat(messages, tools = []) {
  if (!config.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY belum dikonfigurasi di Environment Variables Vercel!');
  }

  const uniqueModels = config.getModelHierarchy();

  const cleanMessages = messages.map(m => {
    const copy = { ...m };
    delete copy.reasoning;
    delete copy.reasoning_content;
    return copy;
  });

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      console.log(`[GROQ_CHAT] Memanggil model: ${model} (Tools: ${tools && tools.length ? tools.length : 'None'})...`);
      const payload = {
        model: model,
        messages: cleanMessages,
        temperature: 0.3,
        max_tokens: 1500
      };

      if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
      }

      const res = await axios.post(config.GROQ_URL, payload, {
        headers: {
          'Authorization': `Bearer ${config.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      const choice = res.data.choices && res.data.choices[0];
      if (choice && choice.message) {
        return choice.message;
      }
    } catch (err) {
      const errMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
      console.warn(`[GROQ_CHAT WARN] Model "${model}" mengalami kendala (${errMsg}), beralih ke cadangan...`);
      lastError = err;
    }
  }

  throw new Error(`Semua model Groq gagal dipanggil: ${lastError ? lastError.message : 'Unknown error'}`);
}

/**
 * Jalankan Groq Orchestrator (Isolasi Mode Admin vs Publik)
 */
async function processMessageWithAI({ sender, message, mediaUrl, isImage, isAudio, isAdmin = false, senderName = '' }) {
  try {
    let promptContent = message || '';

    // 1. Handle Voice Note (Groq Whisper)
    if (isAudio && mediaUrl) {
      const whisperResult = await transcribeAudioGroq(mediaUrl);
      if (whisperResult.success && whisperResult.text) {
        promptContent = whisperResult.text;
      } else {
        promptContent = `[Voice Note diterima tapi gagal ditranskrip: ${whisperResult.error || 'unknown'}]`;
      }
    }

    // 2. Handle Foto Bukti Transfer / Media
    if (isImage && mediaUrl) {
      if (isAdmin) {
        if (!promptContent.trim()) {
          return `📸 *Foto Bukti Transfer Berhasil Diterima!*\n\nSilakan balas dengan perintah invoice, contoh:\n👉 \`/invoice Kinnas ID dp1 500 ribu\`\n👉 \`/invoice Widya Dela Putri\`\n\n_NOVA akan otomatis mengunggah foto ini ke folder Drive klien & membuatkan Invoice PDF resmi!_ ✨`;
        } else {
          promptContent = `${promptContent}\n[Bukti Transfer URL: ${mediaUrl}]`;
        }
      } else {
        // Mode Publik: Klien mengirim foto bukti transfer DP di luar jam kerja
        promptContent = promptContent.trim()
          ? `${promptContent}\n[Foto Bukti Transfer Terlampir: ${mediaUrl}]`
          : `[Klien mengirimkan Foto Bukti Pembayaran DP: ${mediaUrl}]`;
      }
    }

    if (!promptContent.trim()) {
      if (isAdmin) {
        return "Halo Super Admin! Ada yang bisa NOVA bantu untuk pengelolaan database & invoice Knowhere Studio hari ini? 😊";
      }
      return `Halo! Terima kasih sudah menghubungi Knowhere Studio. Ada yang bisa NOVA bantu untuk kebutuhan dokumentasi Anda? 😊\n\n_(NOVA AGENT)_`;
    }

    // ========================================================
    // ALUR KHUSUS PUBLIK: DETEKSI FORMULIR BOOKING & BUKTI DP
    // ========================================================
    if (!isAdmin) {
      const isBookingFormOrDp = 
        isImage ||
        /(nama\s*(lengkap)?|jenis\s*acara|paket\s*(yang)?\s*dipilih|tanggal\s*acara|lokasi|venue|formulir\s*pemesanan|sudah\s*(bayar|transfer)|bukti\s*(transfer|dp|bayar)|dp\s*500)/i.test(promptContent);

      if (isBookingFormOrDp) {
        console.log(`[FORWARD NOTIFIKASI] Terdeteksi formulir booking/bukti DP dari ${sender}. Meneruskan ke Super Admin ${config.PERSONAL_ADMIN_NUMBER}...`);
        
        const notifAdmin = 
          `🔔 *NOTIFIKASI PEMESANAN / BUKTI DP KLIEN (LUAR JAM KERJA)*\n\n` +
          `📱 *Pengirim:* +${sender} (${senderName || 'Klien'})\n` +
          `⏰ *Waktu Masuk:* ${formatCurrentDateTimeWIB()}\n\n` +
          `📝 *Isi Pesan Klien:*\n${promptContent}\n\n` +
          (mediaUrl ? `📸 *Lampiran Bukti:* ${mediaUrl}\n\n` : '') +
          `⚠️ _Catatan: Data ini BELUM dimasukkan ke spreadsheet. Silakan tinjau dan masukkan ke database saat jam operasional atau via perintah NOVA._`;

        // Forward pesan ke nomor pribadi Super Admin
        sendWhatsAppMessage(config.PERSONAL_ADMIN_NUMBER, notifAdmin).catch(e => {
          console.error('[FORWARD ERROR] Gagal mengirim notifikasi ke admin:', e.message);
        });

        // Jika klien mengirim foto bukti transfer, berikan jawaban konfirmasi langsung
        if (isImage) {
          return `🙏 *Terima kasih sudah melakukan pemesanan ke Knowhere Studio!*\n\nData pemesanan dan bukti pembayaran DP Anda telah kami terima dengan baik. Data ini akan ditinjau, diverifikasi, dan di-input oleh admin kami di jam kerja operasional (mulai pukul 07.00 WIB).\n\nAdmin kami akan menghubungi kakak kembali untuk konfirmasi selanjutnya ya! ✨\n\n_(NOVA AGENT)_`;
        }
      }
    }

    // Tambahkan pesan user ke sesi percakapan
    appendToSession(sender, 'user', promptContent, {}, isAdmin);

    // ========================================================
    // MODE PUBLIK: ZERO HEADLESS TOOLS (HANYA CS INFORMATIF)
    // ========================================================
    if (!isAdmin) {
      const currentHistory = getSessionHistory(sender, false);
      const assistantMsg = await callGroqChat(currentHistory, []); // TOOLS = [] KOSONG!
      
      let finalReply = assistantMsg.content || '';
      appendToSession(sender, 'assistant', finalReply, {}, false);

      // Wajib sertakan footer bot untuk publik jika belum ada
      if (!finalReply.includes('_(NOVA AGENT)_')) {
        finalReply = finalReply.trim() + '\n\n_(NOVA AGENT)_';
      }

      return finalReply;
    }

    // ========================================================
    // MODE SUPER ADMIN: FULL HEADLESS TOOLS (24/7 GAS EXECUTION)
    // ========================================================
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      loopCount++;
      const currentHistory = getSessionHistory(sender, true);
      
      const assistantMsg = await callGroqChat(currentHistory, groqTools);

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        appendToSession(sender, 'assistant', assistantMsg.content || '', {}, true);
        return assistantMsg.content;
      }

      console.log(`[GROQ_TOOL] Model meminta eksekusi ${assistantMsg.tool_calls.length} tool(s) (Loop ${loopCount}/${maxLoops})`);
      
      appendToSession(sender, 'assistant', assistantMsg.content || null, {
        tool_calls: assistantMsg.tool_calls
      }, true);

      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          toolArgs = {};
        }

        if (isImage && mediaUrl && !toolArgs.bukti_url) {
          toolArgs.bukti_url = mediaUrl;
        }

        console.log(`[EXECUTE_GAS_TOOL] "${toolName}" dengan args:`, JSON.stringify(toolArgs));
        
        const rawGasResult = await callGasAction(toolName, toolArgs);
        const compressedGasResult = sanitizeAndCompressGasResult(rawGasResult);
        console.log(`[GAS_RESULT] "${toolName}" (Panjang payload: ${compressedGasResult.length} karakter)`);

        const historyRef = getSessionHistory(sender, true);
        historyRef.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: compressedGasResult
        });
      }
    }

    return "Permintaan Anda telah berhasil diproses oleh sistem Knowhere Studio. Ada yang bisa NOVA bantu lagi?";
  } catch (error) {
    console.error('[AI_SERVICE ERROR]:', error.message);
    if (!isAdmin) {
      return `Maaf, saat ini sistem informasi sedang sibuk. Silakan coba kembali sesaat lagi atau hubungi admin kami pada jam operasional (07.00 - 17.00 WIB).\n\n_(NOVA AGENT)_`;
    }
    return `Maaf, terjadi kendala saat memproses permintaan Super Admin: ${error.message}`;
  }
}

module.exports = {
  processMessageWithAI
};

