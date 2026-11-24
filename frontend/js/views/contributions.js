// Contributions: history, monthly summaries, and who has (and has not) paid for a month.

VIEWS.contributions = { label: 'Contributions', memberLabel: 'My contributions', icon: 'coins', group: 'money', render: renderContributions };

async function contributionFields(c = {}) {
  return [
    c.id
      ? { type: 'html', html: `<div class="field"><span class="field-label">Member</span><div class="static-value">${esc(c.member_name)}</div></div>` }
      : { name: 'member_id', label: 'Member', type: 'select', options: await memberOptions(), required: true, value: c.member_id, placeholder: 'Choose a member…' },
    { name: 'amount', label: 'Amount', type: 'money', required: true, value: c.amount, half: true },
    { name: 'contribution_date', label: 'Date paid', type: 'date', value: c.contribution_date || today(), required: true, max: today(), half: true },
    { name: 'method', label: 'Paid by', type: 'segmented', options: METHODS, value: c.method || 'mpesa' },
    { name: 'reference', label: 'Reference', value: c.reference, maxlength: 50, placeholder: 'e.g. M-Pesa code QK7XYZ12AB', hint: 'Helps members confirm their payment' },
  ];
}

async function openContributionForm(preset = {}) {
  try {
    const fields = await contributionFields(preset);
    return formAction({ title: 'Record a contribution', subtitle: "Add a member's savings payment", fields, submitLabel: 'Record contribution' },
      d => api.post('/contributions', d), 'Contribution recorded');
  } catch (err) { toast(err.message, 'error'); }
}

async function editContribution(c) {
  return formAction({ title: 'Edit contribution', subtitle: `${c.member_name} · ${fmtDate(c.contribution_date)}`, fields: await contributionFields(c), submitLabel: 'Save changes' },
    d => api.put(`/contributions/${c.id}`, d), 'Contribution updated');
}

function deleteContribution(c) {
  return confirmAction({
    title: 'Delete this contribution?',
    text: `${money(c.amount)} from ${c.member_name || 'this member'} on ${fmtDate(c.contribution_date)} will be removed from the records. This cannot be undone.`,
    ok: 'Delete',
  }, () => api.delete(`/contributions/${c.id}`), 'Contribution deleted');
}

