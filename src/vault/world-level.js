// The world inside the homepage picture (world.js draws it). A handful of screens, each exactly
// the picture's size, joined edge to edge: walk off one side and the next screen takes its place.
// The first screen is the land just west of the picture, so its hills, mountains and sky run on
// from the picture's own. Three small things open the way:
//
//                 [G sky ]
//   [E hill]-[D ruins]-[C tree ]-[A well ]-(the picture)
//                      [F roots]-[B below]
//
//   C: climb the tree for the lantern · A: down the well · B: the dark tunnel needs the lantern
//   F: the glowing seed · C: plant it, a vine grows up to the cliff (→ D) and the sky (G: the key)
//   D: the key opens the gate · E: the letter. A secret sleeps behind a wall in B.
//
// Everything here is plain data and rules (no page), so the level can be checked by a script.
import { random, SCENE_HEIGHT, SCENE_WIDTH, seasonOf } from '../blog/pixel-art.js';

export const W = SCENE_WIDTH;
export const H = SCENE_HEIGHT;
export const BOX = [6, 5];
export const ITEMS = ['lantern', 'seed', 'key'];
const SPEED = 26;        // pixels per second
const GRAVITY = 260;
const JUMP = 74;         // about 10 pixels high
const COYOTE = 0.1;      // a jump still counts this long after walking off an edge
const BUFFER = 0.12;     // and this long before landing
const LEAVES = { spring: ['px-blossom', 'px-blossom-light'], summer: ['px-leaf', 'px-leaf-light'], autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'], winter: ['px-snow', 'px-snow'] };

// The picture's meadow and mountain ridges (pixel-art.js), carried on to the west. The added peaks
// lie far enough west that they change nothing inside the picture.
const meadow = x => 51 + Math.round(2.5 * Math.sin(x / 8) + 1.5 * Math.sin(x / 3.3 + 1));
const ridge = (peaks, slope) => x => Math.min(...peaks.map(([px, py]) => Math.round(py + Math.abs(x - px) * slope)));
const FAR = ridge([[6, 33], [29, 26], [50, 35], [77, 29], [101, 34], [-24, 31], [-52, 27], [-80, 33], [-108, 28], [-136, 32], [-165, 26], [-196, 31], [-226, 29], [-258, 34], [-290, 27], [-320, 32], [-352, 28], [-384, 31]], 0.85);
const NEAR = ridge([[-8, 40], [24, 37], [50, 43], [72, 38], [100, 41], [-38, 39], [-66, 42], [-95, 38], [-124, 41], [-150, 37], [-180, 42], [-212, 38], [-240, 41], [-270, 39], [-300, 42], [-330, 38], [-360, 40]], 0.8);

function canvas() {
  const cells = Array.from({ length: H }, () => Array(W).fill(''));
  const solid = new Uint8Array(W * H);
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const each = (x, y, w, h, fn) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inside(x + dx, y + dy)) fn(x + dx, y + dy, dy, dx); };
  const pick = (name, ...args) => (typeof name === 'function' ? name(...args) : name);
  return {
    cells,
    solid,
    /** Scenery: drawn, not solid. */
    paint: (x, y, name) => { if (inside(x, y)) cells[y][x] = name; },
    rect: (x, y, w, h, name) => each(x, y, w, h, (X, Y, dy, dx) => { cells[Y][X] = pick(name, X, Y, dy, dx); }),
    /** Ground and platforms: drawn and solid. */
    block: (x, y, w, h, name) => each(x, y, w, h, (X, Y, dy, dx) => { cells[Y][X] = pick(name, X, Y, dy, dx); solid[Y * W + X] = 1; }),
    /** Open space dug out of rock. */
    carve: (x, y, w, h, name = '') => each(x, y, w, h, (X, Y, dy, dx) => { cells[Y][X] = pick(name, X, Y, dy, dx); solid[Y * W + X] = 0; }),
    isSolid: (x, y) => inside(x, y) && solid[y * W + x] === 1,
  };
}

