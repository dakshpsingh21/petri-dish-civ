// society.js: the "meetings" phase of a tick. Who meets whom, what they do, and the tallies.
// Sim code: no DOM, randomness only from the seeded rng.

import { findNeighborsNaive } from './neighbors.js';
import { decide, apply } from './rules.js';
import { recall, updateReputation } from './minds.js';
import { tallyRelation } from './tribes.js';
import { pushFx, FX_TRADE, FX_SHARE, FX_STEAL } from './fx.js';

// Scratch list, reused for every agent every tick (never kept between calls).
const nearby = [];

// Every living agent (in the shuffled order) meets ONE random neighbour, decides, acts.
// contacts = how crowded the world is THIS tick; interactions = running totals since the start.
export function meet(state, config) {
  let agents = 0, pairs = 0;
  const totals = state.interactions;
  for (const agent of state.agents) {
    if (!agent.alive) continue;
    findNeighborsNaive(state.agents, agent, config.society.radius, nearby);
    if (nearby.length === 0) continue;
    agents++;
    pairs += nearby.length;

    const other = nearby[state.rng.int(nearby.length)];
    const action = decide(agent, other, { reputation: recall(agent, other.id), config });
    if (action === 'IGNORE') continue;
    // Victim's distrust of the actor (peek with get(): being robbed isn't 'thinking about' them).
    const guard = Math.max(0, -(other.memory.get(agent.id) ?? 0));
    const moved = apply(action, agent, other, state.rng, config, guard);
    const field = action === 'TRADE' ? 'trades' : action === 'SHARE' ? 'shares'
      : moved > 0 ? 'steals' : 'failedSteals';
    totals[field]++;
    tallyRelation(state.tribes, agent.tribeId, other.tribeId, field);
    if (config.view.flashes) flash(state.fx, field, other, config.view.fxEvery);
    if (updateReputation(action, agent, other, config)) {
      totals.betrayals++;
      tallyRelation(state.tribes, agent.tribeId, other.tribeId, 'betrayals');
    }
  }
  state.contacts.agents = agents;
  state.contacts.pairs = pairs;
}

// Record a flash where it happened (the target's cell). Failed steals don't flash.
function flash(fx, field, where, every) {
  if (field === 'trades') pushFx(fx, FX_TRADE, where.x, where.y, every.trade);
  else if (field === 'shares') pushFx(fx, FX_SHARE, where.x, where.y, every.share);
  else if (field === 'steals') pushFx(fx, FX_STEAL, where.x, where.y, every.steal);
}