async function renderContributions(view, params) {
  const official = isOfficial();
  const canRecord = hasRole('treasurer', 'chairperson');
  const canEdit = hasRole('treasurer');
  const [rows, members] = await Promise.all([load('/contributions'), official ? load('/members') : Promise.resolve([])]);
  const m = thisMonth();
  const year = today().slice(0, 4);
  const months = lastMonths(12);
  const monthTotal = sum(rows.filter(c => monthKey(c.contribution_date) === m), c => c.amount);
  const prevKey = lastMonths(2)[0];
  const prevTotal = sum(rows.filter(c => monthKey(c.contribution_date) === prevKey), c => c.amount);
  const yearTotal = sum(rows.filter(c => String(c.contribution_date).startsWith(year)), c => c.amount);

  pageHead(view, {
    title: official ? 'Contributions' : 'My contributions',
    subtitle: official ? 'Savings paid in by members' : 'Every payment you have made to the chama',
    actions: [canRecord && { label: 'Record contribution', icon: 'plus', onClick: () => openContributionForm() }],
  });

  const change = prevTotal ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null;
  view.append(statGrid([
    { label: official ? 'All-time contributions' : 'My total savings', value: money(sum(rows, c => c.amount)), icon: 'wallet', tone: 'good', hint: `${rows.length} payment${rows.length === 1 ? '' : 's'}` },
    { label: `This month (${monthLabel(m)})`, value: money(monthTotal), icon: 'coins', tone: 'info', hint: change == null ? '' : `<span class="${change >= 0 ? 'pos' : 'neg'}">${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%</span> vs last month` },
    { label: `This year (${year})`, value: money(yearTotal), icon: 'trendingUp', tone: 'navy' },
    { label: 'Average payment', value: money(rows.length ? sum(rows, c => c.amount) / rows.length : 0), icon: 'chart', tone: 'warn' },
  ]));

  const grid = el(`<div class="${official ? 'grid-2-1' : ''}"></div>`);
  grid.append(card({
    title: 'Monthly summary', subtitle: 'Total contributed each month, last 12 months',
    body: barChart({ data: monthlySeries(rows, 'contribution_date', 'amount', months), tone: 'savings', caption: 'Monthly contributions' }),
  }));
  if (official) grid.append(paidTracker(rows, members, canRecord));
  view.append(grid);

  const columns = [
    { label: 'Date', value: c => c.contribution_date, html: c => esc(fmtDate(c.contribution_date)) },
    ...(official ? [{ label: 'Member', value: c => c.member_name, html: c => `<div class="person">${avatar(c.member_name, 'sm')}<b>${esc(c.member_name)}</b></div>` }] : []),
    { label: 'Amount', value: c => num(c.amount), html: c => `<b class="pos">${esc(money(c.amount))}</b>`, align: 'right' },
    { label: 'Paid by', value: c => labelFor(METHODS, c.method), html: c => `<span class="method method-${esc(c.method)}">${esc(labelFor(METHODS, c.method))}</span>` },
    { label: 'Reference', value: c => c.reference || '', html: c => c.reference ? `<code>${esc(c.reference)}</code>` : '<span class="muted">—</span>' },
  ];
  view.append(card({
    title: 'Contribution history', cls: 'card-flush',
    body: dataTable({
      columns, rows,
      query: params.get('q') || '',
      searchPlaceholder: official ? 'Search by member or reference…' : 'Search by reference…',
      filters: [
        { key: 'method', label: 'Paid by', options: METHODS, test: (r, v) => r.method === v },
        { key: 'month', label: 'Month', options: months.slice().reverse().map(k => [k, monthLabel(k, true)]), test: (r, v) => monthKey(r.contribution_date) === v },
      ],
      dateFilter: r => r.contribution_date,
      exportName: official ? 'contributions' : 'my-contributions',
      empty: 'No contributions recorded yet',
      actions: canEdit ? c => [
        { label: 'Edit', icon: 'edit', onClick: () => editContribution(c).catch(err => toast(err.message, 'error')) },
        { label: 'Delete', icon: 'trash', tone: 'danger', onClick: () => deleteContribution(c) },
      ] : null,
    }),
  }));
}

// Lists active members as paid / not paid for the chosen month. Unpaid members are shown first.
function paidTracker(rows, members, canRecord) {
  const months = lastMonths(12).reverse();
  const select = el(`<select aria-label="Month">${months.map(k => `<option value="${k}">${esc(monthLabel(k, true))}</option>`).join('')}</select>`);
  const box = el('<div class="tracker"></div>');
  const draw = () => {
    const k = select.value;
    const byMember = {};
    for (const c of rows) if (monthKey(c.contribution_date) === k) byMember[c.member_id] = (byMember[c.member_id] || 0) + num(c.amount);
    const active = members.filter(x => x.status === 'active').map(x => ({ ...x, amt: byMember[x.id] || 0 }))
      .sort((a, b) => (a.amt > 0) - (b.amt > 0) || a.full_name.localeCompare(b.full_name));
    const paidN = active.filter(x => x.amt > 0).length;
    box.innerHTML = `<div class="tracker-sum"><div>${progressBar(active.length ? (paidN / active.length) * 100 : 0, { label: 'Members paid' })}</div><p class="small"><b>${paidN}</b> paid · <b class="${active.length - paidN ? 'neg' : ''}">${active.length - paidN}</b> not yet paid</p></div>
      <ul class="tracker-list">${active.map(x => `<li><div class="person">${avatar(x.full_name, 'sm')}<span>${esc(x.full_name)}</span></div>${x.amt > 0 ? `<span class="tracker-amt">${esc(money(x.amt))}</span>${badge('paid', 'Paid')}` : `${canRecord ? `<button type="button" class="btn btn-sm btn-soft" data-id="${x.id}">${icon('plus')}<span>Record</span></button>` : ''}${badge('unpaid', 'Unpaid')}`}</li>`).join('') || emptyState('No active members')}</ul>`;
  };
  box.onclick = e => {
    const b = e.target.closest('[data-id]');
    if (b) openContributionForm({ member_id: b.dataset.id, contribution_date: select.value === thisMonth() ? today() : `${select.value}-01` });
  };
  select.onchange = draw;
  draw();
  return card({ title: 'Paid and unpaid', subtitle: 'Who has contributed for the month', body: box, actions: [select] });
}
