// The world inside the homepage picture (world.js draws it). A handful of screens, each 256×144
// pixels at the picture's own pixel size, joined edge to edge: walk off one side and the next
// screen slides in. The first screen is the land just west of the picture, drawn with the
// picture's colours, meadow and mountains, only wider and taller. Three small things open the way:
//
//                 [G sky ]
//   [E hill]-[D ruins]-[C tree ]-[A well ]-(the picture)
//                      [F roots]-[B below]
//
//   C: climb the old tree for the lantern · A: climb down the well's rope · B: the dark tunnel needs
//   the lantern · F: the glowing seed · C: plant it, a vine grows up the cliff (→ D) and into the
//   sky (G: the key) · D: the key opens the gate · E: the letter. A secret sleeps behind a wall in B.
//
// Each screen is a stack of layers (sky, distant range, the picture's mountains, the back, the land,
// and grass in front). Shapes come from smooth noise, so cliffs, ledges and caves are uneven.
// Everything here is plain data and rules (no page), so the level can be checked by a script
// (scripts/check-world.mjs).
import { random, seasonOf } from '../blog/pixel-art.js';

export const W = 256;
export const H = 144;
export const BOX = [6, 5];
export const ITEMS = ['lantern', 'seed', 'key'];
const SPEED = 40;                        // pixels per second, reached after a short speed-up
const ACCEL = 420;
const GRAVITY = 420;
const JUMP = 110;                        // about 14 pixels high
const CLIMB = 34;
const COYOTE = 0.1;
const BUFFER = 0.12;
const PY = 69;                           // picture row y is world row y + PY: the meadow lines up
const GROUND = 120;
const LEAVES = { spring: ['px-blossom', 'px-blossom-light'], summer: ['px-leaf', 'px-leaf-light'], autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'], winter: ['px-snow', 'px-snow'] };

// --- noise ------------------------------------------------------------------------------------
/** A fixed pseudo-random number in [0, 1) for a pixel, so textures have no visible stripes. */
const hash = (X, Y, salt = 0) => {
  let h = (X * 374761393 + Y * 668265263 + salt * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = t => t * t * (3 - 2 * t);
/** Smooth value noise in [0, 1). */
function noise(x, y, scale, salt = 0) {
  const gx = x / scale; const gy = y / scale;
  const x0 = Math.floor(gx); const y0 = Math.floor(gy);
  const fx = smooth(gx - x0); const fy = smooth(gy - y0);
  const a = hash(x0, y0, salt); const b = hash(x0 + 1, y0, salt); const c = hash(x0, y0 + 1, salt); const d = hash(x0 + 1, y0 + 1, salt);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// The picture's meadow and mountains (pixel-art.js), carried on to the west.
const meadow = x => PY + 51 + Math.round(2.5 * Math.sin(x / 8) + 1.5 * Math.sin(x / 3.3 + 1));
const ridge = (peaks, slope) => x => Math.min(...peaks.map(([px, py]) => Math.round(py + Math.abs(x - px) * slope)));
const peaksWest = (start, count, step, low, high, seed) => {
  const next = random(seed);
  return Array.from({ length: count }, (_, i) => [start - i * step - Math.floor(next() * step * 0.5), low + Math.floor(next() * (high - low))]);
};
const FAR = ridge([[6, 33], [29, 26], [50, 35], [77, 29], [101, 34], ...peaksWest(-24, 50, 26, 24, 34, 7)].map(([x, y]) => [x, y + PY]), 0.85);
const NEAR = ridge([[-8, 40], [24, 37], [50, 43], [72, 38], [100, 41], ...peaksWest(-36, 50, 30, 36, 43, 11)].map(([x, y]) => [x, y + PY]), 0.8);
const DISTANT = ridge(peaksWest(120, 50, 40, 56, 84, 23), 0.62);

// --- a screen under construction -----------------------------------------------------------
function canvas() {
  const grid = () => Array.from({ length: H }, () => Array(W).fill(''));
  const grids = { sky: grid(), dist: grid(), hills: grid(), back: grid(), land: grid(), fore: grid() };
  const solid = new Uint8Array(W * H);
  let layer = 'land';
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const pick = (name, ...args) => (typeof name === 'function' ? name(...args) : name);
  const c = {
    grids,
    solid,
    /** Draw scenery on this layer from now on (block/carve always work on the land). */
    on(name) { layer = name; return c; },
    paint(x, y, name) { if (inside(x, y) && name !== undefined) grids[layer][y][x] = name; },
    rect(x, y, w, h, name) { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c.paint(x + dx, y + dy, pick(name, x + dx, y + dy, dy, dx)); },
    set(x, y, name) { if (inside(x, y)) { grids.land[y][x] = name; solid[y * W + x] = 1; } },
    clear(x, y, name = '') { if (inside(x, y)) { grids.land[y][x] = name; solid[y * W + x] = 0; } },
    block(x, y, w, h, name) { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c.set(x + dx, y + dy, pick(name, x + dx, y + dy, dy, dx)); },
    isSolid: (x, y) => inside(x, y) && solid[y * W + x] === 1,
  };
  return c;
}

// --- materials --------------------------------------------------------------------------------
const ROCK = new Set(['px-near', 'px-far', 'px-sky2']);
/** Rock: wavy layers, cracks, specks and the odd paler stone. */
const rock = (X, Y) => {
  const wave = Math.round(3 * Math.sin(X / 17) + 2 * noise(X, Y, 9, 3));
  const r = hash(X, Y, 3);
  if (hash(Math.floor(X / 3), Math.floor(Y / 2), 4) < 0.03) return 'px-near-light';
  if (r < 0.05) return 'px-far';
  if ((Y + wave) % 7 === 0 && noise(X, Y, 6, 5) < 0.55) return 'px-sky2';
  return Math.floor((Y + wave) / 7) % 2 && r < 0.3 ? 'px-sky2' : 'px-near';
};
function earth(season) {
  const top = season === 'winter' ? 'px-snow' : 'px-grass-light';
  return (X, Y, dy) => {
    if (dy === 0) return top;
    const r = hash(X, Y, 6);
    if (dy < 3) return r < 0.1 ? 'px-grass-light' : 'px-grass';
    if (dy < 6) return (X + Y) % 2 === 0 || r < 0.3 ? 'px-grass-dark' : 'px-grass';
    if (r < 0.025) return 'px-far';
    if (dy < 16 && hash(Math.floor(X / 4), Y, 7) < 0.02) return 'px-trunk';
    if (dy > 12 && hash(Math.floor(X / 2), Math.floor(Y / 2), 8) < 0.02) return 'px-near';   // small stones
    return 'px-grass-dark';
  };
}
/** The cave's back wall: darker than the rock in front, with seams, so the space has depth. */
const backWall = (X, Y) => {
  const n = noise(X, Y, 11, 12);
  const r = hash(X, Y, 13);
  if (r < 0.012) return 'px-far';
  if (n > 0.62) return (X + Y) % 2 ? 'px-sky1' : 'px-sky0';
  if (n > 0.5 && r < 0.4) return 'px-sky1';
  return 'px-sky0';
};

/** Finish a rock or earth mass: round off its outer corners and light, moss or shade its edges. */
function finish(c, { moss = true, region = [0, 0, W, H] } = {}) {
  const [x0, y0, w, h] = region;
  const within = (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  for (let pass = 0; pass < 2; pass++) {
    const cut = [];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (!c.isSolid(x, y)) continue;
      const up = c.isSolid(x, y - 1) || y === 0; const down = c.isSolid(x, y + 1) || y === H - 1;
      const left = c.isSolid(x - 1, y) || x === 0; const right = c.isSolid(x + 1, y) || x === W - 1;
      if ((!up && (!left || !right)) || (!down && (!left || !right) && hash(x, y, pass) < 0.7)) cut.push([x, y]);
    }
    cut.forEach(([x, y]) => { if (within(x, y)) c.clear(x, y, c.grids.land[y][x] === '' ? '' : undefined); });
  }
  const land = c.grids.land;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (!c.isSolid(x, y)) { if (land[y][x] && !['px-sky0', 'px-sky1', 'px-far', ''].includes(land[y][x])) land[y][x] = ''; continue; }
    if (!ROCK.has(land[y][x]) && land[y][x] !== 'px-near-light') continue;
    if (!c.isSolid(x, y - 1)) land[y][x] = moss && hash(x, y, 20) < 0.55 ? 'px-grass' : 'px-near-light';
    else if (!c.isSolid(x, y + 1)) land[y][x] = 'px-sky2';
    else if (!c.isSolid(x - 1, y) || !c.isSolid(x + 1, y)) land[y][x] = hash(x, y, 21) < 0.5 ? 'px-far' : land[y][x];
  }
  if (!moss) return;
  // Moss hanging under ledges, in front.
  c.on('fore');
  for (let y = y0 + 1; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (c.isSolid(x, y - 1) && !c.isSolid(x, y) && hash(x, y, 22) < 0.12) {
      const length = 1 + Math.floor(hash(x, y, 23) * 4);
      for (let i = 0; i < length && !c.isSolid(x, y + i); i++) c.paint(x, y + i, i === length - 1 ? 'px-grass' : 'px-grass-dark');
    }
  }
  c.on('land');
}

// --- scenery ----------------------------------------------------------------------------------
/** Sky: the picture's bands (drawn taller), stars, a faint Milky Way, thin clouds. */
function sky(c, next, { high = false } = {}) {
  c.on('sky');
  const bands = high ? [[0, 'px-sky0'], [90, 'px-sky1'], [122, 'px-sky2']] : [[0, 'px-sky0'], [46, 'px-sky1'], [80, 'px-sky2'], [102, 'px-sky3']];
  for (let y = 0; y < H; y++) {
    const index = bands.findLastIndex(([start]) => y >= start);
    const after = bands[index + 1];
    for (let x = 0; x < W; x++) {
      const dither = after && y >= after[0] - 3 && ((x + y) % 2 === 0 || (y >= after[0] - 1 && x % 2));
      c.paint(x, y, dither ? after[1] : bands[index][1]);
    }
  }
  const tilt = next() * 0.3 - 0.15;
  const band = x => (high ? 50 : 24) + x * tilt;
  for (let x = 0; x < W; x++) for (let y = 0; y < (high ? 120 : 86); y++) {
    const d = Math.abs(y - band(x));
    if (d < 12 && hash(x, y, 30) < (12 - d) / 220) c.paint(x, y, 'px-star-dim');
    else if (d < 8 && (x + y) % 2 === 0 && hash(x, y, 31) < (8 - d) / 30) c.paint(x, y, 'px-sky1');
  }
  const stars = [];
  for (let i = 0; i < (high ? 110 : 64); i++) {
    const x = Math.floor(next() * W);
    const y = Math.floor(next() * (high ? 120 : 82));
    c.paint(x, y, next() < 0.3 ? 'px-star' : 'px-star-dim');
    if (next() < 0.3) stars.push([x, y]);
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(next() * W);
    const y = 6 + Math.floor(next() * (high ? 100 : 56));
    c.paint(x, y, 'px-star');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => c.paint(x + dx, y + dy, 'px-star-dim'));
  }
  c.on('land');
  return stars;
}

/** The distant range (shifting slower than the land from screen to screen), then the picture's. */
function mountains(c, gx0) {
  c.on('dist');
  for (let x = 0; x < W; x++) {
    const top = DISTANT(Math.round(gx0 * 0.45) + x);
    for (let y = top; y < H; y++) c.paint(x, y, y === top || (y === top + 1 && hash(x, y, 32) < 0.35) ? 'px-far' : 'px-sky3');
  }
  c.on('hills');
  for (let x = 0; x < W; x++) {
    const far = FAR(gx0 + x);
    const near = NEAR(gx0 + x);
    for (let y = far; y < H; y++) c.paint(x, y, y === far ? 'px-far-light' : noise(x, y, 4, 33) > 0.78 ? 'px-far-light' : 'px-far');
    for (let y = near; y < H; y++) c.paint(x, y, y <= near + (x % 7 === 0 ? 1 : 0) ? 'px-near-light' : 'px-near');
  }
  c.on('land');
}

/** Small dark trees and bushes along the far edge of the meadow. */
function treeLine(c, next, from, to, base) {
  c.on('back');
  for (let x = from; x < to; x += 4 + Math.floor(next() * 8)) {
    const h = 3 + Math.floor(next() * 8);
    const r = 2 + Math.floor(next() * 3);
    const b = base(Math.max(0, Math.min(W - 1, x))) - 1;
    for (let y = b - h; y <= b; y++) c.paint(x, y, 'px-near');
    for (let dy = -r - 2; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + (dy * 0.7) ** 2 > r * r + 1) continue;
      const rim = dx * dx + ((dy - 1) * 0.7) ** 2 > r * r + 1;
      c.paint(x + dx, b - h + dy, rim && dx < 1 ? 'px-grass-dark' : 'px-near');
    }
  }
  c.on('land');
}

/** A crown of leaf clumps, each lit on its upper left and shaded on its lower right. */
function crown(c, season, cx, cy, rx, ry, seed) {
  const [leaf, light] = LEAVES[season] || LEAVES.summer;
  const next = random(seed);
  const clumps = [];
  for (let i = 0; i < Math.round((rx * ry) / 14); i++) {
    const a = next() * Math.PI * 2;
    const d = Math.sqrt(next());
    const r = 3 + Math.floor(next() * Math.min(rx, ry) * 0.45);
    clumps.push([cx + Math.cos(a) * d * (rx - r), cy + Math.sin(a) * d * (ry - r), r]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [x0, y0, r] of clumps) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + (hash(Math.round(x0 + dx), Math.round(y0 + dy), 8) < 0.4 ? r : 0)) continue;
      const lit = dx + dy < -r * 0.6;
      const dark = dx + dy > r * 0.7 || y0 + dy > cy + ry * 0.45;
      const n = hash(Math.round(x0 + dx), Math.round(y0 + dy), 9);
      c.paint(Math.round(x0 + dx), Math.round(y0 + dy), lit ? (n < 0.5 ? light : leaf) : dark ? (n < 0.7 ? 'px-grass-dark' : leaf) : n < 0.12 ? light : leaf);
    }
  }
}
function tree(c, season, x, base, height, rx, ry) {
  c.on('back');
  for (let y = base - height; y < base; y++) { c.paint(x, y, 'px-trunk'); c.paint(x + 1, y, 'px-door'); c.paint(x + 2, y, y % 4 ? 'px-trunk' : 'px-door'); }
  c.paint(x - 1, base - 1, 'px-trunk'); c.paint(x + 3, base - 1, 'px-trunk');
  for (let i = 1; i <= 3; i++) { c.paint(x - i, base - height + 4 - i, 'px-trunk'); c.paint(x + 2 + i, base - height + 2 - i, 'px-trunk'); }
  crown(c, season, x + 1, base - height, rx, ry, x * 31 + base);
  c.on('land');
}

