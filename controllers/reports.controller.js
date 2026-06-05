/**
 * Reports Controller
 * Sales, inventory, GST, and profit analytics for the Reports module.
 *
 * Date filters use sales_headers.created_at / purchase_headers.invoice_date.
 * Prepared statements via pool.execute(); LIMIT/OFFSET not used.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const REORDER_SQL = 'IFNULL(p.min_stock_alert, 0)';

/**
 * Validate and return fromDate / toDate query params (YYYY-MM-DD).
 */
const parseDateRange = (fromDate, toDate) => {
  if (!fromDate || !toDate || !DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    const err = new Error('fromDate and toDate are required (YYYY-MM-DD)');
    err.status = 400;
    throw err;
  }
  if (fromDate > toDate) {
    const err = new Error('fromDate cannot be after toDate');
    err.status = 400;
    throw err;
  }
  return { fromDate, toDate };
};

const num = (value) => Number(value) || 0;

const round2 = (value) => Math.round(num(value) * 100) / 100;

const formatRowDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
};

const handleError = (res, error, label) => {
  console.error(`Error in ${label}:`, error);
  const status = error.status || 500;
  res.status(status).json({
    success: false,
    message: error.message || `Failed to load ${label}`,
    data: null,
  });
};

/**
 * GET /api/reports/sales?fromDate=&toDate=
 */
exports.getSalesReport = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const { fromDate, toDate } = parseDateRange(req.query.fromDate, req.query.toDate);

    const [rows] = await pool.execute(
      `
      SELECT
        sh.invoice_no AS invoice_no,
        DATE(sh.created_at) AS sale_date,
        sh.customer_name AS customer_name,
        sh.payment_mode AS payment_mode,
        IFNULL(sh.subtotal, 0) AS taxable_amount,
        IFNULL(sh.gst_amount, 0) AS gst_amount,
        IFNULL(sh.total_amount, 0) AS total_amount
      FROM sales_headers sh
      WHERE DATE(sh.created_at) BETWEEN ? AND ?
      ORDER BY sh.created_at DESC
      `,
      [fromDate, toDate]
    );

    const mappedRows = rows.map((r) => ({
      invoiceNo: r.invoice_no,
      date: formatRowDate(r.sale_date),
      customer: r.customer_name ?? '',
      paymentMode: r.payment_mode ?? '',
      taxableAmount: round2(r.taxable_amount),
      gstAmount: round2(r.gst_amount),
      grandTotal: round2(r.total_amount),
    }));

    const totalSales = mappedRows.reduce((sum, r) => sum + r.grandTotal, 0);
    const totalGst = mappedRows.reduce((sum, r) => sum + r.gstAmount, 0);
    const totalInvoices = mappedRows.length;

    res.json({
      success: true,
      message: 'Sales report fetched successfully',
      data: {
        summary: {
          totalSales: round2(totalSales),
          totalInvoices,
          totalGst: round2(totalGst),
          averageInvoiceValue: totalInvoices
            ? round2(totalSales / totalInvoices)
            : 0,
        },
        rows: mappedRows,
      },
    });
  } catch (error) {
    handleError(res, error, 'sales report');
  }
};

/**
 * GET /api/reports/inventory?fromDate=&toDate=
 * Point-in-time stock snapshot (date params accepted for API consistency).
 */
exports.getInventoryReport = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    if (req.query.fromDate && req.query.toDate) {
      parseDateRange(req.query.fromDate, req.query.toDate);
    }

    const [rows] = await pool.execute(
      `
      SELECT
        p.product_id AS product_id,
        p.product_name AS product_name,
        IFNULL(sb.batch_no, '') AS batch_no,
        sb.expiry_date AS expiry_date,
        IFNULL(sb.qty_available, 0) AS qty_available,
        IFNULL(sb.purchase_rate, 0) AS purchase_rate,
        IFNULL(sb.sale_rate, 0) AS sale_rate,
        (IFNULL(sb.qty_available, 0) * IFNULL(sb.purchase_rate, 0)) AS stock_value,
        CASE
          WHEN sb.expiry_date IS NOT NULL AND sb.expiry_date < CURDATE() THEN 'Expired'
          WHEN sb.expiry_date IS NOT NULL
            AND sb.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
          WHEN IFNULL(sb.qty_available, 0) = 0 THEN 'Out of Stock'
          WHEN IFNULL(sb.qty_available, 0) <= ${REORDER_SQL} THEN 'Low Stock'
          ELSE 'In Stock'
        END AS status
      FROM stock_batches sb
      INNER JOIN products p ON p.product_id = sb.product_id
      ORDER BY p.product_name ASC, sb.expiry_date ASC, sb.batch_no ASC
      `
    );

    const mappedRows = rows.map((r) => ({
      productName: r.product_name,
      batchNo: r.batch_no || '',
      expiryDate: formatRowDate(r.expiry_date),
      availableQty: num(r.qty_available),
      purchaseRate: round2(r.purchase_rate),
      sellingPrice: round2(r.sale_rate),
      stockValue: round2(r.stock_value),
      status: r.status,
    }));

    const productIds = new Set(rows.map((r) => r.product_id));
    let totalStockValue = 0;
    let lowStockItems = 0;
    let expiredExpiringItems = 0;

    mappedRows.forEach((r, idx) => {
      totalStockValue += r.stockValue;
      const status = rows[idx].status;
      if (status === 'Low Stock') lowStockItems += 1;
      if (status === 'Expired' || status === 'Expiring Soon') expiredExpiringItems += 1;
    });

    res.json({
      success: true,
      message: 'Inventory report fetched successfully',
      data: {
        summary: {
          totalProducts: productIds.size,
          totalStockValue: round2(totalStockValue),
          lowStockItems,
          expiredExpiringItems,
        },
        rows: mappedRows,
      },
    });
  } catch (error) {
    handleError(res, error, 'inventory report');
  }
};

