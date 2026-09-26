// Pixel art drawn from grids. Every pixel gets a class name; CSS maps the classes
// to theme colours, so the same art follows the blog theme without new images.

/** Small deterministic PRNG so the scene is identical on every load. */
export function random(seed) {
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

/** Northern-hemisphere season for a date: winter Dec–Feb, spring Mar–May, … */
export function seasonOf(date = new Date()) {
  return ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][date.getMonth()];
}

const TREE_CANOPY = ['..lllll..', '.lLllllL.', 'lllLlllll', 'llllllLll', '.lllllll.', '..lllll..', '....t....', '....t....', '...ttt...'];
const TREE_BARE = ['..s.s.s..', '.st.t.ts.', '..t.t.t..', '...ttt...', '....t....', '....t....', '....t....', '....t....', '...ttt...'];
const LEAVES = {
  spring: ['px-blossom', 'px-blossom-light'],
  summer: ['px-leaf', 'px-leaf-light'],
  autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'],
};

/**
 * Night sky, moon, two mountain ranges, a meadow, a lit cabin and a tree that
 * follows the season, plus the positions the animation layer needs.
 * season: 'spring' | 'summer' | 'autumn' | 'winter'; hour: 0–23 (the cabin
 * light is off from 1 to 6 a.m.).
 */
export function sceneLayout({ season = seasonOf(), hour = new Date().getHours() } = {}) {
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
  const flowers = { spring: 30, summer: 14, autumn: 8, winter: 0 }[season];
  for (let count = 0; count < flowers; count += 1) {
    const x = Math.floor(next() * W);
    if (x > 12 && x < 30) continue;
    set(x, hill(x) + 2 + Math.floor(next() * 5), next() < 0.5 ? 'px-flower' : 'px-flower-alt');
  }
  if (season === 'autumn') {
    // A few fallen leaves on the meadow's edge.
    for (let x = 30; x < W; x += 5 + Math.floor(next() * 4)) set(x, hill(x), next() < 0.5 ? 'px-leaf-autumn' : 'px-leaf-autumn-light');
  }

  // A tree on the right-hand meadow.
  const treeX = 79;
  const treeBase = hill(treeX + 4) - 1;
  const [leaf, leafLight] = LEAVES[season] || [];
  const tree = sprite(season === 'winter' ? TREE_BARE : TREE_CANOPY, { l: leaf, L: leafLight, t: 'px-trunk', s: 'px-snow' });
  tree.forEach((row, dy) => row.forEach((name, dx) => {
    if (name) set(treeX + dx, treeBase - tree.length + 1 + dy, name);
  }));

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
  ], { r: 'px-roof', w: 'px-wall', y: hour >= 1 && hour < 6 ? 'px-window-off' : 'px-window', d: 'px-door', k: 'px-door' });
  const cabinX = 16;
  const ground = Math.min(...Array.from({ length: 9 }, (_, i) => hill(cabinX + i)));
  cabin.forEach((row, dy) => row.forEach((name, dx) => {
    if (name) set(cabinX + dx, ground - cabin.length + dy + 1, name);
  }));
  for (let dx = 0; dx < 9; dx += 1) {
    for (let y = ground + 1; y < hill(cabinX + dx); y += 1) set(cabinX + dx, y, 'px-grass');
  }
  const top = ground - cabin.length + 1;
  if (season === 'winter') {
    // Snow on ridges, the meadow's top row and the roof's upper edge.
    const before = grid.map(row => [...row]);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const name = before[y][x];
        if (['px-far-light', 'px-near-light', 'px-grass-light'].includes(name)) grid[y][x] = 'px-snow';
        if (name === 'px-roof' && before[y - 1]?.[x] !== 'px-roof') grid[y][x] = 'px-snow';
        // A dithered second row of snow on the meadow.
        if (name === 'px-grass' && before[y - 1]?.[x] === 'px-grass-light' && (x + y) % 2 === 0) grid[y][x] = 'px-snow';
      }
    }
  }
  // Walking surface: the meadow's top row, or just below the cabin's floor.
  const surface = x => (x >= cabinX && x < cabinX + 9 ? ground + 1 : hill(Math.max(0, Math.min(W - 1, x))));
  return {
    grid,
    stars,
    surface,
    season,
    cabin: { x: cabinX, top, door: cabinX + 6, chimney: [cabinX + 2, top] },
    tree: { x: treeX, top: treeBase - tree.length + 1, width: 9, canopyRows: season === 'winter' ? 3 : 6 },
  };
}

/** Deterministic default (summer, daytime light) unless options are given. */
export function sceneGrid(options = { season: 'summer', hour: 12 }) {
  return sceneLayout(options).grid;
}

/** The homepage scene for today's season and the visitor's local hour. */
export function pixelScene(options = {}) {
  return svg(sceneLayout(options).grid, { className: 'pixel-art pixel-scene', background: 'px-sky3' });
}

/** The owner's 16×16 avatar (rows from content/profile.js). */
export function avatarSprite(rows) {
  return svg(sprite(rows, {
    h: 'px-av-hair', f: 'px-av-skin', e: 'px-av-eye', k: 'px-av-phones', s: 'px-av-shirt', c: 'px-av-collar',
  }), { className: 'pixel-art pixel-avatar' });
}

// The creature from the homepage picture (also walks the room's pixel world and the shore).
const CRITTER_KEYS = { o: 'px-critter-edge', b: 'px-critter-body', e: 'px-critter-eye', g: 'px-grass-light' };
const critterFrames = {
  front: ['.g..g.', '.oooo.', 'obebeo', 'obbbbo', '.o..o.'],
  blink: ['.g..g.', '.oooo.', 'obbbbo', 'obbbbo', '.o..o.'],
  right: ['.g..g.', '.oooo.', 'obbebo', 'obbbbo', '.o..o.'],
  right2: ['.g..g.', '.oooo.', 'obbebo', 'obbbbo', '..oo..'],
  left: ['.g..g.', '.oooo.', 'obebbo', 'obbbbo', '.o..o.'],
  left2: ['.g..g.', '.oooo.', 'obebbo', 'obbbbo', '..oo..'],
};
export const CRITTER = Object.fromEntries(Object.entries(critterFrames).map(([name, rows]) => [name, sprite(rows, CRITTER_KEYS)]));