/** Grass tufts and flowers in front of the creature, along the ground's top. */
function grassFront(c, next, season, from, to) {
  c.on('fore');
  const flowers = { spring: 34, summer: 26, autumn: 12, winter: 0 }[season] ?? 20;
  for (let x = from; x < to; x++) {
    let t = 0;
    while (t < H && !c.isSolid(x, t)) t++;
    if (t >= H || t < 2 || !['px-grass-light', 'px-snow', 'px-grass'].includes(c.grids.land[t][x])) continue;
    const r = next();
    if (season !== 'winter' && r < 0.36) {
      const h = 1 + Math.floor(next() * 3);
      for (let dy = 1; dy <= h; dy++) c.paint(x, t - dy, dy === h ? 'px-grass-light' : 'px-grass');
    } else if (r > 1 - flowers / 400) {
      c.paint(x, t - 1, 'px-grass'); c.paint(x, t - 2, 'px-grass');
      c.paint(x, t - 3, next() < 0.5 ? 'px-flower' : 'px-flower-alt');
    }
  }
  c.on('land');
}

/** A heap of fallen stones at the foot of a rock face: [x0, x1) along the ground at `base`. */
function rubble(c, x0, x1, base, height) {
  const mid = (x0 + x1) / 2;
  for (let x = x0; x < x1; x++) {
    const h = Math.round(height * (1 - ((x - mid) / ((x1 - x0) / 2)) ** 2) + noise(x, base, 3, 120) * 2 - 1);
    for (let y = base - h; y < base; y++) c.set(x, y, hash(x, y, 121) < 0.25 ? 'px-far' : y === base - h ? 'px-near-light' : 'px-near');
  }
}

