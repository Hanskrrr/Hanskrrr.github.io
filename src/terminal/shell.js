import { createFilesystem } from './filesystem.js';
import { audioTracks } from '../content/audio.js';
import { photoCatalog } from '../content/photos.js';

export const commandHelp = [
  ['help', '查看命令'], ['pwd', '显示当前目录'],
  ['ls [-a] [path]', '列出目录或文件'], ['cd [path|-]', '切换目录；无参数回到 ~'],
  ['tree [path]', '查看目录树'], ['cat <file>', '在终端读取文本'],
  ['less <file>', '分页阅读文本'], ['open <path>', '打开文章或指定页面'],
  ['grep [-in] <text> <path>', '在文本文件或目录中查找文字'],
  ['find [path] [-name glob]', '查找文件；名称支持 * 和 ?'],
  ['head [-n N] <file>', '查看文本开头；默认 10 行'], ['tail [-n N] <file>', '查看文本结尾；默认 10 行'],
  ['wc <file>', '统计换行、词语和字节数'], ['man [command]', '阅读命令说明'],
  ['clear', '清屏'], ['theme [name]', '查看或切换终端风格'],
  ['blog', '返回博客'], ['sl', '字符火车；Esc 停止'], ['stop', '停止音频'],
  ['2048', '数字合并游戏'], ['player [path]', '播放音频目录或文件'],
  ['gallery [path] [--ascii|--mono|--blocks]', '在终端浏览字符相册'],
];

const manuals = {
  help: ['列出可用命令及参数。', '详细操作使用 man <command>。'],
  pwd: ['输出当前目录的完整路径。'],
  ls: ['列出当前目录，或指定目录中的条目。', '-a 显示 ./ 与 ../；-1 每行一项（默认行为）。', '目录以 / 结尾。', '示例：ls ~/articles/'],
  cd: ['切换工作目录。没有参数时返回 ~。', '支持绝对路径、相对路径、~、..；cd - 返回上一个目录。', '示例：cd articles'],
  tree: ['递归打印公开目录树及目录、文件数量。', '没有参数时从当前目录开始，不改变工作目录。', '示例：tree ~/articles/'],
  cat: ['将一个文本文件的内容输出到终端。', '长文章适合使用 less 分页阅读。媒体请使用 gallery 或 player。', '示例：cat articles/static-web.md'],
  less: ['在终端内分页阅读一个文本文件。', '方向键 / j k 滚动，空格 / PageDown 翻页，PageUp 上翻，Home / End 到开头或结尾。', '/ 输入关键词搜索；Enter 确认；n / N 查找下一处 / 上一处。', 'q / Esc 退出，保留当前目录与之前的输出。', '示例：less articles/static-web.md'],
  open: ['打开文章的排版阅读页或明确指定的页面。', '目录会切换工作目录并列出内容。图片打开原图；音频进入字符播放器。', '示例：open articles/static-web.md'],
  grep: ['按字面文字查找，区分大小写；不支持正则表达式。', '-i 忽略大小写；-n 显示行号；可以合写为 -in。', '指定目录时递归搜索公开文本，跳过图片和音频。', '匹配词不回显，也不会保存在命令历史中。', '示例：grep -n "浏览器" articles/'],
  find: ['从指定目录或文件开始查找公开目录项。默认从当前目录开始。', '-name 只匹配文件名：* 代表任意数量字符，? 代表一个字符。', '输出完整路径；匹配区分大小写。', '示例：find ~/articles/ -name "*.md"'],
  head: ['显示文本文件的前 N 行，默认 10 行。', 'N 为 0 到 10000 的整数。', '示例：head -n 5 articles/static-web.md'],
  tail: ['显示文本文件的后 N 行，默认 10 行。', 'N 为 0 到 10000 的整数。', '示例：tail -n 5 articles/static-web.md'],
  wc: ['依次输出换行符数、按空白分隔的词语数、UTF-8 字节数和文件名。', '换行符数与视觉排版后的行数不同；中文词语不会自动分词。', '示例：wc articles/static-web.md'],
  man: ['在终端内阅读某条命令的说明。没有参数时显示手册目录。', '示例：man grep'],
  clear: ['清除终端输出，保留工作目录。也可以按 Ctrl+L。'],
  theme: ['显示或切换终端配色。', '可用主题：blue、linux、light；默认 blue。', '示例：theme blue'],
  blog: ['返回博客页面。'],
  sl: ['播放字符火车动画。', 'Esc 或 Ctrl+C 停止。'],
  stop: ['停止正在播放的音频。'],
  '2048': ['在终端内进行数字合并游戏。', '方向键 / WASD 移动，R 重开，q / Esc 退出。'],
  player: ['播放一个音频文件或目录中的曲目。无参数时使用 ~/audio/。', '上下选曲，Enter 播放，Space 暂停；左右跳转 5 秒。', 'N/P 切换曲目，+/- 调整音量；进度和频谱用字符显示。', 'q / Esc / Ctrl+C 退出，保留工作目录。', '示例：player audio/'],
  gallery: ['在终端字符网格内浏览图片。无参数时使用 ~/photos/。', '--ascii 彩色字符（默认）；--mono 单色字符；--blocks 彩色块字符。', '左右或 N/P 切图，A/M/B 切换上述三种显示模式。', 'O 明确打开原图；Esc 关闭原图后回到字符相册。', 'q / Esc / Ctrl+C 退出，保留工作目录。', '示例：gallery photos/ --blocks'],
};

