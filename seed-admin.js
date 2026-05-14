const bcrypt = require('bcryptjs');
const { loadEnv } = require('./utils/env');
loadEnv();

const { pool } = require('./config/db');

const ensureUsersTable = async () => {
  const sql = `
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

  await pool.execute(sql);
};

const seedAdminUser = async () => {
  const fullName = process.env.ADMIN_FULL_NAME || process.env.ADMIN_FULLNAME || 'Admin User';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error('ADMIN_PASSWORD is required in .env to seed admin user');
  }

  await ensureUsersTable();

  const passwordHash = await bcrypt.hash(password, 12);
  const [existingRows] = await pool.execute(
    'SELECT user_id FROM users WHERE username = ? LIMIT 1',
    [username]
  );

  if (existingRows.length) {
    await pool.execute(
      `UPDATE users
       SET full_name = ?, password_hash = ?, role = 'ADMIN', is_active = 1
       WHERE username = ?`,
      [fullName, passwordHash, username]
    );
    console.log(`Admin user updated: ${username}`);
    return;
  }

  await pool.execute(
    `INSERT INTO users (full_name, username, password_hash, role, is_active)
     VALUES (?, ?, ?, 'ADMIN', 1)`,
    [fullName, username, passwordHash]
  );
  console.log(`Admin user created: ${username}`);
};

const run = async () => {
  try {
    await seedAdminUser();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  run();
}

module.exports = {
  seedAdminUser
};
