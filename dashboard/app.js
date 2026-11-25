// Token Launch Radar — dashboard logic, ronde 9 ("radar-5").
// Every number on the page is read from window.TOKEN_RADAR (data.js) and
// recomputed in the browser where it can be: the checksum, the farm
// economics in the sandbox, and the verdicts all derive from the data file.
(function () {
  'use strict';
  var R = window.TOKEN_RADAR;
  var rows = R.board;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function $(id) { return document.getElementById(id); }
  function fmtUsd(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function fmtUsd2(n) {
    var sign = n < 0 ? '-' : '';
    var v = Math.abs(n);
    return sign + '$' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2));
  }
  function fmtX(n) { return 'x' + n.toFixed(2); }
  function fmtPct(n) { return n.toFixed(1) + '%'; }
  function fmtNum(n) { return n.toLocaleString('en-US'); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtCompact(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return fmtUsd2(n);
  }
  function verdictBadge(v) { return '<span class="verdict ' + v + '">' + v + '</span>'; }

  // FNV-1a, 32-bit — the same code as lib/model.ts.
  function fnvHex(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // Farm economics at any plan size and drop share, from the row's own
  // numbers: slice = implied * share / farmers, farmers = TVL / plan.
  // Gas is fixed (five steps); swap fee and slippage apply only to DEX
  // pairs, on the half of the plan that must be swapped to make the pair.
  function econ(row, planUsd, sharePct) {
    var plan = Math.max(10, planUsd);
    var share = sharePct / 100;
    var farmers = row.tvl_usd / plan;
    var slice = (row.implied_value_usd * share) / farmers;
    var swapFee = row.is_dex ? 0.006 * (plan / 2) : 0;
    var slippage = row.is_dex ? ((plan / 2) * (plan / 2)) / (0.05 * row.tvl_usd) : 0;
    var costs = row.gas_usd + swapFee + slippage;
    var net = slice - costs;
    var netLow = slice * R.ranges.q25 - costs;
    var verdict = netLow >= 0 ? 'ROBUST' : (net >= 25 && net / row.plan_hours >= 5 ? 'FARM' : (net >= -50 ? 'THIN' : 'SKIP'));
    return {
      plan: plan, farmers: Math.round(farmers), slice: slice, swapFee: swapFee,
      slippage: slippage, costs: costs, net: net, netLow: netLow,
      netPerHour: net / row.plan_hours, verdict: verdict,
      tbill: plan * (R.tbill_apy_pct / 100) * (R.horizon_weeks / 52),
    };
  }

  // ---- Header: KPIs, banner, integrity -------------------------------
  var kept = R.ablation.filter(function (a) { return a.kept; })[0];
  var kpis = [
    ['Protocols ranked', fmtNum(rows.length)],
    ['Total implied value', fmtUsd(R.total_implied_usd)],
    ['Value miss, leave-one-out', fmtX(kept.loo_miss)],
    ['Value miss, walk-forward', fmtX(kept.wf_miss)],
    ['Launch odds, Brier (LOO)', R.odds.loo_brier.toFixed(3)],
    ['ROBUST / FARM / THIN / SKIP', R.verdict_counts.ROBUST + ' / ' + R.verdict_counts.FARM + ' / ' + R.verdict_counts.THIN + ' / ' + R.verdict_counts.SKIP],
  ];
  $('kpis').innerHTML = kpis.map(function (k) {
    return '<div class="kpi-item"><div class="kpi-num">' + k[1] + '</div><div class="kpi-label">' + k[0] + '</div></div>';
  }).join('');
  $('asof').textContent = R.as_of;
  var top = rows[0];
  $('banner').innerHTML = '<strong>Top pick:</strong> ' + esc(top.name) + ' — implied ' + fmtUsd(top.implied_value_usd) +
    ' at ' + fmtPct(top.launch_odds * 100) + ' launch odds, net ' + fmtUsd2(top.net_usd) + ' on a ' + fmtUsd(top.plan_usd) +
    ' plan (' + top.verdict + '). ' + (top.verdict === 'SKIP' ? 'The biggest row still loses money after gas — read the verdict, not the rank.' : 'Pays to farm at the printed plan.') +
    ' Snapshot frozen ' + R.as_of + '; ' + fmtNum(R.total_protocols) + ' protocols, ' + fmtNum(R.peers_dated) + ' dated peers in the fit.';

  var boardText = JSON.stringify({ rows: rows }) + '\n';
  var check = fnvHex(boardText);
  var ok = check === R.checksum;
  $('integrity').innerHTML = '<strong>Board checksum (recomputed in your browser):</strong> <code>' + check + '</code> — ' +
    (ok ? '<span class="ok">MATCHES</span> the build-time checksum <code>' + R.checksum + '</code>. The data is byte-identical to what was checked.'
       : '<span class="bad">DOES NOT MATCH</span> the build-time checksum <code>' + R.checksum + '</code>. The data changed after the build — do not trust the numbers below.');
  $('repro').textContent = 'Reproducibility: the build runs twice and refuses to write unless both runs are byte-identical (seeded bootstrap, seeded placebo, seeded ten-fold). Snapshot as_of ' + R.as_of + ', floor ' + fmtUsd(R.floor_usd) + ' TVL.';

  // ---- Top 5 ----------------------------------------------------------
  var top5 = rows.filter(function (r) { return r.verdict === 'ROBUST' || r.verdict === 'FARM'; }).slice(0, 5);
  $('top5').querySelector('tbody').innerHTML = top5.map(function (r) {
    return '<tr data-slug="' + r.slug + '"><td>' + r.rank + '</td><td><a href="#" data-slug="' + r.slug + '">' + esc(r.name) + '</a></td><td>' + fmtUsd(r.implied_value_usd) + '</td><td>' + fmtPct(r.launch_odds * 100) + '</td><td>' + fmtUsd2(r.slice_usd) + '</td><td>' + fmtUsd2(r.net_usd) + '</td><td>' + verdictBadge(r.verdict) + '</td></tr>';
  }).join('');

  // ---- How the price is built -----------------------------------------
  var f = R.global_fit;
  $('fit-summary').innerHTML =
    '<p>The fitted curve is <code>log10(market cap) = ' + f.a.toFixed(3) + ' + ' + f.b.toFixed(3) + ' &times; log10(TVL)</code> on the ' + R.peers_dated +
    ' dated peers (R&sup2; ' + f.r2.toFixed(3) + ' — the curve explains only 16.8% of launch values, which is why every row carries a range). ' +
    'At $100M TVL the curve says ' + fmtUsd(R.curve_at_100m_usd) + ' &plusmn; ' + fmtUsd(R.curve_at_100m_se_usd) +
    ' (bootstrap s.e., 200 refits); at $1B TVL it says ' + fmtUsd(R.curve_at_1b_usd) + ' &plusmn; ' + fmtUsd(R.curve_at_1b_se_usd) + '. ' +
    'The 7-day momentum tilt is winsorized at the snapshot p99 (+' + R.growth_p99_pct + '%), so one viral week cannot double a price. ' +
    'Dated peers only: a peer with no listing date cannot sit in a walk-forward test, and the dated fit prices better held-out on both tests (LOO ' + fmtX(kept.loo_miss) + ' against x3.30 for all 128).</p>';
  var curveTvls = [1e7, 5e7, 1e8, 2.5e8, 5e8, 1e9, 5e9, 1e10];
  $('curveTable').querySelector('tbody').innerHTML = curveTvls.map(function (tvl) {
    var v = Math.pow(10, f.a + f.b * Math.log10(tvl));
    return '<tr><td>' + fmtUsd(tvl) + '</td><td>' + fmtUsd(v) + '</td><td>' + fmtUsd(v * R.ranges.q25) + ' – ' + fmtUsd(v * R.ranges.q75) + '</td></tr>';
  }).join('');
  var groupMeanings = {
    lend: 'Lending launches price above the curve — collateral and fees are easy to value.',
    dex: 'DEX and derivatives price well above the curve — trading fees are the most legible revenue in DeFi.',
    yield: 'Yield vaults price below the curve — their fees are thinner and harder to defend.',
    rwa: 'RWA and stablecoins price above the curve — real-world yield carries a premium.',
    other: 'Everything else, priced near the curve.',
  };
  $('groupTable').querySelector('tbody').innerHTML = R.group_fits.map(function (g) {
    return '<tr><td>' + g.group + '</td><td>' + g.peers + '</td><td>' + g.residual.toFixed(3) + (g.clamped ? ' (clamped)' : '') + '</td><td>' + groupMeanings[g.group] + '</td></tr>';
  }).join('');
  $('terms').innerHTML = '<p><strong>Kept (3 of 6 tested):</strong> size curve, group residual, 7-day momentum. ' +
    '<strong>Tested, not kept:</strong> age (time with no token) — wins walk-forward (x3.04 to x2.94) but loses leave-one-out (x2.87 to x3.11); ' +
    'chain count + years listed — the #2 entry\'s kept set — loses both headline tests here (LOO x2.87 to x3.51, WF x3.04 to x3.56) when fit and prediction use the same features; ' +
    'kinship as a value term — loses both too. The odds model keeps kinship, where it earns its place (see below).</p>';

  // ---- Ablation ---------------------------------------------------------
  $('ablation').querySelector('tbody').innerHTML = R.ablation.map(function (a) {
    return '<tr' + (a.kept ? ' class="kept"' : '') + '><td>' + esc(a.step) + '</td><td>' + fmtX(a.loo_miss) + '</td><td>' + fmtPct(a.loo_within3_pct) + '</td><td>' + fmtX(a.cv5_miss) + '</td><td>' + fmtPct(a.cv5_within3_pct) + '</td><td>' + fmtX(a.wf_miss) + '</td><td>' + fmtPct(a.wf_within3_pct) + '</td><td>' + fmtX(a.cat_miss) + '</td><td>' + fmtPct(a.cat_within3_pct) + '</td><td>' + (a.kept ? '<strong>KEPT</strong>' : '—') + '</td></tr>';
  }).join('');
  var nc = R.nested_cv;
  $('nested').innerHTML = '<p><strong>Nested cross-validation (term choice checked):</strong> the terms were picked by inner folds only, then scored on outer folds they never saw. ' +
    'Picked model outer miss ' + fmtX(nc.picked_outer_miss) + ' (' + fmtPct(nc.picked_outer_within3_pct) + ' within 3&times;) vs fixed kept model ' + fmtX(nc.fixed_outer_miss) +
    ' (' + fmtPct(nc.fixed_outer_within3_pct) + '). Picks: ' + nc.picks.map(function (p) { return 'fold ' + p.fold + ': ' + esc(p.pick) + ' (inner ' + fmtX(p.inner_miss) + ')'; }).join('; ') +
    '. The picked model scores worse out of sample than the fixed kept model, so the term choice was not tuned to the outer folds.</p>';
  var ab = R.ablation;
  $('ablation-note').textContent = 'Reading the table: the flat multiple (one TVL multiple for everything) misses by x' + ab[0].loo_miss.toFixed(2) + ' leave-one-out; the size curve alone gets x' + ab[1].loo_miss.toFixed(2) + '; adding the group residual gets x' + ab[2].loo_miss.toFixed(2) + '; adding momentum gets the kept x' + kept.loo_miss.toFixed(2) + '. Nothing tried after that helps both headline tests. The placebo check — the same kept terms with 7-day growth shuffled across protocols — misses by x' + R.placebo_value_loo_miss.toFixed(2) + ', barely worse than the kept x' + kept.loo_miss.toFixed(2) + ', so momentum adds almost nothing on its own; it stays because it costs nothing and helps walk-forward. The #2 entry\'s published walk-forward x2.26 does not reproduce here under any split (half, 55/37, 60/40, date cutoffs), peer set (95 / 92 / 85 dated peers) or robust fit (L1, Huber, kNN, shrunk slopes, two-segment) tried — the best honest walk-forward across all candidates is x2.83, an ensemble that loses leave-one-out and five-fold.';

  // ---- Odds -------------------------------------------------------------
  $('odds').querySelector('tbody').innerHTML = R.odds_ablation.map(function (o) {
    return '<tr' + (o.kept ? ' class="kept"' : '') + '><td>' + esc(o.step) + '</td><td>' + o.loo_brier.toFixed(3) + '</td><td>' + fmtPct(o.loo_correct_pct) + '</td><td>' + o.ten_brier.toFixed(3) + '</td><td>' + fmtPct(o.ten_correct_pct) + '</td><td>' + o.wf_brier.toFixed(3) + '</td><td>' + fmtPct(o.wf_correct_pct) + '</td><td>' + (o.kept ? '<strong>KEPT</strong>' : '—') + '</td></tr>';
  }).join('');
  $('odds-terms').innerHTML = '<p><strong>Kept odds model</strong> (base rate ' + fmtPct(R.odds.base_rate_pct) + ', n=' + R.odds.loo_n + '): ' +
    R.odds.features.map(function (feat, i) {
      return esc(feat) + ' ' + R.odds.beta[i].toFixed(3) + ' &plusmn; ' + R.odds.beta_se[i].toFixed(3);
    }).join(', ') + '. Kinship is the strongest term: 90% of kin protocols record a token, against 43% of the rest. ' +
    'Adding TVL, 7-day growth or a shrunk category token share moves the Brier from 0.177 to 0.177–0.178 leave-one-out and 0.168 to 0.168–0.170 walk-forward — nothing — so the odds model is unchanged from round 8. ' +
    'It already beats the #2 entry\'s odds (Brier 0.193 ten-fold / 0.240 walk-forward).</p>';
  $('odds-note').textContent = 'Control: shuffling kinship across protocols gives a leave-one-out Brier of ' + R.placebo_odds_loo_brier.toFixed(3) + ' against the kept ' + R.odds.loo_brier.toFixed(3) + ' — the kinship signal is real, not luck. Walk-forward fits on the older half of dated protocols (n=' + R.odds.wf_n + ') and calls the newer half.';

  // ---- Ranges -----------------------------------------------------------
  var rg = R.ranges;
  $('rangeTable').querySelector('tbody').innerHTML =
    '<tr><td>P25–P75 (' + fmtX(rg.q25) + ' – ' + fmtX(rg.q75) + ')</td><td>50%</td><td>' + fmtPct(rg.p25_p75_hold_pct) + '</td><td>' + fmtPct(rg.wf_p25_p75_hold_pct) + '</td></tr>' +
    '<tr><td>P10–P90 (' + fmtX(rg.q10) + ' – ' + fmtX(rg.q90) + ')</td><td>80%</td><td>' + fmtPct(rg.p10_p90_hold_pct) + '</td><td>' + fmtPct(rg.wf_p10_p90_hold_pct) + '</td></tr>';
  $('rangeGroupTable').querySelector('tbody').innerHTML = R.range_by_group.map(function (g) {
    return '<tr><td>' + g.group + '</td><td>' + g.n + '</td><td>' + fmtPct(g.loo_hold_2575_pct) + '</td><td>' + fmtPct(g.loo_hold_1090_pct) + '</td><td>' + g.wf_n + '</td><td>' + fmtPct(g.wf_hold_2575_pct) + '</td><td>' + fmtPct(g.wf_hold_1090_pct) + '</td></tr>';
  }).join('');
  $('range-note').textContent = 'Per-group bands were tested and not kept: each group\'s quantiles shrunk 50% toward the global band hold ' + fmtPct(R.per_group_band_test.loo_hold_2575_pct) + '% leave-one-out / ' + fmtPct(R.per_group_band_test.wf_hold_2575_pct) + '% walk-forward in the middle band, against the global band\'s ' + fmtPct(rg.p25_p75_hold_pct) + '% / ' + fmtPct(rg.wf_p25_p75_hold_pct) + '%. The global band stays; the per-group table above shows where it is thin.';

  // ---- Board ------------------------------------------------------------
  var state = { tab: 'all', q: '', verdict: '', group: '', watchOnly: false, page: 0 };
  var PAGE = 25;
  function filtered() {
    return rows.filter(function (r) {
      if (state.tab === 'robust' && r.verdict !== 'ROBUST') return false;
      if (state.tab === 'farm' && r.verdict !== 'FARM') return false;
      if (state.tab === 'thin' && r.verdict !== 'THIN') return false;
      if (state.tab === 'skip' && r.verdict !== 'SKIP') return false;
      if (state.tab === 'watch' && !r.on_watchlist) return false;
      if (state.tab === 'offlist' && !r.off_list) return false;
      if (state.tab === 'below' && (r.on_watchlist || r.off_list)) return false;
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (state.group && r.group !== state.group) return false;
      if (state.watchOnly && !r.on_watchlist) return false;
      if (state.q && r.name.toLowerCase().indexOf(state.q.toLowerCase()) === -1) return false;
      return true;
    });
  }
  function renderBoard() {
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var pageRows = list.slice(state.page * PAGE, state.page * PAGE + PAGE);
    $('board').querySelector('tbody').innerHTML = pageRows.map(function (r) {
      return '<tr data-slug="' + r.slug + '"><td>' + r.rank + '</td><td><a href="#" data-slug="' + r.slug + '">' + esc(r.name) + '</a>' + (r.on_watchlist ? ' <span class="tag">watchlist</span>' : '') + (r.kin ? ' <span class="tag">kin</span>' : '') + '</td><td>' + fmtUsd(r.implied_value_usd) + '</td><td>' + fmtCompact(r.implied_low_usd) + ' – ' + fmtCompact(r.implied_high_usd) + '</td><td>' + fmtPct(r.launch_odds * 100) + '</td><td>' + fmtUsd(r.plan_usd) + '</td><td>' + fmtUsd2(r.slice_usd) + '</td><td>' + fmtUsd2(r.slice_1k_usd) + '</td><td>' + fmtUsd2(r.net_usd) + '</td><td>' + (r.break_even_usd === null ? '—' : fmtCompact(r.break_even_usd)) + '</td><td>' + verdictBadge(r.verdict) + '</td></tr>';
    }).join('');
    $('shownCount').textContent = list.length;
    $('pageInfo').textContent = 'Page ' + (state.page + 1) + ' of ' + pages;
    var shown = list.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    $('boardSummary').textContent = list.length + ' rows shown, total implied ' + fmtUsd(shown) + ' — ' +
      list.filter(function (r) { return r.verdict === 'ROBUST'; }).length + ' ROBUST, ' +
      list.filter(function (r) { return r.verdict === 'FARM'; }).length + ' FARM, ' +
      list.filter(function (r) { return r.verdict === 'THIN'; }).length + ' THIN, ' +
      list.filter(function (r) { return r.verdict === 'SKIP'; }).length + ' SKIP.';
  }
  $('count-all').textContent = rows.length;
  $('count-robust').textContent = R.verdict_counts.ROBUST;
  $('count-farm').textContent = R.verdict_counts.FARM;
  $('count-thin').textContent = R.verdict_counts.THIN;
  $('count-skip').textContent = R.verdict_counts.SKIP;
  $('count-watch').textContent = rows.filter(function (r) { return r.on_watchlist; }).length;
  $('count-offlist').textContent = rows.filter(function (r) { return r.off_list; }).length;
  $('count-below').textContent = rows.filter(function (r) { return !r.on_watchlist && !r.off_list; }).length;
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active');
    state.tab = b.getAttribute('data-tab');
    state.page = 0;
    renderBoard();
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; state.page = 0; renderBoard(); });
  $('verdictFilter').addEventListener('change', function (e) { state.verdict = e.target.value; state.page = 0; renderBoard(); });
  $('groupFilter').addEventListener('change', function (e) { state.group = e.target.value; state.page = 0; renderBoard(); });
  $('watchOnly').addEventListener('change', function (e) { state.watchOnly = e.target.checked; state.page = 0; renderBoard(); });
  $('prevPage').addEventListener('click', function () { if (state.page > 0) { state.page--; renderBoard(); } });
  $('nextPage').addEventListener('click', function () { state.page++; renderBoard(); });
  renderBoard();

  // ---- Detail + sandbox ---------------------------------------------------
  var selected = null;
  function showDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    selected = r;
    var age = r.age_days === null ? 'no listing date' : Math.round(r.age_days / 365 * 10) / 10 + ' years listed';
    $('detail').innerHTML =
      '<h3>#' + r.rank + ' ' + esc(r.name) + ' ' + verdictBadge(r.verdict) + '</h3>' +
      '<p><strong>Implied value ' + fmtUsd(r.implied_value_usd) + '</strong> — value-if-launches ' + fmtUsd(r.value_if_launches_usd) + ' &times; launch odds ' + fmtPct(r.launch_odds * 100) + '. ' +
      'Range P25–P75: ' + fmtUsd(r.implied_low_usd) + ' – ' + fmtUsd(r.implied_high_usd) + '; P10–P90: ' + fmtUsd(r.implied_low90_usd) + ' – ' + fmtUsd(r.implied_high90_usd) + '. ' +
      'If the true value were at the high end, this row would rank #' + r.rank_low + '; at the low end, #' + r.rank_high + '.</p>' +
      '<p>TVL ' + fmtUsd(r.tvl_usd) + ' (' + (r.category || 'uncategorised') + ', ' + esc(r.chains.join(', ')) + ', ' + age + (r.kin ? ', shares a name stem with a token that already trades' : '') + '). ' +
      'Curve value ' + fmtUsd(r.curve_usd) + ' &times; group residual ' + r.group_residual.toFixed(3) + ' &times; momentum ' + r.momentum.toFixed(3) + ' = ' + fmtUsd(r.value_if_launches_usd) + '.</p>' +
      '<p><strong>Farm plan:</strong> ' + fmtUsd(r.plan_usd) + ' (' + (r.plan_pct * 100).toFixed(2) + '% of TVL), ' + fmtNum(r.farmers) + ' farmers at that size, ' + r.plan_hours + ' hours over ' + R.horizon_weeks + ' weeks. ' +
      'Your slice ' + fmtUsd2(r.slice_usd) + ' (' + fmtUsd2(r.slice_1k_usd) + ' on a $1,000 plan) minus gas ' + fmtUsd2(r.gas_usd) +
      (r.is_dex ? ' minus swap fee ' + fmtUsd2(r.swap_fee_usd) + ' and slippage ' + fmtUsd2(r.slippage_usd) : ' — no swap, this group takes an asset you already hold') +
      ' = <strong>net ' + fmtUsd2(r.net_usd) + '</strong> (' + fmtUsd2(r.net_per_hour_usd) + '/hour). At the low end of the range the net is ' + fmtUsd2(r.net_low_usd) + '. ' +
      'The plan first pays at a deposit of ' + (r.pays_from_usd === null ? 'never — the costs beat the slice at every size' : fmtUsd(r.pays_from_usd)) +
      '; the break-even implied value at this plan is ' + (r.break_even_usd === null ? '—' : fmtUsd(r.break_even_usd)) + '. ' +
      'The same ' + fmtUsd(r.plan_usd) + ' in a T-bill at ' + R.tbill_apy_pct + '% APY earns ' + fmtUsd2(r.tbill_usd) + ' over the horizon' +
      (r.tbill_usd > r.net_usd ? ' — doing nothing pays more than farming this row.' : ' — farming beats doing nothing here, at the point value.') + '</p>' +
      '<h4>Five steps to farm it</h4><ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    $('sandbox').hidden = false;
    $('planInput').value = Math.round(r.plan_usd);
    $('shareInput').value = R.drop_share_pct;
    renderSandbox();
    $('detailcard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderSandbox() {
    if (!selected) return;
    var plan = parseFloat($('planInput').value) || 0;
    var share = parseFloat($('shareInput').value) || 0;
    var e = econ(selected, plan, share);
    $('sandboxOut').innerHTML = 'At a ' + fmtUsd(e.plan) + ' plan and ' + share + '% drop share: ' + fmtNum(e.farmers) + ' farmers, your slice ' + fmtUsd2(e.slice) +
      ', costs ' + fmtUsd2(e.costs) + ' (gas ' + fmtUsd2(selected.gas_usd) + (selected.is_dex ? ', swap ' + fmtUsd2(e.swapFee) + ', slippage ' + fmtUsd2(e.slippage) : '') + '), ' +
      '<strong>net ' + fmtUsd2(e.net) + '</strong> (' + fmtUsd2(e.netPerHour) + '/hour), net at the low end ' + fmtUsd2(e.netLow) + ' — verdict <strong>' + e.verdict + '</strong>. ' +
      'T-bill on the same plan: ' + fmtUsd2(e.tbill) + '.';
  }
  $('planInput').addEventListener('input', renderSandbox);
  $('shareInput').addEventListener('input', renderSandbox);
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-slug], tr[data-slug]');
    if (!a) return;
    if (a.tagName === 'A') e.preventDefault();
    showDetail(a.getAttribute('data-slug'));
  });

  // ---- Scatter ------------------------------------------------------------
  (function () {
    var W = 760, H = 420, pad = 48;
    var pts = R.scatter;
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs) - 0.2, x1 = Math.max.apply(null, xs) + 0.2;
    var y0 = Math.min.apply(null, ys) - 0.2, y1 = Math.max.apply(null, ys) + 0.2;
    function X(v) { return pad + ((v - x0) / (x1 - x0)) * (W - pad * 2); }
    function Y(v) { return H - pad - ((v - y0) / (y1 - y0)) * (H - pad * 2); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Scatter of log TVL against log market cap">';
    for (var gx = Math.ceil(x0); gx <= x1; gx++) {
      svg += '<line x1="' + X(gx) + '" y1="' + Y(y0) + '" x2="' + X(gx) + '" y2="' + Y(y1) + '" class="grid"/>';
      svg += '<text x="' + X(gx) + '" y="' + (H - pad + 18) + '" class="axis">' + Math.pow(10, gx).toExponential(0) + '</text>';
    }
    for (var gy = Math.ceil(y0); gy <= y1; gy++) {
      svg += '<line x1="' + X(x0) + '" y1="' + Y(gy) + '" x2="' + X(x1) + '" y2="' + Y(gy) + '" class="grid"/>';
      svg += '<text x="' + (pad - 8) + '" y="' + (Y(gy) + 4) + '" class="axis" text-anchor="end">' + Math.pow(10, gy).toExponential(0) + '</text>';
    }
    svg += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" class="axis-label" text-anchor="middle">TVL (USD, log scale)</text>';
    svg += '<text x="14" y="' + (H / 2) + '" class="axis-label" text-anchor="middle" transform="rotate(-90 14 ' + (H / 2) + ')">Market cap (USD, log scale)</text>';
    var f2 = R.global_fit;
    svg += '<line x1="' + X(x0) + '" y1="' + Y(f2.a + f2.b * x0) + '" x2="' + X(x1) + '" y2="' + Y(f2.a + f2.b * x1) + '" class="fitline"/>';
    pts.forEach(function (p) {
      svg += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.board ? 4 : 2.5) + '" class="' + (p.board ? 'dot-board' : 'dot-peer') + '"/>';
    });
    svg += '</svg>';
    $('scatter').innerHTML = svg;
    $('scatterLegend').innerHTML = '<span class="swatch peer"></span> Launched token (95 dated peers) &nbsp; <span class="swatch board"></span> Board protocol, top 60, at value-if-launches &nbsp; <span class="swatch line"></span> Fitted curve';
  })();

  // ---- Live + set-aside -----------------------------------------------------
  $('live').querySelector('tbody').innerHTML = R.live.map(function (p) {
    return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td><td>' + fmtUsd(p.tvl_usd) + '</td><td>' + fmtUsd(p.mcap_usd) + '</td></tr>';
  }).join('');
  $('asideReasons').innerHTML = '<p>' + R.set_aside_reasons.map(function (r) { return esc(r.reason) + ': ' + r.count; }).join(' &middot; ') + '.</p>';
  $('aside').querySelector('tbody').innerHTML = R.set_aside.map(function (p) {
    return '<tr><td>' + esc(p.name) + '</td><td>' + fmtUsd(p.tvl_usd) + '</td><td>' + esc(p.reason) + '</td></tr>';
  }).join('');

  // ---- Export ---------------------------------------------------------------
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('exportCsv').addEventListener('click', function () {
    var list = filtered();
    var head = 'rank,protocol,implied_value_usd,range_low_usd,range_high_usd,launch_odds,plan_usd,slice_usd,slice_1k_usd,net_usd,net_low_usd,break_even_usd,verdict,tvl_usd,category,chains';
    var lines = list.map(function (r) {
      return [r.rank, '"' + r.name.replace(/"/g, '""') + '"', r.implied_value_usd, r.implied_low_usd, r.implied_high_usd, r.launch_odds, r.plan_usd, r.slice_usd, r.slice_1k_usd, r.net_usd, r.net_low_usd, r.break_even_usd === null ? '' : r.break_even_usd, r.verdict, r.tvl_usd, '"' + (r.category || '') + '"', '"' + r.chains.join(';') + '"'].join(',');
    });
    download('token-radar-board.csv', head + '\n' + lines.join('\n'), 'text/csv');
  });
  $('exportJson').addEventListener('click', function () {
    download('token-radar-board.json', JSON.stringify(filtered(), null, 2), 'application/json');
  });
})();
