require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function main() {
  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin1234';
  const hash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO users (username, password_hash, role, is_active)
     VALUES (?, ?, 'SUPER_ADMIN', TRUE)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'SUPER_ADMIN', is_active = TRUE`,
    [username, hash]
  );
  console.log(`Admin ready: ${username}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
