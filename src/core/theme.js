// Blog colour themes (night/paper, toggled by the header button) and terminal colour themes.
// A third blog style, uv, joins the cycle once a visitor finds `theme uv` in the terminal.
import { $, announce, storage } from './dom.js';
import { applyUvText } from './uv.js';

const themeColors = { night: '#1a1942', paper: '#fcf6dc', uv: '#0a0814' };
const themes = () => storage.get('gallery-uv') ? ['night', 'paper', 'uv'] : ['night', 'paper'];
export const terminalThemes = {
  linux: { label: '黑底灰白', background: '#080808' },
  blue: { label: '深靛蓝底浅蓝', background: '#10102a' },
  light: { label: '浅底深灰', background: '#f4f4f2' },
};
export function updateBrowserColor() {
  $('meta[name="theme-color"]').content = document.documentElement.dataset.view === 'terminal'
    ? terminalThemes[document.documentElement.dataset.terminalTheme]?.background || terminalThemes.blue.background
    : themeColors[document.documentElement.dataset.theme] || themeColors.night;
}
const themeNames = { night: '夜空', paper: '纸页', uv: '紫外' };
const nextTheme = () => {
  const list = themes();
  return list[(list.indexOf(document.documentElement.dataset.theme) + 1) % list.length];
};
/** Label the header button with the theme it switches to. */
export function labelThemeButton() {
  const button = $('[data-action="toggle-theme"]');
  button.title = `切换到${themeNames[nextTheme()]}配色`;
  button.setAttribute('aria-label', button.title);
}
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  storage.set('gallery-theme', theme);
  updateBrowserColor();
  labelThemeButton();
  applyUvText();
}
export function toggleTheme() {
  const theme = nextTheme();
  setTheme(theme);
  announce(`已切换到${themeNames[theme]}配色`);
}
/** `theme uv` in the terminal: add uv to this visitor's cycle and switch to it. */
export function unlockUv() {
  storage.set('gallery-uv', '1');
  setTheme('uv');
}
