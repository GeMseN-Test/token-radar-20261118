[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Launch Radar

Which DeFi protocol without a token would be worth the most if it launched one — and how to farm it. An entry for the [make.fun bounty “Build the best token launch radar”](https://make.fun/bounty/token-radar-01) (token-radar-01, $1,325, top 10 share the prize).

## What it does

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot at `/input/snapshot.json` — 758 protocols at or above $5M TVL, snapshot date 2026-11-14 — and writes:

- `/output/board.json` — 200 ranked rows: the full 40-protocol watchlist (TVL ≥ $50M, no token recorded, not a wrapped/staked product of a token that trades) plus the 160 pre-token protocols below the floor with the most TVL.
- `/output/data.js` — the same board as data for the dashboard.
- `/output/dashboard/` — a static page (no network): sortable/filterable board, a detail view per protocol with the valuation maths, and a farm plan per protocol.
- `/output/screenshots/` — the board, a protocol detail view, and a filtered view.
- `/output/dossier.json` — built with `buildDossier` from `vendor/makefun-board.ts`.

## The value model (this entry's own claim)

```
implied value = TVL × peer multiple × growth factor × chain factor × maturity factor
```

- **Peer multiple**: the median mcap/TVL of protocols in the *same category* that already record a token. Categories with no live peer fall back to the global median (0.205×). Clamped to [0.02, 5]. The snapshot carries mcap, not FDV, so the multiple is mcap/TVL, stated as such.
- **Growth factor**: `1 + 0.5 × clamp(change_7d, −0.5, 2)` — fast growers are worth more.
- **Chain factor**: `1 + 0.03 × min(chains, 10)` — wider distribution counts for more.
- **Maturity factor**: `1 + 0.25 × min(days listed with no token, 1095) / 1095` — longer with no token, more “overdue”.

Every input is a field of the sealed snapshot. “No token recorded” means the snapshot's DefiLlama record carries no `gecko_id`/`symbol` — it is not proof the protocol has none. Protocols whose token already trades are set aside from the ranking and listed separately on the page.

## Farm plans

Each row carries 5 concrete steps: bridge a sized amount to the protocol's main chain (cost/time stated), do the protocol's core action for its category (swap/provide liquidity, supply/borrow, stake, mint, …), repeat it, spread activity over 4+ weeks, and track TVL weekly with an exit plan. No points program is claimed — the snapshot carries no airdrop flag.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input kit/input/snapshot.json
```

Then open `out/dashboard/index.html` (it reads `../data.js`). No install, no network.

## License

MIT — see [LICENSE](LICENSE).
