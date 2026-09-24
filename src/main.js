// main.js: entry point. Owns the browser loop and wires sim <-> screen.
// S1 step 3: world with regrowing food, drawn by render.js.

import { config, MAX_STEPS_PER_FRAME, MAX_FRAME_MS, WORLD_WIDTH, WORLD_HEIGHT } from './config.js';
import { createRng, hashString } from './rng.js';
import { createWorld, regrow } from './world.js';
import { createRenderer } from './render.js';

const canvas = document.getElementById('world');

// ---------- Sim state (moves to sim.js in step 4) ----------
const rng = createRng(hashString(config.seed));
const state = {
  tick: 0,
  rng,
  world: createWorld(WORLD_WIDTH, WORLD_HEIGHT, rng, config.foodMax),
};

// Advance the world by exactly ONE tick. Temporary home until sim.js exists.
function step(state) {
  regrow(state.world, config.foodRegrowth, config.foodMax);
  state.tick++;
}

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
    step(state);
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
    `seed  ${config.seed}`,
  ]);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
