// The scrollback: prompt rendering and line output. Only public text is written here.
import { $, el } from '../../core/dom.js';

const MAX_LINES = 160;

export const output = () => $('#terminal-output');

export function promptText(path) { return `guest@gallery:${path}$ `; }

export function makePrompt(path) {
  if (path === null) return el('span', 'tty-prompt', 'Password: ');
  const prompt = el('span', 'tty-prompt');
  prompt.append(el('span', 'tty-user', 'guest'), '@', el('span', 'tty-host', 'gallery'), ':', el('span', 'tty-path', path), '$ ');
  return prompt;
}

/**
 * Append one line. kind: '' | 'command' | 'password' | 'error' | 'directory' | 'media' | 'feedback' | 'help'.
 * `path` is the prompt path shown before an echoed command.
 */
export function logLine(text, kind = '', path = '~') {
  const target = output();
  if (!target) return null;
  const line = el('p', `tty-line ${kind}`);
  if (kind === 'command') line.append(makePrompt(path));
  if (kind === 'password') line.append(makePrompt(null));
  if (kind === 'help') {
    // Command name highlighted, arguments dimmed: "ls [-a] [path]".
    const [name, ...rest] = text.split(' ');
    line.append(el('span', 'tty-cmd', name), rest.length ? ` ${rest.join(' ')}` : '');
  } else line.append(document.createTextNode(text));
  target.append(line);
  while (target.children.length > MAX_LINES) target.firstElementChild.remove();
  return line;
}

export function appendBlock(node) {
  output()?.append(node);
}

export function clearOutput() {
  output()?.replaceChildren();
}
