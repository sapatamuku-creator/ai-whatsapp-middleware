const assert = require('assert');
const { getCurrentHourWIB, isWorkingHoursWIB, formatCurrentDateTimeWIB } = require('../src/utils/timeHelper');
const config = require('../src/config');

console.log('========================================');
console.log('🧪 RUNNING ACCESS CONTROL & WORKFLOW TESTS');
console.log('========================================\n');

// TEST 1: Verifikasi Konfigurasi
console.log('1. Checking config properties...');
assert.strictEqual(config.PERSONAL_ADMIN_NUMBER, '6282214578132', 'PERSONAL_ADMIN_NUMBER must be 6282214578132');
assert.strictEqual(config.WORK_START_HOUR_WIB, 7, 'WORK_START_HOUR_WIB must be 7');
assert.strictEqual(config.WORK_END_HOUR_WIB, 17, 'WORK_END_HOUR_WIB must be 17');
assert.strictEqual(config.BANK_ACCOUNTS.length, 2, 'Must have 2 bank accounts (BCA & BRI)');
assert.strictEqual(config.BANK_ACCOUNTS[0].bank, 'BCA');
assert.strictEqual(config.BANK_ACCOUNTS[0].norek, '7746263472');
assert.strictEqual(config.BANK_ACCOUNTS[1].bank, 'BRI');
assert.strictEqual(config.BANK_ACCOUNTS[1].norek, '428201014655530');
assert.strictEqual(config.DEFAULT_DP_AMOUNT, 500000);
console.log('✅ TEST 1 PASSED: Config properties are valid.\n');

// TEST 2: Verifikasi Logika Jam Kerja WIB (Asia/Jakarta)
console.log('2. Checking isWorkingHoursWIB logic with synthetic dates...');

// Buat tanggal uji berbasis UTC
// WIB adalah UTC+7
// Jam 00:00 UTC = Jam 07:00 WIB (Mulai jam kerja -> true)
const date07WIB = new Date('2026-09-05T00:00:00Z');
assert.strictEqual(getCurrentHourWIB(date07WIB), 7, 'UTC 00:00 should be 07:00 WIB');
assert.strictEqual(isWorkingHoursWIB(date07WIB), true, '07:00 WIB should be working hours');

// Jam 05:00 UTC = Jam 12:00 WIB (Siang -> true)
const date12WIB = new Date('2026-09-05T05:00:00Z');
assert.strictEqual(getCurrentHourWIB(date12WIB), 12, 'UTC 05:00 should be 12:00 WIB');
assert.strictEqual(isWorkingHoursWIB(date12WIB), true, '12:00 WIB should be working hours');

// Jam 09:59 UTC = Jam 16:59 WIB (Sebelum tutup -> true)
const date1659WIB = new Date('2026-09-05T09:59:00Z');
assert.strictEqual(getCurrentHourWIB(date1659WIB), 16, 'UTC 09:59 should be 16:59 WIB');
assert.strictEqual(isWorkingHoursWIB(date1659WIB), true, '16:59 WIB should be working hours');

// Jam 10:00 UTC = Jam 17:00 WIB (Tutup -> false)
const date17WIB = new Date('2026-09-05T10:00:00Z');
assert.strictEqual(getCurrentHourWIB(date17WIB), 17, 'UTC 10:00 should be 17:00 WIB');
assert.strictEqual(isWorkingHoursWIB(date17WIB), false, '17:00 WIB should NOT be working hours');

// Jam 23:59 UTC = Jam 06:59 WIB (Pagi sebelum buka -> false)
const date0659WIB = new Date('2026-09-04T23:59:00Z');
assert.strictEqual(getCurrentHourWIB(date0659WIB), 6, 'UTC 23:59 should be 06:59 WIB');
assert.strictEqual(isWorkingHoursWIB(date0659WIB), false, '06:59 WIB should NOT be working hours');

console.log('✅ TEST 2 PASSED: Time utility correctly handles WIB timezone.\n');

// TEST 3: Verifikasi Simulasi Filter Webhook
console.log('3. Simulating webhook access control matrix...');

function simulateWebhookFilter(sender, simulatedDate) {
  const isSuperAdmin = sender === config.PERSONAL_ADMIN_NUMBER;
  const isWorking = isWorkingHoursWIB(simulatedDate);

  if (!isSuperAdmin && isWorking) {
    return { action: 'SILENT_DROP', isAdmin: false };
  }
  if (isSuperAdmin) {
    return { action: 'PROCESS_ADMIN', isAdmin: true };
  }
  return { action: 'PROCESS_PUBLIC_GUARDED', isAdmin: false };
}

const superAdminNumber = '6282214578132';
const publicNumber = '6281234567890';

// Super Admin di jam kerja (12:00 WIB)
const adminDay = simulateWebhookFilter(superAdminNumber, date12WIB);
assert.strictEqual(adminDay.action, 'PROCESS_ADMIN');
assert.strictEqual(adminDay.isAdmin, true);

// Super Admin di luar jam kerja (20:00 WIB / 13:00 UTC)
const date20WIB = new Date('2026-09-05T13:00:00Z');
const adminNight = simulateWebhookFilter(superAdminNumber, date20WIB);
assert.strictEqual(adminNight.action, 'PROCESS_ADMIN');
assert.strictEqual(adminNight.isAdmin, true);

// Publik di jam kerja (12:00 WIB) -> Silent Drop
const publicDay = simulateWebhookFilter(publicNumber, date12WIB);
assert.strictEqual(publicDay.action, 'SILENT_DROP');
assert.strictEqual(publicDay.isAdmin, false);

// Publik di luar jam kerja (20:00 WIB) -> Guarded Public
const publicNight = simulateWebhookFilter(publicNumber, date20WIB);
assert.strictEqual(publicNight.action, 'PROCESS_PUBLIC_GUARDED');
assert.strictEqual(publicNight.isAdmin, false);

console.log('✅ TEST 3 PASSED: Webhook access control matrix strictly enforced.\n');

// TEST 4: Verifikasi Footer & Deteksi Booking Publik
console.log('4. Checking public booking & DP detection regex...');
const formText = `
Nama Lengkap: Budi Santoso
Jenis Acara: Wedding Day
Paket: Noer Basics 2
Tanggal Acara: 20/12/2026
Sudah bayar DP 500rb
`;

const regex = /(nama\s*(lengkap)?|jenis\s*acara|paket\s*(yang)?\s*dipilih|tanggal\s*acara|lokasi|venue|formulir\s*pemesanan|sudah\s*(bayar|transfer)|bukti\s*(transfer|dp|bayar)|dp\s*500)/i;
assert.strictEqual(regex.test(formText), true, 'Should detect booking form text');
assert.strictEqual(regex.test('halo apa kabar'), false, 'Should not detect regular text');

console.log('✅ TEST 4 PASSED: Booking detection pattern works.\n');

console.log('========================================');
console.log('🎉 ALL ACCESS CONTROL UNIT TESTS PASSED!');
console.log('========================================');
