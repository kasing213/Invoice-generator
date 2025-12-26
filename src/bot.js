// ===============================
// Enhanced bot.js with Rate Limiting & Protection
// ===============================
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const path = require('path');
const generateInvoice = require('./generateInvoice');
const sendInvoiceToTelegram = require('./sendtelegram');
const Invoice = require('../models/invoice');
const { findCustomer, searchCustomers, getAllCustomers, formatCustomerInfo } = require('../utils/customerLookup');
const { generateRegistrationQR, generateBatchQR, getInvoiceData, isQRCodeAvailable } = require('../utils/qrGenerator');
require('dotenv').config();

// ===============================
// Rate Limiting Configuration
// ===============================
const RATE_LIMITS = {
  userCooldown: 5 * 1000, // 5 seconds between user requests
  messageDelay: 200, // 200ms between bot messages
  dailyInvoiceLimit: 1000, // Max 1000 invoices per user per day
  registrationCooldown: 24 * 60 * 60 * 1000, // 24 hours between /me registrations
  globalRateLimit: 30, // Max 30 messages per second
  bulkMode: true // Enable bulk sending mode
};

// Rate limiting storage
const userCooldowns = new Map();
const messageQueue = [];
let lastMessageTime = 0;

// ===============================
// Init Bot with Rate Limiting
// ===============================
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { 
  polling: true,
  request: {
    timeout: 30000
  }
});

// ===============================
// Utility Functions
// ===============================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCooldown(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

function isUserRateLimited(userId) {
  const now = Date.now();
  const lastRequest = userCooldowns.get(userId) || 0;
  
  if (now - lastRequest < RATE_LIMITS.userCooldown) {
    return true;
  }
  
  userCooldowns.set(userId, now);
  return false;
}

async function sendMessageWithRateLimit(chatId, message) {
  const now = Date.now();
  const timeSinceLastMessage = now - lastMessageTime;
  
  if (timeSinceLastMessage < RATE_LIMITS.messageDelay) {
    await delay(RATE_LIMITS.messageDelay - timeSinceLastMessage);
  }
  
  await bot.sendMessage(chatId, message);
  lastMessageTime = Date.now();
}

async function checkDailyInvoiceLimit(userId, chatId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyInvoices = await Invoice.countDocuments({
    userId: userId,
    createdAt: { $gte: today }
  });
  
  if (dailyInvoices >= RATE_LIMITS.dailyInvoiceLimit) {
    await sendMessageWithRateLimit(chatId, 
      `⚠️ Daily invoice limit reached (${RATE_LIMITS.dailyInvoiceLimit}). Please try again tomorrow.`
    );
    return false;
  }
  
  return true;
}

async function checkDuplicateInvoice(customer, chatId, amount) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const existingInvoice = await Invoice.findOne({
    customer: customer,
    chatId: chatId,
    amount: amount,
    createdAt: { $gte: oneHourAgo }
  });
  
  if (existingInvoice) {
    await sendMessageWithRateLimit(chatId, 
      `⚠️ Similar invoice already exists for ${customer} ($${amount}) in the last hour.`
    );
    return true;
  }
  
  return false;
}

// ===============================
// MongoDB Connect with Retry
// ===============================
async function connectToMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    // Retry after 5 seconds
    setTimeout(connectToMongo, 5000);
  }
}

connectToMongo();

