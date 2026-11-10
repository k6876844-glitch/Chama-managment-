const db = require('../config/db');
const { requireFields, pick } = require('../utils/helpers');

const EDITABLE = ['title', 'meeting_date', 'venue', 'agenda', 'minutes'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'apology', 'late'];

async function findMeeting(id) {
  const [rows] = await db.query('SELECT * FROM meetings WHERE id = ?', [id]);
  return rows[0];
}

async function list(req, res) {
  const [rows] = await db.query(`SELECT mt.*,
      (SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = mt.id AND a.status IN ('present', 'late')) AS present_count
    FROM meetings mt ORDER BY mt.meeting_date DESC, mt.id DESC`);
  res.json(rows);
}

async function show(req, res) {
  const meeting = await findMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  const [attendance] = await db.query(`SELECT a.member_id, a.status, m.full_name AS member_name
    FROM attendance a JOIN members m ON m.id = a.member_id
    WHERE a.meeting_id = ? ORDER BY m.full_name`, [meeting.id]);
  res.json({ ...meeting, attendance });
}

async function create(req, res) {
  const body = req.body || {};
  const invalid = requireFields(body, ['title', 'meeting_date']);
  if (invalid) return res.status(422).json(invalid);

  const data = pick(body, EDITABLE);
  data.created_by = req.user.id;
  const [result] = await db.query('INSERT INTO meetings SET ?', [data]);
  res.status(201).json(await findMeeting(result.insertId));
}

async function update(req, res) {
  const data = pick(req.body || {}, EDITABLE);
  if (Object.keys(data).length) await db.query('UPDATE meetings SET ? WHERE id = ?', [data, req.params.id]);
  const meeting = await findMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
  res.json(meeting);
}

// Body: { records: [{ member_id, status }] }. Saving again overwrites earlier marks.
async function setAttendance(req, res) {
  const records = (req.body || {}).records;
  if (!Array.isArray(records) || !records.length) {
    return res.status(422).json({ message: 'Send at least one attendance record' });
  }
  if (records.some(r => !r.member_id || !ATTENDANCE_STATUSES.includes(r.status))) {
    return res.status(422).json({ message: `Each record needs a member_id and a status (${ATTENDANCE_STATUSES.join(', ')})` });
  }
  if (!(await findMeeting(req.params.id))) return res.status(404).json({ message: 'Meeting not found' });

  const values = records.map(r => [req.params.id, r.member_id, r.status]);
  await db.query(
    'INSERT INTO attendance (meeting_id, member_id, status) VALUES ? ON DUPLICATE KEY UPDATE status = VALUES(status)',
    [values]);
  return show(req, res);
}

module.exports = { list, show, create, update, setAttendance };
