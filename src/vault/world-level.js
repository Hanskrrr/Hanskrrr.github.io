// The world inside the homepage picture (world.js draws it). A handful of screens, each 320×180
// pixels at the picture's own pixel size, joined edge to edge: walk off one side and the next
// screen takes its place. The first screen is the land just west of the picture, drawn with the
// picture's colours, hills and mountains, only wider and taller. Three small things open the way:
//
//                 [G sky ]
//   [E hill]-[D ruins]-[C tree ]-[A well ]-(the picture)
//                      [F roots]-[B below]
//
//   C: climb the old tree for the lantern · A: down the well · B: the dark tunnel needs the lantern
//   F: the glowing seed · C: plant it, a vine grows up the cliff (→ D) and into the sky (G: the key)
//   D: the key opens the gate · E: the letter. A secret sleeps behind a wall in B.
//
// Each screen is a stack of layers (sky, distant range, the picture's mountains, a tree line, the
// land, and grass in front), so world.js can move them a little apart as the creature walks.
// Everything here is plain data and rules (no page), so the level can be checked by a script
// (scripts/check-world.mjs).
import { random, seasonOf } from '../blog/pixel-art.js';

export const W = 320;
export const H = 180;
export const BOX = [6, 5];
export const ITEMS = ['lantern', 'seed', 'key'];
/** How far each layer drifts (per pixel the creature is from the middle of the screen). */
export const PARALLAX = { sky: 0.012, dist: 0.025, hills: 0.05, back: 0.08 };
export const MARGIN = 14;                // extra columns on each side of the drifting layers
const SPEED = 42;                        // pixels per second
const GRAVITY = 420;
const JUMP = 116;                        // about 16 pixels high
const COYOTE = 0.1;
const BUFFER = 0.12;
const PY = 99;                           // picture row y is world row y + PY: the meadow lines up
const LEAVES = { spring: ['px-blossom', 'px-blossom-light'], summer: ['px-leaf', 'px-leaf-light'], autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'], winter: ['px-snow', 'px-snow'] };

// The picture's meadow and mountains (pixel-art.js), carried on to the west.
const meadow = x => PY + 51 + Math.round(2.5 * Math.sin(x / 8) + 1.5 * Math.sin(x / 3.3 + 1));
const ridge = (peaks, slope) => x => Math.min(...peaks.map(([px, py]) => Math.round(py + Math.abs(x - px) * slope)));
const peaksWest = (start, count, step, low, high, seed) => {
  const next = random(seed);
  return Array.from({ length: count }, (_, i) => [start - i * step - Math.floor(next() * step * 0.5), low + Math.floor(next() * (high - low))]);
};
const FAR = ridge([[6, 33], [29, 26], [50, 35], [77, 29], [101, 34], ...peaksWest(-24, 60, 26, 24, 34, 7)].map(([x, y]) => [x, y + PY]), 0.85);
const NEAR = ridge([[-8, 40], [24, 37], [50, 43], [72, 38], [100, 41], ...peaksWest(-36, 60, 30, 36, 43, 11)].map(([x, y]) => [x, y + PY]), 0.8);
const DISTANT = ridge(peaksWest(120, 70, 44, 72, 104, 23), 0.6);

// --- a screen under construction -----------------------------------------------------------
function canvas() {
  const grid = width => Array.from({ length: H }, () => Array(width).fill(''));
  const grids = { sky: grid(W + 2 * MARGIN), dist: grid(W + 2 * MARGIN), hills: grid(W + 2 * MARGIN), back: grid(W + 2 * MARGIN), land: grid(W), fore: grid(W) };
  const solid = new Uint8Array(W * H);
  let layer = 'land';
  const pick = (name, ...args) => (typeof name === 'function' ? name(...args) : name);
  const at = (x, y) => {
    const g = grids[layer];
    const X = g[0].length === W ? x : x + MARGIN;
    return X >= 0 && X < g[0].length && y >= 0 && y < H ? [g, X] : null;
  };
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const c = {
    grids,
    solid,
    /** Draw on this layer from now on (scenery only; block/carve always work on the land). */
    on(name) { layer = name; return c; },
    paint(x, y, name) { const hit = at(x, y); if (hit && name !== undefined) hit[0][y][hit[1]] = name; },
    rect(x, y, w, h, name) { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c.paint(x + dx, y + dy, pick(name, x + dx, y + dy, dy, dx)); },
    block(x, y, w, h, name) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const X = x + dx; const Y = y + dy;
        if (!inside(X, Y)) continue;
        grids.land[Y][X] = pick(name, X, Y, dy, dx);
        solid[Y * W + X] = 1;
      }
    },
    carve(x, y, w, h, name = '') {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const X = x + dx; const Y = y + dy;
        if (!inside(X, Y)) continue;
        grids.land[Y][X] = pick(name, X, Y, dy, dx);
        solid[Y * W + X] = 0;
      }
    },
    isSolid: (x, y) => inside(x, y) && solid[y * W + x] === 1,
  };
  return c;
}

