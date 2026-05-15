/**
 * Supplier Service - handles all database operations for suppliers
 */

/**
 * Create a new supplier
 */
exports.create = async (pool, supplierData) => {
  const { name, phone, email, gstin, address } = supplierData;

  // Check for duplicate supplier name
  const [existing] = await pool.execute(
    'SELECT supplier_id FROM suppliers WHERE name = ?',
    [name.trim()]
  );

  if (existing.length > 0) {
    const error = new Error('Supplier with this name already exists');
    error.status = 409;
    throw error;
  }

  // Insert new supplier
  const [result] = await pool.execute(
    `INSERT INTO suppliers (name, phone, email, gstin, address) 
     VALUES (?, ?, ?, ?, ?)`,
    [
      name.trim(),
      phone || null,
      email || null,
      gstin || null,
      address || null
    ]
  );

  // Fetch the created supplier
  const [newSupplier] = await pool.execute(
    'SELECT * FROM suppliers WHERE supplier_id = ?',
    [result.insertId]
  );

  return {
    success: true,
    message: 'Supplier created successfully',
    data: newSupplier[0]
  };
};

/**
 * Get all suppliers with optional search and pagination
 */
exports.findAll = async (pool, options = {}) => {
  const { search } = options;
  const pageNum = Math.max(1, parseInt(options.page, 10) || 1);
  let limitNum = parseInt(options.limit, 10);
  if (!Number.isFinite(limitNum) || limitNum < 1) limitNum = 50;
  limitNum = Math.min(500, limitNum);
  const offsetNum = (pageNum - 1) * limitNum;

  let query = 'SELECT * FROM suppliers';
  let countQuery = 'SELECT COUNT(*) as total FROM suppliers';
  const params = [];
  const countParams = [];

  // Add search filter
  if (search && search.trim()) {
    const searchCondition = ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin LIKE ?';
    const searchValue = `%${search.trim()}%`;
    query += searchCondition;
    countQuery += searchCondition;
    params.push(searchValue, searchValue, searchValue, searchValue);
    countParams.push(searchValue, searchValue, searchValue, searchValue);
  }

  // Add ordering and pagination (LIMIT/OFFSET must not use ? with pool.execute on some servers)
  query += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

  // Execute queries
  const [suppliers] = await pool.execute(query, params);
  const [countResult] = await pool.execute(countQuery, countParams);
  const total = countResult[0].total;

  return {
    success: true,
    message: 'Suppliers fetched successfully',
    data: {
      suppliers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    }
  };
};

/**
 * Get a single supplier by ID
 */
exports.findOne = async (pool, id) => {
  const [suppliers] = await pool.execute(
    'SELECT * FROM suppliers WHERE supplier_id = ?',
    [id]
  );

  if (suppliers.length === 0) {
    return {
      success: false,
      message: 'Supplier not found',
      data: null
    };
  }

  return {
    success: true,
    message: 'Supplier fetched successfully',
    data: suppliers[0]
  };
};

/**
 * Update a supplier
 */
exports.update = async (pool, id, supplierData) => {
  const { name, phone, email, gstin, address } = supplierData;

  // Check if supplier exists
  const [existing] = await pool.execute(
    'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
    [id]
  );

  if (existing.length === 0) {
    return {
      success: false,
      message: 'Supplier not found',
      data: null,
      status: 404
    };
  }

  // Check for duplicate name (excluding current supplier)
  const [duplicate] = await pool.execute(
    'SELECT supplier_id FROM suppliers WHERE name = ? AND supplier_id != ?',
    [name.trim(), id]
  );

  if (duplicate.length > 0) {
    const error = new Error('Another supplier with this name already exists');
    error.status = 409;
    throw error;
  }

  // Update supplier
  await pool.execute(
    `UPDATE suppliers 
     SET name = ?, phone = ?, email = ?, gstin = ?, address = ?
     WHERE supplier_id = ?`,
    [
      name.trim(),
      phone || null,
      email || null,
      gstin || null,
      address || null,
      id
    ]
  );

  // Fetch the updated supplier
  const [updatedSupplier] = await pool.execute(
    'SELECT * FROM suppliers WHERE supplier_id = ?',
    [id]
  );

  return {
    success: true,
    message: 'Supplier updated successfully',
    data: updatedSupplier[0]
  };
};

/**
 * Delete a supplier
 */
exports.delete = async (pool, id) => {
  // Check if supplier exists
  const [existing] = await pool.execute(
    'SELECT supplier_id, name FROM suppliers WHERE supplier_id = ?',
    [id]
  );

  if (existing.length === 0) {
    return {
      success: false,
      message: 'Supplier not found',
      data: null
    };
  }

  // Delete supplier
  await pool.execute(
    'DELETE FROM suppliers WHERE supplier_id = ?',
    [id]
  );

  return {
    success: true,
    message: `Supplier "${existing[0].name}" deleted successfully`,
    data: { supplier_id: parseInt(id) }
  };
};
