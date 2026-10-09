-- 20 dummy clinic products with opening purchase, stock batches and inventory movements.
-- Safe to run more than once: existing SKUs, invoice CLN-SEED-2026-001 and batch numbers are skipped.
-- Stock quantity is in the product base unit (tablet, capsule, bottle, piece, and so on).

SET @barcode_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE stock_batches ADD COLUMN barcode VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_batches'
    AND COLUMN_NAME = 'barcode'
);
PREPARE barcode_stmt FROM @barcode_sql;
EXECUTE barcode_stmt;
DEALLOCATE PREPARE barcode_stmt;

SET @barcode_index_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE stock_batches ADD UNIQUE KEY uk_batch_barcode (barcode)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_batches'
    AND INDEX_NAME = 'uk_batch_barcode'
);
PREPARE barcode_index_stmt FROM @barcode_index_sql;
EXECUTE barcode_index_stmt;
DEALLOCATE PREPARE barcode_index_stmt;

DROP TEMPORARY TABLE IF EXISTS tmp_clinic_seed;
CREATE TEMPORARY TABLE tmp_clinic_seed (
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  barcode VARCHAR(100) NOT NULL,
  pack_unit VARCHAR(20) NOT NULL,
  base_unit VARCHAR(20) NOT NULL,
  unit_per_pack INT NOT NULL,
  hsn_code VARCHAR(20) NOT NULL,
  tax_percent DECIMAL(5,2) NOT NULL,
  purchase_price_pack DECIMAL(10,2) NOT NULL,
  selling_price_unit DECIMAL(10,2) NOT NULL,
  mrp_pack DECIMAL(10,2) NOT NULL,
  min_stock_alert INT NOT NULL,
  schedule_category VARCHAR(50) NULL,
  salt_composition LONGTEXT NULL,
  batch_no VARCHAR(50) NOT NULL,
  batch_barcode VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  paid_qty INT NOT NULL,
  free_qty INT NOT NULL
);

