// The creature's room, drawn as a 96×60 pixel grid. Objects only appear when the
// exhibit has matching content. Pure data (no DOM) so it can be tested.
import { poseGrid } from '../terminal/ui/creature.js';

export const ROOM_WIDTH = 96;
export const ROOM_HEIGHT = 60;

/** Clickable areas in room pixels: [x, y, width, height]. */
export const HOTSPOTS = {
  intro: [5, 4, 26, 22],
  journal: [8, 28, 14, 6],
  photos: [37, 6, 18, 16],
  timeline: [59, 5, 14, 18],
  music: [76, 5, 17, 14],
  creature: [52, 40, 12, 12],
};
export const CREATURE_AT = [51, 38];
export const CREATURE_KEYS = {
  o: 'px-critter-edge', b: 'px-critter-body', s: 'px-critter-shade', l: 'px-critter-light',
  e: 'px-critter-eye', g: 'px-grass-light', c: 'px-window',
};

/** Creature pose as a grid of room classes (used for the animated layer). */
export function creatureGrid(pose = 'idle') {
  return poseGrid(pose).map(row => row.map(key => CREATURE_KEYS[key] || ''));
}

export function roomGrid({ journal = true, photos = true, timeline = true, music = true } = {}) {
  const W = ROOM_WIDTH;
  const H = ROOM_HEIGHT;
  const grid = Array.from({ length: H }, () => Array(W).fill(''));
  const set = (x, y, name) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = name; };
  const rect = (x, y, w, h, name) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) set(x + dx, y + dy, name); };
  const frame = (x, y, w, h, name) => { rect(x, y, w, 1, name); rect(x, y + h - 1, w, 1, name); rect(x, y, 1, h, name); rect(x + w - 1, y, 1, h, name); };

  // Wall with a dotted wallpaper, baseboard, and a plank floor.
  rect(0, 0, W, 41, 'px-room-wall');
  for (let y = 4; y < 40; y += 8) for (let x = (y / 8) % 2 ? 8 : 4; x < W; x += 8) set(x, y, 'px-room-wall-dot');
  rect(0, 41, W, 1, 'px-room-edge');
  rect(0, 42, W, H - 42, 'px-room-floor');
  [46, 51, 56].forEach((y, row) => {
    rect(0, y, W, 1, 'px-room-floor-line');
    for (let x = (row * 13) % 24; x < W; x += 24) rect(x, y - 4 < 42 ? 42 : y - 4, 1, 4, 'px-room-floor-line');
  });

  // Window: the sky follows the site theme (night or day).
  rect(6, 5, 24, 20, 'px-sky1');
  rect(6, 15, 24, 10, 'px-sky2');
  for (let y = 8; y <= 14; y++) for (let x = 19; x <= 27; x++) if ((x - 23) ** 2 + (y - 11) ** 2 <= 10) set(x, y, 'px-moon');
  [[9, 8], [13, 12], [10, 19], [26, 20]].forEach(([x, y]) => set(x, y, 'px-star'));
  frame(5, 4, 26, 22, 'px-room-frame');
  rect(17, 5, 2, 20, 'px-room-frame');
  rect(6, 14, 24, 1, 'px-room-frame');
  rect(4, 26, 28, 1, 'px-room-wood');

  // Desk with a lamp, and the journal when there are private articles.
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

  // Picture frame with a tiny landscape, when there are photos.
  if (photos) {
    rect(39, 8, 14, 12, 'px-sky2');
    for (let x = 39; x < 53; x++) for (let y = 13 + Math.floor(Math.abs(x - 44) / 1.5); y < 20; y++) set(x, y, 'px-far');
    rect(39, 17, 14, 3, 'px-grass');
    set(50, 10, 'px-moon');
    frame(38, 7, 16, 14, 'px-roof');
  }

  // Wall map for the timeline: a dotted trail between markers.
  if (timeline) {
    rect(60, 7, 12, 14, 'px-room-paper');
    rect(60, 6, 12, 1, 'px-room-edge');
    [[62, 18], [63, 17], [64, 16], [65, 16], [66, 15], [67, 14], [67, 13], [68, 12], [69, 11], [69, 10]].forEach(([x, y], i) => { if (i % 2) set(x, y, 'px-room-line'); });
    [[62, 18], [66, 15], [69, 9]].forEach(([x, y]) => { set(x, y, 'px-heart'); set(x + 1, y, 'px-heart'); });
  }

  // Shelf with a radio (music) or a small plant.
  rect(76, 19, 17, 1, 'px-room-wood');
  if (music) {
    rect(78, 12, 12, 7, 'px-far');
    for (let y = 13; y < 18; y++) for (let x = 79; x < 84; x++) if ((x + y) % 2) set(x, y, 'px-far-light');
    rect(85, 14, 3, 2, 'px-window');
    set(86, 17, 'px-far-light');
    rect(88, 7, 1, 5, 'px-room-edge');
  } else {
    rect(82, 15, 5, 4, 'px-roof');
    [[83, 12], [84, 11], [85, 12], [82, 13], [86, 13], [84, 13], [84, 14]].forEach(([x, y]) => set(x, y, 'px-leaf'));
  }

  // Rug and a plant in the corner.
  for (let y = 46; y <= 56; y++) for (let x = 36; x <= 80; x++) {
    const d = ((x - 58) / 22) ** 2 + ((y - 51) / 5) ** 2;
    if (d <= 1) set(x, y, d > 0.8 ? 'px-room-rug-edge' : (x + y) % 6 === 0 ? 'px-room-rug-dot' : 'px-room-rug');
  }
  rect(86, 50, 6, 6, 'px-roof');
  [[87, 44], [88, 43], [89, 44], [90, 45], [86, 46], [88, 46], [91, 47], [87, 48], [89, 48], [88, 49], [90, 49]].forEach(([x, y]) => set(x, y, 'px-leaf'));
  [[88, 45], [89, 47], [87, 47]].forEach(([x, y]) => set(x, y, 'px-leaf-light'));
  return grid;
}
