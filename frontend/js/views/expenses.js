// Expenses: spending by category, monthly summary and the full transaction history.

VIEWS.expenses = { label: 'Expenses', icon: 'receipt', group: 'money', render: renderExpenses };

function expenseFields(e = {}) {
  return [
    { name: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES, required: true, value: e.category, placeholder: 'Choose a category…', half: true },
    { name: 'amount', label: 'Amount', type: 'money', required: true, value: e.amount, half: true },
    { name: 'description', label: 'What was it for?', value: e.description, maxlength: 255, placeholder: 'e.g. Hall hire for the November meeting' },
    { name: 'expense_date', label: 'Date', type: 'date', value: e.expense_date || today(), required: true, max: today(), half: true },
    { name: 'receipt_ref', label: 'Receipt number', value: e.receipt_ref, maxlength: 50, half: true },
  ];
}

const openExpenseForm = () => formAction({ title: 'Record an expense', subtitle: 'Money spent by the chama', fields: expenseFields(), submitLabel: 'Record expense' },
  d => api.post('/expenses', d), 'Expense recorded');

const editExpense = e => formAction({ title: 'Edit expense', fields: expenseFields(e), submitLabel: 'Save changes' },
  d => api.put(`/expenses/${e.id}`, d), 'Expense updated');

const deleteExpense = e => confirmAction({
  title: 'Delete this expense?',
  text: `${money(e.amount)} for ${e.category}${e.description ? ` (${e.description})` : ''} on ${fmtDate(e.expense_date)} will be removed. This cannot be undone.`,
  ok: 'Delete',
}, () => api.delete(`/expenses/${e.id}`), 'Expense deleted');

async function renderExpenses(view, params) {
  const canEdit = hasRole('treasurer');
  const rows = await load('/expenses');
  const m = thisMonth();
  const year = today().slice(0, 4);
  const byCat = {};
  for (const e of rows) byCat[e.category] = (byCat[e.category] || 0) + num(e.amount);
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  pageHead(view, {
    title: 'Expenses',
    subtitle: 'Every shilling the chama spends, open to all members',
    actions: [canEdit && { label: 'Record expense', icon: 'plus', onClick: () => openExpenseForm() }],
  });

  view.append(statGrid([
    { label: 'Total expenses', value: money(sum(rows, e => e.amount)), icon: 'receipt', tone: 'bad', hint: `${rows.length} record${rows.length === 1 ? '' : 's'}` },
    { label: `This month (${monthLabel(m)})`, value: money(sum(rows.filter(e => monthKey(e.expense_date) === m), e => e.amount)), icon: 'calendar', tone: 'info' },
    { label: `This year (${year})`, value: money(sum(rows.filter(e => String(e.expense_date).startsWith(year)), e => e.amount)), icon: 'chart', tone: 'navy' },
    { label: 'Biggest category', value: top ? top[0] : '—', icon: 'trendingUp', tone: 'warn', hint: top ? esc(money(top[1])) : '' },
  ]));

  const grid = el('<div class="grid-2-1"></div>');
  grid.append(card({
    title: 'Monthly spending', subtitle: 'Expenses each month, last 12 months',
    body: barChart({ data: monthlySeries(rows, 'expense_date', 'amount', lastMonths(12)), tone: 'spend', caption: 'Monthly expenses' }),
  }));
  grid.append(card({ title: 'By category', subtitle: 'Where the money went', body: hbarChart({ data: Object.entries(byCat).map(([label, value]) => ({ label, value })) }) }));
  view.append(grid);

  const cats = [...new Set([...EXPENSE_CATEGORIES.map(c => c[0]), ...rows.map(e => e.category)])].map(c => [c, c]);
  view.append(card({
    title: 'Transaction history', cls: 'card-flush',
    body: dataTable({
      rows,
      query: params.get('q') || '',
      columns: [
        { label: 'Date', value: e => e.expense_date, html: e => esc(fmtDate(e.expense_date)) },
        { label: 'Category', value: e => e.category, html: e => `<span class="cat">${esc(e.category)}</span>` },
        { label: 'Description', wrap: true, value: e => e.description || '', html: e => e.description ? esc(e.description) : '<span class="muted">—</span>' },
        { label: 'Amount', value: e => num(e.amount), html: e => `<b class="neg">${esc(money(e.amount))}</b>`, align: 'right' },
        { label: 'Receipt', value: e => e.receipt_ref || '', html: e => e.receipt_ref ? `<code>${esc(e.receipt_ref)}</code>` : '<span class="muted">—</span>' },
      ],
      searchPlaceholder: 'Search by description or receipt…',
      filters: [{ key: 'category', label: 'Category', options: cats, test: (e, v) => e.category === v }],
      dateFilter: e => e.expense_date,
      exportName: 'expenses',
      empty: 'No expenses recorded yet',
      actions: canEdit ? e => [
        { label: 'Edit', icon: 'edit', onClick: () => editExpense(e) },
        { label: 'Delete', icon: 'trash', tone: 'danger', onClick: () => deleteExpense(e) },
      ] : null,
    }),
  }));
}
