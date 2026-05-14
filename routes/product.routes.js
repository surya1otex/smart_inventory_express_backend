/**
 * Product Routes
 * Defines all product-related API endpoints
 * 
 * IMPORTANT: Static routes (like /search) must be declared BEFORE dynamic routes (like /:id)
 * to prevent Express from treating "search" as an ID parameter.
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

/**
 * GET /api/products/search
 * Search products by keyword
 * Query params: ?q=keyword or ?query=keyword
 */
router.get('/search', productController.searchProducts);

/**
 * GET /api/products/:productId/batches
 * Get all batches for a specific product
 * IMPORTANT: This route must be declared BEFORE /:id to prevent "batches" from being treated as an ID
 */
router.get('/:productId/batches', productController.getProductBatches);

/**
 * GET /api/products
 * Get all products with optional search and pagination
 */
router.get('/', productController.getAllProducts);

/**
 * GET /api/products/:id
 * Get product by ID
 */
router.get('/:id', productController.getProductById);

/**
 * POST /api/products
 * Create a new product
 */
router.post('/', productController.createProduct);

/**
 * PUT /api/products/:id
 * Update a product
 */
router.put('/:id', productController.updateProduct);

/**
 * DELETE /api/products/:id
 * Delete a product
 */
router.delete('/:id', productController.deleteProduct);

module.exports = router;
