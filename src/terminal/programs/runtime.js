// Full-screen character programs share one lifecycle: mount into a temporary
// screen, hide the prompt, and restore the terminal on q / Esc / Ctrl+C.
// The sl train runs inline in the scrollback instead.
import { $, announce, el, main, reducedMotion } from '../../core/dom.js';
import { app } from '../../core/router.js';
import { mount2048 } from './game-2048.js';
import { mountGallery } from './gallery.js';
import { mountPager } from './pager.js';
import { mountPlayer } from './player.js';
import { runTrain } from './train.js';

const programs = {
  player: { mount: mountPlayer, label: '终端播放器' },
  gallery: { mount: mountGallery, label: '字符相册' },
  pager: { mount: mountPager, label: '终端阅读器' },
  '2048': { mount: mount2048, label: '2048' },
};

let active;
let train;
let hooks = { onReturn() {}, openPhoto() {}, onError() {} };

/** hooks: onReturn() after a program closes, openPhoto(photo), onError(message). */
export function configureRuntime(next) { hooks = { ...hooks, ...next }; }
export const activeProgram = () => active;
export const trainRunning = () => Boolean(train);

export function closeProgram({ restore = true } = {}) {
  const program = active;
  if (!program) return;
  active = undefined;
  program.controller.abort();
  program.dispose?.();
  program.container.remove();
  delete document.documentElement.dataset.program;
  if (!program.shell.isConnected) return;
  program.shell.hidden = false;
  const input = $('#terminal-input');
  if (input) input.disabled = false;
  if (restore && app.view === 'terminal') {
    document.title = 'Hanskrrr · 终端';
    input?.focus({ preventScroll: true });
    hooks.onReturn();
    announce('已返回终端。');
  }
}

export function startProgram(name, options = {}) {
  const entry = programs[name];
  if (!entry || app.view !== 'terminal') return;
  closeProgram({ restore: false });
  stopTrain();
  const shell = $('#main > .tty');
  const container = el('section', 'tty-program');
  container.tabIndex = 0;
  container.setAttribute('aria-label', entry.label);
  const program = { container, controller: new AbortController(), shell, dispose: undefined };
  active = program;
  shell.hidden = true;
  $('#terminal-input').disabled = true;
  document.documentElement.dataset.program = name;
  document.title = `Hanskrrr · ${name}`;
  main.append(container);
  window.scrollTo({ top: 0, behavior: 'instant' });
  try {
    program.dispose = entry.mount(container, {
      ...options,
      signal: program.controller.signal,
      announce,
      onOpenPhoto: photo => hooks.openPhoto(photo),
      onExit: () => { if (active === program) closeProgram(); },
    });
    if (!container.contains(document.activeElement)) container.focus({ preventScroll: true });
    program.focusTarget = document.activeElement;
  } catch {
    closeProgram();
    hooks.onError('无法启动程序，请重试。');
  }
}

export function stopTrain() { train?.abort(); }

export async function playTrain() {
  const controller = new AbortController();
  stopTrain();
  train = controller;
  const form = $('#terminal-form');
  const field = form.querySelector('textarea');
  const output = $('#terminal-output');
  form.hidden = true;
  field.disabled = true;
  announce('火车动画开始，按 Esc 或 Ctrl+C 停止。');
  const animation = runTrain(output, { signal: controller.signal, reducedMotion: reducedMotion.matches });
  output.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  try { await animation; }
  finally {
    if (train === controller) {
      train = undefined;
      if (app.view === 'terminal' && form.isConnected) {
        form.hidden = false;
        field.disabled = false;
        field.focus({ preventScroll: true });
        announce(controller.signal.aborted ? '火车动画已停止。' : '火车动画结束。');
        hooks.onReturn();
      }
    }
  }
}

/** Global keys while a program or the train owns the screen. */
export function handleRuntimeKeydown(event) {
  if (train && (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c'))) {
    event.preventDefault();
    stopTrain();
  }
}

/** Clicking inside a running program returns focus to it. */
export function refocusProgram(event) {
  if (!active?.container.contains(event.target)) return false;
  if (!event.target.closest('a,button,input,textarea,select') && window.getSelection()?.isCollapsed) {
    active.focusTarget?.focus({ preventScroll: true });
  }
  return true;
}
