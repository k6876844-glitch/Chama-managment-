const db = require('../config/db');
const { isOfficial, scopedMemberId, requireFields, where, today, getSetting } = require('../utils/helpers');

const PAID = '(SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r WHERE r.loan_id = l.id)';
const BASE = `SELECT l.*, m.full_name AS member_name, ${PAID} AS amount_paid, l.total_due - ${PAID} AS balance
  FROM loans l JOIN members m ON m.id = l.member_id`;

async function findLoan(id) {
  const [rows] = await db.query(`${BASE} WHERE l.id = ?`, [id]);
  return rows[0];
}

async function list(req, res) {
  const filter = where([
    ['l.member_id = ?', scopedMemberId(req)],
    ['l.status = ?', req.query.status],
  ]);
  const [rows] = await db.query(`${BASE}${filter.sql} ORDER BY l.applied_at DESC, l.id DESC`, filter.params);
  res.json(rows);
}

async function show(req, res) {
  const loan = await findLoan(req.params.id);
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  if (!isOfficial(req.user) && loan.member_id !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own loans' });
  }
  const [repayments] = await db.query(
    'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY payment_date, id', [loan.id]);
  res.json({ ...loan, repayments });
}

// Any member can apply for themselves. Officials can also record a loan for another member.
async function apply(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['principal']);
  if (invalid) return res.status(422).json(invalid);
  const principal = Number(body.principal);
  if (!(principal > 0)) return res.status(422).json({ message: 'Loan amount must be more than zero' });

  const official = isOfficial(req.user);
  const memberId = official && body.member_id ? Number(body.member_id) : req.user.id;
  const rate = official && body.interest_rate != null
    ? Number(body.interest_rate)
    : Number(await getSetting('loan_interest_rate', 10));

  const [result] = await db.query('INSERT INTO loans SET ?', [{
    member_id: memberId,
    principal,
    interest_rate: rate,
    total_due: Math.round(principal * (1 + rate / 100) * 100) / 100,
    purpose: body.purpose || null,
    due_date: body.due_date || null,
    applied_at: today(),
    recorded_by: req.user.id,
  }]);
  res.status(201).json(await findLoan(result.insertId));
}

async function approve(req, res) {
  const [result] = await db.query(
    "UPDATE loans SET status = 'active', approved_by = ?, issue_date = COALESCE(issue_date, ?) WHERE id = ? AND status = 'pending'",
    [req.user.id, today(), req.params.id]);
  if (!result.affectedRows) return res.status(409).json({ message: 'Only pending loans can be approved' });
  res.json(await findLoan(req.params.id));
}

async function reject(req, res) {
  const [result] = await db.query(
    "UPDATE loans SET status = 'rejected', approved_by = ? WHERE id = ? AND status = 'pending'",
    [req.user.id, req.params.id]);
  if (!result.affectedRows) return res.status(409).json({ message: 'Only pending loans can be rejected' });
  res.json(await findLoan(req.params.id));
}

// Records a repayment and marks the loan cleared once it is fully paid.
async function repay(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['amount']);
  if (invalid) return res.status(422).json(invalid);
  const amount = Number(body.amount);
  if (!(amount > 0)) return res.status(422).json({ message: 'Amount must be more than zero' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[loan]] = await conn.query('SELECT * FROM loans WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!loan) {
      await conn.rollback();
      return res.status(404).json({ message: 'Loan not found' });
    }
    if (loan.status !== 'active') {
      await conn.rollback();
      return res.status(409).json({ message: 'Repayments can only be recorded on active loans' });
    }
    const [[{ paid }]] = await conn.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM loan_repayments WHERE loan_id = ?', [loan.id]);
    const balance = loan.total_due - paid;
    if (amount > balance + 0.001) {
      await conn.rollback();
      return res.status(422).json({ message: `Amount is more than the loan balance of KES ${balance.toFixed(2)}` });
    }

    await conn.query('INSERT INTO loan_repayments SET ?', [{
      loan_id: loan.id,
      amount,
      method: body.method || 'mpesa',
      reference: body.reference || null,
      payment_date: body.payment_date || today(),
      recorded_by: req.user.id,
    }]);
    if (amount >= balance - 0.001) await conn.query("UPDATE loans SET status = 'cleared' WHERE id = ?", [loan.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  res.status(201).json(await findLoan(req.params.id));
}

module.exports = { list, show, apply, approve, reject, repay };
