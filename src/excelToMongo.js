const xlsx = require('xlsx');
const mongoose = require('mongoose');
const ExcelReading = require('../models/excelReading'); // ✅ Correct name
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL) // ✅ or MONGO_URL if that’s your env var
  .then(() => console.log('✅ MongoDB connected (Excel Import)'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const filePath = '/mnt/c/Users/SH Computer/Downloads/chatid_test_invoice 1.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = xlsx.utils.sheet_to_json(sheet);

async function insertToExcelReadingDB() {
  try {
    const formatted = jsonData.map((entry, index) => {
      const oldMeter = Number(entry.oldMeter || 0);
      const newMeter = Number(entry.newMeter || 0);
      const usage = newMeter - oldMeter;

      // Calculate correct amount: (usage × 2000) + 2000 + 14000
      const PRICE_PER_UNIT = 2000;
      const PROTECT_METER_FEE = 2000;
      const SECURITY_FEE = 14000;

      const waterCost = usage * PRICE_PER_UNIT;
      const amount = waterCost + PROTECT_METER_FEE + SECURITY_FEE;

      return {
        customer: entry.customer || 'Unnamed',
        oldMeter,
        newMeter,
        usage,
        amount,
        chatId: entry.chatId || 0,
        username: entry.username || 'No username',
        groupName: entry.groupName || null,
        status: 'pending',
      };
    });

    await ExcelReading.insertMany(formatted);
    console.log(`🎉 Inserted ${formatted.length} rows into 'excelreading'.`);
  } catch (err) {
    console.error('❌ Insert failed:', err.message);
  } finally {
    mongoose.disconnect();
  }
}

insertToExcelReadingDB();
