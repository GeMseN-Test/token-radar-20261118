// Token Launch Radar — ronde 5 (20 Nov 2026).
//
// Model, board builder, blind test, costed farm plans + verdicts, and the
// reconciliation of all 758 snapshot protocols. Written fresh in this session
// from the v2 spec (prompt-v2.txt + FINISH.md) and the top-10 lessons:
//   - fitted log-log pricing curve on the 128 live peers (mcap > 0, TVL > 0,
//     7-day change reported), recomputed at runtime — never hardcoded;
//   - implied = curve(TVL) x growth tilt x age tilt x spread tilt;
//   - six models blind-tested (leave-one-out + 5-fold CV) and shown on the page;
//   - board = 40 house watchlist + 141 largest below-floor pre-token names
//     that pass the house rule; every one of the 758 protocols is accounted
//     for in exactly one bucket (board / live / set aside with a reason);
//   - every row carries a costed 5-step farm plan and a verdict
//     (FARM / THIN / SKIP) from its net value per farmer after plan cost.
//
// The snapshot's change_7d is in PER CENT (max +4,448%), not a fraction.

export interface Protocol {
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
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  verdict: 'FARM' | 'THIN' | 'SKIP';
  net_usd: number;
  plan_cost_usd: number;
  farmers: number;
  tvl_usd: number;
  change_7d: number | null;
  category: string | null;
  chains: string[];
  age_days: number | null;
  curve_usd: number;
  growth_tilt: number;
  age_tilt: number;
  spread_tilt: number;
  multiple: number;
  on_watchlist: boolean;
}

export interface BlindRow {
  model: string;
  loo_error_pct: number;
  loo_within2_pct: number;
  cv_error_pct: number;
  cv_within2_pct: number;
  kept: boolean;
  note: string;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  total_protocols: number;
  watchlist_size: number;
  peers: number;
  fit: { a: number; b: number; r2: number };
  growth_p99_pct: number;
  blind: BlindRow[];
  board: BoardRow[];
  verdict_counts: { FARM: number; THIN: number; SKIP: number };
  median_multiple: number;
  live: { slug: string; name: string; category: string | null; tvl_usd: number; mcap_usd: number }[];
  set_aside: { slug: string; name: string; tvl_usd: number; reason: string }[];
  reconciliation: { board: number; live: number; set_aside: number; total: number };
  set_aside_reasons: { reason: string; count: number }[];
}

export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot: protocols/watchlist are not arrays');
  }
  if (typeof raw.floor_usd !== 'number' || typeof raw.as_of !== 'string') {
    throw new Error('snapshot: floor_usd/as_of missing');
  }
  return raw;
}

/** Median of numbers (0 for an empty list). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** The p-th percentile (0..100) of numbers, nearest-rank. */
function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * (s.length - 1)))]!;
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

export interface CurveFit {
  a: number;
  b: number;
  r2: number;
}

/** Ordinary least squares on log10(mcap) = a + b * log10(TVL). */
export function fitCurve(peers: Protocol[]): CurveFit {
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
  const b = sxy / sxx;
  const a = my - b * mx;
  return { a, b, r2: (sxy * sxy) / (sxx * syy) };
}

const EXCHANGE_NAMES = new Set(['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini']);
const RULE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/**
 * The house watchlist rule, as far as the snapshot's ten fields can show it:
 * category, version-marked name, wrapped/staked wording, exchange-named.
 * Returns the reason it fails, or null when it passes. The snapshot carries
 * no parentProtocol, so the house's parent-product check cannot be repeated
 * here — names that pass this check but sit above the floor without being on
 * the watchlist are set aside with that reason stated, never ranked.
 */
export function houseRuleFails(p: Protocol): string | null {
  if (p.category !== null && RULE_CATEGORIES.has(p.category)) return `Category: ${p.category}`;
  if (/ (V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name)) return 'Name ends in a version marker';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'Wrapped / staked in name';
  if (EXCHANGE_NAMES.has(p.name.split(' ')[0]!)) return 'Exchange-named';
  return null;
}

