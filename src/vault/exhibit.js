// Session-only display of decrypted exhibit content. Nothing is stored; leaving the
// page (lockContent) aborts pending unlocks, revokes media URLs and drops the content.
import { $, el, main } from '../core/dom.js';
import { renderView, swapPage } from '../core/router.js';

let unlockController;
let decrypted = null;
let mediaUrls = [];

/** Abort any earlier attempt and return the controller for a new one. */
export function startUnlock() {
  unlockController?.abort();
  unlockController = new AbortController();
  return unlockController;
}
export function openExhibit(content) {
  decrypted = content;
  // Decrypted content has no permanent route or saved unlocked flag.
  swapPage(() => renderView('exhibit'));
}
export function lockContent() {
  unlockController?.abort();
  unlockController = undefined;
  decrypted = null;
  document.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
  mediaUrls.forEach(url => URL.revokeObjectURL(url));
  mediaUrls = [];
  $('#photo-dialog').close();
  $('#photo-detail').replaceChildren();
}
function mediaUrl(item) {
  const bytes = Uint8Array.from(atob(item.data),character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes],{type:item.mime}));
  mediaUrls.push(url);
  return url;
}
function renderExhibit() {
  if (!decrypted) { renderView('terminal'); return; }
  const container = el('section','exhibit');
  const heading = el('div','page-intro');
  heading.innerHTML = '<div class="page-topline"><span class="eyebrow">EXHIBIT / UNLOCKED</span><button class="button" data-action="lock">锁定并返回 <span aria-hidden="true">←</span></button></div>';
  heading.append(el('h1','',decrypted.title),el('p','',decrypted.intro));
  container.append(heading, el('p','exhibit-note','内容已在此浏览器中解密。离开此界面或刷新页面后，需要重新输入口令。'));
  const grid = el('div','exhibit-grid');
  const textColumn = el('div','private-media');
  decrypted.articles.forEach((article,index) => {
    const card = el('article','private-article');
    card.append(el('span','eyebrow',`TEXT / ${String(index+1).padStart(2,'0')}`),el('h2','',article.title),el('p','',article.body));
    textColumn.append(card);
  });
  const media = el('div','private-media');
  decrypted.images.forEach(item => {
    const figure = el('figure');
    const img = el('img');
    img.alt = item.title;
    img.src = mediaUrl(item);
    figure.append(img,el('figcaption','',item.title));
    media.append(figure);
  });
  if (decrypted.audio) {
    const card = el('div','private-audio');
    const audio = el('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = mediaUrl(decrypted.audio);
    audio.setAttribute('aria-label',decrypted.audio.title);
    card.append(el('h3','',decrypted.audio.title),audio);
    media.append(card);
  }
  grid.append(textColumn,media);
  container.append(grid);
  main.replaceChildren(container);
}

export const exhibitPage = { title: '内容展示', render: renderExhibit };
