const SIZE = 4;
const directions = new Set(['left', 'right', 'up', 'down']);

const cell = (direction, line, offset) => {
  if (direction === 'left') return line * SIZE + offset;
  if (direction === 'right') return line * SIZE + SIZE - 1 - offset;
  if (direction === 'up') return offset * SIZE + line;
  return (SIZE - 1 - offset) * SIZE + line;
};

/** One move, before a new tile is added. Each original tile merges at most once. */
export function slideBoard(board, direction) {
  if (!directions.has(direction)) throw new RangeError('Unknown direction');
  const next = Array(16).fill(0);
  const transitions = [];
  const merged = [];
  let score = 0;
  for (let line = 0; line < SIZE; line += 1) {
    const tiles = Array.from({ length: SIZE }, (_, offset) => cell(direction, line, offset))
      .filter(index => board[index]).map(index => ({ index, value: board[index] }));
    let target = 0;
    for (let source = 0; source < tiles.length; source += 1) {
      const tile = tiles[source];
      const to = cell(direction, line, target++);
      if (tiles[source + 1]?.value === tile.value) {
        const other = tiles[++source];
        next[to] = tile.value * 2;
        score += next[to];
        merged.push(to);
        transitions.push({ from: tile.index, to, value: tile.value }, { from: other.index, to, value: other.value });
      } else {
        next[to] = tile.value;
        transitions.push({ from: tile.index, to, value: tile.value });
      }
    }
  }
  return { board: next, score, moved: next.some((value, index) => value !== board[index]), transitions, merged };
}

/** Randomness is injected so moves and spawn probabilities can be verified. */
export function spawnTile(board, random = Math.random) {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return { board: [...board], index: -1 };
  const index = empty[Math.min(empty.length - 1, Math.floor(random() * empty.length))];
  const next = [...board];
  next[index] = random() < 0.9 ? 2 : 4;
  return { board: next, index };
}

export function newBoard(random = Math.random) {
  return spawnTile(spawnTile(Array(16).fill(0), random).board, random).board;
}

export function moveBoard(board, direction, random = Math.random) {
  const move = slideBoard(board, direction);
  if (!move.moved) return { ...move, spawned: -1 };
  const spawn = spawnTile(move.board, random);
  return { ...move, board: spawn.board, spawned: spawn.index };
}

export function canMove(board) {
  return board.some((value, index) => value === 0
    || (index % SIZE < SIZE - 1 && value === board[index + 1])
    || (index < 12 && value === board[index + SIZE]));
}

export const hasWon = board => board.some(value => value >= 2048);
