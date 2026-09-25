// The input line. A native <textarea> keeps IME, selection and mobile keyboards
// working; its current value is mirrored in the character flow with a block cursor.
import { $ } from '../../core/dom.js';

const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

export const input = () => $('#terminal-input');

/** Mirror the textarea into the rendered prompt line (before | cursor | after). */
export function syncInput() {
  const field = input();
  if (!field) return;
  if (/[\r\n]/.test(field.value)) {
    const caret = field.selectionStart;
    const removed = (field.value.slice(0, caret).match(/[\r\n]/g) || []).length;
    field.value = field.value.replace(/[\r\n]/g, '');
    field.setSelectionRange(caret - removed, caret - removed);
  }
  // A password prompt (su) shows nothing of what is typed, like a real terminal.
  const secret = $('#terminal-form').classList.contains('tty-secret');
  const at = secret ? 0 : field.selectionStart ?? field.value.length;
  const rest = secret ? '' : field.value.slice(at);
  const character = rest ? (graphemes ? graphemes.segment(rest)[Symbol.iterator]().next().value.segment : Array.from(rest)[0]) : ' ';
  const parts = [[$('#tty-before'), field.value.slice(0, at)], [$('#tty-cursor'), character], [$('#tty-after'), rest.slice(rest ? character.length : 0)]];
  parts.forEach(([node, text]) => { if (node.textContent !== text) node.textContent = text; });
  $('#terminal-form').classList.toggle('tty-selecting', field.selectionStart !== field.selectionEnd);
}

export function setInput(value) {
  const field = input();
  if (!field) return;
  field.value = value;
  field.setSelectionRange(value.length, value.length);
  syncInput();
}

function sharedPrefix(values) {
  return values.reduce((shared, value) => {
    while (!value.startsWith(shared)) shared = shared.slice(0, -1);
    return shared;
  });
}

/**
 * Wire keyboard handling to the current form.
 * history: { entries: string[], index: number } (owned by the page, survives re-renders)
 * hooks: complete(value) → string[], onSubmit(), onClearScreen(), onInterrupt(),
 *        onListCompletions(matches), onTyping()
 */
export function attachLineEditor({ history, complete, onSubmit, onClearScreen, onInterrupt, onListCompletions, onTyping }) {
  const field = input();
  const form = $('#terminal-form');
  form.addEventListener('submit', event => { event.preventDefault(); onSubmit(); });
  field.addEventListener('beforeinput', event => {
    if (!event.isComposing && ['insertLineBreak', 'insertParagraph'].includes(event.inputType)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  ['input', 'keyup', 'click', 'select', 'focus', 'blur', 'compositionend'].forEach(name => field.addEventListener(name, syncInput));
  field.addEventListener('input', onTyping);
  field.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return;
    const key = event.key;
    const ctrl = event.ctrlKey && !event.altKey && !event.metaKey;
    if (key === 'Enter') { event.preventDefault(); form.requestSubmit(); }
    else if (key === 'Escape') { event.preventDefault(); setInput(''); }
    else if (ctrl && (key === 'l' || key === 'L')) { event.preventDefault(); onClearScreen(); }
    else if (ctrl && (key === 'c' || key === 'C')) { event.preventDefault(); setInput(''); onInterrupt(); }
    else if (form.classList.contains('tty-secret') && ['ArrowUp', 'ArrowDown', 'Tab'].includes(key)) event.preventDefault();
    else if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      history.index = Math.max(0, Math.min(history.entries.length, history.index + (key === 'ArrowUp' ? -1 : 1)));
      setInput(history.entries[history.index] || '');
    } else if (key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const matches = complete(field.value);
      if (matches.length === 1) setInput(matches[0]);
      else if (matches.length > 1) {
        setInput(sharedPrefix(matches));
        onListCompletions(matches);
      }
    }
  });
  syncInput();
}
