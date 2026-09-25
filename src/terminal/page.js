// The /terminal/ page. Layout of this folder:
//   shell/     command parsing and execution over the public content map (no DOM)
//   ui/        scrollback, input line, banner, intro and the pixel creature
//   programs/  full-screen character programs and their shared runtime
//   actions.js effects for shell results (navigate, open a program, theme…)
import { $, el, main, reducedMotion } from '../core/dom.js';
import { app } from '../core/router.js';
import { articleText, thoughtText } from '../content/article-text.js';
import { thoughts } from '../content/thoughts.js';
import { articles } from '../content/articles.js';
import { audioTracks } from '../content/audio.js';
import { photoCatalog } from '../content/photos.js';
import { unlockExhibit } from '../vault/crypto.js';
import { openExhibit, startUnlock } from '../vault/exhibit.js';
import { runAction, showPhoto } from './actions.js';
import { activeProgram, closeProgram, configureRuntime, handleRuntimeKeydown, refocusProgram, stopTrain } from './programs/runtime.js';
import { createShell } from './shell/index.js';
import { createTerminalBanner } from './ui/banner.js';
import { animateCreature, createCreature } from './ui/creature.js';
import { createIntro } from './ui/intro.js';
import { attachLineEditor, input, setInput, syncInput } from './ui/line-editor.js';
import { appendBlock, clearOutput, logLine, makePrompt, output, promptText } from './ui/output.js';

const shell = createShell(articles.map(article => ({ ...article, text: articleText[article.id] })), { thoughts: thoughtText });
const history = { entries: [], index: 0 };
let snapshot;
let pet;

const log = (text, kind) => logLine(text, kind, shell.displayCwd);

function revealPrompt() {
  requestAnimationFrame(() => {
    if (app.view === 'terminal' && !activeProgram()) $('#terminal-form')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
}
function updatePrompt() {
  $('#terminal-form .tty-prompt')?.replaceWith(makePrompt(shell.displayCwd));
  $('#terminal-form')?.style.setProperty('--prompt-width', `${promptText(shell.displayCwd).length}ch`);
}

function mountPet(pre) {
  pet?.dispose();
  pet = pre ? animateCreature(pre, { reducedMotion: reducedMotion.matches }) : undefined;
}
const petReact = event => { if (pet?.element.isConnected) pet.react(event); };
function summonPet() {
  if (!pet?.element.isConnected) {
    const pre = createCreature();
    appendBlock(pre);
    mountPet(pre);
  }
  pet.react('pet');
}

configureRuntime({
  onReturn: revealPrompt,
  onError: message => log(message, 'error'),
  openPhoto: photo => {
    const index = photoCatalog.findIndex(item => item.id === photo.id);
    if (index >= 0) showPhoto(index);
  },
});

function renderTerminal() {
  main.innerHTML = `<section class="tty" aria-label="终端"><h1 class="sr-only">终端</h1><div class="tty-output" id="terminal-output" role="log" aria-label="终端输出" aria-live="polite"></div><form class="tty-form" id="terminal-form"><label class="sr-only" for="terminal-input">终端指令</label><div class="tty-edit-render" aria-hidden="true"><span class="tty-prompt"></span><span id="tty-before"></span><span id="tty-cursor" class="tty-cursor"> </span><span id="tty-after"></span></div><textarea id="terminal-input" rows="1" aria-label="终端指令" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="1024" enterkeyhint="send"></textarea><button class="sr-only" type="submit" aria-label="执行指令">执行指令</button></form></section>`;
  if (snapshot) output().replaceWith(snapshot.cloneNode(true));
  else {
    output().append(
      createTerminalBanner(),
      el('p', 'tty-line', ''),
      createIntro({ articles: articles.filter(article => !article.series).length, thoughts: thoughts.length, photos: photoCatalog.length, tracks: audioTracks.length }),
      el('p', 'tty-line', ''),
    );
  }
  updatePrompt();
  history.index = history.entries.length;
  attachLineEditor({
    history,
    complete: value => shell.complete(value),
    onSubmit: submit,
    onClearScreen: () => { clearOutput(); revealPrompt(); },
    onInterrupt: () => { log('^C'); revealPrompt(); },
    onListCompletions: matches => { log(matches.join('  ')); revealPrompt(); },
    onTyping: () => { revealPrompt(); petReact('typing'); },
  });
  const pets = output().querySelectorAll('.tty-pet');
  mountPet(pets[pets.length - 1]);
}

async function submit() {
  const field = input();
  if (!field || field.disabled || activeProgram()) return;
  let candidate = field.value;
  setInput('');
  if (!candidate.trim()) return;
  const previousPath = shell.displayCwd;
  const result = shell.execute(candidate);
  if (result.recognized) {
    candidate = '';
    if (result.remember) {
      history.entries.push(result.echo);
      if (history.entries.length > 40) history.entries.shift();
    }
    history.index = history.entries.length;
    logLine(result.echo, 'command', previousPath);
    result.lines?.forEach(({ text, kind }) => log(text, kind));
    updatePrompt();
    const failed = result.lines?.some(line => line.kind === 'error');
    if (result.action?.type !== 'pet') petReact(failed ? 'error' : 'command');
    if (result.action) await runAction(result.action, { log, pet: summonPet });
    revealPrompt();
    return;
  }
  await tryUnlock(candidate);
  candidate = '';
}

// Unknown input is tried as a key. It is never echoed, persisted or added to history.
async function tryUnlock(candidate) {
  const field = input();
  const controller = startUnlock();
  field.disabled = true;
  $('#terminal-form button').disabled = true;
  const pending = el('p', 'tty-line feedback tty-pending', '正在检查输入…');
  appendBlock(pending);
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
      petReact('error');
    }
  } finally {
    candidate = '';
    if (!opened && app.view === 'terminal' && field.isConnected && !controller.signal.aborted) {
      field.disabled = false;
      $('#terminal-form button').disabled = false;
      field.focus({ preventScroll: true });
      revealPrompt();
    }
  }
}

export function rememberTerminal() {
  const target = output();
  if (app.view !== 'terminal' || !target) return;
  // Only public output survives internal navigation; input and decrypted content
  // are never part of this snapshot, and nothing is written to browser storage.
  snapshot = target.cloneNode(true);
  snapshot.querySelectorAll('.tty-pending,.tty-train-stage').forEach(node => node.remove());
}

/** Leaving the terminal: keep public output, stop the train, any program and the creature. */
export function leaveTerminal() {
  rememberTerminal();
  stopTrain();
  closeProgram({ restore: false });
  mountPet(undefined);
}

/** Clicks on the terminal page return focus to the input or the running program. */
export function handleMainClick(event) {
  if (refocusProgram(event)) return;
  if (app.view === 'terminal' && !activeProgram() && !event.target.closest('a,button,input,textarea') && window.getSelection()?.isCollapsed) {
    input()?.focus({ preventScroll: true });
  }
}
export const handleGlobalKeydown = handleRuntimeKeydown;
export function handleSelectionChange() {
  if (app.view === 'terminal' && document.activeElement?.id === 'terminal-input') syncInput();
}

export const terminalPage = {
  title: '终端',
  render: renderTerminal,
  focus() {
    input()?.focus({ preventScroll: true });
    revealPrompt();
  },
};