// ===============================
// Enhanced /start Command with QR Registration
// ===============================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || 'No username';
  const fullName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  const isGroup = ['group','supergroup'].includes(msg.chat.type);
  const groupId = isGroup ? chatId : null;
  const groupName = msg.chat.title || `Private-${msg.from.username}`;

  if (isUserRateLimited(userId)) {
    return; // Silently ignore rate-limited requests
  }

  const startParam = match[1] ? match[1].trim() : '';

  try {
    // Handle QR code registration
    if (startParam.startsWith('register_')) {
      const token = startParam.replace('register_', '');

      // Auto-register user via QR code
      await new Invoice({
        customer: fullName || 'QR Registration',
        amount: 0,
        chatId,
        userId,
        groupId,
        groupName,
        username,
        status: 'registered',
        dueDate: new Date().toISOString().slice(0, 10)
      }).save();

      await sendMessageWithRateLimit(chatId,
        `✅ **QR Registration Successful!**\n\n` +
        `👤 Name: ${fullName}\n` +
        `💬 Chat ID: ${chatId}\n` +
        `🆔 User ID: ${userId}\n` +
        `👥 Group: ${groupName}\n\n` +
        `You can now use all bot commands!`
      );

      console.log(`📱 QR Registration: ${fullName} (${chatId}) via token ${token}`);
      return;
    }

    // Handle invoice QR code
    if (startParam.startsWith('invoice_')) {
      const token = startParam.replace('invoice_', '');
      const invoiceData = getInvoiceData(token);

      if (invoiceData) {
        await sendMessageWithRateLimit(chatId,
          `📋 **Invoice Information**\n\n` +
          `👤 Customer: ${invoiceData.customer}\n` +
          `💰 Amount: $${invoiceData.amount}\n` +
          `📅 Date: ${invoiceData.date || 'Today'}\n\n` +
          `To create this invoice, use:\n` +
          `\`/invoice ${invoiceData.customer} ${invoiceData.amount}\``
        );
      } else {
        await sendMessageWithRateLimit(chatId, '❌ QR code expired or invalid.');
      }
      return;
    }

    // Regular start command
    await sendMessageWithRateLimit(chatId,
      "👋 Welcome!\n\n📋 **Invoice Commands:**\n" +
      "• `/invoice <name> <amount>` - Create invoice\n" +
      "• `/me` - Register this chat/group\n" +
      "• `/status` - Check daily usage\n\n" +
      "👥 **Customer Commands:**\n" +
      "• `/customer <name>` - Get customer details\n" +
      "• `/search <name>` - Search customers\n" +
      "• `/recent` - Show recent customers\n\n" +
      "🔳 **QR Commands:**\n" +
      "• `/qr` - Generate registration QR code\n" +
      "• `/qrbatch <count>` - Generate multiple QR codes"
    );
  } catch (err) {
    console.error('❌ Error in /start:', err.message);
  }
});

// ===============================
// Enhanced /invoice Command
// ===============================
bot.onText(/\/invoice (.+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || 'No username';
  const fullName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  const isGroup = ['group','supergroup'].includes(msg.chat.type);
  const groupId = isGroup ? chatId : null;

  const customer = match[1];
  const amount = parseFloat(match[2]);

  try {
    // Rate limiting checks
    if (isUserRateLimited(userId)) {
      await sendMessageWithRateLimit(chatId, 
        `⏳ Please wait ${Math.ceil(RATE_LIMITS.userCooldown / 1000)} seconds before creating another invoice.`
      );
      return;
    }

    // Daily limit check
    if (!(await checkDailyInvoiceLimit(userId, chatId))) {
      return;
    }

    // Duplicate check
    if (await checkDuplicateInvoice(customer, chatId, amount)) {
      return;
    }

    // Validate amount
    if (amount <= 0 || amount > 1000000) {
      await sendMessageWithRateLimit(chatId, 
        '❌ Invalid amount. Please use a value between $1 and $1,000,000.'
      );
      return;
    }

    // Validate customer name
    if (customer.length < 2 || customer.length > 100) {
      await sendMessageWithRateLimit(chatId, 
        '❌ Invalid customer name. Please use 2-100 characters.'
      );
      return;
    }

    await sendMessageWithRateLimit(chatId, '🔄 Processing invoice...');

    // Check for existing customer data and show history if available
    const existingCustomer = await findCustomer(customer);
    if (existingCustomer && existingCustomer.totalInvoices > 0) {
      const historyMsg = `📊 Customer History:\n` +
        `Previous invoices: ${existingCustomer.totalInvoices}\n` +
        `Average amount: $${existingCustomer.avgAmount}\n` +
        `Last amount: $${existingCustomer.lastAmount}\n` +
        `Last invoice: ${existingCustomer.daysSinceLastInvoice} days ago`;
      await sendMessageWithRateLimit(chatId, historyMsg);
    }

    // Save invoice to DB
    const invoice = new Invoice({
      customer,
      amount,
      chatId,
      userId,
      groupId,
      username,
      status: 'unpaid',
      dueDate: new Date().toISOString().slice(0, 10)
    });
    await invoice.save();

    // Generate invoice PDF
    const invoiceData = {
      customer: invoice.customer,
      amount: invoice.amount,
      invoiceId: invoice._id,
      date: invoice.dueDate
    };
    const invoicePath = await generateInvoice(invoiceData);

    // Send to the current chat
    await sendInvoiceToTelegram(chatId, invoicePath);

    await sendMessageWithRateLimit(chatId, 
      `✅ Invoice saved and sent for ${customer} ($${amount})\n` +
      `📄 File: ${invoiceName}`
    );
    
    console.log(`📤 PDF sent to ${isGroup ? `group ${groupId}` : `user ${userId}`} (${invoiceName})`);

  } catch (err) {
    console.error('❌ Error saving or sending invoice:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to process invoice. Please try again.');
  }
});

