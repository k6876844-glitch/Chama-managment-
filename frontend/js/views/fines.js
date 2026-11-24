// Fines and penalties: issue, mark paid, waive.

VIEWS.fines = { label: 'Fines & Penalties', memberLabel: 'My fines', icon: 'gavel', group: 'money', render: renderFines };

const FINE_REASONS = ['Late for meeting', 'Missed meeting without apology', 'Late contribution', 'Late loan repayment'];

async function openFineForm() {
  let members;
  try { members = await memberOptions(); } catch (err) { return toast(err.message, 'error'); }
  return formAction({
    title: 'Add a fine', subtitle: 'Penalties follow the rules agreed by the chama',
    fields: [
      { name: 'member_id', label: 'Member', type: 'select', options: members, required: true, placeholder: 'Choose a member…' },
      { name: 'reason', label: 'Reason', required: true, maxlength: 255, placeholder: 'e.g. Late for meeting', hint: `Common reasons: ${FINE_REASONS.join(', ')}` },
      { name: 'amount', label: 'Amount', type: 'money', required: true, half: true },
      { name: 'fine_date', label: 'Date', type: 'date', value: today(), required: true, max: today(), half: true },
    ],
    submitLabel: 'Add fine',
  }, d => api.post('/fines', d), 'Fine added');
}

const payFine = f => confirmAction({
  title: 'Mark this fine as paid?', text: `${f.member_name} paid ${money(f.amount)} for "${f.reason}". It will be counted as chama income.`,
  ok: 'Mark as paid', tone: 'primary', iconName: 'checkCircle',
}, () => api.patch(`/fines/${f.id}/pay`), 'Fine marked as paid');

const waiveFine = f => confirmAction({
  title: 'Waive this fine?', text: `${f.member_name} will no longer owe ${money(f.amount)} for "${f.reason}". This cannot be undone.`,
  ok: 'Waive fine',
}, () => api.patch(`/fines/${f.id}/waive`), 'Fine waived');

async function renderFines(view, params) {
  const official = isOfficial();
  const fines = await load('/fines');
  const by = s => fines.filter(f => f.status === s);

  pageHead(view, {
    title: official ? 'Fines & penalties' : 'My fines',
    subtitle: official ? 'Penalties issued to members' : 'Any penalties on your account',
    actions: [hasRole('treasurer', 'secretary') && { label: 'Add fine', icon: 'plus', onClick: () => openFineForm() }],
  });

  view.append(statGrid([
    { label: 'Unpaid', value: money(sum(by('unpaid'), f => f.amount)), icon: 'warning', tone: by('unpaid').length ? 'bad' : 'neutral', hint: `${by('unpaid').length} fine${by('unpaid').length === 1 ? '' : 's'}` },
    { label: 'Paid', value: money(sum(by('paid'), f => f.amount)), icon: 'checkCircle', tone: 'good', hint: `${by('paid').length} fine${by('paid').length === 1 ? '' : 's'}` },
    { label: 'Waived', value: money(sum(by('waived'), f => f.amount)), icon: 'ban', tone: 'neutral', hint: `${by('waived').length} fine${by('waived').length === 1 ? '' : 's'}` },
  ], 'stats-3'));

  const actions = f => f.status !== 'unpaid' ? [] : [
    ...(hasRole('treasurer') ? [{ label: 'Mark paid', icon: 'check', tone: 'primary', onClick: () => payFine(f) }] : []),
    ...(hasRole('chairperson') ? [{ label: 'Waive', icon: 'ban', tone: 'danger', onClick: () => waiveFine(f) }] : []),
  ];

  view.append(card({
    cls: 'card-flush',
    body: dataTable({
      rows: fines,
      query: params.get('q') || '',
      columns: [
        { label: 'Date', value: f => f.fine_date, html: f => esc(fmtDate(f.fine_date)) },
        ...(official ? [{ label: 'Member', value: f => f.member_name, html: f => `<div class="person">${avatar(f.member_name, 'sm')}<b>${esc(f.member_name)}</b></div>` }] : []),
        { label: 'Reason', wrap: true, value: f => f.reason },
        { label: 'Amount', value: f => num(f.amount), html: f => `<b>${esc(money(f.amount))}</b>`, align: 'right' },
        { label: 'Status', value: f => cap(f.status), html: f => badge(f.status) },
        { label: 'Paid on', value: f => f.paid_date || '', html: f => f.paid_date ? esc(fmtDate(f.paid_date)) : '<span class="muted">—</span>', hideSm: true },
      ],
      chips: { options: [['unpaid', 'Unpaid'], ['paid', 'Paid'], ['waived', 'Waived']], test: (f, v) => f.status === v },
      initial: { chip: params.get('status') || '' },
      searchPlaceholder: official ? 'Search by member or reason…' : 'Search by reason…',
      exportName: official ? 'fines' : 'my-fines',
      empty: official ? 'No fines issued' : 'You have no fines. Keep it up!',
      actions: hasRole('treasurer', 'chairperson') ? actions : null,
    }),
  }));
}
