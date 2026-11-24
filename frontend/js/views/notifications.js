// Notifications are worked out from live records (there is no notifications table to read):
// pending approvals, overdue or soon-due loans, unpaid fines, upcoming meetings and missing contributions.
// Which ones you have read is remembered on this device only.

VIEWS.notifications = { label: 'Notifications', icon: 'bell', group: 'account', render: renderNotifications };

const READ_KEY = () => `chama_read_${state.user?.id}`;
function readSet() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY()) || '[]')); } catch { return new Set(); }
}
function markRead(ids) {
  const s = readSet();
  ids.forEach(id => s.add(id));
  try { localStorage.setItem(READ_KEY(), JSON.stringify([...s].slice(-300))); } catch {}
}

async function computeNotifications() {
  const official = isOfficial();
  const [loans, fines, meetings, contributions, members] = await Promise.all([
    load('/loans'), load('/fines'), load('/meetings'), load('/contributions'), official ? load('/members') : Promise.resolve([]),
  ]);
  const out = [];
  const m = thisMonth();
  const who = l => (official ? l.member_name : 'Your');

  if (hasRole('chairperson')) {
    for (const l of loans.filter(x => x.status === 'pending')) {
      out.push({ id: `pending-${l.id}`, tone: 'warn', icon: 'clock', date: l.applied_at, href: '#loans?status=pending',
        title: `Loan approval needed`, text: `${l.member_name} asked for ${money(l.principal)}${l.purpose ? ` for ${l.purpose}` : ''}.` });
    }
  }
  for (const l of loans.filter(x => ['active', 'defaulted'].includes(x.status) && x.due_date)) {
    const d = daysUntil(l.due_date);
    if (d < 0) out.push({ id: `overdue-${l.id}-${l.due_date}`, tone: 'bad', icon: 'warning', date: l.due_date, href: '#loans?status=overdue',
      title: 'Loan overdue', text: `${who(l)}${official ? "'s" : ''} loan balance of ${money(l.balance)} was due ${fmtDate(l.due_date)}.` });
    else if (d <= 7) out.push({ id: `due-${l.id}-${l.due_date}`, tone: 'warn', icon: 'clock', date: l.due_date, href: '#repayments',
      title: 'Loan due soon', text: `${who(l)}${official ? "'s" : ''} balance of ${money(l.balance)} is due ${relTime(l.due_date).toLowerCase()}.` });
  }
  if (!official) {
    for (const l of loans.filter(x => x.status === 'pending')) {
      out.push({ id: `mypending-${l.id}`, tone: 'info', icon: 'clock', date: l.applied_at, href: '#loans', title: 'Application under review', text: `Your request for ${money(l.principal)} is waiting for the chairperson.` });
    }
    for (const l of loans.filter(x => x.status === 'active' && x.issue_date && daysUntil(x.issue_date) >= -14)) {
      out.push({ id: `approved-${l.id}`, tone: 'good', icon: 'checkCircle', date: l.issue_date, href: '#loans', title: 'Loan approved', text: `Your loan of ${money(l.principal)} was approved. You will repay ${money(l.total_due)}.` });
    }
  }
  const unpaid = fines.filter(f => f.status === 'unpaid');
  if (official && unpaid.length) {
    out.push({ id: `fines-${unpaid.length}-${sum(unpaid, f => f.amount)}`, tone: 'warn', icon: 'gavel', date: unpaid[0].fine_date, href: '#fines?status=unpaid',
      title: 'Unpaid fines', text: `${unpaid.length} fine${unpaid.length === 1 ? '' : 's'} worth ${money(sum(unpaid, f => f.amount))} not yet paid.` });
  } else {
    for (const f of unpaid) out.push({ id: `fine-${f.id}`, tone: 'bad', icon: 'gavel', date: f.fine_date, href: '#fines', title: 'You have an unpaid fine', text: `${money(f.amount)} for "${f.reason}".` });
  }
  for (const mt of meetings.filter(x => { const d = daysUntil(x.meeting_date); return d >= 0 && d <= 14; })) {
    out.push({ id: `meeting-${mt.id}-${mt.meeting_date}`, tone: 'info', icon: 'calendar', date: mt.meeting_date, href: '#meetings',
      title: `Meeting ${relTime(mt.meeting_date).toLowerCase()}`, text: `${mt.title}${mt.venue ? ` at ${mt.venue}` : ''} on ${fmtDate(mt.meeting_date)}.` });
  }
  // Only nudge about contributions once the month is a few days old.
  if (Number(today().slice(8)) >= 5) {
    if (official && hasRole('treasurer', 'chairperson')) {
      const paid = new Set(contributions.filter(c => monthKey(c.contribution_date) === m).map(c => c.member_id));
      const missing = members.filter(x => x.status === 'active' && !paid.has(x.id));
      if (missing.length) out.push({ id: `contrib-${m}-${missing.length}`, tone: 'info', icon: 'coins', date: today(), href: '#contributions',
        title: `${missing.length} member${missing.length === 1 ? " hasn't" : "s haven't"} paid for ${monthLabel(m, true)}`, text: missing.slice(0, 3).map(x => x.full_name).join(', ') + (missing.length > 3 ? ` and ${missing.length - 3} more` : '') });
    } else if (!official && !contributions.some(c => monthKey(c.contribution_date) === m)) {
      out.push({ id: `mycontrib-${m}`, tone: 'info', icon: 'coins', date: today(), href: '#contributions', title: 'Contribution reminder', text: `No contribution has been recorded for you in ${monthLabel(m, true)} yet.` });
    }
  }

  const read = readSet();
  const rank = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.map(n => ({ ...n, read: read.has(n.id) }))
    .sort((a, b) => a.read - b.read || rank[a.tone] - rank[b.tone] || String(b.date).localeCompare(String(a.date)));
}

const notifItem = n => `<a href="${esc(n.href)}" class="notif${n.read ? ' is-read' : ''}" data-id="${esc(n.id)}">
  <span class="notif-icon tone-${n.tone}">${icon(n.icon)}</span>
  <span class="notif-body"><b>${esc(n.title)}</b><span>${esc(n.text)}</span><small>${esc(relTime(n.date))}</small></span>
  ${n.read ? '' : '<span class="unread-dot" aria-label="Unread"></span>'}</a>`;

async function renderNotifications(view) {
  const items = await computeNotifications();
  const unread = items.filter(n => !n.read);
  pageHead(view, {
    title: 'Notifications',
    subtitle: unread.length ? `${unread.length} need${unread.length === 1 ? 's' : ''} your attention` : "You're all caught up",
    actions: [unread.length && { label: 'Mark all as read', icon: 'check', variant: 'btn-ghost', onClick: () => { markRead(items.map(n => n.id)); rerender(); } }],
  });
  const list = el(`<div class="notif-list">${items.length ? items.map(notifItem).join('') : emptyState("You're all caught up", 'Nothing needs your attention right now.', 'checkCircle')}</div>`);
  list.onclick = e => { const a = e.target.closest('.notif'); if (a) markRead([a.dataset.id]); };
  view.append(card({ body: list, cls: 'card-flush' }));
}
