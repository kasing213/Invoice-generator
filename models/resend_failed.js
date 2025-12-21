// resend_failed.js
const mongoose = require('mongoose');
const ExcelReading = require('./models/excelReading');
const sendInvoiceToTelegram = require('./sendtelegram'); // existing function
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const failedInvoices = await ExcelReading.find({ status: 'failed' });

  console.log(`🔄 Retrying ${failedInvoices.length} failed invoices...`);
  for (const inv of failedInvoices) {
    try {
      await sendInvoiceToTelegram(inv.chatId, `invoices/${inv.customer}.jpg`);
      inv.status = 'sent';
      inv.lastSent = new Date();
      await inv.save();
      console.log(`✅ Resent to ${inv.customer}`);
    } catch (err) {
      console.error(`❌ Failed again for ${inv.customer}:`, err.message);
      inv.lastError = err.message;
      inv.lastTriedAt = new Date();
      await inv.save();
    }
  }

  await mongoose.disconnect();
})();
