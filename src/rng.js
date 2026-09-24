// rng.js: seeded random numbers.
// Math.random() can't be seeded, so two runs would never match. With our own generator,
// the same seed always gives the same sequence -> the same world, the same history.
// RULE: sim code uses this, never Math.random().

// hashString: turns any text seed ("riverwar") into a 32-bit unsigned integer.
// Algorithm: FNV-1a. Mix each character in with XOR, then scramble with a multiply.
export function hashString(str) {
  let h = 2166136261;                 // FNV "offset basis" (a standard starting value)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);           // mix in this character
    h = Math.imul(h, 16777619);       // FNV prime. Math.imul = real 32-bit integer multiply
  }
  return h >>> 0;                     // >>> 0 reads the bits as an unsigned number (0..2^32-1)
}

// createRng: mulberry32, a tiny, fast generator with 32 bits of state.
// Each call to next() advances the state and scrambles it into a float in [0, 1).
export function createRng(seed) {
  let state = seed >>> 0;

  function next() {
    // `| 0` keeps state a 32-bit integer. Without it, state would keep growing as a
    // float and silently lose precision after a few million calls.
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);     // shifts + XORs + multiplies scramble the bits
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // divide by 2^32 -> [0, 1)
  }

  // Fisher-Yates shuffle, in place: walk backwards, swap each item with a random
  // earlier-or-same position. Every ordering is equally likely.
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  return {
    next,
    int: (n) => Math.floor(next() * n),               // integer 0..n-1
    range: (min, max) => min + next() * (max - min),  // float in [min, max)
    shuffle,
  };
}
