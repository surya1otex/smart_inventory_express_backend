const supplierService = require('../services/supplier.service');

/**
 * Create a new supplier
 */
exports.create = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const supplierData = req.body;

    // Validate required field
    if (!supplierData.name || !supplierData.name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name is required',
        data: null
      });
    }

    const result = await supplierService.create(pool, supplierData);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in create supplier:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error creating supplier',
      data: null
    });
  }
};

/**
 * Get all suppliers
 */
exports.findAll = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { search, page, limit } = req.query;
    
    const result = await supplierService.findAll(pool, { search, page, limit });
    res.json(result);
  } catch (error) {
    console.error('Error in findAll suppliers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching suppliers',
      data: null
    });
  }
};

/**
 * Get a single supplier by ID
 */
exports.findOne = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { id } = req.params;

    const result = await supplierService.findOne(pool, id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in findOne supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching supplier',
      data: null
    });
  }
};

/**
 * Update a supplier
 */
exports.update = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { id } = req.params;
    const supplierData = req.body;

    // Validate required field
    if (!supplierData.name || !supplierData.name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name is required',
        data: null
      });
    }

    const result = await supplierService.update(pool, id, supplierData);
    
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in update supplier:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error updating supplier',
      data: null
    });
  }
};

/**
 * Delete a supplier
 */
exports.delete = async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { id } = req.params;

    const result = await supplierService.delete(pool, id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in delete supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting supplier',
      data: null
    });
  }
};
