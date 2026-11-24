// Loans: applications, approval, balances and repayment deadlines.

VIEWS.loans = { label: 'Loans', memberLabel: 'My loans', icon: 'landmark', group: 'money', render: renderLoans };

async function openLoanApplication() {
  const official = isOfficial();
  let members = [];
  try { if (official) members = await memberOptions(); } catch (err) { return toast(err.message, 'error'); }
  const fields = [
    ...(official ? [{ name: 'member_id', label: 'Loan for', type: 'select', options: members, value: state.user.id, hint: 'Officials can record a loan on behalf of a member' }] : []),
    { name: 'principal', label: 'How much do you need?', type: 'money', required: true, half: true },
    { name: 'due_date', label: 'Repay by', type: 'date', min: addDays(1), half: true, value: addDays(90), hint: 'The date you will finish repaying' },
    ...(official ? [{ name: 'interest_rate', label: 'Interest rate (%)', type: 'number', positive: false, half: true, hint: "Leave blank to use the chama's standard rate",
      validate: v => (Number(v) < 0 || Number(v) > 100 ? 'Enter a rate between 0 and 100' : '') }] : []),
    { name: 'purpose', label: 'What is the loan for?', type: 'textarea', rows: 3, maxlength: 255, placeholder: 'e.g. School fees, business stock, farming inputs' },
    { type: 'html', html: '<div class="loan-preview" id="loanPreview"></div>' },
  ];
  const preview = body => {
    const p = $('#loanPreview', body);
    const amt = num($('[name=principal]', body).value);
    const rateInput = $('[name=interest_rate]', body);
    const due = $('[name=due_date]', body).value;
    const days = due ? daysUntil(due) : 0;
    const rateText = rateInput && rateInput.value !== '' ? `${num(rateInput.value)}%` : null;
    p.innerHTML = amt > 0
      ? `${icon('alert')}<div><b>You are asking for ${esc(money(amt))}${days > 0 ? `, to repay within ${days} day${days === 1 ? '' : 's'}` : ''}.</b>
         <span>Interest is flat: ${rateText ? `at ${rateText} you will repay <b>${esc(money(amt * (1 + num(rateInput.value) / 100)))}</b>` : "the chama's standard rate is added once, whatever the term"}. The chairperson reviews every application.</span></div>`
      : `${icon('alert')}<div><span>Enter an amount to see a summary. The chairperson reviews every application.</span></div>`;
  };
  return formAction({
    title: official ? 'Record a loan application' : 'Apply for a loan',
    subtitle: 'Your application goes to the chairperson for approval.',
    fields, submitLabel: 'Send application',
    onRender: body => { preview(body); body.addEventListener('input', () => preview(body)); },
  }, d => api.post('/loans', d), 'Loan application sent. You will see it here once it is reviewed.');
}

function repaymentForm(l) {
  return formAction({
    title: 'Record a repayment',
    subtitle: `${l.member_name} · balance ${money(l.balance)}`,
    fields: [
      { name: 'amount', label: 'Amount repaid', type: 'money', required: true, value: num(l.balance), maxValue: num(l.balance), half: true, hint: `Up to ${money(l.balance)}` },
      { name: 'payment_date', label: 'Date paid', type: 'date', value: today(), required: true, max: today(), half: true },
      { name: 'method', label: 'Paid by', type: 'segmented', options: METHODS, value: 'mpesa' },
      { name: 'reference', label: 'Reference', maxlength: 50, placeholder: 'e.g. M-Pesa code' },
    ],
    submitLabel: 'Record repayment',
  }, d => api.post(`/loans/${l.id}/repayments`, d), 'Repayment recorded');
}

const approveLoan = l => confirmAction({
  title: `Approve ${money(l.principal)} for ${l.member_name}?`,
  text: `The loan becomes active today. ${l.member_name} will owe ${money(l.total_due)} (${num(l.interest_rate)}% flat interest)${l.due_date ? `, due by ${fmtDate(l.due_date)}` : ''}.`,
  ok: 'Approve loan', tone: 'primary', iconName: 'checkCircle',
}, () => api.patch(`/loans/${l.id}/approve`), 'Loan approved');

