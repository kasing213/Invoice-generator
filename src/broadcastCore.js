// ===============================
// Broadcast Core - Reusable broadcast engine
// ===============================
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const Invoice = require('../models/invoice');

// ===============================
// Constants
// ===============================
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const TEXT_EXTENSIONS = ['.txt', '.md'];
const RATE_LIMIT_DELAY = 200;
const MAX_RETRIES = 3;
const TEST_CONFIG_PATH = path.join(__dirname, '../config/broadcast-test.json');

// ===============================
// Lazy bot singleton (no polling)
// ===============================
let _bot = null;

function getBot() {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
    _bot = new TelegramBot(token, { polling: false });
  }
  return _bot;
}

// ===============================
// Utility Functions
// ===============================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'photo';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  return 'document';
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

// ===============================
// Config & Recipients
// ===============================
function loadTestConfig() {
  try {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    console.log('No test config found, using production mode');
  }
  return { testMode: false, testChatIds: [] };
}

async function getRecipients(testMode) {
  const config = loadTestConfig();
  const excludeList = config.excludeChatIds || [];

  if (testMode && config.testChatIds && config.testChatIds.length > 0) {
    return { chatIds: config.testChatIds, mode: 'test' };
  }

  let allChatIds = await Invoice.distinct('chatId', {
    chatId: { $ne: null, $exists: true }
  });

  if (excludeList.length > 0) {
    allChatIds = allChatIds.filter(id => !excludeList.includes(id));
  }

  return { chatIds: allChatIds, mode: 'production' };
}

// ===============================
// Send with Retry Logic
// ===============================
async function sendWithRetry(chatId, sendFn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sendFn();
      return { success: true };
    } catch (error) {
      const isRateLimit = error.response?.statusCode === 429;
      const retryAfter = error.response?.body?.parameters?.retry_after || 5;

      if (error.response?.statusCode === 403) {
        return { success: false, error: 'Bot blocked or removed from chat', blocked: true };
      }

      if (error.response?.statusCode === 400) {
        return { success: false, error: 'Chat not found or invalid', blocked: true };
      }

      if (isRateLimit && attempt < retries) {
        await delay(retryAfter * 1000);
        continue;
      }

      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000;
        await delay(backoff);
        continue;
      }

      return { success: false, error: error.message };
    }
  }
}

// ===============================
// Send to a single chat
// ===============================
async function sendToChat(bot, chatId, { mediaFiles, caption }) {
  const isMediaGroup = mediaFiles.length > 1;
  const isSingleMedia = mediaFiles.length === 1;

  if (isMediaGroup) {
    const media = mediaFiles.map((file, index) => ({
      type: file.type,
      media: file.path,
      caption: index === 0 ? caption : undefined,
      parse_mode: index === 0 && caption ? 'Markdown' : undefined
    }));

    return sendWithRetry(chatId, () => bot.sendMediaGroup(chatId, media));
  }

  if (isSingleMedia) {
    const file = mediaFiles[0];
    if (file.type === 'photo') {
      return sendWithRetry(chatId, () =>
        bot.sendPhoto(chatId, file.path, {
          caption: caption || undefined,
          parse_mode: 'Markdown'
        })
      );
    }
    return sendWithRetry(chatId, () =>
      bot.sendVideo(chatId, file.path, {
        caption: caption || undefined,
        parse_mode: 'Markdown'
      })
    );
  }

  if (caption) {
    return sendWithRetry(chatId, () =>
      bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' })
    );
  }

  return { success: false, error: 'No media and no caption' };
}

// ===============================
// Broadcast to all - async generator
// ===============================
async function* broadcastToAll(bot, chatIds, { mediaFiles, caption }) {
  const total = chatIds.length;

  yield { type: 'start', total, mediaCount: mediaFiles.length, hasCaption: !!caption };

  const stats = { total, successful: 0, failed: 0, blocked: 0 };

  for (let i = 0; i < chatIds.length; i++) {
    const chatId = chatIds[i];
    let result;

    try {
      result = await sendToChat(bot, chatId, { mediaFiles, caption });
    } catch (err) {
      result = { success: false, error: err.message };
    }

    if (result.success) {
      stats.successful++;
    } else {
      stats.failed++;
      if (result.blocked) stats.blocked++;
    }

    yield {
      type: 'result',
      chatId,
      index: i + 1,
      total,
      success: result.success,
      error: result.error || null,
      blocked: !!result.blocked
    };

    if (i < chatIds.length - 1) {
      await delay(RATE_LIMIT_DELAY);
    }
  }

  yield { type: 'done', stats };
}

module.exports = {
  getBot,
  getFileType,
  formatDuration,
  loadTestConfig,
  getRecipients,
  sendWithRetry,
  sendToChat,
  broadcastToAll,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS
};
