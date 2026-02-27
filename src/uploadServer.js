const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const ExcelReading = require('../models/excelReading');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer — store in memory, no temp files
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Serve the frontend
app.use(express.static(path.join(__dirname, '../public')));

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload endpoint
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet);

    if (jsonData.length === 0) {
      return res.status(400).json({ success: false, error: 'Excel file is empty' });
    }

    const PRICE_PER_UNIT = 2000;
    const PROTECT_METER_FEE = 2000;
    const SECURITY_FEE = 14000;

    const formatted = jsonData.map((entry) => {
      const oldMeter = Number(entry['old meter'] || entry.oldMeter || 0);
      const newMeter = Number(entry['new meter'] || entry.newMeter || 0);
      let usage = newMeter - oldMeter;

      if (usage < 0) {
        usage = newMeter;
      }

      const waterCost = usage * PRICE_PER_UNIT;
      const amount = waterCost + PROTECT_METER_FEE + SECURITY_FEE;

      return {
        customer: entry.customer || 'Unnamed',
        oldMeter,
        newMeter,
        usage,
        amount,
        chatId: entry.chatid || entry.chatId || 0,
        username: entry.username || 'No username',
        groupName: entry.groupName || null,
        status: 'pending',
      };
    });

    const result = await ExcelReading.insertMany(formatted);

    res.json({
      success: true,
      message: `Inserted ${result.length} rows`,
      count: result.length,
      preview: formatted.slice(0, 5),
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function startUploadServer() {
  app.listen(PORT, () => {
    console.log(`📤 Upload dashboard running on port ${PORT}`);
  });
}

module.exports = { startUploadServer };