/** Ground: a column of earth from a top that wanders a little. */
function groundColumns(c, from, to, top, style) {
  for (let x = from; x < to; x++) { const t = top(x); for (let y = t; y < H; y++) c.set(x, y, style(x, y, y - t)); }
}

// --- caves ------------------------------------------------------------------------------------
/** Dig open space: shapes are ellipses [cx, cy, rx, ry] and tunnels [x1, y1, x2, y2, r], blurred by noise. */
function dig(c, shapes, salt) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = -1;
    for (const s of shapes) {
      if (s.length === 4) { const [cx, cy, rx, ry] = s; v = Math.max(v, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry)); }
      else {
        const [x1, y1, x2, y2, r] = s;
        const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2 || 1)));
        v = Math.max(v, 1 - Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1))) / r);
      }
    }
    if (v + (noise(x, y, 7, salt) - 0.5) * 0.45 > 0) c.clear(x, y);
  }
}
/** Walkable floors: solid below floor(x), and at least `room` rows kept open above it. */
function floors(c, from, to, floor, style = rock, room = 15) {
  for (let x = from; x < to; x++) {
    const f = floor(x);
    for (let y = Math.max(0, f - room); y < f; y++) c.clear(x, y);
    for (let y = f; y < H; y++) c.set(x, y, style(x, y));
  }
}
/** The cave's back wall and its decorations: rock pillars, crystals, glowworms, pebbles. */
function caveBack(c, next, { pillars = 3, crystals = 5 } = {}) {
  c.on('sky');
  c.rect(0, 0, W, H, (X, Y) => (hash(X, Y, 40) < 0.02 ? 'px-sky1' : 'px-sky0'));
  c.on('back');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!c.isSolid(x, y)) c.paint(x, y, backWall(x, y));
  // Far pillars and hanging rock, a shade lighter than the wall.
  for (let i = 0; i < pillars; i++) {
    const x = 20 + Math.floor(next() * (W - 40));
    const w = 5 + Math.floor(next() * 6);
    for (let y = 0; y < H; y++) {
      const edge = Math.round(noise(x, y, 6, 41 + i) * 3);
      for (let dx = edge; dx < w - edge + 1; dx++) if (!c.isSolid(x + dx, y) && hash(x + dx, y, 42) < 0.85) c.paint(x + dx, y, dx === edge ? 'px-sky2' : 'px-sky1');
    }
  }
  const lights = [];
  for (let i = 0; i < crystals; i++) {
    const x = 10 + Math.floor(next() * (W - 20));
    let y = 10 + Math.floor(next() * (H - 30));
    while (y < H - 2 && !c.isSolid(x, y + 1)) y++;
    if (y >= H - 2 || c.isSolid(x, y)) continue;
    const glow = next() < 0.5 ? 'px-window' : 'px-flower-alt';
    [[0, 0], [0, -1], [0, -2], [-1, 0], [-1, -1], [1, 0], [2, 0], [2, -1]].forEach(([dx, dy]) => { if (!c.isSolid(x + dx, y + dy)) c.paint(x + dx, y + dy, dy === -2 || (dx === 2 && dy === -1) ? 'px-far-light' : glow); });
    lights.push({ x, y: y - 1, r: 10 });
  }
  const worms = [];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(next() * W); const y = Math.floor(next() * (H - 30));
    if (!c.isSolid(x, y) && c.isSolid(x, y - 1)) worms.push([x, y]);
  }
  c.on('land');
  return { lights, worms };
}
function stalactites(c, next, from, to) {
  c.on('back');
  for (let x = from; x < to; x += 5 + Math.floor(next() * 9)) {
    let y = 0;
    while (y < H - 1 && c.isSolid(x, y)) y++;
    if (y >= H - 20 || y === 0) continue;
    const length = 2 + Math.floor(next() * 7);
    for (let dy = 0; dy < length && !c.isSolid(x, y + dy); dy++) c.paint(x, y + dy, dy === length - 1 ? 'px-far-light' : 'px-near');
  }
  c.on('land');
}

