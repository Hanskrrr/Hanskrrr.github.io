// One handler per public command. Each receives (args, { ctx, result, name }) and
// returns a result: { recognized, echo, remember, lines, action? }. Handlers never
// touch the DOM; the terminal page turns `action` into an effect (see ../actions.js).
import { audioTracks } from '../../content/audio.js';
import { photoCatalog } from '../../content/photos.js';
import { commandHelp, manuals, terminalThemeNames } from './manual.js';
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
  if (node.type === 'directory') return ctx.errorResult(name, '这是目录；使用 ls 查看。');
  if (node.media) return ctx.errorResult(name, '这是媒体文件；使用 gallery 或 player。');
  result.lines = [ctx.line(node.content || '')];
  return result;
}

export const commands = {
  help: noArgs((args, { ctx, result }) => {
    result.lines = commandHelp.map(([usage]) => ctx.line(usage, 'help'));
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
    if (args.length > 1 || (args.length && !terminalThemeNames.includes(args[0]))) return ctx.errorResult(name, '可选名称：linux、blue、light。');
    result.action = { type: 'theme', name: args[0] };
    return result;
  },

  cd(args, { ctx, result, name }) {
    if (args.length > 1) return ctx.usage(name);
    const { state } = ctx;
    const node = ctx.nodeFor(args[0] === '-' ? state.previous : args[0] ?? ctx.fs.home);
    if (node.type !== 'directory') return ctx.errorResult(name, '不是目录。');
    state.previous = state.cwd;
    state.cwd = node.path;
    if (args[0] === '-') result.lines = [ctx.line(state.cwd)];
    return result;
  },

  ls(args, { ctx, result, name }) {
    const flags = args.filter(value => value.startsWith('-'));
    const paths = args.filter(value => !value.startsWith('-'));
    if (flags.some(value => !['-a', '-1'].includes(value)) || paths.length > 1) return ctx.usage(name);
    result.lines = ctx.directoryListing(ctx.nodeFor(paths[0] ?? '.'), flags.includes('-a'));
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
    const title = command ? `man ${command}` : '命令手册';
    const body = command
      ? [commandHelp.find(([usage]) => usage.split(' ')[0] === command)[0], '', ...manuals[command]].join('\n\n')
      : ['Gallery terminal 命令手册', '', ...commandHelp.map(([usage, description]) => `${usage}\n  ${description}`), '', '输入 man <command> 阅读详细说明。'].join('\n');
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
    if (root.media) return ctx.errorResult(name, '这是媒体文件；只能查找文本。');
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
    const tracks = audioTracks.filter(track => ids.has(track.id));
    if (!tracks.length) return ctx.errorResult(name, '没有可播放的音频。使用 player ~/audio/。');
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
      const photo = photoCatalog.find(entry => entry.id === item.action.id) || photoCatalog[item.action.index];
      return photo ? [photo] : [];
    });
    if (!photos.length) return ctx.errorResult(name, '没有可显示的图片。使用 gallery ~/photos/。');
    result.action = { type: 'gallery', photos, mode };
    return result;
  },

  cat: catOrOpen,
  open: catOrOpen,
};

/**
 * Earlier demo shortcuts. Each returns { lines } to answer directly, { name, args }
 * to run another command, or null for a usage error.
 */
export const aliases = {
  articles: (args, ctx) => args.length ? null : { lines: ctx.directoryListing(ctx.nodeFor(`${ctx.fs.home}/articles`)) },
  photos: (args, ctx) => args.length ? null : { lines: ctx.directoryListing(ctx.nodeFor(`${ctx.fs.home}/photos`)) },
  audio: (args, ctx) => args.length ? null : { lines: ctx.directoryListing(ctx.nodeFor(`${ctx.fs.home}/audio`)) },
  projects: (args, ctx) => args.length ? null : { lines: ctx.directoryListing(ctx.nodeFor(`${ctx.fs.home}/projects`)) },
  about: (args, ctx) => args.length ? null : { lines: [ctx.line(ctx.nodeFor(`${ctx.fs.home}/about.txt`).content)] },
  read: (args, ctx) => args.length === 1 && ctx.articles.some(article => article.id === args[0])
    ? { name: 'cat', args: [`${ctx.fs.home}/articles/${args[0]}.md`] } : null,
  photo: (args, ctx) => args.length === 1 && /^[1-3]$/.test(args[0])
    ? { name: 'open', args: [`${ctx.fs.home}/photos/0${args[0]}.svg`] } : null,
  play: (args, ctx) => args.length ? null : { name: 'open', args: [`${ctx.fs.home}/audio/sample.wav`] },
};
