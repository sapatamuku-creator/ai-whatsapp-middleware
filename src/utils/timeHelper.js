/**
 * Helper utilitas untuk penanganan zona waktu Indonesia Barat (WIB / Asia/Jakarta)
 */

/**
 * Mendapatkan jam saat ini dalam format 24 jam (0 - 23) di zona waktu Asia/Jakarta (WIB)
 * @param {Date} [date] - Opsional, tanggal acuan
 * @returns {number} Jam saat ini dalam format desimal/integer (0 - 23)
 */
function getCurrentHourWIB(date = new Date()) {
  const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const hourStr = formatter.format(date);
  return parseInt(hourStr, 10);
}

/**
 * Memeriksa apakah saat ini berada dalam jam kerja admin (07.00 - 17.00 WIB)
 * - Jam kerja: 07:00:00 s/d 16:59:59 (hour >= 7 && hour < 17) -> return true
 * - Luar jam kerja: 17:00:00 s/d 06:59:59 (hour >= 17 || hour < 7) -> return false
 * @param {Date} [date] - Opsional, tanggal acuan
 * @returns {boolean}
 */
function isWorkingHoursWIB(date = new Date()) {
  const hour = getCurrentHourWIB(date);
  return hour >= 7 && hour < 17;
}

/**
 * Format tanggal & jam saat ini dalam format ramah dibaca (WIB)
 * Contoh: "Sabtu, 5 September 2026 - 07:15 WIB"
 * @param {Date} [date]
 * @returns {string}
 */
function formatCurrentDateTimeWIB(date = new Date()) {
  const options = {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date) + ' WIB';
}

module.exports = {
  getCurrentHourWIB,
  isWorkingHoursWIB,
  formatCurrentDateTimeWIB
};
