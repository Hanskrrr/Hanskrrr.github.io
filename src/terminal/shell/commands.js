// One handler per public command. Each receives (args, { ctx, result, name }) and
// returns a result: { recognized, echo, remember, lines, action? }. Handlers never
// touch the DOM; the terminal page turns `action` into an effect (see ../actions.js).
import { commandHelp, manuals, terminalThemeNames } from './manual.js';
import { articlePath } from './filesystem.js';
import { matchesGlob } from './parse.js';

/** Commands that take no arguments and only emit an action of the same name. */
const plainActions = ['clear', 'blog', 'sl', 'stop', '2048', 'pet'];
const galleryModes = ['--ascii', '--mono', '--blocks'];

function noArgs(handler) {
  return (args, run) => args.length ? run.ctx.usage(run.name) : handler(args, run);
}

function readText(args, { ctx, result, name }) {
  let count = 10;
  if ((name === 'head' || name === 'tail') && args[0] === '-n') {
    if (args.length !== 3 || !/^\d{1,5}$/.test(args[1]) || Number(args[1]) > 10000) return ctx.usage(name);
    count = Number(args[1]);
    args = [args[2]];
  }
  if (args.length !== 1) return ctx.usage(name);
  const node = ctx.nodeFor(args[0]);
  const content = ctx.fileText(node);
  if (name === 'less') result.action = { type: 'pager', title: ctx.displayPath(node.path), text: content };
  else if (name === 'wc') {
    const counts = [(content.match(/\n/g) || []).length, (content.match(/\S+/gu) || []).length, new TextEncoder().encode(content).length];
    result.lines = [ctx.line(`${counts.map(value => String(value).padStart(6)).join(' ')} ${args[0]}`)];
  } else {
    const rows = ctx.textRows(content);
    result.lines = count ? (name === 'head' ? rows.slice(0, count) : rows.slice(-count)).map(row => ctx.line(row)) : [];
  }
  return result;
}

function catOrOpen(args, { ctx, result, name }) {
  if (args.length !== 1) return ctx.usage(name);
  const node = ctx.nodeFor(args[0]);
  if (name === 'open') return Object.assign(result, ctx.openNode(node));
  if (node.type === 'directory') return ctx.errorResult(name, `${args[0]}: Is a directory`);
  if (node.media) return ctx.errorResult(name, `${args[0]}: media file; use gallery or player`);
  result.lines = [ctx.line(node.content || '')];
  return result;
}

export const commands = {
  help: noArgs((args, { ctx, result }) => {
    // Media programs are listed only when the site has public photos or audio.
    const hidden = [...(ctx.photos.length ? [] : ['gallery']), ...(ctx.tracks.length ? [] : ['player'])];
    result.lines = commandHelp.filter(([usage]) => !hidden.includes(usage.split(' ')[0])).map(([usage]) => ctx.line(usage, 'help'));
    return result;
  }),
  pwd: noArgs((args, { ctx, result }) => {
    result.lines = [ctx.line(ctx.state.cwd)];
    return result;
  }),
  ...Object.fromEntries(plainActions.map(name => [name, noArgs((args, { result }) => {
    result.action = { type: name };
    return result;
  })])),

  theme(args, { ctx, result, name }) {
    // Not listed anywhere: `theme uv` changes the blog outside, not the terminal.
    if (args.length === 1 && args[0] === 'uv') return Object.assign(result, { action: { type: 'uv' } });
    if (args.length > 1 || (args.length && !terminalThemeNames.includes(args[0]))) return ctx.errorResult(name, 'themes: linux, blue, light');
    result.action = { type: 'theme', name: args[0] };
    return result;
  },

  cd(args, { ctx, result, name }) {
    if (args.length > 1) return ctx.usage(name);
    const { state } = ctx;
    const node = ctx.nodeFor(args[0] === '-' ? state.previous : args[0] ?? ctx.fs.home);
    if (node.type !== 'directory') return ctx.errorResult(name, `${args[0]}: Not a directory`);
    state.previous = state.cwd;
    state.cwd = node.path;
    if (args[0] === '-') result.lines = [ctx.line(state.cwd)];
    return result;
  },

  ls(args, { ctx, result, name }) {
    const flags = args.filter(value => value.startsWith('-') && value !== '-').join('').replaceAll('-', '');
    const paths = args.filter(value => !value.startsWith('-') || value === '-');
    if (/[^al1Ah]/.test(flags) || paths.length > 1) return ctx.usage(name);
    // -A (almost all) is treated like -a; -h is accepted and changes nothing.
    result.lines = ctx.directoryListing(ctx.nodeFor(paths[0] ?? '.'), /[aA]/.test(flags), flags.includes('l'));
    return result;
  },

  tree(args, { ctx, result, name }) {
    if (args.length > 1) return ctx.usage(name);
    result.lines = ctx.treeRows(ctx.nodeFor(args[0] ?? '.'));
    return result;
  },

  man(args, { ctx, result, name }) {
    if (args.length > 1 || (args.length && !Object.hasOwn(manuals, args[0]))) return ctx.usage(name);
    const command = args[0];
    const title = command ? `man ${command}` : 'manual';
    const body = command
      ? [commandHelp.find(([usage]) => usage.split(' ')[0] === command)[0], '', ...manuals[command]].join('\n\n')
      : ['Gallery terminal manual', '', ...commandHelp.map(([usage, description]) => `${usage}\n  ${description}`), '', 'Type man <command> for details.'].join('\n');
    result.action = { type: 'pager', title, text: body };
    return result;
  },

  less: readText,
  head: readText,
  tail: readText,
  wc: readText,

  grep(args, { ctx, result, name }) {
    let insensitive = false, numbers = false;
    while (args[0]?.startsWith('-')) {
      const flag = args.shift();
      if (flag === '--') break;
      if (!/^-[in]+$/.test(flag)) return ctx.usage(name);
      insensitive ||= flag.includes('i');
      numbers ||= flag.includes('n');
    }
    if (args.length !== 2) return ctx.usage(name);
    const [pattern, path] = args;
    const root = ctx.nodeFor(path);
    if (root.media) return ctx.errorResult(name, `${path}: media file; grep searches text only`);
    // Search terms may contain a mistyped passphrase. Never echo or retain them.
    result.echo = `grep [pattern] ${ctx.quote(root.path)}`;
    result.remember = false;
    const needle = insensitive ? pattern.toLowerCase() : pattern;
    result.lines = ctx.walk(root).filter(node => node.type === 'file' && !node.media).flatMap(node => ctx.textRows(node.content || '').flatMap((row, index) => {
      const haystack = insensitive ? row.toLowerCase() : row;
      return haystack.includes(needle) ? [ctx.line(`${root.type === 'directory' ? `${ctx.displayPath(node.path)}:` : ''}${numbers ? `${index + 1}:` : ''}${row}`)] : [];
    }));
    return result;
  },

  find(args, { ctx, result, name }) {
    let path = '.', pattern = null;
    if (args[0] && args[0] !== '-name') path = args.shift();
    if (args.length) {
      if (args.length !== 2 || args[0] !== '-name') return ctx.usage(name);
      pattern = args[1];
    }
    const node = ctx.nodeFor(path);
    result.lines = ctx.walk(node).filter(item => pattern === null || matchesGlob(item.name, pattern)).map(item => ctx.line(item.path, ctx.kindOf(item)));
    // Only validated catalog paths are retained; a wildcard is arbitrary text.
    if (pattern !== null) { result.echo = `find ${ctx.quote(node.path)} -name [pattern]`; result.remember = false; }
    return result;
  },

  player(args, { ctx, result, name }) {
    if (args.length > 1) return ctx.usage(name);
    const node = ctx.nodeFor(args[0] ?? `${ctx.fs.home}/audio`);
    const nodes = node.type === 'directory' ? ctx.fs.list(node.path) : [node];
    const ids = new Set(nodes.filter(item => item.action?.type === 'audio').map(item => item.action.id));
    const tracks = ctx.tracks.filter(track => ids.has(track.id));
    if (!tracks.length) return ctx.errorResult(name, 'nothing to play; try player ~/audio/');
    result.action = { type: 'player', tracks };
    return result;
  },

  gallery(args, { ctx, result, name }) {
    const paths = [], flags = [];
    for (const arg of args) (arg.startsWith('--') ? flags : paths).push(arg);
    if (paths.length > 1 || flags.length > 1 || flags.some(flag => !galleryModes.includes(flag))) return ctx.usage(name);
    const mode = flags.length ? flags[0].slice(2) : 'ascii';
    const node = ctx.nodeFor(paths[0] ?? `${ctx.fs.home}/photos`);
    const nodes = node.type === 'directory' ? ctx.fs.list(node.path) : [node];
    const photos = nodes.flatMap(item => {
      if (item.action?.type !== 'photo') return [];
      const photo = ctx.photos.find(entry => entry.id === item.action.id) || ctx.photos[item.action.index];
      return photo ? [photo] : [];
    });
    if (!photos.length) return ctx.errorResult(name, 'no images here; try gallery ~/photos/');
    result.action = { type: 'gallery', photos, mode };
    return result;
  },

  echo(args, { ctx, result }) {
    const env = { USER: 'guest', HOME: ctx.fs.home, PWD: ctx.state.cwd, SHELL: '/bin/bash', HOSTNAME: 'gallery' };
    result.lines = [ctx.line(args.join(' ').replace(/\$\{?([A-Z]+)\}?/g, (match, key) => env[key] ?? ''))];
    return result;
  },
  whoami: noArgs((args, { ctx, result }) => { result.lines = [ctx.line('guest')]; return result; }),
  hostname: noArgs((args, { ctx, result }) => { result.lines = [ctx.line('gallery')]; return result; }),
  date: noArgs((args, { ctx, result }) => { result.lines = [ctx.line(unixDate(new Date()))]; return result; }),
  uname(args, { ctx, result, name }) {
    if (args.length > 1 || (args.length && args[0] !== '-a')) return ctx.usage(name);
    result.lines = [ctx.line(args.length ? 'Linux gallery 6.6.6-zespejo #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' : 'Linux')];
    return result;
  },
  history: noArgs((args, { result }) => Object.assign(result, { action: { type: 'history' } })),
  exit: noArgs((args, { ctx, result }) => Object.assign(result, { lines: [ctx.line('logout')], action: { type: 'blog' } })),
  // Unlisted: su asks for a password (the room's) on a hidden prompt; the page handles it.
  su(args, { ctx, result, name }) {
    if (args.length > 1 || (args.length && !['-', 'root', 'zespejo'].includes(args[0]))) return ctx.errorResult(name, `user ${args.at(-1)} does not exist or the user entry does not contain all the required fields`);
    return Object.assign(result, { action: { type: 'su' } });
  },
  sudo(args, { ctx, result, name }) {
    if (!args.length) return ctx.usage(name);
    result.lines = [ctx.line('guest is not in the sudoers file.  This incident will be reported.', 'error')];
    return result;
  },

  cat: catOrOpen,
  open: catOrOpen,
};

/** `date` output: Fri Sep 25 17:04:12 GMT+8 2026 */
function unixDate(now) {
  const pad = value => String(value).padStart(2, '0');
  const zone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || 'UTC';
  const [weekday, month] = [now.toLocaleString('en', { weekday: 'short' }), now.toLocaleString('en', { month: 'short' })];
  return `${weekday} ${month} ${String(now.getDate()).padStart(2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${zone} ${now.getFullYear()}`;
}

/** Unlisted commands that would change files: the whole tree is read-only. */
export const writeCommands = ['rm', 'rmdir', 'mv', 'cp', 'mkdir', 'touch', 'chmod', 'chown', 'ln', 'vi', 'vim', 'nano', 'emacs'];
for (const name of writeCommands) {
  commands[name] = (args, { ctx, result }) => {
    result.lines = [ctx.line(`${name}: ${args.at(-1) ? `'${args.at(-1)}': ` : ''}Read-only file system`, 'error')];
    return result;
  };
}

/**
 * Earlier demo shortcuts. Each returns { lines } to answer directly, { name, args }
 * to run another command, or null for a usage error.
 */
export const aliases = {
  logout: args => ({ name: 'exit', args }),
  articles: (args, ctx) => args.length ? null : { lines: ctx.directoryListing(ctx.nodeFor(`${ctx.fs.home}/articles`)) },
  about: (args, ctx) => args.length ? null : { lines: [ctx.line(ctx.nodeFor(`${ctx.fs.home}/about.txt`).content)] },
  read: (args, ctx) => {
    const article = args.length === 1 && ctx.articles.find(item => item.id === args[0]);
    return article ? { name: 'cat', args: [articlePath(ctx.fs.home, article)] } : null;
  },
};
