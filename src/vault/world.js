// The world inside the homepage picture (world-level.js), drawn one screen at a time in a frame
// shaped like the picture. ←/→ or A/D walk, ↑/W/Space jump, E/Enter reads the letter again; touch
// screens get three buttons. Walking back off the first screen's right edge returns to the
// picture (onLeave). What has been found stays found until the page is reloaded or the room
// is locked. The letter comes from the room's encrypted content (room/letter.md in the vault).
import { gridToPaths, sprite } from '../blog/pixel-art.js';
import { CRITTER } from '../blog/scene.js';
import { el } from '../core/dom.js';
import { BOX, buildWorld, createGame, H, ITEMS, newProgress, W } from './world-level.js';

const SPRITES = {
  lantern: sprite(['.h.', 'oLo', 'oLo', 'ooo'], { h: 'px-far-light', o: 'px-trunk', L: 'px-window' }),
  seed: sprite(['.g.', 'gGg', '.g.'], { g: 'px-grass-light', G: 'px-flower' }),
  key: sprite(['mm...', 'm.mmm', 'mm.m.'], { m: 'px-moon' }),
  letter: sprite(['ooooooooo', 'oSmmmmmSo', 'omSmmmSmo', 'ommShSmmo', 'ommmmmmmo', 'ooooooooo'], { o: 'px-moon-shade', m: 'px-moon', S: 'px-moon-shade', h: 'px-heart' }),
};
const NAMES = { lantern: '灯', seed: '种子', key: '钥匙' };
const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
const at = (grid, x, y) => `<g transform="translate(${x} ${y})">${gridToPaths(grid)}</g>`;
const icon = grid => `<svg class="pixel-art" viewBox="0 0 ${grid[0].length} ${grid.length}" shape-rendering="crispEdges" aria-hidden="true">${gridToPaths(grid)}</svg>`;

let saved = { session: null, progress: null };

