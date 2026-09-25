// sim.js: the rules of the world, one tick at a time.
// NO DOM, NO clock, NO Math.random(). That's why it can run headless (tests, experiments)
// and why the same seed always gives the same history.

import { createRng, hashString } from './rng.js';
import { createWorld, regrow, isPassable, yearFraction, seasonName, seasonFactor } from './world.js';
import { createAgent, rollLifespan, growOlder, moveTowardFood, eat, metabolize, tryReproduce } from './agent.js';
import { randomGenes, varyGenes, neutralCulture, geneDistance } from './genes.js';
import { createBus } from './events.js';
import { createTribes, foundTribe, updatePopulations } from './tribes.js';
import { findNeighborsNaive } from './neighbors.js';

// Build a brand-new world from config. Reset = call this again.
// `bus` is passed IN, so listeners (main.js, tests) can subscribe BEFORE the
// tick-0 "tribe:founded" events fire. Headless runs can leave it out.
export function createSim(config, width, height, bus = createBus()) {
  const rng = createRng(hashString(config.seed));
  const world = createWorld(width, height, rng, config);
  const state = { tick: 0, rng, world, bus, agents: [], nextAgentId: 1, season: null,
    tribes: createTribes(), births: 0, deaths: { starved: 0, oldAge: 0 },
    contacts: { agents: 0, pairs: 0 } };
  updateSeason(state, config);

  // Starting tribes: each gets a random home on land and its own random "base" genes.
  const homes = [];
  for (let t = 0; t < config.tribes.startCount; t++) {
    const home = randomLandCell(world, rng);
    if (!home) break;
    home.tribe = foundTribe(state.tribes, randomGenes(rng), 0, 0, rng, bus);
    homes.push(home);
  }

  for (let n = 0; n < config.initialAgents && homes.length > 0; n++) {
    const cell = randomLandCell(world, rng);
    if (!cell) break;                      // no land found: stop spawning
    // Join the NEAREST home's tribe -> tribes start as regions, not confetti.
    // Founders are small variations on their tribe's genes -> tribes differ from day one.
    const tribe = nearestHome(homes, cell.x, cell.y).tribe;
    const founder = createAgent({
      id: state.nextAgentId++, x: cell.x, y: cell.y, grain: config.startStore, fruit: config.startStore,
      genes: varyGenes(tribe.founderGenes, config.tribes.founderSpread, rng), culture: neutralCulture(),
      maxAge: rollLifespan(rng, config), tribeId: tribe.id,
    });
    // Founders start somewhere in the first half of life, so they don't all hit
    // old age at once (a fake "mass extinction" around year 2).
    founder.age = rng.int(founder.maxAge >> 1);
    state.agents.push(founder);
  }
  updatePopulations(state.tribes, state.agents, 0, bus);
  return state;
}

// Re-roll until we land on walkable ground (no spawning in lakes or on peaks).
// The attempt cap stops an endless loop on a map that is ALL water/mountain.
function randomLandCell(world, rng) {
  for (let tries = 0; tries < 1000; tries++) {
    const x = rng.int(world.width);
    const y = rng.int(world.height);
    if (isPassable(world, x, y)) return { x, y };
  }
  return null;
}

// Plain distance check against every home: only ~8 homes, so no need for anything clever.
function nearestHome(homes, x, y) {
  let best = homes[0], bestD = Infinity;
  for (const h of homes) {
    const d = (h.x - x) ** 2 + (h.y - y) ** 2;   // squared distance: same order, no sqrt
    if (d < bestD) { bestD = d; best = h; }
  }
  return best;
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

  // 4. Meetings: who ended up next to whom, AFTER everyone has moved.
  //    For now we only count them; share / trade / steal plug in here next (S4 steps 2-3).
  if (config.features.interactions) meet(state, config);

  // 5. Births. After everyone has eaten, so "well fed" means well fed THIS tick.
  if (config.features.reproduction) reproduce(state, config, living);

  // 6. Clear out the dead, then recount tribes (and announce any that died out).
  removeDead(state.agents);
  updatePopulations(state.tribes, state.agents, state.tick, state.bus);

  state.tick++;
}

// Scratch list, reused for every agent every tick (never kept between calls).
const nearby = [];

// For every living agent, find its neighbours and count contacts.
// contacts.agents = agents with at least one neighbour; contacts.pairs = sum of neighbour
// counts (each pair counted twice, once from each side). Tells us how crowded the world is.
function meet(state, config) {
  let agents = 0, pairs = 0;
  for (const agent of state.agents) {
    if (!agent.alive) continue;
    findNeighborsNaive(state.agents, agent, config.society.radius, nearby);
    if (nearby.length > 0) agents++;
    pairs += nearby.length;
  }
  state.contacts.agents = agents;
  state.contacts.pairs = pairs;
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
      if (config.features.tribeSplits) checkSplit(state, config, child);
      state.agents.push(child);
      state.births++;
      living++;
    }
  }
}

// A child born too different from its tribe's founder starts a NEW tribe, with its own
// genes as the new founder genes. Checked only at birth: genes never change after that.
function checkSplit(state, config, child) {
  const tribe = state.tribes.byId.get(child.tribeId);
  if (geneDistance(child.genes, tribe.founderGenes) <= config.tribes.splitThreshold) return;
  const newTribe = foundTribe(state.tribes, child.genes, state.tick, tribe.id, state.rng, state.bus);
  child.tribeId = newTribe.id;
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
