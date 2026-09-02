const axios = require('axios');
const config = require('../config');
const { groqTools } = require('../tools/definitions');
const { callGasAction } = require('./gasClient');

// System Instruction untuk NOVA (Multi-Agent Knowhere Studio)
const SYSTEM_PROMPT = `
Kamu adalah NOVA, Executive AI Business Assistant untuk Knowhere Studio (vendor dokumentasi pernikahan & fotografi profesional di Bandung).

TUGAS UTAMA:
1. Membantu Klien & Admin mengelola jadwal booking, pencatatan pembayaran DP & pelunasan, pengecekan ketersediaan tanggal, dan pembuatan PDF invoice resmi secara otomatis.
2. Menjalankan Tool Calling (Function Calling) yang sesuai untuk berinteraksi dengan Google Spreadsheet, Google Drive, Google Docs, dan Google Calendar melalui Headless GAS.
3. Saat Klien / Admin mengirimkan foto bukti transfer dan meminta invoice, panggil tool 'generatePdfInvoice' atau 'updatePayment' dengan menyertakan bukti_url yang ada.

FORMAT BALASAN:
- Gunakan Bahasa Indonesia yang ramah, sopan, dan terstruktur.
- Gunakan formatting WhatsApp: *tebal*, _miring_, emoji yang relevan.
- Selalu sertakan link Google Drive PDF Invoice dan Folder Klien jika tersedia dari hasil tool.
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
 * Panggil Groq Chat Completion API dengan Auto-Failover Matrix resmi dari Groq Console
 * (openai/gpt-oss-120b -> qwen/qwen3.8-27b -> openai/gpt-oss-20b -> qwen/qwen3.6-27b)
 */
async function callGroqChat(messages, tools = groqTools) {
  if (!config.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY belum dikonfigurasi di Environment Variables Vercel!');
  }

  // Model hierarchy persis dari model yang aktif di Groq Console Anda
  const modelHierarchy = [
    config.GROQ_MODEL || 'openai/gpt-oss-120b',
    config.GROQ_BACKUP_MODEL || 'qwen/qwen3.8-27b',
    config.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b'
  ];

  const uniqueModels = [...new Set(modelHierarchy)];

  // Sanitizer: Hapus field internal yang ditolak
  const cleanMessages = messages.map(m => {
    const copy = { ...m };
    delete copy.reasoning;
    delete copy.reasoning_content;
    return copy;
  });

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      console.log(`[GROQ_MULTI_AGENT] Memanggil model Groq: ${model}...`);
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
      console.warn(`[GROQ_MULTI_AGENT WARN] Model "${model}" mengalami kendala (${errMsg}), beralih ke model cadangan...`);
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

    // 1. Handle Voice Note (Groq Whisper: whisper-large-v3-turbo)
    if (isAudio && mediaUrl) {
      const whisperResult = await transcribeAudioGroq(mediaUrl);
      if (whisperResult.success && whisperResult.text) {
        promptContent = whisperResult.text;
      } else {
        promptContent = `[Voice Note diterima tapi gagal ditranskrip: ${whisperResult.error || 'unknown'}]`;
      }
    }

    // 2. Handle Foto Bukti Transfer
    if (isImage && mediaUrl) {
      if (!promptContent.trim()) {
        // Jika foto dikirim tanpa teks caption -> kirim panduan interaktif langsung
        return `📸 *Foto Bukti Transfer Berhasil Diterima!*\n\nSilakan balas dengan perintah invoice, contoh:\n👉 \`/invoice Kinnas ID dp1 500 ribu\`\n👉 \`/invoice Widya Dela Putri\`\n\n_NOVA akan otomatis mengunggah foto ini ke folder Drive klien & membuatkan Invoice PDF resmi!_ ✨`;
      } else {
        // Jika ada teks/caption, sertakan mediaUrl ke context agar diteruskan ke tool generatePdfInvoice
        promptContent = `${promptContent}\n[Bukti Transfer URL: ${mediaUrl}]`;
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

        // Sisipkan buktiUrl jika ada foto yang dikirim
        if (isImage && mediaUrl && !toolArgs.bukti_url) {
          toolArgs.bukti_url = mediaUrl;
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
