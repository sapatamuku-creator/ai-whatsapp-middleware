const axios = require('axios');
const config = require('../config');
const { groqTools } = require('../tools/definitions');
const { callGasAction } = require('./gasClient');
const { sendWhatsAppMessage } = require('./fonnteService');
const { formatCurrentDateTimeWIB } = require('../utils/timeHelper');
const { extractDateFromText } = require('../utils/dateHelper');

// ============================================
// SYSTEM PROMPTS (ISOLASI ADMIN vs PUBLIK)
// ============================================

const SYSTEM_PROMPT_ADMIN = `
Kamu adalah NOVA, Executive AI Business Assistant untuk Knowhere Studio (vendor dokumentasi pernikahan & fotografi profesional di Bandung).
Kamu saat ini sedang berkomunikasi langsung dengan SUPER ADMIN / PEMILIK PRIBADI Knowhere Studio via WhatsApp.

HAK AKSES & KEMAMPUAN:
- Akses 24/7 penuh ke seluruh tools database headless Google Apps Script (GAS).
- Tool Calling tersedia: 'getMonthlyOmset', 'addBooking', 'updatePayment', 'getPaymentSummary', 'generatePdfInvoice', 'createClientDriveFolder', 'syncGoogleCalendar', 'getBookingByName', 'getAllBookings', 'checkBookingConflict', 'getUpcomingEvents', 'getUnpaidClients', 'createMissingDriveFolders'.
- Saat Super Admin mengirimkan foto bukti transfer, sertakan parameter bukti_url yang tersedia.

ATURAN MUTLAK INTEGRITAS DATA & ANTI-HALUSINASI (ZERO TOLERANCE):
1. VALIDASI TANGGAL ACARA:
   - Jika Super Admin menyebutkan tanggal tertentu (misal: "tanggal 6 September 2026"):
     WAJIB sertakan parameter 'tanggal' saat memanggil tool (createClientDriveFolder, syncGoogleCalendar, generatePdfInvoice, updatePayment, getBookingByName).
   - Setelah menerima hasil eksekusi tool, PERIKSA KEMBALI apakah tanggal pada hasil tool (nama folder, tanggal booking, dll) SESUAI dengan tanggal yang diminta Admin.
   - JANGAN PERNAH menyatakan "berhasil dibuat dengan tanggal yang tepat" atau "terkait acara tanggal X" jika folder / data dari tool memiliki tanggal yang BERBEDA dari instruksi Admin!
   - Jika data di spreadsheet tidak cocok tanggalnya (misal: di DB tercatat 12 April 2026, tetapi Admin minta 6 September 2026):
     BERKATA JUJUR DAN LUGAS! Beritahukan:
     "⚠️ Di database spreadsheet, data booking atas nama *[Nama]* tercatat untuk tanggal *[Tanggal di DB]*, bukan *[Tanggal yang diminta]*. Apakah tanggal di spreadsheet perlu diupdate terlebih dahulu, atau ingin dibuatkan booking baru?"
   - DILARANG KERAS memalsukan atau mengklaim tanggal sudah sesuai jika kenyataannya berbeda!

2. PENANGANAN KOREKSI ADMIN ("Itu bukan tanggal X"):
   - Jika Admin mengoreksi tanggal (contoh: "Itu bukan tanggal 6 September"):
     JANGAN mengulang pemanggilan pembuatan folder yang sama!
     Gunakan 'getBookingByName' untuk memverifikasi data riil di spreadsheet dan jelaskan fakta yang sebenarnya tercatat kepada Admin.

3. MULTIPLE BOOKINGS / AMBIGUITAS:
   - Jika satu klien memiliki beberapa jadwal acara dan Admin tidak menyebutkan tanggal spesifik, mintakan konfirmasi tanggal mana yang dimaksud sebelum mengambil tindakan.

4. EVENT MENDATANG & GOOGLE DRIVE:
   - Jika Super Admin menanyakan event mana yang belum memiliki folder Google Drive atau meminta dibuatkan foldernya:
     Gunakan tool 'createMissingDriveFolders' (atau 'getUpcomingEvents').
     Tool 'createMissingDriveFolders' otomatis memeriksa event mendatang dan membuatkan foldernya sekaligus mencatat link ke spreadsheet.

FORMAT BALASAN:
- Bahasa Indonesia yang profesional, padat, lugas, santun, dan terstruktur.
- Format WhatsApp: *tebal*, _miring_, emoji yang relevan.
- Selalu sertakan link Google Drive PDF Invoice dan Folder Klien jika tersedia dari hasil tool yang valid.
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
 * HANYA menyimpan riwayat percakapan teks bersih (role: user & assistant)
 * agar token tetap ramping dan terbebas 100% dari Error 413.
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
  if (session.isAdmin !== isAdmin) {
    session.isAdmin = isAdmin;
    session.history = [{ role: 'system', content: targetPrompt }];
  }

  return session.history;
}

function saveTurnToSession(sender, userMessage, assistantReply, isAdmin = false) {
  const targetPrompt = isAdmin ? SYSTEM_PROMPT_ADMIN : SYSTEM_PROMPT_PUBLIC;
  const session = userSessions.get(sender) || { isAdmin, history: [{ role: 'system', content: targetPrompt }] };
  
  const history = session.history.filter(m => m.role === 'user' || m.role === 'assistant');
  
  if (userMessage && userMessage.trim()) {
    history.push({ role: 'user', content: userMessage.trim() });
  }
  if (assistantReply && assistantReply.trim()) {
    history.push({ role: 'assistant', content: assistantReply.trim() });
  }

  // Simpan maksimal 6 pesan terakhir (3 pasang dialog user-assistant)
  const recent = history.slice(-6);
  userSessions.set(sender, {
    isAdmin,
    history: [
      { role: 'system', content: targetPrompt },
      ...recent
    ]
  });
}

function clearSessionHistory(sender) {
  userSessions.delete(sender);
}

/**
 * Kompresi dan sanitasi hasil data dari Google Apps Script agar hemat token & anti Error 413
 * Menjamin hasil selalu berupa valid JSON dan ukuran string <= 2.500 karakter.
 */
function sanitizeAndCompressGasResult(gasResult) {
  if (!gasResult) return JSON.stringify({ success: false, message: 'No data returned' });

  // 1. Ekstrak array jika ada (bisa berupa gasResult langsung, gasResult.data, gasResult.events, atau gasResult.conflicts)
  let items = null;
  let wrapper = {};

  if (Array.isArray(gasResult)) {
    items = gasResult;
  } else if (typeof gasResult === 'object' && gasResult !== null) {
    if (Array.isArray(gasResult.data)) {
      items = gasResult.data;
      wrapper = { success: gasResult.success !== false, count: gasResult.count || gasResult.data.length };
    } else if (Array.isArray(gasResult.events)) {
      items = gasResult.events;
      wrapper = { success: gasResult.success !== false, count: gasResult.events.length, message: gasResult.message };
    } else if (Array.isArray(gasResult.conflicts)) {
      items = gasResult.conflicts;
      wrapper = { success: gasResult.success !== false, hasConflict: gasResult.hasConflict, count: gasResult.conflicts.length };
    }
  }

  // Helper pemeta satu baris data klien/booking agar seringkas mungkin
  const mapRow = (row) => {
    if (typeof row !== 'object' || row === null) return row;
    const hasDrive = Boolean(
      row.hasDrive || 
      (row['Folder Drive URL'] && String(row['Folder Drive URL']).trim().startsWith('http')) ||
      (row.folder_url && String(row.folder_url).trim().startsWith('http')) ||
      (row.drive_url && String(row.drive_url).trim().startsWith('http'))
    );
    const driveUrl = row.folder_url || row.drive_url || row['Folder Drive URL'] || (hasDrive ? 'Tersedia' : null);

    return {
      nama: row.nama || row.Nama || row.name || row.client || '',
      tanggal: row.tanggal || row.Tanggal || row.date || '',
      layanan: row.layanan || row.Layanan || undefined,
      paket: row.paket || row.Paket || undefined,
      sisa: Number(row.sisa || row.Sisa || row['Sisa Pembayaran'] || 0) || undefined,
      hasDrive: hasDrive,
      driveUrl: driveUrl || undefined,
      status: row.status || row.Status || undefined
    };
  };

  if (items) {
    // Batasi maksimal 15 item teratas agar token tetap super ramping
    const maxItems = 15;
    const trimmedItems = items.slice(0, maxItems).map(mapRow);
    const resultObj = {
      ...wrapper,
      total_data: items.length,
      showing: trimmedItems.length,
      items: trimmedItems
    };
    if (items.length > maxItems) {
      resultObj.note = `Data diringkas ${maxItems} dari ${items.length} total baris`;
    }

    let jsonStr = JSON.stringify(resultObj);
    // Jika masih terlalu panjang (> 2500 char), kurangi ke 8 item
    if (jsonStr.length > 2500 && trimmedItems.length > 8) {
      resultObj.items = trimmedItems.slice(0, 8);
      resultObj.showing = 8;
      resultObj.note = `Data diringkas 8 dari ${items.length} total baris`;
      jsonStr = JSON.stringify(resultObj);
    }
    return jsonStr;
  }

  // 2. Jika berupa objek tunggal (misal respon createClientDriveFolder, invoice, payment summary)
  if (typeof gasResult === 'object') {
    const cleanObj = {};
    for (const [key, val] of Object.entries(gasResult)) {
      if (['stack', 'raw', 'html', 'body'].includes(key)) continue;
      cleanObj[key] = val;
    }
    const jsonStr = JSON.stringify(cleanObj);
    if (jsonStr.length > 2500) {
      return JSON.stringify({
        success: gasResult.success !== false,
        message: gasResult.message || 'Hasil dipersingkat untuk efisiensi data',
        preview: jsonStr.substring(0, 1000)
      });
    }
    return jsonStr;
  }

  return String(gasResult).substring(0, 2500);
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
 * Dilengkapi 413 Auto-Recovery untuk payload besar
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

      // Jika terjadi error 413 (Payload Too Large), jangan ulangi failover dengan payload identik
      if (err.response && err.response.status === 413) {
        break;
      }
    }
  }

  // Emergency Compact Retry khusus error 413: potong messages ke minimal (system prompt + user prompt terakhir)
  const is413 = lastError && (
    (lastError.response && lastError.response.status === 413) ||
    (lastError.message && lastError.message.includes('413'))
  );

  if (is413 && cleanMessages.length > 2) {
    console.warn('[GROQ_CHAT EMERGENCY] Terdeteksi HTTP 413 Payload Too Large. Mengaktifkan Emergency Compact Retry...');
    try {
      const emergencyMessages = [
        cleanMessages[0], // System prompt
        cleanMessages[cleanMessages.length - 1] // Pesan terakhir
      ];
      const emergencyModel = uniqueModels[0] || 'llama-3.3-70b-versatile';
      const emergencyRes = await axios.post(config.GROQ_URL, {
        model: emergencyModel,
        messages: emergencyMessages,
        temperature: 0.3,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${config.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const choice = emergencyRes.data.choices && emergencyRes.data.choices[0];
      if (choice && choice.message) {
        return choice.message;
      }
    } catch (emergencyErr) {
      console.error('[GROQ_CHAT EMERGENCY FAILED]:', emergencyErr.message);
    }
  }

  throw new Error(`Semua model Groq gagal dipanggil: ${lastError ? lastError.message : 'Unknown error'}`);
}

/**
 * Helper untuk mem-parsing argumen fungsi dari format JSON, XML <parameter>, atau key-value
 */
function parseRawFunctionArgs(rawArgs) {
  if (!rawArgs || !rawArgs.trim()) return {};
  const trimmed = rawArgs.trim();

  // 1. Coba JSON langsung
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch (e) {}

  const args = {};

  // 2. Cek format parameter XML: <parameter=nama>nilai</parameter> atau <parameter name="nama">nilai</parameter>
  const paramRegex = /<parameter(?:=|\s+name=["']?)([^>"'\s]+)["']?>([\s\S]*?)<\/parameter>/gi;
  let pMatch;
  let hasParam = false;
  while ((pMatch = paramRegex.exec(trimmed)) !== null) {
    hasParam = true;
    const key = pMatch[1].trim();
    let val = pMatch[2].trim();
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^\d+$/.test(val)) val = Number(val);
    args[key] = val;
  }
  if (hasParam) return args;

  // 3. Cek format key: value atau key=value per baris
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const kvMatch = line.match(/^([a-zA-Z0-9_]+)\s*[:=]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let val = kvMatch[2].trim().replace(/^["']|["']$/g, '');
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d+$/.test(val)) val = Number(val);
      args[key] = val;
    }
  }

  return args;
}

/**
 * Mengekstrak tool calls jika model mengembalikan format XML/teks (<tool_call> ... </tool_call>)
 * alih-alih array message.tool_calls standar, serta mensterilkan tag XML agar tidak bocor ke WhatsApp.
 */
function extractToolCallsFromContent(message) {
  if (!message) return message;
  if (message.tool_calls && message.tool_calls.length > 0) {
    return message;
  }

  const content = message.content || '';
  if (!content.includes('<tool_call>') && !content.includes('<function=')) {
    return message;
  }

  const parsedToolCalls = [];

  // Pola 1: <tool_call><function=namaTool>args</function></tool_call>
  const xmlFuncRegex = /<tool_call>[\s\S]*?<function=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function>[\s\S]*?<\/tool_call>/gi;
  let match;
  while ((match = xmlFuncRegex.exec(content)) !== null) {
    const toolName = match[1].trim();
    const toolArgs = parseRawFunctionArgs(match[2]);
    parsedToolCalls.push({
      id: 'call_' + Math.random().toString(36).substring(2, 9),
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(toolArgs)
      }
    });
  }

  // Pola 2: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  if (parsedToolCalls.length === 0) {
    const jsonToolRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
    let jsonMatch;
    while ((jsonMatch = jsonToolRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed && (parsed.name || parsed.function)) {
          parsedToolCalls.push({
            id: 'call_' + Math.random().toString(36).substring(2, 9),
            type: 'function',
            function: {
              name: parsed.name || parsed.function,
              arguments: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments || {})
            }
          });
        }
      } catch (e) {}
    }
  }

  // Pola 3: <function=namaTool>args</function> (tanpa tag tool_call)
  if (parsedToolCalls.length === 0) {
    const soloFuncRegex = /<function=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function>/gi;
    let soloMatch;
    while ((soloMatch = soloFuncRegex.exec(content)) !== null) {
      const toolName = soloMatch[1].trim();
      const toolArgs = parseRawFunctionArgs(soloMatch[2]);
      parsedToolCalls.push({
        id: 'call_' + Math.random().toString(36).substring(2, 9),
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(toolArgs)
        }
      });
    }
  }

  if (parsedToolCalls.length > 0) {
    console.log(`[EXTRACT_TOOL_CALLS] Berhasil mengekstrak ${parsedToolCalls.length} tool call dari XML teks:`, parsedToolCalls.map(t => t.function.name));
    return {
      ...message,
      tool_calls: parsedToolCalls,
      content: null
    };
  }

  // Sanitasi darurat: Jangan pernah membiarkan tag <tool_call> mentah terkirim ke WhatsApp
  if (content.includes('<tool_call>') || content.includes('</tool_call>') || content.includes('<function=')) {
    const sanitizedContent = content
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      .replace(/<function=[^>]+>[\s\S]*?<\/function>/gi, '')
      .trim();
    return {
      ...message,
      content: sanitizedContent || 'Sedang memproses data dari spreadsheet...'
    };
  }

  return message;
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

    // ========================================================
    // MODE PUBLIK: ZERO HEADLESS TOOLS (HANYA CS INFORMATIF)
    // ========================================================
    if (!isAdmin) {
      const currentHistory = getSessionHistory(sender, false);
      const turnMessages = [
        ...currentHistory,
        { role: 'user', content: promptContent }
      ];

      const assistantMsg = await callGroqChat(turnMessages, []);
      let finalReply = assistantMsg.content || '';

      // Wajib sertakan footer bot untuk publik jika belum ada
      if (!finalReply.includes('_(NOVA AGENT)_')) {
        finalReply = finalReply.trim() + '\n\n_(NOVA AGENT)_';
      }

      saveTurnToSession(sender, promptContent, finalReply, false);
      return finalReply;
    }

    // ========================================================
    // MODE SUPER ADMIN: FULL HEADLESS TOOLS (24/7 GAS EXECUTION)
    // ========================================================
    let loopCount = 0;
    const maxLoops = 5;

    // Siapkan riwayat turn lokal untuk request ini
    const currentHistory = getSessionHistory(sender, true);
    const turnMessages = [
      ...currentHistory,
      { role: 'user', content: promptContent }
    ];

    while (loopCount < maxLoops) {
      loopCount++;
      let assistantMsg = await callGroqChat(turnMessages, groqTools);
      assistantMsg = extractToolCallsFromContent(assistantMsg);

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        const finalReply = assistantMsg.content || '';
        saveTurnToSession(sender, promptContent, finalReply, true);
        return finalReply;
      }

      console.log(`[GROQ_TOOL] Model meminta eksekusi ${assistantMsg.tool_calls.length} tool(s) (Loop ${loopCount}/${maxLoops})`);
      
      turnMessages.push({
        role: 'assistant',
        content: assistantMsg.content || null,
        tool_calls: assistantMsg.tool_calls
      });

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

        // Safety Net: Otomatis ekstrak tanggal dari prompt jika tool membutuhkan tanggal namun argumen tanggal kosong
        const dateAwareTools = ['createClientDriveFolder', 'syncGoogleCalendar', 'generatePdfInvoice', 'getPaymentSummary', 'getBookingByName', 'updatePayment'];
        if (dateAwareTools.includes(toolName) && !toolArgs.tanggal) {
          const extractedDate = extractDateFromText(promptContent);
          if (extractedDate) {
            toolArgs.tanggal = extractedDate;
            console.log(`[DATE_SAFETY_NET] Berhasil menyematkan parameter tanggal "${extractedDate}" ke tool "${toolName}"`);
          }
        }

        console.log(`[EXECUTE_GAS_TOOL] "${toolName}" dengan args:`, JSON.stringify(toolArgs));
        
        const rawGasResult = await callGasAction(toolName, toolArgs);
        const compressedGasResult = sanitizeAndCompressGasResult(rawGasResult);
        console.log(`[GAS_RESULT] "${toolName}" (Panjang payload: ${compressedGasResult.length} karakter)`);

        turnMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: compressedGasResult
        });
      }
    }

    // Jika melebihi maxLoops, minta Groq buat simpulan akhir
    const fallbackMsg = await callGroqChat(turnMessages, []);
    const finalReply = fallbackMsg.content || "Permintaan Anda telah berhasil diproses oleh sistem Knowhere Studio. Ada yang bisa NOVA bantu lagi?";
    saveTurnToSession(sender, promptContent, finalReply, true);
    return finalReply;
  } catch (error) {
    console.error('[AI_SERVICE ERROR]:', error.message);
    if (!isAdmin) {
      return `Maaf, saat ini sistem informasi sedang sibuk. Silakan coba kembali sesaat lagi atau hubungi admin kami pada jam operasional (07.00 - 17.00 WIB).\n\n_(NOVA AGENT)_`;
    }

    // Jika error 413, bersihkan sesi agar turn berikutnya kembali segar
    if (error.message && error.message.includes('413')) {
      clearSessionHistory(sender);
    }

    return `Maaf, terjadi kendala saat memproses permintaan Super Admin: ${error.message}`;
  }
}

module.exports = {
  processMessageWithAI
};