// --- materials --------------------------------------------------------------------------------
const stone = (X, Y, dy) => (dy === 0 ? 'px-near-light' : 'px-near');
const wood = (X, Y, dy) => (dy === 0 ? 'px-roof' : 'px-trunk');
const cave = (X, Y) => ((X * 7 + Y * 13) % 41 === 0 ? 'px-far' : 'px-sky0');
/** Rock: a few darker seams and specks, so big walls aren't flat. */
const ROCK = new Set(['px-near', 'px-far', 'px-sky2']);
const rock = (X, Y) => ((X * 13 + Y * 29) % 37 === 0 ? 'px-far' : Y % 9 === 4 && (X * 3 + Y) % 11 < 4 ? 'px-sky2' : 'px-near');
function earth(season) {
  const top = season === 'winter' ? 'px-snow' : 'px-grass-light';
  // Grass, then darker earth further down (as in the picture), with a stone here and there.
  return (X, Y, dy) => {
    if (dy === 0) return top;
    if (dy >= 9 && (X * 31 + Y * 17) % 53 === 0) return 'px-far';
    return Y >= 59 || dy >= 8 || ((Y >= 57 || dy >= 6) && (X + Y) % 2 === 0) ? 'px-grass-dark' : 'px-grass';
  };
}

/** The night sky (the picture's bands and stars) and, for screens at ground level, its mountains. */
function sky(c, next, gx0, { mountains = true, stars = 26 } = {}) {
  const bands = mountains ? [[0, 'px-sky0'], [18, 'px-sky1'], [31, 'px-sky2'], [40, 'px-sky3']] : [[0, 'px-sky0'], [34, 'px-sky1'], [54, 'px-sky2']];
  for (let y = 0; y < H; y++) {
    const index = bands.findLastIndex(([start]) => y >= start);
    const after = bands[index + 1];
    for (let x = 0; x < W; x++) c.paint(x, y, after && y >= after[0] - 2 && (x + y) % 2 === 0 ? after[1] : bands[index][1]);
  }
  for (let i = 0; i < stars; i++) c.paint(Math.floor(next() * W), Math.floor(next() * (mountains ? 34 : 56)), next() < 0.35 ? 'px-star' : 'px-star-dim');
  if (!mountains) return;
  for (let x = 0; x < W; x++) {
    const far = FAR(gx0 + x);
    const near = NEAR(gx0 + x);
    for (let y = Math.max(0, far); y < H; y++) c.paint(x, y, y === far ? 'px-far-light' : 'px-far');
    for (let y = Math.max(0, near); y < H; y++) c.paint(x, y, y <= near + (x % 7 === 0 ? 1 : 0) ? 'px-near-light' : 'px-near');
  }
}

function tree(c, season, x, base, height, radius = 6) {
  const [leaf, light] = LEAVES[season] || LEAVES.summer;
  for (let y = base - height; y < base; y++) { c.paint(x, y, 'px-trunk'); c.paint(x + 1, y, 'px-trunk'); }
  const cy = base - height;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius - 1; dx <= radius + 2; dx++) {
    if ((dx - 0.5) ** 2 / (radius + 1) ** 2 + dy ** 2 / radius ** 2 > 1) continue;
    c.paint(x + dx, cy + dy, (dx * 3 + dy * 5 + x) % 7 === 0 ? light : leaf);
  }
}

function flowers(c, next, season, from, to, top) {
  const count = { spring: 9, summer: 6, autumn: 3, winter: 0 }[season] ?? 5;
  for (let i = 0; i < count; i++) {
    const x = from + Math.floor(next() * (to - from));
    c.paint(x, top(x) + 2 + Math.floor(next() * 4), next() < 0.5 ? 'px-flower' : 'px-flower-alt');
  }
  for (let x = from + 2; x < to; x += 5 + Math.floor(next() * 7)) if (season !== 'winter') c.paint(x, top(x) - 1, 'px-grass-light');   // tufts
}

/** Rock rooms: after carving, light the top edge of every rock under open space. */
function lightEdges(c) {
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    if (c.isSolid(x, y) && !c.isSolid(x, y - 1) && ROCK.has(c.cells[y][x])) c.cells[y][x] = 'px-near-light';
  }
}

// --- the screens ------------------------------------------------------------------------------
// Each returns { cells, solid, things, dyn, lights, dark, fear }. things: items and triggers
// ({ kind, x, y, w, h }); dyn: solids that come and go (the vine, the gate).

