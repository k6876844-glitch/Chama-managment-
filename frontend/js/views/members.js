// Members: profile cards or a table, with search, filters, registration, editing and deactivation.

VIEWS.members = { label: 'Members', icon: 'users', group: 'main', officials: true, render: renderMembers };

function memberFields(m = {}) {
  const chair = hasRole('chairperson');
  return [
    { name: 'full_name', label: 'Full name', required: true, value: m.full_name, maxlength: 120, placeholder: 'e.g. Jane Wanjiru' },
    { name: 'phone', label: 'Phone number', type: 'tel', required: true, phone: true, value: m.phone, half: true, placeholder: '0712345678', hint: 'Used to log in' },
    { name: 'email', label: 'Email', type: 'email', value: m.email, half: true, maxlength: 120 },
    { name: 'id_number', label: 'National ID number', value: m.id_number, half: true, maxlength: 20 },
    // Only the chairperson may assign official roles; the backend enforces this too.
    chair || !m.id
      ? { name: 'role', label: 'Role', type: 'select', options: chair ? ROLES : [['member', 'Member']], value: m.role || 'member', half: true, hint: chair ? '' : 'Only the chairperson can assign official roles' }
      : { type: 'html', html: `<div class="field half"><span class="field-label">Role</span><div class="static-value">${esc(cap(m.role))}</div></div>` },
    ...(m.id ? [{ name: 'status', label: 'Membership status', type: 'segmented', options: [['active', 'Active'], ['inactive', 'Inactive']], value: m.status }] : []),
    { name: 'password', label: m.id ? 'New password' : 'Password', type: 'password', required: !m.id, minlength: 6, autocomplete: 'new-password', hint: m.id ? 'Leave blank to keep the current password' : 'At least 6 characters. Share it with the member privately.' },
  ];
}

function openMemberForm(m) {
  const tidy = d => ({ ...d, phone: d.phone?.replace(/\s/g, '') });
  return m
    ? formAction({ title: `Edit ${m.full_name}`, subtitle: `Member ${m.member_no}`, fields: memberFields(m), submitLabel: 'Save changes' },
      d => api.put(`/members/${m.id}`, tidy(d)), 'Member details updated')
    : formAction({ title: 'Register a new member', subtitle: 'They can log in with this phone number and password.', fields: memberFields(), submitLabel: 'Register member' },
      d => api.post('/members', tidy(d)), 'Member registered');
}

function deactivateMember(m) {
  return confirmAction({
    title: `Deactivate ${m.full_name}?`,
    text: 'They will no longer be able to log in. Their contributions, loans and history are kept, and you can reactivate them later by editing their details.',
    ok: 'Deactivate',
  }, () => api.delete(`/members/${m.id}`), `${m.full_name} has been deactivated`);
}

let membersLayout = (() => { try { return localStorage.getItem('chama_members_layout') || 'cards'; } catch { return 'cards'; } })();

