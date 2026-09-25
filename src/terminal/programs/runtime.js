// Full-screen character programs share one lifecycle: mount into a temporary
// screen, hide the prompt, and restore the terminal on q / Esc / Ctrl+C.
// The sl train runs inline in the scrollback instead.
import { $, announce, el, main, reducedMotion } from '../../core/dom.js';
import { app } from '../../core/router.js';

// Each program's code is fetched the first time it runs, so opening the terminal stays light.
const programs = {
  player: { load: () => import('./player.js').then(module => module.mountPlayer), label: 'audio player' },
  gallery: { load: () => import('./gallery.js').then(module => module.mountGallery), label: 'character gallery' },
  pager: { load: () => import('./pager.js').then(module => module.mountPager), label: 'pager' },
  '2048': { load: () => import('./game-2048.js').then(module => module.mount2048), label: '2048' },
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
    document.title = 'Hanskrrr · terminal';
    input?.focus({ preventScroll: true });
    hooks.onReturn();
    announce('Back in the terminal.');
  }
}

export async function startProgram(name, options = {}) {
  const entry = programs[name];
  if (!entry || app.view !== 'terminal') return;
  let mount;
  try { mount = await entry.load(); } catch { hooks.onError('Could not start the program. Try again.'); return; }
  if (app.view !== 'terminal') return;
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
    program.dispose = mount(container, {
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
    hooks.onError('Could not start the program. Try again.');
  }
}

export function stopTrain() { train?.abort(); }

export async function playTrain() {
  const { runTrain } = await import('./train.js');
  if (app.view !== 'terminal') return;
  const controller = new AbortController();
  stopTrain();
  train = controller;
  const form = $('#terminal-form');
  const field = form.querySelector('textarea');
  const output = $('#terminal-output');
  form.hidden = true;
  field.disabled = true;
  announce('Train started. Esc or Ctrl+C stops it.');
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
        announce(controller.signal.aborted ? 'Train stopped.' : 'Train finished.');
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