/** A: just west of the picture. A well leads down. */
function roomA(next, season) {
  const c = canvas();
  const gx0 = -W;
  sky(c, next, gx0);
  const top = x => {
    const t = meadow(gx0 + x);
    if (x >= 54 && x <= 75) return 51;
    return (x >= 50 && x < 54) || (x > 75 && x <= 79) ? Math.round((t + 51) / 2) : t;
  };
  const ground = earth(season);
  for (let x = 0; x < W; x++) if (x < 58 || x > 71) c.block(x, top(x), 1, H - top(x), ground);
  // The well: a stone rim, a little roof with a rope, stones lining the shaft, and ledges inside.
  c.rect(58, 51, 14, H - 51, cave);                              // dark inside
  for (let y = 51; y < H; y++) { c.paint(57, y, y % 3 ? 'px-near' : 'px-near-light'); c.paint(72, y, y % 3 ? 'px-near-light' : 'px-near'); }
  c.block(56, 48, 2, 3, stone);
  c.block(72, 48, 2, 3, stone);
  c.rect(56, 40, 1, 8, 'px-trunk');
  c.rect(73, 40, 1, 8, 'px-trunk');
  for (let i = 0; i < 5; i++) c.rect(54 + i, 39 - i, 20 - i * 2, 1, i % 2 ? 'px-door' : 'px-roof');
  c.rect(64, 40, 1, 6, 'px-far-light');
  c.rect(63, 46, 3, 2, 'px-trunk');
  c.block(58, 60, 3, 2, stone);
  c.block(69, 53, 3, 2, stone);
  flowers(c, next, season, 2, 54, top);
  flowers(c, next, season, 76, 94, top);
  return { cells: c.cells, solid: c.solid, things: [], dyn: [], lights: [], dark: false, top };
}

/** B: under the well. Moonlight falls down the shaft; a tunnel goes west into the dark. */
function roomB() {
  const c = canvas();
  c.block(0, 0, W, H, rock);
  const roof = x => 22 + Math.round(3 * Math.sin(x / 7) + Math.sin(x / 3));
  c.carve(58, 0, 14, 24, cave);                                  // the shaft
  for (let x = 30; x <= 84; x++) c.carve(x, roof(x), 1, 56 - roof(x), cave);   // the chamber
  c.carve(0, 46, 34, 10, cave);                                  // the tunnel west
  c.carve(88, 46, 8, 10, cave);                                  // a nook behind…
  c.carve(85, 46, 3, 10, (X, Y) => ((X + Y) % 5 === 0 ? 'px-far' : 'px-near'));  // …a wall that isn't one
  c.block(60, 52, 16, 4, stone);                                 // a mound under the shaft
  [[69, 3], [58, 10], [69, 17], [58, 24], [69, 31], [58, 38], [69, 45]].forEach(([x, y]) => c.block(x, y, 3, 2, stone));
  lightEdges(c);
  c.rect(77, 53, 8, 3, (X, Y) => (Y === 53 ? ((X + Y) % 3 ? 'px-sky1' : 'px-star') : 'px-sky2'));   // a puddle
  [[40, 55], [47, 55], [51, 55], [80, 52]].forEach(([x, y]) => c.paint(x, y, 'px-far-light'));      // pebbles
  return {
    cells: c.cells,
    solid: c.solid,
    things: [{ kind: 'friend', x: 89, y: 51, w: 6, h: 5 }],
    dyn: [],
    lights: [{ x: 65, y: 2, r: 15 }, { x: 65, y: 15, r: 14 }, { x: 66, y: 28, r: 13 }, { x: 67, y: 41, r: 12 }, { x: 68, y: 52, r: 10 }, { x: 79, y: 54, r: 5 }],   // moonlight down the shaft
    dark: true,
    fear: 36,      // without a light the creature won't go further west than this
  };
}