/** Finish a screen: no stray single pixels of rock left floating anywhere. */
function done(c, extra) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (c.isSolid(x, y) && !c.isSolid(x - 1, y) && !c.isSolid(x + 1, y) && !c.isSolid(x, y - 1) && !c.isSolid(x, y + 1) && x > 0 && x < W - 1 && y > 0 && y < H - 1) c.clear(x, y);
  }
  return { layers: c.grids, solid: c.solid, things: [], dyn: [], climbs: [], lights: [], dark: false, ...extra };
}

// --- the screens ------------------------------------------------------------------------------

/** A: just west of the picture. A stone well with a rope leads down. */
function roomA(next, season) {
  const c = canvas();
  const gx0 = -W;
  const stars = sky(c, next);
  mountains(c, gx0);
  const top = x => {
    const t = meadow(gx0 + x);
    if (x >= 104 && x <= 156) return GROUND;
    if (x >= 96 && x < 104) return Math.round(t + ((x - 96) / 8) * (GROUND - t));
    if (x > 156 && x <= 164) return Math.round(GROUND + ((x - 156) / 8) * (t - GROUND));
    return t;
  };
  treeLine(c, next, -8, W + 8, x => Math.min(top(x), GROUND) - 2);
  tree(c, season, 34, top(34), 16, 11, 8);
  const ground = earth(season);
  groundColumns(c, 0, 124, top, ground);
  groundColumns(c, 136, W, top, ground);
  // The well: stones round its mouth and down its throat, a roof on two posts, and the rope.
  for (let y = GROUND; y < H; y++) { c.set(123, y, y % 3 ? 'px-near' : 'px-near-light'); c.set(136, y, y % 3 ? 'px-near-light' : 'px-near'); }
  for (let y = GROUND; y < H; y++) for (let x = 124; x < 136; x++) c.clear(x, y, hash(x, y, 50) < 0.03 ? 'px-sky1' : 'px-sky0');
  [[119, 119, 5], [120, 118, 3], [136, 119, 5], [137, 118, 3]].forEach(([x, y, w]) => c.block(x, y, w, 1, (X) => (y === 118 ? 'px-near-light' : hash(X, y, 51) < 0.4 ? 'px-far' : 'px-near')));
  c.on('back');
  c.rect(121, 98, 1, 20, 'px-trunk'); c.rect(138, 98, 1, 20, 'px-trunk');
  for (let i = 0; i < 6; i++) c.rect(115 + i * 2, 97 - i, 30 - i * 4, 1, i % 2 ? 'px-door' : 'px-roof');
  c.rect(121, 98, 18, 1, 'px-trunk');
  c.rect(129, 99, 1, 21, 'px-far-light');
  c.on('land');
  for (let y = GROUND; y < H; y++) c.paint(129, y, 'px-far-light');
  // A signpost pointing west, and a few stones in the grass.
  c.on('back');
  const sy = top(212);
  c.rect(214, sy - 11, 1, 11, 'px-trunk');
  c.rect(208, sy - 11, 10, 3, (X, Y, dy) => (dy === 1 && X > 209 && X < 216 && X % 2 ? 'px-trunk' : 'px-door'));
  c.paint(207, sy - 10, 'px-door');
  [[60, 1], [182, 2], [236, 1]].forEach(([x, w]) => c.rect(x, top(x) - 1, w + 1, 1, 'px-near-light'));
  c.on('land');
  grassFront(c, next, season, 0, W);
  return done(c, { stars, climbs: [[124, 98, 12, 46]], fireflies: { count: 7, area: [0, 88, W, 30] }, clouds: 2, top, mood: 'meadow' });
}

/** B: under the well. Moonlight comes down the shaft; a tunnel goes west into the dark. */
function roomB(next) {
  const c = canvas();
  c.block(0, 0, W, H, rock);
  dig(c, [[124, 0, 136, 30, 7], [128, 76, 62, 36], [86, 96, 38, 24], [176, 94, 44, 28], [0, 116, 70, 115, 8], [178, 116, 224, 116, 7]], 60);
  for (let y = 0; y < 60; y++) for (let x = 124; x < 136; x++) c.clear(x, y);           // the shaft, down into the chamber
  floors(c, 18, 226, x => 124 + Math.round(1.5 * Math.sin(x / 19)));
  for (let x = 0; x < 72; x++) { for (let y = 107; y < 124; y++) c.clear(x, y); for (let y = 124; y < H; y++) c.set(x, y, rock(x, y)); }
  for (let x = 222; x < 226; x++) for (let y = 108; y < 124; y++) c.clear(x, y, hash(x, y, 61) < 0.2 ? 'px-far' : 'px-near');   // a wall that isn't one
  for (let x = 226; x < 252; x++) { for (let y = 108; y < 124; y++) c.clear(x, y); for (let y = 124; y < H; y++) c.set(x, y, rock(x, y)); }
  finish(c, { region: [0, 0, 222, H] });
  finish(c, { region: [226, 0, 30, H] });
  const { lights, worms } = caveBack(c, next, { pillars: 3, crystals: 4 });
  stalactites(c, next, 60, 220);
  // A still pool, pebbles, the end of the rope with its bucket.
  for (let x = 150; x < 180; x++) { const f = 124 + Math.round(1.5 * Math.sin(x / 19)); c.clear(x, f - 1, (x * 3) % 7 ? 'px-sky1' : 'px-star'); c.set(x, f, 'px-sky2'); }
  c.on('back');
  for (let y = 0; y < 116; y++) c.paint(129, y, 'px-far-light');
  c.rect(127, 116, 5, 3, (X, Y, dy) => (dy === 0 ? 'px-door' : 'px-trunk'));
  c.on('land');
  return done(c, {
    things: [{ kind: 'friend', x: 238, y: 119, w: 6, h: 5 }],
    climbs: [[124, 0, 12, H]],
    lights: [...[4, 20, 36, 52, 68, 84, 100, 114].map((y, i) => ({ x: 130 + i * 0.5, y, r: 20 - i * 0.7 })), { x: 165, y: 122, r: 12 }, ...lights],
    worms,
    dark: true,
    fear: 72,      // without a light the creature won't go further west than this
    drips: [[100, 60], [160, 50], [196, 70]],
    mood: 'cave',
  });
}

