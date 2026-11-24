// Meetings: schedule, agenda, minutes and attendance.

VIEWS.meetings = { label: 'Meetings', icon: 'calendar', group: 'group', render: renderMeetings };

function meetingFields(m = {}) {
  return [
    { name: 'title', label: 'Title', required: true, value: m.title || 'Monthly meeting', maxlength: 120 },
    { name: 'meeting_date', label: 'Date', type: 'date', required: true, value: m.meeting_date || '', half: true },
    { name: 'venue', label: 'Venue', value: m.venue, maxlength: 120, half: true, placeholder: "e.g. Community hall, or the treasurer's home" },
    { name: 'agenda', label: 'Agenda', type: 'textarea', value: m.agenda, placeholder: '1. Contributions\n2. Loan applications\n3. Any other business' },
  ];
}

const openMeetingForm = () => formAction({ title: 'Schedule a meeting', subtitle: 'All members will see it on their dashboard', fields: meetingFields(), submitLabel: 'Schedule meeting' },
  d => api.post('/meetings', d), 'Meeting scheduled');

const editMeeting = m => formAction({ title: 'Edit meeting', fields: meetingFields(m), submitLabel: 'Save changes' },
  d => api.put(`/meetings/${m.id}`, d), 'Meeting updated');

const editMinutes = m => formAction({
  title: `Minutes: ${m.title}`, subtitle: fmtDate(m.meeting_date), wide: true,
  fields: [{ name: 'minutes', label: 'Minutes', type: 'textarea', rows: 12, value: m.minutes, placeholder: 'What was discussed and decided…' }],
  submitLabel: 'Save minutes',
}, d => api.put(`/meetings/${m.id}`, { minutes: d.minutes || '' }), 'Minutes saved');

async function markAttendance(meeting) {
  const [members, detail] = await Promise.all([load('/members'), api.get(`/meetings/${meeting.id}`)]);
  const current = Object.fromEntries(detail.attendance.map(a => [a.member_id, a.status]));
  const active = members.filter(m => m.status === 'active');
  const rows = active.map(m => `<div class="att-row"><div class="person">${avatar(m.full_name, 'sm')}<span>${esc(m.full_name)}</span></div>
    <div class="seg seg-sm" role="radiogroup" aria-label="${esc(m.full_name)}">${ATTENDANCE.map(([v, l]) =>
      `<label class="att-${v}"><input type="radio" name="m${m.id}" value="${v}"${(current[m.id] || 'present') === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>`).join('');
  return formAction({
    title: `Attendance: ${meeting.title}`, subtitle: `${fmtDate(meeting.meeting_date)} · ${active.length} active members`, wide: true,
    fields: [{ type: 'html', html: `<div class="att-tools"><span class="muted small">Everyone starts as present. Change anyone who was late, sent an apology or was absent.</span><button type="button" class="link-btn small" id="allPresent">Mark all present</button></div><div class="att-list">${rows}</div>` }],
    submitLabel: 'Save attendance',
    onRender: body => { $('#allPresent', body).onclick = () => $$('input[value=present]', body).forEach(i => { i.checked = true; }); },
  }, d => api.put(`/meetings/${meeting.id}/attendance`, {
    records: Object.entries(d).map(([key, status]) => ({ member_id: Number(key.slice(1)), status })),
  }), 'Attendance saved');
}

async function showMeeting(m) {
  const d = await api.get(`/meetings/${m.id}`);
  const counts = Object.fromEntries(ATTENDANCE.map(([v]) => [v, d.attendance.filter(a => a.status === v).length]));
  const canEdit = hasRole('chairperson', 'secretary');
  showDetails({
    title: d.title,
    subtitle: `${fmtDate(d.meeting_date)}${d.venue ? ' · ' + d.venue : ''}`,
    html: `${d.agenda ? `<div class="detail-note"><span>Agenda</span><p class="pre">${esc(d.agenda)}</p></div>` : ''}
      <div class="detail-note"><span>Minutes</span>${d.minutes ? `<p class="pre">${esc(d.minutes)}</p>` : '<p class="muted small">Minutes have not been added yet.</p>'}</div>
      <h3 class="detail-h">Attendance</h3>
      ${d.attendance.length ? `<div class="att-summary">${ATTENDANCE.map(([v, l]) => `<span>${badge(v, l)} <b>${counts[v]}</b></span>`).join('')}</div>
        <ul class="att-view">${d.attendance.map(a => `<li><div class="person">${avatar(a.member_name, 'sm')}<span>${esc(a.member_name)}</span></div>${badge(a.status)}</li>`).join('')}</ul>`
        : '<p class="muted small">Attendance has not been marked yet.</p>'}`,
    actions: [
      ...(hasRole('secretary') ? [{ label: 'Mark attendance', icon: 'clipboard', variant: 'btn-ghost', onClick: () => markAttendance(d).catch(err => toast(err.message, 'error')) }] : []),
      ...(canEdit ? [{ label: 'Minutes', icon: 'fileText', onClick: () => editMinutes(d) }] : []),
    ],
  });
}

async function renderMeetings(view, params) {
  const canEdit = hasRole('chairperson', 'secretary');
  const meetings = await load('/meetings');
  const upcoming = meetings.filter(m => daysUntil(m.meeting_date) >= 0).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const past = meetings.filter(m => daysUntil(m.meeting_date) < 0);

  pageHead(view, {
    title: 'Meetings',
    subtitle: 'Agendas, minutes and attendance',
    actions: [canEdit && { label: 'Schedule meeting', icon: 'plus', onClick: () => openMeetingForm() }],
  });

  const up = el('<div class="meeting-cards"></div>');
  up.innerHTML = upcoming.length ? upcoming.slice(0, 3).map((m, i) => {
    const d = parseDate(m.meeting_date);
    return `<article class="meeting-card${i === 0 ? ' is-next' : ''}">
      <div class="date-tile"><span>${esc(d.toLocaleDateString('en-KE', { month: 'short' }))}</span><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString('en-KE', { weekday: 'short' }))}</small></div>
      <div class="meeting-info"><span class="eyebrow">${i === 0 ? 'Next meeting · ' : ''}${esc(relTime(m.meeting_date))}</span><b>${esc(m.title)}</b>
        ${m.venue ? `<small>${icon('mapPin')}${esc(m.venue)}</small>` : ''}
        ${m.agenda ? `<p class="clip-2">${esc(m.agenda)}</p>` : ''}
        <button type="button" class="link-btn small" data-id="${m.id}">View details</button></div>
    </article>`;
  }).join('') : emptyState('No upcoming meetings', canEdit ? 'Schedule the next meeting so members can plan for it.' : 'The secretary will post the next meeting here.', 'calendar');
  up.onclick = e => {
    const b = e.target.closest('[data-id]');
    if (b) showMeeting(meetings.find(m => String(m.id) === b.dataset.id)).catch(err => toast(err.message, 'error'));
  };
  view.append(card({ title: 'Upcoming', body: up }));

  const actions = m => [
    { label: 'View', icon: 'eye', onClick: () => showMeeting(m).catch(err => toast(err.message, 'error')) },
    ...(hasRole('secretary') ? [{ label: 'Attendance', icon: 'clipboard', onClick: () => markAttendance(m).catch(err => toast(err.message, 'error')) }] : []),
    ...(canEdit ? [
      { label: 'Minutes', icon: 'fileText', onClick: () => editMinutes(m) },
      { label: 'Edit', icon: 'edit', onClick: () => editMeeting(m) },
    ] : []),
  ];

  view.append(card({
    title: 'All meetings', subtitle: `${past.length} held · ${upcoming.length} upcoming`, cls: 'card-flush',
    body: dataTable({
      rows: meetings.map(m => ({ ...m, _search: `${m.agenda || ''} ${m.minutes || ''}` })),
      query: params.get('q') || '',
      columns: [
        { label: 'Date', value: m => m.meeting_date, html: m => esc(fmtDate(m.meeting_date)) },
        { label: 'Title', value: m => m.title, html: m => `<b>${esc(m.title)}</b>` },
        { label: 'Venue', wrap: true, value: m => m.venue || '', hideSm: true },
        { label: 'Attended', value: m => num(m.present_count), html: m => daysUntil(m.meeting_date) > 0 ? '<span class="muted">—</span>' : `${num(m.present_count)}`, align: 'right' },
        { label: 'Minutes', value: m => m.minutes ? 'Recorded' : 'Not yet', html: m => m.minutes ? badge('paid', 'Recorded') : badge('neutral', 'Not yet') },
        { label: 'When', value: m => daysUntil(m.meeting_date) >= 0 ? 'Upcoming' : 'Held', html: m => daysUntil(m.meeting_date) >= 0 ? badge('upcoming', 'Upcoming') : badge('done', 'Held') },
      ],
      chips: { options: [['upcoming', 'Upcoming'], ['held', 'Held']], test: (m, v) => (v === 'upcoming') === (daysUntil(m.meeting_date) >= 0) },
      searchPlaceholder: 'Search by title, venue or agenda…',
      exportName: 'meetings',
      empty: 'No meetings yet',
      actions,
    }),
  }));
}
