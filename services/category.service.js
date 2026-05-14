/**
 * Category Service - handles all database operations for categories
 */

const { pool } = require('../config/db');

/**
 * Create a new category
 */
exports.create = async (categoryData) => {
  const { category_name, description } = categoryData;

  // Check for duplicate category name
  const [existing] = await pool.execute(
    'SELECT category_id FROM categories WHERE category_name = ?',
    [category_name.trim()]
  );

  if (existing.length > 0) {
    const error = new Error('Category with this name already exists');
    error.status = 409;
    throw error;
  }

  // Insert new category
  const [result] = await pool.execute(
    `INSERT INTO categories (category_name, description) 
     VALUES (?, ?)`,
    [
      category_name.trim(),
      description || null
    ]
  );

  // Fetch the created category
  const [newCategory] = await pool.execute(
    'SELECT * FROM categories WHERE category_id = ?',
    [result.insertId]
  );

  return {
    success: true,
    message: 'Category created successfully',
    data: newCategory[0]
  };
};

/**
 * Get all categories with optional search and pagination
 */
exports.findAll = async (options = {}) => {
  const { search, page = 1, limit = 50 } = options;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM categories';
  let countQuery = 'SELECT COUNT(*) as total FROM categories';
  const params = [];
  const countParams = [];

  // Add search filter
  if (search && search.trim()) {
    const searchCondition = ' WHERE category_name LIKE ? OR description LIKE ?';
    const searchValue = `%${search.trim()}%`;
    query += searchCondition;
    countQuery += searchCondition;
    params.push(searchValue, searchValue);
    countParams.push(searchValue, searchValue);
  }

  // Add ordering and pagination
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  // Execute queries
  const [categories] = await pool.execute(query, params);
  const [countResult] = await pool.execute(countQuery, countParams);
  const total = countResult[0].total;

  return {
    success: true,
    message: 'Categories fetched successfully',
    data: {
      categories,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  };
};

/**
 * Get a single category by ID
 */
exports.findOne = async (id) => {
  const [categories] = await pool.execute(
    'SELECT * FROM categories WHERE category_id = ?',
    [id]
  );

  if (categories.length === 0) {
    return {
      success: false,
      message: 'Category not found',
      data: null
    };
  }

  return {
    success: true,
    message: 'Category fetched successfully',
    data: categories[0]
  };
};

/**
 * Update a category
 */
exports.update = async (id, categoryData) => {
  const { category_name, description } = categoryData;

  // Check if category exists
  const [existing] = await pool.execute(
    'SELECT category_id FROM categories WHERE category_id = ?',
    [id]
  );

  if (existing.length === 0) {
    return {
      success: false,
      message: 'Category not found',
      data: null,
      status: 404
    };
  }

  // Check for duplicate name (excluding current category)
  const [duplicate] = await pool.execute(
    'SELECT category_id FROM categories WHERE category_name = ? AND category_id != ?',
    [category_name.trim(), id]
  );

  if (duplicate.length > 0) {
    const error = new Error('Another category with this name already exists');
    error.status = 409;
    throw error;
  }

  // Update category
  await pool.execute(
    `UPDATE categories 
     SET category_name = ?, description = ?, updated_at = NOW()
     WHERE category_id = ?`,
    [
      category_name.trim(),
      description || null,
      id
    ]
  );

  // Fetch the updated category
  const [updatedCategory] = await pool.execute(
    'SELECT * FROM categories WHERE category_id = ?',
    [id]
  );

  return {
    success: true,
    message: 'Category updated successfully',
    data: updatedCategory[0]
  };
};

/**
 * Delete a category
 */
exports.delete = async (id) => {
  // Check if category exists
  const [existing] = await pool.execute(
    'SELECT category_id, category_name FROM categories WHERE category_id = ?',
    [id]
  );

  if (existing.length === 0) {
    return {
      success: false,
      message: 'Category not found',
      data: null
    };
  }

  // Check if category has products
  const [products] = await pool.execute(
    'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
    [id]
  );

  if (products[0].count > 0) {
    const error = new Error(`Cannot delete category. It has ${products[0].count} product(s) assigned.`);
    error.status = 400;
    throw error;
  }

  // Delete category
  await pool.execute(
    'DELETE FROM categories WHERE category_id = ?',
    [id]
  );

  return {
    success: true,
    message: `Category "${existing[0].category_name}" deleted successfully`,
    data: { category_id: parseInt(id) }
  };
};

