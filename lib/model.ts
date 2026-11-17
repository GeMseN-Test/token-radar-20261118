// Token launch radar — valuation model + board builder (token-radar-01).
//
// Everything here derives from the sealed snapshot's own fields only:
// slug, name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at,
// gecko_id, symbol. No outside data, no hardcoded list of protocol names.
//
// Implied value model (the entry's own claim, never make.fun's):
//   implied = TVL x peer multiple x growth factor x chain factor x maturity factor
// - peer multiple: the median mcap/TVL of protocols in the SAME category that
//   already record a token (mcap_usd present and > 0). Categories with no live
//   peer fall back to the global median. Clamped to [0.02, 5] so one outlier
//   cannot dominate the board.
// - growth factor: 1 + 0.5 * clamp(change_7d, -0.5, 2). A protocol growing
//   fast is worth more than one shrinking; change_7d null counts as 0.
// - chain factor: 1 + 0.03 * min(chains, 10). More chains = wider distribution.
// - maturity factor: 1 + 0.25 * min(days since listed_at, 1095) / 1095.
//   A protocol that has run longer with no token recorded is "more overdue".
//   listed_at null counts as 365 days.
//
// Board: the 40 watchlist protocols plus the 160 pre-token protocols below the
// $50M floor with the most TVL (200 rows). Protocols whose token already
// trades are set aside from the board and listed separately as "live".

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
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  is_watchlist: boolean;
  peer_multiple: number;
  growth_factor: number;
  chain_factor: number;
  maturity_factor: number;
  token_status: string;
}

export interface Radar {
  meta: {
    title: string;
    as_of: string;
    floor_usd: number;
    protocols_total: number;
    pre_token_total: number;
    watchlist_total: number;
    board_rows: number;
    live_set_aside: number;
    global_peer_multiple: number;
    model: string;
  };
  rows: BoardRow[];
  live: { slug: string; name: string; category: string | null; tvl_usd: number; mcap_usd: number | null; symbol: string | null }[];
}

/** Parse + minimally validate the sealed snapshot. */
export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text) as Snapshot;
  if (!Array.isArray(data.protocols) || !Array.isArray(data.watchlist)) {
    throw new Error('snapshot: protocols/watchlist must be arrays');
  }
  for (const p of data.protocols) {
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new Error(`snapshot: bad protocol entry for slug ${String(p.slug)}`);
    }
  }
  return data;
}

/** A protocol records no token when both DefiLlama token fields are null. */
export function isPreToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median mcap/TVL per category over live protocols, plus the global median. */
export function peerMultiples(protocols: Protocol[]): { byCategory: Map<string, number>; global: number } {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Uncategorized';
    const list = byCat.get(key) ?? [];
    list.push(ratio);
    byCat.set(key, list);
  }
  const global = clamp(all.length > 0 ? median(all) : 0.2, 0.02, 5);
  const byCategory = new Map<string, number>();
  for (const [cat, ratios] of byCat) byCategory.set(cat, clamp(median(ratios), 0.02, 5));
  return { byCategory, global };
}

function growthFactor(change7d: number | null): number {
  // change_7d is in PER CENT (RULES: "its TVL's change over seven days in per cent"):
  // +5.6 means +5.6%, so divide by 100 before using it as a fraction.
  return 1 + 0.5 * clamp((change7d ?? 0) / 100, -0.5, 2);
}

function chainFactor(chains: string[]): number {
  return 1 + 0.03 * Math.min(chains.length, 10);
}

function daysSince(listedAt: string | null, asOf: string): number {
  if (listedAt === null) return 365;
  const ms = Date.parse(asOf) - Date.parse(listedAt);
  if (!Number.isFinite(ms) || ms < 0) return 365;
  return Math.floor(ms / 86_400_000);
}

function maturityFactor(listedAt: string | null, asOf: string): number {
  return 1 + 0.25 * (Math.min(daysSince(listedAt, asOf), 1095) / 1095);
}

