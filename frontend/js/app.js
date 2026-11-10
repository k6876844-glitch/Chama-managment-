// Umoja Chama frontend: login, role-aware navigation and one view per module.
// Every view reads from and writes to the API (js/api.js); nothing is stored locally except the login token.

const OFFICIALS = ['chairperson', 'treasurer', 'secretary'];
const ROLES = [['member', 'Member'], ['chairperson', 'Chairperson'], ['treasurer', 'Treasurer'], ['secretary', 'Secretary']];
const METHODS = [['mpesa', 'M-Pesa'], ['cash', 'Cash'], ['bank', 'Bank']];
const ATTENDANCE = [['present', 'Present'], ['late', 'Late'], ['apology', 'Apology'], ['absent', 'Absent']];
const EXPENSE_CATEGORIES = ['Meeting', 'Transport', 'Bank charges', 'Welfare', 'Investment', 'Other'].map(c => [c, c]);

const state = { user: null };

const isOfficial = () => OFFICIALS.includes(state.user?.role);
const hasRole = (...roles) => roles.includes(state.user?.role);

// `officials: true` hides a view from ordinary members.
const VIEWS = {
  dashboard: { label: 'Home', icon: '🏠', render: renderDashboard },
  members: { label: 'Members', icon: '👥', officials: true, render: renderMembers },
  contributions: { label: 'Contributions', icon: '💰', render: renderContributions },
  loans: { label: 'Loans', icon: '🤝', render: renderLoans },
  fines: { label: 'Fines', icon: '⚖️', render: renderFines },
  expenses: { label: 'Expenses', icon: '🧾', render: renderExpenses },
  meetings: { label: 'Meetings', icon: '📅', render: renderMeetings },
  reports: { label: 'Reports', icon: '📊', render: renderReports },
};

const canSee = view => !view.officials || isOfficial();

/* ---------- Helpers ---------- */

const $ = (sel, el = document) => el.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = v => 'KES ' + Number(v || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
const today = () => new Date().toISOString().slice(0, 10);
const labelFor = (options, value) => (options.find(([v]) => v === value) || [, value])[1];

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3000);
}

function header(view, title, button) {
  view.innerHTML = `<div class="view-head"><h1>${esc(title)}</h1></div>`;
  if (button) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-primary';
    b.textContent = button.label;
    b.onclick = button.onClick;
    view.firstElementChild.append(b);
  }
}

function section(title, content) {
  const s = document.createElement('section');
  s.className = 'card';
  s.innerHTML = `<h2>${esc(title)}</h2>`;
  s.append(content);
  return s;
}

