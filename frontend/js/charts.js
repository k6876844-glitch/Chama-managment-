// Small, dependency-free SVG charts (work offline with the PWA). Each chart has a hover/tap tooltip
// and an accessible data table behind a "Show as table" toggle, so values are never colour-only.

/**
 * Vertical bar chart for one series over categories (e.g. months).
 * data: [{ label, value, title? }]; tone: 'savings' | 'repay' | 'spend'
 */
function barChart({ data, tone = 'savings', height = 240, format = moneyShort, fullFormat = money, caption = 'Chart' }) {
  const wrap = el(`<figure class="chart chart-${tone}"><div class="chart-plot"></div><div class="chart-tip" hidden></div><figcaption class="chart-foot"><button type="button" class="link-btn small chart-table-toggle">Show as table</button></figcaption></figure>`);
  const plot = $('.chart-plot', wrap);
  const tip = $('.chart-tip', wrap);

  if (!data.length || data.every(d => !num(d.value))) {
    plot.innerHTML = emptyState('No data for this period yet', 'Records will appear here as they are added.', 'chart');
    $('.chart-foot', wrap).remove();
    return wrap;
  }

  const H = height, padL = 52, padR = 8, padT = 14, padB = 28;
  // Round tick steps (1, 2, 2.5 or 5 × 10^n) so the axis reads 0, 5K, 10K, 15K, 20K.
  const step = niceStep(Math.max(...data.map(d => num(d.value))) / 4);
  const max = step * Math.max(1, Math.ceil(Math.max(...data.map(d => num(d.value))) / step));
  const ih = H - padT - padB;
  const y = v => padT + ih - (num(v) / max) * ih;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  format = axisFormat;
  let geo = { step: 0, W: 0 };

  // Drawn at the plot's real pixel width so text never stretches; redrawn when the width changes.
  function draw(W) {
    const iw = W - padL - padR;
    const step = iw / data.length;
    const bw = Math.max(4, Math.min(36, step * 0.62));
    // Thin out the month labels on narrow screens so they never overlap.
    const every = Math.max(1, Math.ceil(data.length / Math.floor(iw / 44)));
    geo = { step, W };
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}">`;
    svg += ticks.map(t => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(format(t).replace('KES ', ''))}</text>`).join('');
    data.forEach((d, i) => {
      const x = padL + step * i + (step - bw) / 2;
      const top = y(d.value), h = Math.max(0, padT + ih - top);
      const r = Math.min(4, h, bw / 2);
      // Rounded top, square baseline.
      const path = h > 0 ? `M${x},${padT + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${padT + ih} Z` : '';
      svg += `<g class="bar-g" data-i="${i}"><rect class="hit" x="${padL + step * i}" y="${padT}" width="${step}" height="${ih}"/>${path ? `<path class="bar" d="${path}"/>` : ''}</g>`;
      if ((data.length - 1 - i) % every === 0) svg += `<text class="axis" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
    });
    svg += `<line class="baseline" x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}"/></svg>`;
    plot.innerHTML = svg;
  }
  plot.style.height = H + 'px';
  const ro = new ResizeObserver(([entry]) => {
    const w = Math.floor(entry.contentRect.width);
    if (w > 0 && w !== geo.W) draw(w);
  });
  ro.observe(plot);

  const show = g => {
    const i = Number(g.dataset.i), d = data[i];
    $$('.bar-g', plot).forEach(b => b.classList.toggle('dim', b !== g));
    tip.innerHTML = `<span>${esc(d.title || d.label)}</span><b>${esc(fullFormat(d.value))}</b>`;
    tip.hidden = false;
    const left = padL + geo.step * i + geo.step / 2;
    tip.style.left = Math.max(64, Math.min(geo.W - 64, left)) + 'px';
    tip.style.top = y(d.value) + 'px';
  };
  const hide = () => { tip.hidden = true; $$('.bar-g', plot).forEach(b => b.classList.remove('dim')); };
  plot.addEventListener('pointerover', e => { const g = e.target.closest('.bar-g'); if (g) show(g); });
  plot.addEventListener('pointerleave', hide);

  attachTable(wrap, ['Period', 'Amount'], data.map(d => [d.title || d.label, fullFormat(d.value)]));
  return wrap;
}

/**
 * Horizontal bars for a ranked breakdown (e.g. expenses by category). One hue: it is magnitude, not identity.
 */
function hbarChart({ data, tone = 'spend', fullFormat = money }) {
  const rows = [...data].sort((a, b) => num(b.value) - num(a.value));
  if (!rows.length) return el(`<div>${emptyState('Nothing recorded yet', '', 'chart')}</div>`);
  const max = Math.max(...rows.map(r => num(r.value))) || 1;
  const total = sum(rows, r => r.value) || 1;
  return el(`<ul class="hbars chart-${tone}">${rows.map(r => `
    <li><div class="hbar-top"><span>${esc(r.label)}</span><b>${esc(fullFormat(r.value))} <small class="muted">${Math.round(num(r.value) / total * 100)}%</small></b></div>
    <div class="hbar-track"><span class="hbar-fill" style="width:${(num(r.value) / max) * 100}%"></span></div></li>`).join('')}</ul>`);
}

/**
 * Donut showing parts of a whole (max 4 parts, each labelled in the legend with its value).
 * parts: [{ label, value, cls }] where cls is a CSS class that sets the stroke colour.
 */
function donut({ parts, centerLabel, centerValue }) {
  const total = sum(parts, p => p.value);
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const gap = parts.filter(p => num(p.value) > 0).length > 1 ? 2 : 0;
  const arcs = parts.map(p => {
    const len = total ? (num(p.value) / total) * C : 0;
    const seg = `<circle class="arc ${p.cls}" r="${R}" cx="64" cy="64" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}"/>`;
    off += len;
    return len ? seg : '';
  }).join('');
  return el(`<div class="donut-wrap">
    <svg viewBox="0 0 128 128" class="donut" role="img" aria-label="${esc(centerLabel)}"><circle class="arc-track" r="${R}" cx="64" cy="64"/><g transform="rotate(-90 64 64)">${arcs}</g>
      <text x="64" y="60" text-anchor="middle" class="donut-val">${esc(centerValue)}</text><text x="64" y="78" text-anchor="middle" class="donut-lbl">${esc(centerLabel)}</text></svg>
    <ul class="legend">${parts.map(p => `<li><span class="swatch ${p.cls}"></span><span>${esc(p.label)}</span><b>${esc(p.display ?? p.value)}</b></li>`).join('')}</ul>
  </div>`);
}

function attachTable(wrap, head, rows) {
  const btn = $('.chart-table-toggle', wrap);
  let table;
  btn.onclick = () => {
    if (!table) {
      table = el(`<div class="table-wrap chart-table"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td data-label="${esc(head[i])}" class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      wrap.append(table);
    } else table.hidden = !table.hidden;
    btn.textContent = table.hidden ? 'Show as table' : 'Hide table';
  };
}

// Rounds a raw tick step up to a friendly number (1, 2, 2.5, 5 × 10^n).
function niceStep(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

// Short axis labels: 0, 500, 2.5K, 10K, 1.2M
function axisFormat(n) {
  if (n >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// Sums rows into month buckets. Returns [{ label, title, value }] for the given month keys.
function monthlySeries(rows, dateKey, amountKey, months) {
  const totals = Object.fromEntries(months.map(m => [m, 0]));
  for (const r of rows) {
    const k = monthKey(r[dateKey]);
    if (k in totals) totals[k] += num(r[amountKey]);
  }
  return months.map(m => ({ label: monthLabel(m), title: monthLabel(m, true), value: totals[m] }));
}