/** C: the old tree (the lantern at the top of its boughs), and a cliff too high to climb… until the vine. */
function roomC(next, season) {
  const c = canvas();
  const gx0 = -2 * W;
  const stars = sky(c, next);
  mountains(c, gx0);
  // The cliff's face: rounded at its brow, leaning and eroded lower down, with a ledge or two.
  const face = y => {
    const d = y - 52;
    const brow = d < 7 ? Math.round((7 - d) ** 2 / 7) : 0;
    return 55 + Math.round(noise(0, y, 9, 70) * 7 - 3 + noise(0, y, 3, 75) * 2) - brow + (d > 30 ? Math.round((d - 30) / 9) : 0);
  };
  const top = x => {
    const t = meadow(gx0 + x);
    if (x <= 110) return GROUND;
    return x <= 118 ? Math.round(GROUND + ((x - 110) / 8) * (t - GROUND)) : t;
  };
  treeLine(c, next, 60, W + 8, x => Math.min(top(x), GROUND) - 2);
  const ground = earth(season);
  groundColumns(c, 0, W, top, ground);
  // The cliff: grassy on top, rock with ivy below, its face uneven.
  for (let y = 52; y < H; y++) for (let x = 0; x < face(y); x++) c.set(x, y, y < 55 + noise(x, 1, 4, 72) * 2 ? 'px-grass' : rock(x, y));
  for (let x = 0; x < 64; x++) { let y = 0; while (y < H && !c.isSolid(x, y)) y++; if (y < GROUND - 2) c.grids.land[y][x] = 'px-grass-light'; }
  rubble(c, 46, 72, GROUND, 5);
  finish(c, { region: [0, 50, 76, 70] });
  c.on('fore');
  for (let x = 44; x < 58; x += 2) for (let y = 55; y < 55 + 4 + Math.floor(hash(x, 0, 73) * 14); y++) if (!c.isSolid(x, y)) c.paint(x, y, (x + y) % 3 ? 'px-grass-dark' : 'px-grass');
  c.on('land');
  // Soft earth at the foot of the cliff, with a dry little stalk.
  for (let x = 56; x <= 76; x++) { c.grids.land[GROUND][x] = x % 3 ? 'px-trunk' : 'px-grass-dark'; c.grids.land[GROUND + 1][x] = 'px-trunk'; }
  c.on('back'); c.rect(64, 116, 1, 4, 'px-grass-dark'); c.paint(63, 116, 'px-grass-dark'); c.on('land');
  // The old tree: a wide trunk with roots and big boughs, a great crown.
  c.on('back');
  for (let y = 40; y < GROUND; y++) for (let x = 150; x <= 158; x++) c.paint(x, y, x === 150 || x === 158 || hash(x, y, 74) < 0.1 ? 'px-trunk' : 'px-door');
  [[146, 3], [148, 2], [160, 2], [162, 3]].forEach(([x, h]) => c.rect(x, GROUND - h, 2, h, 'px-trunk'));
  for (let i = 0; i < 20; i++) { c.rect(149 - i, 46 - Math.round(i * 0.6), 2, 2, 'px-trunk'); c.rect(158 + i, 44 - Math.round(i * 0.55), 2, 2, 'px-trunk'); }
  crown(c, season, 154, 30, 54, 26, 4242);
  c.on('land');
  const bough = (x, y, w) => { c.block(x + 1, y, w - 2, 1, 'px-roof'); c.block(x, y + 1, w, 1, (X) => (X % 4 ? 'px-trunk' : 'px-door')); c.on('back'); c.paint(x + 1, y + 2, 'px-trunk'); c.paint(x + w - 2, y + 2, 'px-trunk'); c.on('land'); };
  bough(133, 108, 14); bough(160, 96, 14); bough(133, 84, 14); bough(160, 72, 14);
  c.on('fore');
  const [leaf, light] = LEAVES[season] || LEAVES.summer;
  for (let i = 0; i < 30; i++) c.paint(128 + Math.floor(next() * 52), 66 + Math.floor(next() * 50), next() < 0.5 ? leaf : light);
  c.on('land');
  grassFront(c, next, season, 0, W);
  return done(c, {
    stars,
    things: [{ kind: 'item', id: 'lantern', x: 166, y: 67, w: 3, h: 5 }, { kind: 'soil', x: 54, y: 110, w: 26, h: 10 }],
    dyn: [{ kind: 'vine', climb: [57, 0, 10, GROUND], stem: [61, 0, GROUND] }],
    fireflies: { count: 8, area: [80, 76, 170, 40] },
    falling: { from: [110, 16, 90, 36], count: 5 },
    clouds: 2,
    top,
    mood: 'meadow',
  });
}

