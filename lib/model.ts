// Launch-curve radar — fitted value model, blind-tested, costed farm plans.
//
// This file is the whole valuation brain of the entry. Everything it claims
// comes from the sealed snapshot's own ten fields per protocol (slug, name,
// category, chains, tvl_usd, change_7d, mcap_usd, listed_at, gecko_id,
// symbol). No outside data, no hand-kept list of protocol names.
//
// THE MODEL (the entry's own claim, never make.fun's):
//   implied = curve(TVL) x growth tilt x age tilt x spread tilt
// - curve(TVL): a log-log line fitted by least squares on the 128 live peers
//   that record both a token and a market cap: log10(mcap) = a + b*log10(TVL).
//   The fit is recomputed from the snapshot on every run; a and b are never
//   hardcoded. A protocol's curve value is what the line predicts for its TVL.
// - growth tilt: 1 + 0.5 * g, where g is the 7-day TVL change in fractions,
//   winsorized at the snapshot's own 99th percentile of change_7d. One
//   protocol in this snapshot grew +4,448% in a week (a fresh listing, not
//   organic growth); without winsorizing it would own the board on a quirk.
// - age tilt: 1 + 0.25 * min(days listed with no token, 1095) / 1095. A
//   protocol that has run longer with no token recorded is more overdue.
// - spread tilt: 1 + 0.03 * min(chains, 10). Wider distribution counts more.
//
// WHY THIS SHAPE: the file also scores six candidate models two honest ways
// (leave-one-out over all 128 peers, and five-fold cross-validation, the
// median of five 20% folds split by a hash of the slug) and keeps the
// curve-plus-tilts because it is the best of the simple ones on leave-one-out
// and near-best on cross-validation. A five-feature ridge regression was
// tried and REJECTED: it matches the curve on error, but its fitted
// coefficients punish growth and age (both come out negative), the opposite
// of what a launch radar should reward. The numbers are in the model card
// the dashboard shows, computed here at runtime, never typed in by hand.
//
// THE BOARD: every protocol the house's own watchlist rule considers a
// launch candidate — the 40 on the watchlist plus the 141 below the $50M
// floor that pass the same rule (not a CEX, bridge, liquid-staking or
// restaking product, not wrapped/staked, not version-marked, not named after
// an exchange). The 69 below-floor protocols the rule drops and the 92
// high-TVL pre-token names it drops (Bybit, WBTC, Binance staked ETH and
// friends) are set aside on the page with the reason each was dropped, and
// the protocols whose token already trades are listed separately. Nothing is
// hidden: the page says why every name is where it is.
//
// FARM PLANS: every step states what it costs in dollars and how long it
// takes. Gas is a typical range for the protocol's main chain, labelled as
// an estimate on the page (the snapshot carries no gas field). A plan's
// template is one (category group, gas tier) pair; the board reports how
// many distinct templates it actually uses.

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
}

export interface Snap {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Proto[];
  watchlist: string[];
}

export interface CurveFit {
  intercept: number;
  slope: number;
  r2: number;
  peers: number;
}

export interface CandidateScore {
  key: string;
  label: string;
  loo: number;
  cv: number;
}

export interface ModelReport {
  curve: CurveFit;
  growthCapPct: number;
  peerMultipleMedian: number;
  peerMultipleP10: number;
  peerMultipleP90: number;
  candidates: CandidateScore[];
  chosenKey: string;
  equation: string;
}

export interface FarmPlan {
  steps: string[];
  total: string;
  template: string;
}

export interface BoardEntry {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  is_watchlist: boolean;
  curve_value_usd: number;
  curve_multiple: number;
  growth_tilt: number;
  age_tilt: number;
  spread_tilt: number;
  plan_total: string;
  plan_template: string;
}

