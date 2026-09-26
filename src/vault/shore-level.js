// The shore (vault/shore.js draws it): where an address that doesn't exist leads, when it is typed
// from inside the pixel world. Two quiet screens at night: sand, a calm sea washing against rocks,
// and things that aren't there: a door standing alone on the sand, stairs that stop in the air,
// a tower far out at sea with a piece of it floating free. In the far corner, a way out.
// Uses the pixel world's tools and rules (world-level.js).
import { random } from '../blog/pixel-art.js';
import { BOX, H, tools, W } from './world-level.js';

const { canvas, hash, noise, done } = tools;
export const HORIZON = 104;
export const SURFACE = 119;              // the water's surface where it comes up the beach
/** Where waves break on the rocks (screen, x, y), and the slope the foam runs up. */
export const SPLASH = { key: '1,0', x: 212, y: 103 };
export const SHORE = { key: '1,0', from: 150, to: 206 };
/** The way out: its middle, in the far corner of the left screen. */
export const TUNNEL = { key: '0,0', x: 18, y: 106 };

const sand = (X, Y, dy, wet) => {
  const r = hash(X, Y, 200);
  if (dy === 0) return wet ? 'px-far' : 'px-far-light';
  if (r < 0.04) return 'px-sky1';
  if (wet || dy > 6) return (X + Y) % 2 ? 'px-near' : 'px-far';
  return r < 0.5 ? 'px-far' : (X + Y) % 3 ? 'px-far' : 'px-far-light';
};
const stone = (X, Y, rim) => (rim ? 'px-near' : hash(X, Y, 201) < 0.025 ? 'px-sky1' : 'px-sky0');

/** The night: dark above, lighter towards the misty horizon; few stars; the moon behind haze. */
function nightSky(c, next, moon) {
  c.on('sky');
  const bands = [[0, 'px-sky0'], [32, 'px-sky1'], [64, 'px-sky2'], [88, 'px-sky3']];
  for (let y = 0; y < H; y++) {
    const index = bands.findLastIndex(([start]) => y >= start);
    const after = bands[index + 1];
    for (let x = 0; x < W; x++) c.paint(x, y, after && y >= after[0] - 4 && (x + y) % 2 === 0 ? after[1] : bands[index][1]);
  }
  const stars = [];
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(next() * W); const y = Math.floor(next() * 56);
    c.paint(x, y, next() < 0.2 ? 'px-star' : 'px-star-dim');
    if (next() < 0.4) stars.push([x, y]);
  }
  if (moon) {
    const [mx, my, r] = moon;
    for (let y = my - r - 10; y <= my + r + 10; y++) for (let x = mx - r - 10; x <= mx + r + 10; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d <= r) c.paint(x, y, d > r - 2 || (x + y) % 3 === 0 ? 'px-moon-shade' : 'px-moon');
      else if (d <= r + 10 && hash(x, y, 202) < (r + 10 - d) / 22) c.paint(x, y, 'px-sky3');
    }
  }
  // The sea to the horizon, with the moon's path on it.
  c.on('dist');
  for (let y = HORIZON; y < H; y++) for (let x = 0; x < W; x++) {
    let name = y === HORIZON ? 'px-far' : (x * 3 + y * 7) % 23 === 0 && y < HORIZON + 8 ? 'px-far' : 'px-near';
    if (moon && Math.abs(x - moon[0]) < 1 + (y - HORIZON) * 0.3 && (x + y * 3) % 7 === 0 && y % 2 === 0) name = 'px-moon-shade';
    c.paint(x, y, name);
  }
  c.on('land');
  return stars;
}

/** A silhouette standing in the sea, and its broken reflection. */
function reflect(c, x0, x1) {
  c.on('dist');
  for (let y = HORIZON + 1; y < HORIZON + 22; y++) for (let x = x0; x < x1; x++) {
    const src = c.grids.back[HORIZON - (y - HORIZON)]?.[x];
    if (src === 'px-sky0' && (y + x) % 2 === 0 && hash(x, y, 203) < 0.7) c.paint(x + Math.round(Math.sin(y) * 1.5), y, 'px-sky1');
  }
  c.on('land');
}

/** R: where the creature washes up. Sand runs down into the water; the sea breaks on rocks. */
function roomR(next) {
  const c = canvas();
  const stars = nightSky(c, next, [60, 34, 8]);
  // Far out: a tower that shouldn't stand, stepped and offset, a stair winding round it, and a
  // piece of it floating above with nothing holding it up.
  c.on('back');
  const blocks = [[182, 78, 16, 26], [178, 60, 14, 18], [186, 44, 12, 16], [181, 32, 10, 12]];
  blocks.forEach(([x, y, w, h]) => c.rect(x, y, w, h, 'px-sky0'));
  for (let i = 0; i < 18; i++) c.paint(177 + (i % 6) * 4, 96 - i * 3, 'px-sky0');
  c.rect(183, 18, 8, 6, 'px-sky0'); c.rect(185, 16, 4, 2, 'px-sky0');           // the floating piece
  c.paint(189, 50, 'px-sky3');                                                  // one window, barely lit
  c.rect(122, 100, 30, 4, 'px-sky0'); c.rect(128, 97, 16, 3, 'px-sky0');       // a low island
  c.on('land');
  reflect(c, 116, 200);
  // Sand, down into the sea.
  const top = x => (x < 150 ? 118 + Math.round(noise(x, 0, 14, 204) * 2) : Math.min(123, 118 + Math.round((x - 150) / 11)));
  for (let x = 0; x < 222; x++) { const t = top(x); for (let y = t; y < H; y++) c.set(x, y, sand(x, y, y - t, x > 146)); }
  // A headland of rock where the waves break, running on to the edge (nothing to fall behind).
  for (let x = 204; x < W; x++) {
    const t = x < 214 ? 100 + Math.round((214 - x) * 0.9 + noise(x, 0, 4, 205) * 3) : 100 - Math.round((x - 214) * 0.35 - noise(x, 0, 5, 206) * 4);
    for (let y = t; y < H; y++) c.set(x, y, stone(x, y, y === t));
  }
  [[168, 2], [186, 2]].forEach(([x, h]) => { for (let dx = 0; dx < 4; dx++) for (let y = top(x + dx) - h; y < top(x + dx); y++) c.set(x + dx, y, stone(x + dx, y, y === top(x + dx) - h)); });
  // Pebbles and a line of dry seaweed.
  c.on('back');
  for (let x = 6; x < 146; x += 3 + Math.floor(next() * 7)) c.paint(x, top(x) - 1, next() < 0.5 ? 'px-sky1' : 'px-near');
  c.on('land');
  return done(c, { stars, mist: [92, 100], top, mood: 'shore' });
}

