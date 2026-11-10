// Creates the first chairperson account so someone can log in and add the other members.
// Usage: npm run create-admin -- "Jane Wanjiru" 0712345678 secret123
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function main() {
  const [fullName, phone, password] = process.argv.slice(2);
  if (!fullName || !phone || !password || password.length < 6) {
    console.error('Usage: npm run create-admin -- "Full Name" <phone> <password of 6+ characters>');
    process.exit(1);
  }

  const [result] = await db.query('INSERT INTO members SET ?', [{
    full_name: fullName,
    phone,
    role: 'chairperson',
    password: await bcrypt.hash(password, 10),
    joined_at: new Date().toISOString().slice(0, 10),
  }]);
  await db.query("UPDATE members SET member_no = CONCAT('M', LPAD(id, 3, '0')) WHERE id = ?", [result.insertId]);
  console.log(`Chairperson ${fullName} created. Log in with phone ${phone}.`);
  await db.end();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
