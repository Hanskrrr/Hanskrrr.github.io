// The shore (shore-level.js), where an address that doesn't exist leads when it is typed from inside
// the pixel world (blog/lost.js decides). No words and no music: the sea comes up the sand and breaks
// on the rocks, mist drifts past, and the only sound is the waves. In the far corner is a way out,
// drawn not in pixels but as something with more dimensions than the rest: a tear in the world onto a
// slice of a fractal of dimension 6.7 (rift.js; without WebGL, the older point cloud below). Walking
// into it leads back to the blog.
import { CRITTER } from '../blog/pixel-art.js';
import { el } from '../core/dom.js';
import { BOX, createGame, H, W } from './world-level.js';
import { palette, paint } from './world.js';
import { createRift } from './rift.js';
import { buildShore, SHORE, SPLASH, SURFACE, TUNNEL } from './shore-level.js';

const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };

/** Waves against stone: a low murmur of the sea, and a wash and a break with each wave. */
function waves() {
  let ctx = null;
  let master;
  let muffler;
  const build = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.value = 18000;
    master.connect(muffler).connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }   // brown noise
    const sea = ctx.createBufferSource();
    sea.buffer = noise;
    sea.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 420;
    const hush = ctx.createGain();
    hush.gain.value = 0.05;
    sea.connect(low).connect(hush).connect(master);
    sea.start();
    return noise;
  };
  let buffer;
  return {
    start() {
      if (!ctx) { try { buffer = build(); } catch { return; } }
      ctx.resume?.();
    },
    /** One wave breaking; `near` from 0 (far off) to 1 (right here). */
    break(near) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const wash = ctx.createBufferSource();
      wash.buffer = buffer;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 0.7;
      band.frequency.setValueAtTime(900, now);
      band.frequency.exponentialRampToValueAtTime(260, now + 2.4);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5 * near, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
      wash.connect(band).connect(gain).connect(master);
      wash.start(now, Math.random() * 2);
      wash.stop(now + 2.8);
      const thud = ctx.createOscillator();
      thud.frequency.setValueAtTime(70, now);
      thud.frequency.exponentialRampToValueAtTime(38, now + 0.3);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.18 * near, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      thud.connect(tg).connect(master);
      thud.start(now);
      thud.stop(now + 0.4);
    },
    /** From 0 (clear) to 1 (as if from under water). */
    muffle(amount) { if (ctx) muffler.frequency.setTargetAtTime(18000 * (250 / 18000) ** amount, ctx.currentTime, 0.15); },
    /** Fade to silence. */
    hush(seconds) { if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds); } },
    stop() { if (ctx) { master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6); const c = ctx; setTimeout(() => c.close?.(), 800); ctx = null; } },
  };
}

// The way out: a fractal of dimension 6.7. Eight maps in seven dimensions, each shrinking everything
// towards one corner of a seven-dimensional simplex by 0.733, have similarity dimension
// log 8 / log(1 / 0.733) ≈ 6.7. Its points are found by the chaos game, the whole shape turns slowly
// through seven dimensions, and what shows is its shadow on the screen, flickering.
const DIM = 7;
const MAPS = 8;
const RATIO = 0.733;
const CORNERS = (() => {
  // Eight corners of a regular 7-simplex: the unit vectors of 8 dimensions, centred and turned into 7.
  const rows = Array.from({ length: MAPS }, (_, i) => Array.from({ length: MAPS }, (_, j) => (i === j ? 1 : 0) - 1 / MAPS));
  const basis = [];
  for (let k = 0; k < DIM; k++) {                           // Gram–Schmidt on differences of the corners
    let v = rows[k + 1].map((x, j) => x - rows[0][j]);
    for (const b of basis) { const d = v.reduce((sum, x, j) => sum + x * b[j], 0); v = v.map((x, j) => x - d * b[j]); }
    const n = Math.hypot(...v);
    basis.push(v.map(x => x / n));
  }
  return rows.map(row => basis.map(b => row.reduce((sum, x, j) => sum + x * b[j], 0) * 1.6));
})();
// Planes to turn in, each at its own speed: (axis a, axis b, speed).
const TURNS = [[0, 3, 0.31], [1, 4, 0.23], [2, 5, 0.17], [0, 6, 0.13], [3, 5, 0.29], [1, 2, 0.11], [4, 6, 0.19]];