INSERT INTO tmp_clinic_seed (
  sku, product_name, category_name, barcode, pack_unit, base_unit, unit_per_pack,
  hsn_code, tax_percent, purchase_price_pack, selling_price_unit, mrp_pack,
  min_stock_alert, schedule_category, salt_composition, batch_no, batch_barcode,
  expiry_date, paid_qty, free_qty
) VALUES
('CLN-MED-001', 'Paracetamol 500 mg Tablet', 'Clinic Medicines', 'CLN1000000001', 'strip', 'tablet', 10, '30049099', 12.00, 18.00, 2.50, 30.00, 50, NULL, '[{"salt":"Paracetamol","strength":"500 mg"}]', 'CLN26P001', 'BCLN0001', '2028-06-30', 200, 20),
('CLN-MED-002', 'Ibuprofen 400 mg Tablet', 'Clinic Medicines', 'CLN1000000002', 'strip', 'tablet', 10, '30049099', 12.00, 22.00, 3.00, 35.00, 40, 'H', '[{"salt":"Ibuprofen","strength":"400 mg"}]', 'CLN26P002', 'BCLN0002', '2028-03-31', 150, 0),
('CLN-MED-003', 'Amoxicillin 500 mg Capsule', 'Clinic Medicines', 'CLN1000000003', 'strip', 'capsule', 10, '30049099', 12.00, 85.00, 12.00, 120.00, 30, 'H', '[{"salt":"Amoxicillin","strength":"500 mg"}]', 'CLN26P003', 'BCLN0003', '2027-11-30', 100, 0),
('CLN-MED-004', 'Azithromycin 500 mg Tablet', 'Clinic Medicines', 'CLN1000000004', 'strip', 'tablet', 3, '30049099', 12.00, 48.00, 22.00, 72.00, 15, 'H', '[{"salt":"Azithromycin","strength":"500 mg"}]', 'CLN26P004', 'BCLN0004', '2027-09-30', 30, 0),
('CLN-MED-005', 'Cetirizine 10 mg Tablet', 'Clinic Medicines', 'CLN1000000005', 'strip', 'tablet', 10, '30049099', 12.00, 8.00, 1.50, 15.00, 40, NULL, '[{"salt":"Cetirizine","strength":"10 mg"}]', 'CLN26P005', 'BCLN0005', '2028-12-31', 250, 0),
('CLN-MED-006', 'Pantoprazole 40 mg Tablet', 'Clinic Medicines', 'CLN1000000006', 'strip', 'tablet', 10, '30049099', 12.00, 35.00, 5.00, 55.00, 30, 'H', '[{"salt":"Pantoprazole","strength":"40 mg"}]', 'CLN26P006', 'BCLN0006', '2027-08-31', 120, 0),
('CLN-MED-007', 'Ondansetron 4 mg Tablet', 'Clinic Medicines', 'CLN1000000007', 'strip', 'tablet', 10, '30049099', 12.00, 28.00, 4.00, 45.00, 20, 'H', '[{"salt":"Ondansetron","strength":"4 mg"}]', 'CLN26P007', 'BCLN0007', '2027-12-31', 80, 0),
('CLN-MED-008', 'Diclofenac 50 mg Tablet', 'Clinic Medicines', 'CLN1000000008', 'strip', 'tablet', 10, '30049099', 12.00, 12.00, 2.00, 20.00, 20, 'H', '[{"salt":"Diclofenac","strength":"50 mg"}]', 'CLN26P008', 'BCLN0008', '2028-01-31', 100, 0),
('CLN-MED-009', 'ORS Powder 21.8 g Sachet', 'Clinic Medicines', 'CLN1000000009', 'box', 'sachet', 1, '30049099', 12.00, 18.00, 22.00, 25.00, 20, NULL, '[{"salt":"Oral Rehydration Salts","strength":"21.8 g"}]', 'CLN26P009', 'BCLN0009', '2027-06-30', 100, 0),
('CLN-INJ-001', 'Normal Saline 0.9% 500 ml', 'Clinic Injections', 'CLN1000000010', 'bottle', 'bottle', 1, '30049099', 12.00, 32.00, 45.00, 55.00, 10, NULL, '[{"salt":"Sodium Chloride","strength":"0.9%"}]', 'CLN26I001', 'BCLN0010', '2027-10-31', 40, 0),
('CLN-INJ-002', 'Dextrose 5% 500 ml', 'Clinic Injections', 'CLN1000000011', 'bottle', 'bottle', 1, '30049099', 12.00, 36.00, 50.00, 60.00, 8, NULL, '[{"salt":"Dextrose","strength":"5%"}]', 'CLN26I002', 'BCLN0011', '2027-10-31', 30, 0),
('CLN-INJ-003', 'Diclofenac Injection 75 mg/ml', 'Clinic Injections', 'CLN1000000012', 'ampoule', 'ampoule', 1, '30049099', 12.00, 9.50, 18.00, 25.00, 10, 'H', '[{"salt":"Diclofenac","strength":"75 mg/ml"}]', 'CLN26I003', 'BCLN0012', '2027-05-31', 50, 0),
('CLN-INJ-004', 'Ondansetron Injection 2 mg/ml', 'Clinic Injections', 'CLN1000000013', 'ampoule', 'ampoule', 1, '30049099', 12.00, 7.00, 15.00, 22.00, 10, 'H', '[{"salt":"Ondansetron","strength":"2 mg/ml"}]', 'CLN26I004', 'BCLN0013', '2027-07-31', 40, 0),
('CLN-CON-001', 'Disposable Syringe 5 ml', 'Clinic Consumables', 'CLN1000000014', 'box', 'piece', 1, '90183100', 12.00, 4.50, 8.00, 12.00, 50, NULL, NULL, 'CLN26C001', 'BCLN0014', '2029-03-31', 200, 0),
('CLN-CON-002', 'IV Cannula 20G', 'Clinic Consumables', 'CLN1000000015', 'piece', 'piece', 1, '90183990', 12.00, 8.00, 15.00, 22.00, 20, NULL, NULL, 'CLN26C002', 'BCLN0015', '2028-09-30', 100, 0),
('CLN-CON-003', 'Sterile Gauze 10 cm x 10 cm', 'Clinic Consumables', 'CLN1000000016', 'pack', 'piece', 1, '30059090', 12.00, 3.00, 6.00, 10.00, 30, NULL, NULL, 'CLN26C003', 'BCLN0016', '2028-04-30', 150, 0),
('CLN-CON-004', 'Surgical Gloves Medium', 'Clinic Consumables', 'CLN1000000017', 'pair', 'pair', 1, '40151200', 12.00, 6.50, 12.00, 18.00, 20, NULL, NULL, 'CLN26C004', 'BCLN0017', '2028-08-31', 80, 0),
('CLN-DIA-001', 'Blood Glucose Test Strip', 'Clinic Diagnostics', 'CLN1000000018', 'box', 'strip', 1, '38221990', 12.00, 12.00, 18.00, 25.00, 40, NULL, NULL, 'CLN26D001', 'BCLN0018', '2026-12-20', 25, 0),
('CLN-DIA-002', 'Digital Thermometer', 'Clinic Diagnostics', 'CLN1000000019', 'piece', 'piece', 1, '90251910', 18.00, 85.00, 150.00, 199.00, 5, NULL, NULL, 'CLN26D002', 'BCLN0019', '2030-01-31', 15, 0),
('CLN-CON-005', 'Povidone Iodine Solution 100 ml', 'Clinic Consumables', 'CLN1000000020', 'bottle', 'bottle', 1, '30049011', 12.00, 42.00, 65.00, 85.00, 6, NULL, '[{"salt":"Povidone Iodine","strength":"5% w/v"}]', 'CLN26C005', 'BCLN0020', '2027-12-31', 24, 0);

