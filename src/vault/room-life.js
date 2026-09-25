// The room's living layer, drawn over the static art (room-art.js):
//   the creature wanders the rug, walks to what you open, dances to music, sleeps late at night
//   and says a line now and then; the window shows the real time of day (and snow in winter);
//   the desk lamp lights the corner and can be switched off; the jukebox lights cycle and notes
//   float while music plays; the projector beam flickers and the room dims while a film plays.
// One stepped timer (8 fps) drives everything; it stops while the room is off screen or the tab
// is hidden, and with reduced motion only the still state is drawn.
import { gridToPaths } from '../blog/pixel-art.js';
import { said } from '../core/uv.js';
import { CREATURE_AT, creatureGrid, HOTSPOTS } from './room-art.js';

const NS = 'http://www.w3.org/2000/svg';
const TICK = 125;
const FLOOR = [40, 90];            // the creature's left edge stays over the rug
const LINES = ['嘿嘿。', '今天过得怎么样？', '要不要放首歌？', '我一直在这里。', '书架上的书读完了吗？', '外面好安静。'];
const NOTE = [[1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2], [3, 2]];
const Z = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];

function layer(parent, className) {
  const g = document.createElementNS(NS, 'g');
  if (className) g.setAttribute('class', className);
  parent.append(g);
  return g;
}
const pixels = (points, className, dx = 0, dy = 0) =>
  points.map(([x, y]) => `<rect class="${className}" x="${x + dx}" y="${y + dy}" width="1" height="1"/>`).join('');
const polygon = (points, className) => `<polygon class="${className}" points="${points.map(point => point.join(',')).join(' ')}"/>`;

export function greeting(hour) {
  if (hour < 5) return '这么晚还没睡？';
  if (hour < 11) return '早上好！';
  if (hour < 18) return '下午好。';
  return '晚上好，欢迎回来。';
}

/** The window's sky for an hour and month: a 24×20 grid of classes (panes only; bars stay clear). */
export function windowGrid(hour, month, frame = 0, random = Math.random) {
  const phase = hour >= 7 && hour < 17 ? 'day' : (hour >= 17 && hour < 19) || (hour >= 5 && hour < 7) ? 'dusk' : 'night';
  const [top, bottom] = { day: ['px-day-sky', 'px-day-sky2'], dusk: ['px-dusk-sky', 'px-dusk-sky2'], night: ['px-sky1', 'px-sky2'] }[phase];
  const grid = Array.from({ length: 20 }, (_, y) => Array.from({ length: 24 }, (_, x) => (x === 11 || x === 12 || y === 9 ? '' : y < 10 ? top : bottom)));
  const set = (x, y, name) => { if (grid[y]?.[x]) grid[y][x] = name; };
  const disc = (cx, cy, r, name) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1) set(x, y, name); };
  if (phase === 'night') {
    disc(17, 6, 3, 'px-moon');
    [[3, 3], [7, 7], [4, 14], [20, 15], [9, 17], [15, 12]].forEach(([x, y], i) => { if ((frame + i * 7) % 29 !== 0) set(x, y, 'px-star'); });
  } else if (phase === 'day') {
    disc(18, 4, 2, 'px-sun');
    const drift = Math.floor(frame / 24) % 30;
    [[0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1]].forEach(([x, y]) => set((x + drift) % 24, 13 + y, 'px-cloud'));
  } else {
    disc(6, 17, 3, 'px-sun');
  }
  if (month === 11 || month <= 1) {
    for (let i = 0; i < 9; i++) set((i * 7 + Math.floor(frame / 6) * (i % 2 ? 1 : 0)) % 24, (i * 5 + Math.floor(frame / 3)) % 20, 'px-snow');
  }
  if (phase === 'night' && random() < 0.004) grid.shooting = true;
  return grid;
}

/**
 * stage: the .room-stage element; art: its <svg>. Returns controls for room.js:
 * { goTo(object), pet(), toggleLamp(), setFilm(open), setTheater(on), setMusic(on), dispose() }.
 */
