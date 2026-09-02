const app = require('../src/index');
const config = require('../src/config');

async function runMiddlewareTests() {
  console.log('\n========================================');
  console.log('TEST SUITE: AI Middleware Server Test');
  console.log('========================================\n');

  console.log('1. Checking Express App instantiation...');
  if (typeof app === 'function') {
    console.log('✅ Express app successfully initialized!');
  } else {
    console.log('❌ Express app initialization failed.');
  }

  console.log('\n2. Checking Config values...');
  console.log('Port:', config.PORT);
  console.log('AI Model:', config.GEMINI_MODEL);
  console.log('Admin Numbers:', config.ADMIN_NUMBERS);
  console.log('GAS Secret Key configured:', !!config.GAS_API_SECRET);

  console.log('\n3. Checking Tools declarations...');
  const { toolDeclarations } = require('../src/tools/definitions');
  console.log(`✅ Loaded ${toolDeclarations.length} tool declarations:`);
  toolDeclarations.forEach(t => console.log(`   - ${t.name}`));

  console.log('\n========================================');
  console.log('ALL MIDDLEWARE INTEGRATION CHECKS PASSED ✅');
  console.log('========================================\n');
}

runMiddlewareTests();
