// Close-ups in the room: "walk up" to the projector screen or the jukebox. The room view is
// scaled so the object lands on a chosen frame of the stage, and the overlays (curtains,
// audience, the CD) are drawn at stage resolution on top. Pure data and markup, no DOM.
import { creatureGrid, ROOM_HEIGHT as H, ROOM_WIDTH as W, SCREEN } from './room-art.js';

export const JUKEBOX = [107, 22, 16, 24];
/** The round window in the jukebox where the record shows. */
export const RECORD_WINDOW = [110, 27, 10, 7];

// Where each close-up puts its object, as fractions of the stage.
const FRAMES = {
  // The screen between the curtains, with room below for a row of seats.
  screen: { object: SCREEN, left: 0.19, top: 0.05, width: 0.62 },
  // The jukebox standing on the right, its title strips on the left.
  jukebox: { object: JUKEBOX, left: 0.62, top: 0.05, height: 0.9 },
};

/**
 * The view for a close-up (null = the whole room): { scale, x, y } moves room fractions
 * (X, Y) to (x + X·scale, y + Y·scale); place(rect) gives a room rect's frame on the stage.
 */
export function closeUp(name) {
  const frame = FRAMES[name];
  let scale = 1, x = 0, y = 0;
  if (frame) {
    const [ox, oy, ow, oh] = frame.object;
    scale = frame.width ? frame.width / (ow / W) : frame.height / (oh / H);
    x = frame.left - (ox / W) * scale;
    y = frame.top - (oy / H) * scale;
  }
  const place = ([rx, ry, rw, rh]) => ({ left: x + (rx / W) * scale, top: y + (ry / H) * scale, width: (rw / W) * scale, height: (rh / H) * scale });
  return { scale, x, y, place, transform: `translate(${(x * 100).toFixed(3)}%, ${(y * 100).toFixed(3)}%) scale(${scale.toFixed(4)})` };
}

const rect = (x, y, w, h, name) => `<rect class="${name}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;

/** Curtains on both sides and a scalloped valance, in stage units (128 × 60). */
export function curtains() {
  // The inner edge is pulled back towards the bottom, like a curtain tied open.
  const edge = y => 24 - Math.floor(((y / H) ** 2) * 7);
  const outline = [[0, 0]];
  for (let y = 0; y < H; y++) outline.push([edge(y), y], [edge(y), y + 1]);
  outline.push([0, H]);
  const folds = Array.from({ length: 24 }, (_, x) => rect(x, 0, 1, H, x % 5 === 0 ? 'c-curtain-light' : x % 5 === 3 ? 'c-curtain-dark' : 'c-curtain')).join('');
  const shadow = Array.from({ length: H }, (_, y) => rect(edge(y) - 2, y, 2, 1, 'c-curtain-dark')).join('');
  const left = `<g id="cinema-curtain" clip-path="url(#cinema-curtain-shape)">${folds}${shadow}</g>`;
  let valance = rect(0, 0, W, 3, 'c-curtain-dark') + rect(0, 3, W, 1, 'c-curtain');
  for (let x = 0; x < W; x += 8) valance += rect(x + 1, 4, 6, 1, 'c-curtain') + rect(x + 2, 5, 4, 1, 'c-curtain-dark');
  return `<svg class="cinema-curtains" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><defs><clipPath id="cinema-curtain-shape"><polygon points="${outline.map(point => point.join(',')).join(' ')}"/></clipPath></defs>${left}<use href="#cinema-curtain" transform="translate(${W} 0) scale(-1 1)"/>${valance}</svg>`;
}

/** A row of seat backs, and the creature watching from the middle seat, seen from behind. */
export function audience() {
  const grid = creatureGrid('idle');
  const cells = [];
  const left = W / 2 - grid[0].length / 2;
  // The antenna tips just reach the bottom edge of the screen.
  const top = 46;
  grid.forEach((row, gy) => row.forEach((cell, gx) => {
    if (!cell) return;
    // The topmost pixel of each column catches the projector light.
    const rim = !grid[gy - 1]?.[gx];
    cells.push(rect(left + gx, top + gy, 1, 1, rim ? 'c-rim' : 'c-silhouette'));
  }));
  const seats = [8, 22, 36, 50, 64, 78, 92, 106, 120].map(x => rect(x - 6, 58, 13, 2, 'c-seat') + rect(x - 5, 57, 11, 1, 'c-seat-top')).join('');
  return `<svg class="cinema-audience" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${cells.join('')}${seats}</svg>`;
}

/** Dust specks drifting up the beam: [left %, top %, delay s, duration s], fixed so it is stable. */
export const DUST = Array.from({ length: 16 }, (_, i) => [34 + ((i * 37) % 32), 40 + ((i * 53) % 55), -((i * 7) % 11), 7 + ((i * 5) % 6)]);
