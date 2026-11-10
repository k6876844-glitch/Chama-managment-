const db = require('../config/db');
const { requireFields, pick, where, today } = require('../utils/helpers');

const EDITABLE = ['category', 'description', 'amount', 'expense_date', 'receipt_ref'];

async function findExpense(id) {
  const [rows] = await db.query('SELECT * FROM expenses WHERE id = ?', [id]);
  return rows[0];
}

async function list(req, res) {
  const filter = where([
    ['expense_date >= ?', req.query.from],
    ['expense_date <= ?', req.query.to],
  ]);
  const [rows] = await db.query(`SELECT * FROM expenses${filter.sql} ORDER BY expense_date DESC, id DESC`, filter.params);
  res.json(rows);
}

async function create(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['category', 'amount']);
  if (invalid) return res.status(422).json(invalid);
  if (!(Number(body.amount) > 0)) return res.status(422).json({ message: 'Amount must be more than zero' });

  const data = pick(body, EDITABLE);
  data.expense_date = data.expense_date || today();
  data.recorded_by = req.user.id;

  const [result] = await db.query('INSERT INTO expenses SET ?', [data]);
  res.status(201).json(await findExpense(result.insertId));
}

async function update(req, res) {
  const data = pick(req.body || {}, EDITABLE);
  if (data.amount !== undefined && !(Number(data.amount) > 0)) {
    return res.status(422).json({ message: 'Amount must be more than zero' });
  }
  if (Object.keys(data).length) await db.query('UPDATE expenses SET ? WHERE id = ?', [data, req.params.id]);
  const row = await findExpense(req.params.id);
  if (!row) return res.status(404).json({ message: 'Expense not found' });
  res.json(row);
}

async function remove(req, res) {
  const [result] = await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Expense not found' });
  res.status(204).end();
}

module.exports = { list, create, update, remove };
