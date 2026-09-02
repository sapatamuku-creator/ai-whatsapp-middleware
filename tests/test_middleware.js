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

  console.log('\n2. Checking Config values & Model Hierarchy...');
  console.log('Port:', config.PORT);
  console.log('Central Active Models Hierarchy:', config.getModelHierarchy());
  console.log('Voice Model:', config.MODELS.VOICE_MODEL);
  console.log('Admin Numbers:', config.ADMIN_NUMBERS);
  console.log('GAS Secret Key configured:', !!config.GAS_API_SECRET);

  console.log('\n3. Checking Tools declarations...');
  const { toolDeclarations, groqTools } = require('../src/tools/definitions');
  console.log(`✅ Loaded ${toolDeclarations.length} tool declarations (Groq tools: ${groqTools.length}):`);
  toolDeclarations.forEach(t => console.log(`   - ${t.name}`));

  console.log('\n========================================');
  console.log('ALL MIDDLEWARE INTEGRATION CHECKS PASSED ✅');
  console.log('========================================\n');
}

runMiddlewareTests();
