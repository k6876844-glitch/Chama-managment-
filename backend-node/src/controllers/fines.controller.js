const db = require('../config/db');
const { scopedMemberId, requireFields, pick, where, today } = require('../utils/helpers');

const BASE = `SELECT f.*, m.full_name AS member_name
  FROM fines f JOIN members m ON m.id = f.member_id`;

async function findFine(id) {
  const [rows] = await db.query(`${BASE} WHERE f.id = ?`, [id]);
  return rows[0];
}

async function list(req, res) {
  const filter = where([
    ['f.member_id = ?', scopedMemberId(req)],
    ['f.status = ?', req.query.status],
  ]);
  const [rows] = await db.query(`${BASE}${filter.sql} ORDER BY f.fine_date DESC, f.id DESC`, filter.params);
  res.json(rows);
}

async function create(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['member_id', 'reason', 'amount']);
  if (invalid) return res.status(422).json(invalid);
  if (!(Number(body.amount) > 0)) return res.status(422).json({ message: 'Amount must be more than zero' });

  const data = pick(body, ['member_id', 'reason', 'amount', 'fine_date']);
  data.fine_date = data.fine_date || today();
  data.recorded_by = req.user.id;

  const [result] = await db.query('INSERT INTO fines SET ?', [data]);
  res.status(201).json(await findFine(result.insertId));
}

async function pay(req, res) {
  const [result] = await db.query(
    "UPDATE fines SET status = 'paid', paid_date = ? WHERE id = ? AND status = 'unpaid'", [today(), req.params.id]);
  if (!result.affectedRows) return res.status(409).json({ message: 'Only unpaid fines can be marked as paid' });
  res.json(await findFine(req.params.id));
}

async function waive(req, res) {
  const [result] = await db.query(
    "UPDATE fines SET status = 'waived' WHERE id = ? AND status = 'unpaid'", [req.params.id]);
  if (!result.affectedRows) return res.status(409).json({ message: 'Only unpaid fines can be waived' });
  res.json(await findFine(req.params.id));
}

module.exports = { list, create, pay, waive };
