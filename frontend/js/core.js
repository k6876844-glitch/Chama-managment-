// Shared app state, role checks, the view registry and a short-lived request cache.

const OFFICIALS = ['chairperson', 'treasurer', 'secretary'];
const ROLES = [['member', 'Member'], ['chairperson', 'Chairperson'], ['treasurer', 'Treasurer'], ['secretary', 'Secretary']];
const METHODS = [['mpesa', 'M-Pesa'], ['cash', 'Cash'], ['bank', 'Bank']];
const ATTENDANCE = [['present', 'Present'], ['late', 'Late'], ['apology', 'Apology'], ['absent', 'Absent']];
const EXPENSE_CATEGORIES = ['Meeting', 'Transport', 'Bank charges', 'Welfare', 'Investment', 'Other'].map(c => [c, c]);
const LOAN_STATUSES = [['pending', 'Pending'], ['active', 'Active'], ['cleared', 'Fully paid'], ['rejected', 'Rejected'], ['defaulted', 'Defaulted']];

const state = { user: null, route: { name: 'dashboard', params: new URLSearchParams() } };

const isOfficial = () => OFFICIALS.includes(state.user?.role);
const hasRole = (...roles) => roles.includes(state.user?.role);

/**
 * Views register themselves here from js/views/*.js:
 *   VIEWS.members = { label, icon, group, officials?, render(view, params) }
 * `officials: true` hides a view from ordinary members. `memberLabel` renames it for them.
 */
const VIEWS = {};
const NAV_GROUPS = [
  ['main', 'Overview'],
  ['money', 'Finances'],
  ['group', 'Chama'],
  ['account', 'Account'],
];
const canSee = v => v && (!v.officials || isOfficial());

/* ---------- Request cache ---------- */

// Several screens (dashboard, search, notifications) read the same lists. Caching GETs for a short time
// avoids refetching on every click; any change through mutate() clears the cache so nothing goes stale.
const cache = new Map();
const CACHE_MS = 30000;

function load(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = api.get(path).catch(err => { cache.delete(path); throw err; });
  cache.set(path, { at: Date.now(), promise });
  return promise;
}
const clearCache = () => cache.clear();

// Loans with their repayments attached. There is no "all repayments" endpoint, so this reads each loan
// that has money paid against it (GET /loans/{id} includes its repayments). The backend scopes members to their own loans.
async function loadRepayments() {
  const loans = await load('/loans');
  const paid = loans.filter(l => num(l.amount_paid) > 0);
  const details = await Promise.all(paid.map(l => load(`/loans/${l.id}`)));
  const repayments = details.flatMap(d => (d.repayments || []).map(r => ({ ...r, member_name: d.member_name, member_id: d.member_id, loan: d })));
  repayments.sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)) || b.id - a.id);
  return { loans, repayments };
}

async function memberOptions() {
  const members = await load('/members');
  return members.filter(m => m.status === 'active').map(m => [m.id, `${m.full_name} (${m.member_no})`]);
}

/* ---------- Changing data ---------- */

// Runs an API call that changes data, shows the outcome, clears the cache and redraws the page.
async function mutate(call, successMessage) {
  try {
    const result = await call();
    clearCache();
    toast(successMessage, 'success');
    rerender();
    return result;
  } catch (err) {
    toast(err.message, 'error');
    return null;
  }
}

// Opens a form; on submit sends it, and on success toasts, clears the cache and redraws.
// Server errors stay in the open form so nothing typed is lost.
async function formAction(options, send, successMessage = 'Saved') {
  const result = await openForm({
    ...options,
    onSubmit: async data => { await send(data); return true; },
  });
  if (result) {
    clearCache();
    toast(successMessage, 'success');
    rerender();
  }
}

// Asks first, then mutates. Used for deletes, deactivation, rejection and other actions that are hard to undo.
async function confirmAction(dialog, call, successMessage) {
  if (await confirmDialog(dialog)) return mutate(call, successMessage);
}

/* ---------- Routing ---------- */

// Hash routes look like #loans or #loans?status=pending&q=wanjiru
function parseRoute() {
  const [name, qs] = location.hash.slice(1).split('?');
  return { name: name || 'dashboard', params: new URLSearchParams(qs || '') };
}
function go(name, params) {
  const qs = params ? new URLSearchParams(params).toString() : '';
  const hash = `#${name}${qs ? '?' + qs : ''}`;
  if (location.hash === hash) rerender(); else location.hash = hash;
}
// Filled in by app.js
let rerender = () => {};
