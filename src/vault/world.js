// The world inside the homepage picture (world-level.js), drawn on a canvas at its own size
// (320×180) and scaled up by whole pixels, so it has the homepage picture's pixel size and fills
// the window. The layers drift a little apart as the creature walks; fireflies, falling leaves,
// spores and mist move on top, darkness closes in underground, and quiet music plays
// (world-sound.js). ←/→ or A/D walk, ↑/W/Space jump, E/Enter reads the letter again; touch
// screens get three buttons. Walking back off the first screen's right edge returns to the
// picture (onLeave). Found things stay found until the page is reloaded or the room is locked.
import { sprite } from '../blog/pixel-art.js';
import { CRITTER } from '../blog/scene.js';
import { el } from '../core/dom.js';
import { letterRead } from '../core/portal.js';
import { BOX, buildWorld, createGame, H, ITEMS, MARGIN, newProgress, PARALLAX, W } from './world-level.js';
import { createSound } from './world-sound.js';

const SPRITES = {
  lantern: sprite(['.h.', 'oLo', 'oLo', 'oLo', 'ooo'], { h: 'px-far-light', o: 'px-trunk', L: 'px-window' }),
  seed: sprite(['.g.', 'gGg', '.g.'], { g: 'px-grass-light', G: 'px-flower' }),
  key: sprite(['mm...', 'm.mmm', 'mm.m.'], { m: 'px-moon' }),
  letter: sprite(['ooooooooo', 'oSmmmmmSo', 'omSmmmSmo', 'ommShSmmo', 'ommmmmmmo', 'ooooooooo'], { o: 'px-moon-shade', m: 'px-moon', S: 'px-moon-shade', h: 'px-heart' }),
};
const NAMES = { lantern: '灯', seed: '种子', key: '钥匙' };
const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
const LEAF = { spring: ['px-blossom', 'px-blossom-light'], summer: ['px-leaf-light', 'px-leaf'], autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'], winter: ['px-snow', 'px-snow'] };

/** Colours come from the site's CSS (px-name → --name), so the world follows the style. */
function palette() {
  const style = getComputedStyle(document.documentElement);
  const cache = new Map();
  return name => {
    if (!cache.has(name)) cache.set(name, style.getPropertyValue(`--${name.slice(3)}`).trim() || 'transparent');
    return cache.get(name);
  };
}
function paint(grid, color) {
  const canvas = document.createElement('canvas');
  canvas.width = grid[0].length;
  canvas.height = grid.length;
  const ctx = canvas.getContext('2d');
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const name = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === name) end++;
      if (name) { ctx.fillStyle = color(name); ctx.fillRect(x, y, end - x, 1); }
      x = end;
    }
  });
  return canvas;
}
const icon = (grid, color) => { const canvas = paint(grid, color); canvas.className = 'world-slot-art'; return canvas; };

let saved = { session: null, progress: null };