/** C: the old tree (the lantern in its branches), and a cliff too high to climb… until the vine. */
function roomC(next, season) {
  const c = canvas();
  const gx0 = -2 * W;
  sky(c, next, gx0);
  const top = x => {
    if (x <= 22) return 20;
    const t = meadow(gx0 + x);
    if (x <= 40) return 51;
    return x <= 44 ? Math.round((t + 51) / 2) : t;
  };
  const ground = earth(season);
  // The cliff: grass on top, then rock with a few streaks.
  c.block(0, 20, 23, H - 20, (X, Y, dy) => (dy === 0 ? ground(X, Y, 0) : dy < 3 ? 'px-grass' : X === 22 ? 'px-near-light' : rock(X, Y)));
  for (let x = 23; x < W; x++) c.block(x, top(x), 1, H - top(x), ground);
  // Soft earth at the foot of the cliff, with a dry little stalk.
  for (let x = 25; x <= 38; x++) { c.paint(x, 51, (x % 3) ? 'px-trunk' : 'px-grass-dark'); c.paint(x, 52, 'px-trunk'); }
  c.paint(32, 50, 'px-grass-dark');
  // The old tree: a trunk with roots, a wide crown, and branches to climb.
  for (let y = 14; y < top(53); y++) for (let x = 50; x <= 55; x++) c.paint(x, y, x === 50 || (x + y) % 6 === 0 ? 'px-door' : 'px-trunk');
  [[48, 1], [49, 0], [56, 0], [57, 1]].forEach(([x, dy]) => c.paint(x, top(x) - 1 + dy, 'px-trunk'));
  const [leaf, light] = LEAVES[season] || LEAVES.summer;
  for (let y = 2; y <= 22; y++) for (let x = 34; x <= 74; x++) {
    const d = ((x - 54) / 20) ** 2 + ((y - 12) / 10) ** 2;
    if (d <= 1 && !(d > 0.8 && (x * 7 + y) % 3 === 0)) c.paint(x, y, (x * 3 + y * 5) % 7 === 0 ? light : leaf);
  }
  [[40, 44, 8], [58, 37, 9], [44, 30, 8], [58, 23, 8]].forEach(([x, y, w]) => c.block(x, y, w, 2, wood));
  flowers(c, next, season, 60, 94, top);
  const leaves = [[25, 45], [35, 38], [25, 31], [35, 24], [25, 17], [35, 10], [25, 3]].map(([x, y]) => [x, y, 5, 1]);
  return {
    cells: c.cells,
    solid: c.solid,
    things: [{ kind: 'item', id: 'lantern', x: 61, y: 19, w: 3, h: 4 }, { kind: 'soil', x: 24, y: 44, w: 15, h: 7 }],
    dyn: [{ kind: 'vine', rects: leaves, stem: [32, 0, 51] }],
    lights: [],
    dark: false,
    top,
  };
}

/** F: among the tree's roots, in the dark. The seed glows at the far end. */
function roomF(next) {
  const c = canvas();
  c.block(0, 0, W, H, rock);
  const roof = x => 18 + Math.round(3 * Math.sin(x / 6) + Math.sin(x / 2.5));
  for (let x = 4; x <= 79; x++) c.carve(x, roof(x), 1, 56 - roof(x), cave);
  c.carve(80, 46, 16, 10, cave);                                 // from B's tunnel
  c.carve(48, 56, 14, 8, cave);                                  // a pit, open below
  c.block(26, 52, 22, 12, stone);
  c.block(53, 50, 5, 2, wood);                                   // a root across the pit
  c.block(15, 45, 6, 2, stone);                                  // steps up to…
  c.block(27, 38, 6, 2, stone);
  c.block(6, 31, 12, 3, stone);                                  // …the seed's shelf
  lightEdges(c);
  // Roots hanging from the roof, and a few glowing mushrooms.
  for (let x = 10; x < 78; x += 5 + Math.floor(next() * 5)) {
    const length = 3 + Math.floor(next() * 8);
    for (let y = roof(x); y < roof(x) + length; y++) c.paint(x, y, 'px-trunk');
  }
  const mushrooms = [[36, 51], [44, 51], [66, 55], [20, 55], [7, 30]];
  mushrooms.forEach(([x, y]) => { c.paint(x, y, 'px-flower-alt'); c.paint(x, y - 1, 'px-window'); });
  return {
    cells: c.cells,
    solid: c.solid,
    things: [{ kind: 'item', id: 'seed', x: 11, y: 28, w: 3, h: 3 }],
    dyn: [],
    lights: [{ x: 12, y: 29, r: 11 }, ...mushrooms.map(([x, y]) => ({ x, y: y - 1, r: 4 }))],
    dark: true,
  };
}

/** G: above the tree, among the clouds. The key lies in a nest. */
function roomG(next) {
  const c = canvas();
  sky(c, next, 0, { mountains: false, stars: 60 });
  for (let x = 0; x < W; x++) for (let y = 58 + Math.round(1.5 * Math.sin(x / 5)); y < H; y++) c.paint(x, y, (x + y) % 2 ? 'px-cloud' : 'px-sky2');
  const cloud = (x, y, w) => { c.block(x + 1, y, w - 2, 1, 'px-far-light'); c.block(x, y + 1, w, 1, 'px-cloud'); c.rect(x + 2, y + 2, w - 4, 1, 'px-cloud'); };
  cloud(40, 40, 10);
  cloud(56, 34, 10);
  cloud(72, 28, 12);
  c.block(75, 26, 7, 2, (X, Y, dy) => (dy === 0 && X % 2 ? 'px-door' : 'px-trunk'));   // the nest
  const leaves = [[35, 60], [25, 53], [35, 46]].map(([x, y]) => [x, y, 5, 1]);
  return {
    cells: c.cells,
    solid: c.solid,
    things: [{ kind: 'item', id: 'key', x: 77, y: 23, w: 5, h: 3 }],
    dyn: [{ kind: 'vine', rects: leaves, stem: [32, 44, H], flower: [33, 43] }],
    lights: [],
    dark: false,
  };
}

