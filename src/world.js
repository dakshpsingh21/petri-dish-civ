// world.js: the grid of cells: terrain + food. Pure sim code: no DOM, no Math.random().
//
// Every per-cell property is ONE flat typed array. Cell (x, y) lives at index
// i = y * width + x (row by row, like reading a page). Compact and fast to loop over.

import { noiseMap } from './noise.js';

// Terrain types. Stored as small integers in a Uint8Array (1 byte per cell).
export const WATER = 0, PLAINS = 1, FOREST = 2, HILLS = 3, MOUNTAIN = 4;
export const TERRAIN_NAMES = ['water', 'plains', 'forest', 'hills', 'mountain'];

// Lookup tables indexed by terrain type: faster and clearer than a chain of ifs.
export const PASSABLE = [false, true, true, true, false];   // can agents stand here?
const FOOD_CAP_FRACTION = [0, 1, 1, 0.4, 0];               // share of foodMax this terrain can hold

export function createWorld(width, height, rng, config) {
  const n = width * height;
  const world = {
    width, height,
    elevation: new Float32Array(n),   // 0..1, kept for shading + regions later
    moisture: new Float32Array(n),    // 0..1
    terrain: new Uint8Array(n),       // WATER..MOUNTAIN
    foodCap: new Float32Array(n),     // most food this cell can ever hold
    food: new Float32Array(n),        // food right now
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

  for (let i = 0; i < n; i++) {
    world.foodCap[i] = FOOD_CAP_FRACTION[world.terrain[i]] * config.foodMax;
    world.food[i] = rng.next() * world.foodCap[i];   // seeded random starting amount
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

// Every cell grows back a little each tick, capped by what its terrain can hold.
export function regrow(world, rate) {
  const { food, foodCap } = world;
  for (let i = 0; i < food.length; i++) {
    const grown = food[i] + rate;
    food[i] = grown > foodCap[i] ? foodCap[i] : grown;
  }
}
