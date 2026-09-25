// The creature's home, drawn as a 256×60 pixel grid: two rooms side by side, of which the stage
// shows 128 columns at a time (the camera follows the creature). Objects only appear when the
// exhibit has matching content. Pure data (no DOM) so it can be tested.
//   the study (0–123): window (intro) · desk + journal + manuscript drawer (serials) · bookshelf
//     photo frame · note board (thoughts) · wall map (timeline) · rug · the colour switch
//   a doorway (123–133)
//   the living room (133–256): projector + big screen (films) · sofa · jukebox (music) · plant
import { poseGrid } from '../terminal/ui/creature.js';

export const ROOM_WIDTH = 128;      // what the stage shows at once
export const WORLD_WIDTH = 256;     // both rooms
export const ROOM_HEIGHT = 60;
/** Where the creature may wander on its own in each room: [from x, to x] (its left edge). */
export const ROOMS = [[36, 100], [140, 232]];

/** Clickable areas in room pixels: [x, y, width, height]. */
export const HOTSPOTS = {
  intro: [5, 4, 26, 22],
  journal: [8, 28, 14, 6],
  serials: [8, 36, 22, 8],
  books: [37, 9, 18, 37],
  photos: [57, 5, 17, 17],
  thoughts: [57, 23, 18, 13],
  timeline: [77, 5, 15, 18],
  films: [147, 3, 42, 24],
  music: [221, 21, 18, 26],
  creature: [72, 40, 12, 12],
  lamp: [24, 25, 8, 9],
};
/** The projector screen on the wall: where videos play. */
export const SCREEN = [148, 4, 40, 22];
/** The projector on its stand: a second way to reach the films, still clickable while a film
 * plays on the screen (the player takes the clicks there). */
export const PROJECTOR = [193, 31, 15, 15];
/** The wall switch that changes the colour style (not an object with a panel). */
export const SWITCH = [32, 16, 5, 9];
export const CREATURE_AT = [71, 38];
export const CREATURE_KEYS = {
  o: 'px-critter-edge', b: 'px-critter-body', s: 'px-critter-shade', l: 'px-critter-light',
  e: 'px-critter-eye', g: 'px-grass-light', c: 'px-window',
};

/** Creature pose as a grid of room classes (used for the animated layer). */
export function creatureGrid(pose = 'idle') {
  return poseGrid(pose).map(row => row.map(key => CREATURE_KEYS[key] || ''));
}

const SPINES = ['px-roof', 'px-far-light', 'px-grass', 'px-window', 'px-near-light', 'px-room-rug', 'px-heart', 'px-room-paper'];

/** Which depth each clickable object sits at (the wall moves least when you look around). */
export const HOTSPOT_DEPTH = { intro: 'far', photos: 'far', thoughts: 'far', timeline: 'far', films: 'far', creature: 'actor' };

/** The whole room as one grid (the depth layers flattened). */
export function roomGrid(available) {
  const { far, floor, mid } = roomLayers(available);
  return far.map((row, y) => row.map((cell, x) => mid[y][x] || floor[y][x] || cell));
}

/**
 * The room in depth layers, for parallax (room-depth.js): `far` is the wall and what hangs on
 * it (drawn a few rows past the floor line, so a shift never opens a gap), `floor` is the floor
 * and the rug (tilted, so its back edge stays joined to the wall), `mid` is the furniture
 * standing against the wall, `fore` is the dark plant, armchair and sofa at the front of the
 * floor, standing on short legs over their shadows (which lie on the floor).
 */
