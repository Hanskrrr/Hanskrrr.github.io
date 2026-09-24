// Fixed character grids: the logo can be rendered with terminal foreground
// colors alone. Wide letterforms use box-drawing strokes as their extrusion.
const wide = {
  G: [' █████╗','██╔═══╝','██║███╗','██║ ██║','╚████╔╝',' ╚═══╝ '],
  A: [' ████╗ ','██╔═██╗','██████║','██╔═██║','██║ ██║','╚═╝ ╚═╝'],
  L: ['██╗   ','██║   ','██║   ','██║   ','█████╗','╚════╝'],
  E: ['█████╗','██╔══╝','████╗ ','██╔═╝ ','█████╗','╚════╝'],
  R: ['█████╗ ','██╔═██╗','█████╔╝','██╔═██╗','██║ ██║','╚═╝ ╚═╝'],
  Y: ['██╗ ██╗','╚██▄██╝',' ╚███╔╝','  ██╔╝ ','  ██║  ','  ╚═╝  '],
};
const compact = {
  G: ['▄██▄','█   ','█ ██','█  █','▀██▀'],
  A: ['▄██▄','█  █','████','█  █','█  █'],
  L: ['█   ','█   ','█   ','█   ','████'],
  E: ['████','█   ','███ ','█   ','████'],
  R: ['███▄','█  █','███▀','█ ▀▄','█  █'],
  Y: ['█  █','▀▄▄▀',' ██ ',' ██ ',' ██ '],
};
const compose = font => font.G.map((_, row) => [...'GALLERY'].map(letter => font[letter][row]).join(' '));

function shade(rows) {
  const grid = Array.from({length: rows.length + 1}, () => Array(rows[0].length + 1).fill(' '));
  rows.forEach((row, y) => [...row].forEach((character, x) => {
    if (character !== ' ') grid[y + 1][x + 1] = '░';
  }));
  rows.forEach((row, y) => [...row].forEach((character, x) => {
    if (character !== ' ') grid[y][x] = character;
  }));
  return grid.map(row => row.join(''));
}

export const bannerArt = {wide: compose(wide), compact: shade(compose(compact))};

export function createTerminalBanner(document = globalThis.document) {
  const banner = document.createElement('div');
  banner.className = 'tty-banner';
  banner.setAttribute('role', 'img');
  banner.setAttribute('aria-label', 'GALLERY');
  for (const [size, rows] of Object.entries(bannerArt)) {
    const pre = document.createElement('pre');
    pre.className = `tty-banner-${size}`;
    pre.setAttribute('aria-hidden', 'true');
    rows.forEach((row, index) => {
      for (const run of row.match(/[█▀▄ ]+|[^█▀▄ ]+/gu) || []) {
        const span = document.createElement('span');
        span.className = /[█▀▄]/u.test(run) ? 'tty-banner-face' : 'tty-banner-edge';
        span.textContent = run;
        pre.append(span);
      }
      if (index < rows.length - 1) pre.append(document.createTextNode('\n'));
    });
    banner.append(pre);
  }
  return banner;
}
