// utils/logger.js
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs/fullAuto.log');

// Ensure logs folder exists
if (!fs.existsSync(path.dirname(logFile))) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}`;

  // Console pretty print
  if (type === 'success') console.log(`✅ ${message}`);
  else if (type === 'skip') console.log(`⏩ ${message}`);
  else if (type === 'error') console.error(`❌ ${message}`);
  else console.log(formatted);

  // Append to log file
  fs.appendFileSync(logFile, formatted + '\n');
}

module.exports = log;
