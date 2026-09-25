// Session-only display of decrypted exhibit content (the creature's room, room.js). Nothing is stored; leaving the
// page (lockContent) aborts pending unlocks, revokes media URLs and drops the content. The one exception is
// the creature's secret path (core/portal.js): while it visits the homepage picture the content stays in
// memory so it can walk back; any other navigation locks as usual.
import { $, el, main, reducedMotion } from '../core/dom.js';
import { portal } from '../core/portal.js';
import { navigate, renderView, runLeaveHooks, swapPage } from '../core/router.js';
// The decryption code and the room itself load only when someone actually unlocks it.
const loadCrypto = () => import('./crypto.js');

let unlockController;
let decrypted = null;
let mediaUrls = [];
let mediaController = new AbortController();
let disposeRoom = () => {};
let traveling = false;   // the next lockContent only closes the room, keeping the content
let arrival = null;      // 'left' when the creature walks back in from the picture

/** The creature walked out through the room's left wall: into the homepage picture. */
function walkOut() {
  traveling = true;
  portal.visitor = true;
  portal.back = walkBack;
  navigate('blog');
}
/** It walked out of the picture's right edge: back into the room, in through the left wall. */
function walkBack() {
  if (!decrypted) return;
  traveling = true;
  arrival = 'left';
  portal.visitor = false;
  runLeaveHooks();
  swapPage(() => renderView('exhibit'));
}

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
  document.querySelectorAll('audio').forEach(audio => { audio.pause(); });
  if (traveling) { traveling = false; return; }
  portal.visitor = false;
  portal.back = null;
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
  const bytes = ref.data !== undefined ? Uint8Array.from(atob(ref.data), character => character.charCodeAt(0)) : await (await loadCrypto()).decryptMedia(ref, { signal });
  if (signal.aborted) throw new DOMException('Locked', 'AbortError');
  const url = URL.createObjectURL(new Blob([bytes], { type: ref.mime }));
  mediaUrls.push(url);
  return url;
}
/** The inner password, entered inside the room: merge the locked items and redraw the room. */
async function openInner(passphrase, panel) {
  const { signal } = mediaController;
  try {
    const { mergeInner, unlockInner } = await loadCrypto();
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
  // The room is its own place: no site header, title or footer, only the way back at the bottom.
  const container = el('section','exhibit');
  const room = el('div','room');
  const leave = el('div','exhibit-leave');
  leave.innerHTML = '<button class="button" data-action="lock">锁定并返回 <span aria-hidden="true">←</span></button>';
  container.append(el('h1','sr-only',decrypted.title), room, leave);
  main.replaceChildren(container);
  const content = decrypted;
  import('./room.js').then(({ mountRoom }) => {
    // Still the same unlocked room on screen (not locked or redrawn meanwhile)?
    if (decrypted !== content || !room.isConnected) return;
    disposeRoom = mountRoom(room, content, { mediaUrl, onUnlock: openInner, start: typeof start === 'string' ? start : 'intro', reducedMotion: reducedMotion.matches, arrive: arrival, onWalkOut: walkOut });
    arrival = null;
  });
}

export const exhibitPage = { title: '内容展示', render: renderExhibit };
