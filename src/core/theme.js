// Blog colour themes (night/paper, toggled by the header button) and terminal colour themes.
import { $, announce, storage } from './dom.js';

export const themes = ['night', 'paper'];
const themeColors = { night: '#1a1942', paper: '#fcf6dc' };
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
const themeNames = { night: '夜空', paper: '纸页' };
/** Label the header button with the theme it switches to. */
export function labelThemeButton() {
  const next = document.documentElement.dataset.theme === 'paper' ? 'night' : 'paper';
  const button = $('[data-action="toggle-theme"]');
  button.title = `切换到${themeNames[next]}配色`;
  button.setAttribute('aria-label', button.title);
}
export function toggleTheme() {
  const theme = document.documentElement.dataset.theme === 'paper' ? 'night' : 'paper';
  document.documentElement.dataset.theme = theme;
  storage.set('gallery-theme', theme);
  updateBrowserColor();
  labelThemeButton();
  announce(`已切换到${themeNames[theme]}配色`);
}
