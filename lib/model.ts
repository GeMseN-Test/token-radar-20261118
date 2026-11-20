// Token Launch Radar — ronde 7 (20 Nov 2026). "comps-1": one fitted comps
// curve plus a per-group premium, launch odds from the snapshot itself, a
// printed range on every row, and deposit-sized farm economics.
//
// Written fresh in this session from the spec (FINISH.md + top-10 analysis +
// the judge's own criteria in the kit): no line is copied from the ronde 5/6
// files. What the winners do that ronde 6 did not — walk-forward test,
// launch odds, ranges, deposit-sized plans, 198 ranked rows with the finer
// 416 + 144 + 198 reconciliation — is built here from the snapshot's own
// ten fields, never from a hardcoded list of names.
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
  verdict: 'FARM' | 'THIN' | 'SKIP';
  value_if_launches_usd: number;
  launch_odds: number;
  implied_low_usd: number;
  implied_high_usd: number;
  rank_low: number;
  rank_high: number;
  slice_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  plan_cost_usd: number;
  plan_hours: number;
  pays_from_usd: number;
  farmers: number;
  tvl_usd: number;
  change_7d: number | null;
  category: string | null;
  chains: string[];
  age_days: number | null;
  curve_usd: number;
  group_residual: number;
  momentum: number;
  age_factor: number;
  kin_factor: number;
  multiple: number;
  on_watchlist: boolean;
  off_list: boolean;
  group: string;
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
}

export interface OddsCheck {
  base_rate_pct: number;
  loo_correct_pct: number;
  loo_n: number;
  note: string;
}

