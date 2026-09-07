const assert = require('assert');
const { groqTools } = require('../src/tools/definitions');

console.log('=== TEST 1: GROQ TOOL DEFINITIONS VALIDITY ===');
const missingDriveTool = groqTools.find(t => t.function.name === 'createMissingDriveFolders');
assert(missingDriveTool, 'createMissingDriveFolders tool harus terdaftar di groqTools');
console.log('✅ createMissingDriveFolders terdaftar di groqTools');

const upcomingTool = groqTools.find(t => t.function.name === 'getUpcomingEvents');
assert(upcomingTool, 'getUpcomingEvents tool harus terdaftar');
console.log('✅ getUpcomingEvents terdaftar di groqTools');

console.log('\n=== TEST 2: SANITIZE AND COMPRESS GAS RESULT ===');
// We require the aiService internals by extracting sanitizeAndCompressGasResult or testing via aiService
// Let's create a test dataset mimicking 60 rows from GAS getAllBookings / getUpcomingSchedule
const dummyBigGasResult = {
  success: true,
  count: 60,
  data: Array.from({ length: 60 }, (_, i) => ({
    rowIndex: i + 2,
    Nama: `Client Test ${i + 1}`,
    Groom: `Groom ${i + 1}`,
    Bride: `Bride ${i + 1}`,
    Tanggal: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
    Lokasi: `Grand Ballroom Venue ${i + 1} Jalan Sangat Panjang Sekali Nomor 123 Bandung Jawa Barat`,
    Maps: `https://maps.google.com/?q=-6.917464,107.619123&venue=${i + 1}`,
    Layanan: 'Wedding Day',
    Paket: 'Noer Basics 2',
    Catatan: 'Keluarga mempelai meminta fotografer standby 2 jam sebelum akad dimulai, foto keluarga besar...',
    Waktu: '08.00 - 17.00 WIB',
    'Harga Paket': 2900000,
    DP1: 500000,
    DP2: 0,
    DP3: 0,
    DP4: 0,
    'Sisa Pembayaran': 2400000,
    Status: 'DP1',
    'Folder Drive URL': i % 2 === 0 ? `https://drive.google.com/drive/folders/1abcxyz${i}` : '',
    'Invoice PDF URL': i % 3 === 0 ? `https://drive.google.com/file/d/invoice_${i}.pdf` : ''
  }))
};

// Re-import or test the function from aiService
// Since sanitizeAndCompressGasResult is private in aiService.js, let's test directly with equivalent logic or export it for tests
// Let's test require aiService directly
console.log('Total raw GAS result character size:', JSON.stringify(dummyBigGasResult).length, 'characters (~', Math.round(JSON.stringify(dummyBigGasResult).length / 4), 'tokens)');

// Verify that 60 items raw is > 20,000 chars
assert(JSON.stringify(dummyBigGasResult).length > 15000, 'Raw GAS result harusnya berukuran besar');

// Test the compression logic directly
const { sanitizeAndCompressGasResult } = (() => {
  const fs = require('fs');
  const code = fs.readFileSync(require.resolve('../src/services/aiService'), 'utf8');
  // eval the function in isolation
  const fnCode = code.match(/function sanitizeAndCompressGasResult\([\s\S]*?\n\}/)[0];
  return new Function(`${fnCode}; return { sanitizeAndCompressGasResult };`)();
})();

const compressed = sanitizeAndCompressGasResult(dummyBigGasResult);
console.log('Compressed size:', compressed.length, 'characters (~', Math.round(compressed.length / 4), 'tokens)');

// 1. Must be valid JSON
let parsed;
assert.doesNotThrow(() => {
  parsed = JSON.parse(compressed);
}, 'Compressed result harus valid JSON');
console.log('✅ Output compressed berhasil diparse sebagai Valid JSON');

// 2. Must be well under 2500 characters
assert(compressed.length <= 2500, `Panjang payload harus <= 2500, tetapi didapat: ${compressed.length}`);
console.log(`✅ Ukuran payload aman: ${compressed.length} characters (<= 2500)`);

// 3. Must preserve hasDrive and driveUrl
assert(parsed.items && parsed.items.length > 0, 'Items harus ada di parsed output');
assert.strictEqual(parsed.items[0].hasDrive, true, 'Item 0 seharusnya memiliki hasDrive = true');
assert.strictEqual(parsed.items[1].hasDrive, false, 'Item 1 seharusnya memiliki hasDrive = false');
console.log('✅ Kolom hasDrive berhasil dipetakan dengan tepat (Item 0: true, Item 1: false)');

console.log('\n=== TEST 3: TESTING HANDLE MISSING DRIVE FOLDERS RESPONSE ===');
const missingDriveGasMock = {
  success: true,
  total_upcoming_missing: 2,
  auto_created: true,
  processed_count: 2,
  events: [
    {
      nama: 'Kinnas',
      tanggal: '10/10/2026',
      paket: 'Noer Basics 2',
      folder_name: '[2026-10-10] Kinnas - Noer Basics 2',
      folder_url: 'https://drive.google.com/drive/folders/1xyz_kinnas',
      is_new: true,
      status: 'Folder berhasil dibuat'
    },
    {
      nama: 'Budi',
      tanggal: '15/10/2026',
      paket: 'Noer Premium',
      folder_name: '[2026-10-15] Budi - Noer Premium',
      folder_url: 'https://drive.google.com/drive/folders/1xyz_budi',
      is_new: true,
      status: 'Folder berhasil dibuat'
    }
  ],
  message: 'Berhasil membuat folder Google Drive untuk 2 event mendatang.'
};

const compressedMissing = sanitizeAndCompressGasResult(missingDriveGasMock);
console.log('Compressed Missing Drive size:', compressedMissing.length, 'characters');
const parsedMissing = JSON.parse(compressedMissing);
assert(parsedMissing.items && parsedMissing.items.length === 2, 'Harus memuat 2 event');
console.log('✅ Missing drive folders payload terkompresi dengan sempurna');

console.log('\n🎉 SEMUA TEST BERHASIL MELEWATI VERIFIKASI!');
