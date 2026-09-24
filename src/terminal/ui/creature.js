// A small pixel creature that lives under the GALLERY banner. It is pure text:
// each character cell is "▀"/"▄" with a foreground and background colour, i.e. two
// square 8×8 pixels, so it would render the same in a real truecolor terminal.
// It reacts to what happens in the terminal, blinks now and then, and falls asleep
// after a quiet minute — no endless animation, and none at all with reduced motion.

export const WIDTH = 14;         // pixels = character columns
export const HEIGHT = 14;        // pixels = 7 character rows
export const SIDE = 3;           // extra columns for "?", "♥", "z"
const ROWS = HEIGHT / 2;

// o edge · b body · s shade · l light · e eye · g sprout · c cheek
const BASE = [
  '..............',
  '..............',
  '.....g....g...',
  '......g..g....',
  '....oooooo....',
  '...obbbbbbo...',
  '..oblbbbbbbo..',
  '..obbebbebbo..',
  '..obbebbebso..',
  '..obcbbbbcso..',
  '..obbbbbbbso..',
  '...obbbbbso...',
  '....oo..oo....',
  '..............',
];
const PALETTE = {
  o: 'var(--pet-edge)', b: 'var(--pet-body)', s: 'var(--pet-shade)', l: 'var(--pet-light)',
  e: 'var(--pet-eye)', g: 'var(--pet-sprout)', c: 'var(--pet-cheek)',
};
const GLYPHS = {
  confused: [[1, 0, '?']],
  happy: [[1, 0, '♥'], [0, 1, '♥']],
  sleep: [[2, 0, 'z'], [1, 1, 'Z']],
  sing: [[1, 0, '♪']],
};

const EYES = [[7, 5], [7, 8], [8, 5], [8, 8]];
const grid = () => BASE.map(row => [...row]);
const put = (cells, points, value) => points.forEach(([y, x]) => { cells[y][x] = value; });
function shift(cells, dy) {
  const blank = () => Array(WIDTH).fill('.');
  if (dy < 0) return [...cells.slice(-dy), ...Array.from({ length: -dy }, blank)];
  return [...Array.from({ length: dy }, blank), ...cells.slice(0, HEIGHT - dy)];
}

/** Pixel grid (rows of palette keys) for a named pose. Pure; used by tests. */
export function poseGrid(pose) {
  const cells = grid();
  switch (pose) {
    case 'blink':
    case 'sleep':
      put(cells, EYES.slice(0, 2), 'b');
      return cells;
    case 'look':   // eyes turn toward the prompt below-right
      put(cells, EYES, 'b');
      put(cells, [[7, 6], [7, 9], [8, 6], [8, 9]], 'e');
      return cells;
    case 'happy':
    case 'sing':
      put(cells, EYES.slice(2), 'b');
      return cells;
    case 'confused':
      put(cells, [[7, 8]], 'b');
      return cells;
    case 'crouch': // anticipation / landing
      return shift(cells, 1);
    case 'jump':
    case 'jump-high':
      put(cells, [[12, 4], [12, 5], [12, 8], [12, 9]], '.'); // feet tucked
      return shift(cells, pose === 'jump' ? -1 : -2);
    default:
      return cells;
  }
}

/** Convert a pose into 7 rows × (WIDTH + SIDE) cells of { text, fg, bg }. Pure. */
export function frameCells(pose) {
  const cells = poseGrid(pose);
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let x = 0; x < WIDTH; x++) {
      const top = PALETTE[cells[r * 2][x]];
      const bottom = PALETTE[cells[r * 2 + 1][x]];
      if (top) row.push({ text: '▀', fg: top, bg: bottom || '' });
      else if (bottom) row.push({ text: '▄', fg: bottom, bg: '' });
      else row.push({ text: ' ', fg: '', bg: '' });
    }
    for (let x = 0; x < SIDE; x++) row.push({ text: ' ', fg: '', bg: '' });
    rows.push(row);
  }
  for (const [r, x, text] of GLYPHS[pose] || []) rows[r][WIDTH + x] = { text, fg: 'var(--pet-glyph)', bg: '' };
  return rows;
}

