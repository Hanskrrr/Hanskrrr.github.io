// The virtual shell: parse a line, dispatch to a command handler, and complete
// partial input. It only reads the public content map and never runs OS commands.
import { aliases, commands } from './commands.js';
import { createContext } from './context.js';
import { audioTracks } from '../../content/audio.js';
import { photoCatalog } from '../../content/photos.js';
import { createFilesystem } from './filesystem.js';
import { commandHelp, terminalThemeNames } from './manual.js';
import { parseCommand } from './parse.js';

export { commandHelp } from './manual.js';
export { parseCommand } from './parse.js';

const publicNames = [...commandHelp.map(([usage]) => usage.split(' ')[0]), ...Object.keys(aliases)];
const galleryModes = ['--ascii', '--mono', '--blocks'];
const pathCommands = ['cd', 'ls', 'cat', 'open', 'player', 'gallery', 'less', 'tree', 'find', 'head', 'tail', 'wc'];
const errorText = {
  ENOTDIR: '路径中有非目录项。',
  EISDIR: '这是目录；使用 ls 查看。',
  EMEDIA: '这是媒体文件；使用 gallery 或 player。',
};

/** media: { photos, tracks } (defaults to the site's public catalogs). */
export function createShell(articles, media = {}) {
  const fs = createFilesystem(articles, media);
  const ctx = createContext(fs, articles, { photos: media.photos ?? photoCatalog, tracks: media.tracks ?? audioTracks });
  const named = name => publicNames.includes(name);

  function execute(raw) {
    const parsed = parseCommand(raw);
    const first = raw.trim().match(/^([a-z0-9]+)(?:\s|$)/)?.[1];
    if (parsed.error) return named(first) ? ctx.errorResult(first, parsed.error) : { recognized: false };
    let [name, ...args] = parsed.tokens;
    if (!named(name)) return { recognized: false };
    const result = { recognized: true, echo: ctx.echo(parsed.tokens), remember: true, lines: [] };
    try {
      if (Object.hasOwn(aliases, name)) {
        const outcome = aliases[name](args, ctx);
        if (!outcome) return ctx.usage(name);
        if (outcome.lines) return Object.assign(result, { lines: outcome.lines });
        ({ name, args } = outcome);
      }
      return commands[name](args, { ctx, result, name });
    } catch (error) {
      // Invalid arguments are neither echoed nor retained in command history.
      return ctx.errorResult(name, errorText[error.code] || '文件或目录不存在。');
    }
  }

  function complete(raw) {
    const match = raw.match(/^(.*\s)([^\s]*)$/);
    if (!match) return publicNames.filter(name => name.startsWith(raw));
    const [, start, prefix] = match;
    const parsed = parseCommand(start);
    if (parsed.error) return [];
    const [command, ...args] = parsed.tokens;
    const withStart = values => values.filter(value => value.startsWith(prefix)).map(value => start + value);
    if (command === 'theme' && !args.length) return withStart(terminalThemeNames);
    if (command === 'man' && !args.length) return withStart(commandHelp.map(([usage]) => usage.split(' ')[0]));
    if (command === 'gallery' && prefix.startsWith('--')) {
      // A partial command is also printed when multiple completions are shown.
      // Include only a catalog path, never an arbitrary earlier argument.
      let validPath = !args.length;
      if (args.length === 1) {
        try {
          const node = ctx.nodeFor(args[0]);
          validPath = node.type === 'directory' || node.action?.type === 'photo';
        } catch { validPath = false; }
      }
      return validPath ? withStart(galleryModes) : [];
    }
    const pathPosition = !args.length || (command === 'ls' && args.every(arg => ['-a', '-1'].includes(arg)))
      || (['head', 'tail'].includes(command) && args.length === 2 && args[0] === '-n' && /^\d{1,5}$/.test(args[1]) && Number(args[1]) <= 10000)
      || (command === 'gallery' && args.length === 1 && galleryModes.includes(args[0]));
    if (pathPosition && pathCommands.includes(command)) {
      const { fs, state } = ctx;
      return fs.complete(prefix, state.cwd, { directoriesOnly: command === 'cd' })
        .filter(path => command !== 'player' || path.endsWith('/') || fs.get(path, state.cwd)?.action?.type === 'audio')
        .filter(path => command !== 'gallery' || path.endsWith('/') || fs.get(path, state.cwd)?.action?.type === 'photo')
        .map(path => start + path);
    }
    if (command === 'read' && !args.length) return withStart(articles.map(article => article.id));
    return [];
  }

  return {
    fs: ctx.fs,
    get cwd() { return ctx.state.cwd; },
    get displayCwd() { return ctx.displayPath(ctx.state.cwd); },
    execute,
    complete,
  };
}
