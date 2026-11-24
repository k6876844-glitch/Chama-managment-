// Dashboard: the group's money at a glance for officials, or "my money" for members.

VIEWS.dashboard = { label: 'Dashboard', icon: 'dashboard', group: 'main', render: renderDashboard };

async function renderDashboard(view) {
  return isOfficial() ? officialDashboard(view) : memberDashboard(view);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

async function officialDashboard(view) {
  const [s, contributions, { loans, repayments }, expenses, fines, meetings, members] = await Promise.all([
    load('/reports/summary'), load('/contributions'), loadRepayments(), load('/expenses'), load('/fines'), load('/meetings'), load('/members'),
  ]);
  const months = lastMonths(12);
  const m = thisMonth();
  const contribThisMonth = sum(contributions.filter(c => monthKey(c.contribution_date) === m), c => c.amount);
  const repaidThisMonth = sum(repayments.filter(r => monthKey(r.payment_date) === m), r => r.amount);
  const spentThisMonth = sum(expenses.filter(e => monthKey(e.expense_date) === m), e => e.amount);
  const activeLoans = loans.filter(l => ['active', 'defaulted'].includes(l.status));
  const overdue = activeLoans.filter(l => l.due_date && daysUntil(l.due_date) < 0);
  const pending = loans.filter(l => l.status === 'pending');
  const paidMembers = new Set(contributions.filter(c => monthKey(c.contribution_date) === m).map(c => c.member_id));
  const activeMembers = members.filter(x => x.status === 'active');

  pageHead(view, {
    title: `${greeting()}, ${state.user.full_name.split(' ')[0]}`,
    subtitle: "Here is how the chama's money stands today.",
    actions: [{ label: 'Full report', icon: 'chart', variant: 'btn-ghost', onClick: () => go('reports') }],
  });

  const top = el('<div class="grid-hero"></div>');
  top.append(el(`<section class="hero-card">
    <div class="hero-top"><span class="hero-label">${icon('wallet')} Chama balance</span><span class="hero-chip">Cash at hand</span></div>
    <strong class="hero-value">${esc(money(s.cash_at_hand))}</strong>
    <p class="hero-sub">Money the chama holds now, after loans given out and expenses.</p>
    <div class="hero-split">
      <div><span>${icon('arrowIn')} Money in</span><b>${esc(money(s.total_income))}</b><small>Contributions, repayments &amp; fines</small></div>
      <div><span>${icon('arrowOut')} Money out</span><b>${esc(money(num(s.total_loans_issued) + num(s.total_expenses)))}</b><small>Loans issued &amp; expenses</small></div>
    </div>
  </section>`));
  top.append(quickActions());
  view.append(top);

  view.append(statGrid([
    { label: 'Total contributions', value: money(s.total_contributions), icon: 'coins', tone: 'good', hint: `<b>${esc(money(contribThisMonth))}</b> this month`, href: '#contributions' },
    { label: 'Outstanding loans', value: money(s.loans_outstanding), icon: 'landmark', tone: 'warn', hint: overdue.length ? `<span class="neg">${overdue.length} overdue</span> · ${activeLoans.length} active` : `${activeLoans.length} active loan${activeLoans.length === 1 ? '' : 's'}`, href: '#loans' },
    { label: 'Loan repayments', value: money(s.total_repayments), icon: 'repeat', tone: 'info', hint: `<b>${esc(money(repaidThisMonth))}</b> this month`, href: '#repayments' },
    { label: 'Total expenses', value: money(s.total_expenses), icon: 'receipt', tone: 'bad', hint: `<b>${esc(money(spentThisMonth))}</b> this month`, href: '#expenses' },
    { label: 'Registered members', value: String(s.active_members), icon: 'users', tone: 'navy', hint: `<b>${paidMembers.size} of ${activeMembers.length}</b> paid this month`, href: '#members' },
  ], 'stats-5'));

  if (pending.length && hasRole('chairperson')) {
    view.append(el(`<a href="#loans?status=pending" class="callout callout-warn">${icon('clock')}<span><b>${pending.length} loan application${pending.length === 1 ? '' : 's'} waiting for your approval</b> · ${esc(money(sum(pending, l => l.principal)))} requested</span>${icon('chevronRight')}</a>`));
  }

  const charts = el('<div class="grid-2"></div>');
  charts.append(card({
    title: 'Monthly savings', subtitle: 'Contributions received each month, last 12 months',
    body: barChart({ data: monthlySeries(contributions, 'contribution_date', 'amount', months), tone: 'savings', caption: 'Monthly contributions' }),
  }));
  charts.append(card({
    title: 'Loan repayments', subtitle: 'Repayments received each month, last 12 months',
    body: barChart({ data: monthlySeries(repayments, 'payment_date', 'amount', months), tone: 'repay', caption: 'Monthly loan repayments' }),
  }));
  view.append(charts);

  const bottom = el('<div class="grid-2-1"></div>');
  bottom.append(card({
    title: 'Recent transactions', subtitle: 'Money in and out of the chama',
    body: transactionList(groupTransactions({ contributions, repayments, expenses, fines, loans }).slice(0, 8)),
    actions: [{ label: 'View report', icon: 'chevronRight', onClick: () => go('reports') }],
  }));
  bottom.append(card({ title: 'Recent activity', body: activityList(groupActivity({ loans, members, meetings, fines }).slice(0, 7)) }));
  view.append(bottom);
}

async function memberDashboard(view) {
  const [st, { loans, repayments }, meetings] = await Promise.all([
    load(`/reports/statement/${state.user.id}`), loadRepayments(), load('/meetings'),
  ]);
  const months = lastMonths(12);
  const m = thisMonth();
  const paidThisMonth = sum(st.contributions.filter(c => monthKey(c.contribution_date) === m), c => c.amount);
  const activeLoans = loans.filter(l => ['active', 'defaulted'].includes(l.status));
  const next = meetings.filter(x => daysUntil(x.meeting_date) >= 0).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))[0];

  pageHead(view, { title: `${greeting()}, ${state.user.full_name.split(' ')[0]}`, subtitle: `Member number ${state.user.member_no || '—'} · ${cap(state.user.role)}` });

  const top = el('<div class="grid-hero"></div>');
  top.append(el(`<section class="hero-card">
    <div class="hero-top"><span class="hero-label">${icon('wallet')} My savings</span><span class="hero-chip">${paidThisMonth ? `${icon('check')} Paid this month` : 'Not paid this month'}</span></div>
    <strong class="hero-value">${esc(money(st.totals.contributions))}</strong>
    <p class="hero-sub">Everything you have contributed to the chama since you joined.</p>
    <div class="hero-split">
      <div><span>${icon('landmark')} Loan balance</span><b>${esc(money(st.totals.loan_balance))}</b><small>${activeLoans.length ? `${activeLoans.length} active loan${activeLoans.length === 1 ? '' : 's'}` : 'No active loans'}</small></div>
      <div><span>${icon('calendar')} Next meeting</span><b>${next ? esc(fmtDate(next.meeting_date)) : 'None scheduled'}</b><small>${next ? esc(next.title + (next.venue ? ' · ' + next.venue : '')) : 'The secretary will post it here'}</small></div>
    </div>
  </section>`));
  top.append(quickActions());
  view.append(top);

  view.append(statGrid([
    { label: 'Paid this month', value: money(paidThisMonth), icon: 'coins', tone: 'good', href: '#contributions' },
    { label: 'My loan balance', value: money(st.totals.loan_balance), icon: 'landmark', tone: 'warn', href: '#loans' },
    { label: 'My unpaid fines', value: money(st.totals.fines_unpaid), icon: 'gavel', tone: num(st.totals.fines_unpaid) ? 'bad' : 'neutral', href: '#fines' },
    { label: 'Meetings attended', value: `${st.attendance.present} of ${st.attendance.total}`, icon: 'calendar', tone: 'navy', href: '#meetings' },
  ]));

  const grid = el('<div class="grid-2-1"></div>');
  grid.append(card({
    title: 'My monthly savings', subtitle: 'What you contributed each month, last 12 months',
    body: barChart({ data: monthlySeries(st.contributions, 'contribution_date', 'amount', months), tone: 'savings', caption: 'My monthly contributions' }),
  }));
  grid.append(card({
    title: 'My loans', subtitle: 'How much of each loan you have repaid',
    body: activeLoans.length ? loanProgressList(activeLoans) : emptyState('No active loans', 'Need money? You can apply for a loan.', 'landmark'),
    actions: [{ label: 'Apply', icon: 'plus', onClick: () => openLoanApplication() }],
  }));
  view.append(grid);

  const tx = [
    ...st.contributions.map(c => ({ dir: 'in', date: c.contribution_date, title: 'Contribution', sub: labelFor(METHODS, c.method) + (c.reference ? ' · ' + c.reference : ''), amount: c.amount, icon: 'coins' })),
    ...repayments.map(r => ({ dir: 'in', date: r.payment_date, title: 'Loan repayment', sub: labelFor(METHODS, r.method) + (r.reference ? ' · ' + r.reference : ''), amount: r.amount, icon: 'repeat' })),
    ...loans.filter(l => l.issue_date && l.status !== 'rejected').map(l => ({ dir: 'out', date: l.issue_date, title: 'Loan received', sub: l.purpose || 'Loan', amount: l.principal, icon: 'landmark' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  view.append(card({
    title: 'My recent transactions', body: transactionList(tx.slice(0, 8), { inLabel: 'Paid', outLabel: 'Received' }),
    actions: [{ label: 'My statement', icon: 'chevronRight', onClick: () => go('reports') }],
  }));
}

/* ---------- Pieces shared with other views ---------- */

function quickActions() {
  const all = {
    contribution: hasRole('treasurer', 'chairperson') && ['Record contribution', 'coins', () => openContributionForm()],
    repayment: hasRole('treasurer') && ['Record repayment', 'repeat', () => go('repayments')],
    expense: hasRole('treasurer') && ['Record expense', 'receipt', () => openExpenseForm()],
    fine: hasRole('treasurer', 'secretary') && ['Add a fine', 'gavel', () => openFineForm()],
    member: hasRole('chairperson', 'secretary') && ['Add member', 'userPlus', () => openMemberForm()],
    approve: hasRole('chairperson') && ['Review loans', 'landmark', () => go('loans', { status: 'pending' })],
    meeting: hasRole('chairperson', 'secretary') && ['Schedule meeting', 'calendar', () => openMeetingForm()],
    loan: ['Apply for a loan', 'landmark', () => openLoanApplication()],
    statement: ['My statement', 'fileText', () => go('reports', isOfficial() ? { member: state.user.id } : undefined)],
  };
  const order = {
    chairperson: ['contribution', 'approve', 'member', 'meeting'],
    treasurer: ['contribution', 'repayment', 'expense', 'fine'],
    secretary: ['member', 'meeting', 'fine', 'statement'],
    member: ['loan', 'statement'],
  }[state.user.role] || ['loan', 'statement'];
  const items = order.map(k => all[k]).filter(Boolean);
  const box = el(`<section class="card quick"><header class="card-head"><div><h2>Quick actions</h2><p class="muted small">Common tasks in one tap</p></div></header><div class="quick-grid"></div></section>`);
  for (const [label, ic, fn] of items) {
    const b = el(`<button type="button" class="quick-btn"><span class="quick-icon">${icon(ic)}</span><span>${esc(label)}</span></button>`);
    b.onclick = fn;
    $('.quick-grid', box).append(b);
  }
  if (!isOfficial()) {
    $('.quick-grid', box).append(el(`<a href="#contributions" class="quick-btn"><span class="quick-icon">${icon('coins')}</span><span>My contributions</span></a>`));
    $('.quick-grid', box).append(el(`<a href="#meetings" class="quick-btn"><span class="quick-icon">${icon('calendar')}</span><span>Meetings</span></a>`));
  }
  return box;
}

// Every money movement in one list: [{ dir: 'in'|'out', date, title, sub, amount, icon }]
function groupTransactions({ contributions, repayments, expenses, fines, loans }) {
  return [
    ...contributions.map(c => ({ dir: 'in', date: c.contribution_date, title: c.member_name || 'Contribution', sub: `Contribution · ${labelFor(METHODS, c.method)}${c.reference ? ' · ' + c.reference : ''}`, amount: c.amount, icon: 'coins' })),
    ...repayments.map(r => ({ dir: 'in', date: r.payment_date, title: r.member_name, sub: `Loan repayment · ${labelFor(METHODS, r.method)}${r.reference ? ' · ' + r.reference : ''}`, amount: r.amount, icon: 'repeat' })),
    ...fines.filter(f => f.status === 'paid').map(f => ({ dir: 'in', date: f.paid_date || f.fine_date, title: f.member_name, sub: `Fine paid · ${f.reason}`, amount: f.amount, icon: 'gavel' })),
    ...loans.filter(l => l.issue_date && ['active', 'cleared', 'defaulted'].includes(l.status)).map(l => ({ dir: 'out', date: l.issue_date, title: l.member_name, sub: `Loan issued${l.purpose ? ' · ' + l.purpose : ''}`, amount: l.principal, icon: 'landmark' })),
    ...expenses.map(e => ({ dir: 'out', date: e.expense_date, title: e.category, sub: `Expense${e.description ? ' · ' + e.description : ''}`, amount: e.amount, icon: 'receipt' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function transactionList(items, { inLabel = 'Money in', outLabel = 'Money out' } = {}) {
  if (!items.length) return emptyState('No transactions yet', 'Payments will show here once they are recorded.', 'wallet');
  return `<ul class="tx-list">${items.map(t => `
    <li class="tx">
      <span class="tx-icon ${t.dir}">${icon(t.icon)}</span>
      <div class="tx-main"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div>
      <div class="tx-amt"><b class="${t.dir === 'in' ? 'pos' : 'neg'}">${t.dir === 'in' ? '+' : '−'} ${esc(money(t.amount))}</b><small>${esc(relTime(t.date))}</small></div>
      <span class="sr-only">${t.dir === 'in' ? inLabel : outLabel}</span>
    </li>`).join('')}</ul>`;
}

function groupActivity({ loans, members, meetings, fines }) {
  return [
    ...loans.map(l => ({ date: l.applied_at, icon: 'landmark', tone: 'warn', text: `<b>${esc(l.member_name)}</b> applied for a loan of ${esc(money(l.principal))}` })),
    ...loans.filter(l => l.issue_date).map(l => ({ date: l.issue_date, icon: 'checkCircle', tone: 'good', text: `Loan to <b>${esc(l.member_name)}</b> approved` })),
    ...members.map(m => ({ date: m.joined_at, icon: 'userPlus', tone: 'navy', text: `<b>${esc(m.full_name)}</b> joined the chama` })),
    ...meetings.map(m => ({ date: m.meeting_date, icon: 'calendar', tone: 'info', text: `${daysUntil(m.meeting_date) >= 0 ? 'Upcoming' : 'Held'}: <b>${esc(m.title)}</b>${m.venue ? ' at ' + esc(m.venue) : ''}` })),
    ...fines.map(f => ({ date: f.fine_date, icon: 'gavel', tone: 'bad', text: `<b>${esc(f.member_name)}</b> fined ${esc(money(f.amount))} · ${esc(f.reason)}` })),
  ].filter(a => a.date && daysUntil(a.date) <= 30).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function activityList(items) {
  if (!items.length) return emptyState('No activity yet');
  return `<ul class="timeline">${items.map(a => `<li><span class="tl-dot tone-${a.tone}">${icon(a.icon)}</span><div><p>${a.text}</p><small>${esc(relTime(a.date))}</small></div></li>`).join('')}</ul>`;
}

function loanProgressList(loans) {
  return `<ul class="loan-prog">${loans.map(l => {
    const pct = num(l.total_due) ? (num(l.amount_paid) / num(l.total_due)) * 100 : 0;
    const d = l.due_date ? daysUntil(l.due_date) : null;
    const due = d == null ? 'No due date' : d < 0 ? `<span class="neg">Overdue by ${-d} day${d === -1 ? '' : 's'}</span>` : `Due ${esc(fmtDate(l.due_date))}`;
    return `<li><div class="lp-top"><b>${esc(l.member_name && isOfficial() ? l.member_name : (l.purpose || 'Loan'))}</b><span>${esc(money(l.balance))} left</span></div>
      ${progressBar(pct, { tone: d != null && d < 0 ? 'bad' : 'good', label: 'Repaid' })}
      <small class="muted">${esc(money(l.amount_paid))} of ${esc(money(l.total_due))} repaid · ${due}</small></li>`;
  }).join('')}</ul>`;
}
