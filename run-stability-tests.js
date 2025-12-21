// run-stability-tests.js - Simple test runner for sendtelegram.js stability
const { runStabilityTests } = require('./test-sendtelegram');

console.log('🔧 Starting Stability Tests for sendtelegram.js');
console.log('==============================================');

// Check if .env file exists
const fs = require('fs');
if (!fs.existsSync('.env')) {
  console.log('⚠️  No .env file found. Creating test environment...');
  // Create a minimal .env for testing
  fs.writeFileSync('.env', 'TELEGRAM_BOT_TOKEN=test_token_123\nMONGO_URI=mongodb://localhost:27017/test');
}

// Run the tests
runStabilityTests()
  .then(() => {
    console.log('\n🎉 All stability tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Stability tests failed:', error.message);
    process.exit(1);
  }); 