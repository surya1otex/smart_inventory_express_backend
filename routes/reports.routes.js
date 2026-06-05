/**
 * Reports routes — mounted at /api/reports
 */

const express = require('express');
const reportsController = require('../controllers/reports.controller');

const router = express.Router();

router.get('/sales', reportsController.getSalesReport);
router.get('/inventory', reportsController.getInventoryReport);
router.get('/gst', reportsController.getGstReport);
router.get('/profit', reportsController.getProfitReport);

module.exports = router;
