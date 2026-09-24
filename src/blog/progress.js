// Reading progress on article pages: the homepage critter walks along a pixel
// track at the top edge as you scroll — forward while reading, turning around when
// you scroll back. The walk follows scrolling only; with reduced motion it slides
// without stepping. Decorative, so hidden from assistive technology.
import { gridToPaths } from './pixel-art.js';
import { CRITTER } from './scene.js';

const SCALE = 3;
const WIDTH = 6 * SCALE;

export function attachReadingProgress(parent, { reducedMotion = false } = {}) {
  const root = document.createElement('div');
  root.className = 'read-progress';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="read-track"><div class="read-fill"></div></div><svg class="read-critter pixel-art" viewBox="0 0 6 5" shape-rendering="crispEdges"></svg>`;
  parent.append(root);
  const fill = root.querySelector('.read-fill');
  const critter = root.querySelector('.read-critter');

  let last = -1;
  let frame = '';
  let step = 0;
  let travelled = 0;
  let facing = 'right';
  let idle;
  let queued = false;

  const draw = name => { if (name !== frame) { critter.innerHTML = gridToPaths(CRITTER[name]); frame = name; } };

  function update() {
    queued = false;
    if (!root.isConnected) return cleanup();
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
    const x = Math.round(progress * (root.clientWidth - WIDTH));
    fill.style.width = `${(progress * 100).toFixed(2)}%`;
    critter.style.transform = `translateX(${x}px)`;
    if (last >= 0 && x !== last && !reducedMotion) {
      facing = x > last ? 'right' : 'left';
      travelled += Math.abs(x - last);
      if (travelled >= 6) { step = (step + 1) % 2; travelled = 0; }
      draw(step ? `${facing}2` : facing);
      clearTimeout(idle);
      idle = setTimeout(() => draw(progress >= 0.995 ? 'blink' : 'front'), 350);
    } else if (last < 0) draw('front');
    last = x;
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  function cleanup() {
    clearTimeout(idle);
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  schedule();
  return cleanup;
}
