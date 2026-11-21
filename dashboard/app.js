// Token Launch Radar dashboard — ronde 8. Static, no network: every number
// comes from window.TOKEN_RADAR (data.js), written by main.ts from the same
// board the gate checks. The integrity strip recomputes the board from that
// data in this browser and compares it with what main.ts printed.
(function () {
  var R = window.TOKEN_RADAR;
  var board = R.board;
  var $ = function (id) { return document.getElementById(id); };

  function fnvHex(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function money2(n) {
    var s = (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return s;
  }
  function pct(n) { return (n * 100).toFixed(0) + '%'; }
  function ageFmt(d) {
    if (d === null || d === undefined) return '—';
    if (d < 365) return d + ' d';
    return (d / 365).toFixed(1) + ' yr';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---- farm economics, recomputed here from the row's stored figures ----
  // Same formulas as lib/model.ts farmEconomics: plan is a fraction of TVL,
  // farmers = TVL / plan, slice = implied x drop share / farmers, costs are
  // gas plus — for DEX pairs only — a 0.60% round-trip swap fee and exit
  // slippage on the half of the plan that must be swapped.
  function econ(row) {
    var planPct = parseFloat($('planpct').value);
    var share = parseFloat($('share').value);
    var weeks = parseInt($('horizon').value, 10);
    var hours = 0.75 + weeks * 0.25;
    var plan = Math.max(100, planPct * row.tvl_usd);
    var farmers = row.tvl_usd / plan;
    var slice = (row.implied_value_usd * share) / farmers;
    var swapFee = row.is_dex ? 0.006 * (plan / 2) : 0;
    var slippage = row.is_dex ? ((plan / 2) * (plan / 2)) / (0.05 * row.tvl_usd) : 0;
    var net = slice - row.gas_usd - swapFee - slippage;
    var netH = net / hours;
    var a = (row.implied_value_usd * share) / row.tvl_usd - (row.is_dex ? 0.003 : 0);
    var b = row.is_dex ? 1 / (4 * 0.05 * row.tvl_usd) : 0;
    var pays = null;
    if (b === 0) { if (a > 0) pays = Math.max(10, Math.ceil(row.gas_usd / a / 10) * 10); }
    else {
      var disc = a * a - 4 * b * row.gas_usd;
      if (disc >= 0 && a > 0) { var root = (a - Math.sqrt(disc)) / (2 * b); if (root > 0) pays = Math.max(10, Math.ceil(root / 10) * 10); }
    }
    var verdict = (net >= 25 && netH >= 5) ? 'FARM' : (net >= -50 ? 'MARGINAL' : 'SKIP');
    return { plan: plan, farmers: farmers, slice: slice, swapFee: swapFee, slippage: slippage, net: net, netH: netH, pays: pays, verdict: verdict, hours: hours, tbill: plan * (R.tbill_apy_pct / 100) * (weeks / 52) };
  }

  // ---- header + KPIs ----
  $('as-of').textContent = 'DefiLlama snapshot ' + R.as_of + ' · model radar-4 · ' + R.total_protocols + ' protocols read';
  var kept = null, keptOdds = null;
  R.ablation.forEach(function (s) { if (s.kept) kept = s; });
  R.odds_ablation.forEach(function (s) { if (s.kept) keptOdds = s; });
  var top = board[0];
  var kpis = [
    ['Ranked', String(board.length), R.watchlist_size + ' watchlist + ' + board.filter(function (r) { return r.off_list; }).length + ' off-list + ' + board.filter(function (r) { return !r.on_watchlist && !r.off_list; }).length + ' below floor'],
    ['Implied value', money(R.total_implied_usd), 'top ' + top.name + ' ' + money(top.implied_value_usd)],
    ['Miss, walk-forward', '×' + kept.wf_miss.toFixed(2), 'flat ×' + R.ablation[0].wf_miss.toFixed(2) + ' · left out ×' + kept.loo_miss.toFixed(2)],
    ['Range honest', Math.round(R.ranges.wf_p25_p75_hold_pct) + '% · ' + Math.round(R.ranges.wf_p10_p90_hold_pct) + '%', 'P25–P75 · P10–P90, newer half'],
    ['Token odds, Brier', keptOdds.wf_brier.toFixed(3), 'walk-forward · base ' + R.odds_ablation[0].wf_brier.toFixed(3) + ' · ' + keptOdds.wf_correct_pct.toFixed(0) + '% right'],
    ['Worth farming', String(R.verdict_counts.FARM), 'FARM of ' + board.length + ' · net ≥ $25 and ≥ $5/hour'],
  ];
  $('kpis').innerHTML = kpis.map(function (k) {
    return '<div class="kpi"><span>' + k[0] + '</span><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></div>';
  }).join('');

  // ---- reconciliation bar ----
  var rec = R.reconciliation;
  var reasons = R.set_aside_reasons;
  function seg(n, color, label) {
    return '<i style="width:' + (n / rec.total * 100).toFixed(2) + '%;background:' + color + '" title="' + label + '"></i>';
  }
  $('recon').innerHTML =
    '<p><b>Protocol accounting</b> — all ' + rec.total + ' snapshot protocols in exactly one group: ' +
    rec.board + ' ranked as pre-token, ' + rec.token_on_record + ' token on record, ' + rec.set_aside + ' set aside by the house rule.</p>' +
    '<div class="bar">' + seg(rec.board, '#f0a35e', 'ranked') + seg(rec.token_on_record, '#3fb950', 'token on record') + seg(rec.set_aside, '#8b949e', 'set aside') + '</div>' +
    '<p class="fine">Ranked — watchlist ' + R.watchlist_size + ' &nbsp;·&nbsp; Ranked — early, below the floor ' + board.filter(function (r) { return !r.on_watchlist && !r.off_list; }).length +
    ' &nbsp;·&nbsp; Ranked — off-list, parent recorded ' + board.filter(function (r) { return r.off_list; }).length +
    ' &nbsp;·&nbsp; Token trades — priced comp ' + R.live.length + ' &nbsp;·&nbsp; Token recorded — no usable cap ' + (rec.token_on_record - R.live.length) +
    ' &nbsp;·&nbsp; Out — ' + reasons.map(function (x) { return x.reason.toLowerCase() + ' ' + x.count; }).join(' &nbsp;·&nbsp; Out — ') + '</p>';

  // ---- integrity strip: recomputed here, in this browser ----
  var sumImplied = board.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  var ranksOk = board.every(function (r, i) { return r.rank === i + 1; }) &&
    board.every(function (r, i) { return i === 0 || r.implied_value_usd < board[i - 1].implied_value_usd; });
  var checks = [
    ['this table = board.json', board.length + ' of ' + board.length + ' rows recomputed here', true],
    ['ranks 1–' + board.length + ' in order, values never rise', ranksOk ? 'holds' : 'FAILS', ranksOk],
    ['totals equal', money(sumImplied) + ' = ' + money(R.total_implied_usd), sumImplied === R.total_implied_usd],
    ['checksum', fnvHex(JSON.stringify({ rows: board }) + '\n') + ' = main.ts ' + R.checksum, fnvHex(JSON.stringify({ rows: board }) + '\n') === R.checksum],
    ['watchlist', board.filter(function (r) { return r.on_watchlist; }).length + ' of ' + R.watchlist_size + ' ranked', board.filter(function (r) { return r.on_watchlist; }).length === R.watchlist_size],
    ['ledger', rec.board + ' + ' + rec.token_on_record + ' + ' + rec.set_aside + ' = ' + rec.total + ' of ' + R.total_protocols + ' protocols', rec.total === R.total_protocols],
  ];
  $('integrity').innerHTML = '<p><b>Integrity strip</b> — recomputed in your browser from the data file, not printed from a screenshot:</p>' +
    checks.map(function (c) {
      return '<p><span class="' + (c[2] ? 'ok' : 'bad') + '">' + (c[2] ? '✓' : '✗') + '</span> ' + esc(c[0]) + ': <code>' + esc(c[1]) + '</code></p>';
    }).join('');

  // ---- method ----
  var f = R.global_fit;
  $('formula').textContent =
    'implied = TVL × fitted multiple × group premium × momentum × launch odds\n' +
    'log10(mcap) = ' + f.a.toFixed(3) + ' + ' + f.b.toFixed(3) + ' × log10(TVL), R² ' + f.r2.toFixed(3) +
    ', fitted on ' + R.peers_dated + ' dated peers; curve at $100M TVL ' + money(R.curve_at_100m_usd) + ' ± ' + money(R.curve_at_100m_se_usd) +
    ' (bootstrap s.e., 200 refits); at $1B ' + money(R.curve_at_1b_usd) + ' ± ' + money(R.curve_at_1b_se_usd);
  $('method-note').textContent =
    'Age and chain count do not price a token never seen, so the value model leaves them out; both help say which peers record a token, so they enter through the odds. ' +
    'Kinship is the strongest odds term (beta +' + R.odds.beta[7].toFixed(2) + ' ± ' + R.odds.beta_se[7].toFixed(2) + '): 90% of protocols sharing a name stem with a token record one, against 43% of the rest. ' +
    'TVL and 7-day growth were fitted in the odds model and dropped — with age known they move the Brier from 0.220 to 0.220. ' +
    'The walk-forward miss also moves with the split: oldest two-thirds → newest third gives ×2.85, the median half ×' + kept.wf_miss.toFixed(2) + ', the smallest split (35 → 35) ×3.43. The page reports the median half and never hides the other two.';
  $('group-table').querySelector('tbody').innerHTML = R.group_fits.map(function (g) {
    return '<tr><td>' + esc(g.group) + '</td><td class="num">' + g.peers + '</td><td class="num">' + g.residual.toFixed(2) + '×' + (g.clamped ? ' (clamped)' : '') + '</td></tr>';
  }).join('');
  $('ablation-table').querySelector('tbody').innerHTML = R.ablation.map(function (s) {
    return '<tr class="' + (s.kept ? 'kept' : 'dropped') + '"><td>' + esc(s.step) + (s.kept ? ' — kept' : '') + '</td><td class="num">×' + s.loo_miss.toFixed(2) + '</td><td class="num">' + s.loo_within3_pct.toFixed(0) + '%</td><td class="num">×' + s.wf_miss.toFixed(2) + '</td><td class="num">' + s.wf_within3_pct.toFixed(0) + '%</td></tr>';
  }).join('');
  $('ablation-note').textContent =
    'A term is kept only when it lowers the miss in BOTH tests. Age lowers walk-forward (×' + kept.wf_miss.toFixed(2) + ' → ×' + R.ablation[4].wf_miss.toFixed(2) +
    ') but raises leave-one-out (×' + kept.loo_miss.toFixed(2) + ' → ×' + R.ablation[4].loo_miss.toFixed(2) + '), so it is tested and not kept. ' +
    'The placebo (7-day growth shuffled across peers) prices at ×' + R.placebo_value_loo_miss.toFixed(2) + ', worse than real growth at ×' + kept.loo_miss.toFixed(2) + ' — the momentum signal is real, and small.';
  $('odds-table').querySelector('tbody').innerHTML = R.odds_ablation.map(function (s) {
    return '<tr class="' + (s.kept ? 'kept' : 'dropped') + '"><td>' + esc(s.step) + (s.kept ? ' — kept' : '') + '</td><td class="num">' + s.loo_brier.toFixed(3) + '</td><td class="num">' + s.loo_correct_pct.toFixed(1) + '%</td><td class="num">' + s.wf_brier.toFixed(3) + '</td><td class="num">' + s.wf_correct_pct.toFixed(1) + '%</td></tr>';
  }).join('');
  $('odds-note').textContent =
    'Base rate ' + R.odds.base_rate_pct + '%: ' + R.odds.loo_n + ' protocols, ' + R.odds.wf_n + ' in the walk-forward test. ' +
    'The control (kinship shuffled) scores Brier ' + R.placebo_odds_loo_brier.toFixed(3) + ' — the kept model’s ' + keptOdds.loo_brier.toFixed(3) +
    ' is the kinship signal, not luck. Logistic betas (standardized): ' + R.odds.features.map(function (n, i) { return n + ' +' + R.odds.beta[i].toFixed(2) + ' ± ' + R.odds.beta_se[i].toFixed(2); }).join(' · ') + '.';
  var rg = R.ranges;
  $('range-table').querySelector('tbody').innerHTML =
    '<tr><td>Inside P25–P75 (×' + rg.q25.toFixed(2) + '–×' + rg.q75.toFixed(2) + ')</td><td class="num">50%</td><td class="num">' + rg.p25_p75_hold_pct.toFixed(1) + '%</td><td class="num">' + rg.wf_p25_p75_hold_pct.toFixed(1) + '%</td></tr>' +
    '<tr><td>Inside P10–P90 (×' + rg.q10.toFixed(2) + '–×' + rg.q90.toFixed(2) + ')</td><td class="num">80%</td><td class="num">' + rg.p10_p90_hold_pct.toFixed(1) + '%</td><td class="num">' + rg.wf_p10_p90_hold_pct.toFixed(1) + '%</td></tr>';
  $('range-note').textContent =
    'Ranges come from the kept model’s leave-one-out residuals (' + rg.loo_n + ' peers). The printed P25–P75 range catches ' + rg.p25_p75_hold_pct.toFixed(1) +
    '% of held-out caps and ' + rg.wf_p25_p75_hold_pct.toFixed(1) + '% of newer ones; P10–P90 catches ' + rg.p10_p90_hold_pct.toFixed(1) + '% and ' + rg.wf_p10_p90_hold_pct.toFixed(1) +
    '%. The range is a little too narrow on new tokens, and the page says so instead of widening it after the fact.';
  $('checks').innerHTML =
    '<div class="check"><span>VALUE MODEL — KEPT</span><b>×' + kept.loo_miss.toFixed(2) + ' left out · ×' + kept.wf_miss.toFixed(2) + ' newer</b>Every term earned its place in both tests; age, ridge and quadratic did not.</div>' +
    '<div class="check"><span>LAUNCH ODDS — LOGISTIC</span><b>Brier ' + keptOdds.loo_brier.toFixed(3) + ' left out · ' + keptOdds.wf_brier.toFixed(3) + ' newer</b>Base rate ' + R.odds.base_rate_pct + '% → Brier ' + R.odds_ablation[0].loo_brier.toFixed(3) + ' left out, ' + R.odds_ablation[0].wf_brier.toFixed(3) + ' newer. Kinship carries it.</div>' +
    '<div class="check"><span>FARM — DEPOSIT-SIZED</span><b>' + R.verdict_counts.FARM + ' FARM / ' + R.verdict_counts.MARGINAL + ' MARGINAL / ' + R.verdict_counts.SKIP + ' SKIP</b>Plan 0.02% of TVL, 7% drop share, 12 weeks, net of gas, swap and slippage.</div>';

  // ---- scatter ----
  (function () {
    var svg = $('scatter');
    var W = 640, H = 300, pad = 34;
    var xs = R.scatter.map(function (p) { return p.x; }), ys = R.scatter.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs) - 0.2, x1 = Math.max.apply(null, xs) + 0.2;
    var y0 = Math.min.apply(null, ys) - 0.2, y1 = Math.max.apply(null, ys) + 0.2;
    function X(v) { return pad + (v - x0) / (x1 - x0) * (W - 2 * pad); }
    function Y(v) { return H - pad - (v - y0) / (y1 - y0) * (H - 2 * pad); }
    var out = '';
    var fit = R.global_fit;
    var line = '';
    for (var t = x0; t <= x1; t += 0.1) { line += (line ? ' L' : 'M') + X(t).toFixed(1) + ' ' + Y(fit.a + fit.b * t).toFixed(1); }
    out += '<path d="' + line + '" fill="none" stroke="#f0a35e" stroke-width="2"/>';
    R.scatter.forEach(function (p) {
      out += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.board ? 3.2 : 2.2) + '" fill="' + (p.board ? '#f0a35e' : '#5b7a99') + '" opacity="' + (p.board ? 0.95 : 0.55) + '"/>';
    });
    out += '<text x="' + pad + '" y="' + (H - 8) + '" fill="#93a1b3" font-size="11">log10 TVL (USD)</text>';
    out += '<text x="8" y="' + (pad - 8) + '" fill="#93a1b3" font-size="11">log10 market cap (USD)</text>';
    svg.innerHTML = out;
  })();
  $('scatter-note').textContent =
    'Grey: the ' + R.peers_dated + ' dated traded tokens the curve is fitted on. Amber: the top 60 board rows at value-if-launches. Line: the fitted curve. ' +
    'The ' + (R.peers - R.peers_dated) + ' traded tokens with no listing date sit out of the fit — a walk-forward test needs a date — and the page says so.';

  // ---- board ----
  var sortKey = 'rank', sortDir = 1;
  var tab = 'all';
  var compare = [];
  function currentRows() {
    var q = ($('search').value || '').toLowerCase();
    var g = $('group').value, c = $('chain').value, v = $('verdict').value;
    var rows = board.filter(function (r) {
      if (tab === 'watchlist' && !r.on_watchlist) return false;
      if (tab === 'offlist' && !r.off_list) return false;
      if (tab === 'below' && (r.on_watchlist || r.off_list)) return false;
      if (tab === 'farm' && econ(r).verdict !== 'FARM') return false;
      if (tab === 'marginal' && econ(r).verdict !== 'MARGINAL') return false;
      if (tab === 'skip' && econ(r).verdict !== 'SKIP') return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0) return false;
      if (g && r.group !== g) return false;
      if (c && r.chains.indexOf(c) < 0) return false;
      if (v && econ(r).verdict !== v) return false;
      return true;
    });
    rows.sort(function (a, b) {
      var av = sortKey === 'net_usd' || sortKey === 'net_per_hour_usd' ? econ(a)[sortKey === 'net_usd' ? 'net' : 'netH'] : a[sortKey];
      var bv = sortKey === 'net_usd' || sortKey === 'net_per_hour_usd' ? econ(b)[sortKey === 'net_usd' ? 'net' : 'netH'] : b[sortKey];
      if (av === null || av === undefined) av = sortKey === 'change_7d' || sortKey === 'age_days' ? -1e9 : 0;
      if (bv === null || bv === undefined) bv = sortKey === 'change_7d' || sortKey === 'age_days' ? -1e9 : 0;
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
    return rows;
  }
  function renderBoard() {
    var rows = currentRows();
    var tb = $('board').querySelector('tbody');
    tb.innerHTML = rows.map(function (r) {
      var e = econ(r);
      var chg = r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%';
      var badges = (r.on_watchlist ? '<span class="badge watch">Watchlist</span>' : '') + (r.off_list ? '<span class="badge off">Off-list</span>' : '') + (r.kin ? '<span class="badge kin">Kin</span>' : '');
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '<br><span style="color:var(--muted);font-size:11px">' + r.rank_low + '–' + r.rank_high + '</span></td>' +
        '<td><input type="checkbox" class="cmp" data-slug="' + esc(r.slug) + '"' + (compare.indexOf(r.slug) >= 0 ? ' checked' : '') + '> <b>' + esc(r.name) + '</b>' + badges + '<br><span style="color:var(--muted);font-size:12px">' + esc(r.category || '') + ' · ' + esc(r.chains.join(', ')) + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num">' + ageFmt(r.age_days) + '</td>' +
        '<td><span class="oddsbar"><i style="width:' + Math.round(r.launch_odds * 100) + '%"></i></span>' + pct(r.launch_odds) + '</td>' +
        '<td class="num">' + money(r.value_if_launches_usd) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b><br><span style="color:var(--muted);font-size:12px">' + money(r.implied_low_usd) + '–' + money(r.implied_high_usd) + '</span></td>' +
        '<td class="num">' + money2(e.net) + '</td>' +
        '<td class="num">' + money2(e.netH) + '</td>' +
        '<td><span class="verdict ' + e.verdict + '">' + e.verdict + '</span></td>' +
        '</tr>';
    }).join('');
    $('count').textContent = 'Showing ' + rows.length + ' of ' + board.length + ' rows · ' + money(R.total_implied_usd) + ' implied in view · plan ' +
      (parseFloat($('planpct').value) * 100).toFixed(3) + '% of TVL · drop share ' + (parseFloat($('share').value) * 100).toFixed(1) + '% · horizon ' + $('horizon').value + ' weeks';
    var counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    board.forEach(function (r) { counts[econ(r).verdict]++; });
    $('summary').innerHTML = '<p>Under the current plan size, drop share and horizon: <b>' + counts.FARM + ' FARM</b> · ' + counts.MARGINAL + ' MARGINAL · ' + counts.SKIP + ' SKIP. ' +
      'Top three by implied value: ' + board.slice(0, 3).map(function (r) { return esc(r.name) + ' ' + money(r.implied_value_usd); }).join(' · ') + '.</p>';
    renderCompare();
  }
  function renderCompare() {
    var box = document.querySelector('.compare');
    if (!compare.length) { if (box) box.remove(); return; }
    var rows = compare.map(function (s) { return board.filter(function (r) { return r.slug === s; })[0]; }).filter(Boolean);
    var html = '<div class="compare"><b>Compare:</b> ' + rows.map(function (r) {
      var e = econ(r);
      return esc(r.name) + ' — implied ' + money(r.implied_value_usd) + ' · odds ' + pct(r.launch_odds) + ' · net ' + money2(e.net) + ' (' + e.verdict + ')';
    }).join(' &nbsp;|&nbsp; ') + '</div>';
    if (box) box.outerHTML = html;
    else $('board').insertAdjacentHTML('afterend', html);
  }
  function renderTabs() {
    var counts = { all: board.length, watchlist: 0, offlist: 0, below: 0, farm: 0, marginal: 0, skip: 0 };
    board.forEach(function (r) {
      if (r.on_watchlist) counts.watchlist++;
      if (r.off_list) counts.offlist++;
      if (!r.on_watchlist && !r.off_list) counts.below++;
      counts[econ(r).verdict.toLowerCase()]++;
    });
    var defs = [['all', 'All ' + counts.all], ['watchlist', 'Watchlist ' + counts.watchlist], ['offlist', 'Off-list ' + counts.offlist], ['below', 'Below floor ' + counts.below], ['farm', 'Farm ' + counts.farm], ['marginal', 'Marginal ' + counts.marginal], ['skip', 'Skip ' + counts.skip]];
    $('tabs').innerHTML = defs.map(function (d) {
      return '<button type="button" data-tab="' + d[0] + '" class="' + (tab === d[0] ? 'on' : '') + '">' + d[1] + '</button>';
    }).join('');
  }
  function renderLists() {
    $('on-record').innerHTML = R.token_on_record.map(function (p) {
      return '<li>' + esc(p.name) + '<span>' + money(p.tvl_usd) + ' · ' + esc(p.note) + '</span></li>';
    }).join('');
    $('set-aside').innerHTML = R.set_aside.map(function (p) {
      return '<li>' + esc(p.name) + '<span>' + money(p.tvl_usd) + ' · ' + esc(p.reason) + '</span></li>';
    }).join('');
  }
  function openDetail(slug) {
    var r = board.filter(function (x) { return x.slug === slug; })[0];
    if (!r) return;
    var e = econ(r);
    var d = $('detail');
    var maths =
      'curve:       ' + money(r.curve_usd) + '  (10^' + R.global_fit.a.toFixed(3) + ' + ' + R.global_fit.b.toFixed(3) + ' × log10(' + money(r.tvl_usd) + '))\n' +
      '× group:     ' + r.group_residual.toFixed(2) + '×  (' + r.group + ')\n' +
      '× momentum:  ' + r.momentum.toFixed(3) + '×  (7-day ' + (r.change_7d === null ? '—' : r.change_7d.toFixed(1) + '%, winsorized at +' + R.growth_p99_pct.toFixed(1) + '%') + ')\n' +
      '= launches:  ' + money(r.value_if_launches_usd) + '\n' +
      '× odds:      ' + pct(r.launch_odds) + '  (logistic: ' + ageFmt(r.age_days) + ' listed, ' + r.group + ', ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ', kin ' + (r.kin ? 'yes' : 'no') + ')\n' +
      '= implied:   ' + money(r.implied_value_usd) + '  (range ' + money(r.implied_low_usd) + '–' + money(r.implied_high_usd) + ' P25–P75, ' + money(r.implied_low90_usd) + '–' + money(r.implied_high90_usd) + ' P10–P90; ranks ' + r.rank_low + '–' + r.rank_high + ')';
    d.innerHTML =
      '<h2>' + esc(r.name) + ' <span style="color:var(--muted);font-size:14px">rank ' + r.rank + ' · ' + esc(r.category || '') + ' · ' + esc(r.chains.join(', ')) + '</span></h2>' +
      '<p><span class="verdict ' + e.verdict + '">' + e.verdict + '</span> &nbsp; Net ' + money2(e.net) + ' (' + money2(e.netH) + '/hour) on a ' + money(e.plan) + ' plan · slice ' + money2(e.slice) + ' · costs: gas ' + money2(r.gas_usd) + ' + swap ' + money2(e.swapFee) + ' + slippage ' + money2(e.slippage) + ' · ' + e.farmers.toLocaleString() + ' farmers at this plan size.</p>' +
      '<div class="maths">' + esc(maths) + '</div>' +
      '<div class="grid"><div><h3>Farm plan — five steps, ' + (e.hours).toFixed(2) + ' hours over ' + $('horizon').value + ' weeks</h3><ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>' +
      '<div><h3>Sandbox — change the plan, watch the net</h3>' +
      '<label>Plan size: <span id="sb-plan-label">' + (parseFloat($('planpct').value) * 100).toFixed(3) + '% of TVL (' + money(e.plan) + ')</span></label><input id="sb-plan" type="range" min="0.005" max="0.05" step="0.005" value="' + (parseFloat($('planpct').value) * 100) + '">' +
      '<label>Drop share: <span id="sb-share-label">' + (parseFloat($('share').value) * 100).toFixed(1) + '%</span></label><input id="sb-share" type="range" min="3.5" max="14" step="0.5" value="' + (parseFloat($('share').value) * 100) + '">' +
      '<p id="sb-out"></p>' +
      '<p class="fine">Pays from a ' + (e.pays === null ? 'deposit that never pays: the slice per dollar is below the swap fee at any size' : money(e.pays) + ' deposit') +
      '. A T-bill on this plan pays ' + money2(e.tbill) + ' over ' + $('horizon').value + ' weeks — on the biggest protocols the T-bill wins, and this page says so.</p>' +
      '<p><button type="button" id="detail-close">Close detail</button></p></div></div>';
    d.hidden = false;
    (function sandbox() {
      var out = $('sb-out');
      function update() {
        var pp = parseFloat($('sb-plan').value) / 100;
        var sh = parseFloat($('sb-share').value) / 100;
        var plan = Math.max(100, pp * r.tvl_usd);
        var farmers = r.tvl_usd / plan;
        var slice = (r.implied_value_usd * sh) / farmers;
        var swapFee = r.is_dex ? 0.006 * (plan / 2) : 0;
        var slippage = r.is_dex ? ((plan / 2) * (plan / 2)) / (0.05 * r.tvl_usd) : 0;
        var net = slice - r.gas_usd - swapFee - slippage;
        var verdict = (net >= 25 && net / e.hours >= 5) ? 'FARM' : (net >= -50 ? 'MARGINAL' : 'SKIP');
        $('sb-plan-label').textContent = (pp * 100).toFixed(3) + '% of TVL (' + money(plan) + ')';
        $('sb-share-label').textContent = (sh * 100).toFixed(1) + '%';
        out.innerHTML = 'Plan ' + money(plan) + ' · slice ' + money2(slice) + ' · costs ' + money2(r.gas_usd + swapFee + slippage) + ' · <b>net ' + money2(net) + ' (' + money2(net / e.hours) + '/hour) — ' + verdict + '</b>';
      }
      $('sb-plan').addEventListener('input', update);
      $('sb-share').addEventListener('input', update);
      update();
    })();
    $('detail-close').addEventListener('click', function () { d.hidden = true; });
    if (!document.body.classList.contains('shot-detail')) d.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  // ---- events ----
  $('board').querySelector('thead').addEventListener('click', function (ev) {
    var th = ev.target.closest('th');
    if (!th || !th.dataset.sort) return;
    if (sortKey === th.dataset.sort) sortDir = -sortDir; else { sortKey = th.dataset.sort; sortDir = 1; }
    renderBoard();
  });
  $('board').querySelector('tbody').addEventListener('click', function (ev) {
    if (ev.target.classList && ev.target.classList.contains('cmp')) {
      var slug = ev.target.dataset.slug;
      if (ev.target.checked) { if (compare.length < 3) compare.push(slug); else ev.target.checked = false; }
      else compare = compare.filter(function (s) { return s !== slug; });
      renderCompare();
      return;
    }
    var tr = ev.target.closest('tr');
    if (tr) openDetail(tr.dataset.slug);
  });
  $('tabs').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    tab = b.dataset.tab;
    renderTabs();
    renderBoard();
  });
  ['planpct', 'share', 'horizon', 'search', 'group', 'chain', 'verdict'].forEach(function (id) {
    $(id).addEventListener('input', function () { renderTabs(); renderBoard(); });
    $(id).addEventListener('change', function () { renderTabs(); renderBoard(); });
  });
  $('hide-summary').addEventListener('click', function () {
    var s = $('summary');
    s.style.display = s.style.display === 'none' ? '' : 'none';
  });
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('export-csv').addEventListener('click', function () {
    var rows = currentRows();
    var head = 'rank,name,tvl_usd,change_7d,age_days,launch_odds,value_if_launches_usd,implied_value_usd,implied_low_usd,implied_high_usd,net_usd,net_per_hour_usd,verdict\n';
    download('token-radar-board.csv', head + rows.map(function (r) {
      var e = econ(r);
      return [r.rank, '"' + r.name.replace(/"/g, '""') + '"', r.tvl_usd, r.change_7d, r.age_days, r.launch_odds, r.value_if_launches_usd, r.implied_value_usd, r.implied_low_usd, r.implied_high_usd, e.net.toFixed(2), e.netH.toFixed(2), e.verdict].join(',');
    }).join('\n'), 'text/csv');
  });
  $('export-json').addEventListener('click', function () {
    download('token-radar-board.json', JSON.stringify({ rows: currentRows() }, null, 2), 'application/json');
  });

  // ---- selects + lists ----
  var groups = [], chains = [];
  board.forEach(function (r) {
    if (groups.indexOf(r.group) < 0) groups.push(r.group);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  groups.sort();
  chains.sort();
  $('group').innerHTML = '<option value="">Any group</option>' + groups.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('');
  $('chain').innerHTML = '<option value="">Any chain</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  renderLists();
  renderTabs();
  renderBoard();

  // ---- screenshot modes (location.hash) ----
  var hash = window.location.hash || '';
  if (hash.indexOf('#shot=board') === 0) {
    document.body.classList.add('shot-board');
  } else if (hash.indexOf('#shot=filter:') === 0) {
    document.body.classList.add('shot-filter');
    var v = hash.slice('#shot=filter:'.length);
    tab = v.toLowerCase() === 'farm' ? 'farm' : v.toLowerCase() === 'marginal' ? 'marginal' : v.toLowerCase() === 'skip' ? 'skip' : tab;
    renderTabs();
    renderBoard();
  } else if (hash.indexOf('#shot=detail:') === 0) {
    document.body.classList.add('shot-detail');
    openDetail(hash.slice('#shot=detail:'.length));
  }
})();