/**
 * GET /api/reports/gst?fromDate=&toDate=
 */
exports.getGstReport = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const { fromDate, toDate } = parseDateRange(req.query.fromDate, req.query.toDate);

    const [rows] = await pool.execute(
      `
      SELECT
        sh.invoice_no AS invoice_no,
        DATE(sh.created_at) AS sale_date,
        IFNULL(ii.tax_percent, 0) AS tax_percent,
        SUM(IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0)) AS taxable_amount,
        SUM(
          (IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0) * IFNULL(ii.tax_percent, 0) / 100) / 2
        ) AS cgst,
        SUM(
          (IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0) * IFNULL(ii.tax_percent, 0) / 100) / 2
        ) AS sgst,
        0 AS igst,
        SUM(
          IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0)
          * (1 + IFNULL(ii.tax_percent, 0) / 100)
        ) AS line_total
      FROM invoice_items ii
      INNER JOIN sales_headers sh ON ii.invoice_id = sh.sale_id
      WHERE DATE(sh.created_at) BETWEEN ? AND ?
      GROUP BY sh.sale_id, sh.invoice_no, DATE(sh.created_at), ii.tax_percent
      ORDER BY sh.created_at DESC, sh.invoice_no ASC, ii.tax_percent ASC
      `,
      [fromDate, toDate]
    );

    const [[outputAgg]] = await pool.execute(
      `
      SELECT
        IFNULL(SUM(IFNULL(sh.subtotal, 0)), 0) AS taxable_sales,
        IFNULL(SUM(IFNULL(sh.gst_amount, 0)), 0) AS output_gst
      FROM sales_headers sh
      WHERE DATE(sh.created_at) BETWEEN ? AND ?
      `,
      [fromDate, toDate]
    );

    const [[inputAgg]] = await pool.execute(
      `
      SELECT IFNULL(SUM(IFNULL(ph.gst_total, 0)), 0) AS input_gst
      FROM purchase_headers ph
      WHERE DATE(ph.invoice_date) BETWEEN ? AND ?
      `,
      [fromDate, toDate]
    );

    const taxableSales = round2(outputAgg.taxable_sales);
    const outputGst = round2(outputAgg.output_gst);
    const inputGst = round2(inputAgg.input_gst);

    const mappedRows = rows.map((r) => ({
      invoiceNo: r.invoice_no,
      date: formatRowDate(r.sale_date),
      gstPercent: round2(r.tax_percent),
      taxableAmount: round2(r.taxable_amount),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
      total: round2(r.line_total),
    }));

    res.json({
      success: true,
      message: 'GST report fetched successfully',
      data: {
        summary: {
          taxableSales,
          outputGst,
          inputGst,
          netGstPayable: round2(outputGst - inputGst),
        },
        rows: mappedRows,
      },
    });
  } catch (error) {
    handleError(res, error, 'GST report');
  }
};

/**
 * GET /api/reports/profit?fromDate=&toDate=
 */
exports.getProfitReport = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const { fromDate, toDate } = parseDateRange(req.query.fromDate, req.query.toDate);

    const [rows] = await pool.execute(
      `
      SELECT
        pr.product_name AS product_name,
        SUM(IFNULL(ii.quantity, 0)) AS qty_sold,
        SUM(IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0)) AS sales_amount,
        SUM(IFNULL(ii.quantity, 0) * IFNULL(sb.purchase_rate, 0)) AS cost_amount,
        SUM(
          (IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0))
          - (IFNULL(ii.quantity, 0) * IFNULL(sb.purchase_rate, 0))
        ) AS profit
      FROM invoice_items ii
      INNER JOIN sales_headers sh ON ii.invoice_id = sh.sale_id
      INNER JOIN products pr ON pr.product_id = ii.product_id
      INNER JOIN stock_batches sb
        ON ii.batch_id = sb.batch_id AND ii.product_id = sb.product_id
      WHERE DATE(sh.created_at) BETWEEN ? AND ?
      GROUP BY pr.product_id, pr.product_name
      HAVING SUM(IFNULL(ii.quantity, 0)) > 0
      ORDER BY profit DESC, pr.product_name ASC
      `,
      [fromDate, toDate]
    );

    const mappedRows = rows.map((r) => {
      const salesAmount = round2(r.sales_amount);
      const costAmount = round2(r.cost_amount);
      const profit = round2(r.profit);
      const marginPercent = salesAmount
        ? round2((profit / salesAmount) * 100)
        : 0;

      return {
        productName: r.product_name,
        qtySold: num(r.qty_sold),
        salesAmount,
        costAmount,
        profit,
        marginPercent,
      };
    });

    const totalRevenue = mappedRows.reduce((sum, r) => sum + r.salesAmount, 0);
    const totalCost = mappedRows.reduce((sum, r) => sum + r.costAmount, 0);
    const grossProfit = round2(totalRevenue - totalCost);

    res.json({
      success: true,
      message: 'Profit report fetched successfully',
      data: {
        summary: {
          totalRevenue: round2(totalRevenue),
          totalCost: round2(totalCost),
          grossProfit,
          profitMarginPercent: totalRevenue
            ? round2((grossProfit / totalRevenue) * 100)
            : 0,
        },
        rows: mappedRows,
      },
    });
  } catch (error) {
    handleError(res, error, 'profit report');
  }
};