const rejectLoan = l => confirmAction({
  title: `Reject ${l.member_name}'s application?`,
  text: `The request for ${money(l.principal)} will be marked as rejected. This cannot be undone; they can apply again.`,
  ok: 'Reject application',
}, () => api.patch(`/loans/${l.id}/reject`), 'Loan application rejected');

function dueHtml(l) {
  if (!l.due_date) return '<span class="muted">—</span>';
  if (!['active', 'defaulted'].includes(l.status)) return esc(fmtDate(l.due_date));
  const d = daysUntil(l.due_date);
  if (d < 0) return `<span class="due due-bad">${icon('warning')}${esc(fmtDate(l.due_date))}<small>${-d} day${d === -1 ? '' : 's'} overdue</small></span>`;
  if (d <= 14) return `<span class="due due-warn">${icon('clock')}${esc(fmtDate(l.due_date))}<small>in ${d} day${d === 1 ? '' : 's'}</small></span>`;
  return esc(fmtDate(l.due_date));
}

async function showLoan(l) {
  const d = await load(`/loans/${l.id}`);
  const pct = num(d.total_due) ? (num(d.amount_paid) / num(d.total_due)) * 100 : 0;
  showDetails({
    title: `Loan · ${d.member_name}`,
    subtitle: `Applied ${fmtDate(d.applied_at)}`,
    html: `<div class="detail-grid">
      <div><span>Status</span>${badge(d.status)}</div>
      <div><span>Amount borrowed</span><b>${esc(money(d.principal))}</b></div>
      <div><span>Interest</span><b>${num(d.interest_rate)}% flat</b></div>
      <div><span>Total to repay</span><b>${esc(money(d.total_due))}</b></div>
      <div><span>Repaid so far</span><b class="pos">${esc(money(d.amount_paid))}</b></div>
      <div><span>Balance</span><b class="${num(d.balance) > 0 ? 'warn-text' : ''}">${esc(money(d.balance))}</b></div>
      <div><span>Issued</span><b>${esc(fmtDate(d.issue_date))}</b></div>
      <div><span>Due date</span><b>${dueHtml(d)}</b></div>
    </div>
    ${['active', 'cleared', 'defaulted'].includes(d.status) ? progressBar(pct, { label: 'Repaid' }) : ''}
    ${d.purpose ? `<div class="detail-note"><span>Purpose</span><p>${esc(d.purpose)}</p></div>` : ''}
    <h3 class="detail-h">Repayments</h3>
    ${d.repayments?.length ? `<ul class="tx-list">${d.repayments.slice().reverse().map(r => `<li class="tx"><span class="tx-icon in">${icon('repeat')}</span><div class="tx-main"><b>${esc(money(r.amount))}</b><small>${esc(labelFor(METHODS, r.method))}${r.reference ? ' · ' + esc(r.reference) : ''}</small></div><div class="tx-amt"><small>${esc(fmtDate(r.payment_date))}</small></div></li>`).join('')}</ul>` : '<p class="muted small">No repayments yet.</p>'}`,
    actions: [
      ...(d.status === 'active' && hasRole('treasurer') ? [{ label: 'Record repayment', icon: 'plus', onClick: () => repaymentForm(d) }] : []),
      ...(d.status === 'pending' && hasRole('chairperson') ? [{ label: 'Approve', icon: 'check', onClick: () => approveLoan(d) }] : []),
    ],
  });
}

