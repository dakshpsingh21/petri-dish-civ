// config.js: every tunable number lives here, so no "magic numbers" hide in the logic.
// UPPER_SNAKE = fixed constants. The `config` object = live knobs (sliders will change these in S6).

export const MAX_STEPS_PER_FRAME = 10; // max sim ticks per rendered frame (stops the "spiral of death")
export const MAX_FRAME_MS = 250;       // ignore frame gaps bigger than this (e.g. tab was in background)

export const WORLD_WIDTH = 200;        // in cells (becomes a New World setup option in S8)
export const WORLD_HEIGHT = 150;

export const config = {
  seed: 'daksh',        // any string; rng.js hashes it into a 32-bit number

  // Feature flags: every mechanic can be switched off (debugging, perf cost, A/B experiments).
  features: {
    terrain: true,      // false = the whole map is plains (the S1 world)
    twoResources: true, // false = grain only (agents don't need fruit)
  },

  // Terrain generation (becomes New World setup sliders in S8).
  // Elevation and moisture are noise maps stretched to 0..1.
  terrain: {
    elevationScale: 50,   // size of the biggest landforms, in cells
    moistureScale: 35,
    waterLevel: 0.35,     // elevation below this = water
    hillLevel: 0.70,      // above this = hills
    mountainLevel: 0.85,  // above this = mountains
    forestMoisture: 0.55, // lowland wetter than this = forest, else plains
  },

  ticksPerSecond: 20,   // sim speed: world-steps per real second (independent of screen refresh rate)
  foodMax: 10,          // most of ONE resource a cell can hold (terrain decides how much of that it gets)
  // Regrowth = FRACTION OF A CELL'S OWN CAP regrown per tick (0.002 -> empty to full in 500 ticks).
  // So fertile cells produce more per tick, and poor cells barely produce at all.
  grainRegrowth: 0.002,
  fruitRegrowth: 0.002,

  initialAgents: 2000,  // deliberately MORE than the world can feed, so we see a die-off
  startStore: 10,       // grain AND fruit each agent spawns with
  maxStore: 20,         // most of EACH resource an agent can carry
  biteSize: 2,          // most of EACH resource an agent eats per tick
  metabolism: 0.25,     // amount of EACH resource burned per tick (total 0.5, same as S1)
};
