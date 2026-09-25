// Shared state and helpers for shell commands: working directory, path lookup,
// listings and result builders. Everything here returns plain data (no DOM).
import { commandHelp } from './manual.js';

export function createContext(fs, articles, { photos = [], tracks = [] } = {}) {
  const state = { cwd: fs.home, previous: fs.home };
  const displayPath = path => path === fs.home ? '~' : path.startsWith(`${fs.home}/`) ? `~${path.slice(fs.home.length)}` : path;
  const quote = text => /^[\w./~+\-$@:=,{}%]+$/.test(text) ? text : JSON.stringify(text);
  const line = (text, kind = 'text') => ({ text, kind });
  const kindOf = node => node.type === 'directory' ? 'directory' : node.media ? 'media' : 'file';
  const hidden = node => node.name.startsWith('.');
  const newest = articles.map(article => article.date).filter(Boolean).sort().at(-1) || '2026-01-01';
  const bytes = node => node.type === 'directory' ? 4096 : new TextEncoder().encode(node.content || '').length;
  /** One `ls -l` row: a read-only tree owned by guest, dates in long-iso style. */
  const longRow = (node, width, name = node.name) => {
    const directory = node.type === 'directory';
    const links = directory ? 2 + fs.list(node.path).filter(child => child.type === 'directory').length : 1;
    return `${directory ? 'dr-xr-xr-x' : '-r--r--r--'} ${String(links).padStart(2)} guest guest ${String(bytes(node)).padStart(width)} ${node.date || newest} 00:00 ${name}${directory ? '/' : ''}`;
  };

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
    usage: name => ctx.errorResult(name, `usage: ${commandHelp.find(([usage]) => usage.split(' ')[0] === name)?.[0] || name}`),
    nodeFor(path) {
      if (path === '') throw Object.assign(new Error('No such file or directory'), { code: 'ENOENT' });
      const node = fs.get(path, state.cwd);
      if (!node) throw Object.assign(new Error('No such file or directory'), { code: 'ENOENT' });
      return node;
    },
    /** ls: hidden entries only with `all`; `long` adds permissions, size and date. */
    directoryListing(node, all = false, long = false) {
      const nodes = node.type === 'directory' ? fs.list(node.path).filter(item => all || !hidden(item)) : [node];
      const entries = nodes.map(item => [item, item.name]);
      if (all && node.type === 'directory') entries.unshift([node, '.'], [fs.get('..', node.path), '..']);
      if (!long) return entries.map(([item, name]) => line(name + (item.type === 'directory' ? '/' : ''), kindOf(item)));
      const width = Math.max(...entries.map(([item]) => String(bytes(item)).length));
      const rows = entries.map(([item, name]) => line(longRow(item, width, name), kindOf(item)));
      if (node.type === 'directory') rows.unshift(line(`total ${entries.length * 4}`));
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
        const children = fs.list(parent.path).filter(child => !hidden(child));
        children.forEach((child, index) => {
          const last = index === children.length - 1;
          rows.push(line(`${prefix}${last ? '└── ' : '├── '}${child.name}${child.type === 'directory' ? '/' : ''}`, kindOf(child)));
          if (child.type === 'directory') { directories++; descend(child, `${prefix}${last ? '    ' : '│   '}`); }
          else files++;
        });
      };
      if (node.type === 'directory') descend(node, '');
      else files++;
      rows.push(line(''), line(`${directories} ${directories === 1 ? 'directory' : 'directories'}, ${files} ${files === 1 ? 'file' : 'files'}`));
      return rows;
    },
    kindOf,
  };
  return ctx;
}
