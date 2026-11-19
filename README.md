[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Launch Radar — fitted launch pricing, blind-tested, costed farm plans

Which DeFi protocol without a token would be worth the most if it launched one — and how to farm it. An entry for the [make.fun bounty “Build the best token launch radar”](https://make.fun/bounty/token-radar-01) (token-radar-01, $1,325, top 10 share the prize).

Version 2 rebuilds the first entry from the ground up. The first version ranked at 10,978 of 12,554 with a plain median-multiple model; this one fits the pricing curve on the snapshot's own live peers, tests six candidate models blind, and prices every farm step.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot at `/input/snapshot.json` — 758 protocols at or above $5M TVL, snapshot date 2026-11-14 — and writes:

- `/output/board.json` — 181 ranked rows: every protocol the house's own watchlist rule considers a launch candidate — the full 40-protocol watchlist plus the 141 below the $50M floor that pass the same rule.
- `/output/data.js` — the same board as data for the dashboard, plus the fitted model and its blind-test scores.
- `/output/dashboard/` — a static page (no network): sortable/filterable board, a detail view per protocol with the valuation maths, a model card showing the fit and the blind tests, and tabs for the protocols already trading and the names set aside with their reasons.
- `/output/screenshots/` — the board, a protocol detail view, and a filtered view.
- `/output/dossier.json` — built with `buildDossier` from `vendor/makefun-board.ts`.

## The value model (this entry's own claim)

```
implied value = fitted curve(TVL) × growth tilt × age tilt × spread tilt
```

- **Fitted curve**: a log-log line fitted by least squares on the 128 live peers that record both a token and a market cap: `log10(mcap) = a + b × log10(TVL)`. The intercept, slope and R² are recomputed from the snapshot on every run — nothing is hardcoded.
- **Growth tilt**: `1 + 0.5 × g`, where `g` is the 7-day TVL change winsorized at the snapshot's own 99th percentile (+33.6%). One protocol in this snapshot grew +4,448% in a week on a fresh listing; without winsorizing, one listing quirk would own the board.
- **Age tilt**: `1 + 0.25 × min(days listed with no token, 1095) / 1095` — longer with no token, more “overdue”.
- **Spread tilt**: `1 + 0.03 × min(chains, 10)` — wider distribution counts for more.

Every input is a field of the sealed snapshot. “No token recorded” means the snapshot's DefiLlama record carries no `gecko_id`/`symbol` — it is not proof the protocol has none. Protocols whose token already trades are set aside from the ranking and listed separately on the page, and the 161 pre-token names the house rule drops (exchanges, bridges, liquid-staking/restaking, wrapped/staked, version-marked) are listed with the reason each was dropped.

## How the model was tested (computed at runtime, shown on the page)

Six candidates are scored two honest ways — leave-one-out over all 128 peers, and five-fold cross-validation (each fold is every 5th peer by slug hash, about 20%; the number shown is the median of the five folds) — and the dashboard prints the table with the exact figures computed from the snapshot on every run (errors are median absolute per-cent errors predicting a live peer's market cap). A single 26-peer holdout was measured first and thrown away: it swings 70–430% between splits for every model, so one split is a lottery ticket, not a test. In testing, the fitted curve and the curve-plus-tilts came out best, the v1 median-plus-tilts model came out worst, and the ridge matched the curve on error but was rejected anyway — its fitted coefficients punish growth and age (both negative), the opposite of what a launch radar should reward. The tilts are stated priors kept small: with 128 peers there is not enough data to fit them.

## Farm plans

Each row carries 5 concrete steps, each with what it costs in dollars and how long it takes: bridge a sized amount to the protocol's main chain, do the protocol's core action for its category (swap/provide liquidity, supply/borrow, stake, mint, …), repeat it, spread activity over 4+ weeks, and track TVL weekly with an exit plan. Gas is a typical range for the main chain (Ethereum $2–$10, L2s $0.05–$0.50, cheap chains $0.01–$0.50, other chains $0.50–$5 per transaction), labelled as an estimate — the snapshot carries no gas field. Plans are built from (category group × gas tier) templates; the board reports how many distinct templates it uses. No points program is claimed — the snapshot carries no airdrop flag.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input kit/input/snapshot.json
```

Then open `out/dashboard/index.html` (it reads `../data.js`). No install, no network.

## License

MIT — see [LICENSE](LICENSE).

---
Built by @gemsen for the make.fun bounty — referral: [5c2wyg2x](https://make.fun/bounty/token-radar-01)
