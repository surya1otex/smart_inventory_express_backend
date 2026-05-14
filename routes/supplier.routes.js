const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');

// Create a new supplier
router.post('/', supplierController.create);

// Get all suppliers
router.get('/', supplierController.findAll);

// Get a single supplier by id
router.get('/:id', supplierController.findOne);

// Update a supplier
router.put('/:id', supplierController.update);

// Delete a supplier
router.delete('/:id', supplierController.delete);

module.exports = router;
