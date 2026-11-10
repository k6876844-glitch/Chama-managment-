const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { ROLES, isOfficial, requireFields, pick, today } = require('../utils/helpers');

const MEMBER_FIELDS = 'id, member_no, full_name, phone, email, id_number, role, status, joined_at, created_at';
const EDITABLE = ['full_name', 'phone', 'email', 'id_number', 'role', 'status', 'joined_at'];

async function findMember(id) {
  const [rows] = await db.query(`SELECT ${MEMBER_FIELDS} FROM members WHERE id = ?`, [id]);
  return rows[0];
}

async function list(req, res) {
  const [rows] = await db.query(`SELECT ${MEMBER_FIELDS} FROM members ORDER BY full_name`);
  res.json(rows);
}

async function show(req, res) {
  const id = Number(req.params.id);
  if (!isOfficial(req.user) && id !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own profile' });
  }
  const member = await findMember(id);
  if (!member) return res.status(404).json({ message: 'Member not found' });
  res.json(member);
}

async function create(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['full_name', 'phone', 'password']);
  if (invalid) return res.status(422).json(invalid);
  if (String(body.password).length < 6) {
    return res.status(422).json({ message: 'Password must be at least 6 characters' });
  }

  const data = pick(body, EDITABLE);
  data.role = data.role || 'member';
  if (!ROLES.includes(data.role)) return res.status(422).json({ message: 'Unknown role' });
  if (data.role !== 'member' && req.user.role !== 'chairperson') {
    return res.status(403).json({ message: 'Only the chairperson can assign official roles' });
  }
  data.joined_at = data.joined_at || today();
  data.password = await bcrypt.hash(String(body.password), 10);

  const [result] = await db.query('INSERT INTO members SET ?', [data]);
  await db.query("UPDATE members SET member_no = CONCAT('M', LPAD(id, 3, '0')) WHERE id = ?", [result.insertId]);
  res.status(201).json(await findMember(result.insertId));
}

async function update(req, res) {
  const body = req.body || {};
  const existing = await findMember(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Member not found' });

  const data = pick(body, EDITABLE);
  if (data.role && !ROLES.includes(data.role)) return res.status(422).json({ message: 'Unknown role' });
  if (data.role && data.role !== existing.role && req.user.role !== 'chairperson') {
    return res.status(403).json({ message: 'Only the chairperson can change roles' });
  }
  if (body.password) {
    if (String(body.password).length < 6) {
      return res.status(422).json({ message: 'Password must be at least 6 characters' });
    }
    data.password = await bcrypt.hash(String(body.password), 10);
  }
  if (Object.keys(data).length) await db.query('UPDATE members SET ? WHERE id = ?', [data, existing.id]);
  res.json(await findMember(existing.id));
}

// Members are never deleted, so their financial history stays intact.
async function deactivate(req, res) {
  if (Number(req.params.id) === req.user.id) {
    return res.status(422).json({ message: 'You cannot deactivate your own account' });
  }
  const [result] = await db.query("UPDATE members SET status = 'inactive' WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Member not found' });
  res.json(await findMember(req.params.id));
}

module.exports = { MEMBER_FIELDS, list, show, create, update, deactivate };