async function renderLoans(view, params) {
  const official = isOfficial();
  const loans = await load('/loans');
  const active = loans.filter(l => ['active', 'defaulted'].includes(l.status));
  const overdue = active.filter(l => l.due_date && daysUntil(l.due_date) < 0);
  const pending = loans.filter(l => l.status === 'pending');

  pageHead(view, {
    title: official ? 'Loans' : 'My loans',
    subtitle: official ? 'Applications, approvals and balances' : 'Your loan applications and what you still owe',
    actions: [{ label: official ? 'New loan' : 'Apply for a loan', icon: 'plus', onClick: () => openLoanApplication() }],
  });

  view.append(statGrid([
    { label: 'Outstanding balance', value: money(sum(active, l => l.balance)), icon: 'landmark', tone: 'warn', hint: `${active.length} active loan${active.length === 1 ? '' : 's'}` },
    { label: 'Total lent out', value: money(sum(loans.filter(l => ['active', 'cleared', 'defaulted'].includes(l.status)), l => l.principal)), icon: 'arrowOut', tone: 'navy' },
    { label: 'Repaid so far', value: money(sum(loans, l => l.amount_paid)), icon: 'repeat', tone: 'good' },
    { label: 'Overdue', value: String(overdue.length), icon: 'warning', tone: overdue.length ? 'bad' : 'neutral', hint: overdue.length ? `${esc(money(sum(overdue, l => l.balance)))} past due` : 'None past their due date' },
  ]));

  if (pending.length && hasRole('chairperson')) {
    view.append(el(`<div class="callout callout-warn">${icon('clock')}<span><b>${pending.length} application${pending.length === 1 ? '' : 's'} waiting for your decision.</b> Review the amount and purpose, then approve or reject.</span></div>`));
  }

  const columns = [
    { label: 'Applied', value: l => l.applied_at, html: l => esc(fmtDate(l.applied_at)), hideSm: true, hideMd: true },
    ...(official ? [{ label: 'Member', value: l => l.member_name, html: l => `<div class="person">${avatar(l.member_name, 'sm')}<div><b>${esc(l.member_name)}</b>${l.purpose ? `<small class="clip">${esc(l.purpose)}</small>` : ''}</div></div>` }]
      : [{ label: 'Purpose', value: l => l.purpose || 'Loan', html: l => `<b>${esc(l.purpose || 'Loan')}</b>` }]),
    { label: 'Borrowed', value: l => num(l.principal), html: l => esc(money(l.principal)), align: 'right' },
    { label: 'Total due', value: l => num(l.total_due), html: l => `${esc(money(l.total_due))}<small class="muted block">${num(l.interest_rate)}% interest</small>`, align: 'right', csv: l => l.total_due },
    { label: 'Repaid', value: l => num(l.amount_paid), sortable: true, html: l => ['active', 'cleared', 'defaulted'].includes(l.status) ? `<div class="mini-prog">${progressBar(num(l.total_due) ? num(l.amount_paid) / num(l.total_due) * 100 : 0, { label: 'Repaid' })}</div>` : '<span class="muted">—</span>' },
    { label: 'Balance', value: l => num(l.balance), html: l => ['active', 'defaulted'].includes(l.status) ? `<b>${esc(money(l.balance))}</b>` : '<span class="muted">—</span>', align: 'right' },
    { label: 'Due date', value: l => l.due_date || '', html: dueHtml },
    { label: 'Status', value: l => labelFor(LOAN_STATUSES, l.status), html: l => badge(l.status) },
  ];

  const actions = l => [
    { label: 'View', icon: 'eye', onClick: () => showLoan(l).catch(err => toast(err.message, 'error')) },
    ...(l.status === 'pending' && hasRole('chairperson') ? [
      { label: 'Approve', icon: 'check', tone: 'primary', onClick: () => approveLoan(l) },
      { label: 'Reject', icon: 'x', tone: 'danger', onClick: () => rejectLoan(l) },
    ] : []),
    ...(l.status === 'active' && hasRole('treasurer') ? [{ label: 'Repayment', icon: 'plus', tone: 'primary', onClick: () => repaymentForm(l) }] : []),
  ];

  view.append(card({
    cls: 'card-flush',
    body: dataTable({
      columns, rows: loans, actions,
      query: params.get('q') || '',
      searchPlaceholder: official ? 'Search by member or purpose…' : 'Search your loans…',
      chips: { options: [['pending', 'Pending'], ['active', 'Active'], ['overdue', 'Overdue'], ['cleared', 'Fully paid'], ['rejected', 'Rejected']], test: (l, v) => v === 'overdue' ? ['active', 'defaulted'].includes(l.status) && l.due_date && daysUntil(l.due_date) < 0 : l.status === v },
      initial: { chip: params.get('status') || '' },
      exportName: official ? 'loans' : 'my-loans',
      empty: official ? 'No loans yet' : "You haven't applied for a loan yet",
      emptyText: 'Loan applications will appear here.',
    }),
  }));
}
