// Settings: my profile, appearance (theme, sidebar) and account security.

VIEWS.settings = { label: 'Settings', icon: 'settings', group: 'account', render: renderSettings };

async function renderSettings(view) {
  const me = await api.get('/auth/me');
  state.user = { ...state.user, ...me };
  // The API lets the chairperson and secretary edit member records (including their own); other members ask them.
  const canSelfEdit = hasRole('chairperson', 'secretary');

  pageHead(view, { title: 'Settings', subtitle: 'Your profile and how the app looks on this device' });

  const profile = el(`<div class="profile">
    <div class="profile-id">${avatar(me.full_name, 'xl')}<div><b>${esc(me.full_name)}</b><span class="role role-${esc(me.role)}">${esc(cap(me.role))}</span><small class="muted">Member ${esc(me.member_no || '—')} · joined ${esc(fmtDate(me.joined_at))}</small></div></div>
    <dl class="detail-grid">
      <div><dt>Phone (used to log in)</dt><dd>${esc(me.phone)}</dd></div>
      <div><dt>Email</dt><dd>${esc(me.email || 'Not added')}</dd></div>
      <div><dt>National ID</dt><dd>${esc(me.id_number || 'Not added')}</dd></div>
      <div><dt>Status</dt><dd>${badge(me.status)}</dd></div>
    </dl>
    ${canSelfEdit ? '' : `<p class="callout callout-info">${icon('alert')}<span>To change your details or password, ask the chairperson or secretary.</span></p>`}
  </div>`);
  view.append(card({
    title: 'My profile', body: profile,
    actions: [canSelfEdit && { label: 'Edit details', icon: 'edit', onClick: () => editOwnProfile(me) }],
  }));

  let theme = 'system';
  try { theme = localStorage.getItem('chama_theme') || 'system'; } catch {}
  const appearance = el(`<div class="settings-list">
    <div class="setting"><div><b>Theme</b><small class="muted">Choose light, dark, or follow your device</small></div>
      <div class="seg" role="radiogroup" aria-label="Theme">${[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Device', 'monitor']].map(([v, l, ic]) =>
        `<label><input type="radio" name="theme" value="${v}"${theme === v ? ' checked' : ''}><span>${icon(ic)}${l}</span></label>`).join('')}</div></div>
    <div class="setting hide-mobile"><div><b>Compact sidebar</b><small class="muted">Show only icons in the menu to give pages more room</small></div>
      <label class="switch"><input type="checkbox" id="compactToggle"${document.documentElement.classList.contains('sidebar-collapsed') ? ' checked' : ''}><span></span><span class="sr-only">Compact sidebar</span></label></div>
  </div>`);
  appearance.addEventListener('change', e => {
    if (e.target.name === 'theme') { applyTheme(e.target.value); toast('Theme updated'); }
    if (e.target.id === 'compactToggle') toggleCollapse();
  });
  view.append(card({ title: 'Appearance', subtitle: 'Saved on this device', body: appearance }));

  const security = el(`<div class="settings-list">
    <div class="setting"><div><b>Password</b><small class="muted">${canSelfEdit ? 'Change the password you use to log in' : 'Ask the chairperson or secretary to reset it for you'}</small></div><div class="setting-act"></div></div>
    <div class="setting"><div><b>Log out</b><small class="muted">You are logged out automatically when your session expires</small></div><div class="setting-act2"></div></div>
  </div>`);
  if (canSelfEdit) $('.setting-act', security).append(button({ label: 'Change password', icon: 'shield', variant: 'btn-ghost', onClick: () => changeOwnPassword(me) }));
  $('.setting-act2', security).append(button({ label: 'Log out', icon: 'logout', variant: 'btn-soft-danger', onClick: logout }));
  view.append(card({ title: 'Security', body: security }));

  view.append(card({
    title: 'About', body: `<div class="settings-list"><div class="setting"><div><b>Umoja Chama</b><small class="muted">Connected to ${esc(API_BASE)}</small></div></div></div>`,
  }));
}

function editOwnProfile(me) {
  return formAction({
    title: 'Edit my details', submitLabel: 'Save changes',
    fields: [
      { name: 'full_name', label: 'Full name', required: true, value: me.full_name, maxlength: 120 },
      { name: 'phone', label: 'Phone number', type: 'tel', required: true, phone: true, value: me.phone, half: true, hint: 'You will log in with this' },
      { name: 'email', label: 'Email', type: 'email', value: me.email, half: true },
      { name: 'id_number', label: 'National ID number', value: me.id_number, maxlength: 20 },
    ],
  }, async d => {
    const updated = await api.put(`/members/${me.id}`, { ...d, phone: d.phone.replace(/\s/g, '') });
    state.user = { ...state.user, ...updated };
    $('#userName').textContent = updated.full_name;
  }, 'Your details were updated');
}

function changeOwnPassword(me) {
  return formAction({
    title: 'Change password', subtitle: 'Use at least 6 characters', submitLabel: 'Change password',
    fields: [
      { name: 'password', label: 'New password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' },
      { name: 'confirm', label: 'Confirm new password', type: 'password', required: true, match: 'password', matchMessage: 'The passwords do not match', autocomplete: 'new-password', transient: true },
    ],
  }, d => api.put(`/members/${me.id}`, { password: d.password }), 'Password changed');
}
