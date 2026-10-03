const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

// Save a sale with full inventory handling
// POST /api/sales
router.post('/', salesController.create);

module.exports = router;

