/**
 * Date Extraction & Normalization Helper for Indonesian Conversation
 */

const MONTH_NORMALIZATION_MAP = [
  { regex: /^(januari|jan|januri)$/i, standard: 'Januari', monthNum: 1 },
  { regex: /^(februari|feb|pebruari|peb|febuari)$/i, standard: 'Februari', monthNum: 2 },
  { regex: /^(maret|mar)$/i, standard: 'Maret', monthNum: 3 },
  { regex: /^(april|apr)$/i, standard: 'April', monthNum: 4 },
  { regex: /^(mei|may)$/i, standard: 'Mei', monthNum: 5 },
  { regex: /^(juni|jun)$/i, standard: 'Juni', monthNum: 6 },
  { regex: /^(juli|jul)$/i, standard: 'Juli', monthNum: 7 },
  { regex: /^(agustus|agu|ags|agust|august|aug)$/i, standard: 'Agustus', monthNum: 8 },
  { regex: /^(september|sep|sept|septmber|setember)$/i, standard: 'September', monthNum: 9 },
  { regex: /^(oktober|okt|oct|october|oktber)$/i, standard: 'Oktober', monthNum: 10 },
  { regex: /^(november|nov|nopember|nop|desember|novmber)$/i, standard: 'November', monthNum: 11 },
  { regex: /^(desember|des|december|dec|desmber)$/i, standard: 'Desember', monthNum: 12 }
];

/**
 * Normalisasi string nama bulan bahasa Indonesia
 */
function normalizeMonthName(monthStr) {
  if (!monthStr) return null;
  const clean = String(monthStr).trim().toLowerCase();
  for (const item of MONTH_NORMALIZATION_MAP) {
    if (item.regex.test(clean)) {
      return item.standard;
    }
  }
  return monthStr;
}

/**
 * Ekstraksi tanggal dari teks percakapan user
 * Mendukung pola:
 * - "tanggal 6 septmber 2026"
 * - "tgl 23/09/2026"
 * - "06/09/2026" atau "06-09-2026"
 * - "6 september 2026"
 * - "tanggal 12 april"
 * 
 * @param {string} text 
 * @returns {string|null} Tanggal terstandarisasi, contoh "6 September 2026" atau "23/09/2026", atau null
 */
function extractDateFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const cleanText = text.trim();

  // 1. Pola dengan nama bulan dan tahun: "6 septmber 2026", "tanggal 06 september 2026", "15-oktober-2026"
  const textDateWithYear = cleanText.match(/(?:tanggal|tgl)?\s*(\d{1,2})[\s\-\/\.]+([a-zA-Z]+)[\s\-\/\.]+(\d{4})\b/i);
  if (textDateWithYear) {
    const day = parseInt(textDateWithYear[1], 10);
    const rawMonth = textDateWithYear[2];
    const year = parseInt(textDateWithYear[3], 10);
    const normMonth = normalizeMonthName(rawMonth);
    if (normMonth && day >= 1 && day <= 31 && year >= 2020 && year <= 2040) {
      return `${day} ${normMonth} ${year}`;
    }
  }

  // 2. Pola numerik: "23/09/2026", "23-09-2026", "23.09.2026", "2026-09-23"
  // Format YYYY-MM-DD
  const isoDate = cleanText.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (isoDate) {
    const y = parseInt(isoDate[1], 10);
    const m = parseInt(isoDate[2], 10);
    const d = parseInt(isoDate[3], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
  }

  // Format DD/MM/YYYY
  const numericDate = cleanText.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
  if (numericDate) {
    const d = parseInt(numericDate[1], 10);
    const m = parseInt(numericDate[2], 10);
    const y = parseInt(numericDate[3], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2040) {
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
  }

  // 3. Pola tanggal + bulan tanpa tahun (misal: "tanggal 6 septmber", "tgl 12 april")
  const textDateNoYear = cleanText.match(/(?:tanggal|tgl)\s+(\d{1,2})[\s\-\/\.]+([a-zA-Z]+)\b/i);
  if (textDateNoYear) {
    const day = parseInt(textDateNoYear[1], 10);
    const rawMonth = textDateNoYear[2];
    const normMonth = normalizeMonthName(rawMonth);
    if (normMonth && day >= 1 && day <= 31) {
      const defaultYear = new Date().getFullYear();
      return `${day} ${normMonth} ${defaultYear}`;
    }
  }

  return null;
}

module.exports = {
  extractDateFromText,
  normalizeMonthName
};
