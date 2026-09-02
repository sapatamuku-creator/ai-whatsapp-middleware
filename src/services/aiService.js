const axios = require('axios');
const config = require('../config');
const { groqTools } = require('../tools/definitions');
const { callGasAction } = require('./gasClient');

// System Instruction untuk NOVA (Multi-Agent Knowhere Studio)
const SYSTEM_PROMPT = `
Kamu adalah NOVA, Executive AI Business Assistant untuk Knowhere Studio (vendor dokumentasi pernikahan & fotografi profesional di Bandung).

TUGAS UTAMA:
1. Membantu Klien & Admin mengelola jadwal booking, pencatatan pembayaran DP & pelunasan, pengecekan ketersediaan tanggal, dan pembuatan PDF invoice resmi secara otomatis.
2. Membaca dan menganalisis foto bukti transfer (BCA, Mandiri, BRI, BNI, Seabank, Jago, QRIS, dll) secara akurat.
3. Menjalankan Tool Calling (Function Calling) yang sesuai untuk berinteraksi dengan Google Spreadsheet, Google Drive, Google Docs, dan Google Calendar melalui Headless GAS.

ATURAN MULTIMODAL & STRUK TRANSFER:
- Saat menerima foto struk bukti transfer:
  1. Ekstrak data dari struk: Nama Bank, Nama Pengirim, Nama Penerima, Nominal Transfer (dalam Rupiah), Tanggal & Jam, Nomor Referensi.
  2. Cocokkan nama klien dengan database. Jika nama klien terdeteksi, panggil tool 'updatePayment' dengan nominal yang tertera di struk.
  3. Panggil tool 'generatePdfInvoice' untuk membuat PDF invoice resmi terbaru dengan bukti transfer tersebut.
  4. Berikan balasan konfirmasi yang ramah, ringkas, dan profesional lengkap dengan detail pembayaran dan link Google Drive.

FORMAT BALASAN:
- Gunakan Bahasa Indonesia yang ramah, sopan, dan terstruktur.
- Gunakan formatting WhatsApp: *tebal*, _miring_, emoji yang relevan.
- Selalu sertakan link Google Drive PDF Invoice dan Folder Klien jika tersedia.
`;

/**
 * Memory percakapan per user (In-Memory Map, max 12 turn)
 */
const userSessions = new Map();

function getSessionHistory(sender) {
  if (!userSessions.has(sender)) {
    userSessions.set(sender, [
      { role: 'system', content: SYSTEM_PROMPT }
    ]);
  }
  return userSessions.get(sender);
}

function appendToSession(sender, role, content, extra = {}) {
  const history = getSessionHistory(sender);
  history.push({ role, content, ...extra });
  if (history.length > 14) {
    userSessions.set(sender, [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(history.length - 10)
    ]);
  }
}

/**
 * Download file gambar dari URL menjadi Data URL Base64
 */
async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64Data = Buffer.from(response.data).toString('base64');
    return `data:${contentType};base64,${base64Data}`;
  } catch (error) {
    console.error('[AI_SERVICE] Gagal mengunduh gambar:', error.message);
    return null;
  }
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
    formData.append('model', config.GROQ_VOICE_MODEL || 'whisper-large-v3-turbo');
    formData.append('language', 'id');
    formData.append('response_format', 'json');

    console.log(`[GROQ_WHISPER] Mengirim ke Groq Whisper (${config.GROQ_VOICE_MODEL})...`);
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
 * Ekstrak informasi dari Gambar Struk via Groq Vision (llama-3.2-11b-vision-preview)
 */
