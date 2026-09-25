// The pixel world west of the homepage picture (world.js plays it): one long strip, as tall as the
// picture and drawn with the picture's own colour classes, so it follows the site style and the
// season. The way runs right to left, away from the picture: meadow → forest (and a big tree) →
// lake → cave → the hill, with the letter on its top. Falling into a gap only sends the creature back to the last lantern.
import { random, SCENE_HEIGHT, seasonOf } from '../blog/pixel-art.js';

export const WIDTH = 2400;
export const HEIGHT = SCENE_HEIGHT;
export const VIEW = 128;                          // columns on screen
export const PARALLAX = { far: 0.3, near: 0.55 };
const PIT = HEIGHT;                               // "no ground here"
const LEAVES = { spring: ['px-blossom', 'px-blossom-light'], summer: ['px-leaf', 'px-leaf-light'], autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'], winter: ['px-snow', 'px-snow'] };

const grid = (width, height = HEIGHT) => Array.from({ length: height }, () => Array(width).fill(''));
const ridge = (peaks, slope) => x => Math.min(...peaks.map(([px, py]) => Math.round(py + Math.abs(x - px) * slope)));

/** Sky for the screen (it stays put): the picture's bands, stars and a moon. */
function sky(next) {
  const cells = grid(VIEW);
  const bands = [[0, 'px-sky0'], [18, 'px-sky1'], [31, 'px-sky2'], [40, 'px-sky3']];
  for (let y = 0; y < HEIGHT; y++) {
    const index = bands.findLastIndex(([start]) => y >= start);
    const after = bands[index + 1];
    for (let x = 0; x < VIEW; x++) cells[y][x] = after && y >= after[0] - 2 && (x + y) % 2 === 0 ? after[1] : bands[index][1];
  }
  const [mx, my, r] = [100, 12, 6];
  for (let y = my - r; y <= my + r; y++) for (let x = mx - r; x <= mx + r; x++) {
    const dx = x - mx;
    const dy = y - my;
    if (dx * dx + dy * dy <= r * r + r) cells[y][x] = dx + dy > 4 ? 'px-moon-shade' : 'px-moon';
  }
  for (let count = 0; count < 40;) {
    const x = Math.floor(next() * VIEW);
    const y = Math.floor(next() * 34);
    if ((x - mx) ** 2 + (y - my) ** 2 < (r + 3) ** 2) continue;
    cells[y][x] = next() < 0.35 ? 'px-star' : 'px-star-dim';
    count++;
  }
  return cells;
}

/** A mountain range as wide as its parallax needs. */
function range(next, factor, [low, high], slope, light, dark) {
  const width = VIEW + Math.ceil((WIDTH - VIEW) * factor);
  const peaks = [];
  for (let x = -20; x < width + 30; x += 18 + Math.floor(next() * 14)) peaks.push([x, low + Math.floor(next() * (high - low))]);
  const top = ridge(peaks, slope);
  const cells = grid(width);
  for (let x = 0; x < width; x++) for (let y = Math.max(0, top(x)); y < HEIGHT; y++) cells[y][x] = y === top(x) || (y === top(x) + 1 && x % 7 === 0) ? light : dark;
  return cells;
}

export function buildWorld({ season = seasonOf() } = {}) {
  const W = WIDTH;
  const H = HEIGHT;
  const next = random(20260925);
  const land = grid(W);
  const solid = new Uint8Array(W * H);
  const paint = (x, y, name) => { if (x >= 0 && x < W && y >= 0 && y < H) land[y][x] = name; };
  const block = (x, y, w, h, name) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const X = x + dx;
      const Y = y + dy;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      land[Y][X] = typeof name === 'function' ? name(X, Y, dy) : name;
      solid[Y * W + X] = 1;
    }
  };
  const [leaf, leafLight] = LEAVES[season] || LEAVES.summer;

  // --- the ground's top row, column by column (PIT: a gap) -------------------------------
  const top = new Array(W).fill(50);
  const span = (from, to, value) => { for (let x = from; x < to; x++) top[x] = typeof value === 'function' ? value(x) : value; };
  const meadow = x => 51 + Math.round(2.5 * Math.sin(x / 8) + 1.5 * Math.sin(x / 3.3 + 1));   // the picture's own
  span(2000, W, x => meadow(x - W));
  span(2180, 2212, 44);                        // a mound
  span(2270, 2279, PIT);                       // a brook
  span(2130, 2141, PIT);                       // a wider one
  span(2058, 2070, 47);
  span(1200, 2000, x => 50 + Math.round(Math.sin(x / 13)));  // forest floor
  span(1780, 1795, PIT);                       // a ditch (one log)
  span(1496, 1531, PIT);                       // the river (logs)
  span(1300, 1366, PIT);                       // the ravine (branches)
  span(800, 1200, PIT);                        // the lake (lily pads, an island)
  span(800, 829, 50);
  span(990, 1020, 52);
  span(400, 800, x => 50 + Math.round(Math.sin(x / 9)));     // cave floor
  span(646, 700, PIT);                         // the chasm (pillars)
  // The hill, climbing towards the letter.
  [[330, 400, 50], [290, 330, 44], [250, 290, 38], [232, 250, PIT], [190, 232, 33], [160, 190, 28], [142, 160, 28], [128, 142, PIT], [120, 128, 28], [80, 120, 24], [0, 80, 19]]
    .forEach(([from, to, value]) => span(from, to, value));

  // --- trees, behind everything: the forest, and one on the hilltop by the letter -----------
  const tree = (x, base, height) => {
    for (let y = base - height; y < base; y++) { paint(x, y, 'px-trunk'); paint(x + 1, y, 'px-trunk'); }
    const cy = base - height;
    for (let dy = -5; dy <= 4; dy++) for (let dx = -5; dx <= 6; dx++) {
      if ((dx - 0.5) ** 2 / 36 + dy ** 2 / 25 > 1) continue;
      paint(x + dx, cy + dy, (dx + dy * 3 + x) % 5 === 0 ? leafLight : leaf);
    }
  };
  for (let x = 1212; x < 1990; x += 18 + Math.floor(next() * 10)) tree(x, top[x] === PIT ? 50 : top[x], 12 + Math.floor(next() * 6));
  tree(14, top[14], 9);

  // --- the cave: rock above, darkness inside ----------------------------------------------
  const ceiling = new Array(W).fill(-1);
  for (let x = 400; x < 800; x++) ceiling[x] = 16 + Math.round(3 * Math.sin(x / 11) + 2 * Math.sin(x / 5));
  for (let x = 520; x < 560; x++) ceiling[x] = 40;                     // a low passage
  for (let x = 400; x < 800; x++) {
    for (let y = ceiling[x] + 1; y < H; y++) paint(x, y, (x * 7 + y * 3) % 23 === 0 ? 'px-far' : 'px-sky0');
    block(x, 0, 1, ceiling[x] + 1, (X, Y) => (Y === ceiling[x] ? 'px-near-light' : 'px-near'));
  }
  // The mountain around the cave: its slopes rise from the forest and fall to the hill.
  for (const x of [...Array(20).keys()].map(i => 399 - i).concat([...Array(20).keys()].map(i => 800 + i))) {
    const peak = x < 400 ? 400 - x : (x - 799) * 2;
    for (let y = peak; y < top[x]; y++) paint(x, y, y === peak ? 'px-near-light' : 'px-near');
  }
  // Crystals in the cave's roof and floor.
  for (let x = 408; x < 796; x += 9 + Math.floor(next() * 12)) {
    const glow = next() < 0.5 ? 'px-window' : 'px-flower-alt';
    paint(x, ceiling[x] + 1, glow);
    paint(x, ceiling[x] + 2, glow);
    if (top[x] !== PIT && next() < 0.5) paint(x + 3, top[x] - 1, glow);
  }

  // --- the ground itself ------------------------------------------------------------------
  for (let x = 0; x < W; x++) {
    if (top[x] === PIT) continue;
    const cave = x >= 400 && x < 800;
    block(x, top[x], 1, H - top[x], (X, Y, dy) => {
      if (cave) return dy === 0 ? 'px-near-light' : 'px-near';
      if (dy === 0) return season === 'winter' ? 'px-snow' : 'px-grass-light';
      // Grass, then darker earth further down (as in the picture), with a pebble here and there.
      if (dy >= 9 && (X * 31 + Y * 17) % 61 === 0) return 'px-far';
      return Y >= 59 || dy >= 8 || ((Y >= 57 || dy >= 6) && (X + Y) % 2 === 0) ? 'px-grass-dark' : 'px-grass';
    });
  }
  // Water in the lake and at the bottom of the meadow's and the forest's gaps.
  for (let x = 800; x < W; x++) {
    if (top[x] !== PIT) continue;
    const surface = x < 1200 ? 57 : 60;
    for (let y = surface; y < H; y++) paint(x, y, y === surface ? ((x + y) % 3 ? 'px-sky1' : 'px-star') : 'px-sky2');
  }
  // Flowers in the meadow.
  // Flowers in the meadow and on the hill.
  const flowers = { spring: 60, summer: 30, autumn: 16, winter: 0 }[season] ?? 30;
  for (let count = 0; count < flowers * 2; count++) {
    const x = count % 2 ? 2000 + Math.floor(next() * 400) : Math.floor(next() * 400);
    if (top[x] !== PIT) paint(x, top[x] + 2 + Math.floor(next() * 4), next() < 0.5 ? 'px-flower' : 'px-flower-alt');
  }

  // --- things to stand on -----------------------------------------------------------------
  const log = (x, y, w) => block(x, y, w, 2, (X, Y, dy) => (dy === 0 ? 'px-roof' : 'px-trunk'));
  const stone = (x, y, w) => block(x, y, w, H - y, (X, Y, dy) => (dy === 0 ? 'px-near-light' : 'px-near'));
  const ledge = (x, y, w) => block(x, y, w, 2, (X, Y, dy) => (dy === 0 ? (season === 'winter' ? 'px-snow' : 'px-grass-light') : 'px-grass'));
  const stump = (x, y, w) => block(x, y, w, top[x] - y, (X, Y, dy) => (dy === 0 ? 'px-roof' : 'px-trunk'));
  stump(1880, 45, 4);
  stump(1565, 44, 5);
  stump(1440, 45, 4);
  log(1785, 46, 5);                            // over the ditch
  // The big tree: up its roots, over the top of its trunk, and down the other side.
  block(1696, 32, 6, top[1696] - 32, 'px-trunk');
  for (let dy = -9; dy <= 2; dy++) for (let dx = -12; dx <= 17; dx++) {
    if ((dx - 2.5) ** 2 / 225 + dy ** 2 / 81 > 1 || (dy >= 0 && dx >= 0 && dx < 6)) continue;
    paint(1696 + dx, 30 + dy, (dx * 3 + dy) % 7 === 0 ? leafLight : leaf);
  }
  stump(1709, 44, 8);                          // its roots, as steps on either side
  stump(1702, 38, 7);
  stump(1689, 38, 7);
  stump(1681, 44, 8);
  log(1517, 47, 7);                            // across the river
  log(1504, 45, 7);
  [[1353, 44], [1338, 40], [1322, 42], [1308, 45]].forEach(([x, y]) => log(x, y, 7));   // branches over the ravine
  log(1180, 50, 20);                           // the pier
  const pad = (x, y, w) => block(x, y, w, 1, 'px-grass-light');
  // Lily pads across the lake, every fourth a stepping stone; an island halfway.
  [[1168, 1020], [978, 830]].forEach(([from, to]) => {
    for (let x = from, i = 0; x > to; x -= 13, i++) {
      const y = [55, 54, 55, 52][i % 4];
      if (i % 4 === 3) stone(x, y, 7); else pad(x, y, 8);
    }
  });
  [[688, 47, 6], [676, 44, 6], [664, 46, 6], [652, 43, 6]].forEach(([x, y, w]) => stone(x, y, w));   // the chasm
  ledge(238, 34, 7);                           // on the hill
  ledge(132, 24, 6);
  block(34, 17, 11, 2, (X, Y, dy) => (dy === 0 ? 'px-near-light' : 'px-near'));   // the letter's rock

  // --- lanterns (where a fall sends you back to) and the letter ----------------------------
  const checkpoints = [2380, 2015, 1790, 1385, 1190, 1005, 790, 612, 405, 180].map(x => ({ x, y: top[x] - 7 }));
  const letter = { x: 35, y: 17 - 6, w: 9, h: 6 };

  return { land, solid, top, sky: sky(next), far: range(next, PARALLAX.far, [24, 34], 0.85, 'px-far-light', 'px-far'), near: range(next, PARALLAX.near, [36, 43], 0.8, 'px-near-light', 'px-near'), checkpoints, letter };
}
