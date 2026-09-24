import {createTextScreen,graphemeCells,clipCells} from '../text-screen.js';

export function layoutText(text, columns) {
  const width = Math.max(2,columns);
  const rows = [], logical = [];
  let offset = 0;
  for (const line of String(text).split(/\r?\n/)) {
    const cells = graphemeCells(line);
    let row = '', used = 0, start = offset;
    for (const cell of cells) {
      if (used+cell.width > width) {
        rows.push({text:row,start,end:offset});
        row = ''; used = 0; start = offset;
      }
      row += cell.text; used += cell.width; offset += cell.text.length;
    }
    rows.push({text:row,start,end:offset});
    logical.push(cells.map(cell => cell.text).join(''));
    offset++;
  }
  return {text:logical.join('\n'),rows};
}
export function wrapText(text, columns) {
  return layoutText(text,columns).rows.map(row => row.text);
}
export function matchingRows(lines,query) {
  if (!query) return [];
  return lines.flatMap((line,index) => line.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? [index] : []);
}
export function findTextMatches(layout, query) {
  if (!query) return [];
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matches = [];
  let row = 0;
  for (const match of layout.text.matchAll(new RegExp(literal,'giu'))) {
    while (row+1 < layout.rows.length && layout.rows[row].end <= match.index) row++;
    matches.push({start:match.index,end:match.index+match[0].length,row});
  }
  return matches;
}
export function highlightedRow(row, matches, activeIndex = -1) {
  const visible = matches.flatMap((match,index) => match.start < row.end && match.end > row.start ? [{...match,index}] : []);
  if (!visible.length) return row.text;
  const runs = [];
  let offset = row.start;
  for (const cell of graphemeCells(row.text)) {
    const end = offset+cell.text.length;
    const match = visible.find(item => item.start < end && item.end > offset);
    const fg = match ? 'bg' : undefined;
    const bg = match ? match.index === activeIndex ? 'host' : 'user' : undefined;
    const last = runs.at(-1);
    if (last && last.fg === fg && last.bg === bg) last.text += cell.text;
    else runs.push({text:cell.text,...(match ? {fg,bg} : {})});
    offset = end;
  }
  return runs;
}
export function advanceMatchIndex(index, count, forward = true) {
  if (!count) return -1;
  if (index < 0) return forward ? 0 : count-1;
  return (index+(forward ? 1 : -1)+count)%count;
}
export function mountPager(container,{signal,onExit,announce = () => {},title = 'less',text = ''} = {}) {
  let disposed = false, top = 0, query = '', matches = [], message = '', searching = false;
  let layout = {text:'',rows:[]}, matchIndex = -1;
  const input = container.ownerDocument.createElement('input');
  input.type = 'text'; input.className = 'sr-only'; input.autocomplete = 'off';
  input.setAttribute('aria-label','页内搜索');
  // A native text input supplies IME composition, while its visible contents are
  // drawn as the terminal's / prompt, never as a graphical input field.
  container.append(input);
  const screen = createTextScreen(container,{signal,title,onKey:key,onResize:resize});
  const pageSize = () => Math.max(1,screen.rows-3);
  const maxTop = () => Math.max(0,layout.rows.length-pageSize());
  function draw() {
    if (disposed) return;
    top = Math.max(0,Math.min(top,maxTop()));
    const body = layout.rows.slice(top,top+pageSize()).map(row => highlightedRow(row,matches,matchIndex));
    while (body.length < pageSize()) body.push([{text:'~',fg:'muted'}]);
    const progress = `${top+1}-${Math.min(layout.rows.length,top+pageSize())}/${layout.rows.length}${top===maxTop() ? ' (END)' : ''}`;
    screen.render([
      [{text:clipCells(title,screen.columns),fg:'accent'}],...body,
      [{text:`${clipCells(progress,Math.max(0,screen.columns-8))}  q:quit`,fg:'muted'}],
      searching ? `/${input.value}█` : [{text:message || (query ? `/${query}  ${matchIndex+1}/${matches.length} 处匹配` : 'Space:page /:find n/N:next/prev'),fg:message ? 'error' : 'user'}],
    ]);
  }
  function resize() {
    const offset = layout.rows[top]?.start ?? 0;
    const activeStart = matches[matchIndex]?.start;
    layout = layoutText(text,screen.columns);
    top = Math.max(0,layout.rows.findIndex(row => row.end > offset || row.start === offset));
    matches = findTextMatches(layout,query);
    matchIndex = matches.findIndex(match => match.start === activeStart);
    draw();
  }
  function search(next = true) {
    if (!matches.length) { message = '没有匹配。'; draw(); return; }
    matchIndex = advanceMatchIndex(matchIndex,matches.length,next);
    top = matches[matchIndex].row; message = ''; draw();
  }
  function exit() { dispose(); onExit?.(); }
  function key(event) {
    if (event.isComposing || event.keyCode === 229 || event.metaKey || event.altKey) return;
    if (searching) {
      if (event.key === 'Escape') {
        event.preventDefault(); searching = false; input.value = ''; screen.focus(); draw();
      } else if (event.key === 'Enter') {
        event.preventDefault(); query = input.value; searching = false; input.value = '';
        matches = findTextMatches(layout,query); message = matches.length ? '' : '没有匹配。';
        matchIndex = matches.findIndex(match => match.row>=top);
        if (matches.length) {
          if (matchIndex < 0) matchIndex = 0;
          top = matches[matchIndex].row;
        }
        screen.focus(); draw();
      } else if (event.ctrlKey && event.key.toLowerCase() === 'c') { event.preventDefault(); exit(); }
      return;
    }
    if (event.key === 'q' || event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase()==='c')) { event.preventDefault(); exit(); return; }
    if (event.ctrlKey) return;
    let handled = true;
    if (['ArrowDown','j'].includes(event.key)) top++;
    else if (['ArrowUp','k'].includes(event.key)) top--;
    else if ([' ','PageDown'].includes(event.key)) top+=pageSize();
    else if (['PageUp','b'].includes(event.key)) top-=pageSize();
    else if (['Home','g'].includes(event.key)) top=0;
    else if (['End','G'].includes(event.key)) top=maxTop();
    else if (event.key === '/') { searching = true; input.value = ''; input.focus({preventScroll:true}); }
    else if (event.key === 'n' || event.key === 'N') { event.preventDefault(); search(event.key==='n'); return; }
    else handled = false;
    if (handled) { event.preventDefault(); message = ''; draw(); }
  }
  const edit = () => draw();
  input.addEventListener('input',edit);
  function dispose() {
    if (disposed) return;
    disposed = true;
    input.removeEventListener('input',edit); input.remove();
    signal?.removeEventListener('abort',dispose); screen.dispose();
    query = ''; matches = []; layout = {text:'',rows:[]}; matchIndex = -1;
  }
  signal?.addEventListener('abort',dispose,{once:true});
  resize(); screen.focus(); announce(`已打开 ${title}。空格翻页，斜杠搜索，q 退出。`);
  if (signal?.aborted) dispose();
  return dispose;
}
