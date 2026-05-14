/**
 * Product Service Layer
 * Handles all business logic for product operations
 */

const { pool } = require('../config/db');
const { generateInternalBarcode } = require('../utils/barcodeGenerator');

/**
 * Check if product name already exists (excluding given productId for updates)
 * @param {string} productName - Product name to check
 * @param {number|null} excludeProductId - Product ID to exclude (for updates)
 * @returns {Promise<boolean>}
 */
const checkProductNameExists = async (productName, excludeProductId = null) => {
  let query = 'SELECT product_id FROM products WHERE product_name = ?';
  const params = [productName];
  
  if (excludeProductId) {
    query += ' AND product_id != ?';
    params.push(excludeProductId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

/**
 * Check if barcode already exists (excluding given productId for updates)
 * @param {string} barcode - Barcode to check
 * @param {number|null} excludeProductId - Product ID to exclude (for updates)
 * @returns {Promise<boolean>}
 */
const checkBarcodeExists = async (barcode, excludeProductId = null) => {
  if (!barcode) return false;
  
  let query = 'SELECT product_id FROM products WHERE barcode = ?';
  const params = [barcode];
  
  if (excludeProductId) {
    query += ' AND product_id != ?';
    params.push(excludeProductId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

/**
 * Get all products with optional search and pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const findAll = async (options = {}) => {
  const { search, page = 1, limit = 50, category_id } = options;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT p.*, c.category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.category_id
  `;
  let countQuery = 'SELECT COUNT(*) as total FROM products p';
  const params = [];
  const countParams = [];
  const conditions = [];

  // Add search filter
  if (search && search.trim()) {
    const searchCondition = '(p.product_name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.hsn_code LIKE ?)';
    const searchValue = `%${search.trim()}%`;
    conditions.push(searchCondition);
    params.push(searchValue, searchValue, searchValue, searchValue);
    countParams.push(searchValue, searchValue, searchValue, searchValue);
  }

  // Add category filter
  if (category_id) {
    conditions.push('p.category_id = ?');
    params.push(parseInt(category_id));
    countParams.push(parseInt(category_id));
  }

  // Build WHERE clause
  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  // Add ordering and pagination
  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  // Execute queries
  const [products] = await pool.execute(query, params);
  const [countResult] = await pool.execute(countQuery, countParams);
  const total = countResult[0].total;

  return {
    success: true,
    message: 'Products fetched successfully',
    data: {
      products,
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
 * Create a new product
 * @param {Object} productData - Validated product data
 * @returns {Promise<Object>} - Created product info
 */
const createProduct = async (productData) => {
  const {
    category_id = null,
    product_name = '',
    sku = null,
    barcode = null,
    unit = null,
    base_unit = 'pcs',
    unit_per_pack = 1,
    hsn_code = null,
    tax_percent = null,
    purchase_price = null,
    selling_price = null,
    min_stock_alert = 0,
    is_batch_tracked = 1,
    batch_mandatory = 1,
    default_batch_allocation = 'FEFO',
    schedule_category = null,
    salt_composition = null
  } = productData;

  // Check for duplicate product name
  const productNameExists = await checkProductNameExists(product_name);
  if (productNameExists) {
    throw { statusCode: 400, message: 'Product name already exists' };
  }

  // Check for duplicate barcode (if provided)
  if (barcode) {
    const barcodeExists = await checkBarcodeExists(barcode);
    if (barcodeExists) {
      throw { statusCode: 400, message: 'Barcode already exists' };
    }
  }

  // Convert salt_composition to JSON string for storage
  const saltCompositionJson = salt_composition 
    ? JSON.stringify(salt_composition) 
    : null;

  // Insert product into database
  const insertQuery = `
    INSERT INTO products (
      category_id, product_name, sku, barcode, pack_unit, base_unit,
      unit_per_pack, hsn_code, tax_percent, purchase_price_pack, selling_price_unit,
      min_stock_alert, is_batch_tracked, batch_mandatory, default_batch_allocation,
      schedule_category, salt_composition
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertValues = [
    category_id,
    product_name,
    sku,
    barcode,
    unit,
    base_unit,
    unit_per_pack,
    hsn_code,
    tax_percent,
    purchase_price,
    selling_price,
    min_stock_alert,
    is_batch_tracked,
    batch_mandatory,
    default_batch_allocation,
    schedule_category,
    saltCompositionJson
  ];

  const [result] = await pool.execute(insertQuery, insertValues);
  const productId = result.insertId;

  let finalBarcode = barcode;

  // Generate internal barcode if not provided
  if (!barcode) {
    finalBarcode = generateInternalBarcode(productId);
    
    // Update the product with generated barcode
    await pool.execute(
      'UPDATE products SET barcode = ?, updated_at = NOW() WHERE product_id = ?',
      [finalBarcode, productId]
    );
  }

  return {
    product_id: productId,
    barcode: finalBarcode
  };
};

/**
 * Get product by ID
 * @param {number} productId - Product ID
 * @returns {Promise<Object|null>}
 */
const getProductById = async (productId) => {
  const [rows] = await pool.execute(
    `SELECT p.*, c.category_name 
     FROM products p 
     LEFT JOIN categories c ON p.category_id = c.category_id 
     WHERE p.product_id = ?`,
    [productId]
  );
  
  if (rows.length === 0) {
    return null;
  }

  // Parse salt_composition JSON
  const product = rows[0];
  if (product.salt_composition) {
    try {
      product.salt_composition = JSON.parse(product.salt_composition);
    } catch (e) {
      product.salt_composition = null;
    }
  }

  return product;
};

/**
 * Update a product
 * @param {number} productId - Product ID
 * @param {Object} productData - Product data to update
 * @returns {Promise<Object>}
 */
const updateProduct = async (productId, productData) => {
  const {
    category_id = null,
    product_name,
    sku = null,
    barcode = null,
    unit = null,
    base_unit = 'pcs',
    unit_per_pack = 1,
    hsn_code = null,
    tax_percent = null,
    purchase_price = null,
    selling_price = null,
    min_stock_alert = 0,
    is_batch_tracked = 1,
    batch_mandatory = 1,
    default_batch_allocation = 'FEFO',
    schedule_category = null,
    salt_composition = null
  } = productData;

  // Check if product exists
  const existing = await getProductById(productId);
  if (!existing) {
    return {
      success: false,
      message: 'Product not found',
      data: null,
      status: 404
    };
  }

  // Check for duplicate product name (excluding current product)
  const productNameExists = await checkProductNameExists(product_name, productId);
  if (productNameExists) {
    throw { statusCode: 409, message: 'Another product with this name already exists' };
  }

  // Check for duplicate barcode (excluding current product)
  if (barcode && barcode !== existing.barcode) {
    const barcodeExists = await checkBarcodeExists(barcode, productId);
    if (barcodeExists) {
      throw { statusCode: 409, message: 'Barcode already exists' };
    }
  }

  // Convert salt_composition to JSON string for storage
  const saltCompositionJson = salt_composition 
    ? JSON.stringify(salt_composition) 
    : null;

  // Update product
  const updateQuery = `
    UPDATE products SET
      category_id = ?,
      product_name = ?,
      sku = ?,
      barcode = ?,
      pack_unit = ?,
      base_unit = ?,
      unit_per_pack = ?,
      hsn_code = ?,
      tax_percent = ?,
      purchase_price_pack = ?,
      selling_price_unit = ?,
      min_stock_alert = ?,
      is_batch_tracked = ?,
      batch_mandatory = ?,
      default_batch_allocation = ?,
      schedule_category = ?,
      salt_composition = ?,
      updated_at = NOW()
    WHERE product_id = ?
  `;

  const updateValues = [
    category_id,
    product_name,
    sku,
    barcode || existing.barcode,
    unit,
    base_unit,
    unit_per_pack,
    hsn_code,
    tax_percent,
    purchase_price,
    selling_price,
    min_stock_alert,
    is_batch_tracked,
    batch_mandatory,
    default_batch_allocation,
    schedule_category,
    saltCompositionJson,
    productId
  ];

  await pool.execute(updateQuery, updateValues);

  // Fetch the updated product
  const updatedProduct = await getProductById(productId);

  return {
    success: true,
    message: 'Product updated successfully',
    data: updatedProduct
  };
};

/**
 * Delete a product
 * @param {number} productId - Product ID
 * @returns {Promise<Object>}
 */
const deleteProduct = async (productId) => {
  // Check if product exists
  const existing = await getProductById(productId);
  if (!existing) {
    return {
      success: false,
      message: 'Product not found',
      data: null
    };
  }

  // Delete product
  await pool.execute(
    'DELETE FROM products WHERE product_id = ?',
    [productId]
  );

  return {
    success: true,
    message: `Product "${existing.product_name}" deleted successfully`,
    data: { product_id: parseInt(productId) }
  };
};

module.exports = {
  findAll,
  createProduct,
  checkProductNameExists,
  checkBarcodeExists,
  getProductById,
  updateProduct,
  deleteProduct
};
