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
    seasons: true,      // false = regrowth is the same all year
    reproduction: true, // false = no births (the S1-S2 world: one generation, then empty)
    mutation: true,     // false = children are exact gene clones of their parent
    aging: true,        // false = nobody dies of old age, metabolism stays flat
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

  // View settings: change what you SEE, never what happens (render-only, no RNG).
  view: {
    trails: true,       // agents leave fading trails -> migration routes and home ranges appear
    trailFade: 0.08,    // how much of each trail pixel's opacity is erased per frame
  },

  ticksPerSecond: 20,   // sim speed: world-steps per real second (independent of screen refresh rate)
  foodMax: 10,          // most of ONE resource a cell can hold (terrain decides how much of that it gets)
  // Regrowth = FRACTION OF A CELL'S OWN CAP regrown per tick (0.006 -> empty to full in ~170 ticks).
  // So fertile cells produce more per tick, and poor cells barely produce at all.
  // With births on, THIS sets the carrying capacity (headless, seed 'daksh'):
  // 0.002 -> ~310 agents, 0.004 -> ~700, 0.006 -> ~1,200. Population scales with food.
  grainRegrowth: 0.006,
  fruitRegrowth: 0.006,

  // Time: one "year" = this many ticks (30 s at 20 TPS). The History Book will count in years.
  ticksPerYear: 600,
  // Seasons scale regrowth up and down over the year. The AVERAGE over a year stays 1,
  // so seasons move food around in time; they don't add or remove any.
  seasons: {
    strength: 0.8,      // 0 = no seasons; 0.8 = regrowth swings between x0.2 and x1.8
    grainPeak: 0.375,   // point in the year when grain grows fastest (0.375 = mid-summer)
    fruitPeak: 0.625,   // fruit peaks later (mid-autumn), so the two harvests don't line up
  },

  initialAgents: 1000,  // founders; births take it from here
  startStore: 10,       // grain AND fruit each agent spawns with
  maxStore: 20,         // most of EACH resource an agent can carry
  biteSize: 2,          // most of EACH resource an agent eats per tick
  metabolism: 0.25,     // amount of EACH resource burned per tick (total 0.5, same as S1)

  // Genes are 0..1. Each child gene = parent + (rng() - rng()) * mutationRate, clamped.
  mutationRate: 0.05,   // max change per generation per gene (typical change is much smaller)

  aging: {
    lifespanBase: 1200,   // ticks (2 years at 600 ticks/year = one minute of real time)
    lifespanSpread: 400,  // each agent's maxAge = base +/- up to this (seeded)
    agingCost: 0.5,       // metabolism at maxAge = 1.5x a newborn's
  },

  reproduction: {
    threshold: 16,        // need at least this much of EACH store to have a child (max 20)
    minAge: 200,          // ticks before an agent can breed (10 s). Fewer doomed babies -> LESS churn
                          // and a BIGGER population (minAge 0: ~1,060, median age 90; 200: ~1,210, median 149)
    cooldown: 600,        // ticks between children (one a year). Fewer births -> fewer starving babies:
                          // cooldown 0: ~1,160 agents, 0% old-age deaths; 600: ~1,400, ~10% old age
    maxPopulation: 5000,  // hard safety cap (perf target). Food should limit us long before this.
  },
};
