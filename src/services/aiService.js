const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config');
const { toolDeclarations } = require('../tools/definitions');
const { callGasAction } = require('./gasClient');

// Inisialisasi Google GenAI
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// System Instruction untuk NOVA
const SYSTEM_PROMPT = `
Kamu adalah NOVA, Executive AI Business Assistant untuk Knowhere Studio (vendor dokumentasi pernikahan & fotografi profesional di Bandung).

TUGAS UTAMA:
1. Membantu Admin mengelola jadwal booking, pencatatan pembayaran DP & pelunasan, pengecekan ketersediaan tanggal, dan pembuatan PDF invoice resmi secara otomatis.
2. Membaca dan menganalisis foto bukti transfer (BCA, Mandiri, BRI, BNI, Seabank, Jago, QRIS, dll) secara akurat menggunakan kemampuan Multimodal Vision kamu.
3. Menjalankan Tool Calling (Function Calling) yang sesuai untuk berinteraksi dengan Google Spreadsheet, Google Drive, Google Docs, dan Google Calendar.

ATURAN MULTIMODAL & STRUK TRANSFER:
- Saat menerima foto struk bukti transfer:
  1. Ekstrak data dari struk: Nama Bank, Nama Pengirim, Nama Penerima, Nominal Transfer (dalam Rupiah), Tanggal & Jam, Nomor Referensi.
  2. Cocokkan nama klien dengan database. Jika nama klien disebutkan di pesan/caption atau ada di struk, panggil tool 'updatePayment' dengan nominal yang tertera di struk.
  3. Panggil tool 'generatePdfInvoice' untuk membuat PDF invoice resmi terbaru dengan bukti transfer tersebut.
  4. Berikan balasan konfirmasi yang ramah, ringkas, dan profesional lengkap dengan detail pembayaran dan link Google Drive.

FORMAT BALASAN:
- Gunakan Bahasa Indonesia yang ramah, sopan, dan terstruktur.
- Gunakan formatting WhatsApp: *tebal*, _miring_, emoji yang relevan.
- Selalu sertakan link Google Drive PDF Invoice dan Folder Klien jika tersedia.
`;

/**
 * Download file gambar dari URL menjadi Buffer Base64
 */
async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64Data = Buffer.from(response.data).toString('base64');
    return {
      inlineData: {
        data: base64Data,
        mimeType: contentType
      }
    };
  } catch (error) {
    console.error('[AI_SERVICE] Gagal mengunduh gambar:', error.message);
    return null;
  }
}

/**
 * Format tools untuk Google Generative AI SDK
 */
function getFormattedTools() {
  return [
    {
      functionDeclarations: toolDeclarations
    }
  ];
}

/**
 * Memory percakapan per user (In-Memory Map, max 8 turn)
 */
const chatSessions = new Map();

function getOrCreateChatSession(sender) {
  if (!chatSessions.has(sender)) {
    const model = genAI.getGenerativeModel({
      model: config.GEMINI_MODEL || 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: getFormattedTools()
    });

    const chat = model.startChat({
      history: []
    });

    chatSessions.set(sender, {
      chat: chat,
      lastActive: Date.now()
    });
  }

  return chatSessions.get(sender).chat;
}

/**
 * Jalankan AI Agentic Loop (Vision + Tool Calling)
 */
async function processMessageWithAI({ sender, message, mediaUrl, isImage }) {
  try {
    const chat = getOrCreateChatSession(sender);

    // Siapkan konten pesan (Multimodal)
    const contentParts = [];

    // Jika ada gambar lampiran dari WhatsApp
    if (isImage && mediaUrl) {
      console.log(`[AI_SERVICE] Memproses gambar dari URL: ${mediaUrl}`);
      const imagePart = await fetchImageAsBase64(mediaUrl);
      if (imagePart) {
        contentParts.push(imagePart);
        if (!message) {
          contentParts.push("Tolong baca foto bukti transfer ini, catat pembayarannya, dan buatkan invoice resminya.");
        }
      }
    }

    if (message) {
      contentParts.push(message);
    }

    if (contentParts.length === 0) {
      return "Halo! Ada yang bisa NOVA bantu untuk operasional Knowhere Studio hari ini?";
    }

    console.log(`[AI_SERVICE] Mengirim request ke Gemini (${config.GEMINI_MODEL})...`);
    let response = await chat.sendMessage(contentParts);
    let candidate = response.response.candidates[0];

    // Agentic Loop: Handle function calls jika model memanggil tool
    let loopCount = 0;
    const maxLoops = 5;

    while (candidate && candidate.content && candidate.content.parts && loopCount < maxLoops) {
      const functionCalls = candidate.content.parts.filter(part => part.functionCall);
      if (functionCalls.length === 0) {
        break;
      }

      loopCount++;
      console.log(`[AI_SERVICE] Model memanggil ${functionCalls.length} tool(s) (Loop ${loopCount}/${maxLoops})`);

      const functionResponses = [];

      for (const fc of functionCalls) {
        const toolName = fc.functionCall.name;
        const toolArgs = fc.functionCall.args || {};

        console.log(`[TOOL_CALL] Menjalankan tool "${toolName}" dengan args:`, JSON.stringify(toolArgs));
        
        // Panggil ke Headless GAS API
        const gasResult = await callGasAction(toolName, toolArgs);
        console.log(`[TOOL_RESULT] Hasil "${toolName}":`, JSON.stringify(gasResult).substring(0, 200) + '...');

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: gasResult
          }
        });
      }

      // Kirim hasil tool kembali ke Gemini agar Gemini menyusun balasan akhir
      response = await chat.sendMessage(functionResponses);
      candidate = response.response.candidates[0];
    }

    const finalText = response.response.text();
    return finalText;
  } catch (error) {
    console.error('[AI_SERVICE ERROR]:', error);
    return `Maaf, terjadi kendala saat memproses permintaan Anda: ${error.message}`;
  }
}

module.exports = {
  processMessageWithAI
};