export function mountWorld(stage, { letter, onLeave, session = null }) {
  if (saved.session !== session) saved = { session, progress: newProgress() };
  const progress = saved.progress;
  const world = buildWorld();
  const game = createGame(world, progress);
  const { p } = game;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = createSound();

  const canvas = el('canvas', 'world-canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const shade = document.createElement('canvas');
  shade.width = W;
  shade.height = H;
  const sctx = shade.getContext('2d');
  const bubble = el('p', 'room-bubble world-bubble');
  bubble.hidden = true;
  const hint = el('p', 'room-hint', '←/→ 走 · ↑ 跳');
  stage.replaceChildren(canvas, bubble, hint);

  // Whole-pixel scaling where there is room for it, so every pixel stays square and sharp.
  let scale = 1;
  const fit = () => {
    const room = Math.min(innerWidth / W, innerHeight / H);
    scale = room >= 2 ? Math.floor(room) : room;
    stage.style.width = `${W * scale}px`;
    stage.style.height = `${H * scale}px`;
  };
  fit();
  addEventListener('resize', fit);

  // Below and around the frame: what has been found, sound, touch buttons, the letter.
  let color = palette();
  const hud = el('div', 'world-hud');
  hud.setAttribute('aria-label', '找到的东西');
  const slots = {};
  const drawSlots = () => ITEMS.forEach(id => {
    slots[id] ||= el('span', 'world-slot');
    slots[id].title = NAMES[id];
    slots[id].replaceChildren(icon(SPRITES[id], color));
    slots[id].classList.toggle('found', progress[id]);
    hud.append(slots[id]);
  });
  drawSlots();
  const music = el('button', 'world-sound', '♪');
  music.type = 'button';
  const showMusic = () => { music.setAttribute('aria-pressed', String(!sound.muted)); music.title = sound.muted ? '音乐：关' : '音乐：开'; };
  showMusic();
  music.addEventListener('click', () => { sound.toggle(); showMusic(); });
  hud.append(music);
  const pad = el('div', 'world-pad');
  pad.innerHTML = '<button class="button" data-pad="-1" aria-label="向左">◀</button><button class="button" data-pad="jump" aria-label="跳">▲</button><button class="button" data-pad="1" aria-label="向右">▶</button>';
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

  // --- pictures of each screen, redrawn when the site's style changes ------------------------
  let layers = new Map();
  let pictures = new Map();
  const layerOf = room => {
    if (!layers.has(room.key)) layers.set(room.key, Object.fromEntries(Object.entries(room.layers).map(([name, grid]) => [name, paint(grid, color)])));
    return layers.get(room.key);
  };
  const picture = (grid, key) => {
    if (!pictures.has(key)) pictures.set(key, paint(grid, color));
    return pictures.get(key);
  };
  const restyle = new MutationObserver(() => { color = palette(); layers = new Map(); pictures = new Map(); drawSlots(); });
  restyle.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mood'] });

  // --- moving things -------------------------------------------------------------------------
  let flies = [];
  let falling = [];
  let spores = [];
  let drops = [];
  let meteor = null;
  const rand = (a, b) => a + Math.random() * (b - a);
  function enterRoom() {
    const room = p.room;
    const [fx, fy, fw, fh] = room.fireflies?.area || [0, 0, 0, 0];
    flies = still ? [] : Array.from({ length: room.fireflies?.count || 0 }, () => ({ x: rand(fx, fx + fw), y: rand(fy, fy + fh), phase: rand(0, 6), speed: rand(0.3, 0.8), home: [fx, fy, fw, fh] }));
    const [sx, sy, sw, sh] = room.spores?.area || [0, 0, 0, 0];
    spores = still ? [] : Array.from({ length: room.spores?.count || 0 }, () => ({ x: rand(sx, sx + sw), y: rand(sy, sy + sh), phase: rand(0, 6), area: [sx, sy, sw, sh] }));
    falling = [];
    drops = [];
    sound.setMood(room.mood);
  }
  enterRoom();

  // --- the creature, and things to read --------------------------------------------------------
  let reading = false;
  let sayUntil = 0;
  const say = (words, ms = 2600) => { bubble.textContent = words; bubble.hidden = false; sayUntil = performance.now() + ms; };
  function openLetter() { reading = true; held = 0; panel.hidden = false; close.focus({ preventScroll: true }); }
  function closeLetter() { reading = false; panel.hidden = true; say('……', 1200); }
  close.addEventListener('click', closeLetter);

  let grow = progress.planted ? 1 : 0;       // the vine, growing (0 → 1)
  let lift = progress.gateOpen ? 46 : 0;     // the gate's bars, rising (0 → 46)

  function drawVine(dyn) {
    const [sx, top, bottom] = dyn.stem;
    const reach = bottom - (bottom - top) * (p.room.key === '2,0' ? Math.min(1, grow * 1.5) : Math.max(0, grow * 1.5 - 0.5) * 2);
    if (reach >= bottom) return;
    ctx.fillStyle = color('px-grass');
    ctx.fillRect(sx, Math.round(reach), 1, bottom - Math.round(reach));
    ctx.fillStyle = color('px-grass-dark');
    for (let y = Math.ceil(reach); y < bottom; y += 4) ctx.fillRect(sx + (y % 8 ? 1 : -1), y, 1, 1);
    for (const [x, y, w] of dyn.rects) {
      if (y < reach) continue;
      ctx.fillStyle = color('px-grass-light'); ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = color('px-grass'); ctx.fillRect(x + 1, y + 1, w - 2, 1);
      ctx.fillStyle = color('px-grass-dark'); ctx.fillRect(x + 2, y + 2, w - 4, 1);
    }
    if (dyn.flower && reach <= top + 1) {
      const [x, y] = dyn.flower;
      ctx.fillStyle = color('px-flower'); ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = color('px-flower-alt'); ctx.fillRect(x - 1, y + 1, 3, 1);
    }
  }
  function drawGate(dyn) {
    if (lift >= 46) return;
    const [x, y, w, h] = dyn.rects[0];
    for (let row = 0; row < h; row++) {
      const shown = y + row - Math.round(lift);
      if (shown < y) continue;
      ctx.fillStyle = color('px-trunk');
      for (let bx = 0; bx < w; bx += 2) ctx.fillRect(x + bx, shown, 1, 1);
      if (row % 11 === 3) { ctx.fillStyle = color('px-near-light'); ctx.fillRect(x, shown, w, 1); }
      if (row === h - 12) { ctx.fillStyle = color('px-window'); ctx.fillRect(x + 3, shown, 2, 2); }
    }
  }
  function draw(now) {
    const room = p.room;
    const art = layerOf(room);
    const t = now / 1000;
    const shift = name => (still ? 0 : Math.round(-(p.x + BOX[0] / 2 - W / 2) * PARALLAX[name]));
    ctx.clearRect(0, 0, W, H);
    for (const name of ['sky', 'dist', 'hills', 'back']) ctx.drawImage(art[name], -MARGIN + shift(name), 0);
    // Twinkling stars and, high up, now and then a shooting star.
    if (!still && room.stars) {
      ctx.fillStyle = color('px-twinkle');
      room.stars.forEach(([x, y], i) => { if ((t * 0.9 + i * 1.7) % 7 < 0.35) ctx.fillRect(x + shift('sky'), y, 1, 1); });
    }
    if (!still && room.meteor) {
      if (!meteor && Math.random() < 0.004) meteor = { x: rand(120, 320), y: rand(10, 60), age: 0 };
      if (meteor) {
        meteor.age += 1;
        const hx = meteor.x - meteor.age * 3;
        const hy = meteor.y + meteor.age * 1.5;
        ctx.fillStyle = color('px-meteor'); ctx.fillRect(Math.round(hx), Math.round(hy), 1, 1);
        ctx.fillStyle = color('px-meteor-tail');
        for (let i = 1; i < 5; i++) ctx.fillRect(Math.round(hx + i * 3), Math.round(hy - i * 1.5), 1, 1);
        if (meteor.age > 22) meteor = null;
      }
    }
    // Mist drifting just above the ground.
    if (!still && room.mist) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color('px-far-light');
      for (let i = 0; i < 3; i++) {
        const y = room.mist + i * 3;
        for (let x = -40; x < W; x += 60) ctx.fillRect(Math.round(x + ((t * (4 + i * 2)) % 60)), y, 34 - i * 6, 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(art.land, 0, 0);
    for (const dyn of room.dyn) { if (dyn.kind === 'vine' && grow > 0) drawVine(dyn); if (dyn.kind === 'gate') drawGate(dyn); }
    const bob = Math.floor(t * 2) % 2;
    for (const thing of room.things) {
      if (thing.kind === 'item' && !progress[thing.id]) {
        ctx.drawImage(picture(SPRITES[thing.id], thing.id), thing.x, thing.y - bob);
        if (Math.floor(t * 2.5) % 5 === 0) { ctx.fillStyle = color('px-twinkle'); ctx.fillRect(thing.x + Math.floor(thing.w / 2), thing.y - 3, 1, 1); }
      }
      if (thing.kind === 'letter') {
        ctx.drawImage(picture(SPRITES.letter, 'letter'), thing.x, thing.y);
        if (Math.floor(t * 2.5) % 3 === 0) { ctx.fillStyle = color('px-twinkle'); ctx.fillRect(thing.x + 4, thing.y - 3, 1, 1); }
      }
      if (thing.kind === 'friend') {
        ctx.drawImage(picture(CRITTER.blink, 'friend'), thing.x, thing.y);
        const z = Math.floor(t * 1.4) % 3;
        ctx.fillStyle = color('px-far-light');
        ctx.fillRect(thing.x + 6 + z, thing.y - 2 - z * 2, 2, 1);
      }
    }
    // The creature.
    const side = p.face > 0 ? 'right' : 'left';
    const pose = !p.ground ? `${side}2` : p.clock ? (Math.floor(p.clock / 0.13) % 2 ? `${side}2` : side) : now % 4200 < 150 ? 'blink' : 'front';
    ctx.drawImage(picture(CRITTER[pose], `creature-${pose}`), p.x, p.y);
    if (progress.lantern && room.dark) { ctx.fillStyle = color('px-window'); ctx.fillRect(p.x + (p.face > 0 ? 6 : -1), p.y + 1, 1, 2); }
    ctx.drawImage(art.fore, 0, 0);
    // Fireflies, spores, falling leaves, drips.
    if (!still) {
      ctx.fillStyle = color('px-firefly');
      for (const fly of flies) {
        fly.phase += 0.016 * fly.speed;
        fly.x += Math.sin(fly.phase * 1.3) * 0.12;
        fly.y += Math.cos(fly.phase) * 0.08;
        const [hx, hy, hw, hh] = fly.home;
        if (fly.x < hx || fly.x > hx + hw) fly.x = hx + Math.random() * hw;
        if (fly.y < hy || fly.y > hy + hh) fly.y = hy + Math.random() * hh;
        if (Math.sin(fly.phase * 2.1) > -0.3) ctx.fillRect(Math.round(fly.x), Math.round(fly.y), 1, 1);
      }
      ctx.fillStyle = color('px-flower-alt');
      for (const spore of spores) {
        spore.phase += 0.01;
        spore.y -= 0.03;
        spore.x += Math.sin(spore.phase * 2) * 0.05;
        if (spore.y < spore.area[1]) spore.y = spore.area[1] + spore.area[3];
        if (Math.sin(spore.phase * 3) > 0) ctx.fillRect(Math.round(spore.x), Math.round(spore.y), 1, 1);
      }
      if (room.falling && falling.length < room.falling.count && Math.random() < 0.01) {
        const [x, y, w, h] = room.falling.from;
        falling.push({ x: rand(x, x + w), y: rand(y, y + h), phase: rand(0, 6), cls: LEAF[world.season]?.[Math.floor(Math.random() * 2)] || 'px-leaf-light' });
      }
      falling = falling.filter(leaf => {
        leaf.phase += 0.03;
        leaf.y += 0.18;
        leaf.x += Math.sin(leaf.phase) * 0.25 - 0.05;
        ctx.fillStyle = color(leaf.cls);
        ctx.fillRect(Math.round(leaf.x), Math.round(leaf.y), 1, 1);
        return leaf.y < H && !game.hits(Math.round(leaf.x) - 2, Math.round(leaf.y) - 3);
      });
      if (room.drips && Math.random() < 0.006) {
        const [x, y] = room.drips[Math.floor(Math.random() * room.drips.length)];
        drops.push({ x, y, v: 0 });
      }
      drops = drops.filter(drop => {
        drop.v += 0.05;
        drop.y += drop.v;
        ctx.fillStyle = color('px-sky1');
        ctx.fillRect(drop.x, Math.round(drop.y), 1, 2);
        if (drop.y > 164) { sound.chime('drip'); return false; }
        return true;
      });
    }
    // Darkness underground, with the lights cut out of it.
    if (room.dark) {
      sctx.globalCompositeOperation = 'source-over';
      sctx.clearRect(0, 0, W, H);
      sctx.fillStyle = 'rgba(5, 4, 26, 0.97)';
      sctx.fillRect(0, 0, W, H);
      sctx.globalCompositeOperation = 'destination-out';
      const flicker = still ? 0 : Math.sin(t * 7) * 0.8 + Math.sin(t * 13) * 0.4;
      const lights = [{ x: p.x + BOX[0] / 2, y: p.y + BOX[1] / 2, r: (progress.lantern ? 52 : 14) + flicker }, ...room.lights];
      for (const light of lights) {
        const glow = sctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
        glow.addColorStop(0, 'rgba(0,0,0,1)');
        glow.addColorStop(0.5, 'rgba(0,0,0,0.9)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = glow;
        sctx.fillRect(light.x - light.r, light.y - light.r, light.r * 2, light.r * 2);
      }
      ctx.drawImage(shade, 0, 0);
    }
    if (!bubble.hidden) {
      bubble.style.left = `${(p.x + BOX[0] / 2) * scale}px`;
      bubble.style.top = `${(p.y - 3) * scale}px`;
    }
  }

  // --- the loop -----------------------------------------------------------------------------
  let held = 0;
  let jump = false;
  let last = 0;
  let raf = requestAnimationFrame(function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const events = game.step(dt, { dir: reading ? 0 : held, jump: jump && !reading });
    jump = false;
    for (const event of events) {
      if (event.type === 'leave') { onLeave(); return; }
      if (event.type === 'room') enterRoom();
      if (event.type === 'say') say(event.text);
      if (event.type === 'take') { drawSlots(); sound.chime('take'); }
      if (event.type === 'open') sound.chime('open');
      if (event.type === 'plant') sound.chime('take');
      if (event.type === 'letter') { letterRead.set(); openLetter(); }
    }
    if (progress.planted && grow < 1) grow = Math.min(1, grow + dt / 2);
    if (progress.gateOpen && lift < 46) lift = Math.min(46, lift + dt * 24);
    draw(now);
    if (now > sayUntil) bubble.hidden = true;
    raf = requestAnimationFrame(tick);
  });
  if (!saved.arrived) { saved.arrived = true; say('……原来画里面是这样。', 3200); }

  // --- input --------------------------------------------------------------------------------
  const typing = event => event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event)) return;
    sound.start();
    if (reading) { if (event.key === 'Escape') { event.preventDefault(); closeLetter(); } return; }
    if (KEYS[event.key]) held = KEYS[event.key];
    else if (['ArrowUp', 'w', 'W', ' '].includes(event.key)) { if (!event.repeat) jump = true; }
    else if (['e', 'E', 'Enter'].includes(event.key) && game.nearLetter()) openLetter();
    else if (event.key !== 'ArrowDown') return;
    event.preventDefault();
  }
  const onKeyUp = event => { if (KEYS[event.key] === held) held = 0; };
  const onBlur = () => { held = 0; };
  const onPointer = () => sound.start();
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  addEventListener('pointerdown', onPointer);
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
    cancelAnimationFrame(raf);
    sound.stop();
    restyle.disconnect();
    removeEventListener('resize', fit);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    removeEventListener('pointerdown', onPointer);
    hud.remove();
    pad.remove();
    panel.remove();
  };
}
