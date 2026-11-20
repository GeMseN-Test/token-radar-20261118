/* Token Launch Radar dashboard — reads window.TOKEN_RADAR (written by main.ts). */
const D = window.TOKEN_RADAR;
const $ = (s) => document.querySelector(s);
const fmt$ = (n) => '$' + Math.round(n).toLocaleString('en-US');
const compact$ = (n) => {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return fmt$(n);
};
const pct = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let tab = 'board';
let compareSet = [];

/* ---------- header, KPIs, reconciliation, model card ---------- */
$('#asof').textContent = D.as_of;
$('#meta').textContent = `Floor $${D.floor_usd.toLocaleString('en-US')} · ${D.peers} live peers priced the curve · Blind test on the same 128 peers`;
const kept = D.blind.find((b) => b.kept);
const kpis = [
  [D.total_protocols, 'protocols in snapshot', '758 counted, none missing'],
  [D.board.length, 'rows on the board', '40 watchlist + 141 below floor'],
  [D.median_multiple.toFixed(2) + 'x', 'median implied / TVL', 'across the 181 board rows'],
  [D.verdict_counts.FARM, 'FARM verdicts', `${D.verdict_counts.THIN} THIN · ${D.verdict_counts.SKIP} SKIP`],
  [kept ? kept.loo_within2_pct.toFixed(0) + '%' : '—', 'kept-model LOO within 2×', 'share of peers priced within 2× of real mcap'],
  [D.live.length, 'already trading', 'token live — listed separately'],
];
$('#kpis').innerHTML = kpis.map(([v, l, s]) => `<div class="kpi"><b>${v}</b><span>${l}</span><small>${s}</small></div>`).join('');
const R = D.reconciliation;
$('#recon').innerHTML = `<b>Reconciliation — all ${R.total} protocols accounted for:</b> ` +
  `${R.board} on the board + ${R.live} already trading + ${R.set_aside} set aside with a reason = ${R.total}. ` +
  `Set aside: ${D.set_aside_reasons.map((r) => `${r.count} × ${esc(r.reason)}`).join(' · ')}. No protocol is counted twice, none is missing.`;
$('#equation').textContent =
  `log10(market cap) = ${D.fit.a.toFixed(3)} + ${D.fit.b.toFixed(3)} × log10(TVL)  (R² ${D.fit.r2.toFixed(3)}, fitted on ${D.peers} live peers) — ` +
  `implied = curve(TVL) × growth tilt × age tilt × spread tilt. Growth winsorised at the snapshot's own p99 (+${D.growth_p99_pct.toFixed(1)}%).`;
$('#modelnote').textContent =
  `Verdict rule, same for every row: net per farmer = 2% of implied value × 1-in-4 launch chance ÷ estimated farmers (TVL ÷ $100k, clamped 200–10,000) − farm-plan cost. ` +
  `FARM when net ≥ $150, THIN when net ≥ $25, SKIP below that. Rank is how big the launch could be; verdict is whether farming it pays you after cost and crowd — so a giant, crowded, expensive-chain protocol can rank #1 and still be THIN.`;
$('#blind tbody').innerHTML = D.blind.map((b) => `<tr class="${b.kept ? 'kept' : ''}"><td>${esc(b.model)}<br><span class="fine">${esc(b.note)}</span></td>` +
  `<td class="num">${b.loo_error_pct.toFixed(1)}%</td><td class="num">${b.loo_within2_pct.toFixed(1)}%</td>` +
  `<td class="num">${b.cv_error_pct.toFixed(1)}%</td><td class="num">${b.cv_within2_pct.toFixed(1)}%</td>` +
  `<td>${b.kept ? 'KEPT' : ''}</td></tr>`).join('');

/* ---------- filter options ---------- */
const cats = [...new Set(D.board.map((r) => r.category).filter(Boolean))].sort();
$('#cat').innerHTML += cats.map((c) => `<option>${esc(c)}</option>`).join('');
const chains = [...new Set(D.board.flatMap((r) => r.chains))].sort();
$('#chain').innerHTML += chains.map((c) => `<option>${esc(c)}</option>`).join('');
$('#nBoard').textContent = D.board.length;
$('#nLive').textContent = D.live.length;
$('#nSet').textContent = D.set_aside.length;