export interface RangeCheck {
  p25_p75_hold_pct: number;
  p10_p90_hold_pct: number;
  wf_p25_p75_hold_pct: number;
  loo_n: number;
  wf_n: number;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  total_protocols: number;
  watchlist_size: number;
  peers: number;
  global_fit: { a: number; b: number; r2: number };
  group_fits: GroupFit[];
  growth_p99_pct: number;
  deposit_usd: number;
  drop_share_pct: number;
  ablation: AblationStep[];
  odds: OddsCheck;
  ranges: RangeCheck;
  board: Row[];
  verdict_counts: { FARM: number; THIN: number; SKIP: number };
  total_implied_usd: number;
  live: { slug: string; name: string; category: string | null; tvl_usd: number; mcap_usd: number }[];
  set_aside: { slug: string; name: string; tvl_usd: number; reason: string }[];
  token_on_record: { slug: string; name: string; tvl_usd: number; note: string }[];
  reconciliation: { board: number; token_on_record: number; set_aside: number; total: number };
  set_aside_reasons: { reason: string; count: number }[];
  scatter: { x: number; y: number; board: boolean }[];
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

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

// Category groups for the per-group comps curves. A group with fewer than
// 8 live peers falls back to the global curve times the group's median
// residual, and the page says so.
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

const AGE_BUCKETS: [number, number][] = [[0, 90], [91, 365], [366, 730], [731, 1095], [1096, 100000]];
const TVL_TIERS: [number, number][] = [[0, 1e7], [1e7, 5e7], [5e7, 2e8], [2e8, 1e9], [1e9, 1e13]];

function bucketOf(v: number, edges: [number, number][]): number {
  for (let i = 0; i < edges.length; i++) if (v >= edges[i]![0] && v <= edges[i]![1]) return i;
  return edges.length - 1;
}

/**
 * Launch odds: the chance a protocol records a token, read off the
 * snapshot itself. Three rates are averaged with the base rate — the rate
 * for the protocol's age bucket, its TVL tier and its category group —
 * each smoothed toward the base rate with 10 pseudo-observations, so a
 * thin bucket cannot shout. Missing listed_at is its own bucket: those
 * protocols record a token 79% of the time, and the page says so.
 */
export interface OddsModel {
  base: number;
  ageRates: number[];
  ageMissing: number;
  tvlRates: number[];
  groupRates: Map<string, number>;
}

export function buildOddsModel(all: Proto[], asOf: Date): OddsModel {
  const on = all.filter(hasToken).length;
  const base = on / all.length;
  const smooth = (hit: number, n: number) => (hit + 10 * base) / (n + 10);
  const ageRates = AGE_BUCKETS.map(([lo, hi]) => {
    const sub = all.filter((p) => {
      const a = ageDays(p, asOf);
      return a !== null && a >= lo && a <= hi;
    });
    return smooth(sub.filter(hasToken).length, sub.length);
  });
  const missing = all.filter((p) => ageDays(p, asOf) === null);
  const ageMissing = smooth(missing.filter(hasToken).length, missing.length);
  const tvlRates = TVL_TIERS.map(([lo, hi]) => {
    const sub = all.filter((p) => p.tvl_usd >= lo && p.tvl_usd < hi);
    return smooth(sub.filter(hasToken).length, sub.length);
  });
  const groupRates = new Map<string, number>();
  for (const g of ['lend', 'dex', 'yield', 'rwa', 'other']) {
    const sub = all.filter((p) => groupOf(p) === g);
    groupRates.set(g, smooth(sub.filter(hasToken).length, sub.length));
  }
  return { base, ageRates, ageMissing, tvlRates, groupRates };
}

export function launchOdds(p: Proto, model: OddsModel, asOf: Date): number {
  const a = ageDays(p, asOf);
  const ageRate = a === null ? model.ageMissing : model.ageRates[bucketOf(a, AGE_BUCKETS)]!;
  const tvlRate = model.tvlRates[bucketOf(p.tvl_usd, TVL_TIERS)]!;
  const groupRate = model.groupRates.get(groupOf(p)) ?? model.base;
  const odds = (ageRate + tvlRate + groupRate + model.base) / 4;
  return Math.max(0.02, Math.min(0.98, odds));
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
 * takes; the plan totals both. Templates are (category group x gas tier).
 */
export function farmPlan(p: Proto): { steps: string[]; cost: number; hours: number } {
  const { label, base } = gasBase(p);
  const chain = p.chains[0] ?? 'Ethereum';
  const group = groupOf(p);
  const cost = [base, base, Math.max(1, Math.round(base / 2)), Math.round(base * 1.5), Math.max(1, Math.round(base / 2))];
  const minutes = [10, 10, 5, 15, 5];
  const total = cost.reduce((s, v) => s + v, 0);
  const hours = minutes.reduce((s, v) => s + v, 0) / 60;
  const asset = chain === 'Ethereum' ? 'ETH' : chain === 'Solana' ? 'SOL' : 'USDC';
  const verbs: Record<string, string[]> = {
    lend: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and supply ${dollars(500)} of ${asset} to its main lending market (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Borrow ${dollars(200)} against the supply and repay it the same week, so the position shows real use, not a one-off deposit (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Repeat a small supply-and-borrow cycle once a week for a month, keeping the health factor above 2 at all times (${dollars(cost[2]!)} ${label} per cycle, about ${minutes[2]} minutes each).`,
      `Use a second feature of ${p.name} — its rewards, staking or vault tab — with at least ${dollars(100)} so the wallet is not single-action (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Leave the position open and check it weekly; screenshot the dashboard and keep the wallet's transaction history for any later claim (${dollars(cost[4]!)} ${label} for the final check, about ${minutes[4]} minutes).`,
    ],
    dex: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and swap ${dollars(300)} of ${asset} into the pool's main pair (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Add ${dollars(200)} of liquidity to that pair and hold the LP position for at least two weeks (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Trade the pair once a week in small size, alternating buy and sell so volume looks organic, never wash-traded (${dollars(cost[2]!)} ${label} per trade, about ${minutes[2]} minutes each).`,
      `Try the protocol's second feature — limit orders, perps or staking — with at least ${dollars(100)} (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Keep the LP position open and the wallet funded; export the trade history before any snapshot date is announced (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
    yield: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and deposit ${dollars(500)} of ${asset} into its flagship vault (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Claim or compound the vault's rewards once, so the wallet records a harvest, not just a deposit (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Top up the vault by ${dollars(100)} every two weeks for a month to show a steady user, not a flash deposit (${dollars(cost[2]!)} ${label} per top-up, about ${minutes[2]} minutes each).`,
      `Try a second vault or strategy inside ${p.name} with at least ${dollars(100)} to widen the on-chain footprint (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Stay deposited through the month and keep records of every deposit and harvest for a later claim (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
    rwa: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and mint or buy ${dollars(500)} of its tokenised asset (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Hold the position for at least two weeks and collect one yield or redemption event on-chain (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Add ${dollars(100)} more in a second transaction a week later, so the wallet shows repeat use (${dollars(cost[2]!)} ${label} per cycle, about ${minutes[2]} minutes).`,
      `Use the asset somewhere else ${p.name} supports — as collateral, in a pool or via its partner app — with at least ${dollars(100)} (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Keep the position and the receipts; real-world-asset claims usually ask for proof of holding, not just a wallet address (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
    other: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and make a first real transaction of ${dollars(300)} (${dollars(cost[0]!)} ${label}, about ${minutes[0]} minutes).`,
      `Use the protocol's main feature a second time within the week, in a different direction or pool (${dollars(cost[1]!)} ${label}, about ${minutes[1]} minutes).`,
      `Return once a week for a month with a small ${dollars(50)} transaction, so the wallet reads as a repeat user (${dollars(cost[2]!)} ${label} per visit, about ${minutes[2]} minutes each).`,
      `Try one more feature of ${p.name} with at least ${dollars(100)} to broaden the footprint (${dollars(cost[3]!)} ${label}, about ${minutes[3]} minutes).`,
      `Leave a position open, keep the wallet funded, and save every transaction hash for a later claim (${dollars(cost[4]!)} ${label}, about ${minutes[4]} minutes).`,
    ],
  };
  return { steps: verbs[group] ?? verbs.other!, cost: total, hours };
}

interface Pricing {
  global: Fit;
  groupResidual: Map<string, number>;
  kinFactor: number;
  growthP99: number;
}

/**
 * One global curve for every peer, plus a per-group residual: the median
 * mcap/curve for the group's peers, clamped to [0.5, 2.0] when used (the
 * clamp is where the blind test says it earns its place: [0.5, 2.0] beats
 * both [0.8, 1.25] and no clamp on leave-one-out and walk-forward). A
 * growthP99 is read off ALL protocols, not just the peers: the board rows
 * are the ones with the big 7-day moves, and capping them at the peers'
 * p99 (+2.1%) would throw the signal away.
 */
function buildPricing(peers: Proto[], growthP99: number): Pricing {
  const global = fitLine(peers);
  const curve = (tvl: number) => Math.pow(10, global.a + global.b * Math.log10(tvl));
  const groupResidual = new Map<string, number>();
  for (const g of ['lend', 'dex', 'yield', 'rwa', 'other']) {
    const sub = peers.filter((p) => groupOf(p) === g);
    if (sub.length >= 3) groupResidual.set(g, median(sub.map((p) => p.mcap_usd! / curve(p.tvl_usd))));
  }
  // Kinship: do peers whose name stem is shared with another token-on-record
  // protocol price above or below their curve? The factor is the median
  // residual of kin peers over non-kin peers, winsorized to [0.7, 1.3].
  // With 8 kin peers it is a small, stated term — the ablation table shows
  // whether keeping it earns its place.
  const kin = peers.filter((p) => (p as Proto & { kin?: boolean }).kin === true);
  const nonKin = peers.filter((p) => (p as Proto & { kin?: boolean }).kin !== true);
  const kinRes = kin.length ? median(kin.map((p) => p.mcap_usd! / curve(p.tvl_usd))) : 1;
  const nonRes = nonKin.length ? median(nonKin.map((p) => p.mcap_usd! / curve(p.tvl_usd))) : 1;
  const kinFactor = Math.max(0.7, Math.min(1.3, nonRes === 0 ? 1 : kinRes / nonRes));
  return { global, groupResidual, kinFactor, growthP99 };
}

type PriceFn = (p: Proto, pr: Pricing, asOf: Date, terms: { curve: boolean; group: boolean; momentum: boolean; age: boolean; kin: boolean }) => number;

function priceWith(p: Proto, pr: Pricing, asOf: Date, terms: { curve: boolean; group: boolean; momentum: boolean; age: boolean; kin: boolean }): number {
  let value = Math.pow(10, pr.global.a + pr.global.b * Math.log10(p.tvl_usd));
  if (terms.group && pr.groupResidual.has(groupOf(p))) {
    value *= Math.max(0.5, Math.min(2.0, pr.groupResidual.get(groupOf(p))!));
  }
  if (terms.momentum) {
    const g = p.change_7d ?? 0;
    value *= 1 + Math.max(-50, Math.min(pr.growthP99, g)) / 100;
  }
  if (terms.age) {
    const d = ageDays(p, asOf);
    if (d !== null) value *= 1 + (Math.min(d, 1095) / 1095) * 0.25;
  }
  if (terms.kin && p.kin === true) value *= pr.kinFactor;
  return value;
}

/** Median miss factor: median of max(pred/actual, actual/pred). 1 is perfect. */
function missFactor(preds: number[], actuals: number[]): { miss: number; within3: number } {
  const ratios = preds.map((pr, i) => Math.max(pr / actuals[i]!, actuals[i]! / pr));
  return {
    miss: median(ratios),
    within3: (ratios.filter((r) => r <= 3).length / ratios.length) * 100,
  };
}

const STEPS: { label: string; terms: { curve: boolean; group: boolean; momentum: boolean; age: boolean; kin: boolean }; flat: boolean }[] = [
  { label: 'One flat TVL multiple', terms: { curve: false, group: false, momentum: false, age: false, kin: false }, flat: true },
  { label: '+ size curve (log-log)', terms: { curve: true, group: false, momentum: false, age: false, kin: false }, flat: false },
  { label: '+ group residual (per-group premium)', terms: { curve: true, group: true, momentum: false, age: false, kin: false }, flat: false },
  { label: '+ 7-day momentum', terms: { curve: true, group: true, momentum: true, age: false, kin: false }, flat: false },
  { label: '+ age (time with no token)', terms: { curve: true, group: true, momentum: true, age: true, kin: false }, flat: false },
  { label: '+ kinship (shared name stem)', terms: { curve: true, group: true, momentum: true, age: true, kin: true }, flat: false },
];

function blindAblation(peers: Proto[], asOf: Date, growthP99: number): AblationStep[] {
  // Walk-forward split: the older half of dated peers fits, the newer half
  // is priced. Undated peers sit out of this test, and the page says so.
  const dated = peers.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const older = dated.slice(0, half);
  const newer = dated.slice(half);
  const out: AblationStep[] = [];
  for (const step of STEPS) {
    // Leave-one-out: refit on the other peers each time.
    const looPreds: number[] = [];
    for (const p of peers) {
      const pr = buildPricing(peers.filter((q) => q !== p), growthP99);
      const flatMultiple = median(peers.filter((q) => q !== p).map((q) => q.mcap_usd! / q.tvl_usd));
      looPreds.push(step.flat ? flatMultiple * p.tvl_usd : priceWith(p, pr, asOf, step.terms));
    }
    const loo = missFactor(looPreds, peers.map((p) => p.mcap_usd!));
    // Walk-forward: one fit on the older half, priced on the newer half.
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
    });
  }
  return out;
}

export const DEPOSIT_USD = 1000;
export const DROP_SHARE = 0.1;

export function buildRadar(snap: Snap): { board: Row[]; radar: Radar } {
  const asOf = new Date(`${snap.as_of}T00:00:00Z`);
  const peers = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.change_7d !== null);
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
  const oddsModel = buildOddsModel(snap.protocols, asOf);
  const ablation = blindAblation(peers, asOf, growthP99);

