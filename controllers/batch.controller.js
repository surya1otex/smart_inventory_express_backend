/**
 * Batch Controller
 * Batch-level barcode lookup for pharmacy sales scanning
 */

const { pool } = require('../config/db');

/**
 * GET /api/batches/barcode/:barcode
 * Resolve a batch barcode to product + batch details for POS billing.
 */
const getByBarcode = async (req, res) => {
  try {
    const barcode = (req.params.barcode || '').trim();

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'Barcode is required',
        data: null
      });
    }

    const [rows] = await pool.execute(
      `SELECT
        sb.batch_id,
        sb.product_id,
        p.product_name,
        sb.batch_no,
        sb.barcode,
        sb.expiry_date,
        sb.qty_available,
        sb.mrp,
        sb.sale_rate,
        p.tax_percent
      FROM stock_batches sb
      INNER JOIN products p ON p.product_id = sb.product_id
      WHERE sb.barcode = ?`,
      [barcode]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch barcode not found',
        data: null
      });
    }

    const batch = rows[0];

    if (Number(batch.qty_available) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock not available',
        data: null
      });
    }

    if (batch.expiry_date) {
      const [expiryCheck] = await pool.execute(
        'SELECT ? < CURDATE() AS is_expired',
        [batch.expiry_date]
      );
      if (expiryCheck[0]?.is_expired === 1) {
        return res.status(400).json({
          success: false,
          message: 'Batch expired',
          data: null
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Batch found successfully',
      data: {
        batch_id: batch.batch_id,
        product_id: batch.product_id,
        product_name: batch.product_name,
        batch_no: batch.batch_no,
        barcode: batch.barcode,
        expiry_date: batch.expiry_date,
        qty_available: Number(batch.qty_available),
        mrp: batch.mrp != null ? Number(batch.mrp) : null,
        sale_rate: batch.sale_rate != null ? Number(batch.sale_rate) : null,
        tax_percent: batch.tax_percent != null ? Number(batch.tax_percent) : 0
      }
    });
  } catch (error) {
    console.error('Error in getByBarcode:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching batch by barcode',
      data: null
    });
  }
};

module.exports = { getByBarcode };