INSERT INTO categories (category_name, description)
SELECT DISTINCT
  t.category_name,
  CASE t.category_name
    WHEN 'Clinic Medicines' THEN 'Oral medicines dispensed in the clinic'
    WHEN 'Clinic Injections' THEN 'IV fluids and injectable ampoules'
    WHEN 'Clinic Consumables' THEN 'Syringes, cannulas, gauze, gloves and antiseptics'
    WHEN 'Clinic Diagnostics' THEN 'Thermometers and point-of-care test supplies'
  END
FROM tmp_clinic_seed t
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_name = t.category_name
);

INSERT INTO suppliers (name, phone, email, gstin, address)
SELECT
  'Aarogya Clinic Distributors',
  '08041230021',
  'orders@aarogya-clinic-distributors.example',
  '29ABCDE1234F1Z5',
  '14, Dispensary Lane, Bengaluru, Karnataka 560001'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers WHERE name = 'Aarogya Clinic Distributors'
);

INSERT INTO products (
  category_id, product_name, sku, barcode, pack_unit, base_unit, unit_per_pack,
  hsn_code, tax_percent, purchase_price_pack, selling_price_unit, mrp_pack,
  min_stock_alert, is_batch_tracked, batch_mandatory, default_batch_allocation,
  schedule_category, salt_composition
)
SELECT
  c.category_id,
  t.product_name,
  t.sku,
  t.barcode,
  t.pack_unit,
  t.base_unit,
  t.unit_per_pack,
  t.hsn_code,
  t.tax_percent,
  t.purchase_price_pack,
  t.selling_price_unit,
  t.mrp_pack,
  t.min_stock_alert,
  1,
  1,
  'FEFO',
  t.schedule_category,
  t.salt_composition
FROM tmp_clinic_seed t
INNER JOIN categories c ON c.category_name = t.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.sku = t.sku
);

INSERT INTO purchase_headers (
  supplier_id, invoice_number, invoice_date, purchase_type, notes,
  subtotal, gst_total, total_amount, created_at, updated_at
)
SELECT
  s.supplier_id,
  'CLN-SEED-2026-001',
  '2026-10-01',
  'Credit',
  'Opening dummy stock for clinic demo. Invoice CLN-SEED-2026-001.',
  0,
  0,
  0,
  NOW(),
  NOW()