export function animateRoom({ stage, art, reducedMotion = false, now = () => new Date() }) {
  const date = now();
  const hour = date.getHours();
  const month = date.getMonth();
  const night = hour >= 19 || hour < 7;
  const lateNight = hour >= 23 || hour < 6;

  const light = layer(art, 'room-light');
  const sky = layer(art, 'room-sky');
  const effects = layer(art, 'room-effects');
  const creature = layer(art, 'room-creature');
  const extras = layer(art, 'room-creature-extras');
  sky.setAttribute('transform', 'translate(6 5)');
  const bubble = document.createElement('p');
  bubble.className = 'room-bubble';
  bubble.hidden = true;
  stage.append(bubble);

  const state = {
    x: CREATURE_AT[0], y: CREATURE_AT[1], target: null, facing: 1,
    mode: lateNight ? 'sleep' : 'idle', pose: lateNight ? 'sleep' : 'idle', until: 0,
    lamp: true, film: false, theater: false, music: false, notes: [], shooting: null, frame: 0, idleTicks: 0, heart: 0,
  };
  let bubbleTimer;

  function say(text, ms = 2800) {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.hidden = false;
    placeBubble();
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
  }
  function placeBubble() {
    bubble.style.left = `${((state.x + 7) / 128) * 100}%`;
    bubble.style.top = `${((state.y + 1) / 60) * 100}%`;
  }

  function drawLight() {
    const beam = state.film || state.theater;
    stage.classList.toggle('lights-off', !state.lamp || state.theater);
    light.innerHTML = [
      polygon([[8, 42], [28, 42], [40, 56], [20, 56]], night ? 'room-moonlight' : 'room-sunlight'),
      state.lamp && !state.theater ? polygon([[26, 29], [29, 29], [37, 42], [16, 42]], 'room-lamplight') : '<rect class="px-room-edge" x="26" y="28" width="4" height="1"/>',
      beam ? polygon([[102, 34], [104, 34], [122, 19], [96, 19]], 'room-beam') : '',
    ].join('');
  }
  function drawSky() {
    const grid = windowGrid(hour, month, state.frame);
    if (grid.shooting && !state.shooting) state.shooting = { x: 2 + Math.floor(Math.random() * 10), y: 1, age: 0 };
    let streak = '';
    if (state.shooting) {
      const { x, y, age } = state.shooting;
      streak = pixels([[x + age, y + age], [x + age - 1, y + age - 1]].filter(([px, py]) => px >= 0 && py < 9 && px !== 11 && px !== 12), 'px-star');
      if (++state.shooting.age > 7) state.shooting = null;
    }
    sky.innerHTML = gridToPaths(grid) + streak;
  }
  function drawEffects() {
    const lights = ['px-window', 'px-grass-light', 'px-heart', 'px-far-light'];
    let html = '';
    if (state.music) {
      html += Array.from({ length: 10 }, (_, i) => `<rect class="${lights[(i + Math.floor(state.frame / 3)) % 4]}" x="${110 + i}" y="24" width="1" height="1"/>`).join('');
    }
    for (const note of state.notes) html += pixels(NOTE, 'px-window', note.x, Math.round(note.y));
    if (state.film || state.theater) {
      html += `<rect class="room-screen-glow" x="95" y="3" width="28" height="16" opacity="${state.frame % 5 === 0 ? 0.12 : 0.22}"/>`;
    }
    effects.innerHTML = html;
  }
  function drawCreature() {
    const flip = state.facing < 0 ? `translate(${state.x + 14} ${state.y}) scale(-1 1)` : `translate(${state.x} ${state.y})`;
    creature.setAttribute('transform', flip);
    creature.innerHTML = gridToPaths(creatureGrid(state.pose));
    let html = '';
    if (state.mode === 'sleep') {
      const rise = Math.floor(state.frame / 4) % 6;
      html += pixels(Z, 'px-room-paper', state.x + 12, state.y + 2 - rise);
      if (rise > 2) html += pixels(Z, 'px-room-paper', state.x + 15, state.y - rise);
    }
    if (state.heart > 0) html += pixels([[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]], 'px-heart', state.x + 12, state.y + 1);
    extras.innerHTML = html;
    if (!bubble.hidden) placeBubble();
  }

  function walkTo(x) {
    if (state.mode === 'sleep') wake();
    state.target = Math.max(FLOOR[0], Math.min(FLOOR[1], Math.round(x)));
    state.mode = 'walk';
  }
  function wake() {
    state.mode = 'idle';
    state.pose = 'idle';
    state.idleTicks = 0;
  }

  function step() {
    state.frame++;
    if (state.heart > 0) state.heart--;
    // Music: notes rise from the jukebox and the creature bounces.
    if (state.music && state.frame % 10 === 0) state.notes.push({ x: 111 + Math.floor(Math.random() * 8), y: 20, age: 0 });
    state.notes = state.notes.filter(note => { note.y -= 0.5; return ++note.age < 16; });
    if (state.mode === 'walk') {
      const dx = state.target - state.x;
      state.facing = dx < 0 ? -1 : 1;
      state.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.75);
      state.pose = state.frame % 4 < 2 ? 'idle' : 'crouch';
      if (Math.abs(dx) < 0.5) { state.x = state.target; state.mode = 'idle'; state.pose = 'happy'; state.until = state.frame + 6; }
    } else if (state.mode === 'idle') {
      if (state.music) state.pose = state.frame % 4 < 2 ? 'crouch' : 'jump';
      else if (state.until && state.frame < state.until) { /* holding a reaction pose */ } else {
        state.until = 0;
        state.pose = state.frame % 40 === 0 ? 'blink' : 'idle';
        state.idleTicks++;
        // Wander now and then; late at night, fall asleep again after a while.
        if (lateNight && state.idleTicks > 240) { state.mode = 'sleep'; state.pose = 'sleep'; }
        else if (!lateNight && state.idleTicks > 48 && Math.random() < 0.02) { walkTo(FLOOR[0] + Math.random() * (FLOOR[1] - FLOOR[0])); state.idleTicks = 0; }
      }
    }
    drawSky();
    drawEffects();
    drawCreature();
  }

  // Run only while the room is visible.
  let visible = true;
  let timer = null;
  const run = () => {
    const should = visible && !document.hidden && !reducedMotion;
    if (should && !timer) timer = setInterval(step, TICK);
    if (!should && timer) { clearInterval(timer); timer = null; }
  };
  const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); run(); });
  observer.observe(stage);
  document.addEventListener('visibilitychange', run);
  // The creature turns toward the pointer while it stands still.
  const onPointer = event => {
    if (state.mode !== 'idle' || state.music) return;
    const box = art.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 128;
    state.facing = x < state.x + 7 ? -1 : 1;
    if (reducedMotion) drawCreature();
  };
  stage.addEventListener('pointermove', onPointer);

  drawLight();
  drawSky();
  drawEffects();
  drawCreature();
  if (!lateNight) say(greeting(hour));
  run();

  return {
    goTo(object) {
      const spot = HOTSPOTS[object];
      if (!spot || reducedMotion) return;
      walkTo(spot[0] + spot[2] / 2 - 7);
    },
    pet() {
      if (state.mode === 'sleep') { wake(); say('……嗯？你来啦。'); }
      else { const lines = said('creature', LINES); say(lines[Math.floor(Math.random() * lines.length)]); }
      state.heart = 12;
      state.pose = 'happy';
      state.until = state.frame + 8;
      if (reducedMotion) drawCreature();
    },
    toggleLamp() {
      state.lamp = !state.lamp;
      drawLight();
    },
    setFilm(open) {
      if (state.film === open && (open || !state.theater)) return;
      state.film = open;
      if (!open) state.theater = false;
      drawLight();
    },
    setTheater(on) {
      state.theater = on;
      drawLight();
    },
    setMusic(on) {
      state.music = on;
      if (on && state.mode === 'sleep') wake();
      if (!on) state.notes = [];
      drawEffects();
    },
    dispose() {
      clearInterval(timer);
      clearTimeout(bubbleTimer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', run);
      stage.removeEventListener('pointermove', onPointer);
    },
  };
}
