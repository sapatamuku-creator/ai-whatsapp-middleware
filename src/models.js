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
  // 1. Model Utama (Primary Agent): Digunakan untuk penalaran utama & eksekusi Tool Calling ke GAS
  PRIMARY_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',

  // 2. Model Cadangan Utama (Failover 1): Aktif otomatis jika model utama rate limited/busy
  BACKUP_MODEL: process.env.GROQ_BACKUP_MODEL || 'qwen/qwen3.8-27b',

  // 3. Model Cepat (Fast Sub-Agent): Untuk chat ringan & respon cepat
  FAST_MODEL: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',

  // 4. Model Cadangan Alternatif (Failover 2)
  SECONDARY_BACKUP: process.env.GROQ_SECONDARY_BACKUP || 'qwen/qwen3.6-27b',

  // 5. Model Transkripsi Suara (Voice Note WhatsApp STT)
  VOICE_MODEL: process.env.GROQ_VOICE_MODEL || 'whisper-large-v3-turbo',

  // 6. Model Analitik
  ANALYST_MODEL: process.env.GROQ_ANALYST_MODEL || 'groq/compound',

  // 7. Rantai Urutan Eksekusi Failover Otomatis (Hierarki Pemanggilan)
  // Jika model urutan pertama gagal -> otomatis coba urutan ke-2 -> ke-3 -> dst.
  FAILOVER_CHAIN: [
    process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    process.env.GROQ_BACKUP_MODEL || 'qwen/qwen3.8-27b',
    process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
    process.env.GROQ_SECONDARY_BACKUP || 'qwen/qwen3.6-27b'
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
