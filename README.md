# Token Launch Radar — 181 protocols, fitted pricing, 6-model blind test, costed farm plans

![make.fun](https://make.fun/badge/token-radar-01.svg)
![make.fun](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118.svg)
![make.fun](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/rank.svg)
![make.fun](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/reward.svg)

Entry for the make.fun bounty [token-radar-01 — Build the best token launch radar](https://make.fun/bounty/token-radar-01): 181 pre-token protocols ranked by implied launch value, each with a costed farm plan and a FARM / THIN / SKIP verdict.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`, 758 protocols as of 2026-11-14), prices every pre-token protocol with a model fitted at runtime, and writes a ranked board (`/output/board.json`), the dashboard data (`/output/data.js`), the static dashboard (`/output/dashboard/`) and the judge's dossier (`/output/dossier.json`).

## The model

- **Fitted pricing curve** — `log10(market cap) = a + b × log10(TVL)`, fitted by least squares on the 128 live peers (protocols whose token already trades), recomputed on every run. Implied value = curve(TVL) × growth tilt × age tilt × category-spread tilt. Growth is winsorised at the snapshot's own p99, because one protocol grew +4,448% in a week on a fresh listing.
- **Blind test on the page** — six candidate models scored by leave-one-out over all 128 peers AND five-fold cross-validation (median of five folds split by slug hash). The kept model, curve + tilts, and the rejected ridge (its fitted growth and age coefficients come out negative — a fresh-listing artefact) are all shown with their numbers. A single 26-peer holdout was measured first and thrown away: it swings 70–430% between splits for every model, so one split is a lottery, not a test.
- **The board** — 181 rows: the 40 protocols on the house watchlist, plus the 141 largest below-floor pre-token protocols that pass the house rule. Every one of the 758 snapshot protocols is accounted for on the page: 181 on the board + 144 already trading (listed separately) + 433 set aside with the reason each was left off. No protocol is counted twice, none is missing.
- **Verdict per row** — net value per farmer = 2% of implied value × 1-in-4 launch chance ÷ estimated farmers (TVL ÷ $100k, clamped 200–10,000) − farm-plan cost. FARM when net ≥ $150, THIN when net ≥ $25, SKIP below that. Rank is how big the launch could be; verdict is whether farming it pays you after cost and crowd.
- **Farm plans** — 5 concrete steps per protocol, each stating its dollar cost (typical gas for the main chain, labelled an estimate) and the minutes it takes. Templates are (category group × gas tier).
- **Dashboard** — light theme, KPI strip, reconciliation strip, model card with the blind-test table, sortable/filterable board, detail view with the full maths, a sandbox (move TVL and growth, watch implied move), side-by-side compare for up to 3 protocols, and CSV/JSON export. No network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input kit/token-radar-01-kit/input/snapshot.json
```

Node 22+. The program is deterministic: the same snapshot bytes give the same output bytes.

---

Built for the make.fun token-radar-01 bounty. Referral: `5c2wyg2x`.