// ===============================
// Enhanced /me Command
// ===============================
bot.onText(/\/me/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || 'No username';
  const fullName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
  const isGroup = ['group','supergroup'].includes(msg.chat.type);
  const groupId = isGroup ? chatId : null;
  const groupName = msg.chat.title || `Private-${msg.from.username}`;

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    // Check if this chat/group registered within the last 24 hours
    const lastRegistration = await Invoice.findOne({ chatId, status: 'registered' })
      .sort({ createdAt: -1 });
    const now = new Date();

    if (lastRegistration) {
      const elapsed = now - lastRegistration.createdAt;
      if (elapsed < RATE_LIMITS.registrationCooldown) {
        const remaining = RATE_LIMITS.registrationCooldown - elapsed;
        await sendMessageWithRateLimit(chatId,
          `⏳ /me can be used once every 24h. Try again in ${formatCooldown(remaining)}.`
        );
        return;
      }
    }

    if (!lastRegistration) {
      await new Invoice({
        customer: fullName || 'Unknown',
        amount: 0,
        chatId,
        userId,
        groupId,
        groupName,
        username,
        status: 'registered'
      }).save();
      console.log(`🧾 /me registered: ${fullName} (${groupId})`);
    } else {
      lastRegistration.customer = fullName || lastRegistration.customer || 'Unknown';
      lastRegistration.username = username;
      lastRegistration.groupName = groupName;
      lastRegistration.createdAt = now;
      await lastRegistration.save();
    }

    // Get daily usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyInvoices = await Invoice.countDocuments({
      userId: userId,
      createdAt: { $gte: today }
    });

    // Enhanced concise reply with thank you
    const isNewUser = !lastRegistration;
    const info = isNewUser
      ? `✅ Registered! Thanks for using our bot.\n💬 Chat ID: ${chatId}\n📊 Usage: ${dailyInvoices}/${RATE_LIMITS.dailyInvoiceLimit}`
      : `👋 ${fullName}\n💬 Chat ID: ${chatId}\n📊 Usage: ${dailyInvoices}/${RATE_LIMITS.dailyInvoiceLimit}`;

    await sendMessageWithRateLimit(chatId, info);

  } catch (err) {
    console.error('❌ Failed in /me:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to save your info.');
  }
});

