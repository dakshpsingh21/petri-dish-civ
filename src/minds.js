// minds.js: what agents remember about each other (S4), tribe opinions (S5), gossip next.
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

// `target` feels `delta` about `actor`: a full-size change to their personal reputation,
// and a smaller one (x tribeOpinionRate) to their opinion of the actor's whole TRIBE.
function feel(target, actor, delta, config) {
  remember(target, actor.id, delta, config);
  if (config.features.tribeOpinions) nudgeTribe(target, actor.tribeId, delta * config.minds.tribeOpinionRate);
}

// After an interaction, the one it was DONE TO updates their opinion of the actor.
// (Trade helps both, so both remember it.) A theft, even a failed attempt, hurts; stealing
// from someone who liked you (reputation > 0) is a BETRAYAL and costs `betrayalMultiplier` x.
// Returns true if it was a betrayal, so the caller can count it.
export function updateReputation(action, agent, other, config) {
  const s = config.society;
  if (action === 'TRADE') {
    feel(other, agent, s.repTrade, config);
    feel(agent, other, s.repTrade, config);
  } else if (action === 'SHARE') {
    feel(other, agent, s.repShare, config);
  } else if (action === 'STEAL') {
    const betrayal = (other.memory.get(agent.id) ?? 0) > 0;   // peek: no LRU touch needed
    feel(other, agent, -s.repSteal * (betrayal ? s.betrayalMultiplier : 1), config);
    return betrayal;
  }
  return false;
}

// ---------- tribe opinions (S5) ----------
// agent.tribeOpinions: Map tribeId -> opinion (-1..+1) of a WHOLE tribe, built from what its
// members did to me. It lets me judge a stranger by their tribe ("the Varu are thieves").
// No LRU: an agent only ever meets a handful of tribes, so the Map stays tiny.

const clampRep = (v) => Math.max(-1, Math.min(1, v));

export function tribeOpinion(agent, tribeId) {
  return agent.tribeOpinions.get(tribeId) ?? 0;
}

function nudgeTribe(agent, tribeId, delta) {
  agent.tribeOpinions.set(tribeId, clampRep(tribeOpinion(agent, tribeId) + delta));
}

// What `agent` knows about `other`, most specific first:
// personal reputation -> opinion of their tribe -> 0 (then decide() runs on trust alone).
// touch = true counts as 'thinking about them' (LRU). The victim's guard only peeks (false).
export function opinionOf(agent, other, config, touch = true) {
  if (agent.memory.has(other.id)) return touch ? recall(agent, other.id) : agent.memory.get(other.id);
  return config.features.tribeOpinions ? tribeOpinion(agent, other.tribeId) : 0;
}
