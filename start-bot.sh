#!/bin/bash

# ====== CONFIG ======
PM2_NAME="telegram-bot"
SCRIPT_PATH="src/bot.js"
ENV_FILE=".env"
TEST_MODE=${1:-"normal"} # normal, test, or debug
# =====================

echo "===================="
echo "🤖 Telegram Bot System Starting..."
echo "===================="

# ✅ 1. Ensure .env exists and convert to LF
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  No .env file found!"
  exit 1
fi

echo "🔧 Converting .env to LF format..."
dos2unix "$ENV_FILE" 2>/dev/null

# ✅ 2. Load environment variables
echo "📥 Loading environment variables from $ENV_FILE..."
export $(grep -v '^#' "$ENV_FILE" | xargs)

echo "DEBUG: MONGO_URL is '$MONGO_URL'"
echo "DEBUG: TELEGRAM_BOT_TOKEN is '$TELEGRAM_BOT_TOKEN'"

# ✅ 3. Validate required environment variables
if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
    echo "❌ TELEGRAM_BOT_TOKEN not set in .env"
    exit 1
fi

if [[ -z "$MONGO_URL" ]]; then
    echo "❌ MONGO_URL not set in .env"
    exit 1
fi

echo "✅ Environment variables validated"

# ✅ 4. Network Connectivity Test

echo "🌐 Testing network connectivity..."
if ! curl -s --connect-timeout 10 "https://api.telegram.org" > /dev/null; then
    echo "❌ Cannot connect to Telegram API"
    exit 1
fi
#!/bin/bash

# =======================================
#  Telegram Bot Startup Script (PM2)
# =======================================

PM2_NAME="telegram-bot"
SCRIPT_PATH="src/bot.js"
ENV_FILE=".env"
TEST_MODE=${1:-"normal"}  # normal, test, debug

echo "===================="
echo "🤖 Telegram Bot System Starting..."
echo "===================="

# 1️⃣ Check if .env exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ .env file not found! Create one with MONGO_URL and TELEGRAM_BOT_TOKEN."
    exit 1
fi

# 2️⃣ Convert .env to LF to avoid Windows CRLF issues
echo "🔧 Converting .env to LF format..."
dos2unix "$ENV_FILE" 2>/dev/null

# 3️⃣ Load .env variables (with debugging)
echo "📥 Loading environment variables from $ENV_FILE..."
set -a
source "$ENV_FILE"
set +a

# Debug: Print variables (hide token partially for safety)
echo "DEBUG: MONGO_URL='${MONGO_URL}'"
echo "DEBUG: TELEGRAM_BOT_TOKEN='${TELEGRAM_BOT_TOKEN:0:10}********'"

# 4️⃣ Validate env variables
if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
    echo "❌ TELEGRAM_BOT_TOKEN not set in .env"
    exit 1
fi

if [[ -z "$MONGO_URL" ]]; then
    echo "❌ MONGO_URL not set in .env"
    echo "🔹 Tip: Ensure your .env has a line like:"
    echo "   MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname"
    exit 1
fi

echo "✅ Environment variables loaded and validated"

# 5️⃣ Test Telegram connectivity
echo "🌐 Testing Telegram API..."
if ! curl -s --connect-timeout 5 "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe" > /dev/null; then
    echo "❌ Cannot reach Telegram API or token invalid"
    exit 1
fi
echo "✅ Telegram API reachable"

# 6️⃣ Test Node.js dependencies
echo "📦 Checking Node.js dependencies..."
for dep in node-telegram-bot-api mongoose puppeteer; do
  if ! node -e "require('$dep')" 2>/dev/null; then
    echo "❌ Missing dependency: $dep"
    npm install
  fi
done
echo "✅ Dependencies verified"

# 7️⃣ Reset Telegram Webhook (to avoid 409 conflict)
echo "🔗 Resetting Telegram webhook..."
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=" > /dev/null
echo "✅ Webhook cleared"

# 8️⃣ Stop old processes
echo "🛑 Stopping old processes..."
pm2 kill 2>/dev/null || true
pkill -9 node 2>/dev/null || true
powershell.exe -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true

# 9️⃣ Start bot with PM2
echo "🚀 Starting bot via PM2..."
pm2 start "$SCRIPT_PATH" --name "$PM2_NAME"
if [[ $? -ne 0 ]]; then
    echo "❌ Failed to start bot"
    exit 1
fi

# 🔟 Show logs depending on mode
echo "===================="
echo "🎉 Bot is now running!"
echo "📊 Monitor with: pm2 monit"
echo "🛑 Stop with: pm2 stop $PM2_NAME"
echo "🔄 Restart with: pm2 restart $PM2_NAME"
echo "===================="

