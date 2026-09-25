// The uv style's light. Hidden ink (a > [!uv] callout, rendered as .uv-ink) is laid over
// the block just before it; a violet torch follows the pointer (or a finger) and, only
// under the uv style, shows the ink inside its circle while the words above it fade.
// SVG ink (the room's wall) is masked by a lens circle that follows the torch.
import { el } from '../core/dom.js';

/** Stack each .uv-ink with the block before it, so the ink sits behind that text. */
export function layInk(container) {
  container.querySelectorAll('.uv-ink').forEach(ink => {
    const cover = ink.previousElementSibling;
    if (!cover || ink.parentElement.classList.contains('uv-layer')) return;
    const layer = el('div', 'uv-layer');
    cover.before(layer);
    layer.append(cover, ink);
  });
}

/** One torch for the whole page; it only shows (and only works) under the uv style. */
export function attachTorch() {
  const torch = el('div', 'uv-torch');
  torch.setAttribute('aria-hidden', 'true');
  document.body.append(torch);
  let x = -1000;
  let y = -1000;
  let frame = 0;
  function paint() {
    frame = 0;
    if (document.documentElement.dataset.theme !== 'uv') return;
    torch.style.transform = `translate(${x}px, ${y}px)`;
    for (const layer of document.querySelectorAll('.uv-layer')) {
      const box = layer.getBoundingClientRect();
      if (box.bottom < -100 || box.top > innerHeight + 100) continue;
      // Masks are placed in each block's own box, so each gets its own light position.
      for (const block of layer.children) {
        const own = block.getBoundingClientRect();
        block.style.setProperty('--uv-x', `${x - own.left}px`);
        block.style.setProperty('--uv-y', `${y - own.top}px`);
      }
    }
    // Ink drawn in SVG (the room's wall): the lens circle in its mask follows the torch, and keeps
    // following while the scene moves under a still pointer.
    const marks = document.querySelectorAll('[data-uv-lens]');
    for (const mark of marks) {
      const lens = document.getElementById(mark.dataset.uvLens)?.querySelector('.uv-lens');
      const matrix = mark.getScreenCTM();
      if (!lens || !matrix) continue;
      const at = new DOMPoint(x, y).matrixTransform(matrix.inverse());
      lens.setAttribute('cx', at.x);
      lens.setAttribute('cy', at.y);
      lens.setAttribute('r', 70 / Math.hypot(matrix.a, matrix.b));
    }
    if (marks.length) frame = requestAnimationFrame(paint);
  }
  const move = (nextX, nextY) => {
    x = nextX;
    y = nextY;
    frame ||= requestAnimationFrame(paint);
  };
  addEventListener('pointermove', event => move(event.clientX, event.clientY), { passive: true });
  addEventListener('pointerdown', event => move(event.clientX, event.clientY), { passive: true });
  addEventListener('touchmove', event => move(event.touches[0].clientX, event.touches[0].clientY), { passive: true });
  addEventListener('scroll', () => move(x, y), { passive: true });
  document.addEventListener('mouseout', event => { if (!event.relatedTarget) move(-1000, -1000); });
}