// ===============================
// New /status Command
// ===============================
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyInvoices = await Invoice.countDocuments({
      userId: userId,
      createdAt: { $gte: today }
    });

    const totalInvoices = await Invoice.countDocuments({ userId: userId });
    const unpaidInvoices = await Invoice.countDocuments({ 
      userId: userId, 
      status: 'unpaid' 
    });

    const status = `📊 Your Invoice Status:\n` +
                   `📅 Today: ${dailyInvoices}/${RATE_LIMITS.dailyInvoiceLimit}\n` +
                   `📋 Total: ${totalInvoices}\n` +
                   `💰 Unpaid: ${unpaidInvoices}\n` +
                   `⏱️ Cooldown: ${Math.ceil(RATE_LIMITS.userCooldown / 1000)}s`;

    await sendMessageWithRateLimit(chatId, status);

  } catch (err) {
    console.error('❌ Error in /status:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to get status.');
  }
});

// ===============================
// Customer Lookup Commands
// ===============================
bot.onText(/\/customer (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const searchTerm = match[1].trim();

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    await sendMessageWithRateLimit(chatId, '🔍 Searching for customer...');

    const customer = await findCustomer(searchTerm);
    if (customer) {
      const info = formatCustomerInfo(customer);
      await sendMessageWithRateLimit(chatId, info);
    } else {
      // Try fuzzy search
      const matches = await searchCustomers(searchTerm, 5);
      if (matches.length > 0) {
        let response = `❌ Exact match not found. Similar customers:\n\n`;
        matches.forEach((match, i) => {
          response += `${i + 1}. ${match.customer} - $${match.totalAmount} (${match.totalInvoices} invoices)\n`;
        });
        await sendMessageWithRateLimit(chatId, response);
      } else {
        await sendMessageWithRateLimit(chatId, `❌ No customers found matching "${searchTerm}"`);
      }
    }

  } catch (err) {
    console.error('❌ Error in /customer:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to search for customer.');
  }
});

bot.onText(/\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const searchTerm = match[1].trim();

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    const matches = await searchCustomers(searchTerm, 10);
    if (matches.length > 0) {
      let response = `🔍 Search results for "${searchTerm}":\n\n`;
      matches.forEach((match, i) => {
        response += `${i + 1}. ${match.customer}\n`;
        response += `   💰 $${match.totalAmount} (${match.totalInvoices} invoices)\n`;
        response += `   📅 Last: ${match.daysSinceLastInvoice} days ago\n\n`;
      });
      await sendMessageWithRateLimit(chatId, response);
    } else {
      await sendMessageWithRateLimit(chatId, `❌ No customers found matching "${searchTerm}"`);
    }

  } catch (err) {
    console.error('❌ Error in /search:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to search customers.');
  }
});

bot.onText(/\/recent/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    const recentCustomers = await getAllCustomers(10);
    if (recentCustomers.length > 0) {
      let response = `📋 Recent Customers (last 10):\n\n`;
      recentCustomers.forEach((customer, i) => {
        response += `${i + 1}. ${customer.customer}\n`;
        response += `   💰 Last: $${customer.lastAmount} | Total: $${customer.totalAmount}\n`;
        response += `   📅 ${customer.daysSinceLastInvoice} days ago\n\n`;
      });
      await sendMessageWithRateLimit(chatId, response);
    } else {
      await sendMessageWithRateLimit(chatId, '❌ No customer data found.');
    }

  } catch (err) {
    console.error('❌ Error in /recent:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to get recent customers.');
  }
});

// ===============================
// QR Code Commands
// ===============================
bot.onText(/\/qr/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    if (!isQRCodeAvailable()) {
      await sendMessageWithRateLimit(chatId,
        '❌ QR code generation not available.\n' +
        'Install with: `npm install qrcode`'
      );
      return;
    }

    await sendMessageWithRateLimit(chatId, '🔳 Generating registration QR code...');

    // You need to replace 'YourBotUsername' with your actual bot username
    const botUsername = process.env.BOT_USERNAME || 'InvoiceGeneratorBot'; // Set this in your .env
    const qrData = await generateRegistrationQR(botUsername);

    // Send the QR code image
    await bot.sendPhoto(chatId, qrData.qrPath, {
      caption: `📱 **Registration QR Code**\n\n` +
        `🔗 Scan this QR code to register your chat ID instantly!\n\n` +
        `💡 Or click: ${qrData.registrationUrl}\n\n` +
        `🔑 Token: \`${qrData.token}\``
    });

    console.log(`📱 QR code generated for chat ${chatId}, token: ${qrData.token}`);

  } catch (err) {
    console.error('❌ Error in /qr:', err.message);
    await sendMessageWithRateLimit(chatId,
      '❌ Failed to generate QR code.\n' +
      err.message.includes('not installed') ?
        'Please install: `npm install qrcode`' :
        'Please try again later.'
    );
  }
});

