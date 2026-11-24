// Reusable UI building blocks: formatting, icons, toasts, dialogs, forms, tables, badges, export.
// Nothing here talks to the API; views combine these with data from js/api.js.

/* ---------- DOM and formatting helpers ---------- */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = s => (s ? String(s)[0].toUpperCase() + String(s).slice(1) : '');
const num = v => Number(v || 0);
const sum = (rows, fn) => rows.reduce((t, r) => t + num(fn(r)), 0);
const labelFor = (options, value) => (options.find(([v]) => v === value) || [, value])[1];

// Local dates as YYYY-MM-DD (toISOString would shift to UTC and can show yesterday's date in Kenya before 3am).
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => isoDate(new Date());
const addDays = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return isoDate(d); };
const parseDate = s => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);
const daysUntil = s => Math.round((parseDate(s) - parseDate(today())) / 86400000);
const monthKey = s => String(s || '').slice(0, 7);
const thisMonth = () => today().slice(0, 7);

const money = v => 'KES ' + num(v).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const moneyShort = v => {
  const n = num(v), a = Math.abs(n);
  if (a >= 1e6) return 'KES ' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return 'KES ' + Math.round(n / 1e3) + 'K';
  return money(n);
};
const fmtDate = s => {
  const d = parseDate(s);
  return d && !isNaN(d) ? d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};
const monthLabel = (key, long) => {
  const d = parseDate(key + '-01');
  return d.toLocaleDateString('en-KE', long ? { month: 'long', year: 'numeric' } : { month: 'short' });
};
// The last n month keys, oldest first, ending with the current month.
function lastMonths(n) {
  const out = [], d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) { out.unshift(isoDate(d).slice(0, 7)); d.setMonth(d.getMonth() - 1); }
  return out;
}
function relTime(s) {
  const n = daysUntil(s);
  if (n === 0) return 'Today';
  if (n === -1) return 'Yesterday';
  if (n === 1) return 'Tomorrow';
  if (n < 0 && n > -7) return `${-n} days ago`;
  if (n > 0 && n < 14) return `In ${n} days`;
  return fmtDate(s);
}

function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Builds an element from an HTML string. Callers escape any data they interpolate.
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- Icons (inline SVG, stroke style, work offline) ---------- */

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  landmark: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/>',
  repeat: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  gavel: '<path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronsLeft: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  trendingUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  arrowIn: '<path d="M17 7 7 17M17 17H7V7"/>',
  arrowOut: '<path d="M7 17 17 7M7 7h10v10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/>',
};

const icon = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// Fills every [data-icon] placeholder under root with its SVG.
function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(n => { if (!n.firstElementChild) n.innerHTML = icon(n.dataset.icon); });
}