async function renderMembers(view, params) {
  const canEdit = hasRole('chairperson', 'secretary');
  const [members, contributions, loans] = await Promise.all([load('/members'), load('/contributions'), load('/loans')]);
  const m = thisMonth();
  const paid = new Set(contributions.filter(c => monthKey(c.contribution_date) === m).map(c => c.member_id));
  const saved = {}, owing = {};
  for (const c of contributions) saved[c.member_id] = (saved[c.member_id] || 0) + num(c.amount);
  for (const l of loans) if (['active', 'defaulted'].includes(l.status)) owing[l.member_id] = (owing[l.member_id] || 0) + num(l.balance);
  const rows = members.map(x => ({ ...x, saved: saved[x.id] || 0, owing: owing[x.id] || 0, paidThisMonth: paid.has(x.id) }));

  const active = rows.filter(r => r.status === 'active');
  pageHead(view, {
    title: 'Members',
    subtitle: `${active.length} active member${active.length === 1 ? '' : 's'} · ${rows.length - active.length} inactive`,
    actions: [canEdit && { label: 'Register member', icon: 'userPlus', onClick: () => openMemberForm() }],
  });

  view.append(statGrid([
    { label: 'Active members', value: String(active.length), icon: 'users', tone: 'navy' },
    { label: 'Officials', value: String(active.filter(r => OFFICIALS.includes(r.role)).length), icon: 'shield', tone: 'info', hint: 'Chair, treasurer, secretary' },
    { label: 'Paid this month', value: `${active.filter(r => r.paidThisMonth).length} of ${active.length}`, icon: 'checkCircle', tone: 'good', hint: esc(monthLabel(m, true)) },
    { label: 'Members with loans', value: String(active.filter(r => r.owing > 0).length), icon: 'landmark', tone: 'warn' },
  ]));

  const actions = canEdit ? r => [
    { label: 'Statement', icon: 'fileText', onClick: () => go('reports', { member: r.id }) },
    { label: 'Edit', icon: 'edit', onClick: () => openMemberForm(r) },
    ...(hasRole('chairperson') && r.status === 'active' && r.id !== state.user.id ? [{ label: 'Deactivate', icon: 'ban', tone: 'danger', onClick: () => deactivateMember(r) }] : []),
  ] : r => [{ label: 'Statement', icon: 'fileText', onClick: () => go('reports', { member: r.id }) }];

  const columns = [
    { label: 'Member', value: r => r.full_name, html: r => `<div class="person">${avatar(r.full_name)}<div><b>${esc(r.full_name)}</b><small>${esc(r.member_no || '')}</small></div></div>` },
    { label: 'Phone', value: r => r.phone, html: r => `<a href="tel:${esc(r.phone)}" class="plain-link">${esc(r.phone)}</a>` },
    { label: 'Email', value: r => r.email || '', hideSm: true },
    { label: 'Role', value: r => cap(r.role), html: r => `<span class="role role-${esc(r.role)}">${esc(cap(r.role))}</span>` },
    { label: 'Total saved', value: r => r.saved, html: r => esc(money(r.saved)), align: 'right', csv: r => r.saved },
    { label: 'This month', value: r => r.paidThisMonth ? 'Paid' : 'Not paid', html: r => r.status !== 'active' ? '—' : badge(r.paidThisMonth ? 'paid' : 'unpaid', r.paidThisMonth ? 'Paid' : 'Not paid') },
    { label: 'Status', value: r => cap(r.status), html: r => badge(r.status) },
    { label: 'Joined', value: r => r.joined_at, html: r => esc(fmtDate(r.joined_at)), hideSm: true },
  ];

  const toggle = el(`<div class="seg seg-icons" role="group" aria-label="Layout">
    <button type="button" data-l="cards" aria-pressed="${membersLayout === 'cards'}" title="Profile cards">${icon('grid')}</button>
    <button type="button" data-l="table" aria-pressed="${membersLayout === 'table'}" title="Table">${icon('list')}</button></div>`);

  const table = dataTable({
    columns, rows, actions,
    query: params.get('q') || '',
    searchPlaceholder: 'Search by name, phone or member number…',
    filters: [
      { key: 'role', label: 'Role', options: ROLES, test: (r, v) => r.role === v },
      { key: 'status', label: 'Status', options: [['active', 'Active'], ['inactive', 'Inactive']], test: (r, v) => r.status === v },
    ],
    exportName: 'members',
    empty: 'No members yet',
    emptyText: canEdit ? 'Register your first member to get started.' : '',
    toolbarExtra: toggle,
    pageSize: 12,
  });

  // Card layout reuses the table's search and filters: it draws the table's current filtered rows as profile cards.
  const cards = el('<div class="member-cards"></div>');
  const drawCards = () => {
    const list = table.filtered();
    cards.innerHTML = list.length ? list.map(r => `
      <article class="member-card${r.status !== 'active' ? ' is-inactive' : ''}">
        <div class="mc-top">${avatar(r.full_name, 'lg')}<div class="mc-id"><b>${esc(r.full_name)}</b><small>${esc(r.member_no || '')} · <span class="role role-${esc(r.role)}">${esc(cap(r.role))}</span></small></div>${badge(r.status)}</div>
        <ul class="mc-contact"><li>${icon('phone')}<a href="tel:${esc(r.phone)}" class="plain-link">${esc(r.phone)}</a></li><li>${icon('mail')}${r.email ? `<a href="mailto:${esc(r.email)}" class="plain-link">${esc(r.email)}</a>` : '<span class="muted">No email</span>'}</li></ul>
        <div class="mc-stats"><div><span>Total saved</span><b>${esc(money(r.saved))}</b></div><div><span>Loan balance</span><b class="${r.owing ? 'warn-text' : ''}">${esc(money(r.owing))}</b></div></div>
        <div class="mc-foot">${r.status === 'active' ? badge(r.paidThisMonth ? 'paid' : 'unpaid', r.paidThisMonth ? 'Paid this month' : 'Not paid this month') : '<span class="muted small">Inactive</span>'}<div class="mc-actions" data-id="${r.id}"></div></div>
      </article>`).join('') : emptyState(rows.length ? 'Nothing matches your search' : 'No members yet', '', 'users');
    $$('.mc-actions', cards).forEach(box => {
      const r = rows.find(x => String(x.id) === box.dataset.id);
      for (const a of actions(r)) {
        const b = el(`<button type="button" class="icon-btn sm${a.tone === 'danger' ? ' danger' : ''}" title="${esc(a.label)}" aria-label="${esc(a.label)} ${esc(r.full_name)}">${icon(a.icon)}</button>`);
        b.onclick = () => a.onClick(r);
        box.append(b);
      }
    });
  };

  const apply = () => {
    table.classList.toggle('as-cards', membersLayout === 'cards');
    $$('button', toggle).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === membersLayout)));
    if (membersLayout === 'cards') drawCards();
  };
  toggle.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    membersLayout = b.dataset.l;
    try { localStorage.setItem('chama_members_layout', membersLayout); } catch {}
    apply();
  };
  // Redraw the cards whenever the table's search or filters change.
  table.addEventListener('input', () => setTimeout(() => membersLayout === 'cards' && drawCards(), 140));
  table.addEventListener('change', () => membersLayout === 'cards' && drawCards());

  $('.table-wrap', table).before(cards);
  apply();
  view.append(card({ body: table, cls: 'card-flush' }));
}
