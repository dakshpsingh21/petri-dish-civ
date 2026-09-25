// tools/ab.mjs: headless A/B runs. Same seeds, one setting changed, compare the numbers.
// Run from the repo root:
//   node tools/ab.mjs 10 features.tribeOpinions=false      (years, then any config overrides)
// Seeds: SEEDS below. Prints one line per seed + the mean. (Not sim code: the clock is fine.)

import { createSim, step } from '../src/sim.js';
import { config, WORLD_WIDTH, WORLD_HEIGHT } from '../src/config.js';
import { effectiveTrait } from '../src/genes.js';

const SEEDS = (process.env.SEEDS ?? 'daksh,petri').split(',');
const TICKS_PER_YEAR = 600;
const [years = '10', ...overrides] = process.argv.slice(2);

// "features.gossip=false" -> cfg.features.gossip = false (numbers and booleans parsed).
function applyOverride(cfg, text) {
  const [keyPath, raw] = text.split('=');
  const keys = keyPath.split('.');
  const last = keys.pop();
  const obj = keys.reduce((o, k) => o[k], cfg);
  obj[last] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
}

const mean = (list, fn) => list.reduce((s, x) => s + fn(x), 0) / Math.max(1, list.length);

function run(seed) {
  const cfg = structuredClone(config);
  cfg.seed = seed;
  for (const o of overrides) applyOverride(cfg, o);
  const s = createSim(cfg, WORLD_WIDTH, WORLD_HEIGHT);
  const t0 = performance.now();
  for (let t = 0; t < Number(years) * TICKS_PER_YEAR; t++) step(s, cfg);
  const a = s.agents;
  return {
    seed, pop: a.length,
    aggr: mean(a, (x) => effectiveTrait(x, 'aggression')),
    trust: mean(a, (x) => effectiveTrait(x, 'trust')),
    greed: mean(a, (x) => effectiveTrait(x, 'greed')),
    ...s.interactions,
    sec: (performance.now() - t0) / 1000,
  };
}

console.log(`${years} years, overrides: ${overrides.join(' ') || '(none)'}`);
const rows = SEEDS.map(run);
const avg = { seed: 'MEAN' };
for (const k of Object.keys(rows[0])) if (k !== 'seed') avg[k] = mean(rows, (r) => r[k]);
for (const r of [...rows, avg]) {
  console.log(`${r.seed.padEnd(6)} pop ${r.pop.toFixed(0).padStart(5)} | aggr ${r.aggr.toFixed(2)} trust ${r.trust.toFixed(2)} greed ${r.greed.toFixed(2)}`
    + ` | steals ${(r.steals / 1000).toFixed(0)}k failed ${(r.failedSteals / 1000).toFixed(0)}k trades ${(r.trades / 1000).toFixed(0)}k shares ${(r.shares / 1000).toFixed(0)}k betrayals ${(r.betrayals / 1000).toFixed(1)}k | ${r.sec.toFixed(0)}s`);
}
