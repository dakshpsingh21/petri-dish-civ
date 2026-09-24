// agent.js: what ONE agent is and what it does. Pure sim code: no DOM, no Math.random().

import { cellIndex, isPassable } from './world.js';

// Plain object for now: easy to read and inspect in the console.
// Agents carry TWO stores. Running out of EITHER one kills them.
// (Traits, tribe, memory arrive in S3-S5. Typed arrays only if profiling says so.)
export function createAgent(id, x, y, startStore) {
  return { id, x, y, grain: startStore, fruit: startStore, age: 0, alive: true };
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
export function metabolize(agent, config) {
  if (config.features.twoResources) {
    agent.grain -= config.metabolism;
    agent.fruit -= config.metabolism;
  } else {
    agent.grain -= config.metabolism * 2;   // same TOTAL need, so flag on/off is a fair comparison
  }
  if (agent.grain <= 0 || agent.fruit <= 0) agent.alive = false;
}
