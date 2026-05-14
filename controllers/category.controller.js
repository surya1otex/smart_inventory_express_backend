/**
 * Category Controller
 * Handles HTTP requests and responses for category operations
 */

const categoryService = require('../services/category.service');

/**
 * Create a new category
 * POST /api/categories
 */
exports.create = async (req, res) => {
  try {
    const categoryData = req.body;

    // Validate required field
    if (!categoryData.category_name || !categoryData.category_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
        data: null
      });
    }

    const result = await categoryService.create(categoryData);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in create category:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error creating category',
      data: null
    });
  }
};

/**
 * Get all categories
 * GET /api/categories
 */
exports.findAll = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    
    const result = await categoryService.findAll({ search, page, limit });
    res.json(result);
  } catch (error) {
    console.error('Error in findAll categories:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching categories',
      data: null
    });
  }
};

/**
 * Get a single category by ID
 * GET /api/categories/:id
 */
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
        data: null
      });
    }

    const result = await categoryService.findOne(parseInt(id));
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in findOne category:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching category',
      data: null
    });
  }
};

/**
 * Update a category
 * PUT /api/categories/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
        data: null
      });
    }

    // Validate required field
    if (!categoryData.category_name || !categoryData.category_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
        data: null
      });
    }

    const result = await categoryService.update(parseInt(id), categoryData);
    
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in update category:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error updating category',
      data: null
    });
  }
};

/**
 * Delete a category
 * DELETE /api/categories/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
        data: null
      });
    }

    const result = await categoryService.delete(parseInt(id));
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in delete category:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error deleting category',
      data: null
    });
  }
};