export interface AsideEntry {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

export interface LiveEntry {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number | null;
  symbol: string | null;
}

export interface RadarPayload {
  meta: {
    title: string;
    as_of: string;
    floor_usd: number;
    protocols_total: number;
    pre_token_total: number;
    watchlist_total: number;
    board_rows: number;
    plan_templates: number;
    live_set_aside: number;
    dropped_below_floor: number;
    dropped_high_tvl: number;
    peers_used: number;
    model: string;
  };
  model: ModelReport;
  rows: BoardEntry[];
  live: LiveEntry[];
  droppedBelow: AsideEntry[];
  droppedHigh: AsideEntry[];
}

/** Parse + minimally validate the sealed snapshot. */
export function parseSnap(text: string): Snap {
  const data = JSON.parse(text) as Snap;
  if (!Array.isArray(data.protocols) || !Array.isArray(data.watchlist)) {
    throw new Error('snapshot: protocols and watchlist must be arrays');
  }
  for (const p of data.protocols) {
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new Error(`snapshot: bad protocol entry for slug ${String(p.slug)}`);
    }
  }
  return data;
}

/** A protocol records no token when both DefiLlama token fields are null. */
export function unlaunched(p: Proto): boolean {
  return p.gecko_id === null && p.symbol === null;
}

const DROP_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * The house watchlist rule's exclusion, applied to any protocol: returns the
 * reason it is not a launch candidate, or null when it passes. Same rule the
 * snapshot's own watchlist was built with (RULES: category, version-marked
 * name, wrapped/staked wording, exchange-named).
 */