export function roomLayers({ journal = true, serials = true, photos = true, thoughts = true, timeline = true, books = true, films = true, music = true } = {}) {
  const W = WORLD_WIDTH;
  const H = ROOM_HEIGHT;
  const blank = () => Array.from({ length: H }, () => Array(W).fill(''));
  const layers = { far: blank(), floor: blank(), mid: blank(), fore: blank() };
  let grid = layers.far;
  const into = name => { grid = layers[name]; };
  const set = (x, y, name) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = name; };
  const rect = (x, y, w, h, name) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) set(x + dx, y + dy, name); };
  const frame = (x, y, w, h, name) => { rect(x, y, w, 1, name); rect(x, y + h - 1, w, 1, name); rect(x, y, 1, h, name); rect(x + w - 1, y, 1, h, name); };

  // Wall with a dotted wallpaper (running on behind the floor), then the baseboard and floor.
  rect(0, 0, W, 48, 'px-room-wall');
  for (let y = 4; y < 40; y += 8) for (let x = (y / 8) % 2 ? 8 : 4; x < 123; x += 8) set(x, y, 'px-room-wall-dot');
  // The living room has striped wallpaper, and a string of little lights along the top.
  for (let x = 136; x < W; x += 6) for (let y = 7; y < 40; y += 2) set(x, y, 'px-room-wall-dot');
  rect(134, 2, W - 134, 1, 'px-room-edge');
  for (let x = 136, i = 0; x < W; x += 5, i++) set(x, 3, ['px-window', 'px-heart', 'px-grass-light', 'px-far-light'][i % 4]);
  // The doorway between the rooms: a wooden frame around a darker passage.
  rect(125, 10, 6, 31, 'px-room-floor-line');
  rect(123, 8, 2, 33, 'px-room-wood-dark');
  rect(131, 8, 2, 33, 'px-room-wood-dark');
  rect(123, 8, 10, 2, 'px-room-wood');
  rect(0, 41, W, 1, 'px-room-edge');
  into('floor');
  rect(0, 42, W, H - 42, 'px-room-floor');
  [46, 51, 56].forEach((y, row) => {
    rect(0, y, W, 1, 'px-room-floor-line');
    for (let x = (row * 13) % 24; x < W; x += 24) rect(x, y - 4 < 42 ? 42 : y - 4, 1, 4, 'px-room-floor-line');
  });

  // Window: the sky follows the site theme (night or day).
  into('far');
  rect(6, 5, 24, 20, 'px-sky1');
  rect(6, 15, 24, 10, 'px-sky2');
  for (let y = 8; y <= 14; y++) for (let x = 19; x <= 27; x++) if ((x - 23) ** 2 + (y - 11) ** 2 <= 10) set(x, y, 'px-moon');
  [[9, 8], [13, 12], [10, 19], [26, 20]].forEach(([x, y]) => set(x, y, 'px-star'));
  frame(5, 4, 26, 22, 'px-room-frame');
  rect(17, 5, 2, 20, 'px-room-frame');
  rect(6, 14, 24, 1, 'px-room-frame');
  rect(4, 26, 28, 1, 'px-room-wood');

  // A light switch on the wall beside the window: it changes the site's colours.
  rect(33, 18, 3, 5, 'px-room-frame');
  rect(33, 22, 3, 1, 'px-room-edge');
  rect(34, 19, 1, 2, 'px-window');

  // Desk with a lamp, and the journal when there are private notes.
  into('mid');
  rect(3, 34, 32, 2, 'px-room-wood');
  rect(5, 36, 2, 9, 'px-room-wood-dark');
  rect(31, 36, 2, 9, 'px-room-wood-dark');
  rect(25, 26, 6, 2, 'px-critter-edge');
  rect(27, 28, 1, 5, 'px-room-edge');
  rect(25, 33, 5, 1, 'px-room-edge');
  rect(26, 28, 4, 1, 'px-window');
  if (journal) {
    rect(9, 30, 12, 4, 'px-window');
    rect(9, 30, 1, 4, 'px-room-edge');
    rect(11, 31, 8, 1, 'px-room-line');
    rect(11, 32, 6, 1, 'px-room-line');
  }

  // A drawer under the desk, pulled open to show the manuscripts inside.
  if (serials) {
    rect(9, 36, 20, 5, 'px-room-wood-dark');
    rect(10, 37, 18, 3, 'px-room-wood');
    rect(18, 38, 2, 1, 'px-window');
    rect(10, 41, 18, 2, 'px-room-wood-dark');
    rect(11, 40, 7, 1, 'px-room-paper');
    rect(19, 40, 8, 1, 'px-room-paper');
    rect(12, 39, 5, 1, 'px-room-paper');
  }

  // Bookshelf: four shelves of spines in varied colours and heights.
  if (books) {
    rect(38, 10, 16, 36, 'px-room-wood-dark');
    rect(40, 12, 12, 32, 'px-room-edge');
    [19, 27, 35, 43].forEach((shelf, row) => {
      rect(39, shelf, 14, 1, 'px-room-wood');
      let x = 40;
      let i = row * 3;
      while (x < 52) {
        const width = (i * 7) % 3 === 0 ? 2 : 1;
        const height = 4 + ((i * 5 + row) % 3);
        if ((i * 11 + row) % 9 !== 4) rect(x, shelf - height, Math.min(width, 52 - x), height, SPINES[(i * 3 + row) % SPINES.length]);
        x += width + ((i + row) % 4 === 0 ? 1 : 0);
        i++;
      }
    });
    rect(38, 10, 16, 1, 'px-room-wood');
    rect(38, 44, 16, 2, 'px-room-wood');
  }

  // Picture frame with a tiny landscape, when there are photos.
  into('far');
  if (photos) {
    rect(59, 8, 13, 12, 'px-sky2');
    for (let x = 59; x < 72; x++) for (let y = 13 + Math.floor(Math.abs(x - 64) / 1.5); y < 20; y++) set(x, y, 'px-far');
    rect(59, 17, 13, 3, 'px-grass');
    set(69, 10, 'px-moon');
    frame(58, 7, 15, 14, 'px-roof');
  }

  // Note board for thoughts: small pinned notes on cork.
  if (thoughts) {
    rect(58, 24, 16, 11, 'px-room-wood-dark');
    rect(59, 25, 14, 9, 'px-room-wood');
    [[60, 26, 'px-window'], [65, 27, 'px-grass-light'], [69, 26, 'px-room-paper'], [61, 30, 'px-far-light'], [66, 31, 'px-room-paper'], [70, 30, 'px-window']]
      .forEach(([x, y, color]) => { rect(x, y, 3, 3, color); set(x + 1, y, 'px-heart'); });
  }

  // Wall map for the timeline: a dotted trail between markers.
  if (timeline) {
    rect(79, 7, 12, 14, 'px-room-paper');
    rect(79, 6, 12, 1, 'px-room-edge');
    [[81, 18], [82, 17], [83, 16], [84, 16], [85, 15], [86, 14], [86, 13], [87, 12], [88, 11], [88, 10]].forEach(([x, y], i) => { if (i % 2) set(x, y, 'px-room-line'); });
    [[81, 18], [85, 15], [88, 9]].forEach(([x, y]) => { set(x, y, 'px-heart'); set(x + 1, y, 'px-heart'); });
  }

  // The living room's big screen, and the projector on a stand to its right, beam dotted up to it.
  if (films) {
    into('far');
    rect(147, 3, 42, 1, 'px-room-edge');
    rect(148, 4, 40, 22, 'px-room-paper');
    rect(151, 6, 34, 18, 'px-sky1');
    rect(151, 17, 34, 7, 'px-far');
    for (let x = 151; x < 185; x++) for (let y = 20 + Math.floor(Math.abs(x - 164) / 3); y < 24; y++) set(x, y, 'px-near');
    [[156, 8], [173, 7], [180, 11], [162, 12]].forEach(([x, y]) => set(x, y, 'px-star'));
    rect(148, 26, 40, 1, 'px-room-edge');
    into('mid');
    rect(195, 36, 11, 2, 'px-far');
    rect(197, 34, 8, 2, 'px-far-light');
    rect(195, 34, 2, 2, 'px-window');
    rect(197, 38, 1, 7, 'px-room-wood-dark');
    rect(203, 38, 1, 7, 'px-room-wood-dark');
    for (let i = 1; i < 9; i += 2) set(194 - i, 33 - i, 'px-window');
  }

  // Jukebox: an arched cabinet with a row of lights, a record window and a grille.
  into('mid');
  if (music) {
    const J = 115;   // the jukebox stands at the living room's right wall
    for (let y = 22; y < 46; y++) {
      const inset = y < 26 ? [4, 2, 1, 0][y - 22] : 0;
      rect(J + 107 + inset, y, 16 - inset * 2, 1, 'px-roof');
    }
    const lights = ['px-window', 'px-grass-light', 'px-heart', 'px-far-light'];
    for (let x = 110; x < 120; x++) set(J + x, 24, lights[x % lights.length]);
    rect(J + 110, 27, 10, 7, 'px-room-edge');
    for (let y = 28; y < 33; y++) for (let x = 111; x < 119; x++) if ((x - 114.5) ** 2 + (y - 30) ** 2 <= 6) set(J + x, y, 'px-room-paper');
    set(J + 114, 30, 'px-room-edge'); set(J + 115, 30, 'px-room-edge');
    rect(J + 109, 36, 12, 7, 'px-far');
    for (let y = 37; y < 42; y += 2) rect(J + 110, y, 10, 1, 'px-far-light');
    rect(J + 107, 45, 16, 1, 'px-room-edge');
  }
  // A tall plant in the living room's corner.
  rect(244, 40, 8, 6, 'px-room-wood');
  rect(243, 40, 10, 1, 'px-room-wood-dark');
  [[247, 39, 243, 30], [248, 39, 249, 26], [249, 39, 254, 31], [246, 39, 241, 35], [250, 39, 255, 37]].forEach(([x0, y0, x1, y1]) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), i % 3 ? 'px-grass' : 'px-grass-light');
  });

  // Rug in the middle.
  into('floor');
  for (let y = 46; y <= 56; y++) for (let x = 52; x <= 104; x++) {
    const d = ((x - 78) / 26) ** 2 + ((y - 51) / 5) ** 2;
    if (d <= 1) set(x, y, d > 0.8 ? 'px-room-rug-edge' : (x + y) % 6 === 0 ? 'px-room-rug-dot' : 'px-room-rug');
  }

  // At the front of the floor: a potted plant, the back of an armchair, and the back of the
  // living room's sofa. Each stands on the floor (feet on row 58) over a shadow on the floor.
  into('floor');
  const shadow = (x0, x1) => { rect(x0, 58, x1 - x0, 1, 'px-room-floor-line'); rect(x0 + 2, 59, x1 - x0 - 4, 1, 'px-room-floor-line'); };
  shadow(2, 15);
  shadow(102, 127);
  shadow(144, 196);
  into('fore');
  // Leaves: tapered strokes from the pot, lit along their upper edge.
  const leaf = (x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      const width = t > 0.15 && t < 0.8 ? 1 : 0;
      for (let dy = -width; dy <= width; dy++) set(x, y + dy, 'px-fore');
      set(x, y - width - 1 < y0 - steps ? y : y - width, t > 0.2 && t < 0.9 ? 'px-fore-light' : 'px-fore');
    }
  };
  [[7, 53, 1, 43], [8, 53, 9, 40], [9, 53, 16, 44], [6, 53, 0, 49], [10, 53, 18, 50]].forEach(([x0, y0, x1, y1]) => leaf(x0, y0, x1, y1));
  // The pot: a rim, a body narrowing to its foot.
  rect(3, 54, 11, 1, 'px-fore-light');
  rect(4, 55, 9, 2, 'px-fore');
  rect(5, 57, 7, 2, 'px-fore');
  set(5, 55, 'px-fore-light');
  // The armchair: a rounded back with a cushion seam, its arm in front, on four short legs.
  const chairEnd = 124;   // it stands just left of the doorway
  rect(111, 49, chairEnd - 111, 1, 'px-fore-light');
  rect(109, 50, chairEnd - 109, 1, 'px-fore');
  rect(110, 50, chairEnd - 110, 1, 'px-fore-light');
  rect(108, 51, chairEnd - 108, 6, 'px-fore');
  for (let y = 53; y < 57; y++) set(119, y, 'px-fore-light');
  rect(104, 55, 5, 2, 'px-fore');
  rect(104, 55, 5, 1, 'px-fore-light');
  [105, 109, 115, chairEnd - 2].forEach(x => rect(x, 57, 1, 2, 'px-fore'));
  // The sofa facing the screen: three cushions between two arms, on short legs.
  rect(151, 49, 38, 1, 'px-fore-light');
  rect(150, 50, 40, 7, 'px-fore');
  [163, 176].forEach(x => { for (let y = 51; y < 57; y++) set(x, y, 'px-fore-light'); });
  rect(146, 53, 5, 4, 'px-fore');
  rect(189, 53, 5, 4, 'px-fore');
  rect(146, 53, 5, 1, 'px-fore-light');
  rect(189, 53, 5, 1, 'px-fore-light');
  [147, 160, 179, 192].forEach(x => rect(x, 57, 1, 2, 'px-fore'));
  return layers;
}