function statCards(items) {
  const grid = document.createElement('div');
  grid.className = 'stats';
  grid.innerHTML = items.map(([label, value]) => `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
  return grid;
}

// columns: [{ label, value: row => text }]; actions: row => [{ label, onClick }]
function renderTable(columns, rows, actions) {
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No records yet.';
    return p;
  }
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}${actions ? '<th></th>' : ''}</tr></thead>`;
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = columns.map(c => `<td data-label="${esc(c.label)}">${esc(c.value(row))}</td>`).join('');
    if (actions) {
      const td = document.createElement('td');
      td.className = 'row-actions';
      for (const action of actions(row)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-small';
        b.textContent = action.label;
        b.onclick = action.onClick;
        td.append(b);
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

// fields: [{ name, label, type, options: [[value, label]], required, value }]
// Resolves with the form values (empty fields left out), or null if cancelled.
function openForm(title, fields) {
  const modal = $('#modal');
  const form = $('#modalForm');
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = fields.map(f => {
    const required = f.required ? 'required' : '';
    let input;
    if (f.type === 'select') {
      input = `<select name="${f.name}" ${required}>${f.options.map(([v, l]) =>
        `<option value="${esc(v)}" ${String(v) === String(f.value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea name="${f.name}" rows="4" ${required}>${esc(f.value)}</textarea>`;
    } else {
      const extra = f.type === 'number' ? 'step="0.01" min="0"' : '';
      input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value)}" ${extra} ${required}>`;
    }
    return `<label>${esc(f.label)}${input}</label>`;
  }).join('');
  modal.showModal();

  return new Promise(resolve => {
    const done = value => {
      form.onsubmit = null;
      modal.oncancel = null;
      $('#modalCancel').onclick = null;
      if (modal.open) modal.close();
      resolve(value);
    };
    form.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      for (const key of Object.keys(data)) if (data[key] === '') delete data[key];
      done(data);
    };
    $('#modalCancel').onclick = () => done(null);
    modal.oncancel = () => done(null);
  });
}

// Runs an API call, shows the result and refreshes the current view.
async function act(call, successMessage) {
  try {
    await call();
    toast(successMessage);
    render();
  } catch (err) {
    toast(err.message);
  }
}

async function submitForm(title, fields, send, successMessage = 'Saved') {
  const data = await openForm(title, fields);
  if (data) await act(() => send(data), successMessage);
}

async function memberOptions() {
  const members = await api.get('/members');
  return members.filter(m => m.status === 'active').map(m => [m.id, `${m.full_name} (${m.member_no})`]);
}

/* ---------- Session and routing ---------- */

// Shared layout for the login and sign-up pages: animated background, welcome panel, form card.
function renderAuth(mode, formFields, submitLabel, onSubmit) {
  state.user = null;
  document.body.classList.add('logged-out');
  const isLogin = mode === 'login';
  $('#view').innerHTML = `
    <div class="auth">
      <div class="auth-bg" aria-hidden="true"><span></span><span></span><span></span></div>
      <section class="auth-hero">
        <a href="index.html" class="auth-brand"><img src="icon.svg" width="40" height="40" alt=""> Umoja Chama</a>
        <h1>${isLogin ? 'Welcome back.' : 'Join the chama.'}<span>Save together. Grow together.</span></h1>
        <p>Contributions, loans, fines and meetings, tracked in one place and open to every member.</p>
        <ul class="auth-points">
          <li><b>💰</b>See every shilling you have contributed</li>
          <li><b>🤝</b>Apply for loans and track repayments</li>
          <li><b>📅</b>Keep up with meetings and minutes</li>
        </ul>
      </section>
      <form class="auth-card" id="authForm">
        <div class="auth-switch${renderAuth.last && renderAuth.last !== mode ? ' slide' : ''}" data-mode="${mode}" role="tablist">
          <button type="button" role="tab" aria-selected="${isLogin}" data-mode="login">Log in</button>
          <button type="button" role="tab" aria-selected="${!isLogin}" data-mode="signup">Sign up</button>
        </div>
        <h2>${isLogin ? 'Log in to your account' : 'Create your account'}</h2>
        <p class="muted small">${isLogin ? 'Use the phone number and password you registered with.' : 'It takes less than a minute. You join as a member.'}</p>
        ${formFields}
        <button class="btn btn-primary btn-lg auth-submit">${submitLabel}</button>
        <p class="muted small">${isLogin
          ? 'New here? <button type="button" class="link-btn" data-mode="signup">Create an account</button>'
          : 'Already a member? <button type="button" class="link-btn" data-mode="login">Log in</button>'}</p>
      </form>
    </div>`;

  renderAuth.last = mode; // so the tab pill slides only when switching, not on first load
  document.querySelectorAll('button[data-mode]').forEach(b => {
    b.onclick = () => (b.dataset.mode === 'login' ? renderLogin() : renderSignup());
  });
  document.querySelectorAll('.pw-toggle').forEach(b => {
    b.onclick = () => {
      const input = b.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Hide' : 'Show';
      b.setAttribute('aria-pressed', show);
    };
  });

  const form = $('#authForm');
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $('.auth-submit', form);
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
    } catch (err) {
      toast(err.message);
      form.classList.remove('shake');
      void form.offsetWidth; // restart the animation
      form.classList.add('shake');
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  };
  $('input', form).focus();
}

const passwordField = (name, label, autocomplete) => `
  <label>${label}<span class="pw"><input name="${name}" type="password" required minlength="6" autocomplete="${autocomplete}"><button type="button" class="pw-toggle" aria-label="Show password" aria-pressed="false">Show</button></span></label>`;

function renderLogin() {
  renderAuth('login', `
    <label>Phone number<input name="phone" required autocomplete="username" inputmode="tel" placeholder="07XXXXXXXX"></label>
    ${passwordField('password', 'Password', 'current-password')}`,
  'Log in', async data => {
    const res = await api.post('/auth/login', data);
    api.token = res.token;
    startSession(res.user);
  });
}

// New accounts are saved as ordinary members; the chairperson can change roles later.
function renderSignup() {
  renderAuth('signup', `
    <label>Full name<input name="full_name" required maxlength="120" autocomplete="name"></label>
    <label>Phone number<input name="phone" required maxlength="20" autocomplete="tel" inputmode="tel" placeholder="07XXXXXXXX"></label>
    <div class="auth-row">
      <label><span>Email <span class="muted small">(optional)</span></span><input name="email" type="email" maxlength="120" autocomplete="email"></label>
      <label><span>ID number <span class="muted small">(optional)</span></span><input name="id_number" maxlength="20"></label>
    </div>
    ${passwordField('password', 'Password', 'new-password')}
    ${passwordField('confirm', 'Confirm password', 'new-password')}`,
  'Create account', async ({ confirm, ...data }) => {
    if (data.password !== confirm) throw new Error('The passwords do not match');
    const res = await api.post('/auth/register', data);
    api.token = res.token;
    toast(`Welcome, ${res.user.full_name}! Your member number is ${res.user.member_no}.`);
    startSession(res.user);
  });
}

function startSession(user) {
  state.user = user;
  document.body.classList.remove('logged-out');
  $('#userName').textContent = user.full_name;
  $('#userRole').textContent = cap(user.role);
  $('#tabs').innerHTML = Object.entries(VIEWS)
    .filter(([, view]) => canSee(view))
    .map(([key, view]) => `<a href="#${key}" data-view="${key}"><span>${view.icon}</span>${esc(view.label)}</a>`)
    .join('');
  render();
}

async function render() {
  if (!state.user) return renderLogin();
  const name = location.hash.slice(1);
  const key = VIEWS[name] && canSee(VIEWS[name]) ? name : 'dashboard';
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.view === key));

  const view = $('#view');
  view.innerHTML = '<p class="muted">Loading…</p>';
  try {
    await VIEWS[key].render(view);
  } catch (err) {
    view.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

$('#logoutBtn').onclick = () => {
  api.post('/auth/logout').catch(() => {});
  api.token = null;
  renderLogin();
};

window.addEventListener('hashchange', render);
window.addEventListener('chama:logout', renderLogin);

(async function init() {
  if (api.token) {
    try {
      return startSession(await api.get('/auth/me'));
    } catch {
      api.token = null;
    }
  }
  renderLogin();
})();

/* ---------- Views ---------- */

async function renderDashboard(view) {
  header(view, `Welcome, ${state.user.full_name.split(' ')[0]}`);
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'btn btn-ghost mobile-only'; // the sidebar's log out button is hidden on phones
  logout.textContent = 'Log out';
  logout.onclick = () => $('#logoutBtn').click();
  view.firstElementChild.append(logout);
  if (isOfficial()) {
    const s = await api.get('/reports/summary');
    view.append(statCards([
      ['Cash at hand', money(s.cash_at_hand)],
      ['Total contributions', money(s.total_contributions)],
      ['Loans outstanding', money(s.loans_outstanding)],
      ['Total expenses', money(s.total_expenses)],
      ['Unpaid fines', money(s.fines_unpaid)],
      ['Active members', s.active_members],
    ]));
  } else {
    const st = await api.get(`/reports/statement/${state.user.id}`);
    view.append(statCards([
      ['My contributions', money(st.totals.contributions)],
      ['My loan balance', money(st.totals.loan_balance)],
      ['My unpaid fines', money(st.totals.fines_unpaid)],
      ['Meetings attended', `${st.attendance.present} of ${st.attendance.total}`],
    ]));
  }
}

function memberFields(m = {}) {
  return [
    { name: 'full_name', label: 'Full name', required: true, value: m.full_name },
    { name: 'phone', label: 'Phone number', type: 'tel', required: true, value: m.phone },
    { name: 'email', label: 'Email', type: 'email', value: m.email },
    { name: 'id_number', label: 'National ID number', value: m.id_number },
    { name: 'role', label: 'Role', type: 'select', options: ROLES, value: m.role || 'member' },
    ...(m.id ? [{ name: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['inactive', 'Inactive']], value: m.status }] : []),
    { name: 'password', label: m.id ? 'New password (leave blank to keep)' : 'Password', type: 'password', required: !m.id },
  ];
}

async function renderMembers(view) {
  const canEdit = hasRole('chairperson', 'secretary');
  header(view, 'Members', canEdit && {
    label: 'Add member',
    onClick: () => submitForm('Add member', memberFields(), d => api.post('/members', d), 'Member added'),
  });
  const members = await api.get('/members');
  view.append(renderTable([
    { label: 'No.', value: m => m.member_no },
    { label: 'Name', value: m => m.full_name },
    { label: 'Phone', value: m => m.phone },
    { label: 'Role', value: m => cap(m.role) },
    { label: 'Status', value: m => cap(m.status) },
  ], members, canEdit ? m => [{
    label: 'Edit',
    onClick: () => submitForm(`Edit ${m.full_name}`, memberFields(m), d => api.put(`/members/${m.id}`, d), 'Member updated'),
  }] : null));
}

async function renderContributions(view) {
  header(view, isOfficial() ? 'Contributions' : 'My contributions', hasRole('treasurer', 'chairperson') && {
    label: 'Record contribution',
    onClick: async () => submitForm('Record contribution', [
      { name: 'member_id', label: 'Member', type: 'select', options: await memberOptions(), required: true },
      { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
      { name: 'method', label: 'Paid by', type: 'select', options: METHODS, value: 'mpesa' },
      { name: 'reference', label: 'Reference (e.g. M-Pesa code)' },
      { name: 'contribution_date', label: 'Date', type: 'date', value: today(), required: true },
    ], d => api.post('/contributions', d), 'Contribution recorded'),
  });
  const rows = await api.get('/contributions');
  view.append(renderTable([
    { label: 'Date', value: c => c.contribution_date },
    ...(isOfficial() ? [{ label: 'Member', value: c => c.member_name }] : []),
    { label: 'Amount', value: c => money(c.amount) },
    { label: 'Paid by', value: c => labelFor(METHODS, c.method) },
    { label: 'Reference', value: c => c.reference },
  ], rows));
}

async function renderLoans(view) {
  header(view, isOfficial() ? 'Loans' : 'My loans', {
    label: 'Apply for a loan',
    onClick: () => submitForm('Apply for a loan', [
      { name: 'principal', label: 'Amount (KES)', type: 'number', required: true },
      { name: 'purpose', label: 'Purpose', type: 'textarea' },
      { name: 'due_date', label: 'Repay by', type: 'date' },
    ], d => api.post('/loans', d), 'Loan application sent'),
  });
  const loans = await api.get('/loans');

  const actions = l => [
    ...(l.status === 'pending' && hasRole('chairperson') ? [
      { label: 'Approve', onClick: () => act(() => api.patch(`/loans/${l.id}/approve`), 'Loan approved') },
      { label: 'Reject', onClick: () => act(() => api.patch(`/loans/${l.id}/reject`), 'Loan rejected') },
    ] : []),
    ...(l.status === 'active' && hasRole('treasurer') ? [{
      label: 'Record repayment',
      onClick: () => submitForm(`Repayment from ${l.member_name}`, [
        { name: 'amount', label: `Amount (balance ${money(l.balance)})`, type: 'number', required: true, value: l.balance },
        { name: 'method', label: 'Paid by', type: 'select', options: METHODS, value: 'mpesa' },
        { name: 'reference', label: 'Reference (e.g. M-Pesa code)' },
        { name: 'payment_date', label: 'Date', type: 'date', value: today(), required: true },
      ], d => api.post(`/loans/${l.id}/repayments`, d), 'Repayment recorded'),
    }] : []),
  ];

  view.append(renderTable([
    { label: 'Applied', value: l => l.applied_at },
    ...(isOfficial() ? [{ label: 'Member', value: l => l.member_name }] : []),
    { label: 'Amount', value: l => money(l.principal) },
    { label: 'Interest', value: l => `${Number(l.interest_rate)}%` },
    { label: 'Total due', value: l => money(l.total_due) },
    { label: 'Paid', value: l => money(l.amount_paid) },
    { label: 'Balance', value: l => money(l.balance) },
    { label: 'Status', value: l => cap(l.status) },
  ], loans, hasRole('chairperson', 'treasurer') ? actions : null));
}

async function renderFines(view) {
  header(view, isOfficial() ? 'Fines' : 'My fines', hasRole('treasurer', 'secretary') && {
    label: 'Add fine',
    onClick: async () => submitForm('Add fine', [
      { name: 'member_id', label: 'Member', type: 'select', options: await memberOptions(), required: true },
      { name: 'reason', label: 'Reason (e.g. late for meeting)', required: true },
      { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
      { name: 'fine_date', label: 'Date', type: 'date', value: today(), required: true },
    ], d => api.post('/fines', d), 'Fine added'),
  });
  const fines = await api.get('/fines');

  const actions = f => f.status !== 'unpaid' ? [] : [
    ...(hasRole('treasurer') ? [{ label: 'Mark paid', onClick: () => act(() => api.patch(`/fines/${f.id}/pay`), 'Fine marked as paid') }] : []),
    ...(hasRole('chairperson') ? [{ label: 'Waive', onClick: () => act(() => api.patch(`/fines/${f.id}/waive`), 'Fine waived') }] : []),
  ];

  view.append(renderTable([
    { label: 'Date', value: f => f.fine_date },
    ...(isOfficial() ? [{ label: 'Member', value: f => f.member_name }] : []),
    { label: 'Reason', value: f => f.reason },
    { label: 'Amount', value: f => money(f.amount) },
    { label: 'Status', value: f => cap(f.status) },
  ], fines, hasRole('treasurer', 'chairperson') ? actions : null));
}

async function renderExpenses(view) {
  const canEdit = hasRole('treasurer');
  header(view, 'Expenses', canEdit && {
    label: 'Record expense',
    onClick: () => submitForm('Record expense', [
      { name: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES, required: true },
      { name: 'description', label: 'Description' },
      { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
      { name: 'expense_date', label: 'Date', type: 'date', value: today(), required: true },
      { name: 'receipt_ref', label: 'Receipt number' },
    ], d => api.post('/expenses', d), 'Expense recorded'),
  });
  const expenses = await api.get('/expenses');
  view.append(renderTable([
    { label: 'Date', value: e => e.expense_date },
    { label: 'Category', value: e => e.category },
    { label: 'Description', value: e => e.description },
    { label: 'Amount', value: e => money(e.amount) },
    { label: 'Receipt', value: e => e.receipt_ref },
  ], expenses, canEdit ? e => [{
    label: 'Delete',
    onClick: () => confirm('Delete this expense?') && act(() => api.delete(`/expenses/${e.id}`), 'Expense deleted'),
  }] : null));
}

async function markAttendance(meeting) {
  const [members, detail] = await Promise.all([api.get('/members'), api.get(`/meetings/${meeting.id}`)]);
  const current = Object.fromEntries(detail.attendance.map(a => [a.member_id, a.status]));
  const fields = members.filter(m => m.status === 'active').map(m => ({
    name: `m${m.id}`, label: m.full_name, type: 'select', options: ATTENDANCE, value: current[m.id] || 'present',
  }));
  submitForm(`Attendance: ${meeting.title}`, fields, d => api.put(`/meetings/${meeting.id}/attendance`, {
    records: Object.entries(d).map(([key, status]) => ({ member_id: Number(key.slice(1)), status })),
  }), 'Attendance saved');
}

async function renderMeetings(view) {
  const canEdit = hasRole('chairperson', 'secretary');
  header(view, 'Meetings', canEdit && {
    label: 'Schedule meeting',
    onClick: () => submitForm('Schedule meeting', [
      { name: 'title', label: 'Title', required: true, value: 'Monthly meeting' },
      { name: 'meeting_date', label: 'Date', type: 'date', required: true },
      { name: 'venue', label: 'Venue' },
      { name: 'agenda', label: 'Agenda', type: 'textarea' },
    ], d => api.post('/meetings', d), 'Meeting scheduled'),
  });
  const meetings = await api.get('/meetings');

  const actions = m => [
    ...(hasRole('secretary') ? [{ label: 'Attendance', onClick: () => markAttendance(m).catch(err => toast(err.message)) }] : []),
    { label: 'Minutes', onClick: () => submitForm(`Minutes: ${m.title}`, [{ name: 'minutes', label: 'Minutes', type: 'textarea', value: m.minutes }],
      d => api.put(`/meetings/${m.id}`, d), 'Minutes saved') },
  ];

  view.append(renderTable([
    { label: 'Date', value: m => m.meeting_date },
    { label: 'Title', value: m => m.title },
    { label: 'Venue', value: m => m.venue },
    { label: 'Agenda', value: m => m.agenda },
    { label: 'Present', value: m => m.present_count },
  ], meetings, canEdit ? actions : null));
}

async function renderStatement(container, memberId) {
  const st = await api.get(`/reports/statement/${memberId}`);
  container.innerHTML = '';
  container.append(statCards([
    ['Total contributions', money(st.totals.contributions)],
    ['Loan balance', money(st.totals.loan_balance)],
    ['Unpaid fines', money(st.totals.fines_unpaid)],
    ['Meetings attended', `${st.attendance.present} of ${st.attendance.total}`],
  ]));
  container.append(section('Contributions', renderTable([
    { label: 'Date', value: c => c.contribution_date },
    { label: 'Amount', value: c => money(c.amount) },
    { label: 'Paid by', value: c => labelFor(METHODS, c.method) },
    { label: 'Reference', value: c => c.reference },
  ], st.contributions)));
  container.append(section('Loans', renderTable([
    { label: 'Applied', value: l => l.applied_at },
    { label: 'Total due', value: l => money(l.total_due) },
    { label: 'Paid', value: l => money(l.amount_paid) },
    { label: 'Balance', value: l => money(l.balance) },
    { label: 'Status', value: l => cap(l.status) },
  ], st.loans)));
  container.append(section('Fines', renderTable([
    { label: 'Date', value: f => f.fine_date },
    { label: 'Reason', value: f => f.reason },
    { label: 'Amount', value: f => money(f.amount) },
    { label: 'Status', value: f => cap(f.status) },
  ], st.fines)));
}

async function renderReports(view) {
  header(view, isOfficial() ? 'Reports' : 'My statement', { label: 'Print', onClick: () => window.print() });
  const statement = document.createElement('div');

  if (!isOfficial()) {
    view.append(statement);
    return renderStatement(statement, state.user.id);
  }

  const s = await api.get('/reports/summary');
  view.append(section('Financial summary', renderTable([
    { label: 'Item', value: r => r[0] },
    { label: 'Amount', value: r => money(r[1]) },
  ], [
    ['Contributions', s.total_contributions],
    ['Loan repayments', s.total_repayments],
    ['Fines paid', s.total_fines_paid],
    ['Total income', s.total_income],
    ['Loans issued', -s.total_loans_issued],
    ['Expenses', -s.total_expenses],
    ['Cash at hand', s.cash_at_hand],
  ])));

  const picker = document.createElement('select');
  picker.innerHTML = '<option value="">Choose a member…</option>' +
    (await memberOptions()).map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('');
  picker.onchange = () => picker.value && renderStatement(statement, picker.value).catch(err => toast(err.message));

  const box = document.createElement('div');
  box.append(picker, statement);
  view.append(section('Member statement', box));
}
