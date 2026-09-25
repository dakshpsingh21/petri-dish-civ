// config.js: every tunable number lives here, so no "magic numbers" hide in the logic.
// UPPER_SNAKE = fixed constants. The `config` object = live knobs (sliders will change these in S6).

export const MAX_STEPS_PER_FRAME = 10; // max sim ticks per rendered frame (stops the "spiral of death")
export const MAX_FRAME_MS = 250;       // ignore frame gaps bigger than this (e.g. tab was in background)

export const FX_CAPACITY = 256;       // most flashes on screen at once (ring buffer, oldest overwritten)

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
    tribeSplits: true,  // false = the starting tribes are the only tribes ever
    interactions: true, // false = agents never meet (no neighbour search, no share/trade/steal)
    tribeOpinions: true, // false = strangers are judged on trust alone (the S4 world)
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
    aggressiveEdge: 0.7, // agents with effective aggression above this get a red edge
    flashes: true,      // trade / share / steal / death flashes (fx.js); off = nothing recorded
    fxLife: 30,         // frames a flash lasts (~0.5 s at 60fps)
    fxEvery: { trade: 1, share: 4, steal: 8, death: 1 }, // draw 1 in N events (steals are ~70/tick)
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

  tribes: {
    startCount: 8,        // starting tribes; each founder joins the tribe whose home is nearest
    founderSpread: 0.15,  // how far a founder's genes can stray from its tribe's base genes
    // Child's gene distance from its tribe's founder genes above this -> it founds a new tribe.
    // 0.35: first splits ~year 5-7, then ~10-15/year; most die young, ~15 tribes of 20+ by year 40.
    // Self-limiting: every split resets the reference for that line (mean distance holds ~0.19).
    // Must stay above the max founder spread (sqrt(4) x 0.15 = 0.3) or founders would count as splits.
    splitThreshold: 0.35,
  },

  // Society (S4): agents meet neighbours, then share, trade or steal.
  society: {
    radius: 1,            // how far away (in cells) counts as "next to me". 1 = my cell + the 8 around it
    minScore: 0.1,        // an action's score (0..1) must beat this, else IGNORE (well-fed strangers just pass by)
    shareAmount: 2,       // most food given in one SHARE
    tradeAmount: 3,       // most food swapped EACH WAY in one TRADE
    stealAmount: 3,       // most food taken in one successful STEAL
    memoryMin: 2,         // agents remembered with memory gene 0
    memoryMax: 20,        // ... and with memory gene 1 (LRU: forget the least recently used)
    repTrade: 0.2,        // reputation change for BOTH sides of a trade
    repShare: 0.3,        // receiver's opinion of the giver
    repSteal: 0.3,        // victim's opinion of the thief drops by this (attempts count too)
    betrayalMultiplier: 3, // stealing from someone who LIKED you: 3x the drop (-0.9)
    guardWeight: 0.5,     // steal chance drops by this x victim's distrust (known thief at -1: -50%)
    reputationWeight: 0.5, // how much reputation (-1..+1) shifts warmth: 0.5 -> a cheater cuts my trust by up to 0.5
  },

  // Minds (S5): opinions, gossip, learned trust, culture.
  minds: {
    tribeOpinionRate: 0.3, // a member's deed moves my opinion of their WHOLE tribe by this x the personal change
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
