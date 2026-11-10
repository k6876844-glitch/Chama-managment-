const db = require('../config/db');

const ROLES = ['chairperson', 'treasurer', 'secretary', 'member'];
const OFFICIALS = ['chairperson', 'treasurer', 'secretary'];

const isOfficial = user => OFFICIALS.includes(user.role);

// Ordinary members only ever see their own records; officials may filter by ?member_id.
function scopedMemberId(req) {
  if (!isOfficial(req.user)) return req.user.id;
  return req.query.member_id ? Number(req.query.member_id) : null;
}

// Returns a 422 body if any required field is missing, otherwise null.
function requireFields(body, fields) {
  const errors = {};
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors[field] = [`The ${field.replace(/_/g, ' ')} field is required.`];
    }
  }
  return Object.keys(errors).length ? { message: 'Please fill in all required fields', errors } : null;
}

// Copies only the allowed fields from the request body.
function pick(body, fields) {
  const out = {};
  for (const field of fields) if (body[field] !== undefined) out[field] = body[field];
  return out;
}

// Builds " WHERE a = ? AND b >= ?" from [[sql, value], ...], skipping filters with no value.
function where(filters) {
  const active = filters.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return {
    sql: active.length ? ' WHERE ' + active.map(([sql]) => sql).join(' AND ') : '',
    params: active.map(([, value]) => value),
  };
}

const today = () => new Date().toISOString().slice(0, 10);

async function getSetting(name, fallback) {
  const [rows] = await db.query('SELECT value FROM settings WHERE name = ?', [name]);
  return rows[0] ? rows[0].value : fallback;
}

module.exports = { ROLES, OFFICIALS, isOfficial, scopedMemberId, requireFields, pick, where, today, getSetting };
