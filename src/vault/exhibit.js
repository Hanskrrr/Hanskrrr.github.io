// Session-only display of decrypted exhibit content (the creature's room, room.js). Nothing is stored; leaving the
// page (lockContent) aborts pending unlocks, revokes media URLs and drops the content.
import { $, el, main, reducedMotion } from '../core/dom.js';
import { renderView, swapPage } from '../core/router.js';
import { decryptMedia, mergeInner, unlockInner } from './crypto.js';
import { mountRoom } from './room.js';

let unlockController;
let decrypted = null;
let mediaUrls = [];
let mediaController = new AbortController();
let disposeRoom = () => {};

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
  disposeRoom();
  disposeRoom = () => {};
  unlockController?.abort();
  unlockController = undefined;
  decrypted = null;
  document.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
  mediaController.abort();
  mediaController = new AbortController();
  mediaUrls.forEach(url => URL.revokeObjectURL(url));
  mediaUrls = [];
  $('#photo-dialog').close();
  $('#photo-detail').replaceChildren();
}
/** Inline media is decoded; separately encrypted files are fetched and decrypted. */
async function mediaUrl(ref) {
  const { signal } = mediaController;
  const bytes = ref.data !== undefined ? Uint8Array.from(atob(ref.data), character => character.charCodeAt(0)) : await decryptMedia(ref, { signal });
  if (signal.aborted) throw new DOMException('Locked', 'AbortError');
  const url = URL.createObjectURL(new Blob([bytes], { type: ref.mime }));
  mediaUrls.push(url);
  return url;
}
/** The inner password, entered inside the room: merge the locked items and redraw the room. */
async function openInner(passphrase, panel) {
  const { signal } = mediaController;
  try {
    const inner = await unlockInner(passphrase, { signal });
    if (signal.aborted || !decrypted) return false;
    decrypted = mergeInner(decrypted, inner);
    disposeRoom();
    renderExhibit(panel);
    return true;
  } catch {
    return false;
  }
}
function renderExhibit(start) {
  if (!decrypted) { renderView('terminal'); return; }
  const container = el('section','exhibit');
  const heading = el('div','page-intro');
  heading.innerHTML = '<div class="page-topline"><span class="eyebrow">EXHIBIT / UNLOCKED</span><button class="button" data-action="lock">锁定并返回 <span aria-hidden="true">←</span></button></div>';
  heading.append(el('h1','',decrypted.title));
  container.append(heading, el('p','exhibit-note','内容已在此浏览器中解密。离开此界面或刷新页面后，需要重新输入口令。'));
  const room = el('div','room');
  container.append(room);
  main.replaceChildren(container);
  disposeRoom = mountRoom(room, decrypted, { mediaUrl, onUnlock: openInner, start: typeof start === 'string' ? start : 'intro', reducedMotion: reducedMotion.matches });
}

export const exhibitPage = { title: '内容展示', render: renderExhibit };
