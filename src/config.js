// config.js: every tunable number lives here, so no "magic numbers" hide in the logic.
// UPPER_SNAKE = fixed constants. The `config` object = live knobs (sliders will change these in S6).

export const MAX_STEPS_PER_FRAME = 10; // max sim ticks per rendered frame (stops the "spiral of death")
export const MAX_FRAME_MS = 250;       // ignore frame gaps bigger than this (e.g. tab was in background)

export const WORLD_WIDTH = 200;        // in cells (becomes a New World setup option in S8)
export const WORLD_HEIGHT = 150;

export const config = {
  seed: 'daksh',        // any string; rng.js hashes it into a 32-bit number
  ticksPerSecond: 20,   // sim speed: world-steps per real second (independent of screen refresh rate)
  foodMax: 10,          // most food one cell can hold
  foodRegrowth: 0.02,   // food added to every cell per tick (0 -> full takes foodMax / this = 500 ticks)

  initialAgents: 2000,  // deliberately MORE than the world can feed, so we see a die-off
  startEnergy: 20,      // energy each starting agent spawns with
  maxEnergy: 40,        // an agent can't store more than this
  biteSize: 2,          // most food an agent eats per tick
  metabolism: 0.5,      // energy burned per tick just by being alive
  // Rough carrying capacity = total regrowth / metabolism = (200*150*0.02) / 0.5 = 1200 agents
};
