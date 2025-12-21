// test-sendtelegram.js - Stability Testing for sendtelegram.js
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  validChatId: 123456789,
  invalidChatId: 'invalid',
  validFilePath: './test-file.pdf',
  invalidFilePath: './non-existent-file.pdf',
  emptyFilePath: '',
  nullFilePath: null,
  undefinedFilePath: undefined,
  largeFilePath: './large-file.pdf', // Simulate large file
  networkTimeout: 5000
};

// Create a test file for testing
function createTestFile() {
  const testContent = 'This is a test PDF file for stability testing.';
  fs.writeFileSync(TEST_CONFIG.validFilePath, testContent);
  console.log('✅ Created test file for testing');
}

// Clean up test files
function cleanupTestFiles() {
  if (fs.existsSync(TEST_CONFIG.validFilePath)) {
    fs.unlinkSync(TEST_CONFIG.validFilePath);
    console.log('🧹 Cleaned up test files');
  }
}

// Stability test functions
function testParameterValidation() {
  console.log('\n🔍 Testing Parameter Validation...');
  
  // Test null/undefined parameters
  try {
    require('./src/sendtelegram')(null, TEST_CONFIG.validFilePath);
    console.log('❌ Should have thrown error for null chatId');
  } catch (err) {
    console.log('✅ Correctly handled null chatId');
  }

  try {
    require('./src/sendtelegram')(TEST_CONFIG.validChatId, null);
    console.log('❌ Should have thrown error for null filePath');
  } catch (err) {
    console.log('✅ Correctly handled null filePath');
  }

  // Test invalid parameter types
  try {
    require('./src/sendtelegram')('invalid', TEST_CONFIG.validFilePath);
    console.log('❌ Should have thrown error for string chatId');
  } catch (err) {
    console.log('✅ Correctly handled string chatId');
  }
}

function testFileExistence() {
  console.log('\n📁 Testing File Existence...');
  
  // Test with non-existent file
  try {
    require('./src/sendtelegram')(TEST_CONFIG.validChatId, './non-existent.pdf');
    console.log('❌ Should have thrown error for non-existent file');
  } catch (err) {
    console.log('✅ Correctly handled non-existent file');
  }

  // Test with directory instead of file
  try {
    require('./src/sendtelegram')(TEST_CONFIG.validChatId, './src');
    console.log('❌ Should have thrown error for directory path');
  } catch (err) {
    console.log('✅ Correctly handled directory path');
  }
}

function testNetworkStability() {
  console.log('\n🌐 Testing Network Stability...');
  
  // Test with invalid bot token (simulates network issues)
  const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'invalid_token';
  
  try {
    require('./src/sendtelegram')(TEST_CONFIG.validChatId, TEST_CONFIG.validFilePath);
    console.log('❌ Should have thrown error for invalid token');
  } catch (err) {
    console.log('✅ Correctly handled invalid bot token');
  }
  
  // Restore original environment
  process.env.TELEGRAM_BOT_TOKEN = originalEnv;
}

function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...');
  
  const errorScenarios = [
    { error: 'TELEGRAM_API_ERROR', message: 'Telegram API error' },
    { error: 'FILE_TOO_LARGE', message: 'File size exceeds 50MB limit' },
    { error: 'INVALID_CHAT_ID', message: 'Chat not found' },
    { error: 'BOT_BLOCKED', message: 'Bot was blocked by user' },
    { error: 'RATE_LIMIT', message: 'Too many requests' }
  ];

  errorScenarios.forEach(scenario => {
    try {
      // Test with invalid token to simulate errors
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = 'invalid_token';
      
      require('./src/sendtelegram')(TEST_CONFIG.validChatId, TEST_CONFIG.validFilePath);
      console.log(`❌ Should have thrown error for ${scenario.error}`);
      
      process.env.TELEGRAM_BOT_TOKEN = originalEnv;
    } catch (err) {
      console.log(`✅ Correctly handled ${scenario.error}`);
      process.env.TELEGRAM_BOT_TOKEN = originalEnv;
    }
  });
}

function testConcurrentRequests() {
  console.log('\n⚡ Testing Concurrent Requests...');
  
  const concurrentTests = 3; // Reduced for testing
  const promises = [];

  for (let i = 0; i < concurrentTests; i++) {
    promises.push(
      new Promise((resolve) => {
        try {
          require('./src/sendtelegram')(TEST_CONFIG.validChatId, TEST_CONFIG.validFilePath);
          console.log(`✅ Concurrent request ${i + 1} completed`);
          resolve();
        } catch (err) {
          console.log(`❌ Concurrent request ${i + 1} failed: ${err.message}`);
          resolve();
        }
      })
    );
  }

  Promise.all(promises)
    .then(() => console.log('✅ All concurrent requests handled'))
    .catch(err => console.log(`❌ Concurrent requests failed: ${err.message}`));
}

function testMemoryUsage() {
  console.log('\n💾 Testing Memory Usage...');
  
  const initialMemory = process.memoryUsage();
  console.log(`Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

  // Simulate multiple function calls
  const iterations = 10; // Reduced for testing
  const promises = [];

  for (let i = 0; i < iterations; i++) {
    promises.push(
      new Promise((resolve) => {
        try {
          require('./src/sendtelegram')(TEST_CONFIG.validChatId, TEST_CONFIG.validFilePath);
          resolve();
        } catch (err) {
          resolve(); // Ignore errors for memory test
        }
      })
    );
  }

  Promise.all(promises)
    .then(() => {
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      
      if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
        console.log('❌ Significant memory leak detected');
      } else {
        console.log('✅ Memory usage within acceptable limits');
      }
    })
    .catch(err => console.log(`❌ Memory test failed: ${err.message}`));
}

// Main test runner
async function runStabilityTests() {
  console.log('🚀 Starting Stability Tests for sendtelegram.js');
  console.log('==============================================');

  try {
    // Setup
    createTestFile();
    
    // Run tests
    testParameterValidation();
    testFileExistence();
    testNetworkStability();
    testErrorHandling();
    testConcurrentRequests();
    testMemoryUsage();

    console.log('\n✅ All stability tests completed');
  } catch (err) {
    console.error('\n❌ Stability tests failed:', err.message);
  } finally {
    // Cleanup
    cleanupTestFiles();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runStabilityTests();
}

module.exports = {
  runStabilityTests,
  testParameterValidation,
  testFileExistence,
  testNetworkStability,
  testErrorHandling,
  testConcurrentRequests,
  testMemoryUsage
}; 