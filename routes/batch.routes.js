/**
 * Batch Routes — mounted at /api/batches
 */

const express = require('express');
const batchController = require('../controllers/batch.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verifyToken);

router.get('/barcode/:barcode', batchController.getByBarcode);

module.exports = router;
