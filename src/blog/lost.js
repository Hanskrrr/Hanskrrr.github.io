// The 404 page: a quiet night sea. Wait about ten seconds and a whale leaps out of the
// water; catch it (click it while it is in the air) and you land in the terminal.
// With reduced motion the whale just surfaces for a few seconds instead of leaping.
import { gridToPaths, svg, sprite } from './pixel-art.js';

const W = 48;
const H = 24;
const SEA = 15;            // first row of water
const TICK = 125;
const WAIT = 80;           // ticks before the first leap (10 s)
const AGAIN = 96;          // ticks between leaps after that (12 s)
const LEAP = 16;           // ticks the whale spends in the air
const WHALE_KEYS = { o: 'px-near-light', b: 'px-room-paper', e: 'px-sky0' };
// Facing right, tail flicked up behind it.
const WHALE = sprite([
  'o...........',
  'oo...ooooo..',
  '.oooooooooo.',
  '..oooooooeoo',
  '..obbbbbbbbo',
  '....bbbbbb..',
], WHALE_KEYS);

function background() {
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, () =>
    y < 6 ? 'px-sky0' : y < 11 ? 'px-sky1' : y < SEA ? 'px-sky2' : y < SEA + 3 ? 'px-near' : 'px-far'));
  [[4, 3], [13, 6], [22, 2], [31, 5], [40, 3], [45, 8], [8, 10], [27, 9]].forEach(([x, y], i) => { grid[y][x] = i % 3 ? 'px-star-dim' : 'px-star'; });
  for (let y = 2; y <= 6; y++) for (let x = 35; x <= 41; x++) if ((x - 38) ** 2 + (y - 4) ** 2 <= 5) grid[y][x] = 'px-moon';
  // The moon's path on the water.
  for (let y = SEA + 1; y < H; y += 2) for (let x = 37 - (y - SEA) / 4; x <= 39 + (y - SEA) / 4; x += 3) grid[y][Math.round(x + (y % 4 ? 1 : 0))] = 'px-moon-shade';
  return grid;
}

function mount(target) {
  target.innerHTML = svg(background(), { className: 'pixel-art', background: 'px-sky2' });
  const art = target.querySelector('svg');
  const ns = 'http://www.w3.org/2000/svg';
  const waves = document.createElementNS(ns, 'g');
  const whale = document.createElementNS(ns, 'g');
  whale.innerHTML = gridToPaths(WHALE);
  whale.style.display = 'none';
  whale.style.cursor = 'pointer';
  art.append(waves, whale);
  const drawWaves = tick => {
    const rects = [];
    for (let x = 0; x < W; x++) if ((x + Math.floor(tick / 3)) % 7 < 2) rects.push(`<rect class="px-near-light" x="${x}" y="${SEA + ((x + Math.floor(tick / 6)) % 11 === 0 ? 1 : 0)}" width="1" height="1"/>`);
    waves.innerHTML = rects.join('');
  };
  let leap = -1;
  const place = (x, y) => { whale.setAttribute('transform', `translate(${x} ${y})`); whale.style.display = ''; };
  whale.addEventListener('click', () => { location.href = '/terminal/'; });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawWaves(0);
    // No leaping: the whale surfaces for a few seconds now and then.
    const surface = () => { place(18, SEA - 3); setTimeout(() => { whale.style.display = 'none'; }, 4000); };
    setTimeout(function again() { surface(); setTimeout(again, AGAIN * TICK); }, WAIT * TICK);
    return;
  }
  let tick = 0;
  let next = WAIT;
  setInterval(() => {
    if (document.hidden) return;
    tick++;
    drawWaves(tick);
    if (leap < 0 && tick >= next) leap = 0;
    if (leap >= 0) {
      // An arc from left to right, up out of the sea and back in.
      const t = leap / LEAP;
      place(12 + Math.round(t * 18), SEA - 4 - Math.round(Math.sin(t * Math.PI) * 9));
      if (++leap > LEAP) { leap = -1; whale.style.display = 'none'; next = tick + AGAIN; }
    }
  }, TICK);
}

mount(document.querySelector('.lost-art'));
