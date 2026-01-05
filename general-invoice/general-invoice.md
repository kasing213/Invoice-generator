# General Invoice API

A standalone REST API service for general invoice management. Designed to be consumed by external applications like `https://facebook-tiktok-automation.vercel.app/`.

## Features

- Full CRUD operations for invoices
- Automatic invoice number generation
- Auto-calculated totals (subtotal, tax, discount, grand total)
- PDF generation with Puppeteer
- Excel and CSV export
- API key authentication
- CORS pre-configured for Vercel app

---

## Quick Start

### 1. Setup Environment

```bash
cd general-invoice
cp .env.general.example .env.general
```

Edit `.env.general`:

```env
PORT=3001
NODE_ENV=development
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/general_invoices
API_KEYS=your-secret-api-key
ALLOWED_ORIGINS=https://facebook-tiktok-automation.vercel.app
INVOICE_DIR=./invoices
DEFAULT_CURRENCY=USD
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### 4. Run with Docker

```bash
docker-compose up --build
```

---

## API Reference

Base URL: `http://localhost:3001`

### Authentication

All `/api/*` endpoints require the `X-API-KEY` header:

```bash
curl -H "X-API-KEY: your-secret-api-key" http://localhost:3001/api/invoices
```

---

### Endpoints

#### Health Check (No Auth)

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "general-invoice-api",
  "timestamp": "2026-01-05T10:00:00.000Z",
  "uptime": 123.456
}
```

---

#### Create Invoice

```
POST /api/invoices
```

Request Body:
```json
{
  "client": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, Country"
  },
  "items": [
    {
      "description": "Web Development",
      "quantity": 10,
      "unitPrice": 100
    },
    {
      "description": "Hosting (Monthly)",
      "quantity": 1,
      "unitPrice": 50
    }
  ],
  "taxRate": 10,
  "discountRate": 5,
  "dueDate": "2026-02-05",
  "notes": "Payment due within 30 days",
  "currency": "USD"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "invoiceNumber": "INV-2601-00001",
    "client": {...},
    "items": [...],
    "subtotal": 1050,
    "discount": 52.5,
    "tax": 99.75,
    "grandTotal": 1097.25,
    "status": "draft",
    "createdAt": "2026-01-05T10:00:00.000Z"
  }
}
```

---

#### List Invoices

```
GET /api/invoices
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `draft`, `sent`, `paid`, `overdue`, `cancelled` |
| `search` | string | Search in client name, email, or invoice number |
| `fromDate` | date | Filter invoices created after this date |
| `toDate` | date | Filter invoices created before this date |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `sortBy` | string | Sort field (default: `createdAt`) |
| `sortOrder` | string | `asc` or `desc` (default: `desc`) |

Example:
```
GET /api/invoices?status=paid&page=1&limit=10&sortBy=grandTotal&sortOrder=desc
```

Response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  }
}
```

---

#### Get Single Invoice

```
GET /api/invoices/:id
```

---

#### Update Invoice

```
PUT /api/invoices/:id
```

Request Body: Same as create (partial updates allowed)

---

#### Delete Invoice

```
DELETE /api/invoices/:id
```

---

#### Update Status Only

```
PATCH /api/invoices/:id/status
```

Request Body:
```json
{
  "status": "paid"
}
```

Valid statuses: `draft`, `sent`, `paid`, `overdue`, `cancelled`

---

#### Generate PDF

```
GET /api/invoices/:id/pdf
GET /api/invoices/:id/pdf?download=true
```

Returns PDF file. Add `?download=true` to force download instead of inline display.

---

#### Export to Excel

```
GET /api/export/excel
GET /api/export/excel?status=paid&fromDate=2026-01-01&toDate=2026-12-31
```

Downloads `.xlsx` file with all invoices and summary sheet.

---

#### Export to CSV

```
GET /api/export/csv
GET /api/export/csv?status=unpaid
```

Downloads `.csv` file with all invoices.

---

## Invoice Model

```javascript
{
  invoiceNumber: String,        // Auto-generated: INV-YYMM-00001
  client: {
    name: String,               // Required
    email: String,
    phone: String,
    address: String
  },
  items: [{
    description: String,        // Required
    quantity: Number,           // Required
    unitPrice: Number,          // Required
    total: Number               // Auto-calculated
  }],
  subtotal: Number,             // Auto-calculated
  tax: Number,                  // Auto-calculated if taxRate set
  taxRate: Number,              // Percentage (e.g., 10 = 10%)
  discount: Number,             // Auto-calculated if discountRate set
  discountRate: Number,         // Percentage
  grandTotal: Number,           // Auto-calculated
  status: String,               // draft|sent|paid|overdue|cancelled
  dueDate: Date,
  paidAt: Date,                 // Set automatically when status = paid
  notes: String,
  currency: String,             // Default: USD
  externalRef: String,          // For external system references
  createdAt: Date,
  updatedAt: Date
}
```

---

## Example Usage from Vercel App

```javascript
const API_URL = 'https://your-general-invoice-api.com';
const API_KEY = 'your-api-key';

// Create invoice
const response = await fetch(`${API_URL}/api/invoices`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY
  },
  body: JSON.stringify({
    client: {
      name: 'Customer Name',
      email: 'customer@example.com'
    },
    items: [
      { description: 'Service', quantity: 1, unitPrice: 100 }
    ]
  })
});

const { data: invoice } = await response.json();
console.log(invoice.invoiceNumber); // INV-2601-00001

// Get PDF
const pdfUrl = `${API_URL}/api/invoices/${invoice._id}/pdf?download=true`;
```

---

## Docker Deployment

### Build and Run

```bash
docker-compose up --build -d
```

### View Logs

```bash
docker-compose logs -f general-invoice-api
```

### Stop

```bash
docker-compose down
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `MONGO_URL` | Yes | - | MongoDB connection string |
| `API_KEYS` | Yes | - | Comma-separated API keys |
| `ALLOWED_ORIGINS` | No | - | Additional CORS origins |
| `INVOICE_DIR` | No | ./invoices | PDF output directory |
| `DEFAULT_CURRENCY` | No | USD | Default currency code |

---

## Project Structure

```
general-invoice/
├── src/
│   ├── server.js              # Entry point
│   ├── config/db.js           # MongoDB connection
│   ├── controllers/
│   │   ├── invoiceController.js
│   │   └── exportController.js
│   ├── middleware/
│   │   ├── auth.js            # API key validation
│   │   ├── cors.js            # CORS configuration
│   │   └── errorHandler.js
│   ├── models/Invoice.js      # Mongoose schema
│   ├── routes/
│   │   ├── index.js
│   │   ├── invoices.js
│   │   └── export.js
│   ├── templates/invoice.html # PDF template
│   └── utils/
│       ├── formatData.js
│       ├── generatePdf.js
│       └── renderTemplate.js
├── invoices/                  # Generated PDFs
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.general.example
└── .gitignore
```
