// Umoja Chama app shell: login and sign-up, navigation (collapsible sidebar / mobile drawer),
// top bar (search, notifications, profile), routing and theme. Each module's screen lives in js/views/.

/* ---------- Login and sign-up ---------- */

function renderAuth(mode) {
  state.user = null;
  clearCache();
  document.body.classList.add('logged-out');
  const isLogin = mode === 'login';
  const root = $('#auth');
  root.innerHTML = `
    <div class="auth">
      <section class="auth-side">
        <a href="index.html" class="auth-brand"><img src="icon.svg" width="40" height="40" alt=""><span>Umoja Chama</span></a>
        <div class="auth-pitch">
          <h1>Your chama's money, <span>clear to every member.</span></h1>
          <p>Contributions, loans, repayments, fines and meetings, recorded in one secure place.</p>
          <ul class="auth-points">
            <li>${icon('coins')}<div><b>Every shilling recorded</b><span>See each contribution with its M-Pesa reference.</span></div></li>
            <li>${icon('landmark')}<div><b>Loans made simple</b><span>Apply, get approved and track your balance.</span></div></li>
            <li>${icon('shield')}<div><b>Private and secure</b><span>Members see only their own records.</span></div></li>
          </ul>
        </div>
        <p class="auth-foot">Built for savings groups in Kenya</p>
      </section>
      <section class="auth-main">
        <form class="auth-card" id="authForm" novalidate>
          <a href="index.html" class="auth-brand auth-brand-sm"><img src="icon.svg" width="34" height="34" alt=""><span>Umoja Chama</span></a>
          <div class="auth-switch" data-mode="${mode}" role="tablist" aria-label="Log in or sign up">
            <button type="button" role="tab" aria-selected="${isLogin}" data-mode="login">Log in</button>
            <button type="button" role="tab" aria-selected="${!isLogin}" data-mode="signup">Sign up</button>
          </div>
          <div>
            <h2>${isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p class="muted">${isLogin ? 'Log in with the phone number you registered with.' : 'It takes less than a minute. You join as a member.'}</p>
          </div>
          <div class="auth-error" id="authError" role="alert" hidden></div>
          ${isLogin ? `
            ${authField('phone', 'Phone number', { type: 'tel', autocomplete: 'username', placeholder: '0712 345 678' })}
            ${passwordField('password', 'Password', 'current-password')}` : `
            ${authField('full_name', 'Full name', { autocomplete: 'name', maxlength: 120, placeholder: 'e.g. Jane Wanjiru' })}
            ${authField('phone', 'Phone number', { type: 'tel', autocomplete: 'tel', maxlength: 20, placeholder: '0712 345 678' })}
            <div class="auth-row">
              ${authField('email', 'Email', { type: 'email', autocomplete: 'email', maxlength: 120, optional: true })}
              ${authField('id_number', 'ID number', { maxlength: 20, optional: true })}
            </div>
            ${passwordField('password', 'Password', 'new-password', 'At least 6 characters')}
            ${passwordField('confirm', 'Confirm password', 'new-password')}`}
          <button class="btn btn-primary btn-lg auth-submit" type="submit"><span>${isLogin ? 'Log in' : 'Create account'}</span></button>
          <p class="muted small center">${isLogin
            ? 'New to the chama? <button type="button" class="link-btn" data-mode="signup">Create an account</button>'
            : 'Already a member? <button type="button" class="link-btn" data-mode="login">Log in</button>'}</p>
        </form>
      </section>
    </div>`;

  $$('button[data-mode]', root).forEach(b => {
    b.onclick = () => (b.dataset.mode === 'login' ? renderAuth('login') : renderAuth('signup'));
  });
  $$('.pw-toggle', root).forEach(b => {
    b.onclick = () => {
      const input = b.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.innerHTML = icon(show ? 'ban' : 'eye');
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      b.setAttribute('aria-pressed', show);
    };
  });

  const form = $('#authForm');
  const rules = isLogin
    ? { phone: { label: 'Phone number', required: true }, password: { label: 'Password', required: true } }
    : {
        full_name: { label: 'Full name', required: true, validate: v => v.length < 3 ? 'Enter your full name' : '' },
        phone: { label: 'Phone number', required: true, phone: true },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', required: true, minlength: 6 },
        confirm: { label: 'Confirm password', required: true, match: 'password', matchMessage: 'The passwords do not match' },
      };
  const check = (name, data) => {
    const msg = checkField({ name, ...rules[name] }, data[name], data);
    const wrap = $(`[data-field="${name}"]`, form);
    wrap.classList.toggle('invalid', !!msg);
    $('.field-error', wrap).textContent = msg;
    return msg;
  };
  form.oninput = e => {
    const n = e.target.name;
    if (rules[n] && $(`[data-field="${n}"]`, form).classList.contains('invalid')) check(n, Object.fromEntries(new FormData(form)));
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const bad = Object.keys(rules).filter(n => check(n, data));
    if (bad.length) return $(`[name="${bad[0]}"]`, form).focus();
    for (const k of Object.keys(data)) if (data[k] === '') delete data[k];
    if (data.phone) data.phone = data.phone.replace(/\s/g, '');

    const btn = $('.auth-submit', form);
    btn.disabled = true;
    btn.classList.add('loading');
    $('#authError').hidden = true;
    try {
      if (isLogin) {
        const res = await api.post('/auth/login', data);
        api.token = res.token;
        startSession(res.user);
      } else {
        const { confirm, ...body } = data;
        const res = await api.post('/auth/register', body);
        api.token = res.token;
        toast(`Welcome, ${res.user.full_name}! Your member number is ${res.user.member_no}.`);
        startSession(res.user);
      }
    } catch (err) {
      $('#authError').innerHTML = `${icon('alert')}<span>${esc(err.message)}</span>`;
      $('#authError').hidden = false;
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

function authField(name, label, { type = 'text', autocomplete = '', maxlength, placeholder = '', optional } = {}) {
  return `<label class="field" data-field="${name}"><span class="field-label">${esc(label)}${optional ? ' <em>(optional)</em>' : ''}</span>
    <input name="${name}" type="${type}" ${type === 'tel' ? 'inputmode="tel"' : ''} autocomplete="${autocomplete}" ${maxlength ? `maxlength="${maxlength}"` : ''} placeholder="${esc(placeholder)}">
    <small class="field-error"></small></label>`;
}

function passwordField(name, label, autocomplete, hint = '') {
  return `<label class="field" data-field="${name}"><span class="field-label">${esc(label)}</span>
    <span class="pw"><input name="${name}" type="password" autocomplete="${autocomplete}"><button type="button" class="pw-toggle" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></span>
    ${hint ? `<small class="field-hint">${esc(hint)}</small>` : ''}<small class="field-error"></small></label>`;
}

/* ---------- Session ---------- */

function startSession(user) {
  state.user = user;
  document.body.classList.remove('logged-out');
  $('#auth').innerHTML = '';
  $('#userName').textContent = user.full_name;
  $('#userRole').textContent = cap(user.role);
  $('#profileAvatar').outerHTML = avatar(user.full_name).replace('class="avatar', 'id="profileAvatar" class="avatar');
  $('#searchInput').placeholder = isOfficial() ? 'Search members, loans, payments…' : 'Search my loans, payments, meetings…';
  buildNav();
  render();
  refreshBell();
}

function logout() {
  api.post('/auth/logout').catch(() => {});
  api.token = null;
  closeDrawer();
  location.hash = '';
  renderAuth('login');
}

/* ---------- Navigation ---------- */

function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = NAV_GROUPS.map(([group, title]) => {
    const items = Object.entries(VIEWS).filter(([, v]) => v.group === group && canSee(v));
    if (!items.length) return '';
    return `<div class="nav-group"><span class="nav-title">${esc(title)}</span>${items.map(([key, v]) => {
      const label = !isOfficial() && v.memberLabel ? v.memberLabel : v.label;
      return `<a href="#${key}" class="nav-link" data-view="${key}" title="${esc(label)}"><span class="nav-icon">${icon(v.icon)}</span><span class="nav-label">${esc(label)}</span>${key === 'notifications' ? '<span class="nav-count" id="navCount" hidden></span>' : ''}</a>`;
    }).join('')}</div>`;
  }).join('');
}

const mqMobile = window.matchMedia('(max-width: 1024px)');

function openDrawer() {
  document.body.classList.add('drawer-open');
  $('#scrim').hidden = false;
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  $('.nav-link.active', $('#sidebar'))?.focus();
}
function closeDrawer() {
  document.body.classList.remove('drawer-open');
  $('#scrim').hidden = true;
  $('#menuBtn').setAttribute('aria-expanded', 'false');
}

function toggleCollapse() {
  const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('chama_sidebar', collapsed ? 'collapsed' : 'open'); } catch {}
  $('#collapseBtn').setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
}

/* ---------- Popovers (notifications, profile) ---------- */

function togglePop(btn, pop, open = pop.hidden) {
  $$('.popover').forEach(p => { if (p !== pop) p.hidden = true; });
  $$('[aria-haspopup]').forEach(b => { if (b !== btn) b.setAttribute('aria-expanded', 'false'); });
  pop.hidden = !open;
  btn?.setAttribute('aria-expanded', String(open));
}

async function refreshBell() {
  try {
    const items = await computeNotifications();
    const unread = items.filter(n => !n.read).length;
    for (const badgeEl of [$('#bellCount'), $('#navCount')].filter(Boolean)) {
      badgeEl.hidden = !unread;
      badgeEl.textContent = unread > 9 ? '9+' : unread;
    }
    return items;
  } catch {
    return [];
  }
}

async function openBell() {
  const pop = $('#notifPop');
  togglePop($('#bellBtn'), pop, true);
  pop.innerHTML = `<div class="pop-head"><b>Notifications</b></div><div class="pop-loading">${icon('refresh', 'spin')} Checking…</div>`;
  const items = await refreshBell();
  pop.innerHTML = `<div class="pop-head"><b>Notifications</b>${items.some(n => !n.read) ? '<button type="button" class="link-btn small" id="markAllRead">Mark all as read</button>' : ''}</div>
    <div class="pop-list">${items.length ? items.slice(0, 6).map(notifItem).join('') : emptyState("You're all caught up", 'Nothing needs your attention right now.', 'checkCircle')}</div>
    <a href="#notifications" class="pop-foot">See all notifications</a>`;
  $('#markAllRead', pop)?.addEventListener('click', () => { markRead(items.map(n => n.id)); openBell(); });
  pop.onclick = e => {
    const a = e.target.closest('a');
    if (a) { markRead([a.dataset.id].filter(Boolean)); togglePop($('#bellBtn'), pop, false); refreshBell(); }
  };
}

/* ---------- Global search ---------- */

async function runSearch(q) {
  const box = $('#searchResults');
  q = q.trim().toLowerCase();
  if (q.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div class="pop-loading">${icon('refresh', 'spin')} Searching…</div>`;

  const sources = [
    isOfficial() && ['Members', 'users', load('/members'), m => [m.full_name, m.member_no, m.phone, m.email], m => [m.full_name, `${m.member_no} · ${m.phone}`, `#members?q=${encodeURIComponent(m.full_name)}`]],
    ['Loans', 'landmark', load('/loans'), l => [l.member_name, l.purpose, l.status], l => [`${money(l.principal)} · ${l.member_name}`, `${cap(l.status)} · applied ${fmtDate(l.applied_at)}`, `#loans?q=${encodeURIComponent(l.member_name)}`]],
    ['Contributions', 'coins', load('/contributions'), c => [c.member_name, c.reference], c => [`${money(c.amount)}${c.member_name ? ' · ' + c.member_name : ''}`, `${fmtDate(c.contribution_date)}${c.reference ? ' · ' + c.reference : ''}`, `#contributions?q=${encodeURIComponent(c.reference || c.member_name || '')}`]],
    ['Expenses', 'receipt', load('/expenses'), e => [e.category, e.description, e.receipt_ref], e => [`${money(e.amount)} · ${e.category}`, `${fmtDate(e.expense_date)}${e.description ? ' · ' + e.description : ''}`, `#expenses?q=${encodeURIComponent(e.description || e.category)}`]],
    ['Meetings', 'calendar', load('/meetings'), m => [m.title, m.venue, m.agenda], m => [m.title, `${fmtDate(m.meeting_date)}${m.venue ? ' · ' + m.venue : ''}`, `#meetings?q=${encodeURIComponent(m.title)}`]],
  ].filter(Boolean);

  const groups = await Promise.all(sources.map(async ([title, ic, promise, keys, show]) => {
    try {
      const rows = (await promise).filter(r => keys(r).some(k => String(k ?? '').toLowerCase().includes(q))).slice(0, 4);
      return rows.length ? `<div class="sr-group"><span class="nav-title">${title}</span>${rows.map(r => {
        const [main, sub, href] = show(r);
        return `<a class="sr-item" href="${esc(href)}"><span class="sr-icon">${icon(ic)}</span><span><b>${esc(main)}</b><small>${esc(sub)}</small></span></a>`;
      }).join('')}</div>` : '';
    } catch { return ''; }
  }));
  if ($('#searchInput').value.trim().toLowerCase() !== q) return; // a newer search replaced this one
  box.innerHTML = groups.join('') || emptyState(`No results for "${q}"`, 'Try a name, phone number or M-Pesa code.', 'search');
}

/* ---------- Rendering ---------- */

let renderSeq = 0;

async function render() {
  if (!state.user) return renderAuth('login');
  const route = parseRoute();
  const name = canSee(VIEWS[route.name]) ? route.name : 'dashboard';
  state.route = { name, params: route.params };
  $$('#nav .nav-link').forEach(a => {
    const on = a.dataset.view === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const v = VIEWS[name];
  document.title = `${!isOfficial() && v.memberLabel ? v.memberLabel : v.label} · Umoja Chama`;

  const seq = ++renderSeq;
  const view = $('#view');
  // Draw into a detached element and swap it in when ready, so the old page stays until the new one has loaded.
  const next = document.createElement('div');
  next.className = 'view-inner';
  if (!view.firstElementChild || view.dataset.view !== name) skeleton(view);
  try {
    await v.render(next, route.params);
    if (seq !== renderSeq) return; // the user moved on while this was loading
    hydrateIcons(next);
    view.replaceChildren(next);
  } catch (err) {
    if (seq !== renderSeq) return;
    view.innerHTML = `<div class="error-state">${icon('alert')}<h2>We couldn't load this page</h2><p class="muted">${esc(err.message)}</p><button type="button" class="btn btn-primary" id="retryBtn">${icon('refresh')}<span>Try again</span></button></div>`;
    $('#retryBtn').onclick = () => { clearCache(); render(); };
  }
  if (view.dataset.view !== name) { view.dataset.view = name; window.scrollTo(0, 0); }
}
rerender = () => { render(); refreshBell(); };

/* ---------- Wiring ---------- */

function initShell() {
  hydrateIcons(document);
  $('#menuBtn').innerHTML = icon('menu');
  $('#sidebarClose').innerHTML = icon('x');
  $('#todayLabel').textContent = new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (document.documentElement.classList.contains('sidebar-collapsed')) $('#collapseBtn').setAttribute('aria-label', 'Expand sidebar');

  $('#menuBtn').onclick = openDrawer;
  $('#sidebarClose').onclick = closeDrawer;
  $('#scrim').onclick = closeDrawer;
  $('#collapseBtn').onclick = toggleCollapse;
  $('#logoutBtn').onclick = logout;
  $('#logoutBtn2').onclick = logout;
  $('#nav').addEventListener('click', e => { if (e.target.closest('a') && mqMobile.matches) closeDrawer(); });
  mqMobile.addEventListener('change', () => closeDrawer());

  $('#bellBtn').onclick = e => { e.stopPropagation(); $('#notifPop').hidden ? openBell() : togglePop($('#bellBtn'), $('#notifPop'), false); };
  $('#profileBtn').onclick = e => { e.stopPropagation(); togglePop($('#profileBtn'), $('#profilePop')); };
  $('#profilePop').onclick = e => { if (e.target.closest('a')) togglePop($('#profileBtn'), $('#profilePop'), false); };

  const search = $('#searchInput');
  search.addEventListener('input', debounce(() => runSearch(search.value), 180));
  search.addEventListener('focus', () => search.value.trim().length >= 2 && runSearch(search.value));
  search.addEventListener('keydown', e => {
    const items = $$('.sr-item', $('#searchResults'));
    if (e.key === 'Escape') { search.value = ''; $('#searchResults').hidden = true; search.blur(); }
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[0].focus(); }
    if (e.key === 'Enter' && items.length) { e.preventDefault(); items[0].click(); }
  });
  $('#searchResults').addEventListener('keydown', e => {
    const items = $$('.sr-item', $('#searchResults'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? search : items[i - 1]).focus(); }
    if (e.key === 'Escape') { $('#searchResults').hidden = true; search.focus(); }
  });
  $('#searchResults').addEventListener('click', e => {
    if (e.target.closest('a')) { $('#searchResults').hidden = true; search.value = ''; }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.menu-anchor')) togglePop(null, { hidden: true }, false);
    if (!e.target.closest('#search')) $('#searchResults').hidden = true;
  });
  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing && state.user) { e.preventDefault(); search.focus(); }
    if (e.key === 'Escape') {
      if (document.body.classList.contains('drawer-open')) closeDrawer();
      togglePop(null, { hidden: true }, false);
    }
  });

  let progressTimer;
  window.addEventListener('chama:busy', e => {
    clearTimeout(progressTimer);
    if (e.detail > 0) $('#progress').classList.add('on');
    else progressTimer = setTimeout(() => $('#progress').classList.remove('on'), 150);
  });

  window.addEventListener('hashchange', () => { $$('.popover').forEach(p => p.hidden = true); render(); });
  window.addEventListener('chama:logout', () => { toast('Your session has ended. Please log in again.', 'info'); renderAuth('login'); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
}

// theme: 'system' | 'light' | 'dark'
function applyTheme(theme) {
  if (theme) try { localStorage.setItem('chama_theme', theme); } catch {}
  let t = theme;
  if (!t) try { t = localStorage.getItem('chama_theme'); } catch {}
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

(async function init() {
  initShell();
  if (api.token) {
    try {
      return startSession(await api.get('/auth/me'));
    } catch {
      api.token = null;
    }
  }
  renderAuth('login');
})();
