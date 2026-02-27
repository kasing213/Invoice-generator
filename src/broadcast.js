// ===============================
// Broadcast CLI - Thin wrapper around broadcastCore
// ===============================
const mongoose = require('mongoose');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const {
  getBot,
  getFileType,
  formatDuration,
  loadTestConfig,
  getRecipients,
  broadcastToAll
} = require('./broadcastCore');

// ===============================
// Configuration
// ===============================
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const PROMO_DIR = isWSL ? '/mnt/d/ads-alert/promo/today' : 'd:/ads-alert/promo/today';
const SENT_DIR = isWSL ? '/mnt/d/ads-alert/promo/sent' : 'd:/ads-alert/promo/sent';

// ===============================
// Main Broadcast Function
// ===============================
async function broadcast() {
  const startTime = Date.now();
  const testConfig = loadTestConfig();

  console.log('========================================');
  if (testConfig.testMode && testConfig.testChatIds.length > 0) {
    console.log('  BROADCAST SCRIPT - TEST MODE');
  } else {
    console.log('  BROADCAST SCRIPT - PRODUCTION');
  }
  console.log('========================================\n');

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB connected\n');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Get recipients
  const { chatIds, mode } = await getRecipients(testConfig.testMode);

  if (mode === 'test') {
    console.log(`TEST MODE: Using ${chatIds.length} test chat IDs`);
    console.log(`Chat IDs: ${chatIds.join(', ')}\n`);
  } else {
    console.log(`Found ${chatIds.length} unique chat IDs\n`);
  }

  if (chatIds.length === 0) {
    console.log('No chat IDs found. Exiting.');
    await mongoose.disconnect();
    return;
  }

  // Check promo directory
  if (!await fs.pathExists(PROMO_DIR)) {
    console.log(`Promo directory not found: ${PROMO_DIR}`);
    console.log('Creating directory...');
    await fs.ensureDir(PROMO_DIR);
    console.log('Place your promo files in this directory and run again.');
    await mongoose.disconnect();
    return;
  }

  // Read files from promo directory
  const allFiles = await fs.readdir(PROMO_DIR);
  const files = allFiles.filter(f => !f.startsWith('.'));

  if (files.length === 0) {
    console.log(`No files found in ${PROMO_DIR}`);
    console.log('Add images, videos, or message.txt and run again.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Files to broadcast: ${files.join(', ')}\n`);

  // Read caption from message.txt if exists
  let caption = '';
  const messagePath = path.join(PROMO_DIR, 'message.txt');
  if (await fs.pathExists(messagePath)) {
    caption = (await fs.readFile(messagePath, 'utf-8')).trim();
    console.log(`Caption loaded: "${caption.substring(0, 50)}..."\n`);
  }

  // Build media files list
  const mediaFiles = files
    .filter(f => {
      const type = getFileType(f);
      return (type === 'photo' || type === 'video') && f !== 'message.txt';
    })
    .sort()
    .map(f => ({
      path: path.join(PROMO_DIR, f),
      type: getFileType(f),
      name: f
    }));

  console.log(`Media files: ${mediaFiles.length} (${mediaFiles.length > 1 ? 'album' : 'single'})`);

  // Stats tracking
  const stats = { errors: [] };

  // Run broadcast via generator
  console.log('\nStarting broadcast...\n');
  console.log('----------------------------------------');

  const bot = getBot();
  const generator = broadcastToAll(bot, chatIds, { mediaFiles, caption });

  for await (const event of generator) {
    if (event.type === 'result') {
      const progress = `[${event.index}/${event.total}]`;
      if (event.success) {
        console.log(`${progress} Chat ${event.chatId}... OK`);
      } else {
        console.log(`${progress} Chat ${event.chatId}... FAILED`);
        stats.errors.push({ chatId: event.chatId, error: event.error });
      }
    } else if (event.type === 'done') {
      Object.assign(stats, event.stats);
    }
  }

  // Move files to sent directory
  console.log('\n----------------------------------------');
  console.log('\nMoving files to sent directory...');

  const dateFolder = new Date().toISOString().slice(0, 10);
  const sentDateDir = path.join(SENT_DIR, dateFolder);
  await fs.ensureDir(sentDateDir);

  for (const file of files) {
    const srcPath = path.join(PROMO_DIR, file);
    const destPath = path.join(sentDateDir, file);
    await fs.move(srcPath, destPath, { overwrite: true });
    console.log(`  Moved: ${file}`);
  }

  // Print summary
  const duration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('  BROADCAST SUMMARY');
  console.log('========================================');
  console.log(`  Total chats:    ${stats.total}`);
  console.log(`  Successful:     ${stats.successful}`);
  console.log(`  Failed:         ${stats.failed}`);
  console.log(`  Blocked/Gone:   ${stats.blocked}`);
  console.log(`  Duration:       ${formatDuration(duration)}`);
  console.log('========================================\n');

  if (stats.errors.length > 0 && stats.errors.length <= 20) {
    console.log('Failed chats:');
    stats.errors.forEach(e => {
      console.log(`  - ${e.chatId}: ${e.error}`);
    });
    console.log('');
  } else if (stats.errors.length > 20) {
    console.log(`${stats.errors.length} errors occurred. First 10:`);
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.chatId}: ${e.error}`);
    });
    console.log('');
  }

  await mongoose.disconnect();
  console.log('Done!');
}

// ===============================
// Run
// ===============================
broadcast().catch(err => {
  console.error('Broadcast error:', err);
  process.exit(1);
});
