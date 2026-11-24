// Repayments: what is still owed on each active loan, with progress, and the full repayment history.

VIEWS.repayments = { label: 'Repayments', memberLabel: 'My repayments', icon: 'repeat', group: 'money', render: renderRepayments };

async function renderRepayments(view, params) {
  const official = isOfficial();
  const { loans, repayments } = await loadRepayments();
  const active = loans.filter(l => ['active', 'defaulted'].includes(l.status))
    .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  const owed = sum(active, l => l.balance);
  const due = sum(active, l => l.total_due);
  const m = thisMonth();

  pageHead(view, {
    title: official ? 'Repayments' : 'My repayments',
    subtitle: official ? 'Money coming back from loans' : 'Your loan repayments and what is left to pay',
  });

  view.append(statGrid([
    { label: 'Still to be repaid', value: money(owed), icon: 'landmark', tone: 'warn', hint: `On ${active.length} active loan${active.length === 1 ? '' : 's'}` },
    { label: 'Total repaid', value: money(sum(repayments, r => r.amount)), icon: 'repeat', tone: 'good', hint: `${repayments.length} payment${repayments.length === 1 ? '' : 's'}` },
    { label: 'Repaid this month', value: money(sum(repayments.filter(r => monthKey(r.payment_date) === m), r => r.amount)), icon: 'coins', tone: 'info' },
    { label: 'Overall progress', value: due ? `${Math.round(((due - owed) / due) * 100)}%` : '—', icon: 'trendingUp', tone: 'navy', hint: 'Of active loans repaid' },
  ]));

  const outstanding = el('<div class="repay-cards"></div>');
  outstanding.innerHTML = active.length ? active.map(l => {
    const pct = num(l.total_due) ? (num(l.amount_paid) / num(l.total_due)) * 100 : 0;
    const d = l.due_date ? daysUntil(l.due_date) : null;
    const late = d != null && d < 0;
    return `<article class="repay-card${late ? ' is-late' : ''}">
      <header>${official ? `<div class="person">${avatar(l.member_name, 'sm')}<div><b>${esc(l.member_name)}</b><small class="clip">${esc(l.purpose || 'Loan')}</small></div></div>` : `<div><b>${esc(l.purpose || 'Loan')}</b><small class="muted block">Issued ${esc(fmtDate(l.issue_date))}</small></div>`}${badge(late ? 'overdue' : l.status, late ? 'Overdue' : undefined)}</header>
      <div class="repay-amt"><span>Balance</span><b>${esc(money(l.balance))}</b></div>
      ${progressBar(pct, { tone: late ? 'bad' : 'good', label: 'Repaid' })}
      <footer><small class="muted">${esc(money(l.amount_paid))} of ${esc(money(l.total_due))} repaid</small><small class="${late ? 'neg' : d != null && d <= 14 ? 'warn-text' : 'muted'}">${d == null ? 'No due date' : late ? `${-d} days overdue` : `Due ${esc(fmtDate(l.due_date))}`}</small></footer>
      ${hasRole('treasurer') && l.status === 'active' ? `<button type="button" class="btn btn-soft btn-sm btn-block" data-loan="${l.id}">${icon('plus')}<span>Record repayment</span></button>` : ''}
    </article>`;
  }).join('') : emptyState('No outstanding loans', official ? 'Every active loan has been fully repaid.' : 'You have no loan balance. Well done!', 'checkCircle');
  outstanding.onclick = e => {
    const b = e.target.closest('[data-loan]');
    if (b) repaymentForm(active.find(l => String(l.id) === b.dataset.loan));
  };
  view.append(card({ title: 'Outstanding balances', subtitle: 'Active loans, the soonest due first', body: outstanding }));

  view.append(card({
    title: 'Repayment chart', subtitle: 'Repayments received each month, last 12 months',
    body: barChart({ data: monthlySeries(repayments, 'payment_date', 'amount', lastMonths(12)), tone: 'repay', caption: 'Monthly loan repayments' }),
  }));

  view.append(card({
    title: 'Repayment history', cls: 'card-flush',
    body: dataTable({
      rows: repayments,
      query: params.get('q') || '',
      columns: [
        { label: 'Date', value: r => r.payment_date, html: r => esc(fmtDate(r.payment_date)) },
        ...(official ? [{ label: 'Member', value: r => r.member_name, html: r => `<div class="person">${avatar(r.member_name, 'sm')}<b>${esc(r.member_name)}</b></div>` }] : []),
        { label: 'Loan', value: r => `${money(r.loan.principal)} from ${r.loan.issue_date || r.loan.applied_at}`, html: r => `${esc(money(r.loan.principal))}<small class="muted block">${esc(r.loan.purpose || 'Loan')}</small>`, hideSm: true },
        { label: 'Amount', value: r => num(r.amount), html: r => `<b class="pos">${esc(money(r.amount))}</b>`, align: 'right' },
        { label: 'Paid by', value: r => labelFor(METHODS, r.method), html: r => `<span class="method method-${esc(r.method)}">${esc(labelFor(METHODS, r.method))}</span>` },
        { label: 'Reference', value: r => r.reference || '', html: r => r.reference ? `<code>${esc(r.reference)}</code>` : '<span class="muted">—</span>' },
        { label: 'Loan status', value: r => labelFor(LOAN_STATUSES, r.loan.status), html: r => badge(r.loan.status) },
      ],
      searchPlaceholder: official ? 'Search by member or reference…' : 'Search by reference…',
      filters: [{ key: 'method', label: 'Paid by', options: METHODS, test: (r, v) => r.method === v }],
      dateFilter: r => r.payment_date,
      exportName: official ? 'repayments' : 'my-repayments',
      empty: 'No repayments yet',
    }),
  }));
}
