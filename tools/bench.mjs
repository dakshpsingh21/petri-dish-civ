// tools/bench.mjs: headless timing of the sim (no browser, no drawing).
// Run from the repo root:   node tools/bench.mjs
// For each population size it runs the SAME seed twice: interactions OFF and ON.
// The difference is what the neighbour search costs. S12 re-runs this for the before/after.
// (Not sim code, so using the clock here is fine.)

import { createSim, step } from '../src/sim.js';
import { config, WORLD_WIDTH, WORLD_HEIGHT } from '../src/config.js';

const SIZES = [500, 1000, 2000, 5000];
const WARMUP = 20;   // untimed ticks first: lets the JIT compiler warm up the hot code
const TICKS = 100;   // timed ticks

function run(n, interactions) {
  const cfg = structuredClone(config);        // never mutate the shared config
  cfg.initialAgents = n;
  cfg.features.reproduction = false;          // no births + no old age -> population stays ~n
  cfg.features.aging = false;
  cfg.metabolism = 0;                         // nobody starves either: the map can't feed 5k (it holds ~1.3k)
  cfg.features.interactions = interactions;
  const state = createSim(cfg, WORLD_WIDTH, WORLD_HEIGHT);
  for (let i = 0; i < WARMUP; i++) step(state, cfg);
  const t0 = performance.now();
  for (let i = 0; i < TICKS; i++) step(state, cfg);
  const ms = (performance.now() - t0) / TICKS;
  return { ms, alive: state.agents.length };
}

console.log(`seed '${config.seed}', ${WARMUP} warm-up + ${TICKS} timed ticks, radius ${config.society.radius}\n`);
console.log('agents | alive at end | ms/tick OFF | ms/tick ON | neighbour cost');
for (const n of SIZES) {
  const off = run(n, false);
  const on = run(n, true);
  console.log(`${String(n).padStart(6)} | ${String(on.alive).padStart(12)} | ${off.ms.toFixed(2).padStart(11)} | ${on.ms.toFixed(2).padStart(10)} | ${(on.ms - off.ms).toFixed(2).padStart(9)} ms`);
}
