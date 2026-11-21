// Token Launch Radar — ronde 8 entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot (/input/snapshot.json, or --input <file|dir>),
// prices every pre-token protocol with the radar-4 model in lib/model.ts,
// writes the ranked board to /output/board.json, the dashboard's data to
// /output/data.js, copies dashboard/ and screenshots/ to /output, and writes
// /output/dossier.json with the vendored make.fun library.
//
// The dashboard is a static page with no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which this
// program writes from the same board the gate checks.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input kit/token-radar-01-kit/input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnap } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_CAP = 65_536;
const SHOT_CAP = { max: 4, max_bytes: 524_288 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Value of --name <value>, or the fallback when the flag is absent. */
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

/** Copy a directory's regular files into `to`, skipping dotfiles. Returns names. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const out: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    out.push(name);
  }
  return out;
}

function main(): void {
  const inputArg = flag('input', '/input');
  const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(inputFile)) {
    process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
    process.exit(2);
  }
  const out = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snap = parseSnap(readFileSync(inputFile, 'utf8'));
  const first = buildRadar(snap);
  const issue = boardIssue(first.board, snap);
  if (issue !== null) {
    process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
    process.exit(1);
  }
  // The grader runs the program twice and requires identical bytes: prove it.
  const boardText = `${JSON.stringify({ rows: first.board })}\n`;
  const dataText = dataScript(first.radar);
  const second = buildRadar(snap);
  if (`${JSON.stringify({ rows: second.board })}\n` !== boardText || dataScript(second.radar) !== dataText) {
    process.stderr.write('token radar: second build differs from the first: the program is not deterministic\n');
    process.exit(1);
  }

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'board.json'), boardText);
  writeFileSync(join(out, 'data.js'), dataText);
  copyDir(join(here, 'dashboard'), join(out, 'dashboard'));
  const shots = copyDir(join(here, 'screenshots'), join(out, 'screenshots'));
  if (shots.length < 3) {
    process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
    process.exit(1);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) {
      process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
      process.exit(1);
    }
  }

  // The dossier is written last: the scorer rebuilds it from this /output.
  const dossierPath = join(out, 'dossier.json');
  writeFileSync(
    dossierPath,
    buildDossier(out, { text_max_bytes: TEXT_CAP, screenshots: SHOT_CAP, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
  );
  const dossierBytes = statSync(dossierPath).size;

  const top = first.board[0]!;
  const kept = first.radar.ablation.find((s) => s.kept) ?? first.radar.ablation[first.radar.ablation.length - 1]!;
  const keptOdds = first.radar.odds;
  process.stdout.write(
    `token radar: ${snap.protocols.length} protocols, ${snap.watchlist.length} on the watchlist, ${first.board.length} rows ranked (${first.radar.reconciliation.token_on_record} token on record, ${first.radar.reconciliation.set_aside} set aside)\n` +
      `token radar: dated fit log10(mcap) = ${first.radar.global_fit.a.toFixed(3)} + ${first.radar.global_fit.b.toFixed(3)} x log10(TVL) on ${first.radar.peers_dated} peers, R2 ${first.radar.global_fit.r2.toFixed(3)}; kept model LOO miss x${kept.loo_miss.toFixed(2)}, walk-forward x${kept.wf_miss.toFixed(2)}\n` +
      `token radar: odds logistic Brier LOO ${keptOdds.loo_brier} (${keptOdds.loo_correct_pct}% called right) / walk-forward ${keptOdds.wf_brier} (${keptOdds.wf_correct_pct}%); base rate ${keptOdds.base_rate_pct}%\n` +
      `token radar: top ${top.name} $${top.implied_value_usd.toLocaleString('en-US')} expected (value if launches $${top.value_if_launches_usd.toLocaleString('en-US')} x ${(top.launch_odds * 100).toFixed(0)}% odds)\n` +
      `token radar: verdicts FARM ${first.radar.verdict_counts.FARM} / MARGINAL ${first.radar.verdict_counts.MARGINAL} / SKIP ${first.radar.verdict_counts.SKIP}; board checksum ${first.radar.checksum}\n` +
      `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')} (${dossierBytes.toLocaleString('en-US')} bytes)\n`,
  );
}

main();
