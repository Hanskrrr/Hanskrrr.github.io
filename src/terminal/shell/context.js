// Shared state and helpers for shell commands: working directory, path lookup,
// listings and result builders. Everything here returns plain data (no DOM).
import { commandHelp } from './manual.js';

export function createContext(fs, articles, { photos = [], tracks = [] } = {}) {
  const state = { cwd: fs.home, previous: fs.home };
  const displayPath = path => path === fs.home ? '~' : path.startsWith(`${fs.home}/`) ? `~${path.slice(fs.home.length)}` : path;
  const quote = text => /^[\w./~+-]+$/.test(text) ? text : JSON.stringify(text);
  const line = (text, kind = 'text') => ({ text, kind });
  const kindOf = node => node.type === 'directory' ? 'directory' : node.media ? 'media' : 'file';

  const ctx = {
    fs,
    articles,
    photos,
    tracks,
    state,
    displayPath,
    quote,
    line,
    echo: tokens => tokens.map(quote).join(' '),
    errorResult: (name, message) => ({ recognized: true, echo: name, lines: [line(`${name}: ${message}`, 'error')], remember: false }),
    usage: name => ctx.errorResult(name, `用法：${commandHelp.find(([usage]) => usage.split(' ')[0] === name)?.[0] || name}`),
    nodeFor(path) {
      if (path === '') throw Object.assign(new Error('文件或目录不存在。'), { code: 'ENOENT' });
      const node = fs.get(path, state.cwd);
      if (!node) throw Object.assign(new Error('文件或目录不存在。'), { code: 'ENOENT' });
      return node;
    },
    directoryListing(node, all = false) {
      const nodes = node.type === 'directory' ? fs.list(node.path) : [node];
      const rows = nodes.map(item => line(item.name + (item.type === 'directory' ? '/' : ''), kindOf(item)));
      if (all && node.type === 'directory') rows.unshift(line('./', 'directory'), line('../', 'directory'));
      return rows;
    },
    openNode(node) {
      if (node.type === 'directory') {
        state.previous = state.cwd;
        state.cwd = node.path;
        return { lines: ctx.directoryListing(node) };
      }
      return node.action ? { action: node.action, lines: [] } : { lines: [line(node.content || '')] };
    },
    walk: node => [node, ...(node.type === 'directory' ? fs.list(node.path).flatMap(ctx.walk) : [])],
    fileText(node) {
      if (node.type === 'directory') throw Object.assign(new Error(), { code: 'EISDIR' });
      if (node.media) throw Object.assign(new Error(), { code: 'EMEDIA' });
      return node.content || '';
    },
    textRows(content) {
      // A final newline terminates the preceding line instead of adding an empty line.
      if (!content) return [];
      const rows = content.split('\n');
      if (content.endsWith('\n')) rows.pop();
      return rows;
    },
    treeRows(node) {
      let directories = 0, files = 0;
      const rows = [line(displayPath(node.path), kindOf(node))];
      const descend = (parent, prefix) => {
        const children = fs.list(parent.path);
        children.forEach((child, index) => {
          const last = index === children.length - 1;
          rows.push(line(`${prefix}${last ? '└── ' : '├── '}${child.name}${child.type === 'directory' ? '/' : ''}`, kindOf(child)));
          if (child.type === 'directory') { directories++; descend(child, `${prefix}${last ? '    ' : '│   '}`); }
          else files++;
        });
      };
      if (node.type === 'directory') descend(node, '');
      else files++;
      rows.push(line(''), line(`${directories} 个目录，${files} 个文件`));
      return rows;
    },
    kindOf,
  };
  return ctx;
}
