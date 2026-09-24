// main.js: entry point.
// S1 step 1: set up a full-window canvas and paint it, to prove the pipeline works.

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d'); // the 2D "paintbrush" for this canvas

// A canvas has TWO sizes: its CSS size (how big it looks) and its drawing-buffer
// size (how many pixels it really has). If they differ, the image gets stretched
// and blurry. So we set the buffer to match the window exactly.
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw(); // changing width/height wipes the canvas, so we must redraw
}

function draw() {
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#7fd1b9';
  ctx.font = '20px monospace';
  ctx.fillText('Petri Dish Civilization: it lives (soon)', 20, 40);
}

window.addEventListener('resize', resize);
resize();
