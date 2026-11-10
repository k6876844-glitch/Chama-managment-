// Creates the database named in .env (if needed) and runs database/schema.sql.
// Usage: npm run db:init
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const name = process.env.DB_NAME || 'chama';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${name}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8'));
  await conn.end();
  console.log(`Database "${name}" is ready. Next: npm run create-admin -- "Full Name" 0712345678 password`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
