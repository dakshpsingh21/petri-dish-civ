// main.js: entry point. Owns the browser loop and wires sim <-> screen.
// It knows about BOTH the sim and the page. sim.js knows nothing about the page.

import { config, MAX_STEPS_PER_FRAME, MAX_FRAME_MS, WORLD_WIDTH, WORLD_HEIGHT } from './config.js';
import { createSim, step } from './sim.js';
import { createRenderer } from './render.js';
import { createBus } from './events.js';
import { livingTribes } from './tribes.js';

const canvas = document.getElementById('world');

// Subscribe BEFORE creating the sim, so we also hear the tick-0 "tribe:founded" events.
// For now events just go to the console; the History Book (S11) will listen here too.
const bus = createBus();
bus.on('tribe:founded', e => console.log(e.parentName
  ? `[tick ${e.tick}] The ${e.name} split off from the ${e.parentName}.`
  : `[tick ${e.tick}] The ${e.name} are founded.`));
bus.on('tribe:extinct', e => console.log(`[tick ${e.tick}] The ${e.name} have died out.`));

const state = createSim(config, WORLD_WIDTH, WORLD_HEIGHT, bus);

// ---------- Canvas sizing ----------
// Buffer size must match the window or the image stretches. The renderer re-fits
// the world to the canvas every frame, so nothing else is needed here.
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const renderer = createRenderer(canvas, state.world);

// ---------- Measuring (for the overlay) ----------
const meter = { fps: 0, tps: 0, frames: 0, ticks: 0, since: performance.now() };

function updateMeter(now, stepsThisFrame) {
  meter.frames++;
  meter.ticks += stepsThisFrame;
  if (now - meter.since >= 1000) {          // once per second, publish the counts
    meter.fps = meter.frames;
    meter.tps = meter.ticks;
    meter.frames = 0;
    meter.ticks = 0;
    meter.since = now;
  }
}

// Average of each gene across living agents (read-only peek at sim state for the overlay).
// Cheap enough per frame at ~1-2k agents; S6 moves this into yearly stats.
function averageGenes(agents) {
  const sum = { greed: 0, trust: 0, aggression: 0, memory: 0 };
  for (const a of agents) for (const k in sum) sum[k] += a.genes[k];
  const n = agents.length || 1;
  return `genes greed ${(sum.greed / n).toFixed(2)} trust ${(sum.trust / n).toFixed(2)} aggr ${(sum.aggression / n).toFixed(2)} mem ${(sum.memory / n).toFixed(2)}`;
}

// "tribes 7 alive  biggest Karuvel (412)" for the overlay.
function tribeSummary(tribes) {
  const alive = livingTribes(tribes);
  if (alive.length === 0) return 'tribes none';
  const biggest = alive.reduce((a, b) => (b.population > a.population ? b : a));
  return `tribes ${alive.length} alive  biggest ${biggest.name} (${biggest.population})`;
}

// ---------- The fixed-timestep loop ----------
// Real time pours into a bucket (`acc`). We scoop it out in fixed-size chunks,
// one tick per chunk, so the sim always moves in identical steps whatever the FPS.
let acc = 0;
let last = performance.now();

function frame(now) {
  // 1. Pour in real time since last frame (clamped, so a background tab doesn't
  //    try to catch up on minutes of ticks at once).
  acc += Math.min(now - last, MAX_FRAME_MS);
  last = now;

  // 2. Scoop out whole ticks.
  const stepMs = 1000 / config.ticksPerSecond;
  let steps = 0;
  while (acc >= stepMs && steps < MAX_STEPS_PER_FRAME) {
    step(state, config);
    acc -= stepMs;
    steps++;
  }
  // Hit the cap? The machine can't keep up: drop the backlog so the sim slows
  // down gracefully instead of freezing (the "spiral of death").
  if (steps === MAX_STEPS_PER_FRAME) acc = 0;

  // 3. Draw once, no matter how many ticks ran.
  updateMeter(now, steps);
  renderer.render(state, config, [
    `FPS   ${meter.fps}`,
    `TPS   ${meter.tps}  (target ${config.ticksPerSecond})`,
    `tick  ${state.tick}`,
    `year  ${state.season.year}  ${state.season.name}`,
    `grow  grain x${state.season.grainFactor.toFixed(2)}  fruit x${state.season.fruitFactor.toFixed(2)}`,
    `alive ${state.agents.length}  (cap ${config.reproduction.maxPopulation})`,
    `born  ${state.births}   died: starved ${state.deaths.starved}  old age ${state.deaths.oldAge}`,
    averageGenes(state.agents),
    tribeSummary(state.tribes),
    `key   colour=tribe  size=food  dark=old  red edge=aggressive`,
    `seed  ${config.seed}`,
  ]);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