// --- materials --------------------------------------------------------------------------------
/** A fixed pseudo-random number in [0, 1) for a pixel, so textures have no visible stripes. */
const hash = (X, Y, salt = 0) => {
  let h = (X * 374761393 + Y * 668265263 + salt * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const stoneTop = (X, Y, dy) => (dy === 0 ? 'px-near-light' : hash(X, Y, 1) < 0.08 ? 'px-far' : 'px-near');
const wood = (X, Y, dy) => (dy === 0 ? 'px-roof' : (X % 4 === 0 ? 'px-door' : 'px-trunk'));
const hollow = (X, Y) => { const r = hash(X, Y, 2); return r < 0.015 ? 'px-far' : r < 0.04 ? 'px-sky1' : 'px-sky0'; };
/** Rock: seams, specks and a few paler stones, so big walls aren't flat. */
const ROCK = new Set(['px-near', 'px-far', 'px-sky2', 'px-sky1']);
const rock = (X, Y) => {
  // Layers of stone, a little wavy, with cracks, specks and the odd paler stone.
  const band = Math.floor((Y + 3 * Math.sin(X / 17)) / 7);
  const r = hash(X, Y, 3);
  if (hash(Math.floor(X / 3), Math.floor(Y / 2), 4) < 0.03) return 'px-near-light';
  if (r < 0.05) return 'px-far';
  if ((Y + Math.round(3 * Math.sin(X / 17))) % 7 === 0 && hash(Math.floor(X / 5), band, 5) < 0.6) return 'px-sky2';
  return band % 2 && r < 0.35 ? 'px-sky2' : 'px-near';
};
function earth(season) {
  const top = season === 'winter' ? 'px-snow' : 'px-grass-light';
  return (X, Y, dy) => {
    if (dy === 0) return top;
    const r = hash(X, Y, 6);
    if (dy < 3) return r < 0.1 ? 'px-grass-light' : 'px-grass';
    if (dy < 6) return (X + Y) % 2 === 0 ? 'px-grass-dark' : r < 0.3 ? 'px-grass-dark' : 'px-grass';
    if (r < 0.025) return 'px-far';                                        // pebbles
    if (dy < 18 && hash(Math.floor(X / 4), Y, 7) < 0.02) return 'px-trunk';  // old roots
    if (dy > 14 && r > 0.96) return 'px-near';
    return 'px-grass-dark';
  };
}
const cloudRow = (X, Y, dy) => (dy === 0 ? 'px-far-light' : (X + Y) % 3 ? 'px-cloud' : 'px-far');

// --- scenery ----------------------------------------------------------------------------------
/** Sky: the picture's bands (drawn taller), stars, a faint band of the Milky Way, thin clouds. */
function sky(c, next, { high = false } = {}) {
  c.on('sky');
  const bands = high ? [[0, 'px-sky0'], [110, 'px-sky1'], [150, 'px-sky2']] : [[0, 'px-sky0'], [58, 'px-sky1'], [100, 'px-sky2'], [128, 'px-sky3']];
  for (let y = 0; y < H; y++) {
    const index = bands.findLastIndex(([start]) => y >= start);
    const after = bands[index + 1];
    for (let x = -MARGIN; x < W + MARGIN; x++) {
      const dither = after && y >= after[0] - 3 && ((x + y) % 2 === 0 || (y >= after[0] - 1 && x % 2));
      c.paint(x, y, dither ? after[1] : bands[index][1]);
    }
  }
  const tilt = next() * 0.3 - 0.15;
  const band = x => (high ? 60 : 30) + x * tilt;
  for (let x = -MARGIN; x < W + MARGIN; x++) for (let y = 0; y < (high ? 150 : 110); y++) {
    const d = Math.abs(y - band(x));
    if (d < 14 && next() < (14 - d) / 260) c.paint(x, y, 'px-star-dim');
    else if (d < 9 && (x + y) % 5 === 0 && next() < 0.08) c.paint(x, y, 'px-sky1');
  }
  const stars = [];
  for (let i = 0; i < (high ? 150 : 90); i++) {
    const x = Math.floor(next() * W);
    const y = Math.floor(next() * (high ? 150 : 104));
    c.paint(x, y, next() < 0.3 ? 'px-star' : 'px-star-dim');
    if (next() < 0.25) stars.push([x, y]);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(next() * W);
    const y = 8 + Math.floor(next() * (high ? 120 : 70));
    c.paint(x, y, 'px-star');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => c.paint(x + dx, y + dy, 'px-star-dim'));
  }
  for (let i = 0; i < 3; i++) {            // thin clouds, lit along their top
    const x = Math.floor(next() * W);
    const y = 36 + Math.floor(next() * (high ? 110 : 50));
    const w = 18 + Math.floor(next() * 30);
    c.rect(x, y, w, 1, 'px-cloud');
    c.rect(x + 3, y - 1, w - 8, 1, 'px-far');
    c.rect(x + 6, y + 1, w - 14, 1, 'px-cloud');
  }
  c.on('land');
  return stars;
}

/** The distant range (hazy, almost the sky's colour), then the picture's two ranges. */
function mountains(c, gx0) {
  c.on('dist');
  for (let x = -MARGIN; x < W + MARGIN; x++) {
    const top = DISTANT(gx0 + x);
    for (let y = top; y < H; y++) c.paint(x, y, y === top ? 'px-far' : (y === top + 1 && x % 3 === 0) ? 'px-far' : 'px-sky3');
  }
  c.on('hills');
  for (let x = -MARGIN; x < W + MARGIN; x++) {
    const far = FAR(gx0 + x);
    const near = NEAR(gx0 + x);
    for (let y = far; y < H; y++) c.paint(x, y, y === far ? 'px-far-light' : (y - far) % 7 === 3 && x % 5 === 0 ? 'px-far-light' : 'px-far');
    for (let y = near; y < H; y++) c.paint(x, y, y <= near + (x % 7 === 0 ? 1 : 0) ? 'px-near-light' : 'px-near');
  }
  c.on('land');
}

/** A line of small dark trees and bushes on the far edge of the meadow. */
function treeLine(c, next, from, to, base) {
  c.on('back');
  for (let x = from; x < to; x += 5 + Math.floor(next() * 9)) {
    const h = 5 + Math.floor(next() * 9);
    const r = 2 + Math.floor(next() * 3);
    const b = base(x) - 1;
    for (let y = b - h; y <= b; y++) c.paint(x, y, 'px-near');
    for (let dy = -r - 2; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + (dy * 0.7) ** 2 > r * r + 1) continue;
      const edge = dx * dx + ((dy - 1) * 0.7) ** 2 > r * r + 1;   // the rim that faces the sky
      c.paint(x + dx, b - h + dy, edge && dx < 1 ? 'px-grass-dark' : 'px-near');
    }
  }
  c.on('land');
}