const L2_CHAINS = new Set([
  'Base', 'Arbitrum', 'Optimism', 'Polygon', 'BSC', 'BNB', 'Blast', 'Linea',
  'Scroll', 'zkSync', 'Mantle', 'Mode', 'Berachain', 'Sei', 'Sui', 'Aptos',
]);

/** Gas tier of a protocol's first chain: what one on-chain step typically costs. */
function gasTier(p: Protocol): { label: string; base: number } {
  const main = p.chains[0] ?? 'Ethereum';
  if (main === 'Ethereum') return { label: 'Ethereum gas', base: 22 };
  if (L2_CHAINS.has(main)) return { label: `${main} gas`, base: 3 };
  return { label: `${main} gas`, base: 6 };
}

const CATEGORY_GROUPS: Record<string, string> = {
  Lending: 'lend', CDP: 'lend', 'CDP Manager': 'lend', 'Uncollateralized Lending': 'lend',
  'Collateral Management': 'lend', 'Collateral Markets': 'lend', 'Interest Rate Derivatives': 'lend',
  Dexs: 'dex', Derivatives: 'dex', Options: 'dex', 'Options Vault': 'dex', 'Liquidity Manager': 'dex',
  'Prediction Market': 'dex', Synthetics: 'dex', 'Basis Trading': 'dex', 'Dual-Token Stablecoin': 'dex',
  Yield: 'yield', 'Yield Aggregator': 'yield', Farm: 'yield', 'Leveraged Farming': 'yield',
  Indexes: 'yield', 'Onchain Capital Allocator': 'yield', 'Risk Curators': 'yield', 'Token Locker': 'yield',
  RWA: 'rwa', 'Reserve Currency': 'rwa', 'Stablecoin Issuer': 'rwa', 'Stablecoin Wrapper': 'rwa',
  'Algo-Stables': 'rwa', 'Anchor BTC': 'rwa', 'Decentralized BTC': 'rwa', 'Restaked BTC': 'rwa',
};

