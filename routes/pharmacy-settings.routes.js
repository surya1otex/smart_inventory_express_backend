/**
 * Pharmacy settings routes — mounted at /api/settings
 */

const express = require('express');
const router = express.Router();
const pharmacySettingsController = require('../controllers/pharmacy-settings.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/pharmacy', verifyToken, pharmacySettingsController.get);
router.put('/pharmacy', verifyToken, pharmacySettingsController.save);

module.exports = router;
