// QR Code generation for chat ID registration
const fs = require('fs');
const path = require('path');

let QRCode;
let qrCodeAvailable = true;

try {
  QRCode = require('qrcode');
} catch (err) {
  qrCodeAvailable = false;
  console.log('⚠️  QRCode library not found. Install with: npm install qrcode');
}

/**
 * Generate registration QR code
 * @param {string} botUsername - Your bot's username (e.g., @YourBot)
 * @param {string} uniqueToken - Unique token for tracking registration
 * @returns {Promise<string>} Path to generated QR code image
 */
async function generateRegistrationQR(botUsername, uniqueToken = null) {
  if (!qrCodeAvailable) {
    throw new Error('QRCode library not installed. Run: npm install qrcode');
  }

  try {
    // Create unique token if not provided
    if (!uniqueToken) {
      uniqueToken = generateUniqueToken();
    }

    // Create registration URL that opens Telegram and starts bot with token
    const registrationUrl = `https://t.me/${botUsername.replace('@', '')}?start=register_${uniqueToken}`;

    // Generate QR code
    const qrDir = path.join(__dirname, '../qr-codes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrPath = path.join(qrDir, `registration_${uniqueToken}.png`);

    await QRCode.toFile(qrPath, registrationUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log(`✅ QR code generated: ${qrPath}`);
    console.log(`📱 Registration URL: ${registrationUrl}`);

    return {
      qrPath,
      registrationUrl,
      token: uniqueToken
    };

  } catch (error) {
    console.error('❌ QR generation failed:', error);
    throw error;
  }
}

/**
 * Generate QR code for specific invoice or customer
 * @param {string} botUsername - Bot username
 * @param {Object} invoiceData - Invoice information
 * @returns {Promise<Object>} QR code details
 */
async function generateInvoiceQR(botUsername, invoiceData) {
  if (!qrCodeAvailable) {
    throw new Error('QRCode library not installed. Run: npm install qrcode');
  }

  try {
    const { customer, amount, invoiceId } = invoiceData;
    const token = generateUniqueToken();

    // Create URL that pre-fills invoice data
    const invoiceUrl = `https://t.me/${botUsername.replace('@', '')}?start=invoice_${token}`;

    const qrDir = path.join(__dirname, '../qr-codes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrPath = path.join(qrDir, `invoice_${invoiceId || token}.png`);

    await QRCode.toFile(qrPath, invoiceUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Store invoice data temporarily for when user scans
    await storeInvoiceData(token, invoiceData);

    return {
      qrPath,
      invoiceUrl,
      token
    };

  } catch (error) {
    console.error('❌ Invoice QR generation failed:', error);
    throw error;
  }
}

/**
 * Generate a batch of registration QR codes
 * @param {string} botUsername - Bot username
 * @param {number} count - Number of QR codes to generate
 * @returns {Promise<Array>} Array of QR code details
 */
async function generateBatchQR(botUsername, count = 10) {
  if (!qrCodeAvailable) {
    throw new Error('QRCode library not installed. Run: npm install qrcode');
  }

  const results = [];
  const batchToken = Date.now().toString();

  for (let i = 1; i <= count; i++) {
    const token = `${batchToken}_${i.toString().padStart(3, '0')}`;

    try {
      const qr = await generateRegistrationQR(botUsername, token);
      results.push({
        ...qr,
        number: i
      });
    } catch (error) {
      console.error(`❌ Failed to generate QR ${i}:`, error.message);
    }
  }

  // Create batch summary
  const summaryPath = path.join(__dirname, '../qr-codes', `batch_${batchToken}_summary.txt`);
  const summary = results.map(qr =>
    `QR ${qr.number}: ${qr.registrationUrl}`
  ).join('\n');

  fs.writeFileSync(summaryPath, summary);

  console.log(`✅ Generated ${results.length} QR codes`);
  console.log(`📋 Summary saved: ${summaryPath}`);

  return results;
}

/**
 * Generate unique token for tracking
 * @returns {string} Unique token
 */
function generateUniqueToken() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Store invoice data temporarily (you might want to use Redis or database)
 * @param {string} token - Unique token
 * @param {Object} invoiceData - Invoice data to store
 */
async function storeInvoiceData(token, invoiceData) {
  // For now, store in a simple JSON file (in production, use Redis or database)
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, `invoice_${token}.json`);
  fs.writeFileSync(filePath, JSON.stringify({
    ...invoiceData,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  }, null, 2));
}

/**
 * Retrieve stored invoice data
 * @param {string} token - Token to look up
 * @returns {Object|null} Invoice data or null if not found/expired
 */
function getInvoiceData(token) {
  try {
    const filePath = path.join(__dirname, '../temp', `invoice_${token}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check if expired
    if (new Date() > new Date(data.expiresAt)) {
      fs.unlinkSync(filePath); // Clean up expired file
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error retrieving invoice data:', error);
    return null;
  }
}

/**
 * Clean up old temporary files
 */
function cleanupExpiredTokens() {
  try {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) return;

    const files = fs.readdirSync(tempDir);
    let cleanedCount = 0;

    files.forEach(file => {
      if (file.startsWith('invoice_') && file.endsWith('.json')) {
        const filePath = path.join(tempDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (new Date() > new Date(data.expiresAt)) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        } catch (err) {
          // If file is corrupted, remove it
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired tokens`);
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Auto-cleanup expired tokens every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
  generateRegistrationQR,
  generateInvoiceQR,
  generateBatchQR,
  getInvoiceData,
  cleanupExpiredTokens,
  isQRCodeAvailable: () => qrCodeAvailable
};