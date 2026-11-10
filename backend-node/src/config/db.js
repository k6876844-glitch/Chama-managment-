const mysql = require('mysql2/promise');

// One shared connection pool for the whole app.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chama',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as numbers, not strings
  dateStrings: true,    // return DATE columns as 'YYYY-MM-DD'
});

module.exports = pool;
