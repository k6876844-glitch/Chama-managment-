const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { requireFields, today } = require('../utils/helpers');
const { MEMBER_FIELDS } = require('./members.controller');

async function login(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['phone', 'password']);
  if (invalid) return res.status(422).json(invalid);

  const [rows] = await db.query('SELECT * FROM members WHERE phone = ?', [body.phone]);
  const member = rows[0];
  if (!member || !(await bcrypt.compare(String(body.password), member.password))) {
    return res.status(401).json({ message: 'Wrong phone number or password' });
  }
  if (member.status !== 'active') {
    return res.status(403).json({ message: 'This account has been deactivated' });
  }

  delete member.password;
  res.json({ token: signToken(member), user: member });
}

// Self sign-up. New accounts are always ordinary members: only the chairperson
// can give someone an official role later, from the Members page.
async function register(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['full_name', 'phone', 'password']);
  if (invalid) return res.status(422).json(invalid);
  if (String(body.password).length < 6) {
    return res.status(422).json({ message: 'Password must be at least 6 characters' });
  }

  const phone = String(body.phone).trim();
  const email = body.email ? String(body.email).trim() : null;
  const [taken] = await db.query('SELECT phone, email FROM members WHERE phone = ? OR (email IS NOT NULL AND email = ?)', [phone, email]);
  if (taken.some(m => m.phone === phone)) {
    return res.status(422).json({ message: 'An account with this phone number already exists. Please log in.' });
  }
  if (taken.length) return res.status(422).json({ message: 'An account with this email already exists' });

  const [result] = await db.query('INSERT INTO members SET ?', [{
    full_name: String(body.full_name).trim(),
    phone,
    email,
    id_number: body.id_number ? String(body.id_number).trim() : null,
    role: 'member',
    password: await bcrypt.hash(String(body.password), 10),
    joined_at: today(),
  }]);
  await db.query("UPDATE members SET member_no = CONCAT('M', LPAD(id, 3, '0')) WHERE id = ?", [result.insertId]);

  const [rows] = await db.query(`SELECT ${MEMBER_FIELDS} FROM members WHERE id = ?`, [result.insertId]);
  res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
}

function signToken(member) {
  return jwt.sign({ id: member.id, role: member.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

async function me(req, res) {
  const [rows] = await db.query(`SELECT ${MEMBER_FIELDS} FROM members WHERE id = ?`, [req.user.id]);
  if (!rows[0]) return res.status(401).json({ message: 'Please log in first' });
  res.json(rows[0]);
}

// JWTs are stateless, so logging out is just the frontend forgetting the token.
async function logout(req, res) {
  res.json({ message: 'Logged out' });
}

module.exports = { login, register, me, logout };