/** Short human money: 1_234_567_890 -> "$1.23B". */
export function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function pct(change7d: number | null): string {
  if (change7d === null) return 'not reported';
  // change_7d is already in per cent: +5.6 is +5.6%, not +560%.
  return `${change7d >= 0 ? '+' : ''}${change7d.toFixed(1)}%`;
}

type Playbook = { verb: string; action: string; second: string };

function playbookFor(category: string | null): Playbook {
  switch (category) {
    case 'Dexs':
      return {
        verb: 'trade on',
        action: 'swap $25–$100 between two assets in one of its pools, then add both sides as liquidity in the same pool',
        second: 'route a second swap through the pool a week later and add the fees back to the position',
      };
    case 'Lending':
      return {
        verb: 'lend on',
        action: 'supply $50–$200 of a stablecoin as collateral, then borrow a small amount ($10–$50) against it to open a borrow position',
        second: 'repay part of the borrow and top up the supply so both sides of the position stay active',
      };
    case 'Yield':
      return {
        verb: 'deposit into',
        action: 'deposit $50–$200 into its highest-TVL vault and leave the position to accrue yield for at least 2–4 weeks',
        second: 'claim or compound the yield once, then re-deposit it into the same vault',
      };
    case 'Bridge':
    case 'Canonical Bridge':
      return {
        verb: 'bridge with',
        action: 'bridge $50–$200 to the destination chain it serves and back again, keeping the receipt of each crossing',
        second: 'bridge a second, smaller amount ($10–$50) a week later so the crossings span more than one week',
      };
    case 'Liquid Staking':
    case 'Liquid Restaking':
    case 'Restaking':
    case 'Staking Pool':
      return {
        verb: 'stake with',
        action: 'stake $50–$200 of the chain gas token and hold the liquid staking token it mints for at least 2–4 weeks',
        second: 'use the staking token once inside the protocol (supply it or add it to a pool) instead of selling it',
      };
    case 'RWA':
      return {
        verb: 'use',
        action: 'deposit $50–$200 to mint or buy its tokenized asset position and hold it for at least 2–4 weeks',
        second: 'add a second deposit of $10–$50 and keep the position open across a month boundary',
      };
    case 'CDP':
    case 'Stablecoin Wrapper':
      return {
        verb: 'mint with',
        action: 'lock $50–$200 of collateral and mint $10–$50 of its stablecoin, keeping the collateral ratio well above the minimum',
        second: 'repay a small part of the minted amount and re-mint it, so the vault shows more than one action',
      };
    case 'Derivatives':
      return {
        verb: 'trade on',
        action: 'open a small perpetual position ($10–$50 notional, low leverage) and close it after a day or two; never size up',
        second: 'open one more small position the following week and close it the same way',
      };
    case 'Payments':
      return {
        verb: 'pay with',
        action: 'fund a $50–$200 balance and make two or three real payments through it over two weeks',
        second: 'top the balance back up once after spending from it, so deposits and payments both appear',
      };
    case 'Chain':
      return {
        verb: 'use',
        action: 'bridge $50–$200 to the chain and use one of its apps (swap or supply) in the same week',
        second: 'come back the next week and repeat the same app action in a smaller size ($10–$50)',
      };
    default:
      return {
        verb: 'use',
        action: 'deposit or lock $50–$200 in its core product on its main chain and keep the position open for at least 2–4 weeks',
        second: 'interact a second time a week later in a smaller size ($10–$50) so the activity spans more than one week',
      };
  }
}