/** F: among the tree's roots, in the dark. The seed glows at the far end. */
function roomF(next) {
  const c = canvas();
  c.block(0, 0, W, H, rock);
  dig(c, [[256, 116, 186, 116, 8], [122, 82, 78, 40], [48, 70, 40, 40], [30, 104, 26, 18]], 80);
  floors(c, 140, W, x => 124 + Math.round(noise(x, 0, 12, 81) * 2));
  for (let x = 118; x < 140; x++) for (let y = 110; y < H; y++) c.clear(x, y);            // a pit, open below
  floors(c, 40, 118, x => 114 + Math.round(noise(x, 0, 10, 82) * 2));
  floors(c, 6, 40, () => 124, rock, 12);
  finish(c);
  c.block(129, 117, 8, 2, (X, Y, dy) => (dy === 0 ? 'px-roof' : 'px-trunk'));            // roots across the pit
  c.block(120, 112, 6, 2, (X, Y, dy) => (dy === 0 ? 'px-roof' : 'px-trunk'));
  const shelf = (x, y, w) => { c.block(x + 1, y, w - 2, 1, 'px-grass'); c.block(x, y + 1, w, 2, rock); c.block(x + 2, y + 3, w - 4, 1, 'px-sky2'); };
  shelf(30, 103, 9); shelf(46, 92, 9); shelf(28, 81, 9); shelf(4, 70, 20);
  const { lights, worms } = caveBack(c, next, { pillars: 4, crystals: 3 });
  stalactites(c, next, 50, 240);
  // Roots hanging from the roof (the old tree is above), with side roots.
  c.on('back');
  for (let x = 60; x < 200; x += 4 + Math.floor(next() * 7)) {
    let y = 0;
    while (y < H - 1 && c.isSolid(x, y)) y++;
    const length = 6 + Math.floor(next() * 26);
    for (let dy = 0; dy < length; dy++) {
      const wobble = Math.round(Math.sin((x + dy) / 4));
      if (!c.isSolid(x + wobble, y + dy)) c.paint(x + wobble, y + dy, 'px-trunk');
      if (dy > 3 && (x + dy) % 9 === 0) c.paint(x + wobble + 1, y + dy + 1, 'px-trunk');
    }
  }
  c.on('land');
  const mushrooms = [[70, 113], [96, 113], [150, 123], [200, 123], [16, 123], [10, 69]];
  c.on('back');
  mushrooms.forEach(([x, y]) => { c.paint(x, y, 'px-flower-alt'); c.paint(x - 1, y - 1, 'px-window'); c.paint(x, y - 1, 'px-window'); c.paint(x + 1, y - 1, 'px-window'); });
  c.on('land');
  return done(c, {
    things: [{ kind: 'item', id: 'seed', x: 12, y: 67, w: 3, h: 3 }],
    lights: [{ x: 13, y: 68, r: 26 }, ...mushrooms.map(([x, y]) => ({ x, y: y - 1, r: 8 })), ...lights],
    worms,
    dark: true,
    spores: { count: 12, area: [10, 30, 200, 90] },
    drips: [[110, 50], [160, 44]],
    mood: 'cave',
  });
}

/** G: above the tree, among the clouds. The key lies in a nest. */
function roomG(next) {
  const c = canvas();
  const stars = sky(c, next, { high: true });
  c.on('back');
  for (let x = 0; x < W; x++) for (let y = 130 + Math.round(3 * Math.sin(x / 9) + 2 * noise(x, 0, 6, 90)); y < H; y++) c.paint(x, y, (x + y) % 2 ? 'px-cloud' : 'px-far');
  c.on('land');
  const cloud = (x, y, w) => {
    for (let dx = 0; dx < w; dx++) {
      const bump = Math.round(noise(x + dx, y, 4, 91) * 2);
      const edge = dx < 2 || dx > w - 3;
      c.block(x + dx, y + (edge ? 1 : 0) - (edge ? 0 : bump - 1), 1, 1, 'px-far-light');
      c.block(x + dx, y + 1, 1, edge ? 1 : 2, (X, Y) => (hash(X, Y, 92) < 0.3 ? 'px-far' : 'px-cloud'));
    }
    c.rect(x + 3, y + 3, w - 6, 1, 'px-cloud');
  };
  cloud(70, 96, 20);
  cloud(98, 86, 20);
  cloud(126, 76, 20);
  cloud(156, 66, 24);
  c.block(163, 62, 11, 4, (X, Y, dy) => (dy === 0 && X % 2 ? 'px-door' : dy === 3 ? 'px-door' : 'px-trunk'));   // the nest
  return done(c, {
    stars,
    things: [{ kind: 'item', id: 'key', x: 166, y: 58, w: 5, h: 3 }],
    dyn: [{ kind: 'vine', climb: [57, 90, 10, H - 90], stem: [61, 90, H], flower: [63, 88] }],
    meteor: true,
    clouds: 3,
    mood: 'sky',
  });
}

/** D: rocky terraces down from the cliff, old ruins, and a gate that needs the key. */
function roomD(next, season) {
  const c = canvas();
  const gx0 = -3 * W;
  const stars = sky(c, next);
  mountains(c, gx0);
  treeLine(c, next, -8, 120, () => GROUND - 2);
  const ground = earth(season);
  // Terraces of rock stepping down from the cliff (its top is at 52, like C's).
  const steps = [[200, 52], [180, 63], [158, 74], [136, 85], [114, 96], [92, 108]];
  steps.forEach(([x0, y0], i) => {
    const x1 = i === 0 ? W : steps[i - 1][0];
    for (let x = x0 - 3; x < x1; x++) {
      const d = x - x0;                                   // the shoulder: the front edge rounds down
      const shoulder = d < 4 ? Math.round((4 - d) ** 2 / 3) : 0;
      const t = y0 + shoulder + (i === 0 ? 0 : Math.round(noise(x, y0, 5, 100 + i)));
      for (let y = t; y < H; y++) if (!c.isSolid(x, y) || y > t) c.set(x, y, y === t ? 'px-grass-light' : y < t + 3 ? 'px-grass' : rock(x, y));
    }
  });
  steps.slice(1).forEach(([x0, y0], i) => rubble(c, x0 - 7, x0 + 1, i === steps.length - 2 ? GROUND : steps[i + 2][1], 3));
  groundColumns(c, 0, 92, () => GROUND, (X, Y, dy) => (dy === 0 ? (X % 7 ? 'px-far-light' : 'px-far') : dy === 1 ? 'px-far' : ground(X, Y, dy + 5)));
  finish(c, { region: [88, 44, W - 88, 80] });
  c.on('fore');
  for (let x = 96; x < W; x += 3) {
    let y = 0;
    while (y < H - 1 && !c.isSolid(x, y)) y++;
    if (!c.isSolid(x + 3, y) || hash(x, 0, 101) < 0.5) for (let i = 1; i < 3 + hash(x, 1, 102) * 8; i++) if (!c.isSolid(x + 1, y + i)) c.paint(x + 1, y + i, i % 3 ? 'px-grass-dark' : 'px-grass');   // ivy over the edges
  }
  c.on('land');
  // Ruins: broken columns, a fallen one, an arch without a wall, moss.
  c.on('back');
  [[56, 86], [72, 96], [88, 82]].forEach(([x, y]) => {
    c.rect(x, y, 4, GROUND - y, (X) => (X === x ? 'px-far-light' : X === x + 3 ? 'px-near' : 'px-far'));
    c.rect(x - 1, y, 6, 2, 'px-near-light');
    for (let yy = y + 3; yy < GROUND - 1; yy += 6) c.paint(x + Math.floor(hash(x, yy, 103) * 4), yy, 'px-grass');
  });
  c.rect(60, 116, 12, 4, (X, Y, dy) => (dy === 0 ? 'px-far-light' : X % 5 === 0 ? 'px-near' : 'px-far'));
  for (let x = 62; x <= 90; x++) { const y = 72 + Math.round(((x - 76) / 14) ** 2 * 7); c.paint(x, y, 'px-near-light'); c.paint(x, y + 1, 'px-far'); }
  // The gate: an arch on two pillars; its bars (drawn by world.js) block the way until opened.
  c.rect(24, 80, 6, 40, (X, Y) => (X === 24 ? 'px-near-light' : hash(X, Y, 104) < 0.1 ? 'px-far' : 'px-near'));
  c.rect(37, 80, 6, 40, (X, Y) => (X === 42 ? 'px-far' : hash(X, Y, 105) < 0.1 ? 'px-far' : 'px-near'));
  c.rect(22, 74, 23, 6, (X, Y, dy) => (dy === 0 ? 'px-near-light' : dy === 5 ? 'px-far' : 'px-near'));
  c.rect(32, 75, 2, 3, 'px-window');
  for (let y = 80; y < GROUND; y += 4) { c.paint(25 + (y % 3), y, 'px-grass'); c.paint(41 - (y % 3), y + 2, 'px-grass'); }
  c.on('land');
  tree(c, season, 228, 52, 16, 12, 9);
  grassFront(c, next, season, 0, W);
  return done(c, {
    stars,
    things: [{ kind: 'gate', x: 30, y: 80, w: 7, h: 40 }],
    dyn: [{ kind: 'gate', rects: [[30, 80, 7, 40]] }],
    fireflies: { count: 6, area: [40, 80, 100, 36] },
    clouds: 2,
    mood: 'meadow',
  });
}

/** E: the hilltop at the end of the way: a great tree, a bench, the moon, and the letter. */
function roomE(next, season) {
  const c = canvas();
  const gx0 = -4 * W;
  const stars = sky(c, next);
  c.on('sky');
  const [mx, my, r] = [196, 40, 13];
  for (let y = my - r - 5; y <= my + r + 5; y++) for (let x = mx - r - 5; x <= mx + r + 5; x++) {
    const d = Math.hypot(x - mx, y - my);
    if (d <= r) c.paint(x, y, x - mx + (y - my) > 7 || (x - mx + (y - my) > 4 && (x + y) % 2) ? 'px-moon-shade' : 'px-moon');
    else if (d <= r + 4 && (x + y) % 3 === 0) c.paint(x, y, 'px-sky1');
  }
  [[-4, -3], [-3, -3], [3, 2], [4, 2], [3, 3], [-6, 3], [5, -6]].forEach(([dx, dy]) => c.paint(mx + dx, my + dy, 'px-moon-shade'));
  c.on('land');
  mountains(c, gx0);
  const top = x => Math.round(x >= 224 ? GROUND : x >= 160 ? GROUND - (224 - x) * 0.375 + noise(x, 0, 8, 110) : x >= 40 ? 96 + ((x - 100) / 60) ** 2 * 2 : 98 + (40 - x) * 0.2);
  treeLine(c, next, 150, W + 8, x => Math.min(top(x), GROUND) - 2);
  const ground = earth(season);
  groundColumns(c, 0, W, top, ground);
  tree(c, season, 118, top(118), 26, 22, 14);
  c.on('back');
  c.rect(88, 88, 14, 1, 'px-door'); c.rect(88, 90, 14, 1, 'px-door');
  c.rect(89, 91, 1, 5, 'px-trunk'); c.rect(100, 91, 1, 5, 'px-trunk'); c.rect(88, 84, 14, 1, 'px-trunk'); c.rect(89, 85, 1, 3, 'px-trunk'); c.rect(100, 85, 1, 3, 'px-trunk');
  c.on('land');
  c.block(66, 92, 14, 4, (X, Y, dy) => (dy === 0 ? 'px-near-light' : hash(X, Y, 111) < 0.2 ? 'px-far' : 'px-near'));
  c.clear(66, 92); c.clear(79, 92);
  grassFront(c, next, season, 0, W);
  return done(c, {
    stars,
    things: [{ kind: 'letter', x: 68, y: 86, w: 9, h: 6 }],
    fireflies: { count: 14, area: [10, 56, 220, 50] },
    falling: { from: [100, 44, 40, 24], count: 4 },
    clouds: 2,
    top,
    mood: 'hill',
  });
}

/** The drawing tools, for other small worlds (vault/shore-level.js). */
export const tools = { canvas, hash, noise, rock, finish, done, rubble };

export function buildWorld({ season = seasonOf() } = {}) {
  const next = random(20260927);
  const layout = { '3,0': roomA(next, season), '3,1': roomB(next), '2,0': roomC(next, season), '2,1': roomF(next), '2,-1': roomG(next), '1,0': roomD(next, season), '0,0': roomE(next, season) };
  const rooms = new Map(Object.entries(layout).map(([key, room]) => {
    const [x, y] = key.split(',').map(Number);
    return [key, { ...room, key, x, y }];
  }));
  for (const room of rooms.values()) {
    room.left = rooms.get(`${room.x - 1},${room.y}`) || null;
    room.right = rooms.get(`${room.x + 1},${room.y}`) || (room.key === '3,0' ? 'picture' : null);
    room.up = rooms.get(`${room.x},${room.y - 1}`) || null;
    room.down = rooms.get(`${room.x},${room.y + 1}`) || null;
  }
  const A = rooms.get('3,0');
  const x = W - BOX[0] - 1;
  return { rooms, season, start: { room: A, x, y: Math.min(...Array.from({ length: BOX[0] }, (_, i) => A.top(x + i))) - BOX[1] } };
}

/** A fresh save: what has been found and done. Kept by world.js until the page is reloaded. */
export const newProgress = () => ({ lantern: false, seed: false, key: false, planted: false, gateOpen: false, letter: false });

/**
 * The creature and the rules. step(dt, { dir, jump, up, down }) moves it one frame and returns
 * what happened: { type: 'room' | 'say' | 'take' | 'plant' | 'open' | 'letter' | 'leave' | 'fall' |
 * 'jump' | 'land', … }. Holding up or down on a rope or the vine climbs it.
 */
export function createGame(world, progress, { from = 'picture' } = {}) {
  const p = { room: world.start.room, x: world.start.x, y: world.start.y, fx: 0, fy: 0, vx: 0, vy: 0, face: -1, ground: true, climbing: false, coyote: 0, buffer: 0, clock: 0, time: 0, auto: from === 'picture' ? -1 : 0 };
  p.entry = { x: p.x, y: p.y };
  const said = {};

  const on = dyn => (dyn.kind === 'vine' ? progress.planted : dyn.kind === 'gate' ? !progress.gateOpen : false);
  const climbsOf = room => [...room.climbs, ...room.dyn.filter(dyn => dyn.climb && on(dyn)).map(dyn => dyn.climb)];
  /** Solid at (X, Y) of a room; past its edges, the neighbouring room decides. */
  function solidAt(room, X, Y) {
    if (X < 0) return room.left ? room.left !== 'picture' && solidAt(room.left, X + W, Y) : true;
    if (X >= W) return room.right ? room.right !== 'picture' && solidAt(room.right, X - W, Y) : true;
    if (Y < 0) return room.up ? solidAt(room.up, X, Y + H) : true;
    if (Y >= H) return room.down ? solidAt(room.down, X, Y - H) : false;
    if (room.solid[Y * W + X]) return true;
    return room.dyn.some(dyn => dyn.rects && on(dyn) && dyn.rects.some(([x, y, w, h]) => X >= x && X < x + w && Y >= y && Y < y + h));
  }
  const hits = (x, y) => {
    for (let dy = 0; dy < BOX[1]; dy++) for (let dx = 0; dx < BOX[0]; dx++) if (solidAt(p.room, x + dx, y + dy)) return true;
    return false;
  };
  const touching = (t, pad = 0) => p.x + BOX[0] > t.x - pad && p.x < t.x + t.w + pad && p.y + BOX[1] > t.y - pad && p.y < t.y + t.h + pad;
  // On a rope: its middle column within the rope's area (a little of it may stick out at the top).
  const onRope = () => climbsOf(p.room).some(([x, y, w, h]) => p.x + 3 >= x && p.x + 3 < x + w && p.y + 4 >= y && p.y < y + h);

  function step(dt, { dir = 0, jump = false, up = false, down = false } = {}) {
    const events = [];
    const say = (text, gap = 5) => { if ((said[text] ?? -99) + gap < p.time) { said[text] = p.time; events.push({ type: 'say', text }); } };
    p.time += dt;
    if (p.auto && p.x <= W - 22) p.auto = 0;
    const move = p.auto || dir;
    const rope = onRope();
    if (!rope) p.climbing = false;
    else if ((up || down) && !p.climbing && !(p.ground && !up)) { p.climbing = true; p.vy = 0; p.fy = 0; }
    if (jump && !(p.climbing && up)) p.buffer = BUFFER;

    // Walking eases in and out; on a rope it is slower.
    const target = move * SPEED * (p.climbing ? 0.5 : 1);
    const rate = (p.ground || p.climbing ? ACCEL : ACCEL * 0.6) * dt;
    p.vx += Math.max(-rate, Math.min(rate, target - p.vx));
    p.fx += p.vx * dt;
    while (Math.abs(p.fx) >= 1) {
      const d = Math.sign(p.fx);
      p.fx -= d;
      if (!hits(p.x + d, p.y)) p.x += d;
      else if (p.ground && !hits(p.x + d, p.y - 1)) { p.x += d; p.y -= 1; }
      else if (p.ground && !hits(p.x + d, p.y - 2)) { p.x += d; p.y -= 2; }
      else { p.fx = 0; p.vx = 0; break; }
    }
    if (move) p.face = move;
    if (p.room.fear !== undefined && !progress.lantern && p.x < p.room.fear) {
      p.x = p.room.fear;
      p.fx = 0;
      p.vx = 0;
      say('……好黑，不敢过去。');
    }

    p.coyote = p.ground || p.climbing ? COYOTE : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP * (p.climbing ? 0.8 : 1); p.buffer = 0; p.coyote = 0; p.climbing = false; events.push({ type: 'jump' }); }
    if (p.climbing) p.vy = (down ? 1 : up ? -1 : 0) * CLIMB;
    else p.vy = Math.min(p.vy + GRAVITY * dt, 220);
    p.fy += p.vy * dt;
    const wasGround = p.ground;
    while (Math.abs(p.fy) >= 1) {
      const d = Math.sign(p.fy);
      p.fy -= d;
      if (!hits(p.x, p.y + d)) p.y += d;
      else { p.vy = 0; p.fy = 0; if (p.climbing && d > 0) p.climbing = false; break; }
    }
    if (p.climbing && up && !onRope()) { p.y += 1; }        // the top of the rope: hold on there
    p.ground = hits(p.x, p.y + 1);
    if (p.ground && !wasGround && !p.climbing) events.push({ type: 'land' });
    p.clock = move && p.ground ? p.clock + dt : 0;

    // Off an edge: the next screen.
    const cx = p.x + BOX[0] / 2;
    const cy = p.y + BOX[1] / 2;
    const dx = cx < 0 ? -1 : cx >= W ? 1 : 0;
    const dy = dx ? 0 : cy < 0 ? -1 : cy >= H ? 1 : 0;
    if (dx || dy) {
      const next = dx < 0 ? p.room.left : dx > 0 ? p.room.right : dy < 0 ? p.room.up : p.room.down;
      if (next === 'picture') { events.push({ type: 'leave' }); return events; }
      if (next) {
        p.room = next;
        p.x -= dx * W;
        p.y -= dy * H;
        p.entry = { x: Math.max(1, Math.min(W - BOX[0] - 1, p.x)), y: p.y };
        events.push({ type: 'room', dx, dy });
      } else if (dy > 0) {                     // fell out of the world: back to where it came in
        Object.assign(p, { x: p.entry.x, y: p.entry.y, fx: 0, fy: 0, vx: 0, vy: 0, climbing: false });
        events.push({ type: 'fall' });
        say('……呼。', 1);
      }
    }

    for (const t of p.room.things) {
      if (t.kind === 'item' && !progress[t.id] && touching(t)) {
        progress[t.id] = true;
        events.push({ type: 'take', id: t.id });
        say({ lantern: '……一盏灯。', seed: '……一颗会发光的种子。', key: '……一把钥匙！' }[t.id], 0);
      } else if (t.kind === 'soil' && !progress.planted && touching(t)) {
        if (progress.seed) { progress.planted = true; events.push({ type: 'plant' }); say('……长出来了！', 0); }
        else say('……这里的土很软。', 8);
      } else if (t.kind === 'gate' && !progress.gateOpen && touching(t, 1)) {
        if (progress.key) { progress.gateOpen = true; events.push({ type: 'open' }); say('咔哒。', 0); }
        else say('……锁着。');
      } else if (t.kind === 'letter' && touching(t, 1)) {
        if (!progress.letter) { progress.letter = true; events.push({ type: 'letter' }); }
      } else if (t.kind === 'friend' && touching(t, 2)) {
        say('……嘘，它在睡觉。', 10);
      } else if (t.kind === 'exit' && touching(t)) {
        events.push({ type: 'exit' });
      }
    }
    return events;
  }

  const nearLetter = () => p.room.things.some(t => t.kind === 'letter' && touching(t, 2));
  return { p, step, hits, nearLetter, onRope };
}
