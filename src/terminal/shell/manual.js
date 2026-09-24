// Public command list (help) and manual pages (man). help shows signatures only;
// the Chinese descriptions appear in `man`.
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
  ['pet', '和终端里的像素小生物互动'],
];

export const manuals = {
  help: ['列出可用命令及参数。', '详细操作使用 man <command>。'],
  pwd: ['输出当前目录的完整路径。'],
  ls: ['列出当前目录，或指定目录中的条目。', '-a 显示 ./ 与 ../；-1 每行一项（默认行为）。', '目录以 / 结尾。', '示例：ls ~/articles/'],
  cd: ['切换工作目录。没有参数时返回 ~。', '支持绝对路径、相对路径、~、..；cd - 返回上一个目录。', '示例：cd articles'],
  tree: ['递归打印公开目录树及目录、文件数量。', '没有参数时从当前目录开始，不改变工作目录。', '示例：tree ~/articles/'],
  cat: ['将一个文本文件的内容输出到终端。', '长文章适合使用 less 分页阅读。媒体请使用 gallery 或 player。', '示例：cat <文章>.md'],
  less: ['在终端内分页阅读一个文本文件。', '方向键 / j k 滚动，空格 / PageDown 翻页，PageUp 上翻，Home / End 到开头或结尾。', '/ 输入关键词搜索；Enter 确认；n / N 查找下一处 / 上一处。', 'q / Esc 退出，保留当前目录与之前的输出。', '示例：less <文章>.md'],
  open: ['打开文章的排版阅读页或明确指定的页面。', '目录会切换工作目录并列出内容。图片打开原图；音频进入字符播放器。', '示例：open <文章>.md'],
  grep: ['按字面文字查找，区分大小写；不支持正则表达式。', '-i 忽略大小写；-n 显示行号；可以合写为 -in。', '指定目录时递归搜索公开文本，跳过图片和音频。', '匹配词不回显，也不会保存在命令历史中。', '示例：grep -n "浏览器" articles/'],
  find: ['从指定目录或文件开始查找公开目录项。默认从当前目录开始。', '-name 只匹配文件名：* 代表任意数量字符，? 代表一个字符。', '输出完整路径；匹配区分大小写。', '示例：find ~/articles/ -name "*.md"'],
  head: ['显示文本文件的前 N 行，默认 10 行。', 'N 为 0 到 10000 的整数。', '示例：head -n 5 <文章>.md'],
  tail: ['显示文本文件的后 N 行，默认 10 行。', 'N 为 0 到 10000 的整数。', '示例：tail -n 5 <文章>.md'],
  wc: ['依次输出换行符数、按空白分隔的词语数、UTF-8 字节数和文件名。', '换行符数与视觉排版后的行数不同；中文词语不会自动分词。', '示例：wc <文章>.md'],
  man: ['在终端内阅读某条命令的说明。没有参数时显示手册目录。', '示例：man grep'],
  clear: ['清除终端输出，保留工作目录。也可以按 Ctrl+L。'],
  theme: ['显示或切换终端配色。', '可用主题：blue、linux、light；默认 blue。', '示例：theme blue'],
  blog: ['返回博客页面。'],
  sl: ['播放字符火车动画。', 'Esc 或 Ctrl+C 停止。'],
  stop: ['停止正在播放的音频。'],
  '2048': ['在终端内进行数字合并游戏。', '方向键 / WASD 移动，R 重开，q / Esc 退出。'],
  player: ['播放一个音频文件或目录中的曲目。无参数时使用 ~/audio/。', '上下选曲，Enter 播放，Space 暂停；左右跳转 5 秒。', 'N/P 切换曲目，+/- 调整音量；进度和频谱用字符显示。', 'q / Esc / Ctrl+C 退出，保留工作目录。', '示例：player audio/'],
  gallery: ['在终端字符网格内浏览图片。无参数时使用 ~/photos/。', '--ascii 彩色字符（默认）；--mono 单色字符；--blocks 彩色块字符。', '左右或 N/P 切图，A/M/B 切换上述三种显示模式。', 'O 明确打开原图；Esc 关闭原图后回到字符相册。', 'q / Esc / Ctrl+C 退出，保留工作目录。', '示例：gallery photos/ --blocks'],
  pet: ['和标志下方的像素小生物互动：它会跳一下并冒出 ♥。', '执行 clear 后它会随输出一起清除；再次输入 pet 会把它叫回来。'],
};

// Kept here (not imported from core/theme.js) so the shell stays DOM-free and testable.
export const terminalThemeNames = ['linux', 'blue', 'light'];
