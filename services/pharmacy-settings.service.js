/**
 * Singleton pharmacy profile used on invoices.
 */

const { pool } = require('../config/db');

let tableReady = null;

const ensureTable = () => {
  if (!tableReady) {
    tableReady = pool
      .execute(
        `CREATE TABLE IF NOT EXISTS pharmacy_settings (
          id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
          pharmacy_name VARCHAR(200) NOT NULL,
          gstin VARCHAR(15) NULL,
          drug_license_numbers TEXT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      )
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
};

const parseLicenses = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    /* stored as plain text */
  }
  return String(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toResponse = (row) => {
  if (!row) {
    return {
      pharmacy_name: '',
      gstin: '',
      drug_license_numbers: [],
      updated_at: null,
      is_configured: false
    };
  }

  return {
    pharmacy_name: row.pharmacy_name || '',
    gstin: row.gstin || '',
    drug_license_numbers: parseLicenses(row.drug_license_numbers),
    updated_at: row.updated_at || null,
    is_configured: true
  };
};

const getSettings = async () => {
  await ensureTable();
  const [rows] = await pool.execute(
    'SELECT pharmacy_name, gstin, drug_license_numbers, updated_at FROM pharmacy_settings WHERE id = 1'
  );
  return {
    success: true,
    message: rows.length ? 'Pharmacy settings loaded' : 'Pharmacy settings are not saved yet',
    data: toResponse(rows[0])
  };
};

const saveSettings = async ({ pharmacy_name, gstin, drug_license_numbers }) => {
  await ensureTable();
  const licenses = JSON.stringify(drug_license_numbers || []);
  const gstinValue = gstin ? String(gstin).trim().toUpperCase() : null;

  await pool.execute(
    `INSERT INTO pharmacy_settings (id, pharmacy_name, gstin, drug_license_numbers)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       pharmacy_name = VALUES(pharmacy_name),
       gstin = VALUES(gstin),
       drug_license_numbers = VALUES(drug_license_numbers)`,
    [pharmacy_name.trim(), gstinValue, licenses]
  );

  return getSettings().then((result) => ({
    ...result,
    message: 'Pharmacy settings saved'
  }));
};

module.exports = { getSettings, saveSettings };