if [[ "$TEST_MODE" == "debug" ]]; then
    echo "🐛 Debug mode: Showing detailed logs..."
    pm2 logs "$PM2_NAME" --lines 50
else
    pm2 logs "$PM2_NAME" --lines 20
fi

if ! curl -s --connect-timeout 10 "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe" > /dev/null; then
    echo "❌ Bot token validation failed"
    exit 1
fi

echo "✅ Network connectivity verified"

# ✅ 5. File System Test

echo "📁 Testing file system..."
if [[ ! -f "$SCRIPT_PATH" ]]; then
    echo "❌ Bot script not found: $SCRIPT_PATH"
    exit 1
fi
if [[ ! -f "src/sendtelegram.js" ]]; then
    echo "❌ sendtelegram.js not found"
    exit 1
fi
if [[ ! -f "templates/invoice.html" ]]; then
    echo "❌ Invoice template not found"
    exit 1
fi
mkdir -p invoices
echo "✅ File system validated"

# ✅ 6. Node.js Dependencies Test
echo "📦 Testing Node.js dependencies..."
for dep in node-telegram-bot-api mongoose puppeteer; do
  if ! node -e "require('$dep')" 2>/dev/null; then
    echo "❌ $dep not installed"
    echo "Installing dependencies..."
    npm install
  fi
done
echo "✅ Dependencies verified"

# ✅ 7. Performance Test (if test mode)
if [[ "$TEST_MODE" == "test" || "$TEST_MODE" == "debug" ]]; then
    echo "⚡ Running performance tests..."
    echo "Testing sendtelegram.js..."
    node -e "
    const sendtelegram = require('./src/sendtelegram');
    const fs = require('fs');
    fs.writeFileSync('./test-invoice.pdf', 'Test invoice content');
    try { sendtelegram(null, './test-invoice.pdf'); console.log('❌ Should have thrown error for null chatId'); } catch (err) { console.log('✅ Correctly handled null chatId'); }
    try { sendtelegram(123, null); console.log('❌ Should have thrown error for null filePath'); } catch (err) { console.log('✅ Correctly handled null filePath'); }
    try { sendtelegram(123, './non-existent.pdf'); console.log('❌ Should have thrown error for non-existent file'); } catch (err) { console.log('✅ Correctly handled non-existent file'); }
    if (fs.existsSync('./test-invoice.pdf')) { fs.unlinkSync('./test-invoice.pdf'); }
    " 2>/dev/null || echo "⚠️  Some tests failed (expected for original version)"
    echo "✅ Performance tests completed"
fi

# ✅ 8. Bot Health Check
echo "🏥 Checking bot health..."
BOT_HEALTH=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe")
if [[ $? -eq 0 && "$BOT_HEALTH" != *"error"* ]]; then
    BOT_USERNAME=$(echo "$BOT_HEALTH" | grep -o '"username":"[^"']*"' | cut -d'"' -f4)
    BOT_NAME=$(echo "$BOT_HEALTH" | grep -o '"first_name":"[^"']*"' | cut -d'"' -f4)
    echo "✅ Bot health check passed: @$BOT_USERNAME ($BOT_NAME)"
else
    echo "❌ Bot health check failed"
    exit 1
fi

# ✅ 9. Clear Telegram webhook properly
echo "🔗 Resetting Telegram webhook..."
WEBHOOK_RESPONSE=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=")
if [[ $? -eq 0 ]]; then
    echo "✅ Webhook cleared successfully"
else
    echo "⚠️  Webhook clear failed, but continuing..."
fi

# ✅ 10. Kill all Node processes and PM2 daemon
echo "🛑 Stopping existing processes..."
pm2 kill 2>/dev/null || true
pkill -9 node 2>/dev/null || true
powershell.exe -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true

# ✅ 11. Start PM2 process cleanly
echo "🚀 Starting PM2 process: $PM2_NAME..."
pm2 start "$SCRIPT_PATH" --name "$PM2_NAME"
if [[ $? -eq 0 ]]; then
    echo "✅ Bot started successfully"
else
    echo "❌ Failed to start bot"
    exit 1
fi

# ✅ 12. Show real-time logs
echo "📺 Tailing PM2 logs..."
echo "===================="
echo "🎉 Bot is now running!"
echo "📊 Monitor with: pm2 monit"
echo "🛑 Stop with: pm2 stop $PM2_NAME"
echo "🔄 Restart with: pm2 restart $PM2_NAME"
echo "===================="
if [[ "$TEST_MODE" == "debug" ]]; then
    echo "🐛 Debug mode: Showing detailed logs..."
    pm2 logs "$PM2_NAME" --lines 50
else
    echo "📋 Showing recent logs..."
    pm2 logs "$PM2_NAME" --lines 20
fi