/** The <pre> the creature is drawn into (decorative, hidden from screen readers). */
export function createCreature(doc = globalThis.document) {
  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const pre = el('pre', 'tty-pet');
  pre.setAttribute('aria-hidden', 'true');
  for (let r = 0; r < ROWS; r++) {
    for (let x = 0; x < WIDTH + SIDE; x++) pre.append(el('span', '', ' '));
    if (r < ROWS - 1) pre.append('\n');
  }
  draw(pre, 'idle');
  return pre;
}

function draw(pre, pose) {
  const spans = pre.querySelectorAll('span');
  frameCells(pose).flat().forEach((cell, index) => {
    const span = spans[index];
    if (!span) return;
    if (span.textContent !== cell.text) span.textContent = cell.text;
    if (span.style.color !== cell.fg) span.style.color = cell.fg;
    if (span.style.backgroundColor !== cell.bg) span.style.backgroundColor = cell.bg;
  });
  pre.dataset.pose = pose;
}

const HOP = [['crouch', 90], ['jump', 70], ['jump-high', 140], ['jump', 70], ['crouch', 90]];
const SLEEP_AFTER = 60_000;

/**
 * Bring a creature <pre> to life. Returns { react(event), dispose() }.
 * events: 'command' (hop), 'error' (confused), 'typing' (look at the prompt),
 *         'pet' (happy hop + hearts), 'music' (sings), 'wake'.
 */
export function animateCreature(pre, { reducedMotion = false } = {}) {
  let timers = [];
  let blinkTimer;
  let sleepTimer;
  let resting = 'idle';
  let disposed = false;

  const alive = () => !disposed && pre.isConnected;
  const later = (ms, fn) => { const id = setTimeout(() => { if (alive()) fn(); else dispose(); }, ms); timers.push(id); return id; };
  const clearSequence = () => { timers.forEach(clearTimeout); timers = []; };
  const show = pose => draw(pre, pose);

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (reducedMotion) return;
    blinkTimer = setTimeout(() => {
      if (!alive()) return dispose();
      if (!document.hidden && pre.dataset.pose === 'idle') {
        show('blink');
        later(140, () => { if (pre.dataset.pose === 'blink') show(resting); });
      }
      scheduleBlink();
    }, 2500 + Math.random() * 3500);
  }
  function scheduleSleep() {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      if (!alive()) return dispose();
      clearSequence();
      clearTimeout(blinkTimer);
      resting = 'sleep';
      show('sleep');
    }, SLEEP_AFTER);
  }
  function settle(pose = 'idle', after = 0) {
    later(after, () => { resting = 'idle'; show(pose); if (pose !== 'idle') later(900, () => show('idle')); });
  }
  function hop(finalPose) {
    if (reducedMotion) { show(finalPose); if (finalPose !== 'idle') later(1400, () => show('idle')); return; }
    let t = 0;
    for (const [pose, ms] of HOP) { later(t, () => show(pose)); t += ms; }
    later(t, () => show(finalPose));
    if (finalPose !== 'idle') later(t + 1400, () => show('idle'));
  }

  function react(event) {
    if (!alive()) return dispose();
    const wasAsleep = resting === 'sleep';
    resting = 'idle';
    clearSequence();
    scheduleSleep();
    scheduleBlink();
    switch (event) {
      case 'command': hop('idle'); break;
      case 'pet': hop('happy'); break;
      case 'music': show('sing'); later(1600, () => show('idle')); break;
      case 'error': show('confused'); later(1400, () => show('idle')); break;
      case 'typing':
        if (wasAsleep) { show('blink'); settle('look', 180); }
        else { show('look'); later(1200, () => show('idle')); }
        break;
      default: show('idle');
    }
  }

  function dispose() {
    disposed = true;
    clearSequence();
    clearTimeout(blinkTimer);
    clearTimeout(sleepTimer);
  }

  show('idle');
  scheduleBlink();
  scheduleSleep();
  return { react, dispose, element: pre };
}
