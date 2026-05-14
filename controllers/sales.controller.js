/**
 * Sales Controller
 * Handles HTTP requests and responses for sales operations (POS)
 */

// Helper: generate invoice number (server-side)
const generateInvoiceNo = (saleType) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000000);
  const prefix = (saleType || 'POS').toString().toUpperCase();
  return `INV-${prefix}-${yyyy}${mm}${dd}-${rand}`;
};

// Helper: read columns from a table and return a Set of column names
const getTableColumns = async (connection, tableName) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map(r => r.Field));
};

const parsePositiveNumber = (value, fieldName) => {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num) || num <= 0) {
    const err = new Error(`${fieldName} must be a positive number`);
    err.status = 400;
    throw err;
  }
  return num;
};

exports.create = async (req, res) => {
  const pool = req.app.locals.db;

  // Basic request validation (fail fast, before DB transaction)
  const saleData = req.body || {};
  const {
    sale_type,
    customer_name,
    payment_mode,
    items
  } = saleData;

  try {
    if (!sale_type || !sale_type.toString().trim()) {
      return res.status(400).json({ success: false, message: 'sale_type is required', data: null });
    }
    if (!customer_name || !customer_name.toString().trim()) {
      return res.status(400).json({ success: false, message: 'customer_name is required', data: null });
    }
    if (!payment_mode || !payment_mode.toString().trim()) {
      return res.status(400).json({ success: false, message: 'payment_mode is required', data: null });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items must be a non-empty array', data: null });
    }

    const normalizedItems = items.map((it, idx) => {
      const product_id = parseInt(it.product_id, 10);
      const batch_id = parseInt(it.batch_id, 10);
      if (!Number.isFinite(product_id) || product_id <= 0) {
        const err = new Error(`product_id must be a positive integer (item index ${idx})`);
        err.status = 400;
        throw err;
      }
      if (!Number.isFinite(batch_id) || batch_id <= 0) {
        const err = new Error(`batch_id must be a positive integer (item index ${idx})`);
        err.status = 400;
        throw err;
      }

      const quantity = parsePositiveNumber(it.quantity, `quantity (item index ${idx})`);
      const rate = (() => {
        const num = typeof it.rate === 'string' ? Number(it.rate) : it.rate;
        if (!Number.isFinite(num) || num < 0) {
          const err = new Error(`rate must be a non-negative number (item index ${idx})`);
          err.status = 400;
          throw err;
        }
        return num;
      })();

      const gst_percent = (() => {
        const num = typeof it.gst_percent === 'string' ? Number(it.gst_percent) : it.gst_percent;
        if (!Number.isFinite(num) || num < 0) {
          const err = new Error(`gst_percent must be a non-negative number (item index ${idx})`);
          err.status = 400;
          throw err;
        }
        return num;
      })();

      return { product_id, batch_id, quantity, rate, gst_percent };
    });

    const subtotal = normalizedItems.reduce((sum, it) => sum + it.quantity * it.rate, 0);
    const gst_total = normalizedItems.reduce((sum, it) => sum + (it.quantity * it.rate * it.gst_percent) / 100, 0);
    const total_amount = subtotal + gst_total;

    const connection = await pool.getConnection();

    try {
      // 1. Start DB transaction
      await connection.beginTransaction();

      // Detect column names to match your existing schema
      const salesHeaderCols = await getTableColumns(connection, 'sales_headers');
      //const salesItemsCols = await getTableColumns(connection, 'sales_items');
      const salesItemsCols = await getTableColumns(connection, 'invoice_items');
      const stockBatchCols = await getTableColumns(connection, 'stock_batches');

      // Header: invoice_no vs invoice_number
      const invoiceColumn =
        salesHeaderCols.has('invoice_no') ? 'invoice_no' :
        (salesHeaderCols.has('invoice_number') ? 'invoice_number' : null);

      if (!invoiceColumn) {
        const err = new Error('sales_headers must have either invoice_no or invoice_number column');
        err.status = 500;
        throw err;
      }

      // Line: rate vs sale_rate
      const rateColumn =
        salesItemsCols.has('rate') ? 'rate' :
        (salesItemsCols.has('selling_price') ? 'selling_price' : null);

      if (!rateColumn) {
        const err = new Error('sales_items must have either rate or selling_price column');
        err.status = 500;
        throw err;
      }

      // Line: qty column
      const qtyColumn =
        salesItemsCols.has('qty') ? 'qty' :
        (salesItemsCols.has('quantity') ? 'quantity' : null);
      if (!qtyColumn) {
        const err = new Error('sales_items must have either qty or quantity column');
        err.status = 500;
        throw err;
      }

      // GST column
      const gstColumn =
        salesItemsCols.has('tax_percent') ? 'tax_percent' :
        (salesItemsCols.has('gst') ? 'gst' : null);
      if (!gstColumn) {
        const err = new Error('sales_items must have either tax_percent or gst column');
        err.status = 500;
        throw err;
      }

      if (!salesItemsCols.has('invoice_id')) {
        const err = new Error('sales_items must have invoice_id column');
        err.status = 500;
        throw err;
      }
      if (!salesItemsCols.has('product_id') || !salesItemsCols.has('batch_id')) {
        const err = new Error('sales_items must have product_id and batch_id columns');
        err.status = 500;
        throw err;
      }
      if (!salesItemsCols.has('created_at')) {
        const err = new Error('sales_items must have created_at column');
        err.status = 500;
        throw err;
      }

      if (!stockBatchCols.has('qty_available')) {
        const err = new Error('stock_batches must have qty_available column');
        err.status = 500;
        throw err;
      }
      if (!stockBatchCols.has('qty_out')) {
        const err = new Error('stock_batches must have qty_out column');
        err.status = 500;
        throw err;
      }
      if (!stockBatchCols.has('updated_at')) {
        const err = new Error('stock_batches must have updated_at column');
        err.status = 500;
        throw err;
      }

      // Ensure sales_headers has the columns we are going to insert
      const requiredSalesHeaderColumns = [
        'sale_type',
        'customer_name',
        'payment_mode',
        'subtotal',
        'gst_amount',
        'total_amount',
        'created_at',
      ];
      for (const col of requiredSalesHeaderColumns) {
        if (!salesHeaderCols.has(col)) {
          const err = new Error(`sales_headers is missing required column: ${col}`);
          err.status = 500;
          throw err;
        }
      }

      // Generate invoice number and insert header
      const invoice_no = generateInvoiceNo(sale_type);

      const headerInsertColumns = [
        'sale_type',
        'customer_name',
        'payment_mode',
        invoiceColumn,
        'subtotal',
        'gst_amount',
        'total_amount',
        'created_at',
      ];

      const headerInsertQuery = `
        INSERT INTO sales_headers
          (${headerInsertColumns.join(', ')})
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const [headerResult] = await connection.execute(headerInsertQuery, [
        sale_type,
        customer_name,
        payment_mode,
        invoice_no,
        subtotal,
        gst_total,
        total_amount
      ]);

      // 2. Insert into sales_headers -> get sale_id
      const sale_id = headerResult.insertId;

      // 3. Loop items: validate stock, insert sales items, update stock batches, insert inventory movements
      const inventoryCols = await getTableColumns(connection, 'inventory_movements');
      if (!inventoryCols.has('product_id') || !inventoryCols.has('batch_id')) {
        const err = new Error('inventory_movements must have product_id and batch_id columns');
        err.status = 500;
        throw err;
      }
      if (!inventoryCols.has('movement_type') || !inventoryCols.has('qty_in') || !inventoryCols.has('qty_out') ||
          !inventoryCols.has('reference_id') || !inventoryCols.has('reference_type')) {
        const err = new Error('inventory_movements schema is missing required movement columns');
        err.status = 500;
        throw err;
      }
      if (!inventoryCols.has('created_at')) {
        const err = new Error('inventory_movements must have created_at column');
        err.status = 500;
        throw err;
      }

      for (const item of normalizedItems) {
        // Validate stock with row lock
        const [batchRows] = await connection.execute(
          `SELECT qty_available
           FROM stock_batches
           WHERE product_id = ? AND batch_id = ?
           FOR UPDATE`,
          [item.product_id, item.batch_id]
        );

        if (batchRows.length === 0) {
          const err = new Error(`Batch not found for product_id ${item.product_id} and batch_id ${item.batch_id}`);
          err.status = 404;
          throw err;
        }

        const availableQty = Number(batchRows[0].qty_available);
        if (!Number.isFinite(availableQty) || availableQty < item.quantity) {
          const err = new Error(`Insufficient stock for product_id ${item.product_id}, batch_id ${item.batch_id}. Available: ${availableQty}`);
          err.status = 400;
          throw err;
        }

        // Insert into sales_items
        const salesItemInsertColumns = [
          'invoice_id',
          'product_id',
          'batch_id',
          'quantity',
          'selling_price',
          'tax_percent',
          'created_at'
        ];

        // Build VALUES placeholders in the same order as columns above (created_at uses NOW()).
        const salesItemInsertQuery = `
          INSERT INTO invoice_items
            (${salesItemInsertColumns.filter(c => c !== 'created_at').join(', ')}, created_at)
          VALUES
            (?, ?, ?, ?, ?, ?, NOW())
        `;

        await connection.execute(salesItemInsertQuery, [
          sale_id,
          item.product_id,
          item.batch_id,
          item.quantity,
          item.rate,
          item.gst_percent
        ]);

        // Update stock_batches (prevent negative stock by using the qty_available check again)
        const [updateResult] = await connection.execute(
          `UPDATE stock_batches
           SET
             qty_out = qty_out + ?,
             qty_available = qty_available - ?,
             updated_at = NOW()
           WHERE product_id = ?
             AND batch_id = ?
             AND qty_available >= ?`,
          [item.quantity, item.quantity, item.product_id, item.batch_id, item.quantity]
        );
        if (!updateResult.affectedRows || updateResult.affectedRows === 0) {
          const err = new Error(`Stock update failed (insufficient stock) for product_id ${item.product_id}, batch_id ${item.batch_id}`);
          err.status = 400;
          throw err;
        }

        // Insert inventory_movements (type SALE)
        await connection.execute(
          `INSERT INTO inventory_movements
            (product_id, batch_id, movement_type, qty_in, qty_out, reference_id, reference_type, created_at)
           VALUES
            (?, ?, 'SALE', 0, ?, ?, 'SALE', NOW())`,
          [item.product_id, item.batch_id, item.quantity, sale_id]
        );
      }

      // 4. Commit transaction
      await connection.commit();

      // 5. Return invoice_no + sale_id
      return res.status(201).json({
        success: true,
        message: 'Sale saved successfully',
        data: {
          invoice_no,
          sale_id
        }
      });
    } catch (error) {
      // 6. Rollback on error
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      console.error('Error in create sales:', error);

      const status = error.status || error.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: error.message || 'Error creating sales entry',
        data: null
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Validation/runtime error in create sales:', error);
    const status = error.status || error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Error creating sales entry',
      data: null
    });
  }
};

