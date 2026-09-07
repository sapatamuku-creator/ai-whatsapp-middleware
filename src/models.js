/**
 * ==============================================================================
 * 🧠 CENTRAL MODEL REGISTRY & MAINTENANCE
 * ==============================================================================
 * File terpusat untuk konfigurasi, pembaruan, dan maintenance model AI Groq.
 * Jika di masa depan Groq mengubah, menghapus, atau merilis model baru:
 * CUKUP UBAH DAFTAR DI FILE INI (atau override lewat Environment Variable Vercel).
 * Anda TIDAK PERLU lagi merombak file logic (aiService.js / webhookController.js).
 * ==============================================================================
 */

const MODEL_REGISTRY = {
  // 1. Model Utama (Primary Agent): Flagship Groq Llama 3.3 70B (Native OpenAI Tool Calling)
  PRIMARY_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

  // 2. Model Cadangan Utama (Failover 1): Llama 3.1 8B Instant
  BACKUP_MODEL: process.env.GROQ_BACKUP_MODEL || 'llama-3.1-8b-instant',

  // 3. Model Cepat (Fast Sub-Agent): Untuk chat ringan & respon cepat
  FAST_MODEL: process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant',

  // 4. Model Cadangan Alternatif (Failover 2): Mixtral 8x7B
  SECONDARY_BACKUP: process.env.GROQ_SECONDARY_BACKUP || 'mixtral-8x7b-32768',

  // 5. Model Transkripsi Suara (Voice Note WhatsApp STT)
  VOICE_MODEL: process.env.GROQ_VOICE_MODEL || 'whisper-large-v3-turbo',

  // 6. Model Analitik
  ANALYST_MODEL: process.env.GROQ_ANALYST_MODEL || 'llama-3.3-70b-versatile',

  // 7. Rantai Urutan Eksekusi Failover Otomatis (Hierarki Pemanggilan Resmi Groq)
  FAILOVER_CHAIN: [
    process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    process.env.GROQ_BACKUP_MODEL || 'llama-3.1-8b-instant',
    process.env.GROQ_SECONDARY_BACKUP || 'mixtral-8x7b-32768'
  ]
};

/**
 * Mengambil urutan model aktif yang siap dipanggil (terbebas dari duplikasi)
 */
function getActiveModelHierarchy() {
  const customChain = process.env.GROQ_CUSTOM_CHAIN 
    ? process.env.GROQ_CUSTOM_CHAIN.split(',').map(m => m.trim())
    : null;

  const rawList = customChain || MODEL_REGISTRY.FAILOVER_CHAIN;
  return [...new Set(rawList.filter(Boolean))];
}

module.exports = {
  MODEL_REGISTRY,
  getActiveModelHierarchy
};
