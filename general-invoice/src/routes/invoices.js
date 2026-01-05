const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateStatus,
  generateInvoicePdf
} = require('../controllers/invoiceController');

// CRUD routes
router.post('/', createInvoice);
router.get('/', getAllInvoices);
router.get('/:id', getInvoiceById);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

// Special operations
router.patch('/:id/status', updateStatus);
router.get('/:id/pdf', generateInvoicePdf);

module.exports = router;
