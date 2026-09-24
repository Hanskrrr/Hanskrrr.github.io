// Term links: [[#^id|term]] points at the paragraph that explains a term (an Obsidian
// block id, see scripts/markdown.mjs). Instead of jumping away, the site first shows that
// paragraph in a small card: on hover or keyboard focus, or on the first tap. Clicking again
// (or "跳到原文") jumps there, and a "↩ 回到原处" chip returns to the reading position.
import { articles } from '../content/articles.js';
import { reducedMotion } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { articleBody } from './pages.js';
import { loadMathStyles } from './rich.js';

let card = null;       // { node, link }
let chip = null;
let hoverTimer = 0;
let pressing = false;   // a mouse/touch press focuses the link too; only keyboard focus opens the card
const behavior = () => reducedMotion.matches ? 'instant' : 'smooth';
const blockId = link => decodeURIComponent(link.hash.slice(1));

/** The explaining element, from this page or from another article's body. */
async function findBlock(link) {
  const id = blockId(link);
  const slug = link.dataset.article;
  if (!slug || document.querySelector(`.prose[data-article="${slug}"]`)?.isConnected) return document.getElementById(id);
  const article = articles.find(item => item.id === slug);
  if (!article) return null;
  const template = document.createElement('template');
  template.innerHTML = await articleBody(article);
  return template.content.getElementById(id);
}

export function closeTermCard() {
  clearTimeout(hoverTimer);
  card?.node.remove();
  card = null;
}

async function openCard(link) {
  if (card?.link === link) return;
  closeTermCard();
  const node = document.createElement('aside');
  node.className = 'term-card';
  node.setAttribute('aria-label', `${link.textContent} 的解释`);
  card = { node, link };
  const block = await findBlock(link).catch(() => null);
  if (card?.node !== node) return;
  const body = document.createElement('div');
  body.className = 'term-card-body prose';
  if (block) {
    const copy = block.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
    body.append(...(copy.localName === 'li' ? copy.childNodes : [copy]));
    if (body.querySelector('.katex')) loadMathStyles().catch(() => {});
  } else body.textContent = '找不到这段解释。';
  const jump = document.createElement('a');
  jump.className = 'term-card-jump';
  jump.href = link.getAttribute('href');
  jump.textContent = '跳到原文 →';
  jump.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); jumpTo(link); });
  node.append(body, jump);
  node.addEventListener('pointerleave', scheduleClose);
  node.addEventListener('pointerenter', () => clearTimeout(hoverTimer));
  document.body.append(node);
  place(node, link);
}

function place(node, link) {
  const box = link.getBoundingClientRect();
  const width = Math.min(360, innerWidth - 32);
  node.style.width = `${width}px`;
  const left = Math.max(16, Math.min(box.left + scrollX, innerWidth - width - 16 + scrollX));
  const below = box.bottom + 8 + node.offsetHeight < innerHeight || box.top < node.offsetHeight + 8;
  node.style.left = `${left}px`;
  node.style.top = `${below ? box.bottom + scrollY + 8 : box.top + scrollY - node.offsetHeight - 8}px`;
}

function scheduleClose() {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(closeTermCard, 250);
}

export function closeReturnChip() {
  chip?.remove();
  chip = null;
}

function jumpTo(link) {
  closeTermCard();
  // Another article: an ordinary navigation, so the browser's Back button returns.
  if (link.dataset.article && !document.querySelector(`.prose[data-article="${link.dataset.article}"]`)?.isConnected) {
    navigate('article', link.dataset.article, { hash: link.hash });
    return;
  }
  const target = document.getElementById(blockId(link));
  if (!target) return;
  const back = scrollY;
  target.scrollIntoView({ behavior: behavior(), block: 'center' });
  target.classList.remove('term-target');
  void target.offsetWidth;
  target.classList.add('term-target');
  closeReturnChip();
  chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'return-chip';
  chip.textContent = '↩ 回到原处';
  chip.addEventListener('click', () => {
    scrollTo({ top: back, behavior: behavior() });
    closeReturnChip();
    link.focus({ preventScroll: true });
  });
  document.body.append(chip);
}

/** Called from the page click handler first; returns true when it handled the click. */
export function handleTermClick(event, link) {
  if (!link.matches('a.block-link')) return false;
  if (card?.link === link) {
    const crossArticle = link.dataset.article && !document.querySelector(`.prose[data-article="${link.dataset.article}"]`)?.isConnected;
    closeTermCard();
    if (crossArticle) return false;   // let the normal article navigation run
    event.preventDefault();
    jumpTo(link);
    return true;
  }
  event.preventDefault();
  openCard(link);
  return true;
}

export function attachTermPreviews() {
  document.addEventListener('pointerover', event => {
    const link = event.target.closest?.('a.block-link');
    if (!link || event.pointerType !== 'mouse') return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => openCard(link), 150);
  });
  document.addEventListener('pointerout', event => {
    if (event.target.closest?.('a.block-link') && event.pointerType === 'mouse') scheduleClose();
  });
  document.addEventListener('focusin', event => {
    if (!pressing && event.target.matches?.('a.block-link')) openCard(event.target);
  });
  document.addEventListener('pointerup', () => setTimeout(() => { pressing = false; }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTermCard(); });
  document.addEventListener('pointerdown', event => {
    pressing = true;
    if (card && !card.node.contains(event.target) && !card.link.contains(event.target)) closeTermCard();
  });
}
