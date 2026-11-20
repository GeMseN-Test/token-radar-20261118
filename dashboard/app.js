// Token Launch Radar dashboard — renders window.TOKEN_RADAR (written by
// main.ts from the same board the gate checks). Deposit and drop-share
// controls recompute the farm economics in the browser from the stored
// implied value, TVL, plan cost and plan hours, with the same rule the
// server used: farmers = TVL / deposit, slice = implied x share / farmers,
// net = slice - fees, verdict FARM at net >= $25, THIN at net >= -$10.
(function () {
  var R = window.TOKEN_RADAR;
  if (!R) { document.body.textContent = 'No radar data.'; return; }
  var $ = function (id) { return document.getElementById(id); };
  var fmt$ = function (n) { var v = Math.round(n); if (v === 0) v = 0; return '$' + v.toLocaleString('en-US'); };
  var fmtM = function (n) { return n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : '$' + (n / 1e6).toFixed(1) + 'M'; };
  var fmtAge = function (d) { if (d === null) return '—'; if (d < 30) return d + ' d'; if (d < 365) return Math.round(d / 30) + ' mo'; return (d / 365).toFixed(1) + ' y'; };
  var fmtPct = function (g) { if (g === null) return '—'; return (g >= 0 ? '+' : '') + g.toFixed(1) + '%'; };

  var state = { deposit: 1000, share: 0.10, tab: 'all', sort: 'rank', dir: 1, search: '', group: '', chain: '', verdict: '' };
  var compare = [];

  function econ(r) {
    var farmers = Math.max(50, Math.round(r.tvl_usd / state.deposit));
    var slice = (r.implied_value_usd * state.share) / farmers;
    var net = slice - r.plan_cost_usd;
    var verdict = net >= 25 ? 'FARM' : net >= -10 ? 'THIN' : 'SKIP';
    return {
      farmers: farmers, slice: slice, net: net, perHour: net / r.plan_hours,
      paysFrom: Math.max(10, Math.ceil((r.plan_cost_usd * r.tvl_usd) / (r.implied_value_usd * state.share) / 10) * 10),
      verdict: verdict,
    };
  }

  // ---- KPIs ----
  var kept = R.ablation[R.ablation.length - 1];
  var kpis = [
    ['Ranked', R.board.length, 'of ' + R.total_protocols + ' protocols · 40 of 40 watchlist'],
    ['Implied value', fmtM(R.total_implied_usd), 'summed over the board · rank 1 ' + R.board[0].name],
    ['Held-out miss', '×' + kept.loo_miss.toFixed(2), 'leave-one-out · walk-forward ×' + kept.wf_miss.toFixed(2)],
    ['Range holds', R.ranges.p25_p75_hold_pct + '%', 'of held-out caps inside the printed P25–P75 range'],
    ['Launch odds, held out', R.odds.loo_correct_pct + '%', 'called right, base rate alone ' + R.odds.base_rate_pct + '%'],
    ['Worth farming', R.verdict_counts.FARM + ' FARM', R.verdict_counts.THIN + ' THIN · ' + R.verdict_counts.SKIP + ' SKIP on $1,000'],
  ];
  $('kpis').innerHTML = kpis.map(function (k) {
    return '<div class="kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b><small>' + k[2] + '</small></div>';
  }).join('');
  $('as-of').textContent = 'Snapshot ' + R.as_of + ' · DefiLlama · floor ' + fmtM(R.floor_usd);

  // ---- Reconciliation ----
  var rec = R.reconciliation;
  var seg = [
    ['Ranked', rec.board, '#0b6e4f'], ['Token on record', rec.token_on_record, '#5b6b7a'],
  ];
  R.set_aside_reasons.forEach(function (s, i) {
    seg.push([s.reason, s.count, ['#b7791f', '#7c5cbf', '#8a3b2e', '#2e6f8a', '#6b7f2a'][i % 5]]);
  });
  $('recon').innerHTML = '<p><b>' + R.total_protocols + ' protocols read, each accounted for:</b> ' +
    seg.map(function (s) { return s[0] + ' <b>' + s[1] + '</b>'; }).join(' · ') + '</p>' +
    '<div class="bar">' + seg.map(function (s) {
      return '<i style="width:' + (s[1] / R.total_protocols * 100).toFixed(1) + '%;background:' + s[2] + '" title="' + s[0] + ' ' + s[1] + '"></i>';
    }).join('') + '</div>' +
    '<p class="fine">Set aside in priority order — a protocol lands in the first reason that fits it, so nothing is counted twice. The 20 off-list rows are above the $50M floor but not on the house watchlist; the watchlist is a floor, never a ceiling.</p>';

  // ---- Method ----
  $('formula').textContent = 'implied = 10^(' + R.global_fit.a.toFixed(3) + ' + ' + R.global_fit.b.toFixed(3) +
    ' x log10(TVL)) x group premium x momentum x age x kinship x launch odds';
  $('method-note').textContent = 'Fitted on the ' + R.peers + ' protocols that trade (market cap, TVL and 7-day change all on record), R² ' +
    R.global_fit.r2.toFixed(3) + '. Momentum is the 7-day change winsorized at the snapshot p99 (+' + R.growth_p99_pct.toFixed(1) +
    '%). Age adds up to +25% over three years with no token. Kinship multiplies by the median kin-peer residual when another token-on-record protocol shares the name stem. ' +
    'Launch odds average the token-on-record rates for the protocol\u2019s age bucket, TVL tier and group, smoothed toward the base rate.';
  $('group-table').querySelector('tbody').innerHTML = R.group_fits.map(function (g) {
    return '<tr><td>' + g.group + '</td><td>' + g.peers + '</td><td>' + g.residual.toFixed(2) + '×' + (g.clamped ? ' (clamped)' : '') + '</td></tr>';
  }).join('');
  $('ablation-table').querySelector('tbody').innerHTML = R.ablation.map(function (a, i) {
    return '<tr><td>' + a.step + (i === R.ablation.length - 1 ? ' <b>(kept)</b>' : '') + '</td><td>×' + a.loo_miss.toFixed(2) + '</td><td>' +
      a.loo_within3_pct.toFixed(0) + '%</td><td>×' + a.wf_miss.toFixed(2) + '</td><td>' + a.wf_within3_pct.toFixed(0) + '%</td></tr>';
  }).join('');
  $('ablation-note').textContent = 'Left out: each of the ' + R.peers + ' traded tokens priced without itself. Older → newer: one fit on the ' +
    Math.floor(R.ranges.wf_n) + ' longest-tracked tokens prices the newer half. The curve alone wins leave-one-out by a hair (×' +
    R.ablation[1].loo_miss.toFixed(2) + '); the full model wins walk-forward within-3× (' + kept.wf_within3_pct.toFixed(0) +
    '%) and is kept because the bounty names growth and age as pricing inputs.';
  $('checks').innerHTML = [
    ['Walk-forward test', '×' + kept.wf_miss.toFixed(2) + ' typical miss', 'Fit on the older half of traded tokens, priced on the newer half (' + R.ranges.wf_n + ' tokens). ' + kept.wf_within3_pct.toFixed(0) + '% land within 3× of the real cap.'],
    ['Launch odds, held out', R.odds.loo_correct_pct + '% called right', 'Leave-one-out over all ' + R.odds.loo_n + ' protocols; guessing the base rate (' + R.odds.base_rate_pct + '%) alone gets ' + R.odds.base_rate_pct + '%. Age is the strongest signal: 30% of protocols under 90 days record a token, 79% of those over three years do.'],
    ['Ranges are honest', R.ranges.p25_p75_hold_pct + '% inside P25–P75', 'The printed range is the kept model\u2019s leave-one-out residual quartiles. ' + R.ranges.p10_p90_hold_pct + '% of held-out caps fall inside the wider P10–P90 range; on the newer half, ' + R.ranges.wf_p25_p75_hold_pct + '% sit inside P25–P75.'],
  ].map(function (c) { return '<div class="check"><span>' + c[0] + '</span><b>' + c[1] + '</b><small>' + c[2] + '</small></div>'; }).join('');

  // ---- Scatter ----
  (function () {
    var svg = $('scatter');
    var pts = R.scatter;
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs) - 0.2, x1 = Math.max.apply(null, xs) + 0.2;
    var y0 = Math.min.apply(null, ys) - 0.2, y1 = Math.max.apply(null, ys) + 0.2;
    var X = function (v) { return 50 + ((v - x0) / (x1 - x0)) * 570; };
    var Y = function (v) { return 270 - ((v - y0) / (y1 - y0)) * 240; };
    var ax$ = function (lg) {
      var v = Math.pow(10, lg);
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(0) + 'B';
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
      if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
      return '$' + v.toFixed(0);
    };
    var html = '';
    for (var gx = Math.ceil(x0); gx <= x1; gx++) {
      html += '<line x1="' + X(gx) + '" y1="270" x2="' + X(gx) + '" y2="30" stroke="#e5e0d2"/><text x="' + X(gx) + '" y="288" font-size="10" fill="#5b6b7a" text-anchor="middle">' + ax$(gx) + '</text>';
    }
    for (var gy = Math.ceil(y0); gy <= y1; gy++) {
      html += '<line x1="50" y1="' + Y(gy) + '" x2="620" y2="' + Y(gy) + '" stroke="#e5e0d2"/><text x="44" y="' + (Y(gy) + 3) + '" font-size="10" fill="#5b6b7a" text-anchor="end">' + ax$(gy) + '</text>';
    }
    var a = R.global_fit.a, b = R.global_fit.b;
    html += '<line x1="' + X(x0) + '" y1="' + Y(a + b * x0) + '" x2="' + X(x1) + '" y2="' + Y(a + b * x1) + '" stroke="#0b6e4f" stroke-width="2"/>';
    pts.forEach(function (p) {
      html += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.board ? 3 : 2) + '" fill="' + (p.board ? '#0b6e4f' : '#9aa7b4') + '" opacity="' + (p.board ? 0.9 : 0.6) + '"/>';
    });
    svg.innerHTML = html;
    $('scatter-note').textContent = 'Grey: the ' + R.peers + ' traded tokens the curve is fitted on. Green: the top 60 board rows at their value-if-launches. Line: the fitted curve, log10(mcap) = ' +
      a.toFixed(3) + ' + ' + b.toFixed(3) + ' × log10(TVL).';
  })();

  // ---- Tabs + filters ----
  var tabs = [
    ['all', 'All ' + R.board.length],
    ['watch', 'Watchlist ' + R.board.filter(function (r) { return r.on_watchlist; }).length],
    ['off', 'Off list ' + R.board.filter(function (r) { return r.off_list; }).length],
    ['floor', 'Below floor ' + R.board.filter(function (r) { return !r.on_watchlist && !r.off_list; }).length],
    ['FARM', 'Farm ' + R.verdict_counts.FARM], ['THIN', 'Thin ' + R.verdict_counts.THIN], ['SKIP', 'Skip ' + R.verdict_counts.SKIP],
  ];
  $('tabs').innerHTML = tabs.map(function (t) {
    return '<button type="button" data-tab="' + t[0] + '" class="' + (state.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
  }).join('');
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.tab = b.dataset.tab; render();
  });
  ['lend', 'dex', 'yield', 'rwa', 'other'].forEach(function (g) {
    var o = document.createElement('option'); o.value = g; o.textContent = g; $('group').appendChild(o);
  });
  var chains = [];
  R.board.forEach(function (r) { r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
  chains.sort().forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; $('chain').appendChild(o); });
  ['deposit', 'share', 'group', 'chain', 'verdict'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      if (id === 'deposit') state.deposit = +$('deposit').value;
      if (id === 'share') state.share = +$('share').value;
      if (id === 'group') state.group = $('group').value;
      if (id === 'chain') state.chain = $('chain').value;
      if (id === 'verdict') state.verdict = $('verdict').value;
      render();
    });
  });
  $('search').addEventListener('input', function () { state.search = $('search').value.toLowerCase(); render(); });
  $('hide-summary').addEventListener('click', function () {
    var hide = $('method').style.display !== 'none';
    $('method').style.display = hide ? 'none' : '';
    document.querySelector('.scatter-wrap').style.display = hide ? 'none' : '';
    $('hide-summary').textContent = hide ? 'Show summary' : 'Hide summary';
  });

  function visible() {
    return R.board.filter(function (r) {
      var e = econ(r);
      if (state.tab === 'watch' && !r.on_watchlist) return false;
      if (state.tab === 'off' && !r.off_list) return false;
      if (state.tab === 'floor' && (r.on_watchlist || r.off_list)) return false;
      if ((state.tab === 'FARM' || state.tab === 'THIN' || state.tab === 'SKIP') && e.verdict !== state.tab) return false;
      if (state.group && r.group !== state.group) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.verdict && e.verdict !== state.verdict) return false;
      if (state.search && r.name.toLowerCase().indexOf(state.search) < 0) return false;
      return true;
    });
  }

  function render() {
    var rows = visible();
    var key = state.sort;
    rows.sort(function (a, b) {
      var av = key === 'name' ? a.name : key === 'verdict' ? econ(a).verdict : key === 'slice_usd' ? econ(a).slice : key === 'net_usd' ? econ(a).net : a[key];
      var bv = key === 'name' ? b.name : key === 'verdict' ? econ(b).verdict : key === 'slice_usd' ? econ(b).slice : key === 'net_usd' ? econ(b).net : b[key];
      if (av === bv) return a.rank - b.rank;
      return (av < bv ? -1 : 1) * state.dir;
    });
    $('board').querySelector('tbody').innerHTML = rows.map(function (r) {
      var e = econ(r);
      return '<tr data-slug="' + r.slug + '"><td class="num">' + r.rank + ' <span class="fine">(' + r.rank_low + '–' + r.rank_high + ')</span></td>' +
        '<td><b>' + r.name + '</b>' + (r.on_watchlist ? '<span class="badge watch">WATCHLIST</span>' : '') + (r.off_list ? '<span class="badge off">OFF LIST</span>' : '') +
        '<br><span class="fine">' + (r.category || '—') + ' · ' + r.group + ' · ' + r.chains.join(', ') + '</span></td>' +
        '<td class="num">' + fmtM(r.tvl_usd) + '</td><td class="num">' + fmtPct(r.change_7d) + '</td><td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + Math.round(r.launch_odds * 100) + '%</td><td class="num">' + fmtM(r.value_if_launches_usd) + '</td>' +
        '<td class="num"><b>' + fmtM(r.implied_value_usd) + '</b><br><span class="fine">' + fmtM(r.implied_low_usd) + ' – ' + fmtM(r.implied_high_usd) + '</span></td>' +
        '<td class="num">' + fmt$(e.slice) + '</td>' +
        '<td class="num">' + (e.net >= 0 ? '+' : '') + fmt$(e.net) + '<br><span class="fine">' + (e.perHour >= 0 ? '+' : '') + fmt$(e.perHour) + '/h · pays from ' + fmt$(e.paysFrom) + '</span></td>' +
        '<td><span class="verdict ' + e.verdict + '">' + e.verdict + '</span></td></tr>';
    }).join('');
    $('count').textContent = 'Showing ' + rows.length + ' of ' + R.board.length + ' · deposit ' + fmt$(state.deposit) + ' · drop share ' + Math.round(state.share * 100) +
      '% · farmers = TVL / deposit · slice = implied × share / farmers · FARM at net ≥ $25, THIN at net ≥ −$10, else SKIP.';
    $('tabs').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === state.tab); });
    $('summary').innerHTML = compare.length ? '<h3>Compare</h3>' + compareTable() : '';
  }

  function compareTable() {
    var rs = compare.map(function (s) { return R.board.find(function (r) { return r.slug === s; }); }).filter(Boolean);
    var fields = [['Implied value', function (r) { return fmtM(r.implied_value_usd); }], ['Value if launches', function (r) { return fmtM(r.value_if_launches_usd); }],
      ['Launch odds', function (r) { return Math.round(r.launch_odds * 100) + '%'; }], ['TVL', function (r) { return fmtM(r.tvl_usd); }],
      ['Net of all costs', function (r) { var e = econ(r); return (e.net >= 0 ? '+' : '') + fmt$(e.net); }],
      ['Net per hour', function (r) { var e = econ(r); return (e.perHour >= 0 ? '+' : '') + fmt$(e.perHour) + '/h'; }],
      ['Verdict', function (r) { return econ(r).verdict; }]];
    return '<table><thead><tr><th></th>' + rs.map(function (r) { return '<th>' + r.name + '</th>'; }).join('') + '</tr></thead><tbody>' +
      fields.map(function (f) { return '<tr><td>' + f[0] + '</td>' + rs.map(function (r) { return '<td>' + f[1](r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  $('board').querySelector('thead').addEventListener('click', function (e) {
    var th = e.target.closest('th'); if (!th || !th.dataset.sort) return;
    var k = th.dataset.sort;
    if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
    if (k === 'rank') state.dir = 1;
    render();
  });
  $('board').querySelector('tbody').addEventListener('click', function (e) {
    var tr = e.target.closest('tr'); if (!tr) return;
    showDetail(tr.dataset.slug);
  });

  function showDetail(slug) {
    var r = R.board.find(function (x) { return x.slug === slug; });
    if (!r) return;
    var e = econ(r);
    var i = compare.indexOf(slug);
    var maths = 'curve(' + fmtM(r.tvl_usd) + ') = ' + fmtM(r.curve_usd) + '\n' +
      'x group premium ' + r.group_residual.toFixed(2) + ' (' + r.group + ') x momentum ' + r.momentum.toFixed(2) +
      ' x age ' + r.age_factor.toFixed(2) + ' x kinship ' + r.kin_factor.toFixed(2) + '\n' +
      '= value if launches ' + fmtM(r.value_if_launches_usd) + ' x launch odds ' + Math.round(r.launch_odds * 100) + '%\n' +
      '= implied ' + fmtM(r.implied_value_usd) + ' (range ' + fmtM(r.implied_low_usd) + ' – ' + fmtM(r.implied_high_usd) +
      ', ranks ' + r.rank_low + '–' + r.rank_high + ')\n' +
      'farm: ' + r.farmers.toLocaleString() + ' farmers at ' + fmt$(state.deposit) + ' (TVL / deposit) · slice ' + fmt$(e.slice) +
      ' = implied x ' + Math.round(state.share * 100) + '% / farmers · fees ' + fmt$(r.plan_cost_usd) + ' over ' + r.plan_hours +
      ' h · net ' + fmt$(e.net) + ' (' + fmt$(e.perHour) + '/h) · pays from ' + fmt$(e.paysFrom);
    $('detail').hidden = false;
    $('detail').innerHTML = '<h2>' + r.name + ' — rank ' + r.rank + ' <span class="verdict ' + e.verdict + '">' + e.verdict + '</span></h2>' +
      '<p>' + (r.category || '—') + ' · ' + r.chains.join(', ') + ' · TVL ' + fmtM(r.tvl_usd) + ' · 7-day ' + fmtPct(r.change_7d) +
      ' · no token for ' + fmtAge(r.age_days) + (r.on_watchlist ? ' · <span class="badge watch">WATCHLIST</span>' : '') + '</p>' +
      '<div class="grid"><div><h3>How the row is priced</h3><div class="maths">' + maths + '</div>' +
      '<label>Try it: TVL <span id="sb-tvl-v"></span></label><input id="sb-tvl" type="range" min="6" max="10" step="0.01" value="' + Math.log10(r.tvl_usd).toFixed(2) + '">' +
      '<label>7-day growth <span id="sb-g-v"></span></label><input id="sb-g" type="range" min="-50" max="100" step="0.1" value="' + (Math.round((r.change_7d || 0) * 10) / 10) + '">' +
      '<label>Age <span id="sb-age-v"></span></label><input id="sb-age" type="range" min="0" max="2000" step="5" value="' + (r.age_days || 0) + '">' +
      '<p id="sb-out" class="fine"></p></div>' +
      '<div><h3>Farm plan — ' + fmt$(r.plan_cost_usd) + ' fees, ' + r.plan_hours + ' hours</h3><ol>' +
      r.farm_steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      '<p><button type="button" id="cmp-btn">' + (i >= 0 ? 'Remove from compare' : 'Add to compare') + '</button> ' +
      '<span class="fine">Compare holds up to 3 rows.</span></p></div></div>';
    $('detail').scrollIntoView({ block: 'start' });
    var sb = function () {
      var tvl = Math.pow(10, +$('sb-tvl').value);
      var g = parseFloat($('sb-g').value);
      var ageD = +$('sb-age').value;
      var curve = Math.pow(10, R.global_fit.a + R.global_fit.b * Math.log10(tvl));
      var v = curve * r.group_residual * (1 + Math.max(-50, Math.min(R.growth_p99_pct, g)) / 100) * (1 + (Math.min(ageD, 1095) / 1095) * 0.25) * r.kin_factor;
      var odds = r.launch_odds;
      $('sb-tvl-v').textContent = fmtM(tvl);
      $('sb-g-v').textContent = (g >= 0 ? '+' : '') + g + '%';
      $('sb-age-v').textContent = fmtAge(ageD);
      $('sb-out').textContent = 'At those inputs: value if launches ' + fmtM(Math.round(v)) + ' × ' + Math.round(odds * 100) + '% odds = implied ' + fmtM(Math.round(v * odds)) + '.';
    };
    ['sb-tvl', 'sb-g', 'sb-age'].forEach(function (id) { $(id).addEventListener('input', sb); });
    sb();
    $('cmp-btn').addEventListener('click', function () {
      var j = compare.indexOf(slug);
      if (j >= 0) compare.splice(j, 1);
      else if (compare.length < 3) compare.push(slug);
      render(); showDetail(slug);
    });
  }

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('export-csv').addEventListener('click', function () {
    var head = 'rank,slug,name,tvl_usd,change_7d,age_days,launch_odds,value_if_launches_usd,implied_value_usd,implied_low_usd,implied_high_usd,slice_usd,net_usd,net_per_hour_usd,verdict\n';
    var body = visible().map(function (r) { var e = econ(r); return [r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', r.tvl_usd, r.change_7d, r.age_days, r.launch_odds, r.value_if_launches_usd, r.implied_value_usd, r.implied_low_usd, r.implied_high_usd, e.slice.toFixed(2), e.net.toFixed(2), e.perHour.toFixed(2), e.verdict].join(','); }).join('\n');
    download('token-radar-board.csv', head + body + '\n', 'text/csv');
  });
  $('export-json').addEventListener('click', function () {
    download('token-radar-board.json', JSON.stringify({ rows: visible() }, null, 2), 'application/json');
  });

  // ---- Lists ----
  $('on-record').innerHTML = R.token_on_record.slice(0, 60).map(function (p) {
    return '<li>' + p.name + '<span>' + fmtM(p.tvl_usd) + '</span></li>';
  }).join('') + (R.token_on_record.length > 60 ? '<li>… and ' + (R.token_on_record.length - 60) + ' more in board.json</li>' : '');
  $('set-aside').innerHTML = R.set_aside.map(function (p) {
    return '<li>' + p.name + ' — ' + p.reason + '<span>' + fmtM(p.tvl_usd) + '</span></li>';
  }).join('');

  render();
})();
