// agent.js: what ONE agent is and what it does. Pure sim code: no DOM, no Math.random().

import { cellIndex, isPassable } from './world.js';
import { inheritGenes, copyCulture } from './genes.js';

// Plain object for now: easy to read and inspect in the console.
// Takes ONE object instead of 9 positional arguments: `{ id, x, y, ... }` can't be
// passed in the wrong order, and adding a field later doesn't break every caller.
// - grain/fruit: two stores. Running out of EITHER one kills the agent.
// - parentId 0 = founder (spawned at the start, no parent). tribeId: see tribes.js.
// - genes = nature (fixed for life), culture = nurture offsets (see genes.js).
// - maxAge: dies of old age on reaching it (if the aging flag is on).
// - lastBirth: age when it last had a child (-Infinity = never), for the birth cooldown.
// - diedOf: null while alive, then 'starved' or 'oldAge' (the History Book will want this).
// - memory: Map otherId -> reputation, an LRU cache (see minds.js). Starts EMPTY, never inherited.
// (Typed arrays only if profiling says so.)
export function createAgent({ id, x, y, grain, fruit, genes, culture, maxAge, tribeId, parentId = 0 }) {
  return { id, parentId, tribeId, x, y, grain, fruit, age: 0, maxAge, lastBirth: -Infinity, alive: true, diedOf: null, genes, culture, memory: new Map() };
}

// Lifespan = base +/- up to `spread`, uniform. Always rolled (even with aging off) so
// the RNG sequence is the same either way: flag on/off then compare like with like.
export function rollLifespan(rng, config) {
  const { lifespanBase, lifespanSpread } = config.aging;
  return Math.round(lifespanBase + rng.range(-lifespanSpread, lifespanSpread));
}

// One tick older. Returns true if that was the last one (death by old age).
export function growOlder(agent, config) {
  agent.age++;
  if (config.features.aging && agent.age >= agent.maxAge) {
    agent.alive = false;
    agent.diedOf = 'oldAge';
    return true;
  }
  return false;
}

// Handy total for things like drawing size later. Not stored, so it can never go stale.
export function totalFood(agent) {
  return agent.grain + agent.fruit;
}

// Look at your own cell + the 8 around it and step to the most USEFUL one.
// Usefulness = grain there x how hungry I am for grain + fruit there x how hungry I am for fruit.
// So an agent low on fruit heads for the forest, and one low on grain heads for the plains.
// When both stores are full, every cell scores 0 -> all tie -> random wander (seeded).
export function moveTowardFood(agent, world, rng, config) {
  const grainHunger = 1 - agent.grain / config.maxStore;   // 0 = full, 1 = empty
  const fruitHunger = config.features.twoResources ? 1 - agent.fruit / config.maxStore : 0;

  let bestX = agent.x;
  let bestY = agent.y;
  let bestScore = -1;
  let ties = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = agent.x + dx;
      const y = agent.y + dy;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue; // world edge = wall
      if (!isPassable(world, x, y)) continue;                                 // water / mountain = wall

      const i = cellIndex(world, x, y);
      const score = world.grain[i] * grainHunger + world.fruit[i] * fruitHunger;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
        ties = 1;
      } else if (score === bestScore) {
        // "Reservoir sampling": the k-th tied cell replaces the pick with chance 1/k.
        // In the end every tied cell had an equal chance, and we never needed a list.
        ties++;
        if (rng.int(ties) === 0) {
          bestX = x;
          bestY = y;
        }
      }
    }
  }
  agent.x = bestX;
  agent.y = bestY;
}

// Eat BOTH resources from your cell, each limited by what's there, bite size, and room left.
export function eat(agent, world, config) {
  const i = cellIndex(world, agent.x, agent.y);

  const grainBite = Math.min(world.grain[i], config.biteSize, config.maxStore - agent.grain);
  world.grain[i] -= grainBite;
  agent.grain += grainBite;

  const fruitBite = Math.min(world.fruit[i], config.biteSize, config.maxStore - agent.fruit);
  world.fruit[i] -= fruitBite;
  agent.fruit += fruitBite;
}

// Being alive burns some of EACH store. Hit 0 in either and you die.
// That "need both" rule is what forces travel between plains and forest (and later, trade).
// Aging: the body gets less efficient. Burn rises linearly with age, up to
// (1 + agingCost)x at maxAge. So old agents are the first to go in a lean season,
// and old age isn't just a switch that flips at the end.
export function metabolize(agent, config) {
  const ageFactor = config.features.aging ? 1 + config.aging.agingCost * (agent.age / agent.maxAge) : 1;
  const burn = config.metabolism * ageFactor;
  if (config.features.twoResources) {
    agent.grain -= burn;
    agent.fruit -= burn;
  } else {
    agent.grain -= burn * 2;   // same TOTAL need, so flag on/off is a fair comparison
  }
  if (agent.grain <= 0 || agent.fruit <= 0) {
    agent.alive = false;
    agent.diedOf = 'starved';
  }
}

// Well fed in BOTH stores? Have a child on a random walkable neighbour cell.
// The parent's stores are split in half: the child gets one half, the parent keeps the other.
// That split is the "cost" of a child, and also a natural cooldown: the parent must eat
// its way back up to the threshold before it can breed again.
// Returns the new child, or null (not fed enough, or boxed in by water/mountain).
export function tryReproduce(parent, childId, world, rng, config) {
  const t = config.reproduction.threshold;
  const needsFruit = config.features.twoResources;
  if (parent.age < config.reproduction.minAge) return null;   // too young to be a parent
  if (parent.age - parent.lastBirth < config.reproduction.cooldown) return null; // still recovering
  if (parent.grain < t || (needsFruit && parent.fruit < t)) return null;

  // Pick a random walkable neighbour (reservoir sampling again: no list needed).
  let cx = -1, cy = -1, seen = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = parent.x + dx;
      const y = parent.y + dy;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
      if (!isPassable(world, x, y)) continue;
      seen++;
      if (rng.int(seen) === 0) { cx = x; cy = y; }
    }
  }
  if (seen === 0) return null;

  const grain = parent.grain / 2;
  const fruit = parent.fruit / 2;
  parent.grain -= grain;
  parent.fruit -= fruit;
  parent.lastBirth = parent.age;
  const genes = inheritGenes(parent.genes, rng, config);   // nature: copy + small mutation
  const culture = copyCulture(parent.culture);            // nurture: learned from the parent
  return createAgent({
    id: childId, x: cx, y: cy, grain, fruit, genes, culture,
    maxAge: rollLifespan(rng, config), parentId: parent.id, tribeId: parent.tribeId,
  });
}
