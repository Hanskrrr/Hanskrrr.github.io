// Public command list (help) and manual pages (man). help shows signatures only;
// the descriptions appear in `man`. A few commands work without being listed
// (su, sudo, logout, hostname, the write commands): see commands.js.
export const commandHelp = [
  ['help', 'list commands'], ['pwd', 'print the working directory'],
  ['ls [-la] [path]', 'list a directory'], ['cd [path|-]', 'change directory; no argument goes to ~'],
  ['tree [path]', 'show a directory tree'], ['cat <file>', 'print a text file'],
  ['less <file>', 'page through a text file'], ['open <path>', 'open an article or page'],
  ['grep [-in] <text> <path>', 'search text in a file or directory'],
  ['find [path] [-name glob]', 'find files; names support * and ?'],
  ['head [-n N] <file>', 'first lines of a file; 10 by default'], ['tail [-n N] <file>', 'last lines of a file; 10 by default'],
  ['wc <file>', 'count lines, words and bytes'], ['echo [text]', 'print text'],
  ['whoami', 'print your user name'], ['date', 'print the date and time'], ['uname [-a]', 'print system information'],
  ['history', 'list the commands you ran'], ['man [command]', 'read a manual page'],
  ['clear', 'clear the screen'], ['theme [name]', 'show or change the terminal colours'],
  ['blog', 'go back to the blog'], ['exit', 'leave the terminal'],
  ['sl', 'steam locomotive; Esc stops it'], ['stop', 'stop the audio'],
  ['2048', 'the number-merging game'], ['player [path]', 'play an audio folder or file'],
  ['gallery [path] [--ascii|--mono|--blocks]', 'browse photos as characters'],
  ['pet', 'say hi to the pixel creature'],
];

export const manuals = {
  help: ['List the available commands and their arguments.', 'Use man <command> for details.'],
  pwd: ['Print the full path of the working directory.'],
  ls: ['List the working directory, or the directory or file given.', '-a  also show entries starting with . (./ ../ and hidden files)', '-l  long listing: permissions, owner, size, date', '-1  one entry per line (the default)', 'Flags combine: ls -la', 'Directories end with /.', 'Example: ls ~/articles/'],
  cd: ['Change the working directory. With no argument, go to ~.', 'Absolute and relative paths, ~ and .. work; cd - goes back to the previous directory.', 'Example: cd articles'],
  tree: ['Print the directory tree and count directories and files.', 'Starts from the working directory when no path is given; does not change it.', 'Hidden files are not shown.', 'Example: tree ~/articles/'],
  cat: ['Print a text file.', 'For long articles, less is easier to read. Use gallery or player for media.', 'Example: cat <article>.md'],
  less: ['Page through a text file inside the terminal.', 'Arrows / j k scroll, Space / PageDown next page, PageUp previous page, Home / End jump.', '/ searches; Enter confirms; n / N next / previous match.', 'q / Esc quits and keeps your directory and earlier output.', 'Example: less <article>.md'],
  open: ['Open an article\'s reading page, or the page given.', 'A directory becomes the working directory and is listed. Images open full size; audio opens the player.', 'Example: open <article>.md'],
  grep: ['Search for literal text (case-sensitive; no regular expressions).', '-i  ignore case', '-n  show line numbers', 'Flags combine: -in', 'Given a directory, searches its text files recursively, skipping images and audio.', 'Search terms are not echoed or kept in history.', 'Example: grep -n "browser" articles/'],
  find: ['List entries under a directory or file (the working directory by default).', '-name matches file names only: * is any run of characters, ? is one character.', 'Prints full paths; matching is case-sensitive.', 'Example: find ~/articles/ -name "*.md"'],
  head: ['Print the first N lines of a text file (10 by default).', 'N is an integer from 0 to 10000.', 'Example: head -n 5 <article>.md'],
  tail: ['Print the last N lines of a text file (10 by default).', 'N is an integer from 0 to 10000.', 'Example: tail -n 5 <article>.md'],
  wc: ['Print the number of newlines, whitespace-separated words and UTF-8 bytes, then the file name.', 'Chinese text is not split into words.', 'Example: wc <article>.md'],
  echo: ['Print its arguments, separated by spaces.', '$USER, $HOME, $PWD, $SHELL and $HOSTNAME are expanded.', 'Example: echo hello $USER'],
  whoami: ['Print the user name of the current user.'],
  date: ['Print the current date and time.'],
  uname: ['Print the kernel name.', '-a  print everything'],
  history: ['List the commands you ran in this session, oldest first.', 'Commands that failed are not kept.'],
  man: ['Read a command\'s manual page inside the terminal. With no argument, show the index.', 'Example: man grep'],
  clear: ['Clear the output and keep the working directory. Ctrl+L does the same.'],
  theme: ['Show or change the terminal colours.', 'Themes: blue, linux, light. The default is blue.', 'Example: theme blue', 'BUGS', '  One theme is missing from this list. It only shows up with the lights off.'],
  blog: ['Go back to the blog.'],
  exit: ['Leave the terminal and go back to the blog. logout does the same.'],
  sl: ['Play the steam locomotive animation.', 'Esc or Ctrl+C stops it.'],
  stop: ['Stop the audio that is playing.'],
  '2048': ['Play the number-merging game in the terminal.', 'Arrows / WASD move, R restarts, q / Esc quits.'],
  player: ['Play an audio file or the tracks in a directory. With no argument, uses ~/audio/.', 'Up / Down choose, Enter plays, Space pauses; Left / Right skip 5 seconds.', 'N / P change track, + / - change the volume; progress and spectrum are drawn in characters.', 'q / Esc / Ctrl+C quit and keep your directory.', 'Example: player audio/'],
  gallery: ['Browse images as a character grid. With no argument, uses ~/photos/.', '--ascii  coloured characters (default)', '--mono   one-colour characters', '--blocks coloured half blocks', 'Left / Right or N / P change image; A / M / B change the mode above.', 'O opens the original image; Esc closes it and returns to the gallery.', 'q / Esc / Ctrl+C quit and keep your directory.', 'Example: gallery photos/ --blocks'],
  pet: ['Say hi to the pixel creature under the logo: it hops and shows a ♥.', 'clear removes it with the output; pet brings it back.'],
};

// Kept here (not imported from core/theme.js) so the shell stays DOM-free and testable.
export const terminalThemeNames = ['linux', 'blue', 'light'];
