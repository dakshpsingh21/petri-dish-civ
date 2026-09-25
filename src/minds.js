// minds.js: what agents remember about each other (S4), later tribe opinions + gossip (S5).
// Sim code: no DOM, no RNG needed here (nothing in it is random).
//
// agent.memory is a Map: otherAgentId -> reputation (-1 = cheated me .. +1 = always fair).
// A Map remembers the ORDER keys were added. We use that as an LRU cache
// (Least Recently Used): every time we touch an entry we move it to the back, so the
// FIRST key is always the one we haven't thought about for longest -> forget that one.

// How many agents this one can remember: the `memory` gene (0..1) mapped onto min..max.
export function memoryCapacity(agent, config) {
  const { memoryMin, memoryMax } = config.society;
  return Math.round(memoryMin + agent.genes.memory * (memoryMax - memoryMin));
}

// What `agent` thinks of agent `otherId`. Strangers = 0. Recalling someone counts as
// "using" them, so they move to the back of the queue (the 'recently used' in LRU).
export function recall(agent, otherId) {
  const rep = agent.memory.get(otherId);
  if (rep === undefined) return 0;
  agent.memory.delete(otherId);   // delete + set = move to the back (newest)
  agent.memory.set(otherId, rep);
  return rep;
}

// Nudge `agent`'s opinion of `otherId` by `delta`, clamped to -1..+1.
// If memory is now over capacity, forget the oldest entry (the first key).
export function remember(agent, otherId, delta, config) {
  const old = agent.memory.get(otherId) ?? 0;
  agent.memory.delete(otherId);
  agent.memory.set(otherId, Math.max(-1, Math.min(1, old + delta)));   // clamp to -1..+1
  if (agent.memory.size > memoryCapacity(agent, config)) {
    agent.memory.delete(agent.memory.keys().next().value);            // oldest = first key
  }
}

// After an interaction, the one it was DONE TO updates their opinion of the actor.
// (Trade helps both, so both remember it.) A theft, even a failed attempt, hurts; stealing
// from someone who liked you (reputation > 0) is a BETRAYAL and costs `betrayalMultiplier` x.
// Returns true if it was a betrayal, so the caller can count it.
export function updateReputation(action, agent, other, config) {
  const s = config.society;
  if (action === 'TRADE') {
    remember(other, agent.id, s.repTrade, config);
    remember(agent, other.id, s.repTrade, config);
  } else if (action === 'SHARE') {
    remember(other, agent.id, s.repShare, config);
  } else if (action === 'STEAL') {
    const betrayal = (other.memory.get(agent.id) ?? 0) > 0;   // peek: no LRU touch needed
    remember(other, agent.id, -s.repSteal * (betrayal ? s.betrayalMultiplier : 1), config);
    return betrayal;
  }
  return false;
}
