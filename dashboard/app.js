// Token Launch Radar — dashboard logic (static page, no network).
// Reads window.RADAR from ../data.js (written by main.ts from the snapshot).
// Hash routes: "" = board, "#/protocol/<slug>" = detail view,
// "#/?category=X&chain=Y&watch=1" = filtered board (used by the filtered screenshot).

(function () {
  const data = window.RADAR;
  if (!data || !Array.isArray(data.rows)) {
    document.getElementById('meta').textContent = 'No radar data found.';
    return;
  }
  const rows = data.rows;
  const meta = data.meta;

  const $ = (id) => document.getElementById(id);
  const money = (n) => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  };
  const pct = (c) => (c === null || c === undefined ? '—' : (c >= 0 ? '+' : '') + c.toFixed(1) + '%');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Meta strip + footer.
  $('meta').innerHTML =
    '<b>' + rows.length + ' ranked</b> · ' + meta.pre_token_total + ' pre-token of ' + meta.protocols_total +
    ' protocols · watchlist ' + meta.watchlist_total + '<br>Snapshot ' + esc(meta.as_of) + ' · floor $50M';
  $('asof').textContent = meta.as_of;

  // Filter option lists (from the data, not hardcoded).
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
  for (const c of cats) $('f-cat').appendChild(new Option(c, c));
  for (const c of chains) $('f-chain').appendChild(new Option(c, c));

  const state = { q: '', cat: '', chain: '', tvl: 0, chg: '', watch: false, sort: 'implied' };

  function filtered() {
    let out = rows.filter((r) => {
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
    const by = {
      implied: (a, b) => a.rank - b.rank,
      tvl: (a, b) => b.tvl_usd - a.tvl_usd,
      growth: (a, b) => (b.change_7d ?? -9) - (a.change_7d ?? -9),
      name: (a, b) => a.name.localeCompare(b.name),
    }[state.sort];
    return out.sort(by);
  }

  function render() {
    const list = filtered();
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' ranked protocols' +
      (state.watch ? ' · watchlist only' : '') + (state.cat ? ' · ' + state.cat : '') + (state.chain ? ' · ' + state.chain : '');
    $('rows').innerHTML = list.map((r) => {
      const cls = r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down';
      return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.is_watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
        '<br><small style="color:var(--muted)">' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + r.peer_multiple.toFixed(2) + '×</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
  }

  function showDetail(slug) {
    const r = rows.find((x) => x.slug === slug);
    const box = $('detail');
    if (!r) { box.hidden = true; $('board').style.display = ''; return; }
    $('board').style.display = 'none';
    const math = money(r.tvl_usd) + ' TVL × ' + r.peer_multiple.toFixed(3) + ' peer multiple × ' +
      r.growth_factor.toFixed(3) + ' growth × ' + r.chain_factor.toFixed(3) + ' chains × ' +
      r.maturity_factor.toFixed(3) + ' maturity = <b>' + money(r.implied_value_usd) + '</b>';
    $('d-body').innerHTML =
      '<h2>' + esc(r.name) + (r.is_watchlist ? ' <span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p style="color:var(--muted)">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorized') + ' · ' +
      esc(r.chains.join(', ')) + ' · listed ' + esc(r.listed_at || 'unknown') + ' · token status: ' + esc(r.token_status) + '</p>' +
      '<div class="grid">' +
      '<div class="cell"><small>Implied value</small><b>' + money(r.implied_value_usd) + '</b></div>' +
      '<div class="cell"><small>TVL</small><b>' + money(r.tvl_usd) + '</b></div>' +
      '<div class="cell"><small>7-day change</small><b>' + pct(r.change_7d) + '</b></div>' +
      '<div class="cell"><small>Peer multiple (mcap/TVL)</small><b>' + r.peer_multiple.toFixed(3) + '×</b></div>' +
      '<div class="cell"><small>Rank</small><b>#' + r.rank + ' of ' + rows.length + '</b></div></div>' +
      '<h3>The maths</h3><p><code>' + math + '</code></p>' +
      '<p style="color:var(--muted);font-size:13.5px">Peer multiple = median mcap/TVL of ' + esc(r.category || 'uncategorized') +
      ' protocols that already trade a token (global median ' + meta.global_peer_multiple.toFixed(3) +
      '× when the category has no live peer). Growth, chain count and days listed with no token adjust it — every input is a field of the sealed snapshot.</p>' +
      '<h3>Farm plan — concrete steps</h3><ol>' + r.farm_steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
    box.hidden = false;
    window.scrollTo(0, 0);
  }

  function applyHash() {
    const h = location.hash || '';
    const m = h.match(/^#\/protocol\/([\w.-]+)/);
    render();
    if (m) { showDetail(m[1]); return; }
    $('detail').hidden = true;
    $('board').style.display = '';
    const q = h.match(/^#\/\?(.*)/);
    if (q) {
      const p = new URLSearchParams(q[1]);
      if (p.get('category')) { state.cat = p.get('category'); $('f-cat').value = state.cat; }
      if (p.get('chain')) { state.chain = p.get('chain'); $('f-chain').value = state.chain; }
      if (p.get('watch')) { state.watch = true; $('f-watch').checked = true; }
      if (p.get('sort')) { state.sort = p.get('sort'); $('f-sort').value = state.sort; }
    }
    render();
  }

  // Live (already trading) list, set aside from the ranking.
  $('live-list').innerHTML = (data.live || []).map((p) =>
    '<li>' + esc(p.name) + ' (' + esc(p.symbol || '—') + ') — ' + money(p.tvl_usd) + ' TVL</li>').join('');

  // Events.
  $('q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('f-cat').addEventListener('change', (e) => { state.cat = e.target.value; render(); });
  $('f-chain').addEventListener('change', (e) => { state.chain = e.target.value; render(); });
  $('f-tvl').addEventListener('change', (e) => { state.tvl = Number(e.target.value); render(); });
  $('f-chg').addEventListener('change', (e) => { state.chg = e.target.value; render(); });
  $('f-watch').addEventListener('change', (e) => { state.watch = e.target.checked; render(); });
  $('f-sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', cat: '', chain: '', tvl: 0, chg: '', watch: false, sort: 'implied' });
    $('q').value = ''; $('f-cat').value = ''; $('f-chain').value = ''; $('f-tvl').value = '0';
    $('f-chg').value = ''; $('f-watch').checked = false; $('f-sort').value = 'implied';
    location.hash = ''; render();
  });
  document.querySelectorAll('#board th').forEach((th) => th.addEventListener('click', () => {
    const map = { rank: 'implied', name: 'name', tvl: 'tvl', chg: 'growth' };
    const s = map[th.dataset.k];
    if (s) { state.sort = s; $('f-sort').value = s; render(); }
  }));
  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/protocol/' + tr.dataset.slug;
  });
  $('d-close').addEventListener('click', () => { location.hash = ''; $('detail').hidden = true; });
  window.addEventListener('hashchange', applyHash);

  applyHash();
})();