/* ---------- Avatars and badges ---------- */

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function avatarHue(name) {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const avatar = (name, size = '') =>
  `<span class="avatar ${size}" style="--h:${avatarHue(name)}" aria-hidden="true">${esc(initials(name))}</span>`;

// Every status shown in the app maps to one tone, so the same word always looks the same.
const STATUS_TONES = {
  active: 'info', pending: 'warn', cleared: 'good', rejected: 'bad', defaulted: 'bad',
  unpaid: 'warn', paid: 'good', waived: 'neutral', inactive: 'neutral',
  present: 'good', late: 'warn', apology: 'neutral', absent: 'bad', overdue: 'bad', upcoming: 'info', done: 'neutral',
};
const STATUS_LABELS = { active: 'Active', cleared: 'Fully paid', defaulted: 'Defaulted' };
const badge = (status, label) =>
  `<span class="badge badge-${STATUS_TONES[status] || 'neutral'}">${esc(label || STATUS_LABELS[status] || cap(status))}</span>`;

function progressBar(pct, { tone = 'good', label } = {}) {
  const p = Math.max(0, Math.min(100, Math.round(num(pct))));
  return `<div class="progress-row"><div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label || 'Progress')}"><span class="bar-fill tone-${tone}" style="width:${p}%"></span></div><span class="bar-pct">${p}%</span></div>`;
}

/* ---------- Toasts ---------- */

function toast(message, type = 'success') {
  const box = $('#toasts');
  const icons = { success: 'checkCircle', error: 'alert', info: 'bell' };
  const t = el(`<div class="toast toast-${type}" role="${type === 'error' ? 'alert' : 'status'}">${icon(icons[type] || 'bell')}<span>${esc(message)}</span><button type="button" class="toast-x" aria-label="Dismiss">${icon('x')}</button></div>`);
  const close = () => { t.classList.add('leaving'); setTimeout(() => t.remove(), 250); };
  $('.toast-x', t).onclick = close;
  box.append(t);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(close, type === 'error' ? 6000 : 3500);
}

/* ---------- Confirm dialog ---------- */

// Resolves true only if the user clicks the confirm button.
function confirmDialog({ title, text, ok = 'Confirm', tone = 'danger', iconName = 'warning' }) {
  const d = $('#confirm');
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text || '';
  $('#confirmIcon').className = `confirm-icon tone-${tone}`;
  $('#confirmIcon').innerHTML = icon(iconName);
  const okBtn = $('#confirmOk');
  okBtn.textContent = ok;
  okBtn.className = `btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`;
  d.returnValue = '';
  d.showModal();
  okBtn.focus();
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
}

/* ---------- Form modal with validation ---------- */

const PHONE_RE = /^(?:\+?254|0)(?:7|1)\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldHtml(f) {
  const id = `f_${f.name}`;
  const req = f.required ? ' required' : '';
  const hint = f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : '';
  const label = `<span class="field-label">${esc(f.label)}${f.required ? '' : ' <em>(optional)</em>'}</span>`;
  const val = f.value ?? '';
  let input;
  if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}"${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${f.options.map(([v, l]) =>
      `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${req}${f.maxlength ? ` maxlength="${f.maxlength}"` : ''} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  } else if (f.type === 'segmented') {
    return `<div class="field field-seg" data-field="${f.name}"><span class="field-label">${esc(f.label)}</span><div class="seg" role="radiogroup" aria-label="${esc(f.label)}">${f.options.map(([v, l]) =>
      `<label><input type="radio" name="${f.name}" value="${esc(v)}"${String(v) === String(val) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>`;
  } else if (f.type === 'html') {
    return `<div class="field field-html">${f.html}</div>`;
  } else {
    const type = f.type === 'money' ? 'number' : (f.type || 'text');
    const attrs = [
      f.type === 'money' ? 'step="0.01" min="0" inputmode="decimal"' : '',
      f.type === 'tel' ? 'inputmode="tel"' : '',
      f.min != null && f.type !== 'money' ? `min="${esc(f.min)}"` : '',
      f.max != null ? `max="${esc(f.max)}"` : '',
      f.maxlength ? `maxlength="${f.maxlength}"` : '',
      f.autocomplete ? `autocomplete="${f.autocomplete}"` : '',
      f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
    ].filter(Boolean).join(' ');
    input = `<input id="${id}" name="${f.name}" type="${type}" value="${esc(val)}" ${attrs}${req}>`;
    if (f.type === 'money') input = `<span class="input-affix"><span>KES</span>${input}</span>`;
  }
  return `<label class="field${f.half ? ' half' : ''}" for="${id}" data-field="${f.name}">${label}${input}${hint}<small class="field-error" id="${id}_err"></small></label>`;
}

// Returns an error message for one field, or '' if it is fine.
function checkField(f, value, data) {
  const v = String(value ?? '').trim();
  if (f.required && !v) return f.type === 'select' ? `Please choose ${f.label.toLowerCase()}` : `${f.label} is required`;
  if (!v) return '';
  if (f.type === 'money' || f.type === 'number') {
    const n = Number(v);
    if (isNaN(n)) return 'Enter a number';
    if (n <= 0 && f.positive !== false) return 'Amount must be more than zero';
    if (f.maxValue != null && n > f.maxValue + 0.001) return `Cannot be more than ${money(f.maxValue)}`;
  }
  if (f.type === 'email' && !EMAIL_RE.test(v)) return 'Enter a valid email address, e.g. name@example.com';
  if (f.phone && !PHONE_RE.test(v.replace(/\s/g, ''))) return 'Enter a Kenyan phone number, e.g. 0712345678';
  if (f.minlength && v.length < f.minlength) return `Must be at least ${f.minlength} characters`;
  if (f.type === 'date' && f.min && v < f.min) return `Date cannot be before ${fmtDate(f.min)}`;
  if (f.type === 'date' && f.max && v > f.max) return `Date cannot be after ${fmtDate(f.max)}`;
  if (f.match && v !== String(data[f.match] ?? '')) return f.matchMessage || 'Values do not match';
  if (f.validate) return f.validate(v, data) || '';
  return '';
}

/**
 * Opens the form modal. `onSubmit(data)` is awaited; if it throws, the modal stays open and shows the error,
 * so nothing typed is lost. Resolves with onSubmit's result, or null if cancelled.
 * fields: [{ name, label, type, options, required, value, hint, half, phone, minlength, match, validate, ... }]
 */
function openForm({ title, subtitle = '', fields, submitLabel = 'Save', onSubmit, wide = false, onRender }) {
  const modal = $('#modal');
  const form = $('#modalForm');
  modal.classList.toggle('modal-wide', wide);
  $('#modalTitle').textContent = title;
  $('#modalSub').textContent = subtitle;
  $('#modalSub').hidden = !subtitle;
  $('#modalError').hidden = true;
  $('#modalBody').innerHTML = fields.map(fieldHtml).join('');
  const submit = $('#modalSubmit');
  submit.textContent = submitLabel;
  submit.classList.remove('loading');
  submit.disabled = false;
  hydrateIcons(modal);
  onRender?.($('#modalBody'));
  modal.showModal();
  const first = $('input:not([type=radio]), select, textarea', $('#modalBody'));
  if (first) first.focus();

  const values = () => Object.fromEntries(new FormData(form));
  const showError = (f, msg) => {
    const wrap = $(`[data-field="${f.name}"]`, form);
    if (!wrap) return;
    wrap.classList.toggle('invalid', !!msg);
    const e = $('.field-error', wrap);
    if (e) e.textContent = msg;
  };
  // Re-check a field as soon as the user fixes it, so the message disappears straight away.
  form.oninput = e => {
    const f = fields.find(x => x.name === e.target.name);
    if (f && $(`[data-field="${f.name}"]`, form)?.classList.contains('invalid')) showError(f, checkField(f, e.target.value, values()));
  };

  return new Promise(resolve => {
    const done = value => {
      form.onsubmit = form.oninput = modal.oncancel = $('#modalCancel').onclick = $('#modalX').onclick = null;
      if (modal.open) modal.close();
      resolve(value);
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const data = values();
      let firstBad = null;
      for (const f of fields) {
        if (!f.name || f.type === 'html') continue;
        const msg = checkField(f, data[f.name], data);
        showError(f, msg);
        if (msg && !firstBad) firstBad = f;
      }
      if (firstBad) {
        $(`[name="${firstBad.name}"]`, form)?.focus();
        return;
      }
      for (const key of Object.keys(data)) if (data[key] === '') delete data[key];
      for (const f of fields) if (f.transient) delete data[f.name];
      submit.disabled = true;
      submit.classList.add('loading');
      $('#modalError').hidden = true;
      try {
        done(await onSubmit(data));
      } catch (err) {
        $('#modalError').innerHTML = `${icon('alert')}<span>${esc(err.message)}</span>`;
        $('#modalError').hidden = false;
        submit.disabled = false;
        submit.classList.remove('loading');
      }
    };
    $('#modalCancel').onclick = $('#modalX').onclick = () => done(null);
    modal.oncancel = e => { if (submit.disabled) e.preventDefault(); else done(null); };
  });
}

// A read-only modal for viewing details.
function showDetails({ title, subtitle = '', html, actions = [] }) {
  const modal = $('#modal');
  modal.classList.remove('modal-wide');
  $('#modalTitle').textContent = title;
  $('#modalSub').textContent = subtitle;
  $('#modalSub').hidden = !subtitle;
  $('#modalError').hidden = true;
  $('#modalBody').innerHTML = html;
  const bar = $('#modalActions');
  const saved = bar.innerHTML;
  bar.innerHTML = '<button type="button" class="btn btn-ghost" data-close>Close</button>';
  // Put the normal Save/Cancel footer back before anything else can open the modal.
  let restored = false;
  const restore = () => { if (!restored) { restored = true; bar.innerHTML = saved; } };
  const close = () => { restore(); modal.close(); };
  for (const a of actions) {
    const b = el(`<button type="button" class="btn ${a.variant || 'btn-primary'}">${a.icon ? icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`);
    b.onclick = () => { close(); a.onClick(); };
    bar.append(b);
  }
  $('[data-close]', bar).onclick = close;
  $('#modalX').onclick = close;
  $('#modalForm').onsubmit = e => e.preventDefault();
  modal.oncancel = restore;
  modal.addEventListener('close', restore, { once: true });
  modal.showModal();
}

/* ---------- Page pieces ---------- */

// actions: [{ label, icon, onClick, variant }]
function pageHead(view, { title, subtitle, actions = [] }) {
  const head = el(`<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ''}</div><div class="page-actions"></div></div>`);
  const box = $('.page-actions', head);
  for (const a of actions.filter(Boolean)) box.append(button(a));
  view.innerHTML = '';
  view.append(head);
  return head;
}

function button({ label, icon: ic, onClick, variant = 'btn-primary', small, title }) {
  const b = el(`<button type="button" class="btn ${variant}${small ? ' btn-sm' : ''}"${title ? ` title="${esc(title)}"` : ''}>${ic ? icon(ic) : ''}<span>${esc(label)}</span></button>`);
  b.onclick = onClick;
  return b;
}

// tone: good | info | warn | bad | navy. hint: small line under the value.
const statCard = ({ label, value, icon: ic, tone = 'good', hint = '', href }) => `
  <${href ? `a href="${href}"` : 'div'} class="stat">
    <span class="stat-icon tone-${tone}">${icon(ic || 'wallet')}</span>
    <div class="stat-body"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${esc(value)}</strong>${hint ? `<span class="stat-hint">${hint}</span>` : ''}</div>
  </${href ? 'a' : 'div'}>`;

function statGrid(items, cols = '') {
  return el(`<div class="stats ${cols}">${items.map(statCard).join('')}</div>`);
}

function card({ title, subtitle, body, actions = [], cls = '' }) {
  const c = el(`<section class="card ${cls}">${title ? `<header class="card-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p class="muted small">${esc(subtitle)}</p>` : ''}</div><div class="card-actions"></div></header>` : ''}<div class="card-body"></div></section>`);
  if (title) for (const a of actions.filter(Boolean)) $('.card-actions', c).append(a instanceof Node ? a : button({ variant: 'btn-ghost', small: true, ...a }));
  const b = $('.card-body', c);
  if (body instanceof Node) b.append(body); else if (body != null) b.innerHTML = body;
  return c;
}

const emptyState = (title, text = '', ic = 'inbox') =>
  `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`;

function skeleton(view) {
  view.innerHTML = `<div class="skeleton"><div class="sk sk-title"></div><div class="stats">${'<div class="sk sk-stat"></div>'.repeat(4)}</div><div class="sk sk-block"></div></div>`;
}

/* ---------- Data table with search, filters, sorting and paging ---------- */

/**
 * columns: [{ label, value: row => plain text (search, sort, export), html: row => escaped markup, align, sortable, hideSm }]
 * filters: [{ key, label, options: [[value, label]], test: (row, value) => bool }]  (rendered as selects)
 * chips:   { key, options: [[value, label]], test }  (rendered as a pill row; '' means all)
 * actions: row => [{ label, icon, onClick, tone }]
 */
function dataTable({ columns, rows, actions, filters = [], chips, searchPlaceholder = 'Search…', empty = 'No records yet', emptyText = '', pageSize = 15, query = '', exportName, toolbarExtra, initial = {}, dateFilter }) {
  const st = { q: query, page: 0, sort: null, dir: 1, f: { ...initial }, chip: initial.chip || '', from: '', to: '' };
  const root = el(`<div class="dtable">
    <div class="dt-toolbar">
      <label class="dt-search">${icon('search')}<input type="search" placeholder="${esc(searchPlaceholder)}" value="${esc(query)}" aria-label="Search this list"></label>
      <div class="dt-filters"></div>
    </div>
    <div class="dt-chips" hidden></div>
    <div class="table-wrap"><table><thead></thead><tbody></tbody></table></div>
    <div class="dt-foot"><span class="dt-count muted small"></span><div class="dt-pager"></div></div>
  </div>`);

  const fbox = $('.dt-filters', root);
  for (const f of filters) {
    const s = el(`<select aria-label="${esc(f.label)}"><option value="">${esc(f.label)}: All</option>${f.options.map(([v, l]) => `<option value="${esc(v)}"${String(st.f[f.key] ?? '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
    s.onchange = () => { st.f[f.key] = s.value; st.page = 0; draw(); };
    fbox.append(s);
  }
  if (dateFilter) {
    const from = el('<input type="date" aria-label="From date" title="From date">');
    const to = el('<input type="date" aria-label="To date" title="To date">');
    from.onchange = () => { st.from = from.value; st.page = 0; draw(); };
    to.onchange = () => { st.to = to.value; st.page = 0; draw(); };
    fbox.append(el('<span class="dt-range-label muted small">From</span>'), from, el('<span class="dt-range-label muted small">to</span>'), to);
  }
  if (exportName) {
    fbox.append(button({ label: 'Export', icon: 'download', variant: 'btn-ghost', small: true, title: 'Download as a spreadsheet (CSV, opens in Excel)', onClick: () => downloadCSV(exportName, columns, filtered()) }));
  }
  if (toolbarExtra) fbox.append(toolbarExtra);

  const chipBox = $('.dt-chips', root);
  if (chips) {
    chipBox.hidden = false;
    chipBox.innerHTML = [['', 'All'], ...chips.options].map(([v, l]) => {
      const n = v === '' ? rows.length : rows.filter(r => chips.test(r, v)).length;
      return `<button type="button" class="chip${st.chip === v ? ' active' : ''}" data-v="${esc(v)}">${esc(l)}<span>${n}</span></button>`;
    }).join('');
    chipBox.onclick = e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      st.chip = b.dataset.v; st.page = 0;
      $$('.chip', chipBox).forEach(c => c.classList.toggle('active', c === b));
      draw();
    };
  }

  const search = $('.dt-search input', root);
  search.oninput = debounce(() => { st.q = search.value; st.page = 0; draw(); }, 120);

  const thead = $('thead', root);
  thead.innerHTML = `<tr>${columns.map((c, i) => `<th class="${c.align === 'right' ? 'num' : ''}${c.hideSm ? ' hide-sm' : ''}${c.hideMd ? ' hide-md' : ''}">${c.sortable === false ? esc(c.label) : `<button type="button" class="th-sort" data-i="${i}">${esc(c.label)}<span class="sort-ind"></span></button>`}</th>`).join('')}${actions ? '<th class="num"><span class="sr-only">Actions</span></th>' : ''}</tr>`;
  thead.onclick = e => {
    const b = e.target.closest('.th-sort');
    if (!b) return;
    const i = Number(b.dataset.i);
    st.dir = st.sort === i ? -st.dir : 1;
    st.sort = i;
    $$('.th-sort', thead).forEach(x => x.dataset.dir = x === b ? (st.dir > 0 ? 'asc' : 'desc') : '');
    draw();
  };

  function filtered() {
    const q = st.q.trim().toLowerCase();
    let out = rows.filter(r =>
      (!q || columns.some(c => String(c.value(r) ?? '').toLowerCase().includes(q)) || (r._search || '').toLowerCase().includes(q)) &&
      filters.every(f => !st.f[f.key] || f.test(r, st.f[f.key])) &&
      (!chips || !st.chip || chips.test(r, st.chip)) &&
      (!dateFilter || ((!st.from || dateFilter(r) >= st.from) && (!st.to || dateFilter(r) <= st.to))));
    if (st.sort != null) {
      const c = columns[st.sort];
      const key = c.sortValue || c.value;
      out = [...out].sort((a, b) => {
        const x = key(a), y = key(b);
        const nx = typeof x === 'number' ? x : NaN, ny = typeof y === 'number' ? y : NaN;
        return (!isNaN(nx) && !isNaN(ny) ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true })) * st.dir;
      });
    }
    return out;
  }

  function draw() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * pageSize, st.page * pageSize + pageSize);
    const tbody = $('tbody', root);
    tbody.innerHTML = '';
    if (!slice.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="${columns.length + (actions ? 1 : 0)}">${rows.length ? emptyState('Nothing matches your search', 'Try a different word or clear the filters.', 'search') : emptyState(empty, emptyText)}</td></tr>`;
    }
    for (const r of slice) {
      const tr = document.createElement('tr');
      tr.innerHTML = columns.map(c => `<td data-label="${esc(c.label)}" class="${c.align === 'right' ? 'num' : ''}${c.hideSm ? ' hide-sm' : ''}${c.hideMd ? ' hide-md' : ''}${c.wrap ? ' wrap' : ''}"><span class="cell">${c.html ? c.html(r) : esc(c.value(r) ?? '—')}</span></td>`).join('');
      if (actions) {
        const td = document.createElement('td');
        td.className = 'row-actions num';
        for (const a of actions(r)) {
          // Main actions (approve, record) keep their label; the rest are icon buttons on wide screens.
          const iconOnly = a.icon && a.tone !== 'primary';
          const b = el(`<button type="button" class="btn btn-sm ${a.tone === 'danger' ? 'btn-soft-danger' : a.tone === 'primary' ? 'btn-soft' : 'btn-ghost'}${iconOnly ? ' btn-icon' : ''}" title="${esc(a.label)}" aria-label="${esc(a.label)}">${a.icon ? icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`);
          b.onclick = () => a.onClick(r);
          td.append(b);
        }
        if (!td.children.length) td.classList.add('no-actions');
        tr.append(td);
      }
      tbody.append(tr);
    }
    $('.dt-count', root).textContent = list.length === rows.length
      ? `${rows.length} record${rows.length === 1 ? '' : 's'}`
      : `Showing ${list.length} of ${rows.length}`;
    const pager = $('.dt-pager', root);
    pager.innerHTML = pages > 1
      ? `<button type="button" class="icon-btn sm" data-p="-1" aria-label="Previous page"${st.page === 0 ? ' disabled' : ''}>${icon('chevronLeft')}</button><span class="small">Page ${st.page + 1} of ${pages}</span><button type="button" class="icon-btn sm" data-p="1" aria-label="Next page"${st.page >= pages - 1 ? ' disabled' : ''}>${icon('chevronRight')}</button>`
      : '';
    pager.onclick = e => { const b = e.target.closest('[data-p]'); if (b) { st.page += Number(b.dataset.p); draw(); } };
  }

  draw();
  root.filtered = filtered;
  return root;
}

/* ---------- Export ---------- */

// CSV with a BOM so Excel opens it with the right encoding. Cells that start with = + - @ are prefixed
// with a quote so a spreadsheet never runs them as formulas (CSV injection).
function downloadCSV(name, columns, rows) {
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = columns.filter(c => c.export !== false);
  const lines = [cols.map(c => cell(c.label)).join(','), ...rows.map(r => cols.map(c => cell(c.csv ? c.csv(r) : c.value(r))).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${today()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Downloaded ${rows.length} rows. Open the file in Excel.`, 'info');
}
