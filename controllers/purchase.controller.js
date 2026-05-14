/**
 * Purchase Controller
 * Handles HTTP requests and responses for purchase operations
 */

const purchaseService = require('../services/purchase.service');

/**
 * Get all purchases
 * GET /api/purchases
 */
exports.getAll = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const result = await purchaseService.findAll(pool);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getAll purchases:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error fetching purchases',
      data: null
    });
  }
};

/**
 * Get a single purchase by ID
 * GET /api/purchases/:id
 */
exports.getById = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid purchase ID is required',
        data: null
      });
    }

    const result = await purchaseService.findOne(pool, id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getById purchase:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error fetching purchase',
      data: null
    });
  }
};

/**
 * Create a new purchase entry
 * POST /api/purchases
 */
exports.create = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const purchaseData = req.body;

    // Validate required fields
    if (!purchaseData.supplierId) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID is required',
        data: null
      });
    }

    if (!purchaseData.invoiceNumber || !purchaseData.invoiceNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number is required',
        data: null
      });
    }

    if (!purchaseData.items || !Array.isArray(purchaseData.items) || purchaseData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty',
        data: null
      });
    }

    // Validate each item
    for (let i = 0; i < purchaseData.items.length; i++) {
      const item = purchaseData.items[i];

      if (!item.productId) {
        return res.status(400).json({
          success: false,
          message: `Product ID is required for item at index ${i}`,
          data: null
        });
      }

      if (!item.qty || item.qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Quantity must be greater than 0 for item at index ${i}`,
          data: null
        });
      }

      if (!item.purchaseRate || item.purchaseRate < 0) {
        return res.status(400).json({
          success: false,
          message: `Purchase rate must be provided and non-negative for item at index ${i}`,
          data: null
        });
      }

      // Validate expiry date if provided
      if (item.expiryDate) {
        const expiryDate = new Date(item.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (isNaN(expiryDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: `Invalid expiry date format for item at index ${i}`,
            data: null
          });
        }
      }
    }

    const result = await purchaseService.create(pool, purchaseData);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in create purchase:', error);
    
    // Handle duplicate invoice error
    if (error.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        data: null
      });
    }

    // Handle not found errors
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
        data: null
      });
    }

    // Handle validation errors
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        data: null
      });
    }

    // Generic error
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error creating purchase entry',
      data: null
    });
  }
};

