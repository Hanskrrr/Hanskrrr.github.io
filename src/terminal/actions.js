// Turn a shell result's `action` into an effect on the page.
import { $, el, storage } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { terminalThemes, updateBrowserColor } from '../core/theme.js';
import { audioTracks } from '../content/audio.js';
import { photoCatalog } from '../content/photos.js';
import { playTrain, startProgram } from './programs/runtime.js';
import { clearOutput } from './ui/output.js';

/** Open an original image in the photo dialog (an explicit "open" is the exception to text-only). */
export function showPhoto(index) {
  const photo = photoCatalog[index];
  if (!photo) return;
  $('#photo-title').textContent = photo.title;
  const image = el('img');
  image.src = photo.src;
  image.alt = photo.title;
  $('#photo-detail').replaceChildren(image);
  $('#photo-dialog').showModal();
}

function theme(name, log) {
  if (!name) {
    const current = document.documentElement.dataset.terminalTheme;
    Object.entries(terminalThemes).forEach(([key, value]) => log(`${key === current ? '*' : ' '} ${key.padEnd(7)} ${value.label}`));
    log('使用 theme <名称> 切换，例如 theme blue。');
    return;
  }
  if (!Object.hasOwn(terminalThemes, name)) return;
  document.documentElement.dataset.terminalTheme = name;
  storage.set('gallery-terminal-theme', name);
  updateBrowserColor();
  log(`theme: ${name}`);
}

/** env: { log(text, kind), pet() } */
export async function runAction(action, { log, pet }) {
  const handlers = {
    clear: () => clearOutput(),
    blog: () => navigate('blog'),
    about: () => navigate('about'),
    thoughts: () => navigate('thoughts'),
    article: ({ id }) => navigate('article', id, { fromTerminal: true }),
    theme: ({ name }) => theme(name, log),
    photo: ({ index }) => showPhoto(index),
    audio: ({ id }) => startProgram('player', { tracks: audioTracks, startIndex: Math.max(0, audioTracks.findIndex(track => track.id === id)) }),
    player: ({ tracks }) => startProgram('player', { tracks }),
    gallery: ({ photos, mode }) => startProgram('gallery', { photos, mode }),
    pager: ({ title, text }) => startProgram('pager', { title, text }),
    '2048': () => startProgram('2048'),
    stop: () => log('当前没有播放的音频。'),
    sl: () => playTrain(),
    pet: () => pet(),
  };
  await handlers[action.type]?.(action);
}
