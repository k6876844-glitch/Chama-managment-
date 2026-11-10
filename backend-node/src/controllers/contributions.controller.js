const db = require('../config/db');
const { scopedMemberId, requireFields, pick, where, today } = require('../utils/helpers');

const BASE = `SELECT c.*, m.full_name AS member_name
  FROM contributions c JOIN members m ON m.id = c.member_id`;
const EDITABLE = ['member_id', 'amount', 'method', 'reference', 'contribution_date', 'notes'];

async function findContribution(id) {
  const [rows] = await db.query(`${BASE} WHERE c.id = ?`, [id]);
  return rows[0];
}

async function list(req, res) {
  const filter = where([
    ['c.member_id = ?', scopedMemberId(req)],
    ['c.contribution_date >= ?', req.query.from],
    ['c.contribution_date <= ?', req.query.to],
  ]);
  const [rows] = await db.query(`${BASE}${filter.sql} ORDER BY c.contribution_date DESC, c.id DESC`, filter.params);
  res.json(rows);
}

async function create(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['member_id', 'amount']);
  if (invalid) return res.status(422).json(invalid);
  if (!(Number(body.amount) > 0)) return res.status(422).json({ message: 'Amount must be more than zero' });

  const data = pick(body, EDITABLE);
  data.method = data.method || 'mpesa';
  data.contribution_date = data.contribution_date || today();
  data.recorded_by = req.user.id;

  const [result] = await db.query('INSERT INTO contributions SET ?', [data]);
  res.status(201).json(await findContribution(result.insertId));
}

async function update(req, res) {
  const data = pick(req.body || {}, EDITABLE);
  if (data.amount !== undefined && !(Number(data.amount) > 0)) {
    return res.status(422).json({ message: 'Amount must be more than zero' });
  }
  if (Object.keys(data).length) await db.query('UPDATE contributions SET ? WHERE id = ?', [data, req.params.id]);
  const row = await findContribution(req.params.id);
  if (!row) return res.status(404).json({ message: 'Contribution not found' });
  res.json(row);
}

async function remove(req, res) {
  const [result] = await db.query('DELETE FROM contributions WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Contribution not found' });
  res.status(204).end();
}

module.exports = { list, create, update, remove };