FROM suppliers s
WHERE s.name = 'Aarogya Clinic Distributors'
  AND NOT EXISTS (
    SELECT 1
    FROM purchase_headers ph
    WHERE ph.supplier_id = s.supplier_id
      AND ph.invoice_number = 'CLN-SEED-2026-001'
  );

INSERT INTO purchase_items (
  purchase_id, product_id, qty, free_qty, purchase_rate, sale_rate, mrp, gst_percent, line_total
)
SELECT
  ph.purchase_id,
  p.product_id,
  t.paid_qty,
  t.free_qty,
  ROUND(t.purchase_price_pack / t.unit_per_pack, 2),
  t.selling_price_unit,
  ROUND(t.mrp_pack / t.unit_per_pack, 2),
  t.tax_percent,
  ROUND(t.paid_qty * (t.purchase_price_pack / t.unit_per_pack), 2)
FROM tmp_clinic_seed t
INNER JOIN products p ON p.sku = t.sku
INNER JOIN suppliers s ON s.name = 'Aarogya Clinic Distributors'
INNER JOIN purchase_headers ph
  ON ph.supplier_id = s.supplier_id
 AND ph.invoice_number = 'CLN-SEED-2026-001'
WHERE NOT EXISTS (
  SELECT 1
  FROM purchase_items pi
  WHERE pi.purchase_id = ph.purchase_id
    AND pi.product_id = p.product_id
);

UPDATE purchase_headers ph
INNER JOIN (
  SELECT
    pi.purchase_id,
    ROUND(SUM(pi.line_total), 2) AS subtotal,
    ROUND(SUM(pi.line_total * pi.gst_percent / 100), 2) AS gst_total
  FROM purchase_items pi
  GROUP BY pi.purchase_id
) totals ON totals.purchase_id = ph.purchase_id
INNER JOIN suppliers s ON s.supplier_id = ph.supplier_id
SET
  ph.subtotal = totals.subtotal,
  ph.gst_total = totals.gst_total,
  ph.total_amount = ROUND(totals.subtotal + totals.gst_total, 2),
  ph.updated_at = NOW()
WHERE s.name = 'Aarogya Clinic Distributors'
  AND ph.invoice_number = 'CLN-SEED-2026-001';

INSERT INTO stock_batches (
  product_id, purchase_id, batch_no, barcode, expiry_date,
  qty_in, qty_out, qty_available, purchase_rate, sale_rate, mrp
)
SELECT
  p.product_id,
  ph.purchase_id,
  t.batch_no,
  t.batch_barcode,
  t.expiry_date,
  t.paid_qty + t.free_qty,
  0,
  t.paid_qty + t.free_qty,
  ROUND(t.purchase_price_pack / t.unit_per_pack, 2),
  t.selling_price_unit,
  ROUND(t.mrp_pack / t.unit_per_pack, 2)
FROM tmp_clinic_seed t
INNER JOIN products p ON p.sku = t.sku
INNER JOIN suppliers s ON s.name = 'Aarogya Clinic Distributors'
INNER JOIN purchase_headers ph
  ON ph.supplier_id = s.supplier_id
 AND ph.invoice_number = 'CLN-SEED-2026-001'
WHERE NOT EXISTS (
  SELECT 1
  FROM stock_batches sb
  WHERE sb.product_id = p.product_id
    AND sb.batch_no = t.batch_no
);

INSERT INTO inventory_movements (
  product_id, batch_id, movement_type, qty_in, qty_out, reference_type, reference_id
)
SELECT
  sb.product_id,
  sb.batch_id,
  'PURCHASE',
  sb.qty_in,
  0,
  'PURCHASE',
  sb.purchase_id
FROM stock_batches sb
INNER JOIN products p ON p.product_id = sb.product_id
INNER JOIN tmp_clinic_seed t ON t.sku = p.sku AND t.batch_no = sb.batch_no
WHERE NOT EXISTS (
  SELECT 1
  FROM inventory_movements im
  WHERE im.batch_id = sb.batch_id
    AND im.movement_type = 'PURCHASE'
    AND im.reference_type = 'PURCHASE'
);

DROP TEMPORARY TABLE IF EXISTS tmp_clinic_seed;
