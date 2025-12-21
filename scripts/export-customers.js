// Export customer data to Excel file
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Invoice = require('../models/invoice');
require('dotenv').config();

// Simple CSV export (can be opened in Excel)
function exportToCSV(data, filename) {
  const headers = ['Customer Name', 'Total Invoices', 'Total Amount', 'Last Invoice Date', 'Chat ID', 'Username', 'Group Name', 'Status'];
  const csvContent = [
    headers.join(','),
    ...data.map(row => [
      `"${row.customer}"`,
      row.totalInvoices,
      row.totalAmount,
      `"${row.lastInvoiceDate}"`,
      row.chatId || 'N/A',
      `"${row.username || 'N/A'}"`,
      `"${row.groupName || 'N/A'}"`,
      `"${row.status || 'Active'}"`
    ].join(','))
  ].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(`✅ CSV exported: ${filename}`);
}

// Export individual invoices
function exportInvoicesToCSV(invoices, filename) {
  const headers = ['Invoice ID', 'Customer', 'Amount', 'Date', 'Due Date', 'Status', 'Chat ID', 'Username', 'Group Name'];
  const csvContent = [
    headers.join(','),
    ...invoices.map(inv => [
      `"${inv._id}"`,
      `"${inv.customer}"`,
      inv.amount,
      `"${new Date(inv.createdAt).toISOString().split('T')[0]}"`,
      `"${inv.dueDate || 'N/A'}"`,
      `"${inv.status}"`,
      inv.chatId || 'N/A',
      `"${inv.username || 'N/A'}"`,
      `"${inv.groupName || 'N/A'}"`
    ].join(','))
  ].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(`✅ Invoices CSV exported: ${filename}`);
}

async function exportCustomerData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    // Get aggregated customer data
    console.log('📊 Aggregating customer data...');
    const customerStats = await Invoice.aggregate([
      {
        $match: {
          status: { $ne: 'registered' }, // Exclude registration entries
          amount: { $gt: 0 } // Only actual invoices
        }
      },
      {
        $group: {
          _id: '$customer',
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          lastInvoiceDate: { $max: '$createdAt' },
          chatId: { $first: '$chatId' },
          username: { $first: '$username' },
          groupName: { $first: '$groupName' },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    // Format the data
    const formattedData = customerStats.map(stat => ({
      customer: stat._id,
      totalInvoices: stat.totalInvoices,
      totalAmount: stat.totalAmount.toFixed(2),
      lastInvoiceDate: new Date(stat.lastInvoiceDate).toISOString().split('T')[0],
      chatId: stat.chatId,
      username: stat.username,
      groupName: stat.groupName,
      avgAmount: stat.avgAmount.toFixed(2)
    }));

    // Export customer summary
    const timestamp = new Date().toISOString().split('T')[0];
    const customerFile = path.join(exportDir, `customers-${timestamp}.csv`);
    exportToCSV(formattedData, customerFile);

    // Get all invoices for detailed export
    console.log('📋 Fetching all invoices...');
    const allInvoices = await Invoice.find({
      status: { $ne: 'registered' },
      amount: { $gt: 0 }
    }).sort({ createdAt: -1 });

    const invoicesFile = path.join(exportDir, `invoices-${timestamp}.csv`);
    exportInvoicesToCSV(allInvoices, invoicesFile);

    // Print summary
    console.log('\n📈 Export Summary:');
    console.log(`📊 Total customers: ${formattedData.length}`);
    console.log(`📋 Total invoices: ${allInvoices.length}`);
    console.log(`💰 Total revenue: $${formattedData.reduce((sum, c) => sum + parseFloat(c.totalAmount), 0).toFixed(2)}`);
    console.log(`📁 Files saved to: ${exportDir}`);

    // Show top customers
    console.log('\n🏆 Top 5 Customers by Revenue:');
    formattedData.slice(0, 5).forEach((customer, i) => {
      console.log(`${i + 1}. ${customer.customer}: $${customer.totalAmount} (${customer.totalInvoices} invoices)`);
    });

  } catch (error) {
    console.error('❌ Export failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔐 Disconnected from MongoDB');
  }
}

// Run the export
exportCustomerData();