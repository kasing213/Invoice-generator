# 📊 Customer Data Export Tool

Export your invoice and customer data to Excel or CSV format for analysis and backup.

## Quick Start

```bash
# Basic CSV export
npm run export:customers

# Enhanced Excel export (requires xlsx package)
npm run export:excel

# Force CSV format
npm run export:csv
```

## Installation for Excel Support

For proper Excel (.xlsx) files with multiple sheets:

```bash
npm install xlsx
```

Then run: `npm run export:excel`

## Export Features

### Customer Summary Export
- **File**: `exports/customers-YYYY-MM-DD.csv`
- **Data**: Customer names, total invoices, revenue, last activity
- **Sorted by**: Total revenue (highest first)

### Enhanced Excel Export
- **File**: `exports/customer-data-YYYY-MM-DD.xlsx`
- **Multiple Sheets**:
  1. **Customer Summary** - Top customers by revenue
  2. **Monthly Stats** - Revenue trends by month
  3. **Recent Invoices** - Last 1000 invoices with details

### Data Included

#### Customer Summary Sheet
- Customer Name
- Total Invoices
- Total Amount ($)
- Average Invoice Amount
- Min/Max Invoice Amounts
- First & Last Invoice Dates
- Chat ID, Username, Group Name

#### Monthly Stats Sheet
- Year/Month breakdown
- Monthly revenue totals
- Invoice counts per month
- Unique customers per month
- Average invoice size

#### Recent Invoices Sheet
- Invoice ID and details
- Customer information
- Amount and dates
- Chat/group information
- Status tracking

## Usage Examples

```bash
# Export customer data to CSV
npm run export:customers

# Export to Excel with multiple sheets
npm run export:excel

# View help and options
node scripts/export-excel.js --help

# Check installation requirements
node scripts/export-excel.js --install
```

## Output Location

All exports are saved to: `exports/` directory

Files are named with timestamps: `customer-data-2024-01-15.xlsx`

## Analytics Included

The export automatically provides:
- 📊 Total customers and invoices
- 💰 Revenue summaries
- 🏆 Top 5 customers by revenue
- 📅 Monthly trends
- 📈 Average invoice amounts

Perfect for business analysis, backup, or importing into other tools like Google Sheets, Power BI, or accounting software.