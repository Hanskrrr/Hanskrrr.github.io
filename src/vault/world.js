// The pixel world (world-level.js), played: the homepage critter as a small platformer.
// ←/→ or A/D walk, ↑/W/Space jump (a little higher than on the homepage), E/Enter opens the letter
// again; on touch screens three buttons do the same. Walking back off the right end returns to the
// homepage picture (onLeave). Reaching the letter opens it: the letter comes from the room's own
// encrypted content (room/letter.md in the vault), so it exists only once the room is unlocked.
import { gridToPaths, sprite } from '../blog/pixel-art.js';
import { CRITTER } from '../blog/scene.js';
import { el } from '../core/dom.js';
import { buildWorld, HEIGHT, PARALLAX, VIEW, WIDTH } from './world-level.js';

const SPEED = 24;        // pixels per second
const GRAVITY = 260;
const JUMP = 74;         // about 10 pixels high
const COYOTE = 0.1;      // a jump still counts this long after walking off an edge
const BUFFER = 0.12;     // and this long before landing
const BOX = [6, 5];
const LANTERN = ['.c.', 'lll', 'lll', '.t.', '.t.', '.t.', '.t.'];
const ENVELOPE = sprite(['ooooooooo', 'oSmmmmmSo', 'omSmmmSmo', 'ommShSmmo', 'ommmmmmmo', 'ooooooooo'], { o: 'px-moon-shade', m: 'px-moon', S: 'px-moon-shade', h: 'px-heart' });
const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };

export function mountWorld(stage, { letter, onLeave }) {
  const world = buildWorld();
  const lanterns = world.checkpoints.map(({ x, y }) => `<g transform="translate(${x - 1} ${y})">${gridToPaths(sprite(LANTERN, { c: 'px-trunk', l: 'px-window-off world-light', t: 'px-trunk' }))}</g>`).join('');
  const L = world.letter;
  stage.innerHTML = `<svg class="pixel-art world-scene" viewBox="0 0 ${VIEW} ${HEIGHT}" shape-rendering="crispEdges" aria-hidden="true">`
    + `<rect class="px-sky3" width="${VIEW}" height="${HEIGHT}"/>${gridToPaths(world.sky)}`
    + `<g class="world-far">${gridToPaths(world.far)}</g><g class="world-near">${gridToPaths(world.near)}</g>`
    + `<g class="world-land">${gridToPaths(world.land)}${lanterns}<g transform="translate(${L.x} ${L.y})">${gridToPaths(ENVELOPE)}</g><rect class="px-twinkle world-sparkle" x="${L.x + 4}" y="${L.y - 3}" width="1" height="1"/></g>`
    + '<g class="world-critter"></g><text class="scene-icon-label world-say" text-anchor="middle"></text></svg>'
    + '<p class="room-hint">←/→ 走 · ↑ 跳</p>'
    + '<div class="world-pad"><button class="button" data-pad="-1" aria-label="向左">◀</button><button class="button" data-pad="jump" aria-label="跳">▲</button><button class="button" data-pad="1" aria-label="向右">▶</button></div>';
  const $ = selector => stage.querySelector(selector);
  const layers = { far: $('.world-far'), near: $('.world-near'), land: $('.world-land') };
  const body = $('.world-critter');
  const bubble = $('.world-say');
  const sparkle = $('.world-sparkle');
  const lights = [...stage.querySelectorAll('.world-light')];

  // The letter, over the page (the stage is too small for it on a phone).
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
  stage.after(panel);

  // --- the creature -----------------------------------------------------------------------
  const hits = (x, y) => {
    for (let dy = 0; dy < BOX[1]; dy++) for (let dx = 0; dx < BOX[0]; dx++) {
      const X = x + dx;
      const Y = y + dy;
      if (X < 0 || X >= WIDTH) return true;
      if (Y >= 0 && Y < HEIGHT && world.solid[Y * WIDTH + X]) return true;
    }
    return false;
  };
  const standAt = x => { for (let y = 0; y < HEIGHT; y++) if (!hits(x, y) && hits(x, y + 1)) return y; return 0; };   // on the first thing below
  const s = { x: WIDTH - BOX[0], y: 0, fx: 0, fy: 0, vy: 0, face: -1, ground: true, coyote: 0, buffer: 0, clock: 0 };
  s.y = standAt(s.x);
  let spawn = world.checkpoints[0];
  let auto = -1;           // walking in by itself
  let held = 0;
  let reading = false;
  let readOnce = false;
  let wondered = false;
  let gone = false;
  let cam = WIDTH - VIEW;
  let sayUntil = 0;
  let frame = '';

  function say(words, ms = 2200) { bubble.textContent = words; sayUntil = performance.now() + ms; }
  function openLetter() {
    reading = true;
    held = 0;
    panel.hidden = false;
    close.focus({ preventScroll: true });
  }
  function closeLetter() {
    reading = false;
    panel.hidden = true;
    say('……', 1200);
  }
  close.addEventListener('click', closeLetter);
  const nearLetter = () => s.x + BOX[0] > L.x - 2 && s.x < L.x + L.w + 2 && s.y + BOX[1] > L.y - 2 && s.y < L.y + L.h + 2;

  function step(dt, now) {
    const dir = reading ? 0 : auto || held;
    if (auto && s.x <= WIDTH - 22) auto = 0;
    s.fx += dir * SPEED * dt;
    while (Math.abs(s.fx) >= 1) {
      const d = Math.sign(s.fx);
      s.fx -= d;
      if (!hits(s.x + d, s.y)) s.x += d;
      else if (s.ground && !hits(s.x + d, s.y - 1)) { s.x += d; s.y -= 1; }
      else if (s.ground && !hits(s.x + d, s.y - 2)) { s.x += d; s.y -= 2; }
      else { s.fx = 0; break; }
    }
    if (dir) s.face = dir;
    if (dir > 0 && !auto && s.x >= WIDTH - BOX[0]) { gone = true; onLeave(); return; }

    s.coyote = s.ground ? COYOTE : s.coyote - dt;
    s.buffer -= dt;
    if (s.buffer > 0 && s.coyote > 0) { s.vy = -JUMP; s.buffer = 0; s.coyote = 0; }
    s.vy = Math.min(s.vy + GRAVITY * dt, 160);
    s.fy += s.vy * dt;
    while (Math.abs(s.fy) >= 1) {
      const d = Math.sign(s.fy);
      s.fy -= d;
      if (!hits(s.x, s.y + d)) s.y += d;
      else { s.vy = 0; s.fy = 0; break; }
    }
    s.ground = hits(s.x, s.y + 1);
    s.clock = dir && s.ground ? s.clock + dt : 0;

    if (s.y > HEIGHT + 6) {                    // fell: back to the last lantern
      Object.assign(s, { x: spawn.x - 3, fx: 0, fy: 0, vy: 0 });
      s.y = standAt(s.x);
      say('……呼。');
    }
    world.checkpoints.forEach((point, index) => {
      if (point.lit || Math.abs(s.x + 3 - point.x) > 3) return;
      point.lit = true;
      spawn = point;
      lights[index]?.setAttribute('class', 'px-window world-light');
    });
    if (!wondered && s.x < L.x + 40) { wondered = true; say('……有一封信？'); }
    if (!readOnce && nearLetter()) { readOnce = true; openLetter(); }
    if (now > sayUntil) bubble.textContent = '';
  }

  function draw(dt, now) {
    const target = Math.max(0, Math.min(WIDTH - VIEW, s.x + 3 - VIEW / 2 + s.face * 14));
    cam += (target - cam) * Math.min(1, dt * 4);
    const at = Math.round(cam);
    layers.land.setAttribute('transform', `translate(${-at} 0)`);
    layers.far.setAttribute('transform', `translate(${-Math.round(at * PARALLAX.far)} 0)`);
    layers.near.setAttribute('transform', `translate(${-Math.round(at * PARALLAX.near)} 0)`);
    const side = s.face > 0 ? 'right' : 'left';
    const idle = now % 4000 < 150 ? 'blink' : 'front';
    const pose = !s.ground ? `${side}2` : s.clock ? (Math.floor(s.clock / 0.15) % 2 ? `${side}2` : side) : idle;
    if (pose !== frame) { body.innerHTML = gridToPaths(CRITTER[pose]); frame = pose; }
    body.setAttribute('transform', `translate(${s.x - at} ${s.y})`);
    bubble.setAttribute('x', s.x - at + 3);
    bubble.setAttribute('y', s.y - 2);
    sparkle.style.display = Math.floor(now / 400) % 3 ? 'none' : '';
  }

  let last = 0;
  let raf = requestAnimationFrame(function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt, now);
    if (gone) return;
    draw(dt, now);
    raf = requestAnimationFrame(tick);
  });
  say('……这是哪里？', 2600);

  // --- input ------------------------------------------------------------------------------
  const typing = event => event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event)) return;
    if (reading) { if (event.key === 'Escape') { event.preventDefault(); closeLetter(); } return; }
    if (KEYS[event.key]) held = KEYS[event.key];
    else if (['ArrowUp', 'w', 'W', ' '].includes(event.key)) s.buffer = BUFFER;
    else if (['e', 'E', 'Enter'].includes(event.key) && nearLetter()) openLetter();
    else return;
    event.preventDefault();
  }
  const onKeyUp = event => { if (KEYS[event.key] === held) held = 0; };
  const onBlur = () => { held = 0; };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  // Touch buttons: hold ◀/▶, tap ▲.
  for (const button of stage.querySelectorAll('[data-pad]')) {
    const pad = button.dataset.pad;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      if (pad === 'jump') s.buffer = BUFFER;
      else held = Number(pad);
    });
    const release = () => { if (pad !== 'jump' && held === Number(pad)) held = 0; };
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
    panel.remove();
  };
}
