// render.js: draws the sim onto the canvas. READS state, never changes it.
//
// Food trick: we paint 1 pixel per cell into a small hidden ("offscreen") canvas,
// then stretch that onto the real canvas in ONE drawImage call. Much cheaper than
// 30,000 separate fillRect calls.

const BG = '#10141c';

export function createRenderer(canvas, world) {
  const ctx = canvas.getContext('2d');

  // Offscreen canvas: exactly world.width x world.height pixels. Never added to the page.
  const layer = document.createElement('canvas');
  layer.width = world.width;
  layer.height = world.height;
  const layerCtx = layer.getContext('2d');

  // ImageData = raw pixel memory. data is a Uint8ClampedArray: 4 bytes per pixel (R, G, B, A).
  // "Clamped" means values auto-round and stay within 0..255, so we can't overflow a color.
  const image = layerCtx.createImageData(world.width, world.height);
  const px = image.data;

  // Biggest WHOLE-number zoom that fits the window, centered.
  // Whole numbers keep every cell the same size (no blurry or uneven pixels).
  function fitView() {
    const scale = Math.max(1, Math.floor(Math.min(canvas.width / world.width, canvas.height / world.height)));
    const w = world.width * scale;
    const h = world.height * scale;
    return { scale, x: Math.floor((canvas.width - w) / 2), y: Math.floor((canvas.height - h) / 2), w, h };
  }

  function drawFood(view, foodMax) {
    const food = world.food;
    for (let i = 0; i < food.length; i++) {
      const t = food[i] / foodMax;   // 0 = empty, 1 = full
      const p = i * 4;               // where this cell's 4 bytes start
      px[p]     = 22 + t * 40;       // R
      px[p + 1] = 26 + t * 150;      // G: more food = greener
      px[p + 2] = 34 + t * 30;       // B
      px[p + 3] = 255;               // A: fully opaque
    }
    layerCtx.putImageData(image, 0, 0);

    // Resizing a canvas resets this setting, so we set it every frame (it's cheap).
    // false = scale up with hard pixel edges instead of blurring them.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer, view.x, view.y, view.w, view.h);
  }

  function drawOverlay(lines) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(6, 6, 230, 12 + lines.length * 18);
    ctx.fillStyle = '#7fd1b9';
    ctx.font = '14px monospace';
    lines.forEach((text, i) => ctx.fillText(text, 12, 24 + i * 18));
  }

  // One full frame: background, world, then debug text on top.
  function render(state, config, overlayLines) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawFood(fitView(), config.foodMax);
    drawOverlay(overlayLines);
  }

  return { render };
}
