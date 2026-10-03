-- Batch-level barcode support for pharmacy inventory
-- Run once against the smart inventory MySQL database.

ALTER TABLE stock_batches
ADD COLUMN barcode VARCHAR(100) NULL AFTER batch_no,
ADD UNIQUE KEY uk_batch_barcode (barcode);

-- Backfill barcodes for existing batches (optional, run after column is added)
-- UPDATE stock_batches
-- SET barcode = CONCAT('MED-', product_id, '-', batch_id)
-- WHERE barcode IS NULL;