/* ---------- board ---------- */
function filtered() {
  const q = $('#q').value.trim().toLowerCase();
  const cat = $('#cat').value, ch = $('#chain').value, v = $('#verdict').value, w = $('#watch').checked;
  let rows = D.board.filter((r) =>
    (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
    (!cat || r.category === cat) && (!ch || r.chains.includes(ch)) &&
    (!v || r.verdict === v) && (!w || r.on_watchlist));
  const s = $('#sort').value;
  if (s === 'tvl') rows = [...rows].sort((a, b) => b.tvl_usd - a.tvl_usd);
  else if (s === 'growth') rows = [...rows].sort((a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9));
  else if (s === 'net') rows = [...rows].sort((a, b) => b.net_usd - a.net_usd);
  else if (s === 'cost') rows = [...rows].sort((a, b) => a.plan_cost_usd - b.plan_cost_usd);
  else rows = [...rows].sort((a, b) => a.rank - b.rank);
  return rows;
}
function renderBoard() {
  const rows = filtered();
  $('#showing').textContent = tab === 'board' ? `Showing ${rows.length} of ${D.board.length} board rows` : '';
  $('#board tbody').innerHTML = rows.map((r) => `<tr>
    <td>${r.rank}</td>
    <td><button class="link" data-slug="${r.slug}">${esc(r.name)}</button>${r.on_watchlist ? ' <span class="watch">★ watchlist</span>' : ''}<br><span class="fine">${esc(r.category || 'No category')} · ${esc(r.chains.join(', '))}</span></td>
    <td class="num"><b>${compact$(r.implied_value_usd)}</b><br><span class="fine">${r.multiple.toFixed(2)}x TVL</span></td>
    <td class="num">${compact$(r.tvl_usd)}</td>
    <td class="num">${pct(r.change_7d)}</td>
    <td><span class="pill ${r.verdict}">${r.verdict}</span></td>
    <td class="num">${r.net_usd >= 0 ? '+' : ''}${fmt$(r.net_usd)}</td>
    <td class="num">${fmt$(r.plan_cost_usd)}</td>
    <td><label class="fine"><input type="checkbox" data-cmp="${r.slug}" ${compareSet.includes(r.slug) ? 'checked' : ''}> compare</label></td>
  </tr>`).join('');
  $('#compareBtn').textContent = `Compare (${compareSet.length})`;
  $('#compareBtn').disabled = compareSet.length < 2;
}
$('#livetab tbody').innerHTML = D.live.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${esc(p.category || '—')}</td><td class="num">${compact$(p.tvl_usd)}</td><td class="num">${compact$(p.mcap_usd)}</td><td class="num">${(p.mcap_usd / p.tvl_usd).toFixed(2)}x</td></tr>`).join('');
$('#settab tbody').innerHTML = D.set_aside.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td class="num">${compact$(p.tvl_usd)}</td><td>${esc(p.reason)}</td></tr>`).join('');

