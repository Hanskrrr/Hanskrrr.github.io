// Turn a shell result's `action` into an effect on the page.
import { $, el, storage } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { terminalThemes, unlockUv, updateBrowserColor } from '../core/theme.js';
import { said } from '../core/uv.js';
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
    log('Use theme <name> to switch, e.g. theme blue.');
    return;
  }
  if (!Object.hasOwn(terminalThemes, name)) return;
  document.documentElement.dataset.terminalTheme = name;
  storage.set('gallery-terminal-theme', name);
  updateBrowserColor();
  log(`theme: ${name}`);
}

/** env: { log(text, kind), pet(), su(), history() } */
export async function runAction(action, { log, pet, su, history }) {
  const handlers = {
    clear: () => clearOutput(),
    blog: () => navigate('blog'),
    about: () => navigate('about'),
    article: ({ id }) => navigate('article', id, { fromTerminal: true }),
    theme: ({ name }) => theme(name, log),
    uv: () => { unlockUv(); log(said('unlock', 'uv')); },
    photo: ({ index }) => showPhoto(index),
    audio: ({ id }) => startProgram('player', { tracks: audioTracks, startIndex: Math.max(0, audioTracks.findIndex(track => track.id === id)) }),
    player: ({ tracks }) => startProgram('player', { tracks }),
    gallery: ({ photos, mode }) => startProgram('gallery', { photos, mode }),
    pager: ({ title, text }) => startProgram('pager', { title, text }),
    '2048': () => startProgram('2048'),
    stop: () => log('stop: nothing is playing'),
    su: () => su(),
    history: () => history(),
    sl: () => playTrain(),
    pet: () => pet(),
  };
  await handlers[action.type]?.(action);
}
