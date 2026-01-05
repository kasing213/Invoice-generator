const express = require('express');
const router = express.Router();
const {
  exportToExcel,
  exportToCsv
} = require('../controllers/exportController');

router.get('/excel', exportToExcel);
router.get('/csv', exportToCsv);

module.exports = router;
