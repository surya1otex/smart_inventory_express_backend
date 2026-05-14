const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { loadEnv } = require('../utils/env');
loadEnv();

const { pool } = require('../config/db');

const ensureUsersTable = async () => {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('ADMIN','STAFF') DEFAULT 'STAFF',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await pool.execute(createTableSql);
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'JWT secret is not configured'
      });
    }

    await ensureUsersTable();

    const [rows] = await pool.execute(
      `SELECT user_id, full_name, username, password_hash, role, is_active
       FROM users
       WHERE username = ?
       LIMIT 1`,
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Auth login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const me = async (req, res) => {
  try {
    await ensureUsersTable();

    const [rows] = await pool.execute(
      `SELECT user_id, full_name, username, role, is_active, created_at
       FROM users
       WHERE user_id = ? AND is_active = 1
       LIMIT 1`,
      [req.user.user_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0]
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
};

module.exports = {
  login,
  me,
  logout
};
