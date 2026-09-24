// Pixel art drawn from grids. Every pixel gets a class name; CSS maps the classes
// to theme colours, so the same art follows the blog theme without new images.

/** Small deterministic PRNG so the scene is identical on every load. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Merge a grid of class names into one <path> per class (one run per row segment).
 * Empty cells ('' / null) are left transparent.
 */
export function gridToPaths(grid) {
  const runs = new Map();
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const name = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === name) end += 1;
      if (name) {
        if (!runs.has(name)) runs.set(name, []);
        runs.get(name).push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
      }
      x = end;
    }
  });
  return [...runs].map(([name, parts]) => `<path class="${name}" d="${parts.join('')}"/>`).join('');
}

export function svg(grid, { label, className = 'pixel-art', background } = {}) {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const base = background ? `<rect class="${background}" width="${width}" height="${height}"/>` : '';
  return `<svg class="${className}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" ${a11y}>${base}${gridToPaths(grid)}</svg>`;
}

/** Turn text rows into a grid, e.g. sprite(['.aa.', 'abba'], {a: 'px-x', b: 'px-y'}). */
export function sprite(rows, legend) {
  return rows.map(row => [...row].map(key => legend[key] || ''));
}

export const SCENE_WIDTH = 96;
export const SCENE_HEIGHT = 64;

function ridge(peaks, slope) {
  return x => Math.min(...peaks.map(([px, py]) => Math.round(py + Math.abs(x - px) * slope)));
}

/**
 * Night sky, moon, two mountain ranges, a meadow and a lit cabin, plus the
 * positions the animation layer needs (ground height, cabin, stars).
 */
export function sceneLayout() {
  const W = SCENE_WIDTH;
  const H = SCENE_HEIGHT;
  const grid = Array.from({ length: H }, () => Array(W).fill(''));
  const set = (x, y, name) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = name; };

  // Sky: four bands with two-row checkerboard dithering at each boundary.
  const bands = [[0, 'px-sky0'], [18, 'px-sky1'], [31, 'px-sky2'], [40, 'px-sky3']];
  for (let y = 0; y < H; y += 1) {
    const index = bands.findLastIndex(([start]) => y >= start);
    const next = bands[index + 1];
    for (let x = 0; x < W; x += 1) {
      let name = bands[index][1];
      if (next && y >= next[0] - 2 && (x + y) % 2 === 0) name = next[1];
      grid[y][x] = name;
    }
  }

  // Moon with shading and craters.
  const [mx, my, r] = [71, 14, 8];
  for (let y = my - r - 1; y <= my + r + 1; y += 1) {
    for (let x = mx - r - 1; x <= mx + r + 1; x += 1) {
      const dx = x - mx;
      const dy = y - my;
      if (dx * dx + dy * dy > r * r + r) continue;
      set(x, y, dx + dy > 6 || (dx + dy > 4 && (x + y) % 2) ? 'px-moon-shade' : 'px-moon');
    }
  }
  [[-3, -3], [-2, -3], [2, 1], [3, 1], [2, 2], [-4, 3]].forEach(([dx, dy]) => set(mx + dx, my + dy, 'px-moon-shade'));

  // Stars: seeded, kept out of the moon and below-horizon area.
  const next = random(20260923);
  const stars = [];
  for (let count = 0; count < 34;) {
    const x = Math.floor(next() * W);
    const y = Math.floor(next() * 34);
    if ((x - mx) ** 2 + (y - my) ** 2 < (r + 4) ** 2) continue;
    set(x, y, next() < 0.35 ? 'px-star' : 'px-star-dim');
    stars.push([x, y]);
    count += 1;
  }
  [[14, 7], [44, 5], [88, 30]].forEach(([x, y]) => {
    set(x, y, 'px-star');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => set(x + dx, y + dy, 'px-star-dim'));
  });

  // Far and near mountain ranges; the first pixel of each ridge is lit.
  const far = ridge([[6, 33], [29, 26], [50, 35], [77, 29], [101, 34]], 0.85);
  const near = ridge([[-8, 40], [24, 37], [50, 43], [72, 38], [100, 41]], 0.8);
  for (let x = 0; x < W; x += 1) {
    for (let y = far(x); y < H; y += 1) set(x, y, y === far(x) ? 'px-far-light' : 'px-far');
    for (let y = near(x); y < H; y += 1) set(x, y, y <= near(x) + (x % 7 === 0 ? 1 : 0) ? 'px-near-light' : 'px-near');
  }

  // Meadow with a dithered darker foreground and a few flowers.
  const hill = x => 51 + Math.round(2.5 * Math.sin(x / 8) + 1.5 * Math.sin(x / 3.3 + 1));
  for (let x = 0; x < W; x += 1) {
    for (let y = hill(x); y < H; y += 1) {
      let name = y === hill(x) ? 'px-grass-light' : 'px-grass';
      if (y >= 59 || (y >= 57 && (x + y) % 2 === 0)) name = 'px-grass-dark';
      set(x, y, name);
    }
  }
  for (let count = 0; count < 14; count += 1) {
    const x = Math.floor(next() * W);
    if (x > 12 && x < 30) continue;
    set(x, hill(x) + 2 + Math.floor(next() * 5), next() < 0.5 ? 'px-flower' : 'px-flower-alt');
  }

  // Cabin with a chimney and a lit window, standing on the meadow.
  const cabin = sprite([
    '..k......',
    '..k.r....',
    '..krrr...',
    '..rrrrr..',
    '.rrrrrrr.',
    'rrrrrrrrr',
    '.wwwwwww.',
    '.wyywwdw.',
    '.wyywwdw.',
    '.wwwwwdw.',
  ], { r: 'px-roof', w: 'px-wall', y: 'px-window', d: 'px-door', k: 'px-door' });
  const cabinX = 16;
  const ground = Math.min(...Array.from({ length: 9 }, (_, i) => hill(cabinX + i)));
  cabin.forEach((row, dy) => row.forEach((name, dx) => {
    if (name) set(cabinX + dx, ground - cabin.length + dy + 1, name);
  }));
  for (let dx = 0; dx < 9; dx += 1) {
    for (let y = ground + 1; y < hill(cabinX + dx); y += 1) set(cabinX + dx, y, 'px-grass');
  }
  const top = ground - cabin.length + 1;
  // Walking surface: the meadow's top row, or just below the cabin's floor.
  const surface = x => (x >= cabinX && x < cabinX + 9 ? ground + 1 : hill(Math.max(0, Math.min(W - 1, x))));
  return {
    grid,
    stars,
    surface,
    cabin: { x: cabinX, top, door: cabinX + 6, chimney: [cabinX + 2, top] },
  };
}

export function sceneGrid() {
  return sceneLayout().grid;
}

export function pixelScene() {
  return svg(sceneGrid(), { className: 'pixel-art pixel-scene', background: 'px-sky3' });
}

/** Small monitor sprite used as the site mark in the sidebar. */
export function monitorSprite() {
  return svg(sprite([
    '.oooooooooooo.',
    'ossssssssssssk',
    'osbbbbbbbbbbsk',
    'osbgbbbbbbbbsk',
    'osbbgbbbbbbbsk',
    'osbgbbyyyybbsk',
    'osbbbbbbbbbbsk',
    'osbbbbbbbbbbsk',
    'ossssssssssssk',
    '.kkkkkkkkkkkk.',
    '.....oook.....',
    '...oooooook...',
  ], { o: 'px-frame', k: 'px-frame-dark', s: 'px-screen-edge', b: 'px-screen', g: 'px-grass-light', y: 'px-window' }),
  { className: 'pixel-art pixel-sprite' });
}
