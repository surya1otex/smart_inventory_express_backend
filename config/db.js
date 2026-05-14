/**
 * MySQL Database Connection Pool
 * Uses mysql2/promise for async/await support
 */

const mysql = require('mysql2/promise');
const { loadEnv } = require('../utils/env');
loadEnv();

console.log("============== ENV DEBUG ==============");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("=======================================");

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    //console.error('❌ Database connection failed:', error.message);
    console.error('❌ Database connection failed FULL:', error);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };

