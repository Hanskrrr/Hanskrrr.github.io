// The /terminal/ page: prompt, input line, history, command dispatch, full-screen
// programs (player, gallery, pager, 2048), the sl train and the unlock attempt.
import { $, announce, el, main, reducedMotion, storage } from '../core/dom.js';
import { app, navigate } from '../core/router.js';
import { terminalThemes, updateBrowserColor } from '../core/theme.js';
import { articles } from '../content/articles.js';
import { audioTracks } from '../content/audio.js';
import { photoCatalog } from '../content/photos.js';
import { unlockExhibit } from '../vault/crypto.js';
import { openExhibit, startUnlock } from '../vault/exhibit.js';
import { createTerminalBanner } from './banner.js';
import { createShell } from './shell.js';
import { mount2048 } from './programs/game-2048.js';
import { mountGallery } from './programs/gallery.js';
import { mountPager } from './programs/pager.js';
import { mountPlayer } from './programs/player.js';
import { runTrain } from './programs/train.js';

const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined,{granularity:'grapheme'}) : null;
const shell = createShell(articles);
let publicHistory = [];
let historyIndex = 0;
let terminalSnapshot;
let trainController;
let activeProgram;

function promptText(path = shell.displayCwd) { return `guest@gallery:${path}$ `; }
function makePrompt(path = shell.displayCwd) {
  const prompt = el('span','tty-prompt');
  prompt.append(el('span','tty-user','guest'), '@', el('span','tty-host','gallery'), ':', el('span','tty-path',path), '$ ');
  return prompt;
}
function updatePrompt() {
  $('#terminal-form .tty-prompt')?.replaceWith(makePrompt());
  $('#terminal-form')?.style.setProperty('--prompt-width',`${promptText().length}ch`);
}
export function rememberTerminal() {
  const output = $('#terminal-output');
  if (app.view !== 'terminal' || !output) return;
  // Only public output survives internal navigation; input and decrypted content
  // are never part of this snapshot, and nothing is written to browser storage.
  terminalSnapshot = output.cloneNode(true);
  terminalSnapshot.querySelectorAll('.tty-pending,.tty-train-stage').forEach(node => node.remove());
}
function renderTerminal() {
  main.innerHTML = `<section class="tty" aria-label="终端"><h1 class="sr-only">终端</h1><div class="tty-output" id="terminal-output" role="log" aria-label="终端输出" aria-live="polite"></div><form class="tty-form" id="terminal-form"><label class="sr-only" for="terminal-input">终端指令</label><div class="tty-edit-render" aria-hidden="true"><span class="tty-prompt"></span><span id="tty-before"></span><span id="tty-cursor" class="tty-cursor"> </span><span id="tty-after"></span></div><textarea id="terminal-input" rows="1" aria-label="终端指令" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="1024" enterkeyhint="send"></textarea><button class="sr-only" type="submit" aria-label="执行指令">执行指令</button></form></section>`;
  if (terminalSnapshot) $('#terminal-output').replaceWith(terminalSnapshot.cloneNode(true));
  else $('#terminal-output').append(createTerminalBanner(),el('p','tty-line','Type help for commands.'),el('p','tty-line',''));
  updatePrompt();
  historyIndex = publicHistory.length;
  $('#terminal-form').addEventListener('submit', executeCommand);
  const input = $('#terminal-input');
  input.addEventListener('keydown', terminalKeys);
  input.addEventListener('beforeinput',event => {
    if (!event.isComposing && ['insertLineBreak','insertParagraph'].includes(event.inputType)) {
      event.preventDefault();
      input.form.requestSubmit();
    }
  });
  ['input','keyup','click','select','focus','blur','compositionend'].forEach(name => input.addEventListener(name,syncTerminalInput));
  input.addEventListener('input',() => revealPrompt());
  syncTerminalInput();
}
// Keep a native text control for IME, selection and mobile keyboards; render its
// current line in the same character flow as output, including a block cursor.
// This mirror is cleared together with the input before a candidate is checked.
function syncTerminalInput() {
  const input = $('#terminal-input');
  if (!input) return;
  if (/[\r\n]/.test(input.value)) {
    const caret = input.selectionStart;
    const removed = (input.value.slice(0,caret).match(/[\r\n]/g) || []).length;
    input.value = input.value.replace(/[\r\n]/g,'');
    input.setSelectionRange(caret-removed,caret-removed);
  }
  const at = input.selectionStart ?? input.value.length;
  const rest = input.value.slice(at);
  const character = rest ? (graphemes ? graphemes.segment(rest)[Symbol.iterator]().next().value.segment : Array.from(rest)[0]) : '\u00a0';
  const parts = [[$('#tty-before'),input.value.slice(0,at)],[$('#tty-cursor'),character],[$('#tty-after'),rest.slice(rest ? character.length : 0)]];
  parts.forEach(([node,text]) => { if (node.textContent !== text) node.textContent = text; });
  $('#terminal-form').classList.toggle('tty-selecting',input.selectionStart !== input.selectionEnd);
}
function setTerminalInput(value) {
  const input = $('#terminal-input');
  if (!input) return;
  input.value = value;
  input.setSelectionRange(value.length,value.length);
  syncTerminalInput();
}
function logLine(text, type = '', path = shell.displayCwd) {
  const output = $('#terminal-output');
  if (!output) return;
  const line = el('p',`tty-line ${type}`);
  if (type === 'command') line.append(makePrompt(path));
  line.append(document.createTextNode(text));
  output.append(line);
  while (output.children.length > 160) output.firstElementChild.remove();
}
function revealPrompt() {
  requestAnimationFrame(() => {
    if (app.view === 'terminal' && !activeProgram) $('#terminal-form')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
}
function terminalKeys(event) {
  const input = event.currentTarget;
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    input.form.requestSubmit();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    setTerminalInput('');
    return;
  }
  if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
    event.preventDefault();
    $('#terminal-output').replaceChildren();
    revealPrompt();
    return;
  }
  if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
    event.preventDefault();
    setTerminalInput('');
    logLine('^C');
    revealPrompt();
    return;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.max(0,Math.min(publicHistory.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
    setTerminalInput(publicHistory[historyIndex] || '');
  }
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault();
    const matches = shell.complete(input.value);
    if (matches.length) {
      if (matches.length === 1) setTerminalInput(matches[0]);
      else {
        const prefix = matches.reduce((shared, name) => {
          while (!name.startsWith(shared)) shared = shared.slice(0,-1);
          return shared;
        });
        setTerminalInput(prefix);
        logLine(matches.join('  '));
        revealPrompt();
      }
    }
  }
}
async function executeCommand(event) {
  event.preventDefault();
  const input = $('#terminal-input');
  if (!input || input.disabled || activeProgram) return;
  let candidate = input.value;
  setTerminalInput('');
  if (!candidate.trim()) return;
  const previousPath = shell.displayCwd;
  const result = shell.execute(candidate);
  if (result.recognized) {
    candidate = '';
    if (result.remember) {
      publicHistory.push(result.echo);
      if (publicHistory.length > 40) publicHistory.shift();
    }
    historyIndex = publicHistory.length;
    logLine(result.echo,'command',previousPath);
    result.lines?.forEach(({text,kind}) => logLine(text,kind));
    updatePrompt();
    const action = result.action;
    if (action?.type === 'clear') $('#terminal-output').replaceChildren();
    else if (action?.type === 'blog') navigate('blog');
    else if (action?.type === 'article') navigate('article',action.id,{fromTerminal:true});
    else if (action?.type === 'projects' || action?.type === 'about') navigate(action.type);
    else if (action?.type === 'theme') {
      if (action.name) applyTerminalTheme(action.name);
      else listTerminalThemes();
    } else if (action?.type === 'photo') showPhoto(action.index);
    else if (action?.type === 'audio') {
      startTerminalProgram('player',{tracks:audioTracks,startIndex:Math.max(0,audioTracks.findIndex(track => track.id === action.id))});
    } else if (action?.type === 'player') startTerminalProgram('player',{tracks:action.tracks});
    else if (action?.type === '2048') startTerminalProgram(action.type);
    else if (action?.type === 'pager') startTerminalProgram('pager',{title:action.title,text:action.text});
    else if (action?.type === 'gallery') startTerminalProgram('gallery',{photos:action.photos,mode:action.mode});
    else if (action?.type === 'stop') logLine('当前没有播放的音频。');
    else if (action?.type === 'sl') await playTrain();
    revealPrompt();
    return;
  }
  // Unknown input is tried as a key. It is never echoed, persisted or added to history.
  const controller = startUnlock();
  input.disabled = true;
  $('#terminal-form button').disabled = true;
  const pending = el('p','tty-line feedback tty-pending','正在检查输入…');
  $('#terminal-output').append(pending);
  revealPrompt();
  let opened = false;
  try {
    const content = await unlockExhibit(candidate, { signal: controller.signal });
    candidate = '';
    if (controller.signal.aborted || app.view !== 'terminal') return;
    rememberTerminal();
    opened = true;
    openExhibit(content);
  } catch (error) {
    if (error.name !== 'AbortError' && app.view === 'terminal') {
      pending.textContent = '未识别的指令。';
      pending.classList.remove('tty-pending');
    }
  } finally {
    candidate = '';
    if (!opened && app.view === 'terminal' && input.isConnected && !controller.signal.aborted) {
      input.disabled = false;
      $('#terminal-form button').disabled = false;
      input.focus({preventScroll:true});
      revealPrompt();
    }
  }
}
function showPhoto(index) {
  const photo = photoCatalog[index];
  if (!photo) return;
  $('#photo-title').textContent = photo.title;
  const image = el('img');
  image.src = photo.src;
  image.alt = photo.title;
  $('#photo-detail').replaceChildren(image);
  $('#photo-dialog').showModal();
}
export function closeTerminalProgram({restore = true} = {}) {
  const program = activeProgram;
  if (!program) return;
  activeProgram = undefined;
  program.controller.abort();
  program.dispose?.();
  program.container.remove();
  delete document.documentElement.dataset.program;
  if (program.shell.isConnected) {
    program.shell.hidden = false;
    const input = $('#terminal-input');
    if (input) input.disabled = false;
    if (restore && app.view === 'terminal') {
      document.title = 'Hanskrrr · 终端';
      input?.focus({preventScroll:true});
      revealPrompt();
      announce('已返回终端。');
    }
  }
}
function startTerminalProgram(name, options = {}) {
  const mount = {'2048':mount2048,player:mountPlayer,gallery:mountGallery,pager:mountPager}[name];
  if (!mount || app.view !== 'terminal') return;
  closeTerminalProgram({restore:false});
  trainController?.abort();
  const terminal = $('#main > .tty');
  const container = el('section','tty-program');
  container.tabIndex = 0;
  container.setAttribute('aria-label',({player:'终端播放器',gallery:'字符相册',pager:'终端阅读器','2048':'2048'})[name]);
  const controller = new AbortController();
  const program = {container,controller,shell:terminal,dispose:undefined};
  activeProgram = program;
  terminal.hidden = true;
  $('#terminal-input').disabled = true;
  document.documentElement.dataset.program = name;
  document.title = `Hanskrrr · ${name}`;
  main.append(container);
  window.scrollTo({top:0,behavior:'instant'});
  try {
    program.dispose = mount(container,{...options,signal:controller.signal,onOpenPhoto:photo => {
      const index = photoCatalog.findIndex(item => item.id === photo.id);
      if (index >= 0) showPhoto(index);
    },onExit:() => {
      if (activeProgram === program) closeTerminalProgram();
    },announce});
    if (!container.contains(document.activeElement)) container.focus({preventScroll:true});
    program.focusTarget = document.activeElement;
  } catch {
    closeTerminalProgram();
    logLine('无法启动程序，请重试。','error');
  }
}
async function playTrain() {
  const controller = new AbortController();
  trainController?.abort();
  trainController = controller;
  const form = $('#terminal-form');
  const output = $('#terminal-output');
  form.hidden = true;
  form.querySelector('textarea').disabled = true;
  announce('火车动画开始，按 Esc 或 Ctrl+C 停止。');
  const animation = runTrain(output,{signal:controller.signal,reducedMotion:reducedMotion.matches});
  output.lastElementChild?.scrollIntoView({block:'nearest',behavior:'instant'});
  try { await animation; }
  finally {
    if (trainController === controller) {
      trainController = undefined;
      if (app.view === 'terminal' && form.isConnected) {
        form.hidden = false;
        form.querySelector('textarea').disabled = false;
        form.querySelector('textarea').focus({preventScroll:true});
        announce(controller.signal.aborted ? '火车动画已停止。' : '火车动画结束。');
        revealPrompt();
      }
    }
  }
}
function listTerminalThemes() {
  const current = document.documentElement.dataset.terminalTheme;
  Object.entries(terminalThemes).forEach(([name, theme]) => {
    logLine(`${name === current ? '*' : ' '} ${name.padEnd(7)} ${theme.label}`);
  });
  logLine('使用 theme <名称> 切换，例如 theme blue。');
}
function applyTerminalTheme(theme) {
  if (!Object.hasOwn(terminalThemes,theme)) return;
  document.documentElement.dataset.terminalTheme = theme;
  storage.set('gallery-terminal-theme',theme);
  updateBrowserColor();
  logLine(`theme: ${theme}`);
}

/** Leaving the terminal: keep public output, stop the train and any program. */
export function leaveTerminal() {
  rememberTerminal();
  trainController?.abort();
  closeTerminalProgram({restore:false});
}
/** Clicks on the terminal page return focus to the input or the running program. */
export function handleMainClick(event) {
  if (activeProgram && activeProgram.container.contains(event.target)
      && !event.target.closest('a,button,input,textarea,select') && window.getSelection()?.isCollapsed) {
    activeProgram.focusTarget?.focus({preventScroll:true});
    return;
  }
  if (app.view === 'terminal' && !activeProgram && !event.target.closest('a,button,input,textarea') && window.getSelection()?.isCollapsed) {
    $('#terminal-input')?.focus({ preventScroll: true });
  }
}
export function handleGlobalKeydown(event) {
  if (trainController && (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c'))) {
    event.preventDefault();
    trainController.abort();
  }
}
export function handleSelectionChange() {
  if (app.view === 'terminal' && document.activeElement?.id === 'terminal-input') syncTerminalInput();
}

export const terminalPage = {
  title: '终端',
  render: renderTerminal,
  focus() {
    $('#terminal-input')?.focus({ preventScroll: true });
    revealPrompt();
  },
};
