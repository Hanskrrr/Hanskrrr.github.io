// A character-cell screen: every visible element is text with optional ANSI-like
// foreground/background colors. Programs never render graphical controls here.
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined,{granularity:'grapheme'}) : null;
const clean = text => String(text ?? '').replace(/\t/g,'    ').replace(/[\r\n]/g,' ').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
export function graphemeCells(text) {
  const parts = segmenter ? Array.from(segmenter.segment(clean(text)),part => part.segment) : Array.from(clean(text));
  return parts.map(character => {
    const code = character.codePointAt(0);
    const wide = code >= 0x1100 && (code <= 0x115f || code === 0x2329 || code === 0x232a
      || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3)
      || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe10 && code <= 0xfe6f)
      || (code >= 0xff01 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6)
      || (code >= 0x1f300 && code <= 0x1faff) || code >= 0x20000);
    return {text:character,width:/^\p{Mark}+$/u.test(character) ? 0 : wide ? 2 : 1};
  });
}
export const cellLength = text => graphemeCells(text).reduce((sum,part) => sum+part.width,0);
export function clipCells(text, columns) {
  let result = '', used = 0;
  for (const part of graphemeCells(text)) {
    if (used+part.width > columns) break;
    result += part.text;
    used += part.width;
  }
  return result;
}
export function padCells(text, columns) {
  const clipped = clipCells(text,columns);
  return clipped+' '.repeat(Math.max(0,columns-cellLength(clipped)));
}
export function clipRuns(runs, columns) {
  const output = [];
  let remaining = Math.max(0,columns);
  for (const run of runs) {
    const width = cellLength(run.text);
    const text = clipCells(run.text,remaining);
    if (text) output.push({...run,text});
    // Clipping must retain a prefix of the full line. In particular, a wide
    // glyph that cannot fit must not be replaced by a later narrow run.
    if (width > remaining) break;
    remaining -= width;
  }
  return output;
}
const palette = {ink:'--ink',muted:'--faint',accent:'--tty-directory',user:'--tty-user',host:'--tty-host',error:'--tty-error',bg:'--bg'};
const color = value => /^#[\da-f]{6}$/i.test(value || '') ? value : palette[value] ? `var(${palette[value]})` : '';

export function createTextScreen(container,{signal,title = '终端程序',onKey = () => {},onResize = () => {}} = {}) {
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const pre = doc.createElement('pre');
  pre.className = 'tty-screen';
  pre.setAttribute('aria-label',title);
  pre.setAttribute('aria-live','off');
  container.append(pre);
  container.tabIndex = 0;
  let columns = 0, rows = 0, disposed = false, scheduled = 0;
  const measure = () => {
    const nextColumns = Math.max(12,Math.floor(((container.clientWidth || win.innerWidth)-16)/8));
    const nextRows = Math.max(6,Math.floor(((win.visualViewport?.height || win.innerHeight)-16)/16));
    const changed = nextColumns !== columns || nextRows !== rows;
    columns = nextColumns; rows = nextRows;
    pre.style.height = `${rows*16}px`;
    return changed;
  };
  measure();
  const resized = () => {
    if (scheduled || disposed) return;
    scheduled = win.requestAnimationFrame(() => {
      scheduled = 0;
      if (!disposed && measure()) onResize();
    });
  };
  const keydown = event => { if (!disposed) onKey(event); };
  const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(resized) : null;
  observer?.observe(container);
  win.addEventListener('resize',resized);
  win.visualViewport?.addEventListener('resize',resized);
  container.addEventListener('keydown',keydown);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    win.cancelAnimationFrame(scheduled);
    win.removeEventListener('resize',resized);
    win.visualViewport?.removeEventListener('resize',resized);
    container.removeEventListener('keydown',keydown);
    signal?.removeEventListener('abort',dispose);
    pre.remove();
  };
  signal?.addEventListener('abort',dispose,{once:true});
  if (signal?.aborted) dispose();
  return {
    get columns() { return columns; }, get rows() { return rows; },
    render(lines) {
      if (disposed) return;
      const fragment = doc.createDocumentFragment();
      for (let row = 0; row < Math.min(rows,lines.length); row++) {
        const runs = Array.isArray(lines[row]) ? lines[row] : [{text:lines[row]}];
        for (const run of clipRuns(runs,columns)) {
          const span = doc.createElement('span');
          span.textContent = run.text;
          if (run.fg) span.style.color = color(run.fg);
          if (run.bg) span.style.backgroundColor = color(run.bg);
          fragment.append(span);
        }
        if (row < Math.min(rows,lines.length)-1) fragment.append(doc.createTextNode('\n'));
      }
      pre.replaceChildren(fragment);
    },
    focus() { if (!disposed) container.focus({preventScroll:true}); }, dispose,
  };
}