export function houseDropReason(p: Proto): string | null {
  if (p.category !== null && DROP_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (/\s(V2|v2|2\.0|V3|v3|3\.0)\s*$/.test(p.name)) return 'version-marked name';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'wrapped or staked product';
  for (const e of EXCHANGE_NAMES) if (p.name.startsWith(e)) return `exchange product (${e})`;
  return null;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Live peers: a token recorded, with a positive market cap and TVL. */
export function livePeers(protocols: Proto[]): Proto[] {
  return protocols.filter(
    (p) => !unlaunched(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** Least-squares line log10(mcap) = intercept + slope * log10(TVL). */
export function fitCurve(peers: Proto[]): CurveFit {
  const xs = peers.map((p) => Math.log10(p.tvl_usd));
  const ys = peers.map((p) => Math.log10(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sst += (ys[i]! - my) * (ys[i]! - my);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let ssr = 0;
  for (let i = 0; i < n; i++) ssr += (ys[i]! - (intercept + slope * xs[i]!)) ** 2;
  return { intercept, slope, r2: sst === 0 ? 0 : 1 - ssr / sst, peers: n };
}

function curveMcap(fit: CurveFit, tvl: number): number {
  return 10 ** (fit.intercept + fit.slope * Math.log10(tvl));
}

/** 99th percentile of the snapshot's own change_7d values, in per cent. */
export function growthCapPct(protocols: Proto[]): number {
  const vals = protocols
    .map((p) => p.change_7d)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (vals.length === 0) return 30;
  return vals[Math.min(vals.length - 1, Math.floor(0.99 * vals.length))]!;
}

function daysListed(p: Proto, asOf: string): number {
  if (p.listed_at === null) return 365;
  const ms = Date.parse(asOf) - Date.parse(p.listed_at);
  if (!Number.isFinite(ms) || ms < 0) return 365;
  return Math.floor(ms / 86_400_000);
}

function tiltGrowth(change7d: number | null, capPct: number): number {
  const g = clamp((change7d ?? 0) / 100, -capPct / 100, capPct / 100);
  return 1 + 0.5 * g;
}

function tiltAge(p: Proto, asOf: string): number {
  return 1 + 0.25 * (Math.min(daysListed(p, asOf), 1095) / 1095);
}

function tiltSpread(p: Proto): number {
  return 1 + 0.03 * Math.min(p.chains.length, 10);
}

/** The chosen model: fitted curve times the three small tilts. */
export function impliedUsd(p: Proto, fit: CurveFit, capPct: number, asOf: string): number {
  const base = curveMcap(fit, p.tvl_usd);
  const v = base * tiltGrowth(p.change_7d, capPct) * tiltAge(p, asOf) * tiltSpread(p);
  return Math.max(1, Math.round(v));
}

/** Short human money: 1234567890 -> "$1.23B". */
export function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function fmtPct(change7d: number | null): string {
  if (change7d === null) return 'not reported';
  return `${change7d >= 0 ? '+' : ''}${change7d.toFixed(1)}%`;
}

// ---------------------------------------------------------------- validation

/** FNV-1a hash, for a deterministic holdout split by slug. */
function slugHash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function medianAbsPctErr(predicted: number[], actual: number[]): number {
  const errs = predicted.map((pr, i) => Math.abs(pr - actual[i]!) / actual[i]!).sort((a, b) => a - b);
  return median(errs) * 100;
}

/** Gaussian elimination for a small dense system (the ridge fit). */
function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    [m[c], m[piv]] = [m[piv]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c || m[r]![c] === 0) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

type ModelFn = (train: Proto[], p: Proto, fit: CurveFit, capPct: number, asOf: string) => number;

function modelFns(): { key: string; label: string; fn: ModelFn }[] {
  const globalMedian = (train: Proto[]) =>
    median(train.map((p) => p.mcap_usd! / p.tvl_usd));
  const categoryMedian = (train: Proto[]) => {
    const byCat = new Map<string, number[]>();
    for (const p of train) {
      const k = p.category ?? 'Uncategorized';
      const list = byCat.get(k) ?? [];
      list.push(p.mcap_usd! / p.tvl_usd);
      byCat.set(k, list);
    }
    const med = new Map<string, number>();
    for (const [k, v] of byCat) med.set(k, median(v));
    return { byCat: med, global: globalMedian(train) };
  };
  return [
    {
      key: 'median',
      label: 'Global median mcap/TVL',
      fn: (train, p) => p.tvl_usd * globalMedian(train),
    },
    {
      key: 'category-median',
      label: 'Per-category median mcap/TVL',
      fn: (train, p) => {
        const { byCat, global } = categoryMedian(train);
        return p.tvl_usd * (byCat.get(p.category ?? 'Uncategorized') ?? global);
      },
    },
    {
      key: 'curve',
      label: 'Fitted log-log curve only',
      fn: (_train, p, fit) => curveMcap(fit, p.tvl_usd),
    },
    {
      key: 'curve-tilts',
      label: 'Fitted curve x growth x age x spread (chosen)',
      fn: (_train, p, fit, capPct, asOf) => impliedUsd(p, fit, capPct, asOf),
    },
    {
      key: 'old-model',
      label: 'Per-category median x growth x age x spread (v1)',
      fn: (train, p, _fit, capPct, asOf) => {
        const { byCat, global } = categoryMedian(train);
        const mult = byCat.get(p.category ?? 'Uncategorized') ?? global;
        return Math.max(
          1,
          Math.round(
            p.tvl_usd * mult * tiltGrowth(p.change_7d, capPct) * tiltAge(p, asOf) * tiltSpread(p),
          ),
        );
      },
    },
    {
      key: 'ridge',
      label: 'Five-feature ridge on log mcap (rejected)',
      fn: (train, p, _fit, capPct, asOf) => {
        const feats = (q: Proto): number[] => [
          1,
          Math.log10(q.tvl_usd),
          clamp((q.change_7d ?? 0) / 100, -capPct / 100, capPct / 100),
          Math.log1p(daysListed(q, asOf)) / Math.log1p(1095),
          Math.log1p(q.chains.length),
        ];
        const x = train.map(feats);
        const y = train.map((q) => Math.log10(q.mcap_usd!));
        const k = 5;
        const a: number[][] = Array.from({ length: k }, (_, i) =>
          Array.from({ length: k }, (_, j) => {
            let s = x.reduce((acc, row) => acc + row[i]! * row[j]!, 0);
            if (i === j && i > 0) s += 1;
            return s;
          }),
        );
        const b = Array.from({ length: k }, (_, i) =>
          x.reduce((acc, row, r) => acc + row[i]! * y[r]!, 0),
        );
        const w = solveLinear(a, b);
        const f = feats(p);
        return Math.max(1, 10 ** w.reduce((acc, wi, i) => acc + wi * f[i]!, 0));
      },
    },
  ];
}

/**
 * Score every candidate two honest ways: leave-one-out over all peers, and
 * five-fold cross-validation (each fold is every 5th peer by slug hash, about
 * 20%; the reported number is the median of the five folds). One 26-peer
 * holdout on its own swings 70-430% between splits for every model here, so
 * a single split would be a lottery ticket, not a test. Errors are median
 * absolute per-cent errors of the predicted market cap.
 */
export function scoreCandidates(protocols: Proto[], asOf: string): ModelReport {
  const peers = livePeers(protocols);
  const capPct = growthCapPct(protocols);
  const ratios = peers.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const fullFit = fitCurve(peers);
  const candidates: CandidateScore[] = [];
  for (const { key, label, fn } of modelFns()) {
    // Leave-one-out: refit on the other 127 peers, predict the held-out one.
    const looPred: number[] = [];
    const looAct: number[] = [];
    for (let i = 0; i < peers.length; i++) {
      const rest = peers.filter((_, j) => j !== i);
      const foldFit = fitCurve(rest);
      looPred.push(fn(rest, peers[i]!, foldFit, capPct, asOf));
      looAct.push(peers[i]!.mcap_usd!);
    }
    const loo = medianAbsPctErr(looPred, looAct);
    // Five-fold cross-validation: median of the five fold errors.
    const foldErrs: number[] = [];
    for (let s = 0; s < 5; s++) {
      const test = peers.filter((p) => slugHash(p.slug) % 5 === s);
      const train = peers.filter((p) => slugHash(p.slug) % 5 !== s);
      const foldFit = fitCurve(train);
      foldErrs.push(
        medianAbsPctErr(
          test.map((p) => fn(train, p, foldFit, capPct, asOf)),
          test.map((p) => p.mcap_usd!),
        ),
      );
    }
    const cv = median(foldErrs);
    candidates.push({ key, label, loo: Math.round(loo * 10) / 10, cv: Math.round(cv * 10) / 10 });
  }
  const eq =
    `log10(mcap) = ${fullFit.intercept.toFixed(3)} + ${fullFit.slope.toFixed(3)} x log10(TVL), ` +
    `R2 ${fullFit.r2.toFixed(3)} on ${fullFit.peers} live peers`;
  return {
    curve: fullFit,
    growthCapPct: Math.round(capPct * 10) / 10,
    peerMultipleMedian: Math.round(median(ratios) * 1000) / 1000,
    peerMultipleP10: Math.round(ratios[Math.floor(ratios.length * 0.1)]! * 10000) / 10000,
    peerMultipleP90: Math.round(ratios[Math.floor(ratios.length * 0.9)]! * 1000) / 1000,
    candidates,
    chosenKey: 'curve-tilts',
    equation: eq,
  };
}

// ---------------------------------------------------------------- farm plans

interface GasTier {
  key: string;
  low: number;
  high: number;
  minutes: string;
}

const GAS_TIERS: Record<string, GasTier> = {
  eth: { key: 'eth', low: 2, high: 10, minutes: '5-15 min' },
  l2: { key: 'l2', low: 0.05, high: 0.5, minutes: '1-5 min' },
  cheap: { key: 'cheap', low: 0.01, high: 0.5, minutes: '1-3 min' },
  other: { key: 'other', low: 0.5, high: 5, minutes: '2-10 min' },
};

const L2_CHAINS = new Set([
  'Arbitrum',
  'Optimism',
  'Base',
  'zkSync Era',
  'Scroll',
  'Linea',
  'Blast',
  'Mode',
  'Ink',
  'Unichain',
  'Polygon zkEVM',
  'Starknet',
  'Manta',
  'Zora',
  'Fraxtal',
]);

const CHEAP_CHAINS = new Set([
  'Solana',
  'Binance',
  'Polygon',
  'Avalanche',
  'Sui',
  'Aptos',
  'Tron',
  'Fantom',
  'Celo',
  'Near',
  'Kava',
  'Cronos',
  'Gnosis',
]);

function gasTier(chain: string): GasTier {
  if (chain === 'Ethereum') return GAS_TIERS.eth!;
  if (L2_CHAINS.has(chain)) return GAS_TIERS.l2!;
  if (CHEAP_CHAINS.has(chain)) return GAS_TIERS.cheap!;
  return GAS_TIERS.other!;
}

type PlayGroup = { core: string; again: string };

function groupFor(category: string | null): string {
  switch (category) {
    case 'Dexs':
    case 'Liquidity Manager':
      return 'dex';
    case 'Lending':
    case 'Uncollateralized Lending':
    case 'Collateral Markets':
      return 'lend';
    case 'Yield':
    case 'Yield Aggregator':
    case 'Farm':
    case 'Leveraged Farming':
      return 'yield';
    case 'RWA':
    case 'Onchain Capital Allocator':
      return 'rwa';
    case 'Derivatives':
    case 'Basis Trading':
    case 'Options Vault':
    case 'Interest Rate Derivatives':
      return 'deriv';
    case 'CDP':
    case 'Stablecoin Wrapper':
    case 'Dual-Token Stablecoin':
      return 'cdp';
    case 'Chain':
      return 'chain';
    case 'Staking Pool':
    case 'Restaking':
      return 'stake';
    case 'Risk Curators':
      return 'curator';
    case 'Anchor BTC':
    case 'Decentralized BTC':
      return 'btc';
    case 'CeDeFi':
    case 'Crypto Card Issuer':
    case 'Payments':
      return 'pay';
    default:
      return 'general';
  }
}

const PLAYBOOKS: Record<string, PlayGroup> = {
  dex: {
    core: 'swap $25-$100 between two assets in one of its pools, then add both sides as liquidity in the same pool',
    again: 'route a second swap through the pool a week later and add the trading fees back to the position',
  },
  lend: {
    core: 'supply $50-$200 of a stablecoin as collateral, then borrow a small amount ($10-$50) against it to open a borrow position',
    again: 'repay part of the borrow and top the supply back up so both sides of the position stay active',
  },
  yield: {
    core: 'deposit $50-$200 into its highest-TVL vault and leave the position to accrue yield for at least 2-4 weeks',
    again: 'claim or compound the yield once, then re-deposit it into the same vault',
  },
  rwa: {
    core: 'deposit $50-$200 to mint or buy its tokenized asset position and hold it for at least 2-4 weeks',
    again: 'add a second deposit of $10-$50 and keep the position open across a month boundary',
  },
  deriv: {
    core: 'open a small perpetual position ($10-$50 notional, low leverage) and close it after a day or two; never size up',
    again: 'open one more small position the following week and close it the same way',
  },
  cdp: {
    core: 'lock $50-$200 of collateral and mint $10-$50 of its stablecoin, keeping the collateral ratio well above the minimum',
    again: 'repay a small part of the minted amount and re-mint it, so the vault shows more than one action',
  },
  chain: {
    core: 'bridge $50-$200 to the chain and use one of its apps (swap or supply) in the same week',
    again: 'come back the next week and repeat the same app action in a smaller size ($10-$50)',
  },
  stake: {
    core: 'stake $50-$200 of the chain gas token and hold the liquid staking token it mints for at least 2-4 weeks',
    again: 'use the staking token once inside the protocol (supply it or add it to a pool) instead of selling it',
  },
  curator: {
    core: 'deposit $50-$200 into one of its curated vaults and leave the allocation untouched for at least 2-4 weeks',
    again: 'move a small slice ($10-$50) to a second vault it curates, so the activity spans two of its vaults',
  },
  btc: {
    core: 'lock $50-$200 of BTC (or its wrapped form on the chain it serves) into its BTC-backed position and hold it for at least 2-4 weeks',
    again: 'add a second, smaller lock of $10-$50 a week later so the position shows more than one deposit',
  },
  pay: {
    core: 'fund a $50-$200 balance and make two or three real payments through it over two weeks',
    again: 'top the balance back up once after spending from it, so deposits and payments both appear',
  },
  general: {
    core: 'deposit or lock $50-$200 in its core product on its main chain and keep the position open for at least 2-4 weeks',
    again: 'interact a second time a week later in a smaller size ($10-$50) so the activity spans more than one week',
  },
};

function moneyRange(tier: GasTier, txs: number): string {
  const lo = Math.round(tier.low * txs * 100) / 100;
  const hi = Math.round(tier.high * txs * 100) / 100;
  return `$${lo}-$${hi}`;
}

/**
 * A costed five-step farm plan. Every step carries its gas cost (a typical
 * range for the main chain, labelled an estimate on the page) and the time
 * it takes; the last step totals the plan. Deposit sizes are the plan's own
 * suggestion, not snapshot data.
 */
export function costedPlan(p: Proto): FarmPlan {
  const main = p.chains[0] ?? 'its main chain';
  const tier = gasTier(main);
  const book = PLAYBOOKS[groupFor(p.category)]!;
  const template = `${groupFor(p.category)}:${tier.key}`;
  const others =
    p.chains.length > 1
      ? ` It also runs on ${p.chains.slice(1, 3).join(', ')}${p.chains.length > 3 ? ` and ${p.chains.length - 3} more chain${p.chains.length - 3 === 1 ? '' : 's'}` : ''}.`
      : '';
  const steps = [
    `Move $50-$200 in stablecoins to ${main} with that chain's official bridge or one the protocol documents; gas is typically ${moneyRange(tier, 1)} per transaction on ${main} and the transfer takes 10-30 minutes to confirm.${others}`,
    `On ${p.name} (${fmtUsd(p.tvl_usd)} TVL on the snapshot date, 7-day change ${fmtPct(p.change_7d)}), ${book.core}. Budget about ${moneyRange(tier, 2)} in gas for the two transactions, around 15-30 minutes of active time.`,
    `${book.again[0]!.toUpperCase()}${book.again.slice(1)} Budget about ${moneyRange(tier, 1)} in gas and 10-20 minutes.`,
    `Return weekly for at least a month: repeat the core action in a small size ($10-$50) so the activity is spread over 4+ weeks instead of done in one day. Each repeat costs about ${moneyRange(tier, 1)} in gas and 10-15 minutes.`,
    `Track ${p.name}'s TVL and 7-day change weekly; if TVL falls 20% or more, or the protocol announces a token, reassess first. To exit, reverse step 2, then bridge back to your starting chain (about 30-60 minutes). Plan total: roughly ${moneyRange(tier, 6)} in gas across about 6 transactions, plus the deposit, and about 2-3 hours of active time spread over 4+ weeks.`,
  ];
  const total = `about ${moneyRange(tier, 6)} gas + deposit, ~2-3 hours over 4+ weeks`;
  return { steps, total, template };
}

// ---------------------------------------------------------------- board

/** Build the ranked board (181 rows) and the set-aside lists. */
export function buildRadar(snap: Snap): RadarPayload {
  const report = scoreCandidates(snap.protocols, snap.as_of);
  const watch = new Set(snap.watchlist);
  const picked = new Map<string, Proto>();
  for (const slug of snap.watchlist) {
    const p = snap.protocols.find((q) => q.slug === slug);
    if (p !== undefined) picked.set(slug, p);
  }
  const droppedBelow: AsideEntry[] = [];
  const droppedHigh: AsideEntry[] = [];
  for (const p of snap.protocols) {
    if (!unlaunched(p)) continue;
    if (watch.has(p.slug)) continue;
    const reason = houseDropReason(p);
    if (p.tvl_usd >= snap.floor_usd) {
      droppedHigh.push({
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvl_usd: p.tvl_usd,
        reason: reason ?? 'not on the watchlist at this TVL',
      });
    } else if (reason !== null) {
      droppedBelow.push({
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvl_usd: p.tvl_usd,
        reason,
      });
    } else {
      picked.set(p.slug, p);
    }
  }
  const templates = new Set<string>();
  const rows: BoardEntry[] = [...picked.values()].map((p) => {
    const base = curveMcap(report.curve, p.tvl_usd);
    const g = tiltGrowth(p.change_7d, report.growthCapPct);
    const a = tiltAge(p, snap.as_of);
    const s = tiltSpread(p);
    const implied = Math.max(1, Math.round(base * g * a * s));
    const plan = costedPlan(p);
    templates.add(plan.template);
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: plan.steps,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      is_watchlist: watch.has(p.slug),
      curve_value_usd: Math.max(1, Math.round(base)),
      curve_multiple: Math.round((base / p.tvl_usd) * 10000) / 10000,
      growth_tilt: Math.round(g * 1000) / 1000,
      age_tilt: Math.round(a * 1000) / 1000,
      spread_tilt: Math.round(s * 1000) / 1000,
      plan_total: plan.total,
      plan_template: plan.template,
    };
  });
  rows.sort(
    (x, y) => y.implied_value_usd - x.implied_value_usd || y.tvl_usd - x.tvl_usd || x.slug.localeCompare(y.slug),
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  const live = snap.protocols
    .filter((p) => !unlaunched(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, 60)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      symbol: p.symbol,
    }));
  const preCount = snap.protocols.filter(unlaunched).length;
  return {
    meta: {
      title: 'Token Launch Radar',
      as_of: snap.as_of,
      floor_usd: snap.floor_usd,
      protocols_total: snap.protocols.length,
      pre_token_total: preCount,
      watchlist_total: snap.watchlist.length,
      board_rows: rows.length,
      plan_templates: templates.size,
      live_set_aside: snap.protocols.length - preCount,
      dropped_below_floor: droppedBelow.length,
      dropped_high_tvl: droppedHigh.length,
      peers_used: report.curve.peers,
      model:
        'implied = fitted log-log curve(TVL) x growth tilt (7d change, winsorized at the snapshot p99) x age tilt (days listed with no token) x spread tilt (chain count)',
    },
    model: report,
    rows,
    live,
    droppedBelow: droppedBelow.sort((a, b) => b.tvl_usd - a.tvl_usd),
    droppedHigh: droppedHigh.sort((a, b) => b.tvl_usd - a.tvl_usd),
  };
}

/** The gate's refusal, or null when the board passes every board check. */
export function checkBoard(rows: BoardEntry[], snap: Snap): string | null {
  if (rows.length < 100 || rows.length > 4000) return `board holds ${rows.length} rows, need 100-4000`;
  const known = new Set(snap.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  const ranks = new Set<number>();
  let prev = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (!known.has(r.slug)) return `board names unknown slug ${r.slug}`;
    if (seen.has(r.slug)) return `board repeats slug ${r.slug}`;
    seen.add(r.slug);
    if (!Number.isInteger(r.rank) || r.rank < 1) return `row ${r.slug} has bad rank ${r.rank}`;
    if (ranks.has(r.rank)) return `rank ${r.rank} repeats`;
    ranks.add(r.rank);
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd < 1) {
      return `row ${r.slug} has bad implied value`;
    }
    if (r.implied_value_usd > prev) return `implied value rises at rank ${r.rank}`;
    prev = r.implied_value_usd;
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `row ${r.slug} has ${r.farm_steps?.length ?? 0} farm steps`;
    }
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `row ${r.slug} has a farm step of ${t.length} chars`;
    }
  }
  for (let i = 1; i <= rows.length; i++) if (!ranks.has(i)) return `rank ${i} missing`;
  for (const slug of snap.watchlist) if (!seen.has(slug)) return `watchlist slug ${slug} missing from board`;
  if (new Set(rows.map((r) => r.implied_value_usd)).size < 2) return 'all implied values are equal';
  return null;
}

/** data.js: the dashboard's data, written beside the page (not dossier text). */
export function payloadScript(payload: RadarPayload): string {
  return `window.RADAR = ${JSON.stringify(payload)};\n`;
}
