const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  customer: { type: String, required: true },
  oldMeter: Number,
  newMeter: Number,
  usage: Number,
  amount: { type: Number, required: true },

  // IDs
  chatId: { type: Number, required: true },
  username: { type: String, default: 'No username' },

  // Grouping
  groupName: { type: String, default: null }, // ✅ Added for grouping invoices

  // Status and tracking
  status: { type: String, default: 'unpaid' },
  dueDate: { type: String }, // or auto-calculate from createdAt
  invoiceNumber: { type: String }, // optional but useful
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
