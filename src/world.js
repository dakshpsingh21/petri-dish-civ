// world.js: the grid of cells and the food on it. Pure sim code: no DOM, no Math.random().
//
// The grid is stored as ONE flat typed array, not a 2D array of cell objects.
// Cell (x, y) lives at index  i = y * width + x  (row by row, like reading a page).
// Why: 30,000 objects would be slow and memory-hungry. A Float32Array is one compact
// block of numbers, and looping over it is very fast.

export function createWorld(width, height, rng, foodMax) {
  const food = new Float32Array(width * height); // starts filled with 0s
  for (let i = 0; i < food.length; i++) {
    food[i] = rng.next() * foodMax;               // seeded random starting amount
  }
  return { width, height, food };
}

// Convert (x, y) -> array index. Tiny, but it keeps the formula in ONE place.
export function cellIndex(world, x, y) {
  return y * world.width + x;
}

// Every cell grows back a little each tick, capped at foodMax.
// (Linear growth for now: simple to reason about. Terrain-based caps arrive in S2.)
export function regrow(world, rate, foodMax) {
  const food = world.food;
  for (let i = 0; i < food.length; i++) {
    const grown = food[i] + rate;
    food[i] = grown > foodMax ? foodMax : grown;
  }
}
