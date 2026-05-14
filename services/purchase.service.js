/**
 * Purchase Service - handles all database operations for purchases
 * Uses MySQL transactions to ensure data consistency
 */

/**
 * Get all purchases with supplier information
 * Returns purchase list sorted by latest first
 */
exports.findAll = async (pool) => {
  const query = `
    SELECT 
      p.purchase_id,
      p.invoice_number,
      p.invoice_date,
      s.name AS supplier_name,
      p.purchase_type,
      p.total_amount
    FROM purchase_headers p
    INNER JOIN suppliers s ON s.supplier_id = p.supplier_id
    ORDER BY p.purchase_id DESC
  `;

  const [purchases] = await pool.execute(query);

  return {
    success: true,
    message: 'Purchases fetched successfully',
    data: purchases
  };
};

/**
 * Get a single purchase by ID with items
 */
exports.findOne = async (pool, id) => {
  // Get purchase header with supplier info
  const [purchases] = await pool.execute(
    `SELECT 
      p.purchase_id,
      p.invoice_number,
      p.invoice_date,
      p.purchase_type,
      p.notes,
      p.subtotal,
      p.gst_total,
      p.total_amount,
      p.created_at,
      s.name AS supplier_name
    FROM purchase_headers p
    INNER JOIN suppliers s ON s.supplier_id = p.supplier_id
    WHERE p.purchase_id = ?`,
    [id]
  );

  if (purchases.length === 0) {
    return {
      success: false,
      message: 'Purchase not found',
      data: null
    };
  }

  // Get purchase items with product info
  const [items] = await pool.execute(
    `SELECT 
      pi.purchase_item_id,
      pi.product_id,
      pr.product_name,
      sb.batch_no,
      sb.expiry_date,
      pi.qty,
      pi.free_qty,
      pi.purchase_rate,
      pi.sale_rate,
      pi.mrp,
      pi.gst_percent,
      (pi.qty * pi.purchase_rate) AS line_total
    FROM purchase_items pi
    INNER JOIN products pr ON pr.product_id = pi.product_id
    LEFT JOIN stock_batches sb ON sb.purchase_id = pi.purchase_id AND sb.product_id = pi.product_id
    WHERE pi.purchase_id = ?`,
    [id]
  );

  return {
    success: true,
    message: 'Purchase fetched successfully',
    data: {
      ...purchases[0],
      items
    }
  };
};

/**
 * Create a new purchase entry
 * This function handles the complete purchase flow:
 * 1. Insert purchase header
 * 2. Insert purchase items
 * 3. Create stock batches for each item
 * 4. Record inventory movements
 */
exports.create = async (pool, purchaseData) => {
  const connection = await pool.getConnection();
  
  try {
    // Start transaction
    await connection.beginTransaction();

    const {
      supplierId,
      invoiceNumber,
      invoiceDate,
      purchaseType,
      notes,
      items
    } = purchaseData;

    // Validate supplier exists
    const [supplierCheck] = await connection.execute(
      'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
      [supplierId]
    );

    if (supplierCheck.length === 0) {
      const error = new Error('Supplier not found');
      error.status = 404;
      throw error;
    }

    // Check for duplicate invoice number per supplier
    const [duplicateCheck] = await connection.execute(
      'SELECT purchase_id FROM purchase_headers WHERE supplier_id = ? AND invoice_number = ?',
      [supplierId, invoiceNumber]
    );

    if (duplicateCheck.length > 0) {
      const error = new Error('Invoice number already exists for this supplier');
      error.status = 409;
      throw error;
    }

    // Calculate totals
    let subtotal = 0;
    let gstTotal = 0;

    for (const item of items) {
      const itemSubtotal = item.qty * item.purchaseRate;
      subtotal += itemSubtotal;
      
      const gstPercent = item.gst || 0;
      gstTotal += (itemSubtotal * gstPercent) / 100;
    }

    const totalAmount = subtotal + gstTotal;

    // 1. Insert purchase header
    const [headerResult] = await connection.execute(
      `INSERT INTO purchase_headers 
       (supplier_id, invoice_number, invoice_date, purchase_type, notes, subtotal, gst_total, total_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        supplierId,
        invoiceNumber,
        invoiceDate,
        purchaseType || 'Cash',
        notes || null,
        subtotal,
        gstTotal,
        totalAmount
      ]
    );

    const purchaseId = headerResult.insertId;

    // 2. Insert purchase items and create batches
    for (const item of items) {
      // Validate product exists
      const [productCheck] = await connection.execute(
        'SELECT product_id FROM products WHERE product_id = ?',
        [item.productId]
      );

      if (productCheck.length === 0) {
        const error = new Error(`Product with ID ${item.productId} not found`);
        error.status = 404;
        throw error;
      }

      // Validate expiry date is future date
      if (item.expiryDate) {
        const expiryDate = new Date(item.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (expiryDate <= today) {
          const error = new Error('Expiry date must be a future date');
          error.status = 400;
          throw error;
        }
      }

      // Insert purchase item
      const [itemResult] = await connection.execute(
        `INSERT INTO purchase_items 
         (purchase_id, product_id, qty, free_qty,
          purchase_rate, sale_rate, mrp, gst_percent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          purchaseId,
          item.productId,
          item.qty,
          item.freeQty || 0,
          item.purchaseRate,
          item.saleRate || null,
          item.mrp || null,
          item.gst || null
        ]
      );

      // Calculate quantities for batch
      const qtyIn = item.qty + (item.freeQty || 0);
      const qtyAvailable = qtyIn;
      const qtyOut = 0;

      // 3. Insert stock batch
      const [batchResult] = await connection.execute(
        `INSERT INTO stock_batches 
         (product_id, purchase_id, batch_no, expiry_date, qty_in, qty_out, qty_available, 
          purchase_rate, sale_rate, mrp, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          item.productId,
          purchaseId,
          item.batchNo || null,
          item.expiryDate || null,
          qtyIn,
          qtyOut,
          qtyAvailable,
          item.purchaseRate,
          item.saleRate || null,
          item.mrp || null
        ]
      );

      const batchId = batchResult.insertId;

      // 4. Insert inventory movement
      await connection.execute(
        `INSERT INTO inventory_movements 
         (product_id, batch_id, movement_type, qty_in, qty_out, reference_id, reference_type, created_at)
         VALUES (?, ?, 'PURCHASE', ?, ?, ?, 'PURCHASE', NOW())`,
        [
          item.productId,
          batchId,
          qtyIn,
          qtyOut,
          purchaseId
        ]
      );
    }

    // Commit transaction
    await connection.commit();

    // Fetch the created purchase header with items
    const [purchaseHeader] = await connection.execute(
      `SELECT ph.*, s.name as supplier_name 
       FROM purchase_headers ph
       INNER JOIN suppliers s ON ph.supplier_id = s.supplier_id
       WHERE ph.purchase_id = ?`,
      [purchaseId]
    );

    const [purchaseItemsData] = await connection.execute(
      `SELECT pi.*, p.product_name 
       FROM purchase_items pi
       INNER JOIN products p ON pi.product_id = p.product_id
       WHERE pi.purchase_id = ?`,
      [purchaseId]
    );

    return {
      success: true,
      message: 'Purchase entry created successfully',
      data: {
        purchase_id: purchaseId,
        ...purchaseHeader[0],
        items: purchaseItemsData
      }
    };

  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    throw error;
  } finally {
    // Release connection back to pool
    connection.release();
  }
};

