# Invoice Generator Project Understanding

## Overview
This is a **Telegram Bot-based Invoice Generator** that allows users to create, manage, and distribute PDF invoices through Telegram. The system uses Node.js, MongoDB, Puppeteer for PDF generation, and Handlebars for templating.

## Core Architecture

### Main Components
1. **Telegram Bot Interface** (`src/bot.js`) - Primary entry point and user interaction
2. **PDF Generation System** (`src/generateInvoice.js`) - Converts data to PDF using Puppeteer
3. **Telegram Delivery** (`src/sendtelegram.js`) - Handles PDF file transmission
4. **Database Models** (`models/`) - MongoDB schemas and data management
5. **Template System** (`templates/`, `utils/`) - Handlebars-based invoice rendering

### Key Features
- **Multi-language Support**: Primarily Khmer/Cambodian language interface
- **Rate Limiting**: Built-in protection against spam (5-second cooldowns, daily limits)
- **Group Support**: Works in both private chats and Telegram groups
- **Duplicate Prevention**: Prevents identical invoices within 1-hour windows
- **Retry Logic**: Automatic retry for failed operations with exponential backoff

## File Structure Analysis

```
├── src/
│   ├── bot.js              # Main Telegram bot logic with rate limiting
│   ├── generateInvoice.js  # PDF generation using Puppeteer
│   ├── sendtelegram.js     # Telegram file delivery with retry logic
│   ├── fullAuto.js         # Batch processing from Excel/MongoDB
│   └── excelToMongo.js     # Excel import functionality
├── models/
│   ├── invoice.js          # MongoDB schema for invoices
│   ├── excelReading.js     # Schema for Excel imports
│   ├── backfill.js         # Data migration utilities
│   └── resend_failed.js    # Failed delivery retry system
├── templates/
│   └── invoice.html        # Handlebars template (Khmer/bilingual)
├── utils/
│   ├── renderTemplate.js   # Handlebars compilation and rendering
│   ├── formatInvoiceData.js # Data formatting for templates
│   ├── logger.js           # Logging utilities
│   └── testMode.js         # Testing configurations
├── invoices/               # Generated PDF storage
│   └── .debug/            # HTML debug files
└── assets/                 # Static resources (fonts, images)
```

## Technical Stack

### Dependencies
- **Runtime**: Node.js with ES6+ features
- **Database**: MongoDB with Mongoose ODM
- **Bot Framework**: `node-telegram-bot-api`
- **PDF Generation**: Puppeteer (headless Chrome)
- **Templating**: Handlebars.js
- **HTTP**: Axios for API calls
- **File System**: fs-extra for enhanced file operations

### Environment Variables
- `MONGO_URL`: MongoDB connection string
- `TELEGRAM_BOT_TOKEN`: Bot authentication token
- `QR_IMAGE_PATH`: Path for QR code images
- `CLAUDE_API`: AI service integration (likely for enhanced features)

## Bot Commands

### User Commands
- `/start` - Welcome message and command overview
- `/invoice <name> <amount>` - Create new invoice
- `/me` - Register user/group and show user info
- `/status` - Display usage statistics and limits

### Rate Limiting & Protection
- **User Cooldown**: 5 seconds between requests per user
- **Daily Limits**: 1000 invoices per user per day
- **Message Throttling**: 200ms delay between bot messages
- **Global Rate Limiting**: Max 30 messages/second
- **Duplicate Prevention**: 1-hour window for identical invoices

## Database Schema

### Invoice Model (`models/invoice.js`)
```javascript
{
  customer: String (required),
  oldMeter: Number,
  newMeter: Number,
  usage: Number,
  amount: Number (required),
  chatId: Number (required),
  userId: Number,
  groupId: Number,
  username: String,
  groupName: String,
  status: String (default: 'unpaid'),
  dueDate: String,
  invoiceNumber: String,
  createdAt: Date
}
```

## PDF Generation Process

1. **Data Formatting** (`utils/formatInvoiceData.js`)
   - Processes invoice data for template consumption
   - Handles number formatting and localization

2. **Template Rendering** (`utils/renderTemplate.js`)
   - Compiles Handlebars template with invoice data
   - Supports Khmer language formatting helpers

3. **PDF Creation** (`src/generateInvoice.js`)
   - Launches headless Chrome via Puppeteer
   - Renders HTML to A4 PDF with print backgrounds
   - Saves to `/invoices/` directory

4. **Debug Output**
   - HTML versions saved to `/invoices/.debug/`
   - Helps with template debugging

## Telegram Integration

### Message Flow
1. User sends `/invoice` command
2. Bot validates input and rate limits
3. Invoice saved to MongoDB
4. PDF generated via Puppeteer
5. PDF sent to Telegram chat
6. Confirmation message sent

### Error Handling
- Telegram API rate limits (429 errors) with automatic retry
- File upload failures with exponential backoff
- Database connection retry logic
- Graceful shutdown on SIGINT

## Special Features

### Multi-Language Support
- Primary interface in Khmer (Cambodian)
- Uses Khmer OS font family
- Bilingual invoice templates

### Batch Processing (`src/fullAuto.js`)
- Processes multiple invoices from MongoDB
- Automated PDF generation and Telegram delivery
- Configurable delays and retry logic

### Excel Integration
- Import invoice data from Excel files
- Convert spreadsheet data to MongoDB documents
- Batch processing capabilities

## Development & Operations

### Scripts (package.json)
- `npm start` - Run production bot
- `npm run dev` - Development with nodemon
- No test suite currently configured

### Monitoring & Debugging
- Comprehensive console logging with emojis
- Debug HTML output for template troubleshooting
- Error tracking and retry mechanisms
- User activity monitoring

## Security Considerations

### Implemented Protections
- Rate limiting prevents spam/abuse
- Input validation for amounts and customer names
- Duplicate detection prevents accidental reprocessing
- Graceful error handling without exposing internals

### Potential Concerns
- Environment variables contain sensitive credentials
- No authentication beyond Telegram user IDs
- Direct database access without additional auth layers
- File system access for PDF storage

## Deployment Context
- Appears designed for WSL2/Linux environment
- Uses absolute Windows paths in some configurations
- Intended for single-bot deployment model
- No containerization or scaling considerations apparent

## Future Enhancement Opportunities
1. **Testing**: No test suite currently exists
2. **CI/CD**: No automated deployment pipeline
3. **Monitoring**: Could benefit from structured logging/metrics
4. **Scalability**: Single-process architecture may need scaling
5. **Security**: Additional authentication and input validation
6. **Documentation**: API documentation and user guides