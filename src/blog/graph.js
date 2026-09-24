// The knowledge graph: articles, their topics, and the [[links]] between them.
// Topics give the tree (genre → sub-topic → article); links cut across it.
// Layout is a small deterministic force simulation, so the picture is stable between visits.
import { articles, topics } from '../content/articles.js';

const TONES = ['blue', 'yellow', 'green', 'purple'];
const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

export function topicOf(article) {
  const [genreId, subId] = article.topic.split('/');
  const genre = topics.find(item => item.id === genreId);
  return { genre, sub: genre?.subs.find(item => item.id === subId) };
}
export const toneOf = genreId => TONES[Math.max(0, topics.findIndex(item => item.id === genreId)) % TONES.length];

/** Outgoing links and backlinks for one article, as article objects. */
export function neighbours(article) {
  const byId = new Map(articles.map(item => [item.id, item]));
  const outgoing = article.links.map(id => byId.get(id)).filter(Boolean);
  const incoming = articles.filter(item => item !== article && item.links.includes(article.id));
  return { outgoing, incoming };
}

/** Nodes { id, kind: genre|sub|article, label, genre } and edges { a, b, kind: tree|link }. */
export function graphData() {
  const nodes = [];
  const edges = [];
  for (const genre of topics) {
    nodes.push({ id: `g:${genre.id}`, kind: 'genre', label: genre.name, genre: genre.id });
    for (const sub of genre.subs) {
      nodes.push({ id: `s:${genre.id}/${sub.id}`, kind: 'sub', label: sub.name, genre: genre.id });
      edges.push({ a: `g:${genre.id}`, b: `s:${genre.id}/${sub.id}`, kind: 'tree' });
    }
  }
  const seen = new Set();
  for (const article of articles) {
    nodes.push({ id: article.id, kind: 'article', label: article.title, genre: article.topic.split('/')[0] });
    edges.push({ a: `s:${article.topic}`, b: article.id, kind: 'tree' });
    for (const target of article.links) {
      const key = [article.id, target].sort().join('|');
      if (seen.has(key) || !articles.some(item => item.id === target)) continue;
      seen.add(key);
      edges.push({ a: article.id, b: target, kind: 'link' });
    }
  }
  return { nodes, edges };
}

/** Deterministic force layout. Returns Map<id, {x, y}> scaled to fit width × height. */
export function layout({ nodes, edges }, { width = 800, height = 560, steps = 320 } = {}) {
  const genres = nodes.filter(node => node.kind === 'genre');
  const pos = new Map();
  // Start genres on a circle and everything else near its genre, with a fixed spread.
  nodes.forEach((node, index) => {
    const g = Math.max(0, genres.findIndex(item => item.genre === node.genre));
    const angle = (g / Math.max(1, genres.length)) * Math.PI * 2;
    const r = node.kind === 'genre' ? 1 : node.kind === 'sub' ? 1.4 : 1.8;
    const wobble = ((index * 37) % 17) / 17 - 0.5;
    pos.set(node.id, { x: Math.cos(angle + wobble) * r * 100, y: Math.sin(angle + wobble) * r * 100, vx: 0, vy: 0 });
  });
  const list = [...pos.values()];
  const springs = edges.map(edge => ({ a: pos.get(edge.a), b: pos.get(edge.b), rest: edge.kind === 'tree' ? 70 : 110, k: edge.kind === 'tree' ? 0.06 : 0.02 })).filter(s => s.a && s.b);
  for (let step = 0; step < steps; step++) {
    const heat = 1 - step / steps;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = a.x - b.x || 0.01, dy = a.y - b.y || 0.01;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const force = 3000 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * force; a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force; b.vy -= (dy / d) * force;
      }
    }
    for (const { a, b, rest, k } of springs) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const force = (d - rest) * k;
      a.vx += (dx / d) * force; a.vy += (dy / d) * force;
      b.vx -= (dx / d) * force; b.vy -= (dy / d) * force;
    }
    for (const p of list) {
      p.vx -= p.x * 0.01; p.vy -= p.y * 0.01;
      const speed = Math.hypot(p.vx, p.vy);
      const limit = 12 * heat + 0.5;
      if (speed > limit) { p.vx *= limit / speed; p.vy *= limit / speed; }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.5; p.vy *= 0.5;
    }
  }
  // Fit into the box with a margin for labels.
  const xs = list.map(p => p.x), ys = list.map(p => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margin = 60;
  const scale = Math.min((width - margin * 2) / Math.max(1, maxX - minX), (height - margin * 2) / Math.max(1, maxY - minY), 2);
  const offsetX = (width - (maxX - minX) * scale) / 2, offsetY = (height - (maxY - minY) * scale) / 2;
  const result = new Map();
  for (const [id, p] of pos) result.set(id, { x: Math.round(offsetX + (p.x - minX) * scale), y: Math.round(offsetY + (p.y - minY) * scale) });
  return result;
}

