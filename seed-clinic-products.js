/**
 * Import 20 dummy clinic products, one opening purchase, stock batches and movements.
 * Usage: node seed-clinic-products.js
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./utils/env');
loadEnv();

const { pool } = require('./config/db');

const splitStatements = (sql) => {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.split('\n').every((line) => line.trim().startsWith('--') || line.trim() === ''));
};

const run = async () => {
  const sqlPath = path.join(__dirname, 'seeds', 'clinic-dummy-products.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(sql);
  const connection = await pool.getConnection();

  try {
    for (const statement of statements) {
      await connection.query(statement);
    }

    const [rows] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM products WHERE sku LIKE 'CLN-%') AS products,
         (SELECT COUNT(*) FROM stock_batches sb
            INNER JOIN products p ON p.product_id = sb.product_id
            WHERE p.sku LIKE 'CLN-%') AS batches,
         (SELECT COUNT(*) FROM purchase_items pi
            INNER JOIN purchase_headers ph ON ph.purchase_id = pi.purchase_id
            WHERE ph.invoice_number = 'CLN-SEED-2026-001') AS purchase_items,
         (SELECT total_amount FROM purchase_headers WHERE invoice_number = 'CLN-SEED-2026-001' LIMIT 1) AS invoice_total`
    );

    console.log('Clinic dummy catalog imported.');
    console.log(`Products: ${rows[0].products}`);
    console.log(`Stock batches: ${rows[0].batches}`);
    console.log(`Purchase lines: ${rows[0].purchase_items}`);
    console.log(`Invoice CLN-SEED-2026-001 total: ${rows[0].invoice_total}`);
  } finally {
    connection.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error('Failed to import clinic products:', error.message);
  process.exit(1);
});
