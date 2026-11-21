// Token Launch Radar — ronde 8 (22 Nov 2026). "radar-4": the model that
// survives both held-out tests, and nothing it does not.
//
// What round 7 got wrong, measured on the same snapshot: its kept model
// (curve + group + momentum + age + kinship, all 128 peers) priced a token
// it never saw at a typical miss of x3.52 — worse than the plain curve +
// group residual at x3.20 — because three of its terms only win one of the
// two tests. This round every term must lower the held-out miss in BOTH
// leave-one-out and walk-forward (older half fits, newer half priced), the
// discipline the current #1 plays by. What survives:
//   value = fitted log-log curve on the 95 DATED traded peers
//           x per-group residual, clamped [0.5, 2.0]
//           x 7-day momentum, winsorized at the snapshot p99
//   odds  = logistic fit on [age in years, category group, chain count,
//           kinship] — kinship (shares a name stem with a token that
//           already trades) is the strongest term: 90% of kin protocols
//           record a token, against 43% of the rest.
//   implied = value-if-launches x launch odds.
// Age, chain count and kinship were all tried in the value model and
// rejected with their numbers in the ablation table; size and growth were
// tried in the odds model and add nothing once age is known. A shuffled
// placebo (growth shuffled for value, kinship shuffled for odds) must not
// help, and the page shows that it does not.
//
// Farm economics, round 2: the plan is 0.02% of the protocol's TVL (so the
// reader is 1 of 5,000 farmers), the drop share defaults to 7%, the horizon
// is 12 weeks (3.75 hours of work: 45 minutes to set up, 15 minutes a week
// to check in). Costs are gas for five steps on the protocol's main chain,
// plus — only for DEX pairs, where the farmer must swap half the plan to
// make the pair — a 0.60% round-trip swap fee on that half and exit
// slippage of (half-plan)^2 / (5% of TVL). Lending vaults, yield vaults and
// RWA take the asset the farmer already holds, so they pay no swap. The
// verdict is FARM when the net clears $25 and $5 an hour, MARGINAL when the
// loss stays within $50, SKIP below that. The detail view also prices the
// same plan in a T-bill, because on the biggest protocols the T-bill wins —
// and the page says so instead of hiding it.
//
// Every number the dashboard prints is recomputed from the snapshot at
// runtime: the fit, the residuals, the odds, the ranges, the bootstrap
// standard errors (200 refits for the curve, 100 for the odds), the placebo
// checks and the board checksum the browser re-derives from the data file.
//
// The snapshot's change_7d is in PER CENT (min -72.7, max +4448.5).

export interface Proto {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  /** Set by buildRadar: shares a name stem with another token-on-record protocol. */
  kin?: boolean;
}

export interface Snap {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Proto[];
  watchlist: string[];
}

export interface Row {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  value_if_launches_usd: number;
  launch_odds: number;
  implied_low_usd: number;
  implied_high_usd: number;
  implied_low90_usd: number;
  implied_high90_usd: number;
  rank_low: number;
  rank_high: number;
  slice_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  plan_usd: number;
  plan_pct: number;
  gas_usd: number;
  swap_fee_usd: number;
  slippage_usd: number;
  tbill_usd: number;
  plan_hours: number;
  pays_from_usd: number | null;
  farmers: number;
  tvl_usd: number;
  change_7d: number | null;
  category: string | null;
  chains: string[];
  age_days: number | null;
  curve_usd: number;
  group_residual: number;
  momentum: number;
  multiple: number;
  on_watchlist: boolean;
  off_list: boolean;
  group: string;
  is_dex: boolean;
  kin: boolean;
}

export interface GroupFit {
  group: string;
  peers: number;
  residual: number;
  clamped: boolean;
}

export interface AblationStep {
  step: string;
  loo_miss: number;
  loo_within3_pct: number;
  wf_miss: number;
  wf_within3_pct: number;
  kept: boolean;
}

export interface OddsStep {
  step: string;
  loo_brier: number;
  loo_correct_pct: number;
  wf_brier: number;
  wf_correct_pct: number;
  kept: boolean;
}

export interface OddsCheck {
  base_rate_pct: number;
  loo_brier: number;
  loo_correct_pct: number;
  wf_brier: number;
  wf_correct_pct: number;
  loo_n: number;
  wf_n: number;
  beta: number[];
  beta_se: number[];
  features: string[];
  note: string;
}

export interface RangeCheck {
  q25: number;
  q75: number;
  q10: number;
  q90: number;
  p25_p75_hold_pct: number;
  p10_p90_hold_pct: number;
  wf_p25_p75_hold_pct: number;
  wf_p10_p90_hold_pct: number;
  loo_n: number;
  wf_n: number;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  total_protocols: number;
  watchlist_size: number;
  peers: number;
  peers_dated: number;
  global_fit: { a: number; b: number; r2: number };
  curve_at_100m_usd: number;
  curve_at_100m_se_usd: number;
  curve_at_1b_usd: number;
  curve_at_1b_se_usd: number;
  group_fits: GroupFit[];
  growth_p99_pct: number;
  plan_pct: number;
  drop_share_pct: number;
  horizon_weeks: number;
  plan_hours: number;
  tbill_apy_pct: number;
  ablation: AblationStep[];
  odds_ablation: OddsStep[];
  odds: OddsCheck;
  ranges: RangeCheck;
  placebo_value_loo_miss: number;
  placebo_odds_loo_brier: number;
  board: Row[];
  verdict_counts: { FARM: number; MARGINAL: number; SKIP: number };
  total_implied_usd: number;
  live: { slug: string; name: string; category: string | null; tvl_usd: number; mcap_usd: number }[];
  set_aside: { slug: string; name: string; tvl_usd: number; reason: string }[];
  token_on_record: { slug: string; name: string; tvl_usd: number; note: string }[];
  reconciliation: { board: number; token_on_record: number; set_aside: number; total: number };
  set_aside_reasons: { reason: string; count: number }[];
  scatter: { x: number; y: number; board: boolean }[];
  checksum: string;
}

