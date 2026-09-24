// sim.js: the rules of the world, one tick at a time.
// NO DOM, NO clock, NO Math.random(). That's why it can run headless (tests, experiments)
// and why the same seed always gives the same history.

import { createRng, hashString } from './rng.js';
import { createWorld, regrow } from './world.js';
import { createAgent, moveTowardFood, eat, burnEnergy } from './agent.js';

// Build a brand-new world from config. Reset = call this again.
export function createSim(config, width, height) {
  const rng = createRng(hashString(config.seed));
  const world = createWorld(width, height, rng, config.foodMax);
  const state = { tick: 0, rng, world, agents: [], nextAgentId: 1 };

  for (let n = 0; n < config.initialAgents; n++) {
    const x = rng.int(width);
    const y = rng.int(height);
    state.agents.push(createAgent(state.nextAgentId++, x, y, config.startEnergy));
  }
  return state;
}

// Advance exactly ONE tick. The ORDER of these phases is part of the rules:
// change it and you change history (and the RNG sequence).
export function step(state, config) {
  // 1. Food grows back.
  regrow(state.world, config.foodRegrowth, config.foodMax);

  // 2. Shuffle who goes first. Without this, agent #0 would ALWAYS get first pick
  //    of the food, a hidden unfair advantage baked into the array order.
  state.rng.shuffle(state.agents);

  // 3. Each agent lives one tick.
  for (const agent of state.agents) {
    agent.age++;
    moveTowardFood(agent, state.world, state.rng);
    eat(agent, state.world, config);
    burnEnergy(agent, config);
  }

  // 4. Clear out the dead.
  removeDead(state.agents);

  state.tick++;
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
