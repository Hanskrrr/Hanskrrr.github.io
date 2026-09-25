// The text files in the terminal's home folder (/home/guest). Edit freely.
// Names starting with "." are hidden: only `ls -a`, `ls -la` and `find` show them.
export const terminalFiles = {
  'README.txt': [
    'Gallery terminal',
    '',
    'A read-only view of this site\'s public content.',
    'ls to look around, cd to move, cat or less to read, open to see a page.',
    '',
    '  tree articles',
    '  cd articles/<topic>/<sub>',
    '  less <article>.md',
    '  open <article>.md',
    '  cd ~',
    '',
    'Type help for commands.',
    '',
    'The last guest left in a hurry.',
  ].join('\n'),
  'about.txt': 'Zespejo\n\nArticles and small pixel experiments.\nThis terminal runs in your browser: a read-only view of the site\'s public content.',
  // The previous guest's shell history.
  '.bash_history': [
    'ls',
    'cat README.txt',
    'cd articles',
    'tree',
    'less web/security/web-crypto.md',
    'grep -n "key" web/security/web-crypto.md',
    'cd ~',
    'ls -la',
    'man theme',
    'theme',
    'theme uv',
    'exit',
  ].join('\n'),
};