/** Concrete farm plan for one protocol. Every number comes from the snapshot. */
export function farmSteps(p: Protocol, asOf: string): string[] {
  const book = playbookFor(p.category);
  const main = p.chains[0] ?? 'its main chain';
  const other = p.chains.length > 1 ? ` It also runs on ${p.chains.slice(1, 3).join(', ')}${p.chains.length > 3 ? ` and ${p.chains.length - 3} more chain${p.chains.length - 3 === 1 ? '' : 's'}` : ''}.` : '';
  const steps = [
    `Move $50–$200 in stablecoins to ${main} with that chain's official bridge or a bridge the protocol documents; budget $1–$10 in gas and 10–30 minutes for the transfer to confirm.${other}`,
    `On ${p.name} (${fmtUsd(p.tvl_usd)} TVL on the ${asOf} snapshot, 7-day change ${pct(p.change_7d)}), ${book.action}.`,
    `${book.second[0]!.toUpperCase()}${book.second.slice(1)}.`,
    `Return weekly for at least a month: repeat the core action in a small size ($10–$50) so the activity is spread over 4+ weeks instead of done in one day.`,
    `Track ${p.name}'s TVL and 7-day change weekly; if TVL falls 20% or more, or the protocol announces a token, reassess first. To exit, reverse step 2, then bridge back to your starting chain (about 30–60 minutes).`,
  ];
  return steps;
}

/** Build the ranked board (200 rows) and the live set-aside list. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const { byCategory, global } = peerMultiples(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const pre = snapshot.protocols.filter(isPreToken);
  const belowFloor = pre
    .filter((p) => p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd);
  const chosen = new Map<string, Protocol>();
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find((q) => q.slug === slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of belowFloor) {
    if (chosen.size >= 200) break;
    chosen.set(p.slug, p);
  }
  const rows: BoardRow[] = [...chosen.values()].map((p) => {
    const multiple = byCategory.get(p.category ?? 'Uncategorized') ?? global;
    const growth = growthFactor(p.change_7d);
    const chains = chainFactor(p.chains);
    const maturity = maturityFactor(p.listed_at, snapshot.as_of);
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growth * chains * maturity));
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: farmSteps(p, snapshot.as_of),
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      is_watchlist: watch.has(p.slug),
      peer_multiple: Math.round(multiple * 1000) / 1000,
      growth_factor: Math.round(growth * 1000) / 1000,
      chain_factor: Math.round(chains * 1000) / 1000,
      maturity_factor: Math.round(maturity * 1000) / 1000,
      token_status: 'no token recorded',
    };
  });
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  const live = snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, 60)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, symbol: p.symbol }));
  const radar: Radar = {
    meta: {
      title: 'Token Launch Radar',
      as_of: snapshot.as_of,
      floor_usd: snapshot.floor_usd,
      protocols_total: snapshot.protocols.length,
      pre_token_total: pre.length,
      watchlist_total: snapshot.watchlist.length,
      board_rows: rows.length,
      live_set_aside: snapshot.protocols.length - pre.length,
      global_peer_multiple: Math.round(global * 1000) / 1000,
      model: 'implied = TVL x peer median mcap/TVL (same category, token already trades) x growth factor (7d change) x chain factor x maturity factor (days since listed)',
    },
    rows,
    live,
  };
  return { board: rows, radar };
}

/** The gate's refusal, or null when the board passes every board check. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, need 100-4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  const ranks = new Set<number>();
  let prev = Number.POSITIVE_INFINITY;
  for (const r of board) {
    if (!slugs.has(r.slug)) return `board names unknown slug ${r.slug}`;
    if (seen.has(r.slug)) return `board repeats slug ${r.slug}`;
    seen.add(r.slug);
    if (!Number.isInteger(r.rank) || r.rank < 1) return `row ${r.slug} has bad rank ${r.rank}`;
    if (ranks.has(r.rank)) return `rank ${r.rank} repeats`;
    ranks.add(r.rank);
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd < 1) return `row ${r.slug} has bad implied value`;
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
  for (let i = 1; i <= board.length; i++) if (!ranks.has(i)) return `rank ${i} missing`;
  for (const slug of snapshot.watchlist) if (!seen.has(slug)) return `watchlist slug ${slug} missing from board`;
  if (new Set(board.map((r) => r.implied_value_usd)).size < 2) return 'all implied values are equal';
  return null;
}

/** data.js: the dashboard's data, written beside the page (not part of the dossier text). */
export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
