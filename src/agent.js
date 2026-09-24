// agent.js: what ONE agent is and what it does. Pure sim code: no DOM, no Math.random().

import { cellIndex, isPassable } from './world.js';

// Plain object for now: easy to read and inspect in the console.
// (Traits, tribe, memory arrive in S3-S5. Typed arrays only if profiling says so.)
export function createAgent(id, x, y, energy) {
  return { id, x, y, energy, age: 0, alive: true };
}

// Look at your own cell + the 8 around it, step to the one with the most food.
// Ties are broken randomly (seeded), which gives us a free "random wander" when
// every nearby cell is empty (all 0) or all full (all foodMax).
export function moveTowardFood(agent, world, rng) {
  let bestX = agent.x;
  let bestY = agent.y;
  let bestFood = -1;
  let ties = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = agent.x + dx;
      const y = agent.y + dy;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue; // world edge = wall
      if (!isPassable(world, x, y)) continue;                                 // water / mountain = wall

      const food = world.food[cellIndex(world, x, y)];
      if (food > bestFood) {
        bestFood = food;
        bestX = x;
        bestY = y;
        ties = 1;
      } else if (food === bestFood) {
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

// Take a bite from your cell: limited by what's there, your bite size, and room left in your belly.
export function eat(agent, world, config) {
  const i = cellIndex(world, agent.x, agent.y);
  const room = config.maxEnergy - agent.energy;
  const bite = Math.min(world.food[i], config.biteSize, room);
  world.food[i] -= bite;
  agent.energy += bite;
}

// Being alive costs energy. Run out and you die.
export function burnEnergy(agent, config) {
  agent.energy -= config.metabolism;
  if (agent.energy <= 0) agent.alive = false;
}
