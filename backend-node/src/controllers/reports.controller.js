const db = require('../config/db');
const { isOfficial } = require('../utils/helpers');
const { MEMBER_FIELDS } = require('./members.controller');

// Group-wide financial summary for officials.
async function summary(req, res) {
  const [[t]] = await db.query(`SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM contributions) AS total_contributions,
    (SELECT COALESCE(SUM(amount), 0) FROM loan_repayments) AS total_repayments,
    (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'paid') AS total_fines_paid,
    (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS total_expenses,
    (SELECT COALESCE(SUM(principal), 0) FROM loans WHERE status IN ('active', 'cleared', 'defaulted')) AS total_loans_issued,
    (SELECT COALESCE(SUM(l.total_due - (SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r WHERE r.loan_id = l.id)), 0)
       FROM loans l WHERE l.status IN ('active', 'defaulted')) AS loans_outstanding,
    (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'unpaid') AS fines_unpaid,
    (SELECT COUNT(*) FROM members WHERE status = 'active') AS active_members`);

  const totalIncome = t.total_contributions + t.total_repayments + t.total_fines_paid;
  res.json({
    ...t,
    total_income: totalIncome,
    cash_at_hand: totalIncome - t.total_loans_issued - t.total_expenses,
  });
}

// One member's contributions, loans, fines and attendance.
async function statement(req, res) {
  const memberId = Number(req.params.memberId);
  if (!isOfficial(req.user) && memberId !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own statement' });
  }
  const [[member]] = await db.query(`SELECT ${MEMBER_FIELDS} FROM members WHERE id = ?`, [memberId]);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  const [contributions] = await db.query(
    'SELECT * FROM contributions WHERE member_id = ? ORDER BY contribution_date DESC, id DESC', [memberId]);
  const [loans] = await db.query(`SELECT l.*,
      (SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r WHERE r.loan_id = l.id) AS amount_paid
    FROM loans l WHERE l.member_id = ? ORDER BY l.applied_at DESC, l.id DESC`, [memberId]);
  const [fines] = await db.query('SELECT * FROM fines WHERE member_id = ? ORDER BY fine_date DESC, id DESC', [memberId]);
  const [[attendance]] = await db.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(status IN ('present', 'late')), 0) AS present
    FROM attendance WHERE member_id = ?`, [memberId]);

  for (const loan of loans) loan.balance = loan.total_due - loan.amount_paid;
  const sum = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);

  res.json({
    member,
    contributions,
    loans,
    fines,
    attendance: { total: Number(attendance.total), present: Number(attendance.present) },
    totals: {
      contributions: sum(contributions, c => c.amount),
      loan_balance: sum(loans.filter(l => ['active', 'defaulted'].includes(l.status)), l => l.balance),
      fines_unpaid: sum(fines.filter(f => f.status === 'unpaid'), f => f.amount),
    },
  });
}

module.exports = { summary, statement };
