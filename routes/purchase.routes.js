const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');

// Get all purchases
router.get('/', purchaseController.getAll);

// Get a single purchase by ID
router.get('/:id', purchaseController.getById);

// Create a new purchase entry
router.post('/', purchaseController.create);

module.exports = router;