// Tokenization only: no expansions, substitution, redirects, pipes or evaluation.
export function parseCommand(line) {
  const tokens = [];
  let token = '', quote = '', escaped = false, started = false;
  for (const character of line.trim()) {
    if (escaped) { token += character; escaped = false; started = true; continue; }
    if (character === '\\' && quote !== "'") { escaped = true; started = true; continue; }
    if (quote) {
      if (character === quote) quote = '';
      else token += character;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; started = true; continue; }
    if (';|&<>`'.includes(character)) return { tokens, error: '暂不支持管道、重定向或组合命令。' };
    if (/\s/.test(character)) {
      if (started) { tokens.push(token); token = ''; started = false; }
    } else { token += character; started = true; }
  }
  if (quote || escaped) return { tokens, error: '引号或转义未结束。' };
  if (started) tokens.push(token);
  return { tokens };
}

const legacy = ['articles','photos','audio','projects','about','read','photo','play'];
const publicNames = [...commandHelp.map(([name]) => name.split(' ')[0]), ...legacy];
const themes = ['linux','blue','light'];

function matchesGlob(name, pattern) {
  const characters = [...name];
  let previous = [true, ...characters.map(() => false)];
  for (const token of pattern) {
    const next = Array(characters.length + 1).fill(false);
    if (token === '*') next[0] = previous[0];
    for (let index = 1; index <= characters.length; index++) {
      next[index] = token === '*'
        ? previous[index] || next[index - 1]
        : previous[index - 1] && (token === '?' || token === characters[index - 1]);
    }
    previous = next;
  }
  return previous[characters.length];
}

export function createShell(articles) {
  const fs = createFilesystem(articles);
  let cwd = fs.home;
  let previous = fs.home;
  const displayPath = path => path === fs.home ? '~' : path.startsWith(`${fs.home}/`) ? `~${path.slice(fs.home.length)}` : path;
  const quote = text => /^[\w./~+-]+$/.test(text) ? text : JSON.stringify(text);
  const echo = tokens => tokens.map(quote).join(' ');
  const line = (text, kind = 'text') => ({text,kind});
  const named = name => publicNames.includes(name);
  const errorResult = (name,message) => ({recognized:true, echo:name, lines:[line(`${name}: ${message}`,'error')], remember:false});
  const nodeFor = path => {
    if (path === '') throw Object.assign(new Error('文件或目录不存在。'),{code:'ENOENT'});
    const node = fs.get(path,cwd);
    if (!node) throw Object.assign(new Error('文件或目录不存在。'),{code:'ENOENT'});
    return node;
  };
  const directoryListing = (node, all = false) => {
    const nodes = node.type === 'directory' ? fs.list(node.path) : [node];
    const rows = nodes.map(item => line(item.name + (item.type === 'directory' ? '/' : ''), item.type === 'directory' ? 'directory' : item.media ? 'media' : 'file'));
    if (all && node.type === 'directory') rows.unshift(line('./','directory'),line('../','directory'));
    return rows;
  };
  const openNode = node => {
    if (node.type === 'directory') {
      previous = cwd;
      cwd = node.path;
      return {lines:directoryListing(node)};
    }
    return node.action ? {action:node.action,lines:[]} : {lines:[line(node.content || '')]};
  };
  const walk = node => [node, ...(node.type === 'directory' ? fs.list(node.path).flatMap(walk) : [])];
  const fileText = node => {
    if (node.type === 'directory') throw Object.assign(new Error(), {code:'EISDIR'});
    if (node.media) throw Object.assign(new Error(), {code:'EMEDIA'});
    return node.content || '';
  };
  const textRows = content => {
    // A final newline terminates the preceding line instead of adding an empty line.
    if (!content) return [];
    const rows = content.split('\n');
    if (content.endsWith('\n')) rows.pop();
    return rows;
  };
  const treeRows = node => {
    let directories = 0, files = 0;
    const rows = [line(displayPath(node.path),node.type === 'directory' ? 'directory' : node.media ? 'media' : 'file')];
    const descend = (parent,prefix) => {
      const children = fs.list(parent.path);
      children.forEach((child,index) => {
        const last = index === children.length - 1;
        rows.push(line(`${prefix}${last ? '└── ' : '├── '}${child.name}${child.type === 'directory' ? '/' : ''}`, child.type === 'directory' ? 'directory' : child.media ? 'media' : 'file'));
        if (child.type === 'directory') { directories++; descend(child,`${prefix}${last ? '    ' : '│   '}`); }
        else files++;
      });
    };
    if (node.type === 'directory') descend(node,'');
    else files++;
    rows.push(line(''),line(`${directories} 个目录，${files} 个文件`));
    return rows;
  };
  return {
    fs,
    get cwd() { return cwd; },
    get displayCwd() { return displayPath(cwd); },
    execute(raw) {
      const parsed = parseCommand(raw);
      const first = raw.trim().match(/^([a-z0-9]+)(?:\s|$)/)?.[1];
      if (parsed.error) return named(first) ? errorResult(first,parsed.error) : {recognized:false};
      let [name,...args] = parsed.tokens;
      if (!named(name)) return {recognized:false};
      const result = {recognized:true, echo:echo(parsed.tokens), remember:true, lines:[]};
      const usage = () => errorResult(name,`用法：${commandHelp.find(([usage]) => usage.split(' ')[0] === name)?.[0] || name}`);
      try {
        // Previous demo shortcuts remain usable; the directory commands are primary.
        if (['articles','photos','audio','projects'].includes(name) && !args.length) {
          result.lines = directoryListing(nodeFor(`${fs.home}/${name}`));
          return result;
        }
        if (name === 'about' && !args.length) { result.lines = [line(nodeFor(`${fs.home}/about.txt`).content)]; return result; }
        if (name === 'read' && args.length === 1 && articles.some(article => article.id === args[0])) {
          args = [`${fs.home}/articles/${args[0]}.md`]; name = 'cat';
        }
        if (name === 'photo' && args.length === 1 && /^[1-3]$/.test(args[0])) {
          args = [`${fs.home}/photos/0${args[0]}.svg`]; name = 'open';
        }
        if (name === 'play' && !args.length) { args = [`${fs.home}/audio/sample.wav`]; name = 'open'; }
        if (['help','pwd','clear','blog','sl','stop','2048'].includes(name)) {
          if (args.length) return usage();
          if (name === 'help') {
            result.lines = commandHelp.map(([usage]) => line(usage));
          } else if (name === 'pwd') result.lines = [line(cwd)];
          else result.action = {type:name};
          return result;
        }
        if (name === 'theme') {
          if (args.length > 1 || (args.length && !themes.includes(args[0]))) return errorResult(name,'可选名称：linux、blue、light。');
          result.action = {type:'theme',name:args[0]};
          return result;
        }
        if (name === 'cd') {
          if (args.length > 1) return usage();
          const node = nodeFor(args[0] === '-' ? previous : args[0] ?? fs.home);
          if (node.type !== 'directory') return errorResult(name,'不是目录。');
          previous = cwd;
          cwd = node.path;
          if (args[0] === '-') result.lines = [line(cwd)];
          return result;
        }
        if (name === 'ls') {
          const flags = args.filter(value => value.startsWith('-'));
          const paths = args.filter(value => !value.startsWith('-'));
          if (flags.some(value => !['-a','-1'].includes(value)) || paths.length > 1) return usage();
          result.lines = directoryListing(nodeFor(paths[0] ?? '.'),flags.includes('-a'));
          return result;
        }
        if (name === 'tree') {
          if (args.length > 1) return usage();
          result.lines = treeRows(nodeFor(args[0] ?? '.'));
          return result;
        }
        if (name === 'man') {
          if (args.length > 1 || (args.length && !Object.hasOwn(manuals,args[0]))) return usage();
          const command = args[0];
          const title = command ? `man ${command}` : '命令手册';
          const body = command
            ? [commandHelp.find(([usage]) => usage.split(' ')[0] === command)[0], '', ...manuals[command]].join('\n\n')
            : ['Gallery terminal 命令手册', '', ...commandHelp.map(([usage,description]) => `${usage}\n  ${description}`), '', '输入 man <command> 阅读详细说明。'].join('\n');
          result.action = {type:'pager',title,text:body};
          return result;
        }
        if (['less','head','tail','wc'].includes(name)) {
          let count = 10;
          if (name === 'head' || name === 'tail') {
            if (args[0] === '-n') {
              if (args.length !== 3 || !/^\d{1,5}$/.test(args[1]) || Number(args[1]) > 10000) return usage();
              count = Number(args[1]);
              args = [args[2]];
            }
          }
          if (args.length !== 1) return usage();
          const node = nodeFor(args[0]);
          const content = fileText(node);
          if (name === 'less') result.action = {type:'pager',title:displayPath(node.path),text:content};
          else if (name === 'wc') {
            const counts = [(content.match(/\n/g) || []).length, (content.match(/\S+/gu) || []).length, new TextEncoder().encode(content).length];
            result.lines = [line(`${counts.map(count => String(count).padStart(6)).join(' ')} ${args[0]}`)];
          } else {
            const rows = textRows(content);
            result.lines = count ? (name === 'head' ? rows.slice(0,count) : rows.slice(-count)).map(row => line(row)) : [];
          }
          return result;
        }
        if (name === 'grep') {
          let insensitive = false, numbers = false;
          while (args[0]?.startsWith('-')) {
            const flag = args.shift();
            if (flag === '--') break;
            if (!/^-[in]+$/.test(flag)) return usage();
            insensitive ||= flag.includes('i');
            numbers ||= flag.includes('n');
          }
          if (args.length !== 2) return usage();
          const [pattern,path] = args;
          const root = nodeFor(path);
          if (root.media) return errorResult(name,'这是媒体文件；只能查找文本。');
          // Search terms may contain a mistyped passphrase. Never echo or retain them.
          result.echo = `grep [pattern] ${quote(root.path)}`;
          result.remember = false;
          const needle = insensitive ? pattern.toLowerCase() : pattern;
          result.lines = walk(root).filter(node => node.type === 'file' && !node.media).flatMap(node => textRows(node.content || '').flatMap((row,index) => {
            const haystack = insensitive ? row.toLowerCase() : row;
            return haystack.includes(needle) ? [line(`${root.type === 'directory' ? `${displayPath(node.path)}:` : ''}${numbers ? `${index+1}:` : ''}${row}`)] : [];
          }));
          return result;
        }
        if (name === 'find') {
          let path = '.', pattern = null;
          if (args[0] && args[0] !== '-name') path = args.shift();
          if (args.length) {
            if (args.length !== 2 || args[0] !== '-name') return usage();
            pattern = args[1];
          }
          const node = nodeFor(path);
          // A small dynamic program supports only * and ? without regex backtracking.
          result.lines = walk(node).filter(item => pattern === null || matchesGlob(item.name,pattern)).map(item => line(item.path,item.type === 'directory' ? 'directory' : item.media ? 'media' : 'file'));
          // Only validated catalog paths are retained; a wildcard is arbitrary text.
          if (pattern !== null) { result.echo = `find ${quote(node.path)} -name [pattern]`; result.remember = false; }
          return result;
        }
        if (name === 'player') {
          if (args.length > 1) return usage();
          const node = nodeFor(args[0] ?? `${fs.home}/audio`);
          const nodes = node.type === 'directory' ? fs.list(node.path) : [node];
          const ids = new Set(nodes.filter(item => item.action?.type === 'audio').map(item => item.action.id));
          const tracks = audioTracks.filter(track => ids.has(track.id));
          if (!tracks.length) return errorResult(name,'没有可播放的音频。使用 player ~/audio/。');
          result.action = {type:'player',tracks};
          return result;
        }
        if (name === 'gallery') {
          let mode = 'ascii';
          const paths = [], flags = [];
          for (const arg of args) (arg.startsWith('--') ? flags : paths).push(arg);
          if (paths.length > 1 || flags.length > 1 || flags.some(flag => !['--ascii','--mono','--blocks'].includes(flag))) return usage();
          if (flags.length) mode = flags[0].slice(2);
          const node = nodeFor(paths[0] ?? `${fs.home}/photos`);
          const nodes = node.type === 'directory' ? fs.list(node.path) : [node];
          const photos = nodes.flatMap(item => {
            if (item.action?.type !== 'photo') return [];
            const photo = photoCatalog.find(photo => photo.id === item.action.id) || photoCatalog[item.action.index];
            return photo ? [photo] : [];
          });
          if (!photos.length) return errorResult(name,'没有可显示的图片。使用 gallery ~/photos/。');
          result.action = {type:'gallery',photos,mode};
          return result;
        }
        if (name === 'cat' || name === 'open') {
          if (args.length !== 1) return usage();
          const node = nodeFor(args[0]);
          if (name === 'cat') {
            if (node.type === 'directory') return errorResult(name,'这是目录；使用 ls 查看。');
            if (node.media) return errorResult(name,'这是媒体文件；使用 gallery 或 player。');
            result.lines = [line(node.content || '')];
          } else Object.assign(result,openNode(node));
          return result;
        }
        return usage();
      } catch (error) {
        // Invalid arguments are neither echoed nor retained in command history.
        return errorResult(name,({ENOTDIR:'路径中有非目录项。',EISDIR:'这是目录；使用 ls 查看。',EMEDIA:'这是媒体文件；使用 gallery 或 player。'})[error.code] || '文件或目录不存在。');
      }
    },
    complete(raw) {
      const match = raw.match(/^(.*\s)([^\s]*)$/);
      if (!match) return publicNames.filter(name => name.startsWith(raw));
      const [,start,prefix] = match;
      const parsed = parseCommand(start);
      if (parsed.error) return [];
      const [command,...args] = parsed.tokens;
      if (command === 'theme' && !args.length) return themes.filter(name => name.startsWith(prefix)).map(name => start+name);
      if (command === 'man' && !args.length) return commandHelp.map(([usage]) => usage.split(' ')[0]).filter(name => name.startsWith(prefix)).map(name => start+name);
      if (command === 'gallery' && prefix.startsWith('--')) {
        // A partial command is also printed when multiple completions are shown.
        // Include only a catalog path, never an arbitrary earlier argument.
        let validPath = !args.length;
        if (args.length === 1) {
          try {
            const node = nodeFor(args[0]);
            validPath = node.type === 'directory' || node.action?.type === 'photo';
          } catch { validPath = false; }
        }
        return validPath ? ['--ascii','--mono','--blocks'].filter(flag => flag.startsWith(prefix)).map(flag => start+flag) : [];
      }
      const pathPosition = !args.length || (command === 'ls' && args.every(arg => ['-a','-1'].includes(arg)))
        || (['head','tail'].includes(command) && args.length === 2 && args[0] === '-n' && /^\d{1,5}$/.test(args[1]) && Number(args[1]) <= 10000)
        || (command === 'gallery' && args.length === 1 && ['--ascii','--mono','--blocks'].includes(args[0]));
      if (pathPosition && ['cd','ls','cat','open','player','gallery','less','tree','find','head','tail','wc'].includes(command)) {
        return fs.complete(prefix,cwd,{directoriesOnly:command === 'cd'})
          .filter(path => command !== 'player' || path.endsWith('/') || fs.get(path,cwd)?.action?.type === 'audio')
          .filter(path => command !== 'gallery' || path.endsWith('/') || fs.get(path,cwd)?.action?.type === 'photo')
          .map(path => start+path);
      }
      if (command === 'read' && !args.length) return articles.filter(article => article.id.startsWith(prefix)).map(article => start+article.id);
      return [];
    },
  };
}
