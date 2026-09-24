// Small DOM helpers shared by every page module.
export const $ = (selector, scope = document) => scope.querySelector(selector);
export const main = $('#main');
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {} },
};
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function announce(text) { $('#announcer').textContent = text; }