/** L: the beach goes on to a dark cliff; a door with no house, stairs to nowhere, and the tunnel. */
function roomL(next) {
  const c = canvas();
  const stars = nightSky(c, next, null);
  c.on('back');
  // An arch far out, half under the sea; islands.
  for (let x = 150; x <= 196; x++) { const y = 70 + Math.round(((x - 173) / 23) ** 2 * 30); for (let dy = 0; dy < 4; dy++) c.paint(x, y + dy, 'px-sky0'); }
  c.rect(148, 96, 6, 8, 'px-sky0'); c.rect(193, 96, 6, 8, 'px-sky0');
  c.rect(40, 99, 40, 5, 'px-sky0'); c.rect(50, 95, 18, 4, 'px-sky0'); c.rect(222, 101, 24, 3, 'px-sky0');
  c.on('land');
  reflect(c, 36, 250);
  // The beach, and the cliff at the end of it.
  const top = x => 118 + Math.round(noise(x + 400, 0, 14, 204) * 2);
  for (let x = 30; x < W; x++) { const t = top(x); for (let y = t; y < H; y++) c.set(x, y, sand(x, y, y - t, false)); }
  const face = y => 34 + Math.round(noise(0, y, 8, 207) * 8 + (y < 30 ? (30 - y) * 0.4 : 0));
  for (let y = 0; y < H; y++) for (let x = 0; x < face(y); x++) c.set(x, y, stone(x, y, x === face(y) - 1));
  // The tunnel: an opening in the foot of the cliff. What is inside isn't drawn in pixels (shore.js).
  for (let y = 90; y < 118; y++) {
    const half = y < 100 ? Math.round(Math.sqrt(Math.max(0, 100 - (y - 100) ** 2)) * 1.3) : 13;
    for (let x = TUNNEL.x - half; x <= Math.max(TUNNEL.x + half, y >= 100 ? face(y) : 0); x++) c.clear(x, y, 'px-sky0');
  }
  for (let x = 0; x < 34; x++) for (let y = 118; y < H; y++) c.set(x, y, stone(x, y, y === 118));
  // A door standing by itself on the sand, a little of another sky showing through it.
  c.on('back');
  const dx0 = 126; const dt = top(dx0 + 6);
  c.rect(dx0, dt - 26, 14, 26, 'px-sky0');
  c.rect(dx0 + 2, dt - 24, 10, 24, (X, Y) => (Y > dt - 6 ? 'px-sky2' : hash(X, Y, 208) < 0.06 ? 'px-star-dim' : 'px-sky3'));
  c.rect(dx0 - 1, dt - 27, 16, 1, 'px-sky0');
  // Stairs that climb and stop in the air.
  const sx0 = 178;
  for (let i = 0; i < 7; i++) c.rect(sx0 + i * 5, top(sx0 + i * 5) - 4 - i * 4, 6, 4 + i * 4, (X, Y) => (Y === top(sx0 + i * 5) - 4 - i * 4 ? 'px-near' : 'px-sky0'));
  // A fallen column in the sand, pebbles.
  c.rect(86, top(86) - 3, 18, 3, (X, Y) => (Y === top(86) - 3 ? 'px-near' : 'px-sky0'));
  c.rect(84, top(86) - 4, 3, 4, 'px-sky0');
  for (let x = 40; x < W - 4; x += 3 + Math.floor(next() * 7)) c.paint(x, top(x) - 1, next() < 0.5 ? 'px-sky1' : 'px-near');
  c.on('land');
  return done(c, { stars, mist: [90, 98], top, things: [{ kind: 'exit', x: TUNNEL.x - 7, y: 100, w: 14, h: 18 }], mood: 'shore' });
}

export function buildShore() {
  const next = random(404);
  const rooms = new Map([['0,0', roomL(next)], ['1,0', roomR(next)]].map(([key, room]) => {
    const [x, y] = key.split(',').map(Number);
    return [key, { ...room, key, x, y }];
  }));
  for (const room of rooms.values()) {
    room.left = rooms.get(`${room.x - 1},${room.y}`) || null;
    room.right = rooms.get(`${room.x + 1},${room.y}`) || null;
    room.up = null;
    room.down = null;
  }
  const R = rooms.get('1,0');
  const x = 146;
  return { rooms, start: { room: R, x, y: Math.min(...Array.from({ length: BOX[0] }, (_, i) => R.top(x + i))) - BOX[1] } };
}