async function processVisionWithGroq(imageDataUrl, userCaption = '') {
  const visionPrompt = `Analisis foto bukti transfer / struk pembayaran ini secara sangat teliti.
Ekstrak data berikut:
- Nama Bank:
- Nama Pengirim:
- Nama Penerima:
- Nominal Transfer: (dalam angka Rupiah)
- Tanggal & Waktu:
- Nomor Referensi:
- Catatan / Keterangan:

Caption dari pengirim: "${userCaption || 'Tanpa caption'}"`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: visionPrompt },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ]
    }
  ];

  try {
    const visionModel = config.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview';
    console.log(`[GROQ_VISION] Menjalankan OCR struk transfer dengan ${visionModel}...`);
    const res = await axios.post(config.GROQ_URL, {
      model: visionModel,
      messages: messages,
      temperature: 0.1,
      max_tokens: 800
    }, {
      headers: {
        'Authorization': `Bearer ${config.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const ocrText = res.data.choices[0].message.content;
    console.log('[GROQ_VISION RESULT]:\n', ocrText);
    return ocrText;
  } catch (err) {
    console.error('[GROQ_VISION ERROR]:', err.message);
    return `[Gambar Struk Terlampir tapi gagal dibaca otomatis: ${err.message}]`;
  }
}

/**
 * Panggil Groq Chat Completion API dengan Auto-Failover Matrix (openai/gpt-oss-120b -> qwen/qwen3.8-27b -> openai/gpt-oss-20b)
 */
async function callGroqChat(messages, tools = groqTools) {
  if (!config.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY belum dikonfigurasi di Environment Variables Vercel!');
  }

  // Matrix failover model persis sesuai Code.gs
  const modelHierarchy = [
    config.GROQ_MODEL,         // Primary: openai/gpt-oss-120b
    config.GROQ_BACKUP_MODEL,  // Failover: qwen/qwen3.8-27b
    config.GROQ_FAST_MODEL,    // Fast: openai/gpt-oss-20b
    'llama-3.3-70b-versatile', // Fallback standard
    'llama-3.1-8b-instant'
  ].filter(Boolean);

  const uniqueModels = [...new Set(modelHierarchy)];

  // Sanitizer: Hapus field reasoning internal jika ada
  const cleanMessages = messages.map(m => {
    const copy = { ...m };
    delete copy.reasoning;
    delete copy.reasoning_content;
    return copy;
  });

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      console.log(`[GROQ_MULTI_AGENT] Memanggil model: ${model}...`);
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
      console.warn(`[GROQ_MULTI_AGENT WARN] Model "${model}" rate limited / gagal (${errMsg}), beralih ke model cadangan...`);
      lastError = err;
    }
  }

  throw new Error(`Semua model Groq gagal dipanggil: ${lastError ? lastError.message : 'Unknown error'}`);
}

/**
 * Jalankan Groq Multi-Agent Orchestrator (Reasoning + Tool Calling ke GAS)
 */
async function processMessageWithAI({ sender, message, mediaUrl, isImage, isAudio }) {
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

    // 2. Handle Gambar Struk (Groq Vision)
    if (isImage && mediaUrl) {
      const dataUrl = await fetchImageAsDataUrl(mediaUrl);
      if (dataUrl) {
        const ocrResult = await processVisionWithGroq(dataUrl, message);
        promptContent = `[KLIEN MENGIRIMKAN FOTO BUKTI TRANSFER]\nHasil OCR Vision:\n${ocrResult}\n\nPesan Klien: ${message || 'Tolong proses pembayaran dan buatkan invoice resminya.'}`;
      }
    }

    if (!promptContent.trim()) {
      return "Halo! Ada yang bisa NOVA bantu untuk kebutuhan dokumentasi Knowhere Studio hari ini? 😊";
    }

    // Tambahkan pesan user ke sesi percakapan
    appendToSession(sender, 'user', promptContent);

    // 3. Loop Multi-Agent & Tool Calling (Max 5 putaran)
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      loopCount++;
      const currentHistory = getSessionHistory(sender);
      
      const assistantMsg = await callGroqChat(currentHistory, groqTools);

      // Jika model tidak memanggil tool (memberikan teks jawaban akhir)
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        appendToSession(sender, 'assistant', assistantMsg.content || '');
        return assistantMsg.content;
      }

      // Model meminta eksekusi tool ke Google Apps Script
      console.log(`[GROQ_TOOL] Model meminta eksekusi ${assistantMsg.tool_calls.length} tool(s) (Loop ${loopCount}/${maxLoops})`);
      
      appendToSession(sender, 'assistant', assistantMsg.content || null, {
        tool_calls: assistantMsg.tool_calls
      });

      // Eksekusi setiap tool call ke Google Apps Script
      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          toolArgs = {};
        }

        console.log(`[EXECUTE_GAS_TOOL] "${toolName}" dengan args:`, JSON.stringify(toolArgs));
        
        // Panggil ke Google Apps Script (Headless API)
        const gasResult = await callGasAction(toolName, toolArgs);
        console.log(`[GAS_RESULT] "${toolName}":`, JSON.stringify(gasResult).substring(0, 200) + '...');

        // Tambahkan hasil tool ke context percakapan
        const historyRef = getSessionHistory(sender);
        historyRef.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(gasResult)
        });
      }
    }

    return "Permintaan Anda telah berhasil diproses oleh sistem Knowhere Studio. Ada yang bisa NOVA bantu lagi?";
  } catch (error) {
    console.error('[AI_SERVICE ERROR]:', error.message);
    return `Maaf, terjadi kendala saat memproses permintaan Anda: ${error.message}`;
  }
}

module.exports = {
  processMessageWithAI
};
