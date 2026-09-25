import { moveBoard, newBoard, canMove, hasWon } from './game-2048-model.js';
import { createTextScreen } from '../ui/text-screen.js';

const BEST_KEY = 'gallery-2048-best';
const keys = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };

export function mount2048(container, { signal, onExit = () => {}, announce = () => {} } = {}) {
  if (signal?.aborted) return () => {};
  const window = container.ownerDocument.defaultView || globalThis;
  let disposed = false;
  let board = newBoard();
  let score = 0;
  let wonAnnounced = false;
  let endedAnnounced = false;
  let best = 0;
  let lastGain = 0;
  let screen = null;
  try {
    const saved = Number(window.localStorage.getItem(BEST_KEY));
    if (Number.isSafeInteger(saved) && saved > 0) best = saved;
  } catch { /* The game remains usable when storage is unavailable. */ }
  container.classList.add('tty-2048');

  function render() {
    if (disposed || !screen) return;
    const width = screen.columns;
    if (width < 25 || screen.rows < 17) {
      screen.render(['2048', 'Terminal too small.', 'Need 25 columns x 17 rows.', '', 'Q / Esc exit']);
      return;
    }
    const lines = [[{ text: '2048', fg: 'accent' }], `SCORE ${score}  BEST ${best}`, ''];
    // Four fixed-width cells fit a 33-column text console. Wider displays keep
    // the same cell geometry rather than growing graphical tiles.
    const cellWidth = width >= 33 ? 7 : width >= 29 ? 6 : 5;
    const divider = '+' + ('-'.repeat(cellWidth) + '+').repeat(4);
    lines.push([{ text: divider, fg: 'muted' }]);
    for (let row = 0; row < 4; row++) {
      const cells = [{ text: '|', fg: 'muted' }];
      for (let col = 0; col < 4; col++) {
        const value = board[row * 4 + col];
        const number = value ? String(value) : '.';
        const padding = Math.max(0, cellWidth - number.length);
        const left = Math.floor(padding / 2);
        const color = !value ? 'muted' : value <= 4 ? 'ink' : value <= 32 ? 'user' : value <= 256 ? 'accent' : 'host';
        cells.push({ text: ' '.repeat(left) + number + ' '.repeat(padding - left), fg: color }, { text: '|', fg: 'muted' });
      }
      lines.push(cells);
      lines.push([{ text: divider, fg: 'muted' }]);
    }
    lines.push('');
    if (!canMove(board)) {
      lines.push([{ text: 'GAME OVER  [R] restart', fg: 'error' }]);
      if (!endedAnnounced) { announce(`Game over, score ${score}. Press R to restart.`); endedAnnounced = true; }
    } else if (hasWon(board)) {
      lines.push([{ text: '2048 reached. Keep going.', fg: 'user' }]);
      if (!wonAnnounced) { announce('You reached 2048. Keep going if you like.'); wonAnnounced = true; }
    } else lines.push(lastGain ? `MERGED +${lastGain}` : 'Merge equal numbers to reach 2048.');
    const footer = ['Arrows / WASD move', 'R restart  Q / Esc exit'];
    while (lines.length < screen.rows - footer.length - 1) lines.push('');
    lines.push([{ text: '-'.repeat(Math.max(1, width)), fg: 'muted' }]);
    footer.forEach(text => lines.push([{ text, fg: 'muted' }]));
    screen.render(lines);
  }

  function move(direction) {
    if (disposed || !canMove(board)) return;
    const result = moveBoard(board, direction);
    if (!result.moved) return;
    board = result.board;
    score += result.score;
    lastGain = result.score;
    if (score > best) {
      best = score;
      try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* Best score is optional. */ }
    }
    render();
  }

  function restart() {
    if (disposed) return;
    score = 0;
    lastGain = 0;
    board = newBoard();
    wonAnnounced = false;
    endedAnnounced = false;
    render();
    announce('2048 restarted.');
  }

  function onKey(event) {
    if (event.isComposing || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Escape' || key === 'q' || (event.ctrlKey && key === 'c')) {
      event.preventDefault(); event.stopPropagation(); exit(); return;
    }
    if (event.ctrlKey) return;
    if (key === 'r') { event.preventDefault(); restart(); return; }
    if (keys[key]) { event.preventDefault(); move(keys[key]); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener('abort', dispose);
    screen?.dispose();
    container.classList.remove('tty-2048');
  }

  function exit() {
    if (disposed) return;
    dispose();
    onExit();
  }

  screen = createTextScreen(container, { signal, title: '2048', onKey, onResize: render });
  signal?.addEventListener('abort', dispose, { once: true });
  render();
  screen.focus();
  announce('2048 started. Arrow keys or WASD move, R restarts, Q quits.');
  return dispose;
}
