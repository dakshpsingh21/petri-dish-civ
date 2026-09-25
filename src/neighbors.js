// neighbors.js: "who is near me?", the NAIVE way, on purpose.
// Every agent checks every other agent: n x n checks per tick (25 million at 5,000 agents).
// It's kept this simple so S12 has an honest "before" number. The spatial hash will
// return the SAME neighbours, just with far fewer checks.

// Fill `out` with every OTHER living agent within `radius` cells of `agent`, and return it.
// Distance = Chebyshev (the bigger of |dx| and |dy|): radius 1 = my cell + the 8 around it,
// the same square agents move in. The caller passes in `out` and we reuse it, so there's
// no new array per agent per tick (no garbage for the garbage collector).
// Order = order of `agents` (already shuffled by the seeded RNG), so results are deterministic.
export function findNeighborsNaive(agents, agent, radius, out) {
  out.length = 0;
  for (const other of agents) {
    if (other === agent || !other.alive) continue;
    if (Math.abs(other.x - agent.x) <= radius && Math.abs(other.y - agent.y) <= radius) {
      out.push(other);
    }
  }
  return out;
}
