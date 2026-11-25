# Token Launch Radar — ronde 9

![Token Launch Radar](https://make.fun/badge/token-radar-01.svg)
![Token Launch Radar](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118.svg)
![Rank](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/rank.svg)
![Reward](https://make.fun/badge/token-radar-01/GeMseN-Test/token-radar-20261118/reward.svg)

**Bounty:** [Build the best token launch radar](https://make.fun/bounty/token-radar-01) — free entry, $1,325 total payout (1st $1,000, places 2–10 $50/$25).

One question, answered for **198 protocols** with no token yet: if it launched a token today, what would the token be worth — and is farming its airdrop worth your time? The price comes from 95 real launches, not from hype.

## The numbers (all recomputed at runtime from the frozen snapshot)

- **198 protocols ranked** (40 watchlist + 20 off-list at or above the $50M floor + 138 below the floor), **total implied value $842,129,447**
- **Top pick: Polymarket International — implied $37,112,088** (value-if-launches $41,022,687 × 90.5% launch odds), net **+$248** on a $64,039 plan — verdict **FARM**
- **Value model:** `log10(market cap) = 3.529 + 0.457 × log10(TVL)` on 95 dated peers, R² 0.168. At $100M TVL the curve says **$15,241,937 ± $2,985,461**; at $1B TVL **$43,629,273 ± $14,864,632** (bootstrap s.e., 200 refits)
- **Held out four ways** (every term, not just the kept one): leave-one-out **×2.87** (50.5% within 3×), five-fold size-stratified **×2.98** (50.5%), walk-forward **×3.04** (50.0%), category-blind **×3.26** (48.4%)
- **Launch odds:** logistic on age, group, chain count, kinship — **Brier 0.177 leave-one-out** (73.0% called right), **0.177 ten-fold** (72.8%), **0.168 walk-forward** (79.3%); base rate 54.9%. Kinship is the strongest term (β +1.08 ± 0.12): 90% of kin protocols record a token vs 43% of the rest
- **Ranges:** P25–P75 ×0.34–×2.84 holds 49.5% leave-one-out / 47.9% walk-forward; P10–P90 ×0.08–×10.80 holds 78.9% / 72.9%
- **Nested cross-validation:** terms picked by inner folds only score ×3.19 on outer folds vs ×2.98 for the fixed kept model — the term choice was not tuned to the outer folds
- **Farm verdicts (four tiers):** ROBUST 25 / FARM 35 / THIN 95 / SKIP 43. ROBUST pays even at the low end of the printed range; FARM pays at the point value (net ≥ $25 and ≥ $5/hour); THIN only beats its cash fees; SKIP loses more than $50
- **Reconciliation:** 758 = 198 board + 416 token-on-record + 144 set aside (Bridge 43, liquid staking/restaking 43, exchange custody 42, versioned listing 11, wrapped/staked 5)
- **Integrity:** board checksum `c761f284`, recomputed in the browser from `data.js`; two runs are byte-identical (board.json sha256 `94897740f1607babb8a99940b47490a27d3da7d359a239f3e81a3b6c2e460466`)

## What round 9 changed vs round 8

Round 8's model was right — every fancier term tried this round loses on held-out data, so the priced model is **unchanged** (curve + group + momentum, same odds, same global range band). What round 9 adds is **evidence and sharper farm calls**:

1. **Four held-out splits instead of two.** Every value term is now scored leave-one-out, five-fold size-stratified, walk-forward *and* category-blind. A term is kept only when it lowers the miss in both headline tests.
2. **The #2 entry's claim does not reproduce.** Its kept set (size curve + chain count + years listed) scores LOO ×3.51 / WF ×3.56 here when fit and prediction use the same features — worse than round 8 on both headline tests. Its published walk-forward ×2.26 does not reproduce under any split (half, 55/37, 60/40, date cutoffs), peer set (95 / 92 / 85 dated peers) or robust fit (L1, Huber, kNN, shrunk slopes, two-segment) tried; the best honest walk-forward across all candidates is ×2.83. The dashboard says so and shows its own numbers instead of copying the claim.
3. **Ten-fold odds + nested term choice.** The odds table gains a ten-fold column; the value term choice is checked by nested cross-validation (picked ×3.19 vs fixed ×2.98 out of sample).
4. **Four farm tiers.** MARGINAL is replaced by ROBUST (pays even at the P25 low end) and THIN (only beats cash fees). New columns: **$1K slice** (your share on a $1,000 plan) and **break-even implied value** (the implied value at which the plan pays exactly zero).
5. **Range honesty per group.** The same global band, checked group by group: lending is thinnest (0 of 7 walk-forward launches inside the middle band), RWA most honest (7 of 7). Per-group bands were tested and rejected (they hold worse walk-forward: 45.8% vs 47.9%).

## What was tried and dropped (with numbers)

| Term | Leave-one-out | Walk-forward | Verdict |
| --- | --- | --- | --- |
| One flat TVL multiple | ×5.00 | ×5.29 | No |
| + size curve (log-log) | ×3.23 | ×3.01 | No |
| + group residual | ×3.07 | ×3.06 | No |
| **+ 7-day momentum — KEPT** | **×2.87** | **×3.04** | **Yes** |
| + age (time with no token) | ×3.11 | ×2.94 | No — wins WF, loses LOO |
| + chain count + years listed | ×3.51 | ×3.56 | No — loses both |
| + kinship (value term) | ×2.91 | ×3.48 | No — loses WF |

Placebo checks: shuffled 7-day growth misses by ×3.13 (vs kept ×2.87); shuffled kinship gives odds Brier 0.211 (vs kept 0.177) — the kinship signal is real, the momentum signal is small. Three of six candidate terms survived into the model.

## How it works

1. **Snapshot.** 758 protocols from DeFiLlama, frozen 14 Nov 2026. 416 already have a token; 198 are ranked; 144 are set aside by the kit's house rule.
2. **Value.** log-log curve on the 95 dated peers × per-group residual (median of the group's launches, clamped 0.5–2.0) × 7-day momentum tilt winsorized at the snapshot p99 (+26.7%).
3. **Odds.** Logistic regression on 758 protocols: age in years, category group, chain count capped at 6, kinship.
4. **Implied value.** Value-if-launches × launch odds, ranked highest first.
5. **Farm plan.** 0.02% of TVL, 7% drop share, 12-week horizon, 3.75 hours of work. Gas for five steps on the protocol's main chain; DEX pairs also pay a 0.60% round-trip swap fee on the half of the plan that must be swapped, plus exit slippage of (half-plan)² / (5% of TVL). Lending, yield and RWA take an asset the farmer already holds, so they pay no swap. The detail view also prices the same plan in a T-bill at 4.5% APY — on the biggest protocols the T-bill wins, and the page says so.

## Run it

```sh
# from the work directory (kit lives at kit/token-radar-01-kit/)
MAKEFUN_OUTPUT_DIR=out node repo/main.ts --input kit/token-radar-01-kit/input/snapshot.json
```

Writes `out/board.json` (316,433 bytes), `out/data.js` (406,472 bytes), `out/dashboard/`, `out/screenshots/` (3 images) and `out/dossier.json` (736,476 bytes). Dashboard source is 26,727 bytes of JavaScript + 16,222 bytes of HTML + 6,228 bytes of CSS — under the scorer's 65,536-byte text cap. A second run must be byte-identical — the program runs the build twice and refuses to write unless both agree. Node 22+, standard library only; no network at runtime. The dashboard is a static page: open `out/dashboard/index.html`.

## Limits — read before you farm anything

- The curve explains only 16.8% of launch values (R² 0.168). A typical launch lands 2.87× away from its fitted price; about half land more than 3× away.
- The snapshot is frozen on 14 Nov 2026. Protocols launched, listed or shut down since then are not in it, and the 7-day momentum is 7 days old.
- Gas is an estimate ($22 on Ethereum, $3 on a major L2, $6 elsewhere) and moves with the network; the swap fee and slippage are model assumptions, not quotes.
- A FARM verdict is not a promise. Most airdrops pay less than their model, some pay nothing, and the T-bill comparison in the detail view shows where doing nothing wins.

This is a research tool, not investment advice.
