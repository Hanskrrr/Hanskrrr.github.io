// URL ⇄ page mapping and page swaps. Pages and "leave" clean-up hooks are registered
// by main.js, so this module does not depend on any page implementation.
import { announce, main, reducedMotion, storage } from './dom.js';
import { updateBrowserColor } from './theme.js';
import { articles } from '../content/articles.js';

export const app = { view: 'blog' };
const pages = new Map();
const leaveHooks = [];
let transition;
let navigationId = 0;

/** page: { title?: string, render(article?), focus?() } */
export function definePage(name, page) { pages.set(name, page); }
/** Called before every navigation and on pagehide, in registration order. */
export function onLeave(hook) { leaveHooks.push(hook); }
export function runLeaveHooks() { leaveHooks.forEach(hook => hook()); }
export function cancelTransitions() {
  ++navigationId;
  transition?.skipTransition();
}
export function routeFromUrl() {
  if (/^\/terminal\/?$/.test(location.pathname)) return { view: 'terminal' };
  const query = new URLSearchParams(location.search);
  const article = articles.find(item => item.id === query.get('article'));
  if (article) return { view: 'article', article };
  if (['blog', 'projects', 'about'].includes(query.get('view'))) return { view: query.get('view') };
  const preference = storage.get('gallery-default-view') || window.GALLERY_CONFIG.defaultView;
  return { view: preference === 'terminal' ? 'terminal' : 'blog' };
}
export function routeUrl(nextView, articleId) {
  if (nextView === 'terminal') return '/terminal/';
  if (nextView === 'article') return `/?article=${encodeURIComponent(articleId)}`;
  return `/?view=${nextView}`;
}
export function swapPage(update, { animated = true, focus = true } = {}) {
  const id = ++navigationId;
  transition?.skipTransition();
  const apply = () => {
    if (id !== navigationId) return;
    update();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) {
      const page = pages.get(app.view);
      if (page?.focus) page.focus();
      else main.focus({ preventScroll: true });
    }
  };
  if (document.startViewTransition && !reducedMotion.matches && animated) {
    transition = document.startViewTransition(apply);
    transition.finished.catch(() => {});
  } else apply();
}
export function navigate(nextView, articleId, { push = true, animated = true, focus = true, fromTerminal = false } = {}) {
  runLeaveHooks();
  if (push) history.pushState({}, '', routeUrl(nextView, articleId) + (fromTerminal && nextView === 'article' ? '&from=terminal' : ''));
  const article = articles.find(item => item.id === articleId);
  swapPage(() => renderView(nextView, article), { animated, focus });
}
export function renderView(nextView, article) {
  app.view = nextView;
  document.documentElement.dataset.view = app.view;
  updateBrowserColor();
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === (app.view === 'article' ? 'blog' : app.view);
    active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
  });
  const page = pages.get(app.view);
  const title = page?.title || article?.title;
  document.title = `Hanskrrr · ${title}`;
  page?.render(article);
  announce(`已打开${title}`);
}
