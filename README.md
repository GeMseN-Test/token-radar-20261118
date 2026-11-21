# Token Launch Radar — 198 protocols, dual-tested comps ×2.87, logistic launch odds Brier 0.177, integrity-checked board, TVL-sized farm plans

[![Token Launch Radar](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Token Launch Radar](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/reward.svg)](https://make.fun/bounty/token-radar-01)

Entry for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01): "Build the best token launch radar". It reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14) and hands in a dashboard that ranks the 198 protocols that record no token by what their launch would be worth, each with the steps to farm it.

## What it does

- **One fitted comps curve, on dated peers only** — log10(market cap) = 3.529 + 0.457 × log10(TVL), fitted at runtime on the 95 traded tokens with a listing date (R² 0.168), times a per-group premium (lend 0.72×, dex 1.60×, yield 0.80×, rwa 1.37×, other 1.24×, clamped to 0.5×–2.0×) and a 7-day momentum tilt (winsorized at the snapshot p99, +26.7%). The curve at $100M TVL is $15.7M ± $3.0M (bootstrap standard error, 200 refits).
- **Launch odds from a logistic fit** — age in years, category group, chain count and kinship (shares a name stem with a token that already trades). Kinship is the strongest term (beta +1.08 ± 0.16): 90% of kin protocols record a token, against 43% of the rest. Held out, the odds score Brier 0.177 (73.0% called right) leave-one-out and 0.168 (79.3%) walk-forward, against a 0.248 / 0.321 base rate. Implied value = value if it launches × launch odds; rank 1 is Polymarket International at $37.1M expected (value $41.0M × 91% odds).
- **Every term earned its place in two tests** — leave-one-out and walk-forward (older half fits, newer half priced). Age lowers the walk-forward miss (×3.04 → ×2.94) but raises the leave-one-out miss (×2.87 → ×3.11), so it stays out of the value model and enters through the odds instead. Ridge category effects, per-group curves, quadratic fits and Huber fits were all tried and rejected with their numbers in the ablation table. A shuffled placebo (growth shuffled for value, kinship shuffled for odds) does not help, and the page shows that.
- **A range on every row** — P25–P75 and P10–P90 from the kept model's leave-one-out residuals, with a rank range to match. 49.5% of held-out caps land inside the printed P25–P75 range (stated 50%), 78.9% inside P10–P90 (stated 80%); on newer tokens 47.9% and 72.9% — the range is a little too narrow on new tokens, and the page says so.
- **Deposit-sized farm plans** — the plan is 0.02% of the protocol's TVL (so the reader is 1 of 5,000 farmers), the drop share defaults to 7%, the horizon is 12 weeks (3.75 hours of work). Costs are gas for five concrete steps plus, for DEX pairs only, a 0.60% round-trip swap fee and exit slippage on the half of the plan that must be swapped; lending and yield vaults take the asset the farmer already holds, so they pay no swap. Verdicts: FARM 60 / MARGINAL 95 / SKIP 43. The detail view also prices the same plan in a T-bill — on the biggest protocols the T-bill wins, and the page says so.
- **An integrity strip, recomputed in the browser** — the dashboard re-derives the board from its own data file and checks the row count, the rank order, the totals, the FNV checksum against main.ts, the watchlist coverage and the 758-protocol ledger, and shows a ✓ or ✗ for each.
- **All 758 protocols accounted for** — 198 ranked (40 watchlist + 20 off-list above the floor + 138 below it), 416 with a token on record, 144 set aside each for one stated reason (bridge 43, liquid staking 43, exchange custody 42, versioned listing 11, wrapped or staked 5).
- **Tools, not just a board** — dark theme, sortable and filterable table, sandbox sliders on every detail view (plan size, drop share), compare for up to three rows, CSV/JSON export, a TVL-vs-market-cap scatter with the fitted curve, and plan-size / drop-share / horizon selectors that recompute every row in the browser.

## Run it

Node 22, standard library only. The program reads `/input/snapshot.json` and writes `/output/board.json`, `/output/data.js`, the dashboard, the screenshots and `/output/dossier.json`:

```sh
node main.ts --input kit/input/snapshot.json --output out
```

It runs twice internally and refuses to write unless both builds are byte-identical (verified: two separate runs produce a byte-identical dossier).

## Files

- `main.ts` — entrypoint: reads the snapshot, checks the board, proves determinism, writes the outputs and the dossier.
- `lib/model.ts` — the radar: comps fit, logistic launch odds, blind tests, bootstrap errors, ranges, farm economics, reconciliation, checksum.
- `dashboard/` — the page (dark theme, no network): `index.html`, `app.css`, `app.js` (42,619 bytes of source in total — the judge reads it whole).
- `screenshots/` — the board, a detail view and a filtered view, 1280×800 each.
- `vendor/makefun-board.ts` — the kit's dossier library, copied unchanged.
