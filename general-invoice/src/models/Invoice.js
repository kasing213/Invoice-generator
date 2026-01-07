const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number }
}, { _id: false });

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: { type: String }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  client: {
    type: clientSchema,
    required: true
  },
  items: {
    type: [invoiceItemSchema],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one item is required'
    }
  },

  // Calculated fields
  subtotal: { type: Number },
  tax: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountRate: { type: Number, default: 0 },
  grandTotal: { type: Number },

  // Status and dates
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  dueDate: { type: Date },
  paidAt: { type: Date },

  // Optional metadata
  notes: { type: String },

  // Payment expectation fields (required for verification)
  bank: { type: String, required: true },
  expectedAccount: { type: String, required: true },
  currency: { type: String, required: true, default: 'USD' },

  // Verification state fields (updated by external OCR service)
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedAt: { type: Date },
  verifiedBy: { type: String },
  verificationNote: { type: String },

  // Reference for external integrations
  externalRef: { type: String }

}, { timestamps: true });

// Auto-generate invoice number before save
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.invoiceNumber = `INV-${year}${month}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

// Calculate totals before save
invoiceSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      item.total = item.quantity * item.unitPrice;
    });
    this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  } else {
    this.subtotal = 0;
  }

  let discountAmount = 0;
  if (this.discountRate > 0) {
    discountAmount = this.subtotal * (this.discountRate / 100);
    this.discount = discountAmount;
  } else if (this.discount > 0) {
    discountAmount = this.discount;
  }

  const taxableAmount = this.subtotal - discountAmount;
  if (this.taxRate > 0) {
    this.tax = taxableAmount * (this.taxRate / 100);
  }

  this.grandTotal = taxableAmount + (this.tax || 0);
  next();
});

// Also calculate on update
invoiceSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();

  if (update.items && update.items.length > 0) {
    update.items.forEach(item => {
      item.total = item.quantity * item.unitPrice;
    });

    update.subtotal = update.items.reduce((sum, item) => sum + item.total, 0);

    let discountAmount = 0;
    if (update.discountRate > 0) {
      discountAmount = update.subtotal * (update.discountRate / 100);
      update.discount = discountAmount;
    } else if (update.discount > 0) {
      discountAmount = update.discount;
    }

    const taxableAmount = update.subtotal - discountAmount;
    if (update.taxRate > 0) {
      update.tax = taxableAmount * (update.taxRate / 100);
    }

    update.grandTotal = taxableAmount + (update.tax || 0);
  }

  next();
});

// Indexes for common queries
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ 'client.name': 'text', 'client.email': 'text' });
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
