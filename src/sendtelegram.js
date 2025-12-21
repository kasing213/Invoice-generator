// sendtelegram.js
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

async function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function sendInvoiceToTelegram(chatId, filePath, attempts = 3) {
  let delay = 1000;
  for (let i = 1; i <= attempts; i++) {
    try {
      await bot.sendPhoto(chatId, filePath);
      console.log(`📤 Sent photo to chat ${chatId}`);
      return true;
    } catch (err) {
      // Handle Telegram 429
      const retryAfter = err?.response?.parameters?.retry_after;
      if (retryAfter) {
        console.warn(`⏳ 429: waiting ${retryAfter}s`);
        await wait((retryAfter + 1) * 1000);
      } else {
        console.warn(`⚠️ Send attempt ${i} failed: ${err.message}`);
        if (i < attempts) {
          await wait(delay);
          delay *= 2; // backoff
        } else {
          return false;
        }
      }
    }
  }
}

module.exports = sendInvoiceToTelegram;
