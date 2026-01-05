const Invoice = require('../models/Invoice');
const XLSX = require('xlsx');
const { formatInvoiceForExport } = require('../utils/formatData');

/**
 * Export invoices to Excel
 * GET /api/export/excel
 */
const exportToExcel = async (req, res, next) => {
  try {
    const { status, fromDate, toDate } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    // Fetch invoices
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No invoices found matching criteria'
      });
    }

    // Format data for export
    const data = invoices.map(formatInvoiceForExport);

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Main invoices sheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

    // Summary sheet
    const summary = {
      'Total Invoices': invoices.length,
      'Total Amount': invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
      'Paid Invoices': invoices.filter(inv => inv.status === 'paid').length,
      'Unpaid Invoices': invoices.filter(inv => inv.status !== 'paid').length,
      'Draft': invoices.filter(inv => inv.status === 'draft').length,
      'Sent': invoices.filter(inv => inv.status === 'sent').length,
      'Overdue': invoices.filter(inv => inv.status === 'overdue').length,
      'Cancelled': invoices.filter(inv => inv.status === 'cancelled').length,
      'Export Date': new Date().toISOString()
    };

    const summaryData = Object.entries(summary).map(([key, value]) => ({
      Metric: key,
      Value: value
    }));

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers and send
    const filename = `invoices-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    next(error);
  }
};

/**
 * Export invoices to CSV
 * GET /api/export/csv
 */
const exportToCsv = async (req, res, next) => {
  try {
    const { status, fromDate, toDate } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    // Fetch invoices
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No invoices found matching criteria'
      });
    }

    // Format data for export
    const data = invoices.map(formatInvoiceForExport);

    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma or quote
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ];

    const csv = csvRows.join('\n');

    // Set headers and send
    const filename = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportToExcel,
  exportToCsv
};