/** D: old ruins below the cliff, and a gate that needs the key. */
function roomD(next, season) {
  const c = canvas();
  const gx0 = -3 * W;
  sky(c, next, gx0);
  const top = x => (x >= 70 ? 20 : x >= 60 ? 28 : x >= 50 ? 35 : 42);
  const ground = earth(season);
  c.block(70, 20, 26, H - 20, (X, Y, dy) => (dy === 0 ? ground(X, Y, 0) : dy < 3 ? 'px-grass' : X === 70 ? 'px-near-light' : rock(X, Y)));
  c.block(60, 28, 10, H - 28, (X, Y, dy) => (dy === 0 ? 'px-near-light' : rock(X, Y)));
  c.block(50, 35, 10, H - 35, (X, Y, dy) => (dy === 0 ? 'px-near-light' : rock(X, Y)));
  c.block(0, 42, 50, H - 42, (X, Y, dy) => (dy === 0 ? ((X % 6) ? 'px-far-light' : 'px-far') : (X + Y * 3) % 11 === 0 ? 'px-far' : 'px-near'));
  // Broken columns and a fallen one, moss on the stones.
  [[28, 30], [40, 33]].forEach(([x, y]) => { c.rect(x, y, 3, 42 - y, (X) => (X === x ? 'px-far-light' : 'px-far')); c.rect(x - 1, y, 5, 1, 'px-near-light'); });
  c.rect(32, 40, 6, 2, (X, Y) => (Y === 40 ? 'px-far-light' : 'px-far'));
  [[51, 35], [55, 35], [62, 28], [66, 28], [3, 42], [24, 42], [45, 42]].forEach(([x, y]) => c.paint(x, y - 1, 'px-grass-light'));
  // The gate: an arch on two pillars; its bars (world.js) block the way until opened.
  c.rect(11, 18, 3, 24, stone);
  c.rect(19, 18, 3, 24, stone);
  c.rect(10, 15, 13, 3, (X, Y, dy) => (dy === 0 ? 'px-near-light' : 'px-near'));
  c.paint(16, 16, 'px-window');
  tree(c, season, 84, 20, 8, 5);
  return {
    cells: c.cells,
    solid: c.solid,
    things: [{ kind: 'gate', x: 14, y: 22, w: 5, h: 20 }],
    dyn: [{ kind: 'gate', rects: [[14, 18, 5, 24]] }],
    lights: [],
    dark: false,
    top,
  };
}

/** E: the hilltop at the end of the way, with the letter. */
function roomE(next, season) {
  const c = canvas();
  const gx0 = -4 * W;
  sky(c, next, gx0, { stars: 40 });
  const top = x => (x >= 70 ? 42 : x >= 50 ? 42 - Math.round((70 - x) / 2) : x >= 12 ? 32 : 35);
  const ground = earth(season);
  for (let x = 0; x < W; x++) c.block(x, top(x), 1, H - top(x), ground);
  tree(c, season, 18, 32, 9, 6);
  c.block(32, 30, 11, 2, stone);                                 // the letter's stone
  flowers(c, next, season, 44, 94, top);
  return {
    cells: c.cells,
    solid: c.solid,
    things: [{ kind: 'letter', x: 33, y: 24, w: 9, h: 6 }],
    dyn: [],
    lights: [],
    dark: false,
    fireflies: [[26, 22], [48, 26], [60, 30], [8, 24], [70, 34], [40, 18]],
    top,
  };
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
  return { rooms, start: { room: A, x, y: Math.min(...Array.from({ length: BOX[0] }, (_, i) => A.top(x + i))) - BOX[1] } };
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
    if (p.auto && p.x <= W - 16) p.auto = 0;
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
    if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP; p.buffer = 0; p.coyote = 0; }
    p.vy = Math.min(p.vy + GRAVITY * dt, 160);
    p.fy += p.vy * dt;
    while (Math.abs(p.fy) >= 1) {
      const d = Math.sign(p.fy);
      p.fy -= d;
      if (!hits(p.x, p.y + d)) p.y += d;
      else { p.vy = 0; p.fy = 0; break; }
    }
    p.ground = hits(p.x, p.y + 1);
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