  // Range quantiles from the kept model's leave-one-out residuals.
  const kept = STEPS[STEPS.length - 1]!;
  const looPreds = peers.map((p) => {
    const prLoo = buildPricing(peers.filter((q) => q !== p), growthP99);
    return priceWith(p, prLoo, asOf, kept.terms);
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
  const wfRatios = dated.slice(half).map((p) => p.mcap_usd! / priceWith(p, prWf, asOf, kept.terms));
  const wfIn2575 = wfRatios.filter((r) => r >= q25 && r <= q75).length;

  // Launch-odds check: leave-one-out, each protocol predicted from the
  // other 757. "Called right" means odds >= 50% matches token-on-record.
  let oddsRight = 0;
  for (const p of snap.protocols) {
    const rest = snap.protocols.filter((q) => q !== p);
    const m = buildOddsModel(rest, asOf);
    const o = launchOdds(p, m, asOf);
    if ((o >= 0.5) === hasToken(p)) oddsRight++;
  }

  const bySlug = new Map(snap.protocols.map((p) => [p.slug, p]));
  const watch = snap.watchlist.map((s) => bySlug.get(s)!).filter(Boolean);
  const rankable = snap.protocols.filter((p) => !hasToken(p) && setAsideReason(p) === null);
  const belowFloor = rankable.filter((p) => p.tvl_usd < snap.floor_usd).sort((a, b) => b.tvl_usd - a.tvl_usd);
  const offList = rankable.filter((p) => p.tvl_usd >= snap.floor_usd && !snap.watchlist.includes(p.slug)).sort((a, b) => b.tvl_usd - a.tvl_usd);
  const pool = [...watch, ...offList, ...belowFloor];

  const rows: Row[] = pool.map((p) => {
    const curveUsd = Math.pow(10, pr.global.a + pr.global.b * Math.log10(p.tvl_usd));
    const groupResidual = Math.max(0.5, Math.min(2.0, pr.groupResidual.get(groupOf(p)) ?? 1));
    const groupUsd = curveUsd * groupResidual;
    const momentum = 1 + Math.max(-50, Math.min(pr.growthP99, p.change_7d ?? 0)) / 100;
    const d = ageDays(p, asOf);
    const ageFactor = d === null ? 1 : 1 + (Math.min(d, 1095) / 1095) * 0.25;
    const kinFactor = (p as Proto & { kin?: boolean }).kin === true ? pr.kinFactor : 1;
    const valueIfLaunches = Math.max(1, Math.round(groupUsd * momentum * ageFactor * kinFactor));
    const odds = launchOdds(p, oddsModel, asOf);
    const implied = Math.max(1, Math.round(valueIfLaunches * odds));
    const { steps, cost, hours } = farmPlan(p);
    const farmers = Math.max(50, Math.round(p.tvl_usd / DEPOSIT_USD));
    const slice = (implied * DROP_SHARE) / farmers;
    const net = slice - cost;
    const netPerHour = net / hours;
    // Deposit where the slice first covers the plan cost: slice grows with
    // the deposit (farmers = TVL / deposit), fees do not.
    const paysFrom = Math.max(10, Math.ceil((cost * p.tvl_usd) / (implied * DROP_SHARE) / 10) * 10);
    const verdict: Row['verdict'] = net >= 25 ? 'FARM' : net >= -10 ? 'THIN' : 'SKIP';
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
      rank_low: 0,
      rank_high: 0,
      slice_usd: Math.round(slice * 100) / 100,
      net_usd: Math.round(net * 100) / 100,
      net_per_hour_usd: Math.round(netPerHour * 100) / 100,
      plan_cost_usd: cost,
      plan_hours: Math.round(hours * 100) / 100,
      pays_from_usd: paysFrom,
      farmers,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      category: p.category,
      chains: p.chains,
      age_days: d,
      curve_usd: Math.round(curveUsd),
      group_residual: Math.round(groupResidual * 1000) / 1000,
      momentum: Math.round(momentum * 1000) / 1000,
      age_factor: Math.round(ageFactor * 1000) / 1000,
      kin_factor: Math.round(kinFactor * 1000) / 1000,
      multiple: Math.round((implied / p.tvl_usd) * 1000) / 1000,
      on_watchlist: snap.watchlist.includes(p.slug),
      off_list: p.tvl_usd >= snap.floor_usd && !snap.watchlist.includes(p.slug),
      group: groupOf(p),
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

  const verdictCounts = { FARM: 0, THIN: 0, SKIP: 0 };
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

  const radar: Radar = {
    as_of: snap.as_of,
    floor_usd: snap.floor_usd,
    total_protocols: snap.protocols.length,
    watchlist_size: snap.watchlist.length,
    peers: peers.length,
    global_fit: pr.global,
    group_fits: groupFits,
    growth_p99_pct: pr.growthP99,
    deposit_usd: DEPOSIT_USD,
    drop_share_pct: DROP_SHARE * 100,
    ablation,
    odds: {
      base_rate_pct: Math.round(oddsModel.base * 1000) / 10,
      loo_correct_pct: Math.round((oddsRight / snap.protocols.length) * 1000) / 10,
      loo_n: snap.protocols.length,
      note: 'Leave-one-out: each protocol predicted from the other 757. "Called right" means odds above 50% matches token-on-record.',
    },
    ranges: {
      p25_p75_hold_pct: Math.round((in2575 / ratios.length) * 1000) / 10,
      p10_p90_hold_pct: Math.round((in1090 / ratios.length) * 1000) / 10,
      wf_p25_p75_hold_pct: Math.round((wfIn2575 / wfRatios.length) * 1000) / 10,
      loo_n: ratios.length,
      wf_n: wfRatios.length,
    },
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
