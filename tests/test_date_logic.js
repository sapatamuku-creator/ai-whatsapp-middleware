const assert = require('assert');
const { extractDateFromText, normalizeMonthName } = require('../src/utils/dateHelper');
const { toolDeclarations, groqTools } = require('../src/tools/definitions');

console.log('\n========================================');
console.log('TEST SUITE: Date Extraction & Tool Definitions');
console.log('========================================\n');

// 1. Test normalizeMonthName
console.log('1. Testing month typo normalization...');
assert.strictEqual(normalizeMonthName('septmber'), 'September');
assert.strictEqual(normalizeMonthName('oktber'), 'Oktober');
assert.strictEqual(normalizeMonthName('nopember'), 'November');
assert.strictEqual(normalizeMonthName('pebruari'), 'Februari');
assert.strictEqual(normalizeMonthName('agust'), 'Agustus');
assert.strictEqual(normalizeMonthName('ags'), 'Agustus');
assert.strictEqual(normalizeMonthName('januri'), 'Januari');
console.log('   ✅ All month typo normalizations passed!');

// 2. Test extractDateFromText
console.log('\n2. Testing extractDateFromText on user WhatsApp queries...');
const query1 = "Buatkan folder drive blooma tanggal 6 septmber 2026 yang sudah ada datanya di spreadsheet. Jangan banyak alasan, buatkan saja. Berikan kesaya link drivenya";
const extracted1 = extractDateFromText(query1);
console.log(`   Query 1: "${query1}"`);
console.log(`   Extracted: "${extracted1}"`);
assert.strictEqual(extracted1, '6 September 2026');

const query2 = "Itu bukan tanggal 6 septmber";
const extracted2 = extractDateFromText(query2);
console.log(`   Query 2: "${query2}"`);
console.log(`   Extracted: "${extracted2}"`);
assert(extracted2.includes('6 September'));

const query3 = "Buat invoice untuk Kinnas tanggal 15/10/2026";
const extracted3 = extractDateFromText(query3);
console.log(`   Query 3: "${query3}"`);
console.log(`   Extracted: "${extracted3}"`);
assert.strictEqual(extracted3, '15/10/2026');

const query4 = "cek jadwal Widya 23 September 2026";
const extracted4 = extractDateFromText(query4);
console.log(`   Query 4: "${query4}"`);
console.log(`   Extracted: "${extracted4}"`);
assert.strictEqual(extracted4, '23 September 2026');
console.log('   ✅ All date extraction tests passed!');

// 3. Test Tool Definitions
console.log('\n3. Testing tool declarations & Groq tools format...');
const dateAwareTools = ['createClientDriveFolder', 'syncGoogleCalendar', 'generatePdfInvoice', 'getPaymentSummary', 'getBookingByName', 'updatePayment'];

for (const tName of dateAwareTools) {
  const tDecl = toolDeclarations.find(t => t.name === tName);
  assert(tDecl, `Tool ${tName} must exist in toolDeclarations`);
  assert(tDecl.parameters.properties.tanggal, `Tool ${tName} must have 'tanggal' parameter in toolDeclarations`);
  
  const gTool = groqTools.find(t => t.function.name === tName);
  assert(gTool, `Tool ${tName} must exist in groqTools`);
  assert(gTool.function.parameters.properties.tanggal, `Tool ${tName} must have 'tanggal' parameter in groqTools`);
  console.log(`   ✅ Tool "${tName}" properly defines parameter 'tanggal'`);
}

console.log('\n========================================');
console.log('ALL DATE LOGIC & DEFINITION TESTS PASSED! ✅');
console.log('========================================\n');
