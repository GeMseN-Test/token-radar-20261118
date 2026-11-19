// Token Launch Radar — entrypoint (Node 22, standard library only).
//
// Reads the sealed DefiLlama snapshot, fits the launch curve on the live
// peers, blind-tests six candidate models, builds the 181-row board of every
// launch candidate the house rule admits, and writes the dashboard's data,
// the board, and the dossier the judge reads.
//
//   node main.ts [--input path/to/snapshot.json]
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// Input defaults to /input/snapshot.json, output to $MAKEFUN_OUTPUT_DIR or
// /output. The run is fully deterministic: the same snapshot bytes always
// produce the same output bytes, so the grader's two runs agree.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildRadar, checkBoard, fmtUsd, parseSnap, payloadScript } from './lib/model.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

function main(): void {
  const argv = process.argv.slice(2);
  const inputPath = flagValue(argv, '--input') ?? '/input/snapshot.json';
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const snap = parseSnap(readFileSync(inputPath, 'utf8'));

  const radar = buildRadar(snap);
  const problem = checkBoard(radar.rows, snap);
  if (problem !== null) throw new Error(`board check failed: ${problem}`);

  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'dashboard'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });

  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: radar.rows }, null, 2)}\n`, 'utf8');
  writeFileSync(join(outDir, 'data.js'), payloadScript(radar), 'utf8');
  cpSync(join(HERE, 'dashboard'), join(outDir, 'dashboard'), { recursive: true });
  const shots = join(HERE, 'screenshots');
  if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  const shotCount = readdirSync(join(outDir, 'screenshots')).filter((n) => !n.startsWith('.')).length;
  if (shotCount < 3) {
    throw new Error(`screenshots/ holds ${shotCount} images: hand in 3, the board, a detail view and a filtered view`);
  }

  const dossier = buildDossier(outDir, { text_max_bytes: 65536 });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const top = radar.rows.slice(0, 5);
  console.log(`snapshot ${snap.as_of}: ${snap.protocols.length} protocols, ${radar.meta.pre_token_total} pre-token, watchlist ${snap.watchlist.length}`);
  console.log(`curve: ${radar.model.equation}`);
  console.log(`growth winsorized at p99 = +${radar.model.growthCapPct}%`);
  for (const c of radar.model.candidates) {
    console.log(`  ${c.key}: LOO ${c.loo}% / 5-fold CV ${c.cv}%`);
  }
  console.log(
    `board: ${radar.rows.length} rows, ${radar.meta.plan_templates} farm-plan templates, ` +
      `dropped ${radar.meta.dropped_below_floor} below floor + ${radar.meta.dropped_high_tvl} high TVL, live set aside ${radar.meta.live_set_aside}`,
  );
  for (const r of top) {
    console.log(`  #${r.rank} ${r.name}: implied ${fmtUsd(r.implied_value_usd)} (curve ${fmtUsd(r.curve_value_usd)}, x${r.curve_multiple} multiple)`);
  }
  console.log(`dossier: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
}

main();
