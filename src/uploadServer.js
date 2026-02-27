const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const ExcelReading = require('../models/excelReading');
const { getBot, getFileType, getRecipients, broadcastToAll } = require('./broadcastCore');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Multer — Excel upload (memory)
// ===============================
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

// ===============================
// Multer — Broadcast media upload (disk)
// ===============================
const broadcastUploadDir = path.join(os.tmpdir(), 'broadcast-upload');
fs.ensureDirSync(broadcastUploadDir);

const broadcastStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, broadcastUploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const broadcastUpload = multer({
  storage: broadcastStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ===============================
// Broadcast concurrency guard
// ===============================
let broadcastInProgress = false;

// ===============================
// Static files & pages
// ===============================
app.use(express.static(path.join(__dirname, '../public')));

app.get('/broadcast', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/broadcast.html'));
});

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===============================
// Excel upload endpoint
// ===============================
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

// ===============================
// Broadcast API
// ===============================

// Get recipient count
app.get('/api/broadcast/recipients', async (req, res) => {
  try {
    const testMode = req.query.testMode === 'true';
    const { chatIds, mode } = await getRecipients(testMode);
    res.json({ success: true, count: chatIds.length, mode });
  } catch (err) {
    console.error('Recipients error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send broadcast (SSE stream)
app.post('/api/broadcast/send', broadcastUpload.array('media', 10), async (req, res) => {
  if (broadcastInProgress) {
    // Clean up uploaded files
    if (req.files) {
      for (const f of req.files) {
        fs.remove(f.path).catch(() => {});
      }
    }
    return res.status(409).json({ success: false, error: 'A broadcast is already in progress' });
  }

  broadcastInProgress = true;
  const uploadedFiles = req.files || [];

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  function sendEvent(data) {
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  }

  try {
    const caption = (req.body.caption || '').trim();
    const testMode = req.body.testMode === 'true';

    const { chatIds, mode } = await getRecipients(testMode);

    if (chatIds.length === 0) {
      sendEvent({ type: 'error', message: 'No recipients found' });
      res.end();
      broadcastInProgress = false;
      return;
    }

    // Build media files list from uploads
    const mediaFiles = uploadedFiles
      .map(f => ({
        path: f.path,
        type: getFileType(f.originalname),
        name: f.originalname
      }))
      .filter(f => f.type === 'photo' || f.type === 'video');

    if (mediaFiles.length === 0 && !caption) {
      sendEvent({ type: 'error', message: 'No media and no caption provided' });
      res.end();
      broadcastInProgress = false;
      return;
    }

    const bot = getBot();
    const generator = broadcastToAll(bot, chatIds, { mediaFiles, caption });

    for await (const event of generator) {
      sendEvent(event);
    }
  } catch (err) {
    console.error('Broadcast error:', err);
    sendEvent({ type: 'error', message: err.message });
  } finally {
    // Clean up temp files
    for (const f of uploadedFiles) {
      fs.remove(f.path).catch(() => {});
    }
    broadcastInProgress = false;
    res.end();
  }
});

function startUploadServer() {
  app.listen(PORT, () => {
    console.log(`📤 Upload dashboard running on port ${PORT}`);
  });
}

module.exports = { startUploadServer };