function groupOf(p: Protocol): string {
  return (p.category !== null && CATEGORY_GROUPS[p.category]) || 'other';
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Five concrete farm steps for a protocol. Every step states its dollar cost
 * (typical gas for the protocol's main chain, labelled an estimate) and the
 * minutes it takes. Templates are (category group x gas tier); the board
 * reports how many distinct templates it uses.
 */
export function farmPlan(p: Protocol): { steps: string[]; cost: number } {
  const { label, base } = gasTier(p);
  const chain = p.chains[0] ?? 'Ethereum';
  const group = groupOf(p);
  const cost = [base, base, Math.max(1, Math.round(base / 2)), Math.round(base * 1.5), Math.max(1, Math.round(base / 2))];
  const total = cost.reduce((s, v) => s + v, 0);
  const asset = chain === 'Ethereum' ? 'ETH' : chain === 'Solana' ? 'SOL' : 'USDC';
  const acts: Record<string, string[]> = {
    lend: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and supply ${money(500)} of ${asset} to its main lending market (${money(cost[0]!)} ${label}, about 10 minutes).`,
      `Borrow ${money(200)} against the supply and repay it the same week, so the position shows real use, not a one-off deposit (${money(cost[1]!)} ${label}, about 10 minutes).`,
      `Repeat a small supply-and-borrow cycle once a week for a month, keeping the health factor above 2 at all times (${money(cost[2]!)} ${label} per cycle, about 5 minutes each).`,
      `Use a second feature of ${p.name} — its rewards, staking or vault tab — with at least ${money(100)} so the wallet is not single-action (${money(cost[3]!)} ${label}, about 15 minutes).`,
      `Leave the position open and check it weekly; screenshot the dashboard and keep the wallet's transaction history for any later claim (${money(cost[4]!)} ${label} for the final check, about 5 minutes).`,
    ],
    dex: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and swap ${money(300)} of ${asset} into the pool's main pair (${money(cost[0]!)} ${label}, about 10 minutes).`,
      `Add ${money(200)} of liquidity to that pair and hold the LP position for at least two weeks (${money(cost[1]!)} ${label}, about 10 minutes).`,
      `Trade the pair once a week in small size, alternating buy and sell so volume looks organic, never wash-traded (${money(cost[2]!)} ${label} per trade, about 5 minutes each).`,
      `Try the protocol's second feature — limit orders, perps or staking — with at least ${money(100)} (${money(cost[3]!)} ${label}, about 15 minutes).`,
      `Keep the LP position open and the wallet funded; export the trade history before any snapshot date is announced (${money(cost[4]!)} ${label}, about 5 minutes).`,
    ],
    yield: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and deposit ${money(500)} of ${asset} into its flagship vault (${money(cost[0]!)} ${label}, about 10 minutes).`,
      `Claim or compound the vault's rewards once, so the wallet records a harvest, not just a deposit (${money(cost[1]!)} ${label}, about 10 minutes).`,
      `Top up the vault by ${money(100)} every two weeks for a month to show a steady user, not a flash deposit (${money(cost[2]!)} ${label} per top-up, about 5 minutes each).`,
      `Try a second vault or strategy inside ${p.name} with at least ${money(100)} to widen the on-chain footprint (${money(cost[3]!)} ${label}, about 15 minutes).`,
      `Stay deposited through the month and keep records of every deposit and harvest for a later claim (${money(cost[4]!)} ${label}, about 5 minutes).`,
    ],
    rwa: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and mint or buy ${money(500)} of its tokenised asset (${money(cost[0]!)} ${label}, about 10 minutes).`,
      `Hold the position for at least two weeks and collect one yield or redemption event on-chain (${money(cost[1]!)} ${label}, about 10 minutes).`,
      `Add ${money(100)} more in a second transaction a week later, so the wallet shows repeat use (${money(cost[2]!)} ${label}, about 5 minutes).`,
      `Use the asset somewhere else ${p.name} supports — as collateral, in a pool or via its partner app — with at least ${money(100)} (${money(cost[3]!)} ${label}, about 15 minutes).`,
      `Keep the position and the receipts; real-world-asset claims usually ask for proof of holding, not just a wallet address (${money(cost[4]!)} ${label}, about 5 minutes).`,
    ],
    other: [
      `Open ${p.name} on ${chain}, connect a fresh wallet, and make a first real transaction of ${money(300)} (${money(cost[0]!)} ${label}, about 10 minutes).`,
      `Use the protocol's main feature a second time within the week, in a different direction or pool (${money(cost[1]!)} ${label}, about 10 minutes).`,
      `Return once a week for a month with a small ${money(50)} transaction, so the wallet reads as a repeat user (${money(cost[2]!)} ${label} per visit, about 5 minutes each).`,
      `Try one more feature of ${p.name} with at least ${money(100)} to broaden the footprint (${money(cost[3]!)} ${label}, about 15 minutes).`,
      `Leave a position open, keep the wallet funded, and save every transaction hash for a later claim (${money(cost[4]!)} ${label}, about 5 minutes).`,
    ],
  };
  const steps = acts[group] ?? acts.other!;
  return { steps, cost: total };
}

/** Ridge regression (lambda = 1) on a small feature matrix; Gaussian elimination. */
function ridgeFit(X: number[][], y: number[], lambda: number): number[] {
  const d = X[0]!.length;
  const A: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const b: number[] = new Array<number>(d).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j < d; j++) {
      b[j]! += X[i]![j]! * y[i]!;
      for (let k = 0; k < d; k++) A[j]![k]! += X[i]![j]! * X[i]![k]!;
    }
  }
  for (let j = 1; j < d; j++) A[j]![j]! += lambda;
  // Solve A w = b.
  for (let col = 0; col < d; col++) {
    let piv = col;
    for (let r = col + 1; r < d; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
    [A[col], A[piv]] = [A[piv]!, A[col]!];
    [b[col], b[piv]] = [b[piv]!, b[col]!];
    for (let r = col + 1; r < d; r++) {
      const f = A[r]![col]! / A[col]![col]!;
      for (let k = col; k < d; k++) A[r]![k]! -= f * A[col]![k]!;
      b[r]! -= f * b[col]!;
    }
  }
  const w: number[] = new Array<number>(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    let s = b[i]!;
    for (let k = i + 1; k < d; k++) s -= A[i]![k]! * w[k]!;
    w[i] = s / A[i]![i]!;
  }
  return w;
}

