// Test QR code generation functionality
const { generateRegistrationQR, generateBatchQR, isQRCodeAvailable } = require('../utils/qrGenerator');
require('dotenv').config();

async function testQRGeneration() {
  try {
    console.log('🔳 Testing QR Code Generation...\n');

    if (!isQRCodeAvailable()) {
      console.log('❌ QRCode library not installed');
      console.log('📦 Install with: npm install qrcode\n');
      return;
    }

    console.log('✅ QRCode library available\n');

    // Test 1: Generate single QR code
    console.log('📱 Test 1: Generating registration QR code...');
    const botUsername = process.env.BOT_USERNAME || 'InvoiceGeneratorBot';

    const qrData = await generateRegistrationQR(botUsername);
    console.log(`✅ QR code generated successfully!`);
    console.log(`📁 File: ${qrData.qrPath}`);
    console.log(`🔗 URL: ${qrData.registrationUrl}`);
    console.log(`🔑 Token: ${qrData.token}\n`);

    // Test 2: Generate batch QR codes
    console.log('📱 Test 2: Generating batch QR codes (3 codes)...');
    const batchQR = await generateBatchQR(botUsername, 3);
    console.log(`✅ Generated ${batchQR.length} QR codes:`);
    batchQR.forEach(qr => {
      console.log(`  QR ${qr.number}: ${qr.token}`);
    });

    console.log('\n🎉 All QR tests passed!');
    console.log('📁 Check the qr-codes/ folder for generated images');

  } catch (error) {
    console.error('❌ QR test failed:', error.message);
  }
}

// Run the test
testQRGeneration();