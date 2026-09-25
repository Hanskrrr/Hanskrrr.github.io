import { audioTracks } from '../../content/audio.js';
import { photoCatalog } from '../../content/photos.js';

/** ~/articles/<genre>/<sub>/<id>.md, mirroring the blog's topics. */
export const articlePath = (home, article) => `${home}/articles/${article.topic ? `${article.topic}/` : ''}${article.id}.md`;

/**
 * A read-only catalog for the public terminal. This is an in-memory filesystem,
 * not access to the visitor's computer or a server shell.
 */
export function createFilesystem(articles = [], { photos = photoCatalog, tracks = audioTracks } = {}) {
  const home = '/home/guest';
  const nodes = new Map();
  const children = new Map();
  const sortByName = (left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  const fail = (code, path) => Object.assign(new Error(`${code}: ${path}`), { code, path });

  function add(path, type, attributes = {}) {
    const name = path === '/' ? '/' : path.slice(path.lastIndexOf('/') + 1);
    if (nodes.has(path)) throw new TypeError(`Duplicate public catalog path: ${path}`);
    const action = attributes.action ? Object.freeze({ ...attributes.action }) : undefined;
    const node = Object.freeze({ type, name, path, ...attributes, ...(action ? { action } : {}) });
    nodes.set(path, node);
    if (type === 'directory') children.set(path, []);
    if (path !== '/') {
      const parent = path.slice(0, path.lastIndexOf('/')) || '/';
      children.get(parent).push(node);
    }
    return node;
  }

  for (const path of ['/', '/home', home, `${home}/articles`]) add(path, 'directory');
  if (photos.length) add(`${home}/photos`, 'directory');
  if (tracks.length) add(`${home}/audio`, 'directory');
  add(`${home}/README.txt`, 'file', {
    content: [
      'Gallery terminal',
      '',
      '这是公开网站内容的只读目录。',
      '使用 ls 查看目录，cd 切换目录，cat 阅读文字，open 打开网页或媒体。',
      '',
      'tree articles',
      'cd articles/<分类>/<子分类>',
      'less <文章>.md',
      'open <文章>.md',
      'cd ~',
      '',
      '输入 help 查看可用命令。',
    ].join('\n'),
  });
  add(`${home}/about.txt`, 'file', {
    content: 'Hanskrrr\n\n文章和一些像素小实验。\n终端在浏览器内运行，只提供本站公开内容的只读目录。',
    action: { type: 'about' },
  });

  for (const article of articles) {
    if (!article || typeof article.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(article.id)) {
      throw new TypeError('Public article IDs must contain only letters, digits, underscores or hyphens.');
    }
    if (article.topic !== undefined && !/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(article.topic)) throw new TypeError('Article topics look like genre/sub or genre.');
    const content = [`# ${article.title}`, article.summary, article.text].filter(Boolean).join('\n\n');
    const path = articlePath(home, article);
    const missing = [];
    for (let dir = path.slice(0, path.lastIndexOf('/')); !nodes.has(dir); dir = dir.slice(0, dir.lastIndexOf('/'))) missing.unshift(dir);
    missing.forEach(dir => add(dir, 'directory'));
    add(path, 'file', { content, action: { type: 'article', id: article.id } });
  }
  for (const [index,photo] of photos.entries()) {
    add(`${home}/photos/${photo.file}`, 'file', {
      content: null, media: true, action: { type: 'photo', id: photo.id, index },
    });
  }
  for (const track of tracks) {
    add(`${home}/audio/${track.file}`, 'file', { content: null, media: true, action: { type: 'audio', id: track.id } });
  }
  for (const entries of children.values()) entries.sort(sortByName);

  function expand(path, cwd) {
    if (typeof path !== 'string' || typeof cwd !== 'string' || path.includes('\0') || cwd.includes('\0')) {
      throw fail('EINVAL', String(path));
    }
    if (path === '~' || path.startsWith('~/')) return home + path.slice(1);
    if (path.startsWith('/')) return path;
    return `${cwd.startsWith('/') ? cwd : `${home}/${cwd}`}/${path}`;
  }

  /** Lexical normalization only. get/list separately validate traversal. */
  function resolve(path = '', cwd = home) {
    const parts = [];
    for (const part of expand(path, cwd).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return `/${parts.join('/')}`;
  }

  function get(path = '', cwd = home) {
    const fullPath = expand(path, cwd);
    const parts = fullPath.split('/').filter(Boolean);
    let current = nodes.get('/');
    for (const part of parts) {
      // Validate before handling '.' or '..': files cannot be traversed through.
      if (current.type !== 'directory') throw fail('ENOTDIR', current.path);
      if (part === '.') continue;
      if (part === '..') {
        current = nodes.get(current.path.slice(0, current.path.lastIndexOf('/')) || '/');
      } else {
        current = nodes.get(`${current.path === '/' ? '' : current.path}/${part}`);
        if (!current) return null;
      }
    }
    if (fullPath.endsWith('/') && current.type !== 'directory') throw fail('ENOTDIR', current.path);
    return current;
  }

  function list(path = '', cwd = home) {
    const node = get(path, cwd);
    if (!node) throw fail('ENOENT', path);
    if (node.type !== 'directory') throw fail('ENOTDIR', node.path);
    return [...children.get(node.path)];
  }

  function complete(prefix = '', cwd = home, { directoriesOnly = false } = {}) {
    if (typeof prefix !== 'string') return [];
    if (prefix === '~') return ['~/'];
    const slash = prefix.lastIndexOf('/');
    const leading = slash === -1 ? '' : prefix.slice(0, slash + 1);
    const partialName = prefix.slice(slash + 1);
    try {
      const entries = list(leading || '.', cwd);
      return entries
        .filter(node => (!directoriesOnly || node.type === 'directory') && node.name.startsWith(partialName))
        .map(node => `${leading}${node.name}${node.type === 'directory' ? '/' : ''}`);
    } catch {
      return [];
    }
  }

  return Object.freeze({ home, resolve, get, list, complete });
}
