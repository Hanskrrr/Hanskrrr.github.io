// The uv style's words: elements marked data-uv="key" show uvText[mood][key] while the
// style is on, and their normal text otherwise.
import { uvText } from '../content/uv-text.js';

export const uvOn = () => document.documentElement.dataset.theme === 'uv';
const mood = () => uvText[document.documentElement.dataset.mood] || uvText.cyber;
const backwards = text => [...text].reverse().join('');

/** The line for `key`: its uv version while the style is on, else `plain`. */
export function said(key, plain) {
  if (!uvOn()) return plain;
  const lines = mood();
  if (lines[key] !== undefined) return lines[key];
  if (!lines.reverse) return plain;
  return Array.isArray(plain) ? plain.map(backwards) : backwards(plain);
}

/** Swap every [data-uv] text under `scope` to match the current style. */
export function applyUvText(scope = document) {
  scope.querySelectorAll('[data-uv]').forEach(node => {
    node.dataset.plain ??= node.textContent;
    node.textContent = said(node.dataset.uv, node.dataset.plain);
  });
}