/**
 * A crown of leaves: many round clumps inside an ellipse, each lit on its upper left and shaded
 * on its lower right, so it reads as foliage rather than a flat shape.
 */
function crown(c, season, cx, cy, rx, ry, seed) {
  const [leaf, light] = LEAVES[season] || LEAVES.summer;
  const next = random(seed);
  const clumps = [];
  const count = Math.round((rx * ry) / 14);
  for (let i = 0; i < count; i++) {
    const a = next() * Math.PI * 2;
    const d = Math.sqrt(next());
    const r = 3 + Math.floor(next() * Math.min(rx, ry) * 0.45);
    clumps.push([cx + Math.cos(a) * d * (rx - r), cy + Math.sin(a) * d * (ry - r), r]);
  }
  clumps.sort((a, b) => a[1] - b[1]);       // the top clumps first; lower ones overlap them
  for (const [x0, y0, r] of clumps) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dy * dy;
      if (d > r * r + (hash(x0 + dx, y0 + dy, 8) < 0.4 ? r : 0)) continue;
      const lit = dx + dy < -r * 0.6;
      const dark = dx + dy > r * 0.7 || y0 + dy > cy + ry * 0.45;
      const n = hash(Math.round(x0 + dx), Math.round(y0 + dy), 9);
      c.paint(Math.round(x0 + dx), Math.round(y0 + dy), lit ? (n < 0.5 ? light : leaf) : dark ? (n < 0.7 ? 'px-grass-dark' : leaf) : n < 0.12 ? light : leaf);
    }
  }
}

/** A tree with a crown of leaf clumps in the season's colours. */
function tree(c, season, x, base, height, rx, ry, layer = 'back') {
  c.on(layer);
  for (let y = base - height; y < base; y++) {
    c.paint(x, y, 'px-trunk'); c.paint(x + 1, y, 'px-trunk'); c.paint(x + 2, y, y % 5 ? 'px-door' : 'px-trunk');
  }
  c.paint(x - 1, base - 1, 'px-trunk'); c.paint(x + 3, base - 1, 'px-trunk');
  // A few branches reaching into the crown.
  for (let i = 1; i <= 3; i++) { c.paint(x - i, base - height + 4 - i, 'px-trunk'); c.paint(x + 2 + i, base - height + 2 - i, 'px-trunk'); }
  crown(c, season, x + 1, base - height, rx, ry, x * 31 + base);
  c.on('land');
}

/** Grass tufts and flowers in front of the creature, along the ground's top. */
function grassFront(c, next, season, from, to, top) {
  c.on('fore');
  const count = { spring: 26, summer: 20, autumn: 10, winter: 0 }[season] ?? 16;
  for (let x = from; x < to; x++) {
    const t = top(x);
    if (t >= H || !c.isSolid(x, t)) continue;
    const r = next();
    if (season !== 'winter' && r < 0.34) {
      const h = 1 + Math.floor(next() * 3);
      for (let dy = 1; dy <= h; dy++) c.paint(x, t - dy, dy === h ? 'px-grass-light' : 'px-grass');
    } else if (r > 1 - count / 400) {
      c.paint(x, t - 1, 'px-grass'); c.paint(x, t - 2, 'px-grass');
      c.paint(x, t - 3, next() < 0.5 ? 'px-flower' : 'px-flower-alt');
    }
  }
  c.on('land');
}

/** Rock rooms: after carving, light the top edge of every rock under open space. */
function lightEdges(c) {
  const land = c.grids.land;
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    if (c.isSolid(x, y) && !c.isSolid(x, y - 1) && ROCK.has(land[y][x])) land[y][x] = 'px-near-light';
    else if (c.isSolid(x, y) && y + 1 < H && !c.isSolid(x, y + 1) && ROCK.has(land[y][x])) land[y][x] = 'px-sky2';
  }
}

const done = (c, extra) => ({ layers: c.grids, solid: c.solid, things: [], dyn: [], lights: [], dark: false, ...extra });

// --- the screens ------------------------------------------------------------------------------

/** A: just west of the picture. A stone well leads down. */
function roomA(next, season) {
  const c = canvas();
  const gx0 = -W;
  const stars = sky(c, next);
  mountains(c, gx0);
  const top = x => {
    const t = meadow(gx0 + x);
    if (x >= 168 && x <= 216) return 150;
    if (x >= 160 && x < 168) return Math.round(t + ((x - 160) / 8) * (150 - t));
    if (x > 216 && x <= 224) return Math.round(150 + ((x - 216) / 8) * (t - 150));
    return t;
  };
  treeLine(c, next, -MARGIN, W + MARGIN, x => Math.min(top(Math.max(0, Math.min(W - 1, x))), 150) - 2);
  const ground = earth(season);
  for (let x = 0; x < W; x++) if (x < 184 || x > 199) c.block(x, top(x), 1, H - top(x), ground);
  // The well: a stone rim, the roof on two posts, a rope and bucket, and ledges down the shaft.
  c.carve(184, 150, 16, H - 150, hollow);
  for (let y = 150; y < H; y++) { c.paint(183, y, y % 3 ? 'px-near' : 'px-near-light'); c.paint(200, y, y % 3 ? 'px-near-light' : 'px-near'); }
  c.block(180, 148, 4, 2, stoneTop);
  c.block(200, 148, 4, 2, stoneTop);
  c.on('back');
  c.rect(181, 128, 1, 20, 'px-trunk'); c.rect(202, 128, 1, 20, 'px-trunk');
  for (let i = 0; i < 7; i++) c.rect(176 + i * 2, 127 - i, 32 - i * 4, 1, i % 2 ? 'px-door' : 'px-roof');
  c.rect(181, 128, 22, 1, 'px-trunk');
  c.rect(191, 129, 1, 12, 'px-far-light');
  c.rect(189, 141, 5, 3, (X, Y, dy) => (dy === 0 ? 'px-door' : 'px-trunk'));
  c.on('land');
  c.block(184, 170, 4, 2, stoneTop);
  c.block(196, 158, 4, 2, stoneTop);
  // A signpost pointing west, and a few stones.
  c.on('back');
  c.rect(268, top(268) - 12, 1, 12, 'px-trunk');
  c.rect(262, top(268) - 12, 10, 3, (X, Y, dy) => (dy === 1 && X > 263 && X < 270 && X % 2 ? 'px-trunk' : 'px-door'));
  c.paint(261, top(268) - 11, 'px-door');
  c.on('land');
  grassFront(c, next, season, 0, W, top);
  return done(c, { stars, fireflies: { count: 8, area: [0, 110, W, 40] }, mist: 138, top, mood: 'meadow' });
}

/** B: under the well. Moonlight falls down the shaft; a tunnel goes west into the dark. */
function roomB(next) {
  const c = canvas();
  c.block(0, 0, W, H, rock);
  const roof = x => 46 + Math.round(5 * Math.sin(x / 13) + 2 * Math.sin(x / 4));
  c.carve(184, 0, 16, 50, hollow);                                          // the shaft
  for (let x = 100; x <= 290; x++) c.carve(x, roof(x), 1, 166 - roof(x), hollow);   // the chamber
  c.carve(0, 150, 106, 16, hollow);                                         // the tunnel west
  c.carve(295, 150, 25, 16, hollow);                                        // a nook behind…
  c.carve(291, 150, 4, 16, (X, Y) => ((X + Y) % 6 === 0 ? 'px-far' : 'px-near'));   // …a wall that isn't one
  c.block(176, 158, 32, 8, stoneTop);                                       // a mound under the shaft
  [[196, 146], [184, 134], [196, 122], [184, 110], [196, 98], [184, 86], [196, 74], [184, 62], [196, 50], [184, 38], [196, 26], [184, 14], [196, 2]]
    .forEach(([x, y]) => c.block(x, y, 4, 2, stoneTop));
  lightEdges(c);
  // Stalactites, a still pool, pebbles and a few crystals.
  for (let x = 108; x < 286; x += 6 + Math.floor(next() * 10)) {
    if (x > 176 && x < 208) continue;
    const length = 2 + Math.floor(next() * 7);
    for (let dy = 0; dy < length; dy++) c.paint(x, roof(x) + dy, dy === length - 1 ? 'px-far-light' : 'px-near');
  }
  c.carve(226, 162, 40, 4, (X, Y) => (Y === 162 ? ((X * 3) % 7 ? 'px-sky1' : 'px-star') : 'px-sky2'));
  c.block(226, 166, 40, 1, 'px-near');
  [[128, 165], [141, 165], [150, 165], [280, 165], [270, 165]].forEach(([x, y]) => c.paint(x, y, 'px-far-light'));
  [[118, 60], [262, 58], [140, 70]].forEach(([x, y]) => { c.paint(x, y, 'px-window'); c.paint(x + 1, y + 1, 'px-flower-alt'); });
  return done(c, {
    things: [{ kind: 'friend', x: 305, y: 161, w: 6, h: 5 }],
    lights: [...[4, 24, 44, 64, 84, 104, 124, 144, 160].map((y, i) => ({ x: 191 + i * 0.6, y, r: 22 - i * 0.6 })), { x: 246, y: 162, r: 14 }, { x: 118, y: 60, r: 7 }, { x: 262, y: 58, r: 7 }],
    dark: true,
    fear: 120,       // without a light the creature won't go further west than this
    drips: [[150, roof(150)], [236, roof(236)], [270, roof(270)]],
    mood: 'cave',
  });
}

/** C: the old tree (the lantern at the top of its branches), and a cliff too high to climb… until the vine. */
function roomC(next, season) {
  const c = canvas();
  const gx0 = -2 * W;
  const stars = sky(c, next);
  mountains(c, gx0);
  const top = x => {
    if (x < 70) return 70;
    const t = meadow(gx0 + x);
    if (x <= 132) return 150;
    return x <= 140 ? Math.round(150 + ((x - 132) / 8) * (t - 150)) : t;
  };
  treeLine(c, next, 60, W + MARGIN, x => Math.min(top(Math.max(0, Math.min(W - 1, x))), 150) - 2);
  const ground = earth(season);
  // The cliff: grass on top, rock below, with ivy hanging over its face.
  c.block(0, 70, 70, H - 70, (X, Y, dy) => (dy === 0 ? ground(X, Y, 0) : dy < 3 ? 'px-grass' : X === 69 ? 'px-near-light' : rock(X, Y)));
  c.on('back');
  for (let x = 58; x < 70; x += 3) for (let y = 71; y < 71 + 6 + ((x * 7) % 13); y++) c.paint(x + (y % 2), y, (x + y) % 4 ? 'px-grass-dark' : 'px-grass');
  c.on('land');
  for (let x = 70; x < W; x++) c.block(x, top(x), 1, H - top(x), ground);
  // Soft earth at the foot of the cliff, with a dry little stalk.
  for (let x = 74; x <= 100; x++) { c.paint(x, 150, (x % 3) ? 'px-trunk' : 'px-grass-dark'); c.paint(x, 151, 'px-trunk'); c.paint(x, 152, x % 2 ? 'px-trunk' : 'px-grass-dark'); }
  c.on('back'); c.rect(88, 146, 1, 4, 'px-grass-dark'); c.paint(87, 146, 'px-grass-dark'); c.on('land');
  // The old tree: a wide trunk with roots, a great crown, and branches to climb.
  const [leaf, light] = LEAVES[season] || LEAVES.summer;
  c.on('back');
  for (let y = 50; y < 150; y++) for (let x = 197; x <= 208; x++) c.paint(x, y, x === 197 || x === 208 ? 'px-trunk' : (x * 3 + y) % 11 === 0 ? 'px-trunk' : 'px-door');
  [[193, 3], [195, 2], [210, 2], [212, 3], [190, 1], [215, 1]].forEach(([x, h]) => c.rect(x, 150 - h, 2, h, 'px-trunk'));
  // Big boughs from the trunk into the crown, then the crown itself.
  for (let i = 0; i < 26; i++) { c.rect(196 - i, 58 - Math.round(i * 0.6), 3, 2, 'px-trunk'); c.rect(208 + i, 56 - Math.round(i * 0.55), 3, 2, 'px-trunk'); }
  crown(c, season, 203, 38, 64, 34, 4242);
  c.on('land');
  [[180, 138], [205, 126], [180, 114], [205, 102], [180, 90], [205, 78]].forEach(([x, y]) => c.block(x, y, 15, 2, wood));
  c.on('fore');   // a few leaves in front of the branches
  for (let i = 0; i < 40; i++) { const x = 176 + Math.floor(next() * 50); const y = 74 + Math.floor(next() * 66); c.paint(x, y, next() < 0.5 ? leaf : light); }
  c.on('land');
  grassFront(c, next, season, 70, W, top);
  grassFront(c, next, season, 0, 70, top);
  const leaves = [[78, 138], [91, 126], [78, 114], [91, 102], [78, 90], [91, 78], [78, 66], [91, 54], [78, 42], [91, 30], [78, 18], [91, 6]].map(([x, y]) => [x, y, 8, 1]);
  return done(c, {
    stars,
    things: [{ kind: 'item', id: 'lantern', x: 212, y: 73, w: 3, h: 5 }, { kind: 'soil', x: 72, y: 140, w: 32, h: 10 }],
    dyn: [{ kind: 'vine', rects: leaves, stem: [88, 0, 150] }],
    fireflies: { count: 10, area: [100, 90, 220, 60] },
    falling: { from: [150, 20, 110, 50], count: 5 },
    mist: 140,
    top,
    mood: 'meadow',
  });
}

/** F: among the tree's roots, in the dark. The seed glows at the far end. */
function roomF(next) {
  const c = canvas();
  c.block(0, 0, W, H, rock);
  const roof = x => 40 + Math.round(6 * Math.sin(x / 17) + 2 * Math.sin(x / 5));
  for (let x = 20; x <= 250; x++) c.carve(x, roof(x), 1, 166 - roof(x), hollow);
  c.carve(250, 150, 70, 16, hollow);                                        // from B's tunnel
  c.carve(160, 166, 41, H - 166, hollow);                                   // a pit, open below
  c.block(60, 154, 100, 12, stoneTop);                                      // a raised floor
  c.block(186, 160, 7, 2, wood);                                            // roots across the pit
  c.block(170, 158, 7, 2, wood);
  [[46, 142], [60, 130], [46, 118], [60, 106]].forEach(([x, y]) => c.block(x, y, 8, 2, stoneTop));
  c.block(20, 94, 32, 4, stoneTop);                                         // the seed's shelf
  lightEdges(c);
  // Roots hanging from the roof (the old tree above), with little side roots.
  for (let x = 30; x < 246; x += 5 + Math.floor(next() * 8)) {
    const length = 6 + Math.floor(next() * 30);
    for (let dy = 0; dy < length; dy++) {
      const wobble = Math.round(Math.sin((x + dy) / 4));
      c.paint(x + wobble, roof(x) + dy, 'px-trunk');
      if (dy > 3 && (x + dy) % 9 === 0) c.paint(x + wobble + 1, roof(x) + dy + 1, 'px-trunk');
    }
  }
  const mushrooms = [[90, 153], [118, 153], [140, 153], [230, 165], [36, 165], [26, 93], [212, 165]];
  mushrooms.forEach(([x, y]) => { c.paint(x, y, 'px-flower-alt'); c.paint(x - 1, y - 1, 'px-window'); c.paint(x, y - 1, 'px-window'); c.paint(x + 1, y - 1, 'px-window'); });
  return done(c, {
    things: [{ kind: 'item', id: 'seed', x: 30, y: 91, w: 3, h: 3 }],
    lights: [{ x: 31, y: 92, r: 28 }, ...mushrooms.map(([x, y]) => ({ x, y: y - 1, r: 9 }))],
    dark: true,
    spores: { count: 14, area: [20, 40, 230, 120] },
    mood: 'cave',
  });
}

/** G: above the tree, among the clouds. The key lies in a nest. */
function roomG(next) {
  const c = canvas();
  const stars = sky(c, next, { high: true });
  c.on('back');
  for (let x = -MARGIN; x < W + MARGIN; x++) for (let y = 164 + Math.round(3 * Math.sin(x / 9) + Math.sin(x / 3)); y < H; y++) c.paint(x, y, (x + y) % 2 ? 'px-cloud' : 'px-far');
  c.on('land');
  const cloud = (x, y, w) => { c.block(x + 2, y, w - 4, 1, cloudRow); c.block(x, y + 1, w, 2, cloudRow); c.rect(x + 3, y + 3, w - 6, 1, 'px-cloud'); };
  cloud(104, 128, 22);
  cloud(140, 118, 22);
  cloud(176, 108, 22);
  cloud(212, 98, 28);
  c.block(220, 94, 11, 4, (X, Y, dy) => (dy === 0 && X % 2 ? 'px-door' : dy === 3 ? 'px-door' : 'px-trunk'));   // the nest
  const leaves = [[78, 174], [91, 162], [78, 150], [91, 138]].map(([x, y]) => [x, y, 8, 1]);
  return done(c, {
    stars,
    things: [{ kind: 'item', id: 'key', x: 223, y: 90, w: 5, h: 3 }],
    dyn: [{ kind: 'vine', rects: leaves, stem: [88, 136, H], flower: [90, 134] }],
    meteor: true,
    mood: 'sky',
  });
}

/** D: an old stair of ruins down from the cliff, and a gate that needs the key. */
function roomD(next, season) {
  const c = canvas();
  const gx0 = -3 * W;
  const stars = sky(c, next);
  mountains(c, gx0);
  const top = x => (x >= 250 ? 70 : x >= 178 ? 142 - Math.floor((x - 178) / 12) * 12 : 150);
  treeLine(c, next, -MARGIN, 190, () => 148);
  const ground = earth(season);
  c.block(250, 70, 70, H - 70, (X, Y, dy) => (dy === 0 ? ground(X, Y, 0) : dy < 3 ? 'px-grass' : X === 250 ? 'px-near-light' : rock(X, Y)));
  for (let x = 178; x < 250; x += 12) c.block(x, top(x), 12, H - top(x), (X, Y, dy) => (dy === 0 ? 'px-near-light' : X === x ? 'px-far' : stoneTop(X, Y, dy)));
  c.block(0, 150, 178, H - 150, (X, Y, dy) => (dy === 0 ? ((X % 8) ? 'px-far-light' : 'px-far') : dy === 1 ? 'px-far' : (X % 8 === 0 && dy < 5) ? 'px-near' : ground(X, Y, dy + 5)));
  // Ruins: broken columns, a fallen one, an arch without a wall, moss and ivy.
  c.on('back');
  [[84, 112], [112, 124], [140, 104], [160, 132]].forEach(([x, y]) => {
    c.rect(x, y, 5, 150 - y, (X) => (X === x ? 'px-far-light' : X === x + 4 ? 'px-near' : 'px-far'));
    c.rect(x - 1, y, 7, 2, 'px-near-light');
    c.rect(x - 1, 148, 7, 2, 'px-near-light');
    for (let yy = y + 3; yy < 148; yy += 7) c.paint(x + ((yy * 3) % 5), yy, 'px-grass');
  });
  c.rect(96, 145, 14, 5, (X, Y, dy) => (dy === 0 ? 'px-far-light' : (X % 5 === 0 ? 'px-near' : 'px-far')));
  for (let x = 118; x <= 150; x++) { const y = 96 + Math.round(((x - 134) / 16) ** 2 * 8); c.paint(x, y, 'px-near-light'); c.paint(x, y + 1, 'px-far'); }
  // The gate: an arch on two pillars; its bars (drawn by world.js) block the way until opened.
  c.rect(33, 104, 7, 46, (X) => (X === 33 ? 'px-near-light' : stoneTop(X, 0, 1)));
  c.rect(48, 104, 7, 46, (X) => (X === 54 ? 'px-near' : stoneTop(X, 0, 1)));
  c.rect(31, 98, 26, 6, (X, Y, dy) => (dy === 0 ? 'px-near-light' : dy === 5 ? 'px-far' : 'px-near'));
  c.rect(43, 99, 2, 3, 'px-window');
  for (let y = 104; y < 150; y += 5) { c.paint(34 + (y % 3), y, 'px-grass'); c.paint(52 - (y % 3), y + 2, 'px-grass'); }
  c.on('land');
  tree(c, season, 290, 70, 18, 14, 10);
  grassFront(c, next, season, 0, 178, top);
  grassFront(c, next, season, 250, W, top);
  return done(c, {
    stars,
    things: [{ kind: 'gate', x: 40, y: 104, w: 8, h: 46 }],
    dyn: [{ kind: 'gate', rects: [[40, 104, 8, 46]] }],
    fireflies: { count: 6, area: [60, 100, 120, 50] },
    mist: 142,
    top,
    mood: 'meadow',
  });
}

/** E: the hilltop at the end of the way: a great tree, a bench, the moon, and the letter. */
function roomE(next, season) {
  const c = canvas();
  const gx0 = -4 * W;
  const stars = sky(c, next);
  // The moon, low and large, with a soft ring.
  c.on('sky');
  const [mx, my, r] = [244, 50, 15];
  for (let y = my - r - 6; y <= my + r + 6; y++) for (let x = mx - r - 6; x <= mx + r + 6; x++) {
    const d = Math.hypot(x - mx, y - my);
    if (d <= r) c.paint(x, y, x - mx + (y - my) > 8 || (x - mx + (y - my) > 5 && (x + y) % 2) ? 'px-moon-shade' : 'px-moon');
    else if (d <= r + 5 && (x + y) % 3 === 0) c.paint(x, y, 'px-sky1');
  }
  [[-5, -4], [-4, -4], [3, 2], [4, 2], [3, 3], [-7, 4], [6, -7]].forEach(([dx, dy]) => c.paint(mx + dx, my + dy, 'px-moon-shade'));
  c.on('land');
  mountains(c, gx0);
  const top = x => (x >= 280 ? 150 : x >= 200 ? 150 - Math.round((280 - x) * 0.4) : x >= 60 ? 118 + Math.round(((x - 130) / 70) ** 2 * 2) : 120 + Math.round((60 - x) * 0.15));
  treeLine(c, next, 180, W + MARGIN, x => Math.min(top(Math.max(0, Math.min(W - 1, x))), 150) - 2);
  const ground = earth(season);
  for (let x = 0; x < W; x++) c.block(x, top(x), 1, H - top(x), ground);
  tree(c, season, 150, top(150), 30, 26, 16);
  // A bench under the tree, and the letter on its stone.
  c.on('back');
  c.rect(112, 110, 16, 1, 'px-door'); c.rect(112, 112, 16, 1, 'px-door');
  c.rect(113, 113, 1, 5, 'px-trunk'); c.rect(126, 113, 1, 5, 'px-trunk'); c.rect(112, 106, 16, 1, 'px-trunk'); c.rect(113, 107, 1, 3, 'px-trunk'); c.rect(126, 107, 1, 3, 'px-trunk');
  c.on('land');
  c.block(86, 114, 16, 4, stoneTop);
  grassFront(c, next, season, 0, W, top);
  return done(c, {
    stars,
    things: [{ kind: 'letter', x: 90, y: 108, w: 9, h: 6 }],
    fireflies: { count: 16, area: [20, 70, 260, 70] },
    falling: { from: [124, 60, 54, 30], count: 4 },
    mist: 132,
    top,
    mood: 'hill',
  });
}

export function buildWorld({ season = seasonOf() } = {}) {
  const next = random(20260926);
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
 * The creature and the rules. step(dt, { dir, jump }) moves it one frame and returns what
 * happened: { type: 'room' | 'say' | 'take' | 'plant' | 'open' | 'letter' | 'leave' | 'fall', … }.
 */
export function createGame(world, progress, { from = 'picture' } = {}) {
  const p = { room: world.start.room, x: world.start.x, y: world.start.y, fx: 0, fy: 0, vy: 0, face: -1, ground: true, coyote: 0, buffer: 0, clock: 0, time: 0, auto: from === 'picture' ? -1 : 0 };
  p.entry = { x: p.x, y: p.y };
  const said = {};

  const on = dyn => (dyn.kind === 'vine' ? progress.planted : dyn.kind === 'gate' ? !progress.gateOpen : false);
  /** Solid at (X, Y) of a room; past its edges, the neighbouring room decides. */
  function solidAt(room, X, Y) {
    if (X < 0) return room.left ? room.left !== 'picture' && solidAt(room.left, X + W, Y) : true;
    if (X >= W) return room.right ? room.right !== 'picture' && solidAt(room.right, X - W, Y) : true;
    if (Y < 0) return room.up ? solidAt(room.up, X, Y + H) : true;
    if (Y >= H) return room.down ? solidAt(room.down, X, Y - H) : false;
    if (room.solid[Y * W + X]) return true;
    return room.dyn.some(dyn => on(dyn) && dyn.rects.some(([x, y, w, h]) => X >= x && X < x + w && Y >= y && Y < y + h));
  }
  const hits = (x, y) => {
    for (let dy = 0; dy < BOX[1]; dy++) for (let dx = 0; dx < BOX[0]; dx++) if (solidAt(p.room, x + dx, y + dy)) return true;
    return false;
  };
  const touching = (t, pad = 0) => p.x + BOX[0] > t.x - pad && p.x < t.x + t.w + pad && p.y + BOX[1] > t.y - pad && p.y < t.y + t.h + pad;

  function step(dt, { dir = 0, jump = false } = {}) {
    const events = [];
    const say = (text, gap = 5) => { if ((said[text] ?? -99) + gap < p.time) { said[text] = p.time; events.push({ type: 'say', text }); } };
    p.time += dt;
    if (jump) p.buffer = BUFFER;
    if (p.auto && p.x <= W - 24) p.auto = 0;
    const move = p.auto || dir;

    p.fx += move * SPEED * dt;
    while (Math.abs(p.fx) >= 1) {
      const d = Math.sign(p.fx);
      p.fx -= d;
      if (!hits(p.x + d, p.y)) p.x += d;
      else if (p.ground && !hits(p.x + d, p.y - 1)) { p.x += d; p.y -= 1; }
      else if (p.ground && !hits(p.x + d, p.y - 2)) { p.x += d; p.y -= 2; }
      else { p.fx = 0; break; }
    }
    if (move) p.face = move;
    if (p.room.fear !== undefined && !progress.lantern && p.x < p.room.fear) {
      p.x = p.room.fear;
      p.fx = 0;
      say('……好黑，不敢过去。');
    }

    p.coyote = p.ground ? COYOTE : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP; p.buffer = 0; p.coyote = 0; events.push({ type: 'jump' }); }
    p.vy = Math.min(p.vy + GRAVITY * dt, 220);
    p.fy += p.vy * dt;
    const wasGround = p.ground;
    while (Math.abs(p.fy) >= 1) {
      const d = Math.sign(p.fy);
      p.fy -= d;
      if (!hits(p.x, p.y + d)) p.y += d;
      else { p.vy = 0; p.fy = 0; break; }
    }
    p.ground = hits(p.x, p.y + 1);
    if (p.ground && !wasGround) events.push({ type: 'land' });
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
        events.push({ type: 'room' });
      } else if (dy > 0) {                     // fell out of the world: back to where it came in
        Object.assign(p, { x: p.entry.x, y: p.entry.y, fx: 0, fy: 0, vy: 0 });
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
      }
    }
    return events;
  }

  const nearLetter = () => p.room.things.some(t => t.kind === 'letter' && touching(t, 2));
  return { p, step, hits, nearLetter };
}
