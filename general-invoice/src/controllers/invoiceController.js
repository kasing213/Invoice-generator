const Invoice = require('../models/Invoice');
const generatePdf = require('../utils/generatePdf');
const { formatInvoiceForTemplate } = require('../utils/formatData');
const path = require('path');
const fs = require('fs-extra');

/**
 * Create a new invoice
 * POST /api/invoices
 */
const createInvoice = async (req, res, next) => {
  try {
    const invoiceData = req.body;

    // Set default due date if not provided (30 days from now)
    if (!invoiceData.dueDate) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      invoiceData.dueDate = dueDate;
    }

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all invoices with filtering and pagination
 * GET /api/invoices
 */
const getAllInvoices = async (req, res, next) => {
  try {
    const {
      status,
      verificationStatus,
      search,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }

    if (search) {
      query.$or = [
        { 'client.name': { $regex: search, $options: 'i' } },
        { 'client.email': { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.createdAt.$lte = new Date(toDate);
      }
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Invoice.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single invoice by ID
 * GET /api/invoices/:id
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice
 * PUT /api/invoices/:id
 */
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Don't allow updating paid invoices (unless changing status)
    if (invoice.status === 'paid' && !req.body.status) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify a paid invoice. Change status first.'
      });
    }

    // Update fields
    const allowedFields = [
      'client', 'items', 'tax', 'taxRate', 'discount', 'discountRate',
      'status', 'dueDate', 'notes', 'currency', 'externalRef',
      'bank', 'expectedAccount'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    // If status changed to paid, set paidAt
    if (req.body.status === 'paid' && invoice.status !== 'paid') {
      invoice.paidAt = new Date();
    }

    await invoice.save();

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete invoice
 * DELETE /api/invoices/:id
 */
const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice status only
 * PATCH /api/invoices/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updateData = { status };

    // Set paidAt when marking as paid
    if (status === 'paid') {
      updateData.paidAt = new Date();
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify invoice payment (called by external OCR service)
 * PATCH /api/invoices/:id/verify
 */
const verifyInvoice = async (req, res, next) => {
  try {
    const { verificationStatus, verifiedBy, verificationNote } = req.body;

    if (!verificationStatus) {
      return res.status(400).json({
        success: false,
        error: 'verificationStatus is required'
      });
    }

    const validStatuses = ['pending', 'verified', 'rejected'];
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid verificationStatus. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updateData = {
      verificationStatus,
      verifiedAt: new Date()
    };

    if (verifiedBy) {
      updateData.verifiedBy = verifiedBy;
    }

    if (verificationNote) {
      updateData.verificationNote = verificationNote;
    }

    // If verified, also mark invoice as paid
    if (verificationStatus === 'verified') {
      updateData.status = 'paid';
      updateData.paidAt = new Date();
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate and download PDF for invoice
 * GET /api/invoices/:id/pdf
 */
const generateInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Format data for template
    const templateData = formatInvoiceForTemplate(invoice);

    // Generate PDF
    const pdfPath = await generatePdf(templateData);

    // Check if download requested
    const download = req.query.download === 'true';

    if (download) {
      res.download(pdfPath, `${invoice.invoiceNumber}.pdf`, (err) => {
        if (err) {
          next(err);
        }
      });
    } else {
      // Return PDF inline
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateStatus,
  verifyInvoice,
  generateInvoicePdf
};
