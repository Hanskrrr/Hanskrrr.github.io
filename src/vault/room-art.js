// The creature's room, drawn as a 128×60 pixel grid. Objects only appear when the
// exhibit has matching content. Pure data (no DOM) so it can be tested.
//   window (intro) · desk + journal + manuscript drawer (serials) · bookshelf · photo frame
//   note board (thoughts) · wall map (timeline)
//   projector + screen (films) · jukebox (music) · rug with the creature
import { poseGrid } from '../terminal/ui/creature.js';

export const ROOM_WIDTH = 128;
export const ROOM_HEIGHT = 60;

/** Clickable areas in room pixels: [x, y, width, height]. */
export const HOTSPOTS = {
  intro: [5, 4, 26, 22],
  journal: [8, 28, 14, 6],
  serials: [8, 36, 22, 8],
  books: [37, 9, 18, 37],
  photos: [57, 5, 17, 17],
  thoughts: [57, 23, 18, 13],
  timeline: [77, 5, 15, 18],
  films: [94, 2, 30, 19],
  music: [106, 22, 18, 24],
  creature: [72, 40, 12, 12],
};
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

export function roomGrid({ journal = true, serials = true, photos = true, thoughts = true, timeline = true, books = true, films = true, music = true } = {}) {
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

  // Desk with a lamp, and the journal when there are private notes.
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

  // Projector screen on the wall, and the projector on a stand throwing a dotted beam.
  if (films) {
    rect(94, 2, 30, 1, 'px-room-edge');
    rect(95, 3, 28, 16, 'px-room-paper');
    rect(98, 5, 22, 12, 'px-sky1');
    rect(98, 12, 22, 5, 'px-far');
    for (let x = 98; x < 120; x++) for (let y = 14 + Math.floor(Math.abs(x - 106) / 3); y < 17; y++) set(x, y, 'px-near');
    [[102, 7], [113, 6], [117, 9]].forEach(([x, y]) => set(x, y, 'px-star'));
    rect(95, 19, 28, 1, 'px-room-edge');
    rect(94, 36, 10, 2, 'px-far');
    rect(95, 34, 8, 2, 'px-far-light');
    rect(102, 34, 2, 2, 'px-window');
    rect(96, 38, 1, 7, 'px-room-wood-dark');
    rect(101, 38, 1, 7, 'px-room-wood-dark');
    for (let i = 1; i < 13; i += 2) set(103 - Math.round(i * 0.2), 33 - i, 'px-window');
  }

  // Jukebox: an arched cabinet with a row of lights, a record window and a grille.
  if (music) {
    for (let y = 22; y < 46; y++) {
      const inset = y < 26 ? [4, 2, 1, 0][y - 22] : 0;
      rect(107 + inset, y, 16 - inset * 2, 1, 'px-roof');
    }
    const lights = ['px-window', 'px-grass-light', 'px-heart', 'px-far-light'];
    for (let x = 110; x < 120; x++) set(x, 24, lights[x % lights.length]);
    rect(110, 27, 10, 7, 'px-room-edge');
    for (let y = 28; y < 33; y++) for (let x = 111; x < 119; x++) if ((x - 114.5) ** 2 + (y - 30) ** 2 <= 6) set(x, y, 'px-room-paper');
    set(114, 30, 'px-room-edge'); set(115, 30, 'px-room-edge');
    rect(109, 36, 12, 7, 'px-far');
    for (let y = 37; y < 42; y += 2) rect(110, y, 10, 1, 'px-far-light');
    rect(107, 45, 16, 1, 'px-room-edge');
  }

  // Rug in the middle.
  for (let y = 46; y <= 56; y++) for (let x = 52; x <= 104; x++) {
    const d = ((x - 78) / 26) ** 2 + ((y - 51) / 5) ** 2;
    if (d <= 1) set(x, y, d > 0.8 ? 'px-room-rug-edge' : (x + y) % 6 === 0 ? 'px-room-rug-dot' : 'px-room-rug');
  }
  return grid;
}
