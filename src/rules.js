// rules.js: when two agents meet, what does the actor do?
// decide() is a PURE function: it only reads its inputs and returns a word. No RNG, no
// changes to anyone, no hidden state -> same inputs always give the same answer.
// That makes it trivial to test and to explain ("why did agent 812 steal?").
//
// Each trait has ONE job, so behaviour stays readable:
//   trust (+ reputation) = warmth -> cooperate (trade, share)
//   aggression                    -> steal
//   greed                         -> refuse to share

import { effectiveTrait, clamp01 } from './genes.js';

// How badly an agent wants each resource: 0 = full, 1 = empty.
function hunger(agent, maxStore) {
  return { grain: 1 - agent.grain / maxStore, fruit: 1 - agent.fruit / maxStore };
}

// The resource this agent lacks most (ties -> grain, so the answer is always the same).
function mostNeeded(h) {
  return h.fruit > h.grain ? 'fruit' : 'grain';
}

// agent = the actor, other = who it met.
// context = { reputation, config }. reputation: what `agent` thinks of `other`,
// -1 (cheated me) .. 0 (stranger) .. +1 (always fair). Memory fills this in step 4.
// Returns 'TRADE' | 'SHARE' | 'STEAL' | 'IGNORE'.
export function decide(agent, other, context) {
  const { maxStore, society } = context.config;
  const trust = effectiveTrait(agent, 'trust');
  const greed = effectiveTrait(agent, 'greed');
  const aggression = effectiveTrait(agent, 'aggression');

  // Warmth: how much I'm willing to cooperate with THIS agent. Trust is my general
  // attitude, reputation is my experience with them. A cheater cools even a trusting agent.
  const warmth = clamp01(trust + society.reputationWeight * context.reputation);

  const mine = hunger(agent, maxStore);
  const theirs = hunger(other, maxStore);
  const iNeed = mostNeeded(mine);
  const theyNeed = mostNeeded(theirs);
  const myNeed = mine[iNeed];
  const theirNeed = theirs[theyNeed];

  // TRADE: we complement each other (each has more of what the other lacks).
  // Gain = how lopsided I am: 18 grain / 2 fruit gains a lot, 10 / 10 gains nothing.
  let trade = 0;
  if (iNeed !== theyNeed && other[iNeed] > agent[iNeed] && agent[theyNeed] > other[theyNeed]) {
    trade = Math.abs(mine.grain - mine.fruit) * (0.5 + 0.5 * warmth);
  }

  // STEAL: they have more of what I need most. Hungry + aggressive + distrustful = thief.
  let steal = 0;
  if (other[iNeed] > agent[iNeed]) steal = myNeed * aggression * (1 - warmth);

  // SHARE: they're hungrier than me and I have more of what they need.
  let share = 0;
  if (theirNeed > myNeed && agent[theyNeed] > other[theyNeed]) {
    share = (theirNeed - myNeed) * (1 - greed) * warmth;
  }

  // Highest score wins. Ties go trade > share > steal (strict > below), so it's deterministic.
  let best = 'IGNORE', bestScore = society.minScore;   // below this, nothing is worth doing
  if (trade > bestScore) { best = 'TRADE'; bestScore = trade; }
  if (share > bestScore) { best = 'SHARE'; bestScore = share; }
  if (steal > bestScore) { best = 'STEAL'; bestScore = steal; }
  return best;
}

// ---------- apply(): make the decision happen ----------
// Food only MOVES between the two agents, it is never created or destroyed (same rule as
// births). Every amount is capped at HALF THE GAP between them, so the giver never ends up
// poorer than the receiver, and a victim can never be robbed down to 0.
// Returns how much food moved (0 = nothing happened, e.g. a failed theft).
// guard (0..1): how much `other` distrusts `agent` (0 = stranger/friend, 1 = known thief).
// Passed in by the caller so rules.js doesn't need to know how memory works.

// Most `from` can hand `to` of resource r: the knob, half the gap, and the room `to` has left.
function transferable(from, to, r, amount, maxStore) {
  return Math.max(0, Math.min(amount, (from[r] - to[r]) / 2, maxStore - to[r]));
}

export function apply(action, agent, other, rng, config, guard = 0) {
  const { maxStore, society } = config;
  const iNeed = mostNeeded(hunger(agent, maxStore));
  const theyNeed = mostNeeded(hunger(other, maxStore));

  if (action === 'SHARE') {
    const n = transferable(agent, other, theyNeed, society.shareAmount, maxStore);
    agent[theyNeed] -= n;
    other[theyNeed] += n;
    return n;
  }

  if (action === 'TRADE') {
    // Equal swap: I give what they lack, they give what I lack. Limited by BOTH directions.
    const n = Math.min(
      transferable(agent, other, theyNeed, society.tradeAmount, maxStore),
      transferable(other, agent, iNeed, society.tradeAmount, maxStore));
    agent[theyNeed] -= n; other[theyNeed] += n;
    other[iNeed] -= n;    agent[iNeed] += n;
    return n;
  }

  if (action === 'STEAL') {
    // Success depends on who is fiercer: equal aggression = coin flip, 1 vs 0 = sure thing.
    // A victim who KNOWS you're a thief guards their stores: chance drops by guardWeight x guard.
    // This is what makes a bad reputation cost the thief something.
    // ALWAYS one rng call, success or not, so the RNG sequence doesn't depend on the outcome.
    const fierceness = 0.5 + 0.5 * (effectiveTrait(agent, 'aggression') - effectiveTrait(other, 'aggression'));
    const chance = clamp01(fierceness - society.guardWeight * guard);
    if (rng.next() >= chance) return 0;
    const n = transferable(other, agent, iNeed, society.stealAmount, maxStore);
    other[iNeed] -= n;
    agent[iNeed] += n;
    return n;
  }

  return 0;   // IGNORE
}
