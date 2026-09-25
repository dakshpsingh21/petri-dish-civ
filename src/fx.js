// fx.js: the visual-effects buffer. The sim WRITES flashes here; the renderer READS and fades them.
// Two rules keep visuals from ever changing history:
//   1. Nothing in here uses the RNG. Sampling is a plain counter ("keep every 8th steal").
//   2. The sim never READS this buffer, so what's on screen can't feed back into the rules.
// Fixed-size ring buffer in typed arrays: when full, the newest flash overwrites the oldest.
// No allocation per flash, no matter how busy the world gets.

export const FX_TRADE = 0;
export const FX_SHARE = 1;
export const FX_STEAL = 2;
export const FX_DEATH = 3;

export function createFx(capacity) {
  return {
    capacity,
    next: 0,                                          // slot the next flash goes into
    x: new Int16Array(capacity),
    y: new Int16Array(capacity),
    type: new Uint8Array(capacity),
    age: new Float32Array(capacity).fill(Infinity),   // frames since it started; Infinity = empty slot
    seen: new Uint32Array(4),                         // events seen per type, for sampling
  };
}

// Record a flash at cell (x, y), keeping only 1 in every `every` events of this type.
// Steals happen ~70 times a tick: drawing them all would just be noise (and slow).
export function pushFx(fx, type, x, y, every) {
  if (fx.seen[type]++ % every !== 0) return;
  const i = fx.next;
  fx.x[i] = x;
  fx.y[i] = y;
  fx.type[i] = type;
  fx.age[i] = 0;
  fx.next = (i + 1) % fx.capacity;                    // wrap around: that's the "ring"
}
