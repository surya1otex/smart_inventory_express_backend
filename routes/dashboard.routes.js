/**
 * Dashboard routes — mounted at /api/dashboard
 */

const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', dashboardController.getSummary);
router.get('/sales-trend', dashboardController.getSalesTrend);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/recent-sales', dashboardController.getRecentSales);
router.get('/low-stock', dashboardController.getLowStock);
router.get('/expiry-alerts', dashboardController.getExpiryAlerts);

module.exports = router;
