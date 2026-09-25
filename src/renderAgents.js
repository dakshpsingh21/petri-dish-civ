// renderAgents.js: draws the agents. READS state, never changes it, never uses the RNG.
//
//   colour     = tribe (its golden-angle hue)
//   size       = food carried (grain + fruit): full agents fill their cell, starving ones shrink
//   lightness  = age: young agents are bright, old ones dark (4 bands)
//   edge       = red if aggressive (effective aggression above config.view.aggressiveEdge),
//                otherwise dark, so every tribe colour stands out on grass AND fields

import { effectiveTrait } from './genes.js';

const AGE_LIGHTNESS = [70, 60, 50, 38];   // % lightness per age band, young -> old
const AGGRESSIVE_EDGE = '#ff2a2a';
const NORMAL_EDGE = '#10141c';   // same as the page background

export function createAgentPainter(ctx) {
  // Setting ctx.fillStyle is slow-ish (the browser parses the colour string), so we GROUP
  // agents by colour and set it once per group instead of once per agent.
  // Both Maps live across frames, so we don't rebuild strings or arrays every frame.
  const styleCache = new Map();   // tribeId * 4 + ageBand -> 'hsl(...)' string
  const groups = new Map();       // 'hsl(...)' -> agents to draw in that colour this frame

  function styleFor(agent, tribes) {
    const band = Math.min(3, Math.floor((4 * agent.age) / agent.maxAge));
    const key = agent.tribeId * 4 + band;
    let style = styleCache.get(key);
    if (!style) {
      const hue = Math.round(tribes.byId.get(agent.tribeId).hue);
      style = `hsl(${hue}, 80%, ${AGE_LIGHTNESS[band]}%)`;
      styleCache.set(key, style);
    }
    return style;
  }

  // Square size in pixels: 60% of the max when empty, 100% when both stores are full.
  // (45% made starving agents ~2px: too small to see their colour.)
  function sizeOf(agent, maxSize, maxStore) {
    const fullness = Math.min(1, (agent.grain + agent.fruit) / (2 * maxStore));
    return Math.max(1, Math.round(maxSize * (0.6 + 0.4 * fullness)));
  }

  // A square 1px bigger on every side, drawn BEFORE the body, so it shows as an edge.
  function drawEdges(agents, view, maxSize, maxStore, px, py, aggressive, threshold) {
    for (const a of agents) {
      if ((effectiveTrait(a, 'aggression') > threshold) !== aggressive) continue;
      const s = sizeOf(a, maxSize, maxStore);
      ctx.fillRect(px(a) - 1, py(a) - 1, s + 2, s + 2);
    }
  }

  return function drawAgents(view, state, config) {
    const { scale } = view;
    const detailed = scale >= 4;                       // too small to show edges and gaps below this
    const maxSize = detailed ? scale - 2 : scale;      // leave a 1px gap so crowds stay readable
    const maxStore = config.maxStore;
    const px = a => view.x + a.x * scale + ((scale - sizeOf(a, maxSize, maxStore)) >> 1);
    const py = a => view.y + a.y * scale + ((scale - sizeOf(a, maxSize, maxStore)) >> 1);

    // Pass 1: edges. Two colours -> two passes, one fillStyle each.
    if (detailed) {
      const threshold = config.view.aggressiveEdge;
      ctx.fillStyle = NORMAL_EDGE;
      drawEdges(state.agents, view, maxSize, maxStore, px, py, false, threshold);
      ctx.fillStyle = AGGRESSIVE_EDGE;
      drawEdges(state.agents, view, maxSize, maxStore, px, py, true, threshold);
    }

    // Pass 2: bodies, grouped by colour.
    for (const list of groups.values()) list.length = 0;   // empty the groups, keep the arrays
    for (const a of state.agents) {
      const style = styleFor(a, state.tribes);
      let list = groups.get(style);
      if (!list) groups.set(style, (list = []));
      list.push(a);
    }
    for (const [style, list] of groups) {
      if (list.length === 0) { groups.delete(style); continue; }   // tribe gone: drop its group
      ctx.fillStyle = style;
      for (const a of list) {
        const s = sizeOf(a, maxSize, maxStore);
        ctx.fillRect(px(a), py(a), s, s);
      }
    }
  };
}
