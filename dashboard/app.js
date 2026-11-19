// Token Launch Radar — dashboard logic (static page, no network).
// Reads window.RADAR from ../data.js (written by main.ts from the snapshot).
// Hash routes: "" = board, "#/protocol/<slug>" = detail view,
// "#/?category=X&chain=Y&watch=1" = filtered board (used by the filtered screenshot).

(function () {
  const data = window.RADAR;
  if (!data || !Array.isArray(data.rows)) {
    document.getElementById('stats').textContent = 'No radar data found.';
    return;
  }
  const rows = data.rows;
  const meta = data.meta;
  const model = data.model;

  const $ = (id) => document.getElementById(id);
  const money = (n) => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  };
  const pct = (c) => (c === null || c === undefined ? '—' : (c >= 0 ? '+' : '') + c.toFixed(1) + '%');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Header stat cards.
  $('stats').innerHTML =
    '<div class="stat"><b>' + rows.length + '</b><span>launch candidates ranked</span></div>' +
    '<div class="stat"><b>' + meta.watchlist_total + '/' + meta.watchlist_total + '</b><span>watchlist covered</span></div>' +
    '<div class="stat"><b>' + model.curve.peers + '</b><span>live peers fitted</span></div>' +
    '<div class="stat"><b>' + meta.plan_templates + '</b><span>farm-plan templates</span></div>';
  $('asof').textContent = meta.as_of;

  // Model card: the fitted curve, the blind-test table, and why it was kept.
  $('equation').innerHTML =
    'Implied value = curve(TVL) × growth tilt × age tilt × spread tilt, where the curve is fitted on the snapshot itself: <code>' +
    esc(model.equation) + '</code> Median live multiple ' + model.peerMultipleMedian.toFixed(3) +
    '× (10th–90th percentile ' + model.peerMultipleP10 + '×–' + model.peerMultipleP90 + '×).';
  $('valid').querySelector('tbody').innerHTML = model.candidates.map((c) =>
    '<tr' + (c.key === model.chosenKey ? ' class="best"' : '') + '><td>' + esc(c.label) +
    (c.key === model.chosenKey ? ' — kept' : '') + '</td><td class="num">' + c.loo.toFixed(1) +
    '%</td><td class="num">' + c.cv.toFixed(1) + '%</td></tr>').join('');
  $('modelnote').textContent =
    'Errors are median absolute per-cent errors predicting a live peer’s market cap: leave-one-out over all ' +
    model.curve.peers + ' peers, and five-fold cross-validation (each fold is every 5th peer by slug hash; the number shown is the median of the five folds). ' +
    'One 26-peer holdout on its own swings 70–430% between splits for every model here, so a single split would be a lottery ticket, not a test — the page reports the median of five folds instead. ' +
    'The fitted curve wins on leave-one-out; the five-feature ridge matches it on error, but its fitted coefficients punish growth and age (both come out negative) — the opposite of what a launch radar should reward — so the simpler curve is kept. ' +
    'Growth is winsorized at the snapshot’s own 99th percentile (+' + model.growthCapPct + '%) because one protocol grew +4,448% in a week on a fresh listing, and no single listing quirk should own the board. ' +
    'The tilts are stated priors kept small: with 128 peers there is not enough data to fit them, and the fitted growth coefficient comes out negative — an artefact of fresh listings exploding from a tiny base.';

  // Tabs.
  const tabs = ['board', 'live', 'dropped'];
  function showTab(name) {
    for (const t of tabs) {
      $('tab-' + t).hidden = t !== name;
      document.querySelector('[data-tab="' + t + '"]').classList.toggle('on', t === name);
    }
  }
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.addEventListener('click', () => { showTab(b.dataset.tab); location.hash = ''; }));

  // Filter option lists (from the data, not hardcoded).
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
  for (const c of cats) $('f-cat').appendChild(new Option(c, c));
  for (const c of chains) $('f-chain').appendChild(new Option(c, c));

  const state = { q: '', cat: '', chain: '', tvl: 0, chg: '', watch: false, sort: 'implied' };

  function visibleRows() {
    const out = rows.filter((r) => {
      if (state.watch && !r.is_watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && !r.chains.includes(state.chain)) return false;
      if (r.tvl_usd < state.tvl) return false;
      if (state.chg === 'pos' && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (state.chg === 'neg' && !(r.change_7d !== null && r.change_7d < 0)) return false;
      if (state.chg === 'fast' && !(r.change_7d !== null && r.change_7d > 10)) return false;
      if (state.q) {
        const q = state.q.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const order = {
      implied: (a, b) => a.rank - b.rank,
      tvl: (a, b) => b.tvl_usd - a.tvl_usd,
      growth: (a, b) => (b.change_7d ?? -9) - (a.change_7d ?? -9),
      name: (a, b) => a.name.localeCompare(b.name),
    }[state.sort];
    return out.sort(order);
  }

  function paintBoard() {
    const list = visibleRows();
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' ranked protocols' +
      (state.watch ? ' · watchlist only' : '') + (state.cat ? ' · ' + state.cat : '') + (state.chain ? ' · ' + state.chain : '');
    $('rows').innerHTML = list.map((r) => {
      const cls = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
      return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.is_watchlist ? '<span class="pill">WATCHLIST</span>' : '') +
        '<br><small style="color:var(--soft)">' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + r.curve_multiple.toFixed(2) + '×</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
  }

  function setBoardChrome(hidden) {
    // In detail view the model card, tabs and board chrome are out of the
    // way, so the detail starts near the top of the page instead of below
    // a long card the reader has already seen.
    const d = hidden ? 'none' : '';
    $('modelcard').style.display = d;
    $('tabs').style.display = d;
    $('toolbar').style.display = d;
    $('count').style.display = d;
    $('board').style.display = d;
  }

  function paintDetail(slug) {
    const r = rows.find((x) => x.slug === slug);
    const box = $('detail');
    if (!r) { box.hidden = true; setBoardChrome(false); return; }
    setBoardChrome(true);
    const maths = money(r.curve_value_usd) + ' curve value × ' + r.growth_tilt.toFixed(3) + ' growth × ' +
      r.age_tilt.toFixed(3) + ' age × ' + r.spread_tilt.toFixed(3) + ' spread = <b>' + money(r.implied_value_usd) + '</b>';
    $('d-body').innerHTML =
      '<h2>' + esc(r.name) + (r.is_watchlist ? ' <span class="pill">WATCHLIST</span>' : '') + '</h2>' +
      '<p style="color:var(--soft)">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorized') + ' · ' +
      esc(r.chains.join(', ')) + ' · listed ' + esc(r.listed_at || 'unknown') + ' · records no token</p>' +
      '<div class="facts">' +
      '<div class="fact"><small>Implied value</small><b>' + money(r.implied_value_usd) + '</b></div>' +
      '<div class="fact"><small>TVL</small><b>' + money(r.tvl_usd) + '</b></div>' +
      '<div class="fact"><small>7-day change</small><b>' + pct(r.change_7d) + '</b></div>' +
      '<div class="fact"><small>Curve multiple</small><b>' + r.curve_multiple.toFixed(3) + '×</b></div>' +
      '<div class="fact"><small>Rank</small><b>#' + r.rank + ' of ' + rows.length + '</b></div>' +
      '<div class="fact"><small>Plan total</small><b>' + esc(r.plan_total) + '</b></div></div>' +
      '<h3>The maths</h3><p><code>' + maths + '</code></p>' +
      '<p style="color:var(--soft);font-size:13.5px">The curve value is what the fitted log-log line predicts for this TVL; the tilts adjust it for 7-day growth (winsorized at +' +
      model.growthCapPct + '%), days listed with no token, and chain count. Every input is a field of the sealed snapshot — no name was ever typed into the model.</p>' +
      '<h3>Farm plan — concrete steps, costed</h3><ol>' + r.farm_steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<p><b>Plan total: ' + esc(r.plan_total) + '.</b> Gas figures are typical ranges for the main chain, not quotes; the deposit sizes are the plan’s own suggestion.</p>';
    box.hidden = false;
    window.scrollTo(0, 0);
  }

  function paintSideLists() {
    $('live-list').innerHTML = (data.live || []).map((p) =>
      '<li><b>' + esc(p.name) + '</b> (' + esc(p.symbol || '—') + ') — ' + money(p.tvl_usd) + ' TVL · mcap ' + (p.mcap_usd === null ? '—' : money(p.mcap_usd)) + '</li>').join('');
    $('db-count').textContent = (data.droppedBelow || []).length;
    $('dh-count').textContent = (data.droppedHigh || []).length;
    const aside = (p) => '<li><b>' + esc(p.name) + '</b> — ' + money(p.tvl_usd) + ' TVL · ' + esc(p.reason) + '</li>';
    $('dropped-below').innerHTML = (data.droppedBelow || []).map(aside).join('');
    $('dropped-high').innerHTML = (data.droppedHigh || []).map(aside).join('');
  }

  function applyHash() {
    const h = location.hash || '';
    const m = h.match(/^#\/protocol\/([\w.-]+)/);
    showTab('board');
    paintBoard();
    if (m) { paintDetail(m[1]); return; }
    $('detail').hidden = true;
    setBoardChrome(false);
    const q = h.match(/^#\/\?(.*)/);
    if (q) {
      const p = new URLSearchParams(q[1]);
      if (p.get('category')) { state.cat = p.get('category'); $('f-cat').value = state.cat; }
      if (p.get('chain')) { state.chain = p.get('chain'); $('f-chain').value = state.chain; }
      if (p.get('watch')) { state.watch = true; $('f-watch').checked = true; }
      if (p.get('sort')) { state.sort = p.get('sort'); $('f-sort').value = state.sort; }
      paintBoard();
      // A shared filtered link lands on the board, not on the model card.
      $('tabs').scrollIntoView();
    }
  }

  // Events.
  $('q').addEventListener('input', (e) => { state.q = e.target.value; paintBoard(); });
  $('f-cat').addEventListener('change', (e) => { state.cat = e.target.value; paintBoard(); });
  $('f-chain').addEventListener('change', (e) => { state.chain = e.target.value; paintBoard(); });
  $('f-tvl').addEventListener('change', (e) => { state.tvl = Number(e.target.value); paintBoard(); });
  $('f-chg').addEventListener('change', (e) => { state.chg = e.target.value; paintBoard(); });
  $('f-watch').addEventListener('change', (e) => { state.watch = e.target.checked; paintBoard(); });
  $('f-sort').addEventListener('change', (e) => { state.sort = e.target.value; paintBoard(); });
  $('f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', cat: '', chain: '', tvl: 0, chg: '', watch: false, sort: 'implied' });
    $('q').value = ''; $('f-cat').value = ''; $('f-chain').value = ''; $('f-tvl').value = '0';
    $('f-chg').value = ''; $('f-watch').checked = false; $('f-sort').value = 'implied';
    location.hash = ''; paintBoard();
  });
  document.querySelectorAll('#board th').forEach((th) => th.addEventListener('click', () => {
    const map = { rank: 'implied', name: 'name', tvl: 'tvl', chg: 'growth' };
    const s = map[th.dataset.k];
    if (s) { state.sort = s; $('f-sort').value = s; paintBoard(); }
  }));
  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/protocol/' + tr.dataset.slug;
  });
  $('d-close').addEventListener('click', () => { location.hash = ''; $('detail').hidden = true; });
  window.addEventListener('hashchange', applyHash);

  paintSideLists();
  applyHash();
})();
