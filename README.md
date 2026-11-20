# Token Launch Radar — 198 protocols, comps-priced, walk-forward tested

![Token Launch Radar](https://make.fun/badge/token-radar-01.svg)
![Token Launch Radar](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118.svg)
![Rank](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/rank.svg)
![Reward](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/reward.svg)

Entry for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01): "Build the best token launch radar". It reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14) and hands in a dashboard that ranks the 198 protocols that record no token by what their launch would be worth, each with the steps to farm it.

## What it does

- **One fitted comps curve** — log10(market cap) = 3.025 + 0.522 × log10(TVL), fitted at runtime on the 128 traded peers (R² 0.194), times a per-group premium (lend 0.76×, dex 2.04× clamped to 2.00×, yield 0.50×, rwa 1.54×, other 1.21×), a 7-day momentum tilt (winsorized at the snapshot p99, +26.7%), an age tilt (up to +25% over three years with no token) and a kinship term for name stems shared with a token that already trades.
- **Launch odds** — the chance a protocol records a token, read off the snapshot itself (age bucket, TVL tier, group, smoothed to the 54.9% base rate). Held out it calls 65.2% right. Implied value = value if it launches × launch odds; rank 1 is Polymarket International at $46.5M expected.
- **A range on every row** — P25–P75 and P10–P90 from the kept model's leave-one-out residuals, with a rank range to match. 50.0% of held-out caps land inside the printed P25–P75 range, 79.7% inside P10–P90.
- **Blind-tested, two ways** — leave-one-out (×3.52 typical miss, 46% within 3×) and walk-forward: one fit on the older half of traded tokens prices the newer half (×2.94, 52% within 3×). A stepwise ablation table shows every term earning — or costing — its place.
- **Deposit-sized farm plans** — every row carries five concrete steps with gas cost and minutes, and a verdict (FARM 22 / THIN 58 / SKIP 118) from the net per farmer: farmers = TVL / deposit, slice = implied × 10% / farmers, net = slice − fees. The dashboard lets the reader change the deposit ($1,000 / $10,000) and the drop share (3.5% / 7% / 14%) and recomputes every row.
- **All 758 protocols accounted for** — 198 ranked (40 watchlist + 20 off-list above the floor + 138 below it), 416 with a token on record, 144 set aside each for one stated reason (bridge 43, liquid staking 43, exchange custody 42, versioned listing 11, wrapped or staked 5).
- **Tools, not just a board** — sandbox sliders on every detail view (TVL, growth, age), compare for up to three rows, CSV/JSON export, sortable and filterable table, a TVL-vs-market-cap scatter with the fitted curve.

## Run it

Node 22, standard library only. The program reads `/input/snapshot.json` and writes `/output/board.json`, `/output/data.js`, the dashboard, the screenshots and `/output/dossier.json`:

```sh
node main.ts --input kit/input/snapshot.json --output out
```

It runs twice internally and refuses to write unless both builds are byte-identical.

## Files

- `main.ts` — entrypoint: snapshot in, board + dashboard data + dossier out.
- `lib/model.ts` — the model, the blind tests, the farm economics, the reconciliation.
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (no network, no framework).
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged.
- `screenshots/` — board, detail view, filtered view (1280×800).
