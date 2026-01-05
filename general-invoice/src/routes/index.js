const express = require('express');
const router = express.Router();

const invoiceRoutes = require('./invoices');
const exportRoutes = require('./export');

router.use('/invoices', invoiceRoutes);
router.use('/export', exportRoutes);

module.exports = router;
