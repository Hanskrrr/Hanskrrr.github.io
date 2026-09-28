// URL ⇄ page mapping and page swaps. Pages and "leave" clean-up hooks are registered
// by main.js, so this module does not depend on any page implementation.
import { announce, main, reducedMotion } from './dom.js';
import { updateBrowserColor } from './theme.js';
import { applyUvText } from './uv.js';
import { articles } from '../content/articles.js';

export const app = { view: 'blog' };
const pages = new Map();
const leaveHooks = [];
let transition;
let navigationId = 0;
const publicViews = new Set(['blog', 'article', 'about', 'graph']);
const visits = new Map();
const latestVisit = new Map();
let renderedEntry = null;
let stopRestore;
history.scrollRestoration = 'manual';

// Only public page coordinates and list controls live here, for this document's lifetime.
// The browser history carries an opaque key, never page bodies or unlocked room state.
function entryKey() {
  if (!history.state?.galleryEntry) history.replaceState({ ...history.state, galleryEntry: crypto.randomUUID() }, '');
  return history.state.galleryEntry;
}
export function rememberPage() {
  if (!renderedEntry || !publicViews.has(app.view) || stopRestore) return;
  const visit = { ...renderedEntry, view: app.view, x: window.scrollX, y: window.scrollY, state: pages.get(app.view)?.captureState?.() };
  visits.set(visit.key, visit);
  latestVisit.set(app.view, visit);
}
// In-page URL edits must preserve the current entry; pagination creates a distinct one.
// A caller pushing pagination saves the old page before changing its list controls.
export function updateRouteUrl(url, { push = false } = {}) {
  stopRestore?.();
  if (push) history.pushState({ galleryEntry: crypto.randomUUID() }, '', url);
  else history.replaceState({ ...history.state, galleryEntry: entryKey() }, '', url);
  if (renderedEntry) renderedEntry = { key: entryKey(), url: location.href };
}

/** page: { title?: string, render(article?), focus?() } */
export function definePage(name, page) { pages.set(name, page); }
/** Called before every navigation and on pagehide, in registration order. */
export function onLeave(hook) { leaveHooks.push(hook); }
export function runLeaveHooks() { leaveHooks.forEach(hook => hook()); }
export function cancelTransitions() {
  ++navigationId;
  transition?.skipTransition();
  stopRestore?.();
}
export function routeFromUrl() {
  if (/^\/terminal\/?$/.test(location.pathname)) return { view: 'terminal' };
  const query = new URLSearchParams(location.search);
  // /articles/<slug>/ (and the older /?article=<slug>)
  const slug = /^\/articles\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1] ?? query.get('article');
  const article = articles.find(item => item.id === slug);
  if (article) return { view: 'article', article };
  if (['blog', 'about', 'graph'].includes(query.get('view'))) return { view: query.get('view') };
  return { view: window.GALLERY_CONFIG.defaultView === 'terminal' ? 'terminal' : 'blog' };
}
export function routeUrl(nextView, articleId) {
  if (nextView === 'terminal') return '/terminal/';
  if (nextView === 'article') return `/articles/${encodeURIComponent(articleId)}/`;
  return `/?view=${nextView}`;
}
export function swapPage(update, { animated = true, focus = true, visit = null, entry = null } = {}) {
  const id = ++navigationId;
  transition?.skipTransition();
  stopRestore?.();
  const apply = () => {
    if (id !== navigationId) return;
    const ready = update();
    renderedEntry = entry;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) {
      const page = pages.get(app.view);
      if (page?.focus) page.focus();
      else main.focus({ preventScroll: true });
    }
    // Wait for article HTML, diagrams, images and fonts before restoring deep positions.
    // A visitor who starts scrolling meanwhile takes control; stale renders cannot jump.
    if (visit || (entry && location.hash)) {
      let active = true;
      const cancel = () => {
        active = false;
        removeEventListener('wheel', cancel);
        removeEventListener('touchmove', cancel);
        removeEventListener('pointerdown', cancel);
        removeEventListener('keydown', onKey);
        if (stopRestore === cancel) stopRestore = undefined;
      };
      const onKey = event => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
          && !event.target.closest?.('input, textarea, select, [contenteditable]')) cancel();
      };
      stopRestore = cancel;
      addEventListener('wheel', cancel, { passive: true });
      addEventListener('touchmove', cancel, { passive: true });
      addEventListener('pointerdown', cancel, { passive: true });
      addEventListener('keydown', onKey);
      Promise.resolve(ready).then(() => document.fonts.ready).then(() => {
        if (!active || id !== navigationId) return;
        if (visit) window.scrollTo({ left: visit.x, top: visit.y, behavior: 'instant' });
        else {
          let anchor;
          try { anchor = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch {}
          anchor?.scrollIntoView({ behavior: 'instant' });
        }
        cancel();
        rememberPage();
      }, cancel);
    }
  };
  if (document.startViewTransition && !reducedMotion.matches && animated) {
    transition = document.startViewTransition(apply);
    transition.finished.catch(() => {});
  } else apply();
}
export function navigate(nextView, articleId, { push = true, animated = true, focus = true, fromTerminal = false, hash = '', restore = false } = {}) {
  const visit = restore ? (push ? latestVisit.get(nextView) : visits.get(history.state?.galleryEntry)) : null;
  rememberPage();
  runLeaveHooks();
  if (push) history.pushState({ galleryEntry: crypto.randomUUID() }, '', visit?.url || routeUrl(nextView, articleId) + (fromTerminal && nextView === 'article' ? '?from=terminal' : '') + hash);
  const entry = { key: entryKey(), url: location.href };
  const article = articles.find(item => item.id === articleId);
  swapPage(() => {
    if (visit) pages.get(nextView)?.restoreState?.(visit.state);
    return renderView(nextView, article, { restoreScroll: Boolean(visit || location.hash) });
  }, { animated, focus, visit, entry });
}
export function renderView(nextView, article, options = {}) {
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
  const ready = page?.render(article, options);
  applyUvText();
  announce(`已打开${title}`);
  return ready;
}
