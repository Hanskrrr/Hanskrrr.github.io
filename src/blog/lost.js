// The 404 page: the homepage critter, lost on a patch of meadow, looking around.
import { gridToPaths, svg } from './pixel-art.js';
import { CRITTER } from './scene.js';

const W = 48;
const H = 24;
const QUESTION = ['hhh', '..h', '.hh', '...', '.h.'];

const groundAt = x => 17 + Math.round(Math.sin(x / 6) * 1.5);

function background() {
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    const ground = groundAt(x);
    if (y > ground) return y > ground + 3 && (x + y) % 2 ? 'px-grass-dark' : 'px-grass';
    if (y === ground) return 'px-grass-light';
    return y < 8 ? 'px-sky0' : y < 13 ? ((x + y) % 2 && y > 10 ? 'px-sky2' : 'px-sky1') : 'px-sky2';
  }));
  [[4, 3], [13, 6], [22, 2], [31, 5], [40, 3], [45, 8], [8, 10], [36, 11]].forEach(([x, y], i) => { grid[y][x] = i % 3 ? 'px-star-dim' : 'px-star'; });
  [[7, 18], [16, 19], [33, 18], [42, 19]].forEach(([x, y]) => { grid[y][x] = 'px-flower'; });
  return grid;
}

function mount(target) {
  target.innerHTML = svg(background(), { className: 'pixel-art', background: 'px-sky2' });
  const art = target.querySelector('svg');
  const ns = 'http://www.w3.org/2000/svg';
  const critter = document.createElementNS(ns, 'g');
  const mark = document.createElementNS(ns, 'g');
  const question = QUESTION.map(row => [...row].map(key => (key === 'h' ? 'px-heart' : '')));
  mark.innerHTML = gridToPaths(question);
  art.append(critter, mark);
  const x = 21;
  // Stand on the highest ground point under the critter's six columns.
  const y = Math.min(...Array.from({ length: 6 }, (_, i) => groundAt(x + i))) - 5;
  critter.setAttribute('transform', `translate(${x} ${y})`);
  mark.setAttribute('transform', `translate(${x + 5} ${y - 6})`);
  const draw = frame => { critter.innerHTML = gridToPaths(CRITTER[frame]); };
  draw('front');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frames = ['front', 'left', 'left', 'front', 'right', 'right', 'front', 'blink'];
  let index = 0;
  setInterval(() => {
    if (document.hidden) return;
    index = (index + 1) % frames.length;
    draw(frames[index]);
    mark.style.visibility = index % 4 === 3 ? 'hidden' : '';
  }, 600);
}

mount(document.querySelector('.lost-art'));