bot.onText(/\/qrbatch (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const count = parseInt(match[1]);

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    if (!isQRCodeAvailable()) {
      await sendMessageWithRateLimit(chatId,
        '❌ QR code generation not available.\n' +
        'Install with: `npm install qrcode`'
      );
      return;
    }

    if (count < 1 || count > 50) {
      await sendMessageWithRateLimit(chatId, '❌ Please specify 1-50 QR codes');
      return;
    }

    await sendMessageWithRateLimit(chatId, `🔳 Generating ${count} QR codes...`);

    const botUsername = process.env.BOT_USERNAME || 'InvoiceGeneratorBot';
    const qrBatch = await generateBatchQR(botUsername, count);

    if (qrBatch.length > 0) {
      let response = `✅ Generated ${qrBatch.length} registration QR codes:\n\n`;
      qrBatch.slice(0, 5).forEach(qr => { // Show first 5 URLs
        response += `🔗 QR ${qr.number}: ${qr.registrationUrl}\n`;
      });

      if (qrBatch.length > 5) {
        response += `\n... and ${qrBatch.length - 5} more QR codes\n`;
      }

      response += `\n📁 Check \`qr-codes/\` folder for PNG files`;

      await sendMessageWithRateLimit(chatId, response);

      // Send first QR code as example
      if (qrBatch[0] && qrBatch[0].qrPath) {
        await bot.sendPhoto(chatId, qrBatch[0].qrPath, {
          caption: `📱 Example: QR Code #1\nToken: \`${qrBatch[0].token}\``
        });
      }
    } else {
      await sendMessageWithRateLimit(chatId, '❌ Failed to generate QR codes');
    }

  } catch (err) {
    console.error('❌ Error in /qrbatch:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to generate QR codes batch');
  }
});

bot.onText(/\/qrinvoice (.+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const customer = match[1];
  const amount = parseFloat(match[2]);

  if (isUserRateLimited(userId)) {
    return;
  }

  try {
    if (!isQRCodeAvailable()) {
      await sendMessageWithRateLimit(chatId,
        '❌ QR code generation not available.\n' +
        'Install with: `npm install qrcode`'
      );
      return;
    }

    await sendMessageWithRateLimit(chatId, '🔳 Generating invoice QR code...');

    const botUsername = process.env.BOT_USERNAME || 'InvoiceGeneratorBot';
    const qrData = await generateInvoiceQR(botUsername, {
      customer,
      amount,
      date: new Date().toISOString().slice(0, 10)
    });

    await bot.sendPhoto(chatId, qrData.qrPath, {
      caption: `📋 **Invoice QR Code**\n\n` +
        `👤 Customer: ${customer}\n` +
        `💰 Amount: $${amount}\n\n` +
        `🔗 Share this QR code with the customer!\n` +
        `When scanned, it will show invoice details.\n\n` +
        `🔑 Token: \`${qrData.token}\``
    });

  } catch (err) {
    console.error('❌ Error in /qrinvoice:', err.message);
    await sendMessageWithRateLimit(chatId, '❌ Failed to generate invoice QR code');
  }
});

// ===============================
// Error Handling
// ===============================
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

// ===============================
// Graceful Shutdown
// ===============================
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down bot...');
  await mongoose.disconnect();
  process.exit(0);
});

console.log('🤖 Enhanced bot started with rate limiting and protection');