const SIZE = { genre: 14, sub: 10, article: 8 };

function nodeMarkup(node, { x, y }, extra = '') {
  const size = SIZE[node.kind];
  const box = `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"/>`;
  const label = `<text x="${x}" y="${y + size / 2 + 14}">${escapeHtml(node.label)}</text>`;
  const attrs = `class="graph-node node-${node.kind} tone-${toneOf(node.genre)}${extra}" data-node="${escapeHtml(node.id)}"`;
  if (node.kind === 'article') return `<a href="/articles/${node.id}/" data-article="${node.id}" ${attrs}>${box}${label}</a>`;
  const topic = node.id.slice(2);
  return `<a href="/?view=blog" data-topic="${escapeHtml(topic)}" ${attrs}>${box}${label}</a>`;
}

function edgeMarkup(edge, positions) {
  const a = positions.get(edge.a), b = positions.get(edge.b);
  if (!a || !b) return '';
  return `<line class="graph-edge edge-${edge.kind}" data-a="${escapeHtml(edge.a)}" data-b="${escapeHtml(edge.b)}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
}

/** The whole site as one SVG. */
export function globalGraph({ width = 800, height = 560 } = {}) {
  const data = graphData();
  const positions = layout(data, { width, height });
  return `<svg class="knowledge-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="文章关系图">${data.edges.map(edge => edgeMarkup(edge, positions)).join('')}${data.nodes.map(node => nodeMarkup(node, positions.get(node.id))).join('')}</svg>`;
}

/** One article in the middle, the articles it links to or is linked from around it. */
export function localGraph(article, { size = 320 } = {}) {
  const { outgoing, incoming } = neighbours(article);
  const around = [...new Set([...outgoing, ...incoming])];
  if (!around.length) return '';
  const centre = { x: size / 2, y: size / 2 };
  const radius = size / 2 - 60;
  const positions = new Map([[article.id, centre]]);
  around.forEach((item, index) => {
    const angle = -Math.PI / 2 + (index / around.length) * Math.PI * 2;
    positions.set(item.id, { x: Math.round(centre.x + Math.cos(angle) * radius), y: Math.round(centre.y + Math.sin(angle) * radius) });
  });
  const node = item => ({ id: item.id, kind: 'article', label: item.title, genre: item.topic.split('/')[0] });
  const edges = around.map(item => edgeMarkup({ a: article.id, b: item.id, kind: 'link' }, positions)).join('');
  const nodes = [nodeMarkup(node(article), centre, ' is-current'), ...around.map(item => nodeMarkup(node(item), positions.get(item.id)))].join('');
  return `<svg class="knowledge-graph local-graph" viewBox="0 0 ${size} ${size}" role="img" aria-label="与本文相连的文章">${edges}${nodes}</svg>`;
}

/** Hovering or focusing a node highlights it and its direct neighbours. */
export function attachHighlight(svg) {
  const set = id => {
    svg.classList.toggle('is-focused', Boolean(id));
    const near = new Set([id]);
    svg.querySelectorAll('.graph-edge').forEach(line => {
      const on = Boolean(id) && (line.dataset.a === id || line.dataset.b === id);
      line.classList.toggle('is-near', on);
      if (on) { near.add(line.dataset.a); near.add(line.dataset.b); }
    });
    svg.querySelectorAll('.graph-node').forEach(item => item.classList.toggle('is-near', Boolean(id) && near.has(item.dataset.node)));
  };
  for (const type of ['pointerover', 'focusin']) svg.addEventListener(type, event => set(event.target.closest('.graph-node')?.dataset.node));
  for (const type of ['pointerleave', 'focusout']) svg.addEventListener(type, () => set(null));
}
