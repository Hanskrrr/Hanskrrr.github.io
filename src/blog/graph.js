// The knowledge graph: articles, their topics, and the [[links]] between them.
// Topics give the tree (genre → sub-topic → article); links cut across it.
// Layout is a radial tree (deterministic, labels never overlap); links curve through the middle.
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
    // A genre without sub-topics holds its articles directly.
    edges.push({ a: article.topic.includes('/') ? `s:${article.topic}` : `g:${article.topic}`, b: article.id, kind: 'tree' });
    for (const target of article.links) {
      const key = [article.id, target].sort().join('|');
      if (seen.has(key) || !articles.some(item => item.id === target)) continue;
      seen.add(key);
      edges.push({ a: article.id, b: target, kind: 'link' });
    }
  }
  return { nodes, edges };
}

/**
 * A radial tree: genres near the middle, sub-topics around them, articles evenly spaced on the rim
 * (grouped by topic, a gap between genres). Deterministic. Returns Map<id, {x, y, angle}>.
 */
export function layout({ nodes, edges }, { size = 960 } = {}) {
  const parent = new Map(edges.filter(edge => edge.kind === 'tree').map(edge => [edge.b, edge.a]));
  const children = id => nodes.filter(node => parent.get(node.id) === id);
  const slots = [];                                   // article ids around the rim; null = a gap
  const groupOf = new Map();                          // a topic with no articles still gets a slot
  for (const genre of nodes.filter(node => node.kind === 'genre')) {
    for (const group of [genre, ...children(genre.id).filter(node => node.kind === 'sub')]) {
      const leaves = children(group.id).filter(node => node.kind === 'article');
      if (!leaves.length && group.kind === 'sub') { groupOf.set(slots.length, group.id); slots.push(null); }
      leaves.forEach(leaf => slots.push(leaf.id));
    }
    slots.push(null);
  }
  const c = size / 2;
  const ring = { genre: size * 0.1, sub: size * 0.185, article: size * 0.27 };
  const at = (angle, r) => ({ x: Math.round(c + Math.cos(angle) * r), y: Math.round(c + Math.sin(angle) * r), angle });
  const angles = new Map();
  slots.forEach((id, i) => { const angle = -Math.PI / 2 + (i / slots.length) * Math.PI * 2; if (id) angles.set(id, angle); else if (groupOf.has(i)) angles.set(groupOf.get(i), angle); });
  // A topic sits in the middle of the arc its articles cover.
  const span = id => {
    const own = angles.has(id) && !nodes.some(node => parent.get(node.id) === id) ? [angles.get(id)] : [];
    const all = [...own, ...children(id).flatMap(node => (node.kind === 'article' ? [angles.get(node.id)] : span(node.id)))];
    return all.filter(value => value !== undefined);
  };
  const result = new Map();
  for (const node of nodes) {
    if (node.kind === 'article') { result.set(node.id, at(angles.get(node.id), ring.article)); continue; }
    const arc = span(node.id);
    const angle = arc.length ? (Math.min(...arc) + Math.max(...arc)) / 2 : 0;
    result.set(node.id, at(angle, ring[node.kind]));
  }
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

/** The whole site as one SVG: the radial tree, with cross-links curving through the middle. */
export function globalGraph({ size = 960 } = {}) {
  const data = graphData();
  const pos = layout(data, { size });
  const c = size / 2;
  const byId = new Map(data.nodes.map(node => [node.id, node]));
  const genreOf = id => pos.get(`g:${byId.get(id).genre}`);
  const path = (edge, d) => `<path class="graph-edge edge-${edge.kind}" data-a="${escapeHtml(edge.a)}" data-b="${escapeHtml(edge.b)}" d="${d}"/>`;
  const edges = data.edges.map(edge => {
    const a = pos.get(edge.a), b = pos.get(edge.b);
    if (edge.kind === 'tree') {
      // Out from the parent along its ring, then straight out to the child.
      const bend = { x: Math.round(c + Math.cos(b.angle) * Math.hypot(a.x - c, a.y - c)), y: Math.round(c + Math.sin(b.angle) * Math.hypot(a.x - c, a.y - c)) };
      return path(edge, `M${a.x} ${a.y}Q${bend.x} ${bend.y} ${b.x} ${b.y}`);
    }
    // Links bundle through the two articles' genres, pulled halfway to the centre.
    const [ga, gb] = [genreOf(edge.a), genreOf(edge.b)].map(g => ({ x: Math.round(c + (g.x - c) * 0.5), y: Math.round(c + (g.y - c) * 0.5) }));
    return path(edge, `M${a.x} ${a.y}C${ga.x} ${ga.y} ${gb.x} ${gb.y} ${b.x} ${b.y}`);
  }).join('');
  const nodesMarkup = data.nodes.map(node => {
    const p = pos.get(node.id);
    const size = SIZE[node.kind];
    const box = `<rect x="${p.x - size / 2}" y="${p.y - size / 2}" width="${size}" height="${size}"/>`;
    // Labels run outward along the radius, flipped on the left so they read left to right.
    const left = Math.cos(p.angle) < -0.001;
    const deg = (p.angle * 180) / Math.PI + (left ? 180 : 0);
    const gap = size / 2 + 6;
    const lx = Math.round(p.x + Math.cos(p.angle) * gap), ly = Math.round(p.y + Math.sin(p.angle) * gap);
    const short = [...node.label].length > 14 ? `${[...node.label].slice(0, 13).join('')}…` : node.label;
    // Topic names stay level (with a halo over the lines); genres under their node, sub-topics beside.
    const label = node.kind === 'article'
      ? `<text class="${left ? 'end' : 'start'}" transform="translate(${lx} ${ly}) rotate(${deg.toFixed(1)})" dy="0.35em">${escapeHtml(short)}</text>`
      : node.kind === 'genre'
        ? `<text class="halo" x="${p.x}" y="${p.y + size / 2 + 18}">${escapeHtml(node.label)}</text>`
        : `<text class="halo ${left ? 'end' : 'start'}" x="${p.x + (left ? -gap : gap)}" y="${p.y}" dy="0.35em">${escapeHtml(node.label)}</text>`;
    const attrs = `class="graph-node node-${node.kind} tone-${toneOf(node.genre)}" data-node="${escapeHtml(node.id)}"`;
    const title = `<title>${escapeHtml(node.label)}</title>`;
    if (node.kind === 'article') return `<a href="/articles/${node.id}/" data-article="${node.id}" ${attrs}>${title}${box}${label}</a>`;
    return `<a href="/?view=blog" data-topic="${escapeHtml(node.id.slice(2))}" ${attrs}>${title}${box}${label}</a>`;
  }).join('');
  return `<svg class="knowledge-graph radial-graph" viewBox="0 0 ${size} ${size}" role="img" aria-label="文章关系图">${edges}${nodesMarkup}</svg>`;
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
