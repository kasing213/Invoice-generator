// Enhanced Excel export with proper .xlsx format
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Invoice = require('../models/invoice');
require('dotenv').config();

// Check if xlsx package is available, if not use CSV fallback
let XLSX;
let useXLSX = true;

try {
  XLSX = require('xlsx');
  console.log('📊 Using XLSX library for Excel export');
} catch (err) {
  useXLSX = false;
  console.log('⚠️  XLSX library not found, using CSV format (run: npm install xlsx)');
}

// CSV fallback function
function exportToCSV(data, filename, sheetName = 'Data') {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(`✅ CSV exported: ${filename}`);
}

// Excel export function
function exportToExcel(data, filename, sheetName = 'Data') {
  if (!useXLSX) {
    exportToCSV(data, filename.replace('.xlsx', '.csv'), sheetName);
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const cols = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  console.log(`✅ Excel file exported: ${filename}`);
}

// Multi-sheet Excel export
function exportMultiSheetExcel(sheets, filename) {
  if (!useXLSX) {
    // Export each sheet as separate CSV
    sheets.forEach(sheet => {
      const csvFilename = filename.replace('.xlsx', `_${sheet.name}.csv`);
      exportToCSV(sheet.data, csvFilename, sheet.name);
    });
    return;
  }

  const wb = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);

    // Auto-size columns
    const cols = Object.keys(sheet.data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  XLSX.writeFile(wb, filename);
  console.log(`✅ Multi-sheet Excel file exported: ${filename}`);
}

async function exportCustomerDataToExcel() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    const timestamp = new Date().toISOString().split('T')[0];

    // 1. Customer Summary Data
    console.log('📊 Generating customer summary...');
    const customerStats = await Invoice.aggregate([
      {
        $match: {
          status: { $ne: 'registered' },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
          firstInvoice: { $min: '$createdAt' },
          lastInvoice: { $max: '$createdAt' },
          chatId: { $first: '$chatId' },
          username: { $first: '$username' },
          groupName: { $first: '$groupName' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    const customerData = customerStats.map(stat => ({
      'Customer Name': stat._id,
      'Total Invoices': stat.totalInvoices,
      'Total Amount ($)': parseFloat(stat.totalAmount.toFixed(2)),
      'Average Amount ($)': parseFloat(stat.avgAmount.toFixed(2)),
      'Min Amount ($)': parseFloat(stat.minAmount.toFixed(2)),
      'Max Amount ($)': parseFloat(stat.maxAmount.toFixed(2)),
      'First Invoice': new Date(stat.firstInvoice).toISOString().split('T')[0],
      'Last Invoice': new Date(stat.lastInvoice).toISOString().split('T')[0],
      'Chat ID': stat.chatId,
      'Username': stat.username || 'N/A',
      'Group Name': stat.groupName || 'Private Chat'
    }));

    // 2. Monthly Revenue Summary
    console.log('📅 Generating monthly summary...');
    const monthlyStats = await Invoice.aggregate([
      {
        $match: {
          status: { $ne: 'registered' },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalRevenue: { $sum: '$amount' },
          totalInvoices: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$customer' }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          totalRevenue: 1,
          totalInvoices: 1,
          uniqueCustomers: { $size: '$uniqueCustomers' }
        }
      },
      {
        $sort: { year: -1, month: -1 }
      }
    ]);

    const monthlyData = monthlyStats.map(stat => ({
      'Year': stat.year,
      'Month': stat.month,
      'Month Name': new Date(stat.year, stat.month - 1).toLocaleDateString('en-US', { month: 'long' }),
      'Total Revenue ($)': parseFloat(stat.totalRevenue.toFixed(2)),
      'Total Invoices': stat.totalInvoices,
      'Unique Customers': stat.uniqueCustomers,
      'Avg Invoice ($)': parseFloat((stat.totalRevenue / stat.totalInvoices).toFixed(2))
    }));

    // 3. Detailed Invoice List (last 1000 invoices)
    console.log('📋 Fetching recent invoices...');
    const recentInvoices = await Invoice.find({
      status: { $ne: 'registered' },
      amount: { $gt: 0 }
    })
    .sort({ createdAt: -1 })
    .limit(1000);

    const invoiceData = recentInvoices.map(inv => ({
      'Invoice ID': inv._id.toString(),
      'Customer': inv.customer,
      'Amount ($)': parseFloat(inv.amount.toFixed(2)),
      'Date': new Date(inv.createdAt).toISOString().split('T')[0],
      'Time': new Date(inv.createdAt).toTimeString().split(' ')[0],
      'Due Date': inv.dueDate || 'N/A',
      'Status': inv.status,
      'Chat ID': inv.chatId,
      'Username': inv.username || 'N/A',
      'Group Name': inv.groupName || 'Private Chat'
    }));

    // Export to single Excel file with multiple sheets
    const filename = path.join(exportDir, `customer-data-${timestamp}.xlsx`);

    exportMultiSheetExcel([
      { name: 'Customer Summary', data: customerData },
      { name: 'Monthly Stats', data: monthlyData },
      { name: 'Recent Invoices', data: invoiceData }
    ], filename);

    // Print summary
    console.log('\n📈 Export Summary:');
    console.log(`👥 Total customers: ${customerData.length}`);
    console.log(`📋 Total invoices exported: ${invoiceData.length}`);
    console.log(`💰 Total revenue: $${customerData.reduce((sum, c) => sum + c['Total Amount ($)'], 0).toFixed(2)}`);
    console.log(`📅 Data spans: ${monthlyData.length} months`);
    console.log(`📁 File saved: ${filename}`);

    // Top customers
    console.log('\n🏆 Top 5 Customers:');
    customerData.slice(0, 5).forEach((customer, i) => {
      console.log(`${i + 1}. ${customer['Customer Name']}: $${customer['Total Amount ($)']} (${customer['Total Invoices']} invoices)`);
    });

  } catch (error) {
    console.error('❌ Export failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔐 Disconnected from MongoDB');
  }
}

// Command line options
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📊 Customer Data Export Tool

Usage: node scripts/export-excel.js [options]

Options:
  --help, -h     Show this help message
  --csv          Force CSV output even if XLSX is available
  --install      Show installation instructions for Excel support

Examples:
  node scripts/export-excel.js
  node scripts/export-excel.js --csv
  `);
  process.exit(0);
}

if (args.includes('--install')) {
  console.log(`
📦 To enable Excel (.xlsx) export support:

npm install xlsx

Then run the export script again.
`);
  process.exit(0);
}

if (args.includes('--csv')) {
  useXLSX = false;
  console.log('📄 Forcing CSV export mode');
}

// Run the export
exportCustomerDataToExcel();