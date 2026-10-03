/**
 * Barcode Generator Utility
 * Generates internal barcode: "101" + YEAR + product_id (padded to 5 digits)
 * Example: 101202500001 for product_id 1 in year 2025
 */

const generateInternalBarcode = (productId) => {
  const prefix = '101';
  const year = new Date().getFullYear();
  const paddedProductId = String(productId).padStart(5, '0');
  
  return `${prefix}${year}${paddedProductId}`;
};

/**
 * Batch barcode: MED-{product_id}-{batch_id}
 * Example: MED-12-58
 */
const generateBatchBarcode = (productId, batchId) => {
  return `MED-${productId}-${batchId}`;
};

module.exports = { generateInternalBarcode, generateBatchBarcode };

