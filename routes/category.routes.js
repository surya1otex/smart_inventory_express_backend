/**
 * Category Routes
 * Defines all category-related API endpoints
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

/**
 * GET /api/categories
 * Get all categories with optional search and pagination
 */
router.get('/', categoryController.findAll);

/**
 * POST /api/categories
 * Create a new category
 */
router.post('/', categoryController.create);

/**
 * GET /api/categories/:id
 * Get category by ID
 */
router.get('/:id', categoryController.findOne);

/**
 * PUT /api/categories/:id
 * Update a category
 */
router.put('/:id', categoryController.update);

/**
 * DELETE /api/categories/:id
 * Delete a category
 */
router.delete('/:id', categoryController.delete);

module.exports = router;

