/**
 * Dashboard Controller
 * Aggregates KPIs and lists for the dashboard UI (aligned with Angular dashboard.service.ts).
 *
 * Sales dates use sales_headers.created_at (no separate sale_date column in this schema).
 * Low-stock threshold: products.min_stock_alert.
 */

/** Per-product reorder / alert level (schema uses min_stock_alert). */
const REORDER_SQL = 'IFNULL(MAX(p.min_stock_alert), 0)';

/**
 * GET /api/dashboard/summary
 */
exports.getSummary = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const [[todayAgg]] = await pool.execute(
      `
      SELECT
        IFNULL(SUM(IFNULL(sh.total_amount, 0)), 0) AS today_sales,
        COUNT(*) AS today_invoices
      FROM sales_headers sh
      WHERE DATE(sh.created_at) = CURDATE()
      `
    );

    const [[monthAgg]] = await pool.execute(
      `
      SELECT IFNULL(SUM(IFNULL(sh.total_amount, 0)), 0) AS month_sales
      FROM sales_headers sh
      WHERE YEAR(sh.created_at) = YEAR(CURDATE())
        AND MONTH(sh.created_at) = MONTH(CURDATE())
      `
    );

    const [[profitRow]] = await pool.execute(
      `
      SELECT IFNULL(SUM(
        (IFNULL(ii.quantity, 0) * IFNULL(ii.selling_price, 0))
        - (IFNULL(ii.quantity, 0) * IFNULL(sb.purchase_rate, 0))
      ), 0) AS profit_today
      FROM invoice_items ii
      INNER JOIN sales_headers sh ON ii.invoice_id = sh.sale_id
      INNER JOIN stock_batches sb
        ON ii.batch_id = sb.batch_id AND ii.product_id = sb.product_id
      WHERE DATE(sh.created_at) = CURDATE()
      `
    );

    const [[lowStockAgg]] = await pool.execute(
      `
      SELECT COUNT(*) AS cnt
      FROM (
        SELECT p.product_id
        FROM products p
        INNER JOIN stock_batches sb ON sb.product_id = p.product_id
        GROUP BY p.product_id
        HAVING SUM(IFNULL(sb.qty_available, 0)) <= IFNULL(MAX(p.min_stock_alert), 0)
      ) AS low_products
      `
    );

    const [[expiryAgg]] = await pool.execute(
      `
      SELECT COUNT(*) AS cnt
      FROM stock_batches sb
      WHERE sb.expiry_date IS NOT NULL
        AND sb.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      `
    );

    res.json({
      todaySales: Number(todayAgg.today_sales) || 0,
      todayInvoices: Number(todayAgg.today_invoices) || 0,
      lowStockItems: Number(lowStockAgg.cnt) || 0,
      expiringSoon: Number(expiryAgg.cnt) || 0,
      thisMonthSales: Number(monthAgg.month_sales) || 0,
      estimatedProfitToday: Number(profitRow.profit_today) || 0,
    });
  } catch (error) {
    console.error('Error in getSummary:', error);
    res.status(500).json({
      message: error.message || 'Failed to load dashboard summary',
    });
  }
};

/**
 * GET /api/dashboard/sales-trend
 * Last 7 calendar days including today.
 */
exports.getSalesTrend = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        DATE_FORMAT(cal.day_date, '%Y-%m-%d') AS trend_date,
        IFNULL(SUM(IFNULL(sh.total_amount, 0)), 0) AS day_sales
      FROM (
        SELECT CURDATE() - INTERVAL seq DAY AS day_date
        FROM (
          SELECT 0 AS seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
          UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
        ) AS n
      ) AS cal
      LEFT JOIN sales_headers sh ON DATE(sh.created_at) = cal.day_date
      GROUP BY cal.day_date
      ORDER BY cal.day_date ASC
      `
    );

    const result = rows.map((r) => ({
      date: r.trend_date,
      amount: Number(r.day_sales) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error in getSalesTrend:', error);
    res.status(500).json({
      message: error.message || 'Failed to load sales trend',
    });
  }
};

/**
 * GET /api/dashboard/top-products
 */
exports.getTopProducts = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        pr.product_name AS product_name,
        SUM(IFNULL(ii.quantity, 0)) AS qty_sold
      FROM invoice_items ii
      INNER JOIN products pr ON pr.product_id = ii.product_id
      GROUP BY pr.product_id, pr.product_name
      ORDER BY qty_sold DESC
      LIMIT 5
      `
    );

    const result = rows.map((r) => ({
      name: r.product_name,
      quantitySold: Number(r.qty_sold) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error in getTopProducts:', error);
    res.status(500).json({
      message: error.message || 'Failed to load top products',
    });
  }
};

/**
 * GET /api/dashboard/recent-sales
 */
exports.getRecentSales = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        sh.invoice_no AS invoice_no,
        sh.customer_name AS customer_name,
        IFNULL(sh.total_amount, 0) AS total_amount,
        sh.created_at AS sale_at
      FROM sales_headers sh
      ORDER BY sh.sale_id DESC
      LIMIT 5
      `
    );

    const result = rows.map((r) => ({
      invoiceNo: r.invoice_no,
      customer: r.customer_name ?? '',
      amount: Number(r.total_amount) || 0,
      date:
        r.sale_at instanceof Date
          ? r.sale_at.toISOString()
          : String(r.sale_at || ''),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error in getRecentSales:', error);
    res.status(500).json({
      message: error.message || 'Failed to load recent sales',
    });
  }
};

/**
 * GET /api/dashboard/low-stock
 */
exports.getLowStock = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        p.product_name AS product_name,
        SUM(IFNULL(sb.qty_available, 0)) AS stock_qty,
        ${REORDER_SQL} AS reorder_level
      FROM products p
      INNER JOIN stock_batches sb ON sb.product_id = p.product_id
      GROUP BY p.product_id, p.product_name
      HAVING SUM(IFNULL(sb.qty_available, 0)) <= ${REORDER_SQL}
      ORDER BY stock_qty ASC, p.product_name ASC
      `
    );

    const result = rows.map((r) => ({
      productName: r.product_name,
      stockQty: Number(r.stock_qty) || 0,
      reorderLevel: Number(r.reorder_level) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error in getLowStock:', error);
    res.status(500).json({
      message: error.message || 'Failed to load low stock',
    });
  }
};

/**
 * GET /api/dashboard/expiry-alerts
 */
exports.getExpiryAlerts = async (req, res) => {
  const pool = req.app.locals.db;

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        p.product_name AS product_name,
        sb.batch_no AS batch_no,
        DATE_FORMAT(sb.expiry_date, '%Y-%m-%d') AS expiry_date,
        DATEDIFF(sb.expiry_date, CURDATE()) AS days_left
      FROM stock_batches sb
      INNER JOIN products p ON p.product_id = sb.product_id
      WHERE sb.expiry_date IS NOT NULL
        AND sb.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY sb.expiry_date ASC, p.product_name ASC
      `
    );

    const result = rows.map((r) => ({
      productName: r.product_name,
      batchNo: r.batch_no,
      expiryDate: r.expiry_date,
      daysLeft: Number(r.days_left) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error in getExpiryAlerts:', error);
    res.status(500).json({
      message: error.message || 'Failed to load expiry alerts',
    });
  }
};