export function mountWorld(stage, { letter, onLeave, session = null }) {
  if (saved.session !== session) saved = { session, progress: newProgress() };
  const progress = saved.progress;
  const world = buildWorld();
  const game = createGame(world, progress);
  const { p } = game;

  stage.innerHTML = `<svg class="pixel-art world-scene" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">`
    + '<defs><radialGradient id="w-hole"><stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="#000"/><stop offset=".8" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
    + `<mask id="w-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><g class="w-holes"></g></mask></defs>`
    + '<g class="w-room"></g><g class="w-dyn"></g><g class="w-critter"></g>'
    + `<rect class="w-dark" width="${W}" height="${H}" mask="url(#w-mask)"/>`
    + '<text class="scene-icon-label world-say" text-anchor="middle"></text></svg>'
    + '<p class="room-hint">←/→ 走 · ↑ 跳</p>';
  const $ = selector => stage.querySelector(selector);
  const roomLayer = $('.w-room');
  const dynLayer = $('.w-dyn');
  const body = $('.w-critter');
  const dark = $('.w-dark');
  const holes = $('.w-holes');
  const bubble = $('.world-say');

  // Below the frame: what has been found, and (on touch screens) the buttons.
  const hud = el('div', 'world-hud');
  hud.setAttribute('aria-label', '找到的东西');
  const slots = Object.fromEntries(ITEMS.map(id => {
    const slot = el('span', 'world-slot');
    slot.innerHTML = icon(SPRITES[id]);
    slot.title = NAMES[id];
    hud.append(slot);
    return [id, slot];
  }));
  const pad = el('div', 'world-pad');
  pad.innerHTML = '<button class="button" data-pad="-1" aria-label="向左">◀</button><button class="button" data-pad="jump" aria-label="跳">▲</button><button class="button" data-pad="1" aria-label="向右">▶</button>';
  // The letter, over the page.
  const panel = el('div', 'world-letter');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '信');
  const paper = el('div', 'world-letter-paper');
  paper.append(el('h2', '', letter?.title || '信'));
  const text = el('div', 'world-letter-body');
  if (letter?.html) text.innerHTML = letter.html;
  else text.append(el('p', '', '信封里还是空的。'));
  const close = el('button', 'button', '收好信');
  paper.append(text, el('p', 'world-letter-end', '— 未完待续 —'), close);
  panel.append(paper);
  stage.after(hud, pad, panel);

  // --- drawing ------------------------------------------------------------------------------
  let grow = progress.planted ? 1 : 0;      // the vine, growing (0 → 1)
  let lift = progress.gateOpen ? 24 : 0;    // the gate's bars, rising (0 → 24)
  const drawRoom = () => {
    roomLayer.innerHTML = gridToPaths(p.room.cells);
    dark.style.display = p.room.dark ? '' : 'none';
    ITEMS.forEach(id => slots[id].classList.toggle('found', progress[id]));
  };
  function drawDyn(now) {
    const bob = Math.floor(now / 500) % 2;
    let out = '';
    for (const dyn of p.room.dyn) {
      if (dyn.kind === 'vine' && grow > 0) {
        const [sx, top, bottom] = dyn.stem;
        const reach = bottom - (bottom - top) * (p.room.key === '2,0' ? Math.min(1, grow * 1.6) : Math.max(0, grow * 1.6 - 0.6) / 1);
        out += `<rect class="px-grass" x="${sx}" y="${Math.round(reach)}" width="1" height="${bottom - Math.round(reach)}"/>`;
        for (const [x, y, w] of dyn.rects) {
          if (y < reach) continue;
          out += `<rect class="px-grass-light" x="${x}" y="${y}" width="${w}" height="1"/><rect class="px-grass" x="${x + 1}" y="${y + 1}" width="${w - 2}" height="1"/>`;
        }
        if (dyn.flower && reach <= dyn.stem[1]) out += `<rect class="px-flower" x="${dyn.flower[0]}" y="${dyn.flower[1]}" width="1" height="1"/><rect class="px-flower-alt" x="${dyn.flower[0] - 1}" y="${dyn.flower[1] + 1}" width="3" height="1"/>`;
      }
      if (dyn.kind === 'gate' && lift < 24) {
        const [x, y, w, h] = dyn.rects[0];
        for (let row = y + 4; row < y + h; row++) {
          const shown = row - lift;
          if (shown < y + 1) continue;
          for (const bx of [x, x + 2, x + 4]) out += `<rect class="px-trunk" x="${bx}" y="${shown}" width="1" height="1"/>`;
          if ((row - y) % 9 === 4) out += `<rect class="px-near-light" x="${x}" y="${shown}" width="${w}" height="1"/>`;
        }
      }
    }
    for (const t of p.room.things) {
      if (t.kind === 'item' && !progress[t.id]) {
        out += at(SPRITES[t.id], t.x, t.y - bob);
        if (Math.floor(now / 350) % 5 === 0) out += `<rect class="px-twinkle" x="${t.x + Math.floor(t.w / 2)}" y="${t.y - 3}" width="1" height="1"/>`;
      }
      if (t.kind === 'letter') {
        out += at(SPRITES.letter, t.x, t.y);
        if (Math.floor(now / 400) % 3 === 0) out += `<rect class="px-twinkle" x="${t.x + 4}" y="${t.y - 3}" width="1" height="1"/>`;
      }
      if (t.kind === 'friend') {
        out += at(CRITTER.blink, t.x, t.y);
        const z = Math.floor(now / 700) % 3;
        out += `<text class="scene-icon-label world-z" x="${t.x + 6 + z}" y="${t.y - 1 - z}">z</text>`;
      }
    }
    (p.room.fireflies || []).forEach(([x, y], i) => { if ((Math.floor(now / 300) + i * 3) % 7 < 4) out += `<rect class="px-firefly" x="${x + ((Math.floor(now / 900) + i) % 3) - 1}" y="${y}" width="1" height="1"/>`; });
    dynLayer.innerHTML = out;
  }
  let frame = '';
  function drawCritter(now) {
    const side = p.face > 0 ? 'right' : 'left';
    const pose = !p.ground ? `${side}2` : p.clock ? (Math.floor(p.clock / 0.15) % 2 ? `${side}2` : side) : now % 4000 < 150 ? 'blink' : 'front';
    if (pose !== frame) { body.innerHTML = gridToPaths(CRITTER[pose]); frame = pose; }
    body.setAttribute('transform', `translate(${p.x} ${p.y})`);
    bubble.setAttribute('x', Math.max(8, Math.min(W - 8, p.x + 3)));
    bubble.setAttribute('y', Math.max(4, p.y - 2));
    if (p.room.dark) {
      const r = (progress.lantern ? 24 : 8) + (Math.floor(now / 180) % 3 === 0 ? 0.6 : 0);
      holes.innerHTML = [{ x: p.x + BOX[0] / 2, y: p.y + BOX[1] / 2, r }, ...p.room.lights]
        .map(light => `<circle cx="${light.x}" cy="${light.y}" r="${light.r}" fill="url(#w-hole)"/>`).join('');
    }
  }

  // --- the letter and words ------------------------------------------------------------------
  let reading = false;
  let sayUntil = 0;
  const say = (words, ms = 2400) => { bubble.textContent = words; sayUntil = performance.now() + ms; };
  function openLetter() { reading = true; held = 0; panel.hidden = false; close.focus({ preventScroll: true }); }
  function closeLetter() { reading = false; panel.hidden = true; say('……', 1200); }
  close.addEventListener('click', closeLetter);

  // --- the loop -----------------------------------------------------------------------------
  let held = 0;
  let jump = false;
  let gone = false;
  let last = 0;
  let lastDyn = 0;
  drawRoom();
  let raf = requestAnimationFrame(function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const events = game.step(dt, { dir: reading ? 0 : held, jump: jump && !reading });
    jump = false;
    let redraw = false;
    for (const event of events) {
      if (event.type === 'leave') { gone = true; onLeave(); return; }
      if (event.type === 'room') { drawRoom(); redraw = true; }
      if (event.type === 'say') say(event.text);
      if (event.type === 'take' || event.type === 'open' || event.type === 'plant') { drawRoom(); redraw = true; }
      if (event.type === 'letter') openLetter();
    }
    if (progress.planted && grow < 1) { grow = Math.min(1, grow + dt / 1.6); redraw = true; }
    if (progress.gateOpen && lift < 24) { lift = Math.min(24, lift + dt * 20); redraw = true; }
    if (redraw || now - lastDyn > 120) { drawDyn(now); lastDyn = now; }
    drawCritter(now);
    if (now > sayUntil) bubble.textContent = '';
    raf = requestAnimationFrame(tick);
  });
  if (!saved.arrived) { saved.arrived = true; say('……原来画里面是这样。', 3000); }

  // --- input --------------------------------------------------------------------------------
  const typing = event => event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event)) return;
    if (reading) { if (event.key === 'Escape') { event.preventDefault(); closeLetter(); } return; }
    if (KEYS[event.key]) held = KEYS[event.key];
    else if (['ArrowUp', 'w', 'W', ' '].includes(event.key)) { if (!event.repeat) jump = true; }
    else if (['e', 'E', 'Enter'].includes(event.key) && game.nearLetter()) openLetter();
    else if (event.key !== 'ArrowDown') return;
    event.preventDefault();
  }
  const onKeyUp = event => { if (KEYS[event.key] === held) held = 0; };
  const onBlur = () => { held = 0; };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  for (const button of pad.querySelectorAll('[data-pad]')) {
    const which = button.dataset.pad;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      if (which === 'jump') jump = true;
      else held = Number(which);
    });
    const release = () => { if (which !== 'jump' && held === Number(which)) held = 0; };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  return () => {
    gone = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    hud.remove();
    pad.remove();
    panel.remove();
  };
}