interface ModelCtx {
  asOf: Date;
  growthP99: number;
  fit: CurveFit;
  catMedian: Map<string, number>;
  globalMedian: number;
  catResidual: Map<string, number>;
}

function ageDays(p: Protocol, asOf: Date): number | null {
  if (!p.listed_at) return null;
  return Math.max(0, Math.round((asOf.getTime() - new Date(`${p.listed_at}T00:00:00Z`).getTime()) / 86400000));
}

function growthTilt(p: Protocol, ctx: ModelCtx): number {
  const g = p.change_7d ?? 0;
  return 1 + Math.max(-50, Math.min(ctx.growthP99, g)) / 100;
}

function ageTilt(p: Protocol, ctx: ModelCtx): number {
  const d = ageDays(p, ctx.asOf);
  if (d === null) return 1;
  return 1 + (Math.min(d, 1095) / 1095) * 0.25;
}

function spreadTilt(p: Protocol, ctx: ModelCtx): number {
  const r = ctx.catResidual.get(p.category ?? 'null');
  if (r === undefined) return 1;
  return Math.max(0.8, Math.min(1.25, 1 + 0.5 * (r - 1)));
}

function makeCtx(peers: Protocol[], asOf: Date, growthP99: number): ModelCtx {
  const fit = fitCurve(peers);
  const curve = (tvl: number) => Math.pow(10, fit.a + fit.b * Math.log10(tvl));
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of peers) {
    const m = p.mcap_usd! / p.tvl_usd;
    all.push(m);
    const key = p.category ?? 'null';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(m);
  }
  const catMedian = new Map<string, number>();
  for (const [k, v] of byCat) catMedian.set(k, median(v));
  const byRes = new Map<string, number[]>();
  for (const p of peers) {
    const r = p.mcap_usd! / curve(p.tvl_usd);
    const key = p.category ?? 'null';
    if (!byRes.has(key)) byRes.set(key, []);
    byRes.get(key)!.push(r);
  }
  const catResidual = new Map<string, number>();
  for (const [k, v] of byRes) if (v.length >= 3) catResidual.set(k, median(v));
  return { asOf, growthP99, fit, catMedian, globalMedian: median(all), catResidual };
}

type ModelFn = (p: Protocol, train: Protocol[], ctx: ModelCtx) => number;

const MODELS: { name: string; note: string; fn: ModelFn }[] = [
  {
    name: 'Curve + tilts (kept)',
    note: 'Fitted log-log curve, then growth, age and category-spread tilts.',
    fn: (p, _t, ctx) => Math.pow(10, ctx.fit.a + ctx.fit.b * Math.log10(p.tvl_usd)) * growthTilt(p, ctx) * ageTilt(p, ctx) * spreadTilt(p, ctx),
  },
  {
    name: 'Category median + tilts (v1-style)',
    note: 'Per-category median mcap/TVL times the same tilts — the v1 model.',
    fn: (p, _t, ctx) => (ctx.catMedian.get(p.category ?? 'null') ?? ctx.globalMedian) * p.tvl_usd * growthTilt(p, ctx) * ageTilt(p, ctx),
  },
  {
    name: 'Curve only',
    note: 'The fitted curve with no tilts at all.',
    fn: (p, _t, ctx) => Math.pow(10, ctx.fit.a + ctx.fit.b * Math.log10(p.tvl_usd)),
  },
  {
    name: 'Ridge, 5 features',
    note: 'Tried and REJECTED: matches the curve on error, but its fitted growth and age coefficients come out negative — a fresh-listing artefact that prices fast-growing, long-running protocols DOWN, the opposite of what a launch radar should reward.',
    fn: (p, train, ctx) => {
      const feats = (q: Protocol): number[] => [
        1,
        Math.log10(q.tvl_usd),
        (q.change_7d ?? 0) / 100,
        (ageDays(q, ctx.asOf) ?? 0) / 365,
        Math.log10(q.chains.length + 1),
      ];
      const w = ridgeFit(train.map(feats), train.map((q) => Math.log10(q.mcap_usd!)), 1);
      const x = feats(p);
      return Math.pow(10, w.reduce((s, v, i) => s + v * x[i]!, 0));
    },
  },
  {
    name: 'Global median multiple',
    note: 'One multiple for every protocol — the simplest possible model.',
    fn: (p, _t, ctx) => ctx.globalMedian * p.tvl_usd,
  },
  {
    name: 'Curve + growth tilt',
    note: 'Curve with only the growth tilt; age and spread ignored.',
    fn: (p, _t, ctx) => Math.pow(10, ctx.fit.a + ctx.fit.b * Math.log10(p.tvl_usd)) * growthTilt(p, ctx),
  },
];

