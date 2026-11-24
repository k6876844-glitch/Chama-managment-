// Financial reports: income statement for a period, charts, member balances and member statements.
// "Download PDF" uses the browser's print dialog (choose "Save as PDF"); "Excel" downloads CSV files that open in Excel.

VIEWS.reports = { label: 'Financial Reports', memberLabel: 'My statement', icon: 'chart', group: 'group', render: renderReports };

const PERIODS = [
  ['month', 'This month', () => thisMonth() + '-01'],
  ['3m', 'Last 3 months', () => lastMonths(3)[0] + '-01'],
  ['year', 'This year', () => today().slice(0, 4) + '-01-01'],
  ['all', 'All time', () => ''],
];

function printHeader(title, sub) {
  return el(`<div class="print-head"><img src="icon.svg" width="40" height="40" alt=""><div><b>Umoja Chama</b><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><p class="print-meta">Generated ${esc(fmtDate(today()))}<br>by ${esc(state.user.full_name)} (${esc(cap(state.user.role))})</p></div>`);
}

function printReport() {
  toast('In the print window, choose "Save as PDF" to download the report.', 'info');
  setTimeout(() => window.print(), 300);
}

async function renderReports(view, params) {
  if (!isOfficial()) {
    pageHead(view, {
      title: 'My statement', subtitle: 'Your full record with the chama',
      actions: [{ label: 'Download PDF', icon: 'printer', variant: 'btn-ghost', onClick: printReport }],
    });
    const box = el('<div></div>');
    view.append(box);
    return renderStatement(box, state.user.id);
  }

  const period = PERIODS.find(p => p[0] === params.get('period')) || PERIODS[2];
  const from = period[2]();
  const inRange = d => !!d && (!from || String(d) >= from) && String(d) <= today();

  const [s, contributions, { loans, repayments }, expenses, fines, members] = await Promise.all([
    load('/reports/summary'), load('/contributions'), loadRepayments(), load('/expenses'), load('/fines'), load('/members'),
  ]);

  const c = sum(contributions.filter(x => inRange(x.contribution_date)), x => x.amount);
  const r = sum(repayments.filter(x => inRange(x.payment_date)), x => x.amount);
  const fp = sum(fines.filter(x => x.status === 'paid' && inRange(x.paid_date || x.fine_date)), x => x.amount);
  const issued = sum(loans.filter(x => ['active', 'cleared', 'defaulted'].includes(x.status) && inRange(x.issue_date)), x => x.principal);
  const ex = sum(expenses.filter(x => inRange(x.expense_date)), x => x.amount);
  const income = c + r + fp, outflow = issued + ex;

  const ledger = groupTransactions({ contributions, repayments, expenses, fines, loans }).filter(t => inRange(t.date));
  const periodLabel = from ? `${fmtDate(from)} to ${fmtDate(today())}` : 'All records to date';

  pageHead(view, {
    title: 'Financial reports', subtitle: 'Share these at meetings so every member sees the same numbers',
    actions: [
      { label: 'Excel', icon: 'sheet', variant: 'btn-ghost', title: 'Download every transaction in this period (CSV, opens in Excel)', onClick: () => downloadCSV(`chama-transactions-${period[0]}`, [
        { label: 'Date', value: t => t.date }, { label: 'Direction', value: t => (t.dir === 'in' ? 'Money in' : 'Money out') },
        { label: 'Name', value: t => t.title }, { label: 'Details', value: t => t.sub }, { label: 'Amount (KES)', value: t => (t.dir === 'in' ? 1 : -1) * num(t.amount) },
      ], ledger) },
      { label: 'Download PDF', icon: 'printer', onClick: printReport },
    ],
  });

  const tabs = el(`<div class="period-tabs" role="tablist" aria-label="Report period">${PERIODS.map(([k, l]) => `<a href="#reports?period=${k}" role="tab" aria-selected="${k === period[0]}" class="chip${k === period[0] ? ' active' : ''}">${esc(l)}</a>`).join('')}</div>`);
  view.append(tabs);
  view.append(printHeader('Financial report', periodLabel));

  view.append(statGrid([
    { label: 'Money in', value: money(income), icon: 'arrowIn', tone: 'good', hint: esc(period[1]) },
    { label: 'Money out', value: money(outflow), icon: 'arrowOut', tone: 'bad', hint: 'Loans issued + expenses' },
    { label: 'Net cash flow', value: (income - outflow < 0 ? '− ' : '') + money(Math.abs(income - outflow)), icon: 'trendingUp', tone: income - outflow >= 0 ? 'info' : 'warn', hint: esc(period[1]) },
    { label: 'Cash at hand today', value: money(s.cash_at_hand), icon: 'wallet', tone: 'navy', hint: 'All-time balance' },
  ]));

  const stmt = [
    ['in', 'Contributions', c], ['in', 'Loan repayments', r], ['in', 'Fines paid', fp],
    ['total', 'Total money in', income],
    ['out', 'Loans issued', issued], ['out', 'Expenses', ex],
    ['total', 'Total money out', outflow],
    ['net', 'Net cash flow', income - outflow],
  ];
  const statement = el(`<table class="statement"><tbody>${stmt.map(([k, l, v]) => `<tr class="st-${k}"><td>${esc(l)}</td><td class="num ${k === 'out' ? 'neg' : k === 'net' ? (v >= 0 ? 'pos' : 'neg') : ''}">${k === 'out' ? '− ' : ''}${esc(money(Math.abs(v)))}</td></tr>`).join('')}</tbody></table>`);

  const grid = el('<div class="grid-2-1"></div>');
  grid.append(card({
    title: 'Income statement', subtitle: periodLabel, body: statement,
    actions: [{ label: 'Export', icon: 'download', onClick: () => downloadCSV(`income-statement-${period[0]}`, [{ label: 'Item', value: x => x[1] }, { label: 'Amount (KES)', value: x => (x[0] === 'out' ? -1 : 1) * x[2] }], stmt) }],
  }));
  const active = loans.filter(l => ['active', 'defaulted'].includes(l.status));
  const repaid = sum(active, l => l.amount_paid), owed = sum(active, l => l.balance);
  grid.append(card({
    title: 'Loan portfolio', subtitle: 'Active loans: repaid vs still owed',
    body: active.length ? donut({
      centerLabel: 'repaid', centerValue: `${Math.round((repaid / (repaid + owed || 1)) * 100)}%`,
      parts: [{ label: 'Repaid', value: repaid, display: money(repaid), cls: 'p-good' }, { label: 'Still owed', value: owed, display: money(owed), cls: 'p-warn' }],
    }) : emptyState('No active loans', '', 'landmark'),
  }));
  view.append(grid);

  const months = lastMonths(12);
  const charts = el('<div class="grid-2"></div>');
  charts.append(card({ title: 'Monthly contributions', subtitle: 'Last 12 months', body: barChart({ data: monthlySeries(contributions, 'contribution_date', 'amount', months), tone: 'savings', caption: 'Monthly contributions' }) }));
  const byCat = {};
  for (const e of expenses.filter(x => inRange(x.expense_date))) byCat[e.category] = (byCat[e.category] || 0) + num(e.amount);
  charts.append(card({ title: 'Expenses by category', subtitle: periodLabel, body: hbarChart({ data: Object.entries(byCat).map(([label, value]) => ({ label, value })) }) }));
  view.append(charts);

  // Member balances: one row per member, from the same lists the rest of the app uses.
  const bal = members.map(m => ({
    ...m,
    saved: sum(contributions.filter(x => x.member_id === m.id), x => x.amount),
    savedPeriod: sum(contributions.filter(x => x.member_id === m.id && inRange(x.contribution_date)), x => x.amount),
    loan: sum(active.filter(l => l.member_id === m.id), l => l.balance),
    finesDue: sum(fines.filter(f => f.member_id === m.id && f.status === 'unpaid'), f => f.amount),
  }));
  view.append(card({
    title: 'Member balances', subtitle: 'Savings, loans and fines per member', cls: 'card-flush page-break',
    body: dataTable({
      rows: bal, pageSize: 50,
      columns: [
        { label: 'Member', value: m => m.full_name, html: m => `<div class="person">${avatar(m.full_name, 'sm')}<div><b>${esc(m.full_name)}</b><small>${esc(m.member_no || '')}</small></div></div>` },
        { label: `Saved (${period[1].toLowerCase()})`, value: m => m.savedPeriod, html: m => esc(money(m.savedPeriod)), align: 'right' },
        { label: 'Total saved', value: m => m.saved, html: m => `<b>${esc(money(m.saved))}</b>`, align: 'right' },
        { label: 'Loan balance', value: m => m.loan, html: m => m.loan ? `<span class="warn-text">${esc(money(m.loan))}</span>` : '<span class="muted">—</span>', align: 'right' },
        { label: 'Unpaid fines', value: m => m.finesDue, html: m => m.finesDue ? `<span class="neg">${esc(money(m.finesDue))}</span>` : '<span class="muted">—</span>', align: 'right' },
        { label: 'Status', value: m => cap(m.status), html: m => badge(m.status) },
      ],
      filters: [{ key: 'status', label: 'Status', options: [['active', 'Active'], ['inactive', 'Inactive']], test: (m, v) => m.status === v }],
      initial: { status: 'active' },
      searchPlaceholder: 'Search members…',
      exportName: 'member-balances',
      actions: m => [{ label: 'Statement', icon: 'fileText', onClick: () => go('reports', { period: period[0], member: m.id }) }],
    }),
  }));

  // Member statement
  const picker = el(`<select aria-label="Choose a member"><option value="">Choose a member…</option>${members.map(m => `<option value="${m.id}">${esc(m.full_name)} (${esc(m.member_no)})</option>`).join('')}</select>`);
  const holder = el(`<div>${emptyState('Choose a member to see their statement', 'It shows their contributions, loans, fines and attendance.', 'fileText')}</div>`);
  const show = id => {
    holder.innerHTML = '<div class="sk sk-block"></div>';
    renderStatement(holder, id).then(() => hydrateIcons(holder)).catch(err => { holder.innerHTML = `<p class="error">${esc(err.message)}</p>`; });
  };
  picker.onchange = () => picker.value && show(picker.value);
  const stCard = card({ title: 'Member statement', subtitle: 'Print or save it for the member', body: holder, actions: [picker], cls: 'page-break' });
  stCard.id = 'statement';
  view.append(stCard);
  if (params.get('member')) {
    picker.value = params.get('member');
    show(params.get('member'));
    setTimeout(() => stCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
}

async function renderStatement(container, memberId) {
  const st = await load(`/reports/statement/${memberId}`);
  const m = st.member;
  container.innerHTML = '';
  if (!isOfficial()) container.append(printHeader('Member statement', `${m.full_name} · ${m.member_no}`));
  container.append(el(`<div class="statement-head">${avatar(m.full_name, 'lg')}<div><b>${esc(m.full_name)}</b><small>${esc(m.member_no || '')} · ${esc(cap(m.role))} · Joined ${esc(fmtDate(m.joined_at))}</small><small>${icon('phone')} ${esc(m.phone)}${m.email ? ` · ${icon('mail')} ${esc(m.email)}` : ''}</small></div>${badge(m.status)}</div>`));
  container.append(statGrid([
    { label: 'Total contributions', value: money(st.totals.contributions), icon: 'coins', tone: 'good' },
    { label: 'Loan balance', value: money(st.totals.loan_balance), icon: 'landmark', tone: 'warn' },
    { label: 'Unpaid fines', value: money(st.totals.fines_unpaid), icon: 'gavel', tone: num(st.totals.fines_unpaid) ? 'bad' : 'neutral' },
    { label: 'Meetings attended', value: `${st.attendance.present} of ${st.attendance.total}`, icon: 'calendar', tone: 'navy' },
  ]));
  const slug = String(m.member_no || m.id).toLowerCase();
  container.append(card({
    title: 'Contributions', cls: 'card-flush',
    body: dataTable({
      rows: st.contributions, pageSize: 10, exportName: `statement-${slug}-contributions`,
      columns: [
        { label: 'Date', value: c => c.contribution_date, html: c => esc(fmtDate(c.contribution_date)) },
        { label: 'Amount', value: c => num(c.amount), html: c => `<b class="pos">${esc(money(c.amount))}</b>`, align: 'right' },
        { label: 'Paid by', value: c => labelFor(METHODS, c.method) },
        { label: 'Reference', value: c => c.reference || '' },
      ],
      dateFilter: c => c.contribution_date,
      empty: 'No contributions yet',
    }),
  }));
  container.append(card({
    title: 'Loans', cls: 'card-flush',
    body: dataTable({
      rows: st.loans, pageSize: 10, exportName: `statement-${slug}-loans`,
      columns: [
        { label: 'Applied', value: l => l.applied_at, html: l => esc(fmtDate(l.applied_at)) },
        { label: 'Borrowed', value: l => num(l.principal), html: l => esc(money(l.principal)), align: 'right' },
        { label: 'Total due', value: l => num(l.total_due), html: l => esc(money(l.total_due)), align: 'right' },
        { label: 'Repaid', value: l => num(l.amount_paid), html: l => esc(money(l.amount_paid)), align: 'right' },
        { label: 'Balance', value: l => num(l.balance), html: l => ['active', 'defaulted'].includes(l.status) ? `<b>${esc(money(l.balance))}</b>` : '—', align: 'right' },
        { label: 'Due', value: l => l.due_date || '', html: l => esc(fmtDate(l.due_date)) },
        { label: 'Status', value: l => labelFor(LOAN_STATUSES, l.status), html: l => badge(l.status) },
      ],
      empty: 'No loans',
    }),
  }));
  container.append(card({
    title: 'Fines', cls: 'card-flush',
    body: dataTable({
      rows: st.fines, pageSize: 10, exportName: `statement-${slug}-fines`,
      columns: [
        { label: 'Date', value: f => f.fine_date, html: f => esc(fmtDate(f.fine_date)) },
        { label: 'Reason', wrap: true, value: f => f.reason },
        { label: 'Amount', value: f => num(f.amount), html: f => esc(money(f.amount)), align: 'right' },
        { label: 'Status', value: f => cap(f.status), html: f => badge(f.status) },
      ],
      empty: 'No fines',
    }),
  }));
}
