// noise.js: seeded 2D "value noise", used to generate terrain (S2).
// Pure sim code: no DOM, no Math.random(), no Math.sin() (engines can differ in the last bits).
//
// Idea in 3 layers:
//  1. Lattice: every INTEGER point (ix, iy) gets a pseudo-random value in [0, 1),
//     computed by hashing (ix, iy, seed). Same inputs -> same value, forever.
//  2. Value noise: for any point BETWEEN lattice points, blend the 4 surrounding corner
//     values. Plain linear blending leaves visible "creases" at grid lines, so we ease the
//     blend with smoothstep -> soft, rolling hills.
//  3. Fractal noise: add several layers ("octaves"). Each octave has 2x the detail
//     (frequency) and a fraction of the strength (amplitude). Big shapes = continents,
//     small shapes = coastline wiggle.

// 1. Hash an integer grid point to [0, 1). Multiply by big odd constants and XOR-shift
// to scramble the bits (same trick as rng.js). No table needed: works for any ix, iy.
function latticeValue(ix, iy, seed) {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smoothstep: an S-curve from 0 to 1. Its slope is 0 at both ends, so neighbouring
// cells join smoothly instead of forming sharp creases.
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 2. Value noise at any real point (x, y). Output in [0, 1).
export function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smoothstep(x - x0);   // how far across the square we are, eased
  const sy = smoothstep(y - y0);

  // The 4 corners of the lattice square that contains (x, y).
  const a = latticeValue(x0, y0, seed);
  const b = latticeValue(x0 + 1, y0, seed);
  const c = latticeValue(x0, y0 + 1, seed);
  const d = latticeValue(x0 + 1, y0 + 1, seed);

  // Blend left->right on the top and bottom edges, then top->bottom.
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

// 3. Fractal noise: sum `octaves` layers. persistence = how much weaker each layer is (0.5 = half).
// We divide by the total amplitude so the result stays in [0, 1).
export function fractalNoise(x, y, seed, octaves = 4, persistence = 0.5) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let totalAmplitude = 0;
  for (let o = 0; o < octaves; o++) {
    // A different seed per octave, so the layers don't line up with each other.
    sum += valueNoise(x * frequency, y * frequency, (seed + o * 1013) | 0) * amplitude;
    totalAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return sum / totalAmplitude;
}

// Convenience: a whole width x height map, one value per cell, in a flat Float32Array
// (same layout as world.food: index = y * width + x).
// scale = size of the biggest features in cells (bigger = broader continents).
export function noiseMap(width, height, seed, { scale = 40, octaves = 4, persistence = 0.5 } = {}) {
  const map = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      map[y * width + x] = fractalNoise(x / scale, y / scale, seed, octaves, persistence);
    }
  }
  return map;
}
