# 📱 QR Code Registration System

Automatically capture chat IDs and user information through QR code scanning!

## 🚀 Quick Setup

### 1. Install QR Code Library
```bash
npm install qrcode
```

### 2. Set Bot Username
Add to your `.env` file:
```bash
BOT_USERNAME=YourBotUsername  # Without @ symbol
```

### 3. Test QR Generation
```bash
node scripts/test-qr.js
```

## 📋 QR Commands

### Registration QR Codes
```bash
# Generate single registration QR
/qr

# Generate multiple QR codes (1-50)
/qrbatch 10

# Generate invoice-specific QR
/qrinvoice "Customer Name" 150
```

## 🔄 How It Works

### For Registration:
1. **Admin runs** `/qr` or `/qrbatch 10`
2. **Bot generates** QR code(s) with unique tokens
3. **Users scan** QR code with their phone
4. **Telegram opens** with your bot and registration token
5. **User presses** "START" button
6. **Bot automatically** captures their:
   - Chat ID
   - User ID
   - Full name
   - Username
   - Group info (if in group)

### For Invoice Sharing:
1. **Create invoice QR** with `/qrinvoice "John Doe" 250`
2. **Share QR** with customer
3. **Customer scans** → sees invoice details
4. **They can start** bot and create invoice

## 📱 QR Code Types

### Registration QR Codes
- **Purpose**: Capture user chat IDs automatically
- **Format**: `https://t.me/YourBot?start=register_TOKEN`
- **Result**: User gets registered instantly when they scan and start bot

### Invoice QR Codes
- **Purpose**: Share invoice information
- **Format**: `https://t.me/YourBot?start=invoice_TOKEN`
- **Result**: Shows invoice details and command to create it

## 🗂️ File Organization

```
qr-codes/
├── registration_abc123.png     # Single QR codes
├── registration_def456.png
└── batch_1672531200_summary.txt # Batch summary

temp/
├── invoice_xyz789.json         # Temporary invoice data
└── (auto-cleaned after 24h)
```

## 💡 Usage Scenarios

### Event Registration
1. Generate 50 QR codes: `/qrbatch 50`
2. Print QR codes on flyers/posters
3. People scan → instant registration
4. You get all their chat IDs automatically

### Invoice Distribution
1. Create invoice QR: `/qrinvoice "ABC Corp" 1500`
2. Send QR to customer via email/WhatsApp
3. Customer scans → sees invoice details
4. They can interact with your bot directly

### Group Registration
1. Post QR code in group chat
2. Members scan → register their private chat
3. Bot can now send them direct messages
4. Maintain group + private communication

## ⚙️ Configuration

### Environment Variables
```bash
# Required
BOT_USERNAME=YourBotUsername    # Your bot's username
TELEGRAM_BOT_TOKEN=your_token   # Your bot token

# Optional
QR_BATCH_LIMIT=50              # Max QR codes in batch (default: 50)
QR_TOKEN_EXPIRY=24             # Hours before tokens expire (default: 24)
```

### Security Features
- **Unique tokens** for each QR code
- **24-hour expiry** on invoice QR codes
- **Auto-cleanup** of expired data
- **Rate limiting** applies to QR commands

## 🔧 Advanced Usage

### Custom QR Code Styling
Edit `utils/qrGenerator.js` to customize:
- QR code colors
- Size and margin
- Error correction level
- Logo overlay (requires additional setup)

### Batch Operations
```javascript
// Generate QR codes programmatically
const { generateBatchQR } = require('./utils/qrGenerator');

const qrCodes = await generateBatchQR('YourBot', 100);
// Process qrCodes array...
```

## 📊 Tracking & Analytics

The system automatically logs:
- QR code generation events
- Registration success/failures
- Token usage and expiry
- User registration source (QR vs manual)

Check console logs and database for full tracking.

## 🚨 Troubleshooting

### "QR code generation not available"
**Solution**: `npm install qrcode`

### "Bot username not set"
**Solution**: Add `BOT_USERNAME=YourBot` to `.env`

### QR codes not working
**Checklist**:
1. Bot username is correct (without @)
2. Bot is running and accessible
3. QR code hasn't expired (24h limit for invoices)
4. User has Telegram installed

## 🎯 Benefits

✅ **No manual chat ID collection**
✅ **Instant user registration**
✅ **Works for groups and private chats**
✅ **Scalable for events/marketing**
✅ **Professional invoice sharing**
✅ **Automatic data capture**

Perfect for streamlining user onboarding and making your invoice bot more accessible!