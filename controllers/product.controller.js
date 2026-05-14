/**
 * Product Controller
 * Handles HTTP requests and responses for product operations
 */

const productService = require('../services/product.service');
const { validateCreateProduct } = require('../validations/product.validation');
const { pool } = require('../config/db');

/**
 * Get all products with optional search and pagination
 * GET /api/products
 */
const getAllProducts = async (req, res, next) => {
  try {
    const { search, page, limit, category_id } = req.query;
    
    const result = await productService.findAll({ search, page, limit, category_id });
    res.json(result);
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching products',
      data: null
    });
  }
};

/**
 * Search products by keyword
 * GET /api/products/search?q=keyword or ?query=keyword
 */
const searchProducts = async (req, res, next) => {
  console.log('🔍 searchProducts route hit!', { query: req.query });
  try {
    // Support both 'q' and 'query' parameters (frontend uses 'query')
    const searchTerm = req.query.q || req.query.query;
    
    if (!searchTerm || !searchTerm.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query parameter (q or query) is required',
        data: []
      });
    }

    console.log('Searching products with term:', searchTerm);
    
    // Use the findAll service with search parameter
    const result = await productService.findAll({ 
      search: searchTerm.trim(),
      page: req.query.page || 1,
      limit: req.query.limit || 50
    });
    
    console.log(`Found ${result.data?.products?.length || 0} products matching "${searchTerm}"`);
    
    // Return products array directly for search endpoint
    res.json({
      success: true,
      message: 'Products found successfully',
      data: result.data?.products || []
    });
  } catch (error) {
    console.error('Error in searchProducts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error searching products',
      data: []
    });
  }
};

/**
 * Create a new product
 * POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    // Step 1: Validate request body
    const { error, value } = validateCreateProduct(req.body);
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        message: errorMessages
      });
    }

    // Step 2: Create product via service layer
    const result = await productService.createProduct(value);

    // Step 3: Return success response
    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product_id: result.product_id,
        barcode: result.barcode
      }
    });

  } catch (error) {
    // Handle known business logic errors
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    // Pass unexpected errors to error handler middleware
    next(error);
  }
};

/**
 * Get batches for a specific product
 * GET /api/products/:productId/batches
 */
const getProductBatches = async (req, res, next) => {
  console.log('📦 getProductBatches route hit!', { productId: req.params.productId });
  try {
    const { productId } = req.params;
    
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
        data: []
      });
    }

    console.log(`Fetching batches for product ID: ${productId}`);
    
    // Query stock_batches table for the given product_id
    // Only return batches with available quantity > 0
    const [batches] = await pool.execute(
      `SELECT 
        batch_id,
        batch_no,
        expiry_date,
        qty_available,
        sale_rate,
        purchase_rate,
        mrp,
        created_at,
        updated_at
      FROM stock_batches
      WHERE product_id = ? AND qty_available > 0
      ORDER BY expiry_date ASC, created_at ASC`,
      [parseInt(productId)]
    );

    console.log(`Found ${batches.length} batches for product ID: ${productId}`);
    
    // Format the response to match frontend expectations
    const formattedBatches = batches.map(batch => ({
      batch_id: batch.batch_id,
      batch_no: batch.batch_no,
      expiry_date: batch.expiry_date,
      qty_available: batch.qty_available,
      sale_rate: batch.sale_rate,
      gst_percent: null // Add if available in your schema
    }));

    return res.status(200).json({
      success: true,
      message: 'Batches fetched successfully',
      data: formattedBatches
    });

  } catch (error) {
    console.error('Error in getProductBatches:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching batches',
      data: []
    });
  }
};

/**
 * Get product by ID
 * GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await productService.getProductById(parseInt(id));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product fetched successfully',
      data: product
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update a product
 * PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Validate required field
    if (!req.body.product_name || !req.body.product_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required',
        data: null
      });
    }

    const result = await productService.updateProduct(parseInt(id), req.body);
    
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in updateProduct:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error updating product',
      data: null
    });
  }
};

/**
 * Delete a product
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const result = await productService.deleteProduct(parseInt(id));
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting product',
      data: null
    });
  }
};

module.exports = {
  getAllProducts,
  searchProducts,
  createProduct,
  getProductBatches,
  getProductById,
  updateProduct,
  deleteProduct
};
