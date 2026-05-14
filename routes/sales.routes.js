const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');

// Save a sale with full inventory handling
// POST /api/sales
router.post('/', salesController.create);

module.exports = router;

