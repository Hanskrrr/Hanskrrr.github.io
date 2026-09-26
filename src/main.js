// Entry point: registers the pages, wires page-level events and opens the first route.
//   core/      DOM helpers, router and themes
//   blog/      blog pages and pixel art
//   terminal/  the /terminal/ page, virtual shell and full-screen programs
//   vault/     decryption and the session-only exhibit page
//   content/   public articles, photo and audio catalogues
import { $, announce, main, reducedMotion, storage } from './core/dom.js';
import { app, cancelTransitions, definePage, navigate, onLeave, renderView, routeFromUrl, runLeaveHooks } from './core/router.js';
import { labelThemeButton, toggleTheme } from './core/theme.js';
import { blogPages, setSearch, setTopic } from './blog/pages.js';
import { attachTorch } from './blog/uv-light.js';
import { attachTermPreviews, closeReturnChip, closeTermCard, handleTermClick } from './blog/term-preview.js';
import { handleGlobalKeydown, handleMainClick, handleSelectionChange, leaveTerminal, terminalPage } from './terminal/page.js';
import { exhibitPage, lockContent, worldPage } from './vault/exhibit.js';

for (const [name, page] of Object.entries(blogPages)) definePage(name, page);
definePage('terminal', terminalPage);
definePage('exhibit', exhibitPage);
definePage('world', worldPage);
onLeave(leaveTerminal);
onLeave(lockContent);
onLeave(closeTermCard);
onLeave(closeReturnChip);
attachTermPreviews();
attachTorch();

document.addEventListener('click', event => {
  const target = event.target.closest('a,button');
  if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (handleTermClick(event, target)) return;
  // In-page #links scroll without a history entry, so Back still leaves the page.
  const href = target.getAttribute('href');
  if (href?.length > 1 && href.startsWith('#')) {
    const node = document.getElementById(decodeURIComponent(href.slice(1)));
    if (node) {
      event.preventDefault();
      node.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      history.replaceState(history.state, '', href);
      if (node === main) main.focus({ preventScroll: true });
    }
  }
  if (target.dataset.nav) { event.preventDefault(); navigate(target.dataset.nav); }
  if (target.dataset.article) { event.preventDefault(); navigate('article', target.dataset.article, { hash: target.hash }); }
  if (target.dataset.topic !== undefined) {
    event.preventDefault();
    setTopic(target.dataset.topic);
    if (app.view !== 'blog') navigate('blog');
  }
  if (target.dataset.close) $(`#${target.dataset.close}`).close();
  switch (target.dataset.action) {
    case 'toggle-theme': toggleTheme(); break;
    case 'browse': $('#articles')?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' }); break;
    case 'lock': navigate('terminal', undefined, { push: false }); break;
  }
});
main.addEventListener('click', handleMainClick);
document.addEventListener('keydown', handleGlobalKeydown);
document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('input', event => {
  if (event.target.id === 'article-search') setSearch(event.target.value);
});
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
addEventListener('popstate', () => {
  const route = routeFromUrl();
  navigate(route.view, route.article?.id, { push: false });
});
addEventListener('pagehide', () => {
  cancelTransitions();
  runLeaveHooks();
  // Clear pending and unsubmitted input before a browser history snapshot is retained.
  if (['exhibit', 'world', 'terminal'].includes(app.view)) renderView('terminal');
});

// Konami code (↑ ↑ ↓ ↓ ← → ← → B A): the homepage critter dances. Ignored while typing.
const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;
document.addEventListener('keydown', event => {
  if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  konamiIndex = key === konami[konamiIndex] ? konamiIndex + 1 : key === konami[0] ? 1 : 0;
  if (konamiIndex === konami.length) {
    konamiIndex = 0;
    dispatchEvent(new CustomEvent('gallery:dance'));
  }
});

// Developer shortcuts: only on this computer, from a file that is never published.
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) import('./dev/cheats.js').catch(() => {});

// A hello for anyone who opens the developer console.
console.log(
  '%c   ▘  ▝\n  ▄████▄\n ██▀██▀██\n ████████\n  ▀▀  ▀▀\n%cHi, curious one. try adding /terminal/ to the end of the url and see what happens.=)))',
  'color:#b18bff;font:14px/1 monospace',
  'color:#aef0a4;font:13px monospace',
);

labelThemeButton();
const initial = routeFromUrl();
navigate(initial.view, initial.article?.id, { push: false, animated: false, focus: initial.view === 'terminal' });
