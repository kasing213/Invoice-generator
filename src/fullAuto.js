// fullAuto.js — Mongo → Handlebars/Puppeteer → Telegram
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const formatInvoiceData = require('../utils/formatInvoiceData');
const generateInvoice = require('../src/generateInvoice');
const sendInvoiceToTelegram = require('../src/sendtelegram');
const ExcelReading = require('../models/excelReading');

const CONFIG = {
  batchDelay: 200,            // ms between sends
  sendRetries: 3,
  sendRetryBaseDelay: 2000    // progressive backoff
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function sendWithRetry(chatId, imagePath) {
  for (let i = 1; i <= CONFIG.sendRetries; i++) {
    const ok = await sendInvoiceToTelegram(chatId, imagePath, 1);
    if (ok) return true;
    if (i < CONFIG.sendRetries) {
      const wait = CONFIG.sendRetryBaseDelay * i;
      console.log(`   ⚠️ Send failed (try ${i}) — retrying in ${wait}ms...`);
      await delay(wait);
    }
  }
  return false;
}

function hasValidChatId(chatId) {
  if (chatId === null || chatId === undefined) return false;
  const s = String(chatId).trim();
  return s !== '' && s !== '0';
}

(async function main() {
  const start = Date.now();
  try {
    console.log('\n🚀 Starting FullAuto: Mongo → Puppeteer → Telegram\n');

    // NOTE: Your old file used MONGO_URL (keep using it) 
    if (!process.env.MONGO_URL) {
      throw new Error('MONGO_URL missing in .env');
    }
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ MongoDB connected\n');

    // Only non-sent/non-paid docs; use .lean() to avoid prototype access in Handlebars
    const readings = await ExcelReading.find({
      status: { $nin: ['sent', 'paid'] }
    }).sort({ _id: -1 }).lean();  // 

    if (!readings.length) {
      console.log('ℹ️ No pending records to process.');
      return;
    }

    console.log(`📋 Found ${readings.length} reading(s) to process\n`);

    let okCount = 0, errCount = 0;
    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      const customer = r.customer || r.name || r.chatId || r._id;
      console.log(`➡️ [${i + 1}/${readings.length}] Processing: ${customer}`);

      try {
        // Normalize to template-ready payload
        const data = formatInvoiceData(r);

        // Generate image → returns absolute path (no more guessing D:/...)
        const imagePath = await generateInvoice(data);
        if (!imagePath) throw new Error('Image generation failed');

        if (!fs.existsSync(imagePath)) throw new Error(`Image not found at ${imagePath}`);

        if (!hasValidChatId(data.chatId)) {
          console.log('   ⏩ Generated but no valid chatId → skipping send');
          await ExcelReading.updateOne(
            { _id: r._id },
            { $set: { status: 'generated', imageFile: path.basename(imagePath) } }
          );
        } else {
          const sent = await sendWithRetry(data.chatId, imagePath);
          if (!sent) throw new Error('telegram_send_failed');

          await ExcelReading.updateOne(
            { _id: r._id, status: { $ne: 'sent' } },
            { $set: { status: 'sent', lastSent: new Date(), imageFile: path.basename(imagePath) } }
          );

          console.log(`   📤 Sent successfully → ${customer}`);
        }
      } catch (e) {
        errCount++;
        console.error(`   ❌ Error for ${customer}: ${e.message}`);
        await ExcelReading.updateOne(
          { _id: r._id },
          { $set: { status: 'failed', lastError: String(e.message), lastTriedAt: new Date() } }
        );
      }

      if (i < readings.length - 1) {
        console.log(`   ⏳ Waiting ${CONFIG.batchDelay}ms...\n`);
        await delay(CONFIG.batchDelay);
      }
    }

    const sec = Math.round((Date.now() - start) / 1000);
    console.log(`\n📊 Summary: ${okCount} sent, ${errCount} errors, finished in ${sec}s.`);
  } catch (err) {
    console.error('💥 Fatal:', err.message);
  } finally {
    try { await mongoose.disconnect(); } catch {}
    console.log('🔌 MongoDB disconnected\n');
  }
})();
