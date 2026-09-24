// world.js: the grid of cells: terrain + two resources. Pure sim code: no DOM, no Math.random().
//
// Two resources, grain and fruit, grow in DIFFERENT places. Agents need both, so they must
// travel between plains and forest, and (from S4) trade. The borders between the two become prime land.
//
// Every per-cell property is ONE flat typed array. Cell (x, y) lives at index
// i = y * width + x (row by row, like reading a page). Compact and fast to loop over.

import { noiseMap } from './noise.js';

// Terrain types. Stored as small integers in a Uint8Array (1 byte per cell).
export const WATER = 0, PLAINS = 1, FOREST = 2, HILLS = 3, MOUNTAIN = 4;
export const TERRAIN_NAMES = ['water', 'plains', 'forest', 'hills', 'mountain'];

// Lookup tables indexed by terrain type: faster and clearer than a chain of ifs.
export const PASSABLE = [false, true, true, true, false];   // can agents stand here?

// Share of foodMax each terrain can hold, per resource.   water plains forest hills mountain
const GRAIN_CAP = [0, 1.0, 0.15, 0.3, 0];   // grain loves dry open plains
const FRUIT_CAP = [0, 0.15, 1.0, 0.3, 0];   // fruit loves wet forest
const SINGLE_CAP = [0, 1.0, 1.0, 0.4, 0];   // twoResources OFF: grain grows like S1's food

export function createWorld(width, height, rng, config) {
  const n = width * height;
  const world = {
    width, height,
    elevation: new Float32Array(n),   // 0..1, kept for shading + regions later
    moisture: new Float32Array(n),    // 0..1
    terrain: new Uint8Array(n),       // WATER..MOUNTAIN
    grainCap: new Float32Array(n),    // most grain this cell can ever hold
    fruitCap: new Float32Array(n),
    grain: new Float32Array(n),       // grain right now
    fruit: new Float32Array(n),
  };

  if (config.features.terrain) {
    // Draw each map's seed from the main RNG, so the ONE world seed decides everything.
    const t = config.terrain;
    world.elevation = stretch01(noiseMap(width, height, rng.int(4294967296), { scale: t.elevationScale }));
    world.moisture = stretch01(noiseMap(width, height, rng.int(4294967296), { scale: t.moistureScale }));
    for (let i = 0; i < n; i++) world.terrain[i] = classify(world.elevation[i], world.moisture[i], t);
  } else {
    world.terrain.fill(PLAINS);
    world.elevation.fill(0.5);
  }

  const two = config.features.twoResources;
  for (let i = 0; i < n; i++) {
    const t = world.terrain[i];
    world.grainCap[i] = (two ? GRAIN_CAP[t] : SINGLE_CAP[t]) * config.foodMax;
    world.fruitCap[i] = (two ? FRUIT_CAP[t] : 0) * config.foodMax;
    world.grain[i] = rng.next() * world.grainCap[i];   // seeded random starting amounts
    world.fruit[i] = rng.next() * world.fruitCap[i];
  }
  return world;
}

// Blending averages things out, so raw noise rarely reaches 0 or 1 (it was ~0.21..0.93).
// Stretch it so the lowest cell = 0 and the highest = 1; then thresholds like 0.85 mean
// "the top 15% of the height range" on every map.
function stretch01(map) {
  let min = Infinity, max = -Infinity;
  for (const v of map) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;                       // avoid dividing by 0 on a flat map
  for (let i = 0; i < map.length; i++) map[i] = (map[i] - min) / range;
  return map;
}

// Height decides the big picture; moisture decides what grows on the lowlands.
function classify(elev, moist, t) {
  if (elev < t.waterLevel) return WATER;
  if (elev > t.mountainLevel) return MOUNTAIN;
  if (elev > t.hillLevel) return HILLS;
  return moist > t.forestMoisture ? FOREST : PLAINS;
}

// Convert (x, y) -> array index. Tiny, but it keeps the formula in ONE place.
export function cellIndex(world, x, y) {
  return y * world.width + x;
}

export function isPassable(world, x, y) {
  return PASSABLE[world.terrain[y * world.width + x]];
}

// ---------- Time and seasons ----------
// The year runs 0 -> 1: spring [0, 0.25), summer [0.25, 0.5), autumn [0.5, 0.75), winter [0.75, 1).
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];

export function yearFraction(tick, ticksPerYear) {
  return (tick % ticksPerYear) / ticksPerYear;
}

export function seasonName(frac) {
  return SEASON_NAMES[Math.floor(frac * 4)];
}

// Regrowth multiplier for a resource that grows fastest at `peak` in the year.
// Shape: a TRIANGLE wave: straight lines up to the peak, then down. Pure arithmetic, so
// it's identical in every browser (Math.sin could differ in the last bits and break determinism).
// Returns 1 - strength (worst moment) .. 1 + strength (peak). Averages exactly 1 over a year.
export function seasonFactor(frac, peak, strength) {
  let d = Math.abs(frac - peak);   // distance from the peak, in years...
  if (d > 0.5) d = 1 - d;          // ...going the SHORT way round (the year wraps: winter -> spring)
  const closeness = 1 - 2 * d;     // 1 at the peak, 0 half a year away
  return 1 + strength * (2 * closeness - 1);
}

// Every cell grows back a FRACTION OF ITS OWN CAP each tick.
// Why not a flat amount? With a flat +0.02, a forest cell (small grain cap) would still
// PRODUCE grain as fast as a plains cell whenever someone kept eating it: the cap only
// limited storage, not production. Scaling by the cap makes fertile land truly more productive.
export function regrow(world, grainRate, fruitRate) {
  growTowardCap(world.grain, world.grainCap, grainRate);
  growTowardCap(world.fruit, world.fruitCap, fruitRate);
}

function growTowardCap(amount, cap, rate) {
  for (let i = 0; i < amount.length; i++) {
    const grown = amount[i] + cap[i] * rate;
    amount[i] = grown > cap[i] ? cap[i] : grown;
  }
}