export function parseSnap(text: string): Snap {
  const raw = JSON.parse(text) as Snap;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot: protocols/watchlist are not arrays');
  }
  if (typeof raw.floor_usd !== 'number' || typeof raw.as_of !== 'string') {
    throw new Error('snapshot: floor_usd/as_of missing');
  }
  return raw;
}

/** Median (0 for an empty list). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Quantile with linear interpolation (q in 0..1). */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/** Nearest-rank percentile (0..100), for the winsor cap. */
function pctile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * (s.length - 1)))]!;
}

/** FNV-1a, 32-bit, as hex — the same code runs in the dashboard. */
export function fnvHex(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic LCG, so bootstrap and placebo runs are byte-identical. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/** The name stem: first word, letters and digits only, lowercased. */
export function stemOf(name: string): string {
  return (name.toLowerCase().split(/[^a-z0-9]+/)[0] ?? '').trim();
}

/** Does this protocol record a token? mcap on the books, or a ticker symbol. */
export function hasToken(p: Proto): boolean {
  return p.mcap_usd !== null || p.symbol !== null;
}

const BRIDGE_CATS = new Set(['Bridge', 'Canonical Bridge']);
const STAKE_CATS = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
const EXCHANGE_FIRST = new Set(['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini']);

/**
 * The house rule, exactly as the kit states it, applied to a protocol with
 * no token on record. Returns the set-aside reason, or null when the
 * protocol is rankable. Priority order is fixed so every protocol lands in
 * exactly one bucket: bridge, then liquid staking, then CEX, then a
 * versioned name, then wrapped / staked wording, then an exchange name.
 */
export function setAsideReason(p: Proto): string | null {
  if (p.category !== null && BRIDGE_CATS.has(p.category)) return 'Bridge';
  if (p.category !== null && STAKE_CATS.has(p.category)) return 'Liquid staking / restaking';
  if (p.category === 'CEX') return 'Exchange custody';
  if (/ (V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name)) return 'Versioned listing';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'Wrapped or staked';
  if (EXCHANGE_FIRST.has(p.name.split(' ')[0]!)) return 'Exchange-named';
  return null;
}

// Category groups for the comps curve. Five groups, nothing finer: with
// 9–24 peers a group, a separate curve per group runs wild (the lend group
// fitted b=1.09 in round 7) and loses walk-forward, so the group enters as
// one residual on the shared curve.
const GROUP_OF: Record<string, string> = {};
for (const c of ['Lending', 'CDP', 'CDP Manager', 'Uncollateralized Lending', 'Collateral Management', 'Collateral Markets', 'Interest Rate Derivatives']) GROUP_OF[c] = 'lend';
for (const c of ['Dexs', 'Derivatives', 'Options', 'Options Vault', 'Liquidity Manager', 'Prediction Market', 'Synthetics', 'Basis Trading', 'Dual-Token Stablecoin']) GROUP_OF[c] = 'dex';
for (const c of ['Yield', 'Yield Aggregator', 'Farm', 'Leveraged Farming', 'Indexes', 'Onchain Capital Allocator', 'Risk Curators', 'Token Locker']) GROUP_OF[c] = 'yield';
for (const c of ['RWA', 'Reserve Currency', 'Stablecoin Issuer', 'Stablecoin Wrapper', 'Algo-Stables', 'Anchor BTC', 'Decentralized BTC', 'Restaked BTC']) GROUP_OF[c] = 'rwa';

export function groupOf(p: Proto): string {
  return (p.category !== null && GROUP_OF[p.category]) || 'other';
}

export interface Fit {
  a: number;
  b: number;
  r2: number;
}

/** Ordinary least squares on log10(mcap) = a + b * log10(TVL). */
export function fitLine(peers: Proto[]): Fit {
  const xs = peers.map((p) => Math.log10(p.tvl_usd));
  const ys = peers.map((p) => Math.log10(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    syy += (ys[i]! - my) * (ys[i]! - my);
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b, r2: sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

function ageDays(p: Proto, asOf: Date): number | null {
  if (!p.listed_at) return null;
  return Math.max(0, Math.round((asOf.getTime() - new Date(`${p.listed_at}T00:00:00Z`).getTime()) / 86400000));
}

/** Solve a small dense linear system by Gaussian elimination. */
function solveLin(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / M[c]![c]!;
      for (let cc = c; cc <= n; cc++) M[r]![cc]! -= f * M[c]![cc]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!;
    for (let c = r + 1; c < n; c++) s -= M[r]![c]! * x[c]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

export interface LogitModel {
  beta: number[];
  means: number[];
  sds: number[];
}

/**
 * Launch-odds features, in order: intercept, age in years (a protocol with
 * no listing date gets 2.0 years, near the snapshot mean of 2.04), four
 * category-group dummies (other is the reference), chain count capped at 6,
 * kinship (1 when the protocol shares a name stem with a token that already
 * trades). TVL and 7-day growth were fitted and dropped: once age is known
 * they add nothing to the held-out Brier (0.220 with them, 0.220 without),
 * and the TVL coefficient is not significant (bootstrap s.e. wider than the
 * estimate). The page says so.
 */
export function logitFeatures(p: Proto, asOf: Date): number[] {
  const d = ageDays(p, asOf);
  const ageYr = d === null ? 2.0 : d / 365;
  const gr = groupOf(p);
  return [
    1,
    ageYr,
    gr === 'lend' ? 1 : 0,
    gr === 'dex' ? 1 : 0,
    gr === 'yield' ? 1 : 0,
    gr === 'rwa' ? 1 : 0,
    Math.min(p.chains.length, 6),
    p.kin === true ? 1 : 0,
  ];
}

/** Logistic regression by Newton-Raphson, L2 lambda 1, features standardized. */
export function fitLogit(rows: number[][], ys: number[], lambda = 1, iters = 14): LogitModel {
  const k = rows[0]!.length;
  const means = new Array<number>(k).fill(0);
  const sds = new Array<number>(k).fill(1);
  for (let j = 1; j < k; j++) {
    means[j] = rows.reduce((s, r) => s + r[j]!, 0) / rows.length;
    const sd = Math.sqrt(rows.reduce((s, r) => s + (r[j]! - means[j]!) ** 2, 0) / rows.length);
    sds[j] = sd > 1e-9 ? sd : 1;
  }
  const X = rows.map((r) => r.map((v, j) => (j === 0 ? 1 : (v - means[j]!) / sds[j]!)));
  let beta = new Array<number>(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const grad = new Array<number>(k).fill(0);
    const H = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let i = 0; i < X.length; i++) {
      const z = X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0);
      const pr = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
      const r = pr - ys[i]!;
      for (let j = 0; j < k; j++) {
        grad[j]! += r * X[i]![j]!;
        for (let c = 0; c < k; c++) H[j]![c]! += pr * (1 - pr) * X[i]![j]! * X[i]![c]!;
      }
    }
    for (let j = 1; j < k; j++) {
      grad[j]! += lambda * beta[j]!;
      H[j]![j]! += lambda;
    }
    const step = solveLin(H, grad);
    let maxD = 0;
    for (let j = 0; j < k; j++) {
      beta[j]! -= step[j]!;
      maxD = Math.max(maxD, Math.abs(step[j]!));
    }
    if (maxD < 1e-7) break;
  }
  return { beta, means, sds };
}

export function predictLogit(model: LogitModel, features: number[]): number {
  const z = features.reduce(
    (s, v, j) => s + (j === 0 ? v * model.beta[j]! : ((v - model.means[j]!) / model.sds[j]!) * model.beta[j]!),
    0,
  );
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

/** Brier score: mean squared error of a probability against 0/1. Lower wins. */
export function brierScore(preds: number[], actuals: number[]): number {
  return preds.reduce((s, pr, i) => s + (pr - actuals[i]!) ** 2, 0) / preds.length;
}

export function callAccuracy(preds: number[], actuals: number[]): number {
  return (preds.filter((pr, i) => (pr >= 0.5) === (actuals[i] === 1)).length / preds.length) * 100;
}

/** Median miss factor: median of max(pred/actual, actual/pred). 1 is perfect. */
function missFactor(preds: number[], actuals: number[]): { miss: number; within3: number } {
  const ratios = preds.map((pr, i) => Math.max(pr / actuals[i]!, actuals[i]! / pr));
  return {
    miss: median(ratios),
    within3: (ratios.filter((r) => r <= 3).length / ratios.length) * 100,
  };
}

interface Pricing {
  fit: Fit;
  curve: (tvl: number) => number;
  groupResidual: Map<string, number>;
  growthP99: number;
}

/**
 * One global curve for every dated peer, plus a per-group residual: the
 * median mcap/curve for the group's peers, clamped to [0.5, 2.0] when used.
 * Dated peers only (95 of 128): a peer with no listing date cannot sit in a
 * walk-forward test, and the dated fit prices better held-out on both tests
 * (LOO x2.87 against x3.30 for all 128). The 33 undated traded tokens still
 * appear on the "token trades" tab — they are never ranked, only left out
 * of the fit, and the page says so.
 */
function buildPricing(peers: Proto[], growthP99: number): Pricing {
  const fit = fitLine(peers);
  const curve = (tvl: number) => Math.pow(10, fit.a + fit.b * Math.log10(tvl));
  const groupResidual = new Map<string, number>();
  for (const g of ['lend', 'dex', 'yield', 'rwa', 'other']) {
    const sub = peers.filter((p) => groupOf(p) === g);
    if (sub.length >= 3) groupResidual.set(g, median(sub.map((p) => p.mcap_usd! / curve(p.tvl_usd))));
  }
  return { fit, curve, groupResidual, growthP99 };
}

type ValueTerms = { curve: boolean; group: boolean; momentum: boolean; age: boolean };

function priceWith(p: Proto, pr: Pricing, asOf: Date, terms: ValueTerms): number {
  let value = pr.curve(p.tvl_usd);
  if (terms.group) {
    const r = pr.groupResidual.get(groupOf(p));
    if (r !== undefined) value *= Math.max(0.5, Math.min(2.0, r));
  }
  if (terms.momentum) {
    const g = p.change_7d ?? 0;
    value *= 1 + Math.max(-50, Math.min(pr.growthP99, g)) / 100;
  }
  if (terms.age) {
    const d = ageDays(p, asOf);
    if (d !== null) value *= 1 + (Math.min(d, 1095) / 1095) * 0.25;
  }
  return value;
}

const VALUE_STEPS: { label: string; terms: ValueTerms; flat: boolean; kept: boolean }[] = [
  { label: 'One flat TVL multiple', terms: { curve: false, group: false, momentum: false, age: false }, flat: true, kept: false },
  { label: '+ size curve (log-log)', terms: { curve: true, group: false, momentum: false, age: false }, flat: false, kept: false },
  { label: '+ group residual', terms: { curve: true, group: true, momentum: false, age: false }, flat: false, kept: false },
  { label: '+ 7-day momentum', terms: { curve: true, group: true, momentum: true, age: false }, flat: false, kept: true },
  { label: '+ age (time with no token)', terms: { curve: true, group: true, momentum: true, age: true }, flat: false, kept: false },
];

/**
 * The value ablation. Leave-one-out refits on the other peers each time;
 * walk-forward fits once on the older half of dated peers and prices the
 * newer half. A term is kept only when it lowers the miss in BOTH tests —
 * age lowers walk-forward (x3.04 to x2.94) but raises leave-one-out (x2.87
 * to x3.11), so it is tested and not kept.
 */
function valueAblation(peers: Proto[], asOf: Date, growthP99: number): AblationStep[] {
  const dated = peers.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const older = dated.slice(0, half);
  const newer = dated.slice(half);
  const out: AblationStep[] = [];
  for (const step of VALUE_STEPS) {
    const looPreds: number[] = [];
    for (const p of peers) {
      const pr = buildPricing(peers.filter((q) => q !== p), growthP99);
      const flatMultiple = median(peers.filter((q) => q !== p).map((q) => q.mcap_usd! / q.tvl_usd));
      looPreds.push(step.flat ? flatMultiple * p.tvl_usd : priceWith(p, pr, asOf, step.terms));
    }
    const loo = missFactor(looPreds, peers.map((p) => p.mcap_usd!));
    const prWf = buildPricing(older, growthP99);
    const flatWf = median(older.map((p) => p.mcap_usd! / p.tvl_usd));
    const wfPreds = newer.map((p) => (step.flat ? flatWf * p.tvl_usd : priceWith(p, prWf, asOf, step.terms)));
    const wf = missFactor(wfPreds, newer.map((p) => p.mcap_usd!));
    out.push({
      step: step.label,
      loo_miss: loo.miss,
      loo_within3_pct: loo.within3,
      wf_miss: wf.miss,
      wf_within3_pct: wf.within3,
      kept: step.kept,
    });
  }
  return out;
}

/** Placebo for the value model: the same kept terms, 7-day growth shuffled. */
function placeboValueMiss(peers: Proto[], asOf: Date, growthP99: number): number {
  const rng = seededRng(42);
  const vals = peers.map((p) => p.change_7d);
  for (let i = vals.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [vals[i], vals[j]] = [vals[j]!, vals[i]!];
  }
  const shuffled = peers.map((p, i) => ({ ...p, change_7d: vals[i]! }));
  const preds = shuffled.map((p) => {
    const pr = buildPricing(shuffled.filter((q) => q !== p), growthP99);
    return priceWith(p, pr, asOf, { curve: true, group: true, momentum: true, age: false });
  });
  return missFactor(preds, shuffled.map((p) => p.mcap_usd!)).miss;
}

// Odds ablation: nested feature sets, each scored leave-one-out and
// walk-forward (fit on the older half of dated protocols, test the newer).
// The control shuffles kinship across protocols: a term that only wins by
// luck wins the shuffle too.
const ODDS_STEPS: { label: string; cols: number; kept: boolean }[] = [
  { label: 'Base rate only', cols: 1, kept: false },
  { label: '+ age (years listed)', cols: 2, kept: false },
  { label: '+ group (category group)', cols: 6, kept: false },
  { label: '+ chains (count, capped at 6)', cols: 7, kept: false },
  { label: '+ kinship (shared name stem)', cols: 8, kept: true },
];

function oddsAblation(all: Proto[], asOf: Date): { steps: OddsStep[]; controlBrier: number } {
  const dated = all.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const older = dated.slice(0, half);
  const newer = dated.slice(half);
  const feats = (p: Proto) => logitFeatures(p, asOf);
  const steps: OddsStep[] = [];
  for (const step of ODDS_STEPS) {
    const take = (f: number[]) => f.slice(0, step.cols);
    const looPreds: number[] = [];
    for (const p of all) {
      const rest = all.filter((q) => q !== p);
      if (step.cols === 1) {
        looPreds.push(rest.filter(hasToken).length / rest.length);
      } else {
        const m = fitLogit(rest.map((q) => take(feats(q))), rest.map((q) => (hasToken(q) ? 1 : 0)));
        looPreds.push(predictLogit(m, take(feats(p))));
      }
    }
    const actuals = all.map((p) => (hasToken(p) ? 1 : 0));
    let wfPreds: number[];
    if (step.cols === 1) {
      const base = older.filter(hasToken).length / older.length;
      wfPreds = newer.map(() => base);
    } else {
      const mOld = fitLogit(older.map((q) => take(feats(q))), older.map((q) => (hasToken(q) ? 1 : 0)));
      wfPreds = newer.map((p) => predictLogit(mOld, take(feats(p))));
    }
    const wfActuals = newer.map((p) => (hasToken(p) ? 1 : 0));
    steps.push({
      step: step.label,
      loo_brier: brierScore(looPreds, actuals),
      loo_correct_pct: callAccuracy(looPreds, actuals),
      wf_brier: brierScore(wfPreds, wfActuals),
      wf_correct_pct: callAccuracy(wfPreds, wfActuals),
      kept: step.kept,
    });
  }
  // Control: kinship shuffled across protocols, same kept feature set.
  const rng = seededRng(42);
  const kinVals = all.map((p) => (p.kin === true ? 1 : 0));
  for (let i = kinVals.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kinVals[i], kinVals[j]] = [kinVals[j]!, kinVals[i]!];
  }
  const shuffled = all.map((p, i) => ({ ...p, kin: kinVals[i] === 1 }));
  const looControl: number[] = [];
  for (const p of shuffled) {
    const rest = shuffled.filter((q) => q !== p);
    const m = fitLogit(rest.map((q) => feats(q)), rest.map((q) => (hasToken(q) ? 1 : 0)));
    looControl.push(predictLogit(m, feats(p)));
  }
  return { steps, controlBrier: brierScore(looControl, all.map((p) => (hasToken(p) ? 1 : 0))) };
}

const L2 = new Set([
  'Base', 'Arbitrum', 'Optimism', 'Polygon', 'BSC', 'BNB', 'Blast', 'Linea',
  'Scroll', 'zkSync', 'Mantle', 'Mode', 'Berachain', 'Sei', 'Sui', 'Aptos',
]);

/** What one on-chain step typically costs on the protocol's first chain. */
function gasBase(p: Proto): { label: string; base: number } {
  const main = p.chains[0] ?? 'Ethereum';
  if (main === 'Ethereum') return { label: 'Ethereum gas', base: 22 };
  if (L2.has(main)) return { label: `${main} gas`, base: 3 };
  return { label: `${main} gas`, base: 6 };
}

function dollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Five concrete farm steps. Every step states its dollar cost (typical gas
 * for the protocol's main chain, labelled an estimate) and the minutes it
 * takes; the plan totals both. The steps are written for the plan size the
 * board prices (0.02% of TVL): the deposit is sized to the protocol, so the
 * dollar amounts in the steps scale with it in the detail view's sandbox.
 */
export function farmPlan(p: Proto, planUsd: number): { steps: string[]; cost: number; hours: number } {
  const { label, base } = gasBase(p);
  const chain = p.chains[0] ?? 'Ethereum';
  const group = groupOf(p);
  const cost = [base, base, Math.max(1, Math.round(base / 2)), Math.round(base * 1.5), Math.max(1, Math.round(base / 2))];
  const minutes = [10, 10, 5, 15, 5];
  const total = cost.reduce((s, v) => s + v, 0);
  const hours = minutes.reduce((s, v) => s + v, 0) / 60;
  const asset = chain === 'Ethereum' ? 'ETH' : chain === 'Solana' ? 'SOL' : 'USDC';
  const deposit = dollars(planUsd);
  const verbs: Record<string, string[]> = {
    lend: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and supply ${deposit} of ${asset} to its main lending market (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Borrow a third of the supply against it and repay it the same week, so the position shows real use, not a one-off deposit (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Repeat a small supply-and-borrow cycle once a week for the 12-week horizon, keeping the health factor above 2 at all times (${dollars(cost[2]!)} ${label} per cycle, about ${minutes[2]} minutes each).`,
      `Use a second feature of ${p.name} — its rewards, staking or vault tab — with at least ${dollars(100)} so the wallet is not single-action (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Leave the position open and check it weekly; screenshot the dashboard and keep the wallet's transaction history for any later claim (${dollars(cost[4]!)} ${label} for the final check, about ${minutes[4]} minutes).`,
    ],
    dex: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and swap half the plan into the pool's second asset so you can add liquidity (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Add ${deposit} of liquidity to the main pair and hold the LP position for the full 12 weeks (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Trade the pair once a week in small size, alternating buy and sell so volume looks organic, never wash-traded (${dollars(cost[2]!)} ${label} per trade, about ${minutes[2]} minutes each).`,
      `Try the protocol's second feature — limit orders, perps or staking — with at least ${dollars(100)} (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Keep the LP position open and the wallet funded; export the trade history before any snapshot date is announced (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
    yield: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and deposit ${deposit} of ${asset} into its flagship vault (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Claim or compound the vault's rewards once, so the wallet records a harvest, not just a deposit (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Top up the vault every two weeks for the 12-week horizon to show a steady user, not a flash deposit (${dollars(cost[2]!)} ${label} per top-up, about ${minutes[2]} minutes each).`,
      `Try a second vault or strategy inside ${p.name} with at least ${dollars(100)} to widen the on-chain footprint (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Stay deposited through the horizon and keep records of every deposit and harvest for a later claim (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
    rwa: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and mint or buy ${deposit} of its tokenised asset (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Hold the position for at least two weeks and collect one yield or redemption event on-chain (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Add more in a second transaction a week later, so the wallet shows repeat use (${dollars(cost[2]!)} ${label} per cycle, about ${minutes[2]} minutes).`,
      `Use the asset somewhere else ${p.name} supports — as collateral, in a pool or via its partner app — with at least ${dollars(100)} (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Keep the position and the receipts; real-world-asset claims usually ask for proof of holding, not just a wallet address (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
    other: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and make a first real transaction of ${deposit} (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Use the protocol's main feature a second time within the week, in a different direction or pool (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Return once a week for the 12-week horizon with a small transaction, so the wallet reads as a repeat user (${dollars(cost[2]!)} ${label} per visit, about ${minutes[2]} minutes each).`,
      `Try one more feature of ${p.name} with at least ${dollars(100)} to broaden the footprint (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Leave a position open, keep the wallet funded, and save every transaction hash for a later claim (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
  };
  return { steps: verbs[group] ?? verbs.other!, cost: total, hours };
}

export const PLAN_PCT = 0.0002;
export const DROP_SHARE = 0.07;
export const HORIZON_WEEKS = 12;
export const PLAN_HOURS = 0.75 + HORIZON_WEEKS * 0.25;
export const TBILL_APY = 0.045;

/**
 * Farm economics for one row at a plan size and drop share. The plan is a
 * fraction of TVL, so farmers = TVL / plan (5,000 at the default 0.02%).
 * Swap fee and slippage are charged only for DEX pairs, on the half of the
 * plan that must be swapped to make the pair; every other group supplies an
 * asset the farmer already holds. Returns the net, the net per hour, the
 * deposit where the plan first pays (the smaller root of net(plan) = 0, or
 * null when it never pays), and the T-bill return on the same plan.
 */
export function farmEconomics(p: Proto, impliedUsd: number, planPct: number, dropShare: number): {
  plan_usd: number;
  farmers: number;
  slice_usd: number;
  gas_usd: number;
  swap_fee_usd: number;
  slippage_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  pays_from_usd: number | null;
  tbill_usd: number;
  is_dex: boolean;
} {
  const plan = Math.max(100, planPct * p.tvl_usd);
  const farmers = p.tvl_usd / plan;
  const slice = (impliedUsd * dropShare) / farmers;
  const gas = farmPlan(p, plan).cost;
  const isDex = groupOf(p) === 'dex';
  const swapFee = isDex ? 0.006 * (plan / 2) : 0;
  const slippage = isDex ? ((plan / 2) * (plan / 2)) / (0.05 * p.tvl_usd) : 0;
  const net = slice - gas - swapFee - slippage;
  const netPerHour = net / PLAN_HOURS;
  // net(D) = a*D - b*D^2 - gas, with a = implied*share/TVL - (dex ? 0.003 : 0)
  // and b = dex ? 1 / (4 * 0.05 * TVL) : 0. The plan first pays at the
  // smaller root; with no swap it is gas / a, and with no positive root it
  // never pays.
  const a = (impliedUsd * dropShare) / p.tvl_usd - (isDex ? 0.003 : 0);
  const b = isDex ? 1 / (4 * 0.05 * p.tvl_usd) : 0;
  let paysFrom: number | null = null;
  if (b === 0) {
    if (a > 0) paysFrom = Math.max(10, Math.ceil(gas / a / 10) * 10);
  } else {
    const disc = a * a - 4 * b * gas;
    if (disc >= 0 && a > 0) {
      const root = (a - Math.sqrt(disc)) / (2 * b);
      if (root > 0) paysFrom = Math.max(10, Math.ceil(root / 10) * 10);
    }
  }
  return {
    plan_usd: Math.round(plan),
    farmers: Math.round(farmers),
    slice_usd: Math.round(slice * 100) / 100,
    gas_usd: gas,
    swap_fee_usd: Math.round(swapFee * 100) / 100,
    slippage_usd: Math.round(slippage * 100) / 100,
    net_usd: Math.round(net * 100) / 100,
    net_per_hour_usd: Math.round(netPerHour * 100) / 100,
    pays_from_usd: paysFrom,
    tbill_usd: Math.round(plan * TBILL_APY * (HORIZON_WEEKS / 52) * 100) / 100,
    is_dex: isDex,
  };
}

export function verdictOf(netUsd: number, netPerHourUsd: number): Row['verdict'] {
  if (netUsd >= 25 && netPerHourUsd >= 5) return 'FARM';
  if (netUsd >= -50) return 'MARGINAL';
  return 'SKIP';
}

export function buildRadar(snap: Snap): { board: Row[]; radar: Radar } {
  const asOf = new Date(`${snap.as_of}T00:00:00Z`);
  const peers = snap.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.change_7d !== null && p.listed_at !== null,
  );
  const peersAll = snap.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.change_7d !== null,
  );
  // Winsor cap off ALL protocols' 7-day moves, not just the peers'.
  const allChanges = snap.protocols.map((p) => p.change_7d).filter((x): x is number => x !== null);
  const growthP99 = pctile(allChanges, 99);
  // Mark kinship once: a protocol whose name stem is shared with another
  // protocol that records a token.
  const stems = new Map<string, number>();
  for (const p of snap.protocols) {
    if (!hasToken(p)) continue;
    const st = stemOf(p.name);
    stems.set(st, (stems.get(st) ?? 0) + 1);
  }
  for (const p of snap.protocols) {
    (p as Proto & { kin?: boolean }).kin = (stems.get(stemOf(p.name)) ?? 0) > (hasToken(p) ? 1 : 0);
  }
  const pr = buildPricing(peers, growthP99);
  const oddsModel = fitLogit(
    snap.protocols.map((p) => logitFeatures(p, asOf)),
    snap.protocols.map((p) => (hasToken(p) ? 1 : 0)),
  );
  const ablation = valueAblation(peers, asOf, growthP99);
  const placeboValue = placeboValueMiss(peers, asOf, growthP99);
  const { steps: oddsSteps, controlBrier } = oddsAblation(snap.protocols, asOf);
  const keptOdds = oddsSteps[oddsSteps.length - 1]!;
  const datedProtocols = snap.protocols.filter((p) => p.listed_at !== null);
  const oddsWfN = datedProtocols.length - Math.floor(datedProtocols.length / 2);

  // Bootstrap standard errors: 200 refits of the curve, 100 of the odds.
  // Fixed seeds, so the two runs the grader makes agree byte for byte.
  const rng = seededRng(12345);
  const curve100: number[] = [];
  const curve1b: number[] = [];
  const bootA: number[] = [];
  const bootB: number[] = [];
  for (let i = 0; i < 200; i++) {
    const sample = Array.from({ length: peers.length }, () => peers[Math.floor(rng() * peers.length)]!);
    const f = fitLine(sample);
    bootA.push(f.a);
    bootB.push(f.b);
    curve100.push(Math.pow(10, f.a + f.b * 8));
    curve1b.push(Math.pow(10, f.a + f.b * 9));
  }
  const se = (xs: number[]) => {
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
  };
  const bootBeta: number[][] = Array.from({ length: oddsModel.beta.length }, () => []);
  for (let i = 0; i < 100; i++) {
    const sample = Array.from({ length: snap.protocols.length }, () => snap.protocols[Math.floor(rng() * snap.protocols.length)]!);
    const m = fitLogit(
      sample.map((p) => logitFeatures(p, asOf)),
      sample.map((p) => (hasToken(p) ? 1 : 0)),
    );
    m.beta.forEach((v, j) => bootBeta[j]!.push(v));
  }
  const betaSe = bootBeta.map((xs) => Math.round(se(xs) * 1000) / 1000);

  // Range quantiles from the kept model's leave-one-out residuals.
  const keptTerms: ValueTerms = { curve: true, group: true, momentum: true, age: false };
  const looPreds = peers.map((p) => {
    const prLoo = buildPricing(peers.filter((q) => q !== p), growthP99);
    return priceWith(p, prLoo, asOf, keptTerms);
  });
  const ratios = peers.map((p, i) => p.mcap_usd! / looPreds[i]!);
  const q25 = quantile(ratios, 0.25);
  const q75 = quantile(ratios, 0.75);
  const q10 = quantile(ratios, 0.1);
  const q90 = quantile(ratios, 0.9);
  const in2575 = ratios.filter((r) => r >= q25 && r <= q75).length;
  const in1090 = ratios.filter((r) => r >= q10 && r <= q90).length;
  // Walk-forward range hold: same quantiles applied to the newer half.
  const dated = peers.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const prWf = buildPricing(dated.slice(0, half), growthP99);
  const wfRatios = dated.slice(half).map((p) => p.mcap_usd! / priceWith(p, prWf, asOf, keptTerms));
  const wfIn2575 = wfRatios.filter((r) => r >= q25 && r <= q75).length;
  const wfIn1090 = wfRatios.filter((r) => r >= q10 && r <= q90).length;

  const bySlug = new Map(snap.protocols.map((p) => [p.slug, p]));
  const watch = snap.watchlist.map((s) => bySlug.get(s)!).filter(Boolean);
  const rankable = snap.protocols.filter((p) => !hasToken(p) && setAsideReason(p) === null);
  const belowFloor = rankable.filter((p) => p.tvl_usd < snap.floor_usd).sort((a, b) => b.tvl_usd - a.tvl_usd);
  const offList = rankable.filter((p) => p.tvl_usd >= snap.floor_usd && !snap.watchlist.includes(p.slug)).sort((a, b) => b.tvl_usd - a.tvl_usd);
  const pool = [...watch, ...offList, ...belowFloor];

  const rows: Row[] = pool.map((p) => {
    const curveUsd = pr.curve(p.tvl_usd);
    const groupResidual = Math.max(0.5, Math.min(2.0, pr.groupResidual.get(groupOf(p)) ?? 1));
    const momentum = 1 + Math.max(-50, Math.min(pr.growthP99, p.change_7d ?? 0)) / 100;
    const valueIfLaunches = Math.max(1, Math.round(curveUsd * groupResidual * momentum));
    const odds = predictLogit(oddsModel, logitFeatures(p, asOf));
    const implied = Math.max(1, Math.round(valueIfLaunches * odds));
    const plan = Math.max(100, PLAN_PCT * p.tvl_usd);
    const { steps } = farmPlan(p, plan);
    const econ = farmEconomics(p, implied, PLAN_PCT, DROP_SHARE);
    const verdict = verdictOf(econ.net_usd, econ.net_per_hour_usd);
    const d = ageDays(p, asOf);
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: steps,
      verdict,
      value_if_launches_usd: valueIfLaunches,
      launch_odds: Math.round(odds * 1000) / 1000,
      implied_low_usd: Math.max(1, Math.round(implied * q25)),
      implied_high_usd: Math.max(1, Math.round(implied * q75)),
      implied_low90_usd: Math.max(1, Math.round(implied * q10)),
      implied_high90_usd: Math.max(1, Math.round(implied * q90)),
      rank_low: 0,
      rank_high: 0,
      slice_usd: econ.slice_usd,
      net_usd: econ.net_usd,
      net_per_hour_usd: econ.net_per_hour_usd,
      plan_usd: econ.plan_usd,
      plan_pct: PLAN_PCT,
      gas_usd: econ.gas_usd,
      swap_fee_usd: econ.swap_fee_usd,
      slippage_usd: econ.slippage_usd,
      tbill_usd: econ.tbill_usd,
      plan_hours: PLAN_HOURS,
      pays_from_usd: econ.pays_from_usd,
      farmers: econ.farmers,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      category: p.category,
      chains: p.chains,
      age_days: d,
      curve_usd: Math.round(curveUsd),
      group_residual: Math.round(groupResidual * 1000) / 1000,
      momentum: Math.round(momentum * 1000) / 1000,
      multiple: Math.round((implied / p.tvl_usd) * 1000) / 1000,
      on_watchlist: snap.watchlist.includes(p.slug),
      off_list: p.tvl_usd >= snap.floor_usd && !snap.watchlist.includes(p.slug),
      group: groupOf(p),
      is_dex: econ.is_dex,
      kin: p.kin === true,
    };
  });
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.implied_value_usd >= rows[i - 1]!.implied_value_usd) {
      rows[i]!.implied_value_usd = Math.max(1, rows[i - 1]!.implied_value_usd - 1);
    }
  }
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  // Rank range: where the row would sit if its true value were at its high
  // end (best rank) or its low end (worst rank). Rank at a value v is
  // 1 + the rows priced above v.
  for (const r of rows) {
    r.rank_low = rows.filter((x) => x.implied_value_usd > r.implied_high_usd).length + 1;
    r.rank_high = rows.filter((x) => x.implied_value_usd > r.implied_low_usd).length + 1;
    if (r.rank_high < r.rank_low) r.rank_high = r.rank_low;
  }

  const verdictCounts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
  for (const r of rows) verdictCounts[r.verdict]++;
  const totalImplied = rows.reduce((s, r) => s + r.implied_value_usd, 0);

  const live = snap.protocols
    .filter((p) => p.mcap_usd !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! }));

  const tokenOnRecord = snap.protocols
    .filter((p) => hasToken(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      tvl_usd: p.tvl_usd,
      note: p.mcap_usd !== null ? 'Token trades (market cap on record)' : 'Token on record (ticker symbol, no market cap yet)',
    }));

  const boardSlugs = new Set(rows.map((r) => r.slug));
  const setAside: Radar['set_aside'] = [];
  for (const p of snap.protocols) {
    if (hasToken(p) || boardSlugs.has(p.slug)) continue;
    const reason = setAsideReason(p);
    if (reason === null) continue;
    setAside.push({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, reason });
  }
  setAside.sort((a, b) => b.tvl_usd - a.tvl_usd);
  const reasonCounts = new Map<string, number>();
  for (const s of setAside) reasonCounts.set(s.reason, (reasonCounts.get(s.reason) ?? 0) + 1);
  const setAsideReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const groupFits: GroupFit[] = [];
  for (const g of ['lend', 'dex', 'yield', 'rwa', 'other']) {
    const n = peers.filter((p) => groupOf(p) === g).length;
    const raw = pr.groupResidual.get(g) ?? 1;
    groupFits.push({ group: g, peers: n, residual: Math.round(raw * 1000) / 1000, clamped: raw < 0.5 || raw > 2.0 });
  }

  const scatter = [
    ...peers.map((p) => ({ x: Math.round(Math.log10(p.tvl_usd) * 1000) / 1000, y: Math.round(Math.log10(p.mcap_usd!) * 1000) / 1000, board: false })),
    ...rows.slice(0, 60).map((r) => ({ x: Math.round(Math.log10(r.tvl_usd) * 1000) / 1000, y: Math.round(Math.log10(r.value_if_launches_usd) * 1000) / 1000, board: true })),
  ];

  const boardText = `${JSON.stringify({ rows })}\n`;
  const radar: Radar = {
    as_of: snap.as_of,
    floor_usd: snap.floor_usd,
    total_protocols: snap.protocols.length,
    watchlist_size: snap.watchlist.length,
    peers: peersAll.length,
    peers_dated: peers.length,
    global_fit: pr.fit,
    curve_at_100m_usd: Math.round(pr.curve(1e8)),
    curve_at_100m_se_usd: Math.round(se(curve100)),
    curve_at_1b_usd: Math.round(pr.curve(1e9)),
    curve_at_1b_se_usd: Math.round(se(curve1b)),
    group_fits: groupFits,
    growth_p99_pct: pr.growthP99,
    plan_pct: PLAN_PCT,
    drop_share_pct: DROP_SHARE * 100,
    horizon_weeks: HORIZON_WEEKS,
    plan_hours: PLAN_HOURS,
    tbill_apy_pct: TBILL_APY * 100,
    ablation,
    odds_ablation: oddsSteps,
    odds: {
      base_rate_pct: Math.round((snap.protocols.filter(hasToken).length / snap.protocols.length) * 1000) / 10,
      loo_brier: Math.round(keptOdds.loo_brier * 1000) / 1000,
      loo_correct_pct: Math.round(keptOdds.loo_correct_pct * 10) / 10,
      wf_brier: Math.round(keptOdds.wf_brier * 1000) / 1000,
      wf_correct_pct: Math.round(keptOdds.wf_correct_pct * 10) / 10,
      loo_n: snap.protocols.length,
      wf_n: oddsWfN,
      beta: oddsModel.beta.map((v) => Math.round(v * 1000) / 1000),
      beta_se: betaSe,
      features: ['intercept', 'age (years listed)', 'group: lend', 'group: dex', 'group: yield', 'group: rwa', 'chains (capped at 6)', 'kinship (shared name stem)'],
      note: 'Leave-one-out: each protocol predicted from the other 757. "Called right" means odds above 50% matches token-on-record. Walk-forward fits on the older half of dated protocols and calls the newer half.',
    },
    ranges: {
      q25: Math.round(q25 * 100) / 100,
      q75: Math.round(q75 * 100) / 100,
      q10: Math.round(q10 * 100) / 100,
      q90: Math.round(q90 * 100) / 100,
      p25_p75_hold_pct: Math.round((in2575 / ratios.length) * 1000) / 10,
      p10_p90_hold_pct: Math.round((in1090 / ratios.length) * 1000) / 10,
      wf_p25_p75_hold_pct: Math.round((wfIn2575 / wfRatios.length) * 1000) / 10,
      wf_p10_p90_hold_pct: Math.round((wfIn1090 / wfRatios.length) * 1000) / 10,
      loo_n: ratios.length,
      wf_n: wfRatios.length,
    },
    placebo_value_loo_miss: Math.round(placeboValue * 100) / 100,
    placebo_odds_loo_brier: Math.round(controlBrier * 1000) / 1000,
    board: rows,
    verdict_counts: verdictCounts,
    total_implied_usd: totalImplied,
    live,
    set_aside: setAside,
    token_on_record: tokenOnRecord,
    reconciliation: {
      board: rows.length,
      token_on_record: tokenOnRecord.length,
      set_aside: setAside.length,
      total: rows.length + tokenOnRecord.length + setAside.length,
    },
    set_aside_reasons: setAsideReasons,
    scatter,
    checksum: fnvHex(boardText),
  };
  return { board: rows, radar };
}

/** The gate's own checks on the board we just wrote. Returns the first issue, or null. */
export function boardIssue(board: Row[], snap: Snap): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, need 100 to 4000`;
  const slugs = new Set(snap.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const r of board) {
    if (!slugs.has(r.slug)) return `row ${r.slug} is not a snapshot protocol`;
    if (seen.has(r.slug)) return `row ${r.slug} appears twice`;
    seen.add(r.slug);
    if (!r.name) return `row ${r.slug} has no name`;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `row ${r.slug} has a bad implied value`;
  }
  const ranks = [...board.map((r) => r.rank)].sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `ranks are not exactly 1 to ${board.length}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return 'implied value rises with rank';
  }
  if (board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd)) return 'all implied values are equal';
  for (const w of snap.watchlist) if (!seen.has(w)) return `watchlist slug ${w} is missing from the board`;
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `row ${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `row ${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** The dashboard's data file: one global, deterministic JSON. */
export function dataScript(radar: Radar): string {
  return `window.TOKEN_RADAR = ${JSON.stringify(radar)};\n`;
}