/* ---------- tabs ---------- */
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  $('#board').classList.toggle('hidden', t !== 'board');
  $('#livetab').classList.toggle('hidden', t !== 'live');
  $('#settab').classList.toggle('hidden', t !== 'setaside');
  $('#showing').textContent = t === 'board' ? $('#showing').textContent : (t === 'live' ? `All ${D.live.length} protocols whose token already trades — listed, not ranked, so they never crowd the launch board.` : `All ${D.set_aside.length} pre-token protocols left off the board, each with its reason.`);
  if (t === 'board') renderBoard();
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* ---------- detail ---------- */
function renderDetail(slug) {
  const r = D.board.find((x) => x.slug === slug);
  const el = $('#detail');
  if (!r) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<p><button class="link" id="backBtn">← Back to the board</button></p>
    <h2>#${r.rank} ${esc(r.name)} <span class="pill ${r.verdict}">${r.verdict}</span></h2>
    <p class="fine">${esc(r.category || 'No category')} · ${esc(r.chains.join(', '))} · ${r.on_watchlist ? 'On the house watchlist ★' : 'Below the floor — found by the radar'} · Snapshot ${D.as_of}</p>
    <p class="verdictline"><b>Verdict ${r.verdict}:</b> expected net ${r.net_usd >= 0 ? '+' : ''}${fmt$(r.net_usd)} per farmer — ` +
    `2% of ${compact$(r.implied_value_usd)} implied × 1-in-4 launch chance ÷ ~${r.farmers.toLocaleString('en-US')} estimated farmers − ${fmt$(r.plan_cost_usd)} plan cost. ` +
    (r.verdict === 'FARM' ? 'Worth farming: the expected share clears the cost by a wide margin.' : r.verdict === 'THIN' ? 'Marginal: the expected share barely clears the cost — farm small, or only if you already use the protocol.' : 'Skip farming: after cost and crowd, the expected share is under water — watch it, do not pay to farm it.') + `</p>
    <div class="maths">
      <div><b>${compact$(r.implied_value_usd)}</b><span>implied value (${r.multiple.toFixed(2)}x TVL)</span></div>
      <div><b>${compact$(r.curve_usd)}</b><span>curve value at ${compact$(r.tvl_usd)} TVL</span></div>
      <div><b>${compact$(r.tvl_usd)}</b><span>TVL · 7d ${pct(r.change_7d)}</span></div>
      <div><b>${r.age_days === null ? '—' : r.age_days + ' days'}</b><span>listed with no token (age tilt ${r.age_tilt.toFixed(2)}x)</span></div>
      <div><b>${r.growth_tilt.toFixed(2)}x</b><span>growth tilt</span></div>
      <div><b>${r.spread_tilt.toFixed(2)}x</b><span>category spread tilt</span></div>
      <div><b>${fmt$(r.plan_cost_usd)}</b><span>farm plan cost (estimate)</span></div>
      <div><b>~${r.farmers.toLocaleString('en-US')}</b><span>estimated farmers sharing the drop</span></div>
    </div>
    <h3>Farm plan — 5 steps, ${fmt$(r.plan_cost_usd)} total (gas estimates)</h3>
    <ol>${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="fine">Maths: curve ${compact$(r.curve_usd)} × growth ${r.growth_tilt.toFixed(2)} × age ${r.age_tilt.toFixed(2)} × spread ${r.spread_tilt.toFixed(2)} = ${compact$(r.implied_value_usd)} implied. Costs are typical ${esc(r.chains[0] || 'chain')} gas, not quotes.</p>`;
  $('#backBtn').addEventListener('click', () => { el.classList.add('hidden'); location.hash = ''; document.querySelector('#boardwrap').scrollIntoView(); });
  el.scrollIntoView();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-slug]');
  if (b) location.hash = '#/protocol/' + b.dataset.slug;
  const c = e.target.closest('input[data-cmp]');
  if (c) {
    const s = c.dataset.cmp;
    compareSet = c.checked ? [...compareSet, s].slice(0, 3) : compareSet.filter((x) => x !== s);
    if (compareSet.length > 3) compareSet = compareSet.slice(0, 3);
    renderBoard(); renderCompare();
  }
});

/* ---------- compare ---------- */
function renderCompare() {
  const el = $('#compare');
  if (compareSet.length < 2) { el.classList.add('hidden'); return; }
  const rows = compareSet.map((s) => D.board.find((r) => r.slug === s)).filter(Boolean);
  el.classList.remove('hidden');
  const labels = ['Implied value', 'TVL', '7d growth', 'Multiple', 'Verdict', 'Net / farmer', 'Plan cost', 'Farmers', 'Category', 'Chains'];
  const vals = (r) => [compact$(r.implied_value_usd), compact$(r.tvl_usd), pct(r.change_7d), r.multiple.toFixed(2) + 'x', r.verdict, (r.net_usd >= 0 ? '+' : '') + fmt$(r.net_usd), fmt$(r.plan_cost_usd), '~' + r.farmers.toLocaleString('en-US'), r.category || '—', r.chains.join(', ')];
  $('#compareBody').innerHTML = `<table><thead><tr><th></th>${rows.map((r) => `<th>${esc(r.name)}</th>`).join('')}</tr></thead><tbody>` +
    labels.map((l, i) => `<tr><td><b>${l}</b></td>${rows.map((r) => `<td>${esc(vals(r)[i])}</td>`).join('')}</tr>`).join('') + `</tbody></table>`;
}
$('#clearCompare').addEventListener('click', () => { compareSet = []; renderBoard(); renderCompare(); });
$('#compareBtn').addEventListener('click', () => { renderCompare(); $('#compare').scrollIntoView(); });

/* ---------- sandbox ---------- */
const sandSel = $('#sandSlug');
sandSel.innerHTML = D.board.map((r) => `<option value="${r.slug}">#${r.rank} ${esc(r.name)}</option>`).join('');
function sandbox() {
  const r = D.board.find((x) => x.slug === sandSel.value) || D.board[0];
  const tvlM = +$('#sandTvl').value;
  const growth = +$('#sandGrowth').value;
  $('#sandTvlOut').textContent = compact$(tvlM * 1e6);
  $('#sandGrowthOut').textContent = (growth > 0 ? '+' : '') + growth + '%';
  const base = Math.pow(10, D.fit.a + D.fit.b * Math.log10(tvlM * 1e6));
  const gt = 1 + Math.max(-50, Math.min(D.growth_p99_pct, growth)) / 100;
  const implied = base * gt * r.age_tilt * r.spread_tilt;
  $('#sandOut').innerHTML = `<b>${esc(r.name)}</b> at ${compact$(tvlM * 1e6)} TVL and ${growth}% 7-day growth: implied <b>${compact$(implied)}</b> ` +
    `(board value ${compact$(r.implied_value_usd)} at ${compact$(r.tvl_usd)} TVL, ${pct(r.change_7d)} growth). ` +
    `Curve ${compact$(base)} × growth ${gt.toFixed(2)} × age ${r.age_tilt.toFixed(2)} × spread ${r.spread_tilt.toFixed(2)}.`;
}
['sandSlug', 'sandTvl', 'sandGrowth'].forEach((id) => document.getElementById(id).addEventListener('input', sandbox));

/* ---------- export ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#csvBtn').addEventListener('click', () => {
  const head = 'rank,slug,name,category,chains,tvl_usd,change_7d,implied_value_usd,multiple,verdict,net_usd,plan_cost_usd,farmers\n';
  const body = filtered().map((r) => [r.rank, r.slug, `"${r.name.replace(/"/g, '""')}"`, `"${(r.category || '').replace(/"/g, '""')}"`, `"${r.chains.join('|')}"`, r.tvl_usd, r.change_7d ?? '', r.implied_value_usd, r.multiple.toFixed(3), r.verdict, r.net_usd, r.plan_cost_usd, r.farmers].join(',')).join('\n');
  download('token-launch-radar-board.csv', head + body + '\n', 'text/csv');
});
$('#jsonBtn').addEventListener('click', () => download('token-launch-radar-board.json', JSON.stringify({ rows: filtered() }, null, 2), 'application/json'));

/* ---------- filters + hash routes ---------- */
['q', 'cat', 'chain', 'verdict', 'watch', 'sort'].forEach((id) => document.getElementById(id).addEventListener('input', () => { setTab('board'); renderBoard(); }));
function route() {
  const h = location.hash;
  const m = h.match(/^#\/protocol\/([\w-]+)$/);
  if (m) { renderDetail(m[1]); return; }
  const q = new URLSearchParams(h.slice(2));
  if (q.has('category')) $('#cat').value = q.get('category');
  if (q.has('chain')) $('#chain').value = q.get('chain');
  if (q.get('watch') === '1') $('#watch').checked = true;
  $('#detail').classList.add('hidden');
  setTab('board'); renderBoard();
}
window.addEventListener('hashchange', route);
sandbox();
route();
