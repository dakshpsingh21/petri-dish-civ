// sim.js: the rules of the world, one tick at a time.
// NO DOM, NO clock, NO Math.random(). That's why it can run headless (tests, experiments)
// and why the same seed always gives the same history.

import { createRng, hashString } from './rng.js';
import { createWorld, regrow, isPassable, yearFraction, seasonName, seasonFactor } from './world.js';
import { createAgent, rollLifespan, growOlder, moveTowardFood, eat, metabolize, tryReproduce } from './agent.js';
import { randomGenes, neutralCulture } from './genes.js';

// Build a brand-new world from config. Reset = call this again.
export function createSim(config, width, height) {
  const rng = createRng(hashString(config.seed));
  const world = createWorld(width, height, rng, config);
  const state = { tick: 0, rng, world, agents: [], nextAgentId: 1, season: null,
    births: 0, deaths: { starved: 0, oldAge: 0 } };
  updateSeason(state, config);

  for (let n = 0; n < config.initialAgents; n++) {
    // Re-roll until we land on walkable ground (no spawning in lakes or on peaks).
    // The attempt cap stops an endless loop on a map that is ALL water/mountain.
    let x, y, tries = 0;
    do {
      x = rng.int(width);
      y = rng.int(height);
    } while (!isPassable(world, x, y) && ++tries < 1000);
    if (!isPassable(world, x, y)) break;   // no land found: stop spawning
    const founder = createAgent({
      id: state.nextAgentId++, x, y, grain: config.startStore, fruit: config.startStore,
      genes: randomGenes(rng), culture: neutralCulture(), maxAge: rollLifespan(rng, config),
    });
    // Founders start somewhere in the first half of life, so they don't all hit
    // old age in the same tick (a fake "mass extinction" in year 3).
    founder.age = rng.int(founder.maxAge >> 1);
    state.agents.push(founder);
  }
  return state;
}

// Advance exactly ONE tick. The ORDER of these phases is part of the rules:
// change it and you change history (and the RNG sequence).
export function step(state, config) {
  // 1. Food grows back, faster or slower depending on the season.
  updateSeason(state, config);
  regrow(state.world,
    config.grainRegrowth * state.season.grainFactor,
    config.fruitRegrowth * state.season.fruitFactor);

  // 2. Shuffle who goes first. Without this, agent #0 would ALWAYS get first pick
  //    of the food, a hidden unfair advantage baked into the array order.
  state.rng.shuffle(state.agents);

  // 3. Each agent lives one tick. Count survivors and causes of death as we go.
  let living = 0;
  for (const agent of state.agents) {
    if (!growOlder(agent, config)) {          // died of old age -> skip the rest
      moveTowardFood(agent, state.world, state.rng, config);
      eat(agent, state.world, config);
      metabolize(agent, config);
    }
    if (agent.alive) living++;
    else state.deaths[agent.diedOf]++;
  }

  // 4. Births. After everyone has eaten, so "well fed" means well fed THIS tick.
  if (config.features.reproduction) reproduce(state, config, living);

  // 5. Clear out the dead.
  removeDead(state.agents);

  state.tick++;
}

// Every living, well-fed agent may have ONE child per tick, until the population cap.
// The order was shuffled in step 2, so near the cap nobody always wins the last slot.
// We loop only up to the length BEFORE any births: newborns wait until next tick.
function reproduce(state, config, living) {
  const cap = config.reproduction.maxPopulation;
  const n = state.agents.length;
  for (let i = 0; i < n && living < cap; i++) {
    const parent = state.agents[i];
    if (!parent.alive) continue;
    const child = tryReproduce(parent, state.nextAgentId, state.world, state.rng, config);
    if (child) {
      state.nextAgentId++;
      state.agents.push(child);
      state.births++;
      living++;
    }
  }
}

// Work out where we are in the year. Stored on state so the overlay (and later the
// History Book) can read it without re-computing anything.
function updateSeason(state, config) {
  const frac = yearFraction(state.tick, config.ticksPerYear);
  const s = config.seasons;
  const on = config.features.seasons;
  state.season = {
    year: Math.floor(state.tick / config.ticksPerYear) + 1,
    name: seasonName(frac),
    grainFactor: on ? seasonFactor(frac, s.grainPeak, s.strength) : 1,
    fruitFactor: on ? seasonFactor(frac, s.fruitPeak, s.strength) : 1,
  };
}

// One-pass "compaction": copy each living agent down to the next free slot, then
// cut the array. O(n) total. Calling splice() per death would be O(n) EACH time.
function removeDead(agents) {
  let write = 0;
  for (let read = 0; read < agents.length; read++) {
    if (agents[read].alive) agents[write++] = agents[read];
  }
  agents.length = write;
}