export function mountShore(page) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shore = buildShore();
  const game = createGame(shore, {}, { from: 'shore' });
  const { p } = game;
  const sound = waves();
  document.title = '…';

  const stage = el('div', 'world-stage shore-stage');
  const canvas = el('canvas', 'world-canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute('aria-hidden', 'true');
  const view = canvas.getContext('2d');
  const frame = document.createElement('canvas');
  frame.width = W;
  frame.height = H;
  const ctx = frame.getContext('2d');
  const before = document.createElement('canvas');
  before.width = W;
  before.height = H;
  const glass = el('canvas', 'shore-glass');                 // the tunnel, drawn at full resolution
  glass.setAttribute('aria-hidden', 'true');
  const riftCanvas = el('canvas', 'shore-glass');
  riftCanvas.setAttribute('aria-hidden', 'true');
  const rift = createRift(riftCanvas);
  const g = rift ? null : glass.getContext('2d');
  stage.append(canvas, rift ? riftCanvas : glass);
  const LEAVE = rift ? 2.4 : 1.6;
  const pad = el('div', 'world-pad');
  pad.innerHTML = '<button class="button" data-pad="-1" aria-label="←">◀</button><button class="button" data-pad="jump" aria-label="↑">▲</button><button class="button" data-pad="1" aria-label="→">▶</button>';
  page.classList.add('shore-page');
  page.replaceChildren(stage, pad);

  let scale = 1;
  const fit = () => {
    const room = Math.min(innerWidth / W, innerHeight / H);
    scale = room >= 2 ? Math.floor(room) : room;
    stage.style.width = `${W * scale}px`;
    stage.style.height = `${H * scale}px`;
    const dpr = devicePixelRatio || 1;
    glass.width = Math.round(W * scale * dpr);
    glass.height = Math.round(H * scale * dpr);
  };
  fit();
  addEventListener('resize', fit);

  let color = palette();
  let layers = new Map();
  let pictures = new Map();
  const layerOf = room => {
    if (!layers.has(room.key)) layers.set(room.key, Object.fromEntries(Object.entries(room.layers).map(([name, grid]) => [name, paint(grid, color)])));
    return layers.get(room.key);
  };
  const picture = (grid, key) => { if (!pictures.has(key)) pictures.set(key, paint(grid, color)); return pictures.get(key); };
  const restyle = new MutationObserver(() => { color = palette(); layers = new Map(); pictures = new Map(); });
  restyle.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // The sea's rhythm: every few seconds a wave breaks on the rocks, then runs up the sand.
  let wave = { t: 0, next: 2, run: 0 };
  let spray = [];
  let slide = null;
  let leaving = null;
  const rand = (a, b) => a + Math.random() * (b - a);

  function drawSea(room, t, dt) {
    wave.t += dt;
    if (wave.t >= wave.next) {
      wave = { t: 0, next: rand(6, 9.5), run: rand(0.75, 1) };
      sound.break(room.key === SPLASH.key ? 1 : 0.35);
      if (room.key === SPLASH.key && !still) for (let i = 0; i < 26; i++) spray.push({ x: SPLASH.x + rand(-9, 9), y: SPLASH.y + rand(-2, 3), vx: rand(-14, 10), vy: rand(-46, -16), life: rand(0.6, 1.3) });
    }
    // Glints moving on the far water.
    ctx.fillStyle = color('px-far-light');
    for (let i = 0; i < 18; i++) {
      const x = Math.round((i * 53 + t * (3 + (i % 4))) % (W + 20)) - 10;
      const y = 106 + (i * 7) % 30;
      if (Math.sin(t * 1.3 + i) > 0.2) ctx.fillRect(x, y, 2 + (i % 3), 1);
    }
    if (room.key !== SHORE.key) return;
    // The water over the lower sand, with its edge running up and back with each wave.
    const reach = SHORE.to - (SHORE.to - SHORE.from - 4) * wave.run * Math.max(0, Math.sin(Math.min(1, wave.t / 3.6) * Math.PI));
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = color('px-near');
    for (let x = Math.floor(reach); x < W; x++) {
      let floor = SURFACE; while (floor < H && !room.solid[floor * W + x]) floor++;
      const top = x < SHORE.to ? Math.max(SURFACE, floor - Math.round((x - reach) / 6)) : SURFACE;
      if (floor > top) ctx.fillRect(x, top, 1, floor - top);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = color('px-far-light');
    for (let x = Math.max(Math.floor(reach) + 8, SHORE.to); x < W; x += 1) if ((x + Math.floor(t * 6)) % 9 < 3) ctx.fillRect(x, SURFACE, 1, 1);
    // Foam at the water's edge.
    ctx.fillStyle = color('px-room-paper');
    for (let i = 0; i < 7; i++) {
      const x = Math.round(reach + i * 1.6 + Math.sin(t * 3 + i) * 0.8);
      let y = SURFACE; while (y < H && !room.solid[y * W + x]) y++;
      if ((i + Math.floor(t * 4)) % 3) ctx.fillRect(x, y - 1, 1, 1);
    }
  }
  function drawSpray(dt) {
    ctx.fillStyle = color('px-room-paper');
    spray = spray.filter(drop => {
      drop.life -= dt;
      drop.vy += 70 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      if (drop.life > 0) ctx.fillRect(Math.round(drop.x), Math.round(drop.y), 1, 1);
      return drop.life > 0;
    });
  }
  function drawMist(room, t) {
    if (still) return;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color('px-sky3');
    const [a, b] = room.mist;
    for (let y = a; y <= b; y += 2) for (let x = -60; x < W; x += 90) ctx.fillRect(Math.round(x + ((t * (2 + (y % 5))) % 90)), y, 50 - (y % 7) * 3, 1);
    ctx.globalAlpha = 1;
  }

  // The tunnel: the fractal's shadow in the mouth of the cave, pulling faint light into itself.
  const motes = Array.from({ length: 40 }, () => ({ a: rand(0, Math.PI * 2), d: rand(0.2, 1), s: rand(0.2, 0.6) }));
  let point = Array(DIM).fill(0);
  let glitch = 0;
  function drawTunnel(t, dt) {
    if (p.room.key !== TUNNEL.key || slide) { g.clearRect(0, 0, glass.width, glass.height); return; }
    const px = glass.width / W;
    const cx = TUNNEL.x * px;
    const cy = TUNNEL.y * px;
    const near = Math.max(0, 1 - Math.hypot(p.x + BOX[0] / 2 - TUNNEL.x, p.y - TUNNEL.y) / 110);
    const pull = leaving ? Math.min(1, leaving.t / 1.4) : 0;
    const size = px * (11 + near * 3 + pull * 60);
    // Let the last frames fade rather than vanish: it shimmers instead of redrawing cleanly.
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = `rgba(0,0,0,${still ? 1 : 0.35})`;
    g.fillRect(0, 0, glass.width, glass.height);
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, size * 2.4);
    halo.addColorStop(0, `hsla(${(t * 23) % 360}, 80%, 65%, ${0.05 + near * 0.05 + pull * 0.3})`);
    halo.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    g.fillStyle = halo;
    g.fillRect(cx - size * 3, cy - size * 3, size * 6, size * 6);
    // Now and then it flickers: a dropped frame, a slice slipping sideways, the colours jumping.
    if (!still && Math.random() < 0.05 + near * 0.06) glitch = Math.floor(rand(1, 5));
    const skip = glitch > 0 && Math.random() < 0.5;
    const slip = glitch > 0 ? rand(-1, 1) * size * 0.4 : 0;
    const band = glitch > 0 ? [rand(-1, 1) * size, rand(0.1, 0.5) * size] : null;
    const shift = glitch > 0 ? rand(40, 160) : 0;
    if (glitch > 0) glitch--;
    if (!skip) {
      const angles = TURNS.map(([, , speed], i) => t * speed * (1 + near * 1.5 + pull * 4) + i);
      const cos = angles.map(Math.cos);
      const sin = angles.map(Math.sin);
      const count = 900 + Math.round(near * 900);
      const dot = Math.max(1, px * 0.22);
      for (let n = 0; n < count; n++) {
        const k = Math.floor(Math.random() * MAPS);
        const corner = CORNERS[k];
        for (let d = 0; d < DIM; d++) point[d] = point[d] * RATIO + corner[d] * (1 - RATIO);
        const v = point.slice();
        TURNS.forEach(([a, b], i) => { const va = v[a]; const vb = v[b]; v[a] = va * cos[i] - vb * sin[i]; v[b] = va * sin[i] + vb * cos[i]; });
        const depth = 1 / (2.6 - v[2] * 0.5 - v[3] * 0.3);
        let x = cx + v[0] * size * depth * 1.4;
        const y = cy + v[1] * size * depth * 1.4;
        if (band && Math.abs(y - cy - band[0]) < band[1]) x += slip;
        g.fillStyle = `hsla(${(t * 50 + k * 45 + shift) % 360}, 90%, ${55 + depth * 18}%, ${0.25 + near * 0.25})`;
        g.fillRect(x, y, dot, dot);
      }
    }
    // Motes drawn in, faster when the creature is near.
    for (const mote of motes) {
      mote.d -= dt * mote.s * (0.3 + near * 1.4 + pull * 3);
      mote.a += dt * (1 + near);
      if (mote.d < 0.05) { mote.d = 1; mote.a = rand(0, Math.PI * 2); }
      const r = mote.d * size * 3;
      g.fillStyle = `hsla(${(t * 60 + mote.a * 57) % 360}, 90%, 75%, ${0.15 + (1 - mote.d) * 0.5})`;
      g.fillRect(cx + Math.cos(mote.a) * r, cy + Math.sin(mote.a) * r * 0.8, px * 0.3, px * 0.3);
    }
    g.globalCompositeOperation = 'source-over';
    if (pull > 0) { g.fillStyle = `rgba(255,255,255,${pull ** 3})`; g.fillRect(0, 0, glass.width, glass.height); }
  }

  let held = 0;
  let jump = false;
  let last = 0;
  let raf = requestAnimationFrame(function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const t = now / 1000;
    const events = leaving ? [] : game.step(dt, { dir: held, jump });
    jump = false;
    for (const event of events) {
      if (event.type === 'room' && !still) { before.getContext('2d').drawImage(canvas, 0, 0); slide = { dx: event.dx, t: 0 }; }
      if (event.type === 'exit' && !leaving) {
        leaving = { t: 0 };
        sound.hush(LEAVE * 0.8);
        try { sessionStorage.removeItem('gallery-shore'); } catch { /* nothing to forget */ }
      }
    }
    if (leaving) { leaving.t += dt; if (leaving.t > LEAVE) { location.href = '/'; return; } }
    const room = p.room;
    const art = layerOf(room);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(art.sky, 0, 0);
    if (!still) { ctx.fillStyle = color('px-twinkle'); room.stars.forEach(([x, y], i) => { if ((t * 0.5 + i * 2.1) % 9 < 0.3) ctx.fillRect(x, y, 1, 1); }); }
    ctx.drawImage(art.dist, 0, 0);
    ctx.drawImage(art.hills, 0, 0);
    ctx.drawImage(art.back, 0, 0);
    drawMist(room, t);
    ctx.drawImage(art.land, 0, 0);
    const side = p.face > 0 ? 'right' : 'left';
    const pose = leaving ? 'front' : !p.ground ? `${side}2` : p.clock ? (Math.floor(p.clock / 0.13) % 2 ? `${side}2` : side) : now % 5200 < 150 ? 'blink' : 'front';
    if (!leaving || leaving.t < 0.7) ctx.drawImage(picture(CRITTER[pose], pose), p.x, p.y);
    drawSea(room, t, dt);
    drawSpray(dt);
    ctx.drawImage(art.fore, 0, 0);
    if (slide) {
      slide.t += dt;
      const k = Math.min(1, slide.t / 0.32);
      const e = 1 - (1 - k) ** 3;
      view.clearRect(0, 0, W, H);
      view.drawImage(before, Math.round(-slide.dx * W * e), 0);
      view.drawImage(frame, Math.round(slide.dx * W * (1 - e)), 0);
      if (k >= 1) slide = null;
    } else {
      view.clearRect(0, 0, W, H);
      view.drawImage(frame, 0, 0);
    }
    const near = Math.max(0, 1 - Math.hypot(p.x + BOX[0] / 2 - TUNNEL.x, p.y - TUNNEL.y) / 110);
    if (!leaving) sound.muffle(p.room.key === TUNNEL.key ? near * 0.55 : 0);
    if (!rift) drawTunnel(t, dt);
    else if ((riftCanvas.hidden = p.room.key !== TUNNEL.key || Boolean(slide)) === false) {
      const pull = leaving ? Math.min(1, leaving.t / 2) : 0;
      const white = leaving ? Math.min(1, Math.max(0, (leaving.t - 1.75) / 0.55)) : 0;
      rift.draw({ scene: canvas, x: TUNNEL.x, y: TUNNEL.y, near, pull, white, t, dt, cam: Math.max(-1, Math.min(1, (p.x - TUNNEL.x) / 80)), still });
    }
    raf = requestAnimationFrame(tick);
  });

  const typing = event => event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
  addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event)) return;
    sound.start();
    if (KEYS[event.key]) held = KEYS[event.key];
    else if (['ArrowUp', 'w', 'W', ' '].includes(event.key)) { if (!event.repeat) jump = true; }
    else return;
    event.preventDefault();
  });
  addEventListener('keyup', event => { if (KEYS[event.key] === held) held = 0; });
  addEventListener('blur', () => { held = 0; });
  addEventListener('pointerdown', () => sound.start());
  for (const button of pad.querySelectorAll('[data-pad]')) {
    const which = button.dataset.pad;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      if (which === 'jump') jump = true; else held = Number(which);
    });
    const release = () => { if (which !== 'jump' && held === Number(which)) held = 0; };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }
  addEventListener('pagehide', () => { cancelAnimationFrame(raf); sound.stop(); restyle.disconnect(); });
}
