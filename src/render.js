// render.js: draws the sim onto the canvas. READS state, never changes it.
//
// Layers, bottom to top:
//   1. terrain: painted ONCE into a hidden canvas (terrain never changes), reused every frame
//   2. food:    repainted every frame as semi-transparent green on top of the terrain
//   3. agents, then the debug overlay
// Each layer is 1 pixel per cell, stretched onto the screen with ONE drawImage call.

import { WATER, PLAINS, FOREST, HILLS, MOUNTAIN } from './world.js';

const BG = '#10141c';

// Base color per terrain type [R, G, B], indexed by the terrain number.
const TERRAIN_RGB = [];
TERRAIN_RGB[WATER]    = [28, 60, 96];
TERRAIN_RGB[PLAINS]   = [120, 110, 62];
TERRAIN_RGB[FOREST]   = [44, 74, 44];
TERRAIN_RGB[HILLS]    = [110, 92, 70];
TERRAIN_RGB[MOUNTAIN] = [140, 140, 148];

const GRAIN_RGB = [232, 196, 72];   // golden
const FRUIT_RGB = [96, 200, 90];    // fresh green
const FOOD_MAX_ALPHA = 170;         // full food = strong color, but terrain still shows through

// A world-sized hidden canvas + its raw pixel memory.
function makeLayer(world) {
  const canvas = document.createElement('canvas');   // never added to the page
  canvas.width = world.width;
  canvas.height = world.height;
  const ctx = canvas.getContext('2d');
  // ImageData.data = Uint8ClampedArray, 4 bytes per pixel (R, G, B, A).
  // "Clamped": values auto-round and stay in 0..255, so a too-bright shade can't overflow.
  const image = ctx.createImageData(world.width, world.height);
  return { canvas, ctx, image, px: image.data };
}

export function createRenderer(canvas, world) {
  const ctx = canvas.getContext('2d');
  const terrainLayer = makeLayer(world);
  const foodLayer = makeLayer(world);

  paintTerrain(terrainLayer, world);   // once, up front

  // Biggest WHOLE-number zoom that fits the window, centered.
  // Whole numbers keep every cell the same size (no blurry or uneven pixels).
  function fitView() {
    const scale = Math.max(1, Math.floor(Math.min(canvas.width / world.width, canvas.height / world.height)));
    const w = world.width * scale;
    const h = world.height * scale;
    return { scale, x: Math.floor((canvas.width - w) / 2), y: Math.floor((canvas.height - h) / 2), w, h };
  }

  function drawLayer(layer, view) {
    // Resizing a canvas resets this setting, so we set it every time (it's cheap).
    // false = scale up with hard pixel edges instead of blurring them.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.canvas, view.x, view.y, view.w, view.h);
  }

  // Food: color = mix of gold (grain) and green (fruit), weighted by how much of each.
  // Transparency (alpha) = how much food in total. Empty cells are fully transparent,
  // so overgrazed land shows its bare terrain color.
  function paintFood(foodMax) {
    const { grain, fruit } = world;
    const px = foodLayer.px;
    for (let i = 0; i < grain.length; i++) {
      const g = grain[i] / foodMax;
      const f = fruit[i] / foodMax;
      const total = g + f;
      const p = i * 4;
      if (total === 0) { px[p + 3] = 0; continue; }   // nothing here: fully see-through
      const wg = g / total;                           // share of grain in the mix (0..1)
      px[p]     = GRAIN_RGB[0] * wg + FRUIT_RGB[0] * (1 - wg);
      px[p + 1] = GRAIN_RGB[1] * wg + FRUIT_RGB[1] * (1 - wg);
      px[p + 2] = GRAIN_RGB[2] * wg + FRUIT_RGB[2] * (1 - wg);
      px[p + 3] = Math.min(total, 1) * FOOD_MAX_ALPHA;
    }
    foodLayer.ctx.putImageData(foodLayer.image, 0, 0);
  }

  // Agents: one small square each. Same color for everyone, so we set fillStyle ONCE
  // (changing it per agent is surprisingly slow). Coral, so it stands out from gold and green.
  // Tribe colors arrive in S3.
  function drawAgents(view, agents) {
    const inset = view.scale >= 4 ? 1 : 0;   // leave a 1px gap so crowded agents stay readable
    const size = view.scale - inset * 2;
    ctx.fillStyle = '#ff6f59';
    for (const a of agents) {
      ctx.fillRect(view.x + a.x * view.scale + inset, view.y + a.y * view.scale + inset, size, size);
    }
  }

  function drawOverlay(lines) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(6, 6, 230, 12 + lines.length * 18);
    ctx.fillStyle = '#7fd1b9';
    ctx.font = '14px monospace';
    lines.forEach((text, i) => ctx.fillText(text, 12, 24 + i * 18));
  }

  // One full frame.
  function render(state, config, overlayLines) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const view = fitView();
    drawLayer(terrainLayer, view);
    paintFood(config.foodMax);
    drawLayer(foodLayer, view);   // drawImage respects alpha, so terrain shows through
    drawAgents(view, state.agents);
    drawOverlay(overlayLines);
  }

  return { render };
}

// Terrain color, shaded by elevation: low = darker, high = lighter.
// That one multiply gives deep lakes, and bright snowy-looking peaks, for free.
function paintTerrain(layer, world) {
  const { terrain, elevation } = world;
  const px = layer.px;
  for (let i = 0; i < terrain.length; i++) {
    const rgb = TERRAIN_RGB[terrain[i]];
    const shade = 0.55 + 0.9 * elevation[i];   // ~0.55 (deepest water) .. ~1.45 (highest peak)
    const p = i * 4;
    px[p]     = rgb[0] * shade;
    px[p + 1] = rgb[1] * shade;
    px[p + 2] = rgb[2] * shade;
    px[p + 3] = 255;
  }
  layer.ctx.putImageData(layer.image, 0, 0);
}
