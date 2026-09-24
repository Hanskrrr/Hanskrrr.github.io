// Blog colour themes (night/paper), terminal colour themes and the settings dialog.
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
export function openSettings() {
  $('#default-view').value = storage.get('gallery-default-view') || 'site';
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed',button.dataset.themeChoice === document.documentElement.dataset.theme));
  $('#settings-dialog').showModal();
}
export function applyTheme(theme) {
  if (!themes.includes(theme)) return;
  document.documentElement.dataset.theme = theme;
  storage.set('gallery-theme',theme);
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed',button.dataset.themeChoice === theme));
  updateBrowserColor();
  announce('已切换界面风格');
}