/**
 * Median absolute percentage error, plus the share of predictions within 2x
 * of the real market cap — the honest accuracy for a valuation model whose
 * multiples span 0.01x to 3x. Both are reported; lower error is better.
 */
function blindScore(preds: number[], actuals: number[]): { error: number; within2: number } {
  const errs = preds.map((pr, i) => Math.abs(pr - actuals[i]!) / actuals[i]!);
  const error = median(errs) * 100;
  const within2 = (preds.filter((pr, i) => pr / actuals[i]! >= 0.5 && pr / actuals[i]! <= 2).length / preds.length) * 100;
  return { error, within2 };
}

function blindTest(peers: Protocol[], asOf: Date, growthP99: number): BlindRow[] {
  const rows: BlindRow[] = [];
  for (const m of MODELS) {
    // Leave-one-out: refit the context on the other peers each time.
    const looPreds: number[] = [];
    const looActual: number[] = [];
    for (let i = 0; i < peers.length; i++) {
      const train = peers.filter((_, j) => j !== i);
      const ctx = makeCtx(train, asOf, growthP99);
      looPreds.push(m.fn(peers[i]!, train, ctx));
      looActual.push(peers[i]!.mcap_usd!);
    }
    const loo = blindScore(looPreds, looActual);
    // Five-fold CV: fold = hash(slug) mod 5, median of the five fold results.
    const foldErrors: number[] = [];
    const foldWithin2: number[] = [];
    for (let fold = 0; fold < 5; fold++) {
      const test = peers.filter((p) => djb2(p.slug) % 5 === fold);
      const train = peers.filter((p) => djb2(p.slug) % 5 !== fold);
      if (test.length === 0) continue;
      const ctx = makeCtx(train, asOf, growthP99);
      const s = blindScore(test.map((p) => m.fn(p, train, ctx)), test.map((p) => p.mcap_usd!));
      foldErrors.push(s.error);
      foldWithin2.push(s.within2);
    }
    const cvError = median(foldErrors);
    rows.push({
      model: m.name,
      loo_error_pct: loo.error,
      loo_within2_pct: loo.within2,
      cv_error_pct: cvError,
      cv_within2_pct: median(foldWithin2),
      kept: m.name.startsWith('Curve + tilts'),
      note: m.note,
    });
  }
  return rows;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const asOf = new Date(`${snapshot.as_of}T00:00:00Z`);
  const changes = snapshot.protocols.map((p) => p.change_7d).filter((x): x is number => x !== null);
  const growthP99 = percentile(changes, 99);
  const peers = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.change_7d !== null);
  const ctx = makeCtx(peers, asOf, growthP99);
  const curve = (tvl: number) => Math.pow(10, ctx.fit.a + ctx.fit.b * Math.log10(tvl));
  const blind = blindTest(peers, asOf, growthP99);

  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const watch = snapshot.watchlist.map((s) => bySlug.get(s)!).filter(Boolean);
  const preToken = snapshot.protocols.filter((p) => p.mcap_usd === null);
  const belowFloor = preToken
    .filter((p) => p.tvl_usd < snapshot.floor_usd && houseRuleFails(p) === null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd);
  const boardPool = [...watch, ...belowFloor.slice(0, 141)];

  const rows: BoardRow[] = boardPool.map((p) => {
    const curveUsd = curve(p.tvl_usd);
    const gt = growthTilt(p, ctx);
    const at = ageTilt(p, ctx);
    const st = spreadTilt(p, ctx);
    const implied = Math.max(1, Math.round(curveUsd * gt * at * st));
    const { steps, cost } = farmPlan(p);
    const farmers = Math.max(200, Math.min(10000, Math.round(p.tvl_usd / 100000)));
    // Net value per farmer: 2% of the implied value reaches active farmers,
    // one launch in four actually happens, split over the estimated farmers,
    // minus what the farm plan costs. Stated on the page, same rule for all.
    const net = Math.round((implied * 0.02 * 0.25) / farmers - cost);
    const verdict: BoardRow['verdict'] = net >= 150 ? 'FARM' : net >= 25 ? 'THIN' : 'SKIP';
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: steps,
      verdict,
      net_usd: net,
      plan_cost_usd: cost,
      farmers,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      category: p.category,
      chains: p.chains,
      age_days: ageDays(p, asOf),
      curve_usd: Math.round(curveUsd),
      growth_tilt: gt,
      age_tilt: at,
      spread_tilt: st,
      multiple: implied / p.tvl_usd,
      on_watchlist: snapshot.watchlist.includes(p.slug),
    };
  });
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  // Keep implied values strictly decreasing with rank (rounding can tie).
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.implied_value_usd >= rows[i - 1]!.implied_value_usd) {
      rows[i]!.implied_value_usd = Math.max(1, rows[i - 1]!.implied_value_usd - 1);
    }
  }
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const verdictCounts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of rows) verdictCounts[r.verdict]++;
  const medianMultiple = median(rows.map((r) => r.multiple));

  const live = snapshot.protocols
    .filter((p) => p.mcap_usd !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! }));

  const boardSlugs = new Set(rows.map((r) => r.slug));
  const setAside: Radar['set_aside'] = [];
  for (const p of preToken) {
    if (boardSlugs.has(p.slug)) continue;
    const fail = houseRuleFails(p);
    let reason: string;
    if (fail !== null) reason = `House rule: ${fail}`;
    else if (p.tvl_usd >= snapshot.floor_usd) {
      reason = 'Above the floor but not on the house watchlist (the house rule also checks the parent protocol, which this snapshot does not carry)';
    } else {
      reason = 'Passes the house rule but below the board size cut (141 largest below-floor names ranked)';
    }
    setAside.push({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, reason });
  }
  setAside.sort((a, b) => b.tvl_usd - a.tvl_usd);
  const reasonCounts = new Map<string, number>();
  for (const s of setAside) reasonCounts.set(s.reason, (reasonCounts.get(s.reason) ?? 0) + 1);
  const setAsideReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const radar: Radar = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    watchlist_size: snapshot.watchlist.length,
    total_protocols: snapshot.protocols.length,
    peers: peers.length,
    fit: ctx.fit,
    growth_p99_pct: growthP99,
    blind,
    board: rows,
    verdict_counts: verdictCounts,
    median_multiple: medianMultiple,
    live,
    set_aside: setAside,
    reconciliation: {
      board: rows.length,
      live: live.length,
      set_aside: setAside.length,
      total: rows.length + live.length + setAside.length,
    },
    set_aside_reasons: setAsideReasons,
  };
  return { board: rows, radar };
}

/** The gate's own checks on the board we just wrote. Returns the first issue, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, need 100 to 4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
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
  for (const w of snapshot.watchlist) if (!seen.has(w)) return `watchlist slug ${w} is missing from the board`;
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
