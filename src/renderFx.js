// renderFx.js: draws the flashes from fx.js and ages them. Never touches sim state or the RNG.
//   trade = gold ring, share = green ring, steal = red spark, death = faint white ripple.
// Each flash grows and fades over config.view.fxLife frames (per FRAME, like trails:
// a bit quicker on 144Hz screens; render-only, accepted).

import { FX_TRADE, FX_SHARE, FX_STEAL, FX_DEATH } from './fx.js';

const COLORS = ['255, 200, 60', '90, 220, 120', '255, 70, 50', '235, 240, 255'];  // by fx type
const GROWTH = [1.5, 1.2, 1.0, 3.0];   // how many cells wide each type grows (death ripples spread most)

export function createFxPainter(ctx) {
  return function drawFx(view, fx, config) {
    const life = config.view.fxLife;
    const { scale } = view;
    ctx.lineWidth = Math.max(1, scale / 4);
    // One pass per type, so each colour's strokeStyle is set only a few times per frame.
    for (let type = FX_TRADE; type <= FX_DEATH; type++) {
      for (let i = 0; i < fx.capacity; i++) {
        if (fx.type[i] !== type || fx.age[i] >= life) continue;
        const t = fx.age[i] / life;                     // 0 = just started, 1 = gone
        const cx = view.x + (fx.x[i] + 0.5) * scale;    // centre of the cell on screen
        const cy = view.y + (fx.y[i] + 0.5) * scale;
        const r = scale * (0.5 + t * GROWTH[type]);
        ctx.strokeStyle = `rgba(${COLORS[type]}, ${(1 - t) * (type === FX_DEATH ? 0.5 : 0.9)})`;
        ctx.beginPath();
        if (type === FX_STEAL) {                        // spark: a small "x" that bursts outward
          ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
          ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
        } else {                                        // pulses and ripples: expanding rings
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    }
    for (let i = 0; i < fx.capacity; i++) fx.age[i]++;  // everything one frame older
  };
}
