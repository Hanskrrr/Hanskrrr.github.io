// The unlocked exhibit as the creature's room. Each object opens one part of the
// decrypted content in the panel below; a row of text buttons offers the same
// choices for keyboards and small screens. Decrypted text is only ever inserted
// with textContent, and media URLs are created lazily and revoked on lock.
import { gridToPaths, svg } from '../blog/pixel-art.js';
import { creatureGrid, CREATURE_AT, HOTSPOTS, ROOM_HEIGHT, ROOM_WIDTH, roomGrid } from './room-art.js';

const LABELS = { intro: '窗外', journal: '日记', photos: '照片', timeline: '时间线', music: '音乐', creature: '小生物' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Render the room into `container`. content: decrypted exhibit.
 * mediaUrl(item) → blob URL (tracked by the caller for revocation).
 * Returns dispose().
 */
export function mountRoom(container, content, { mediaUrl, reducedMotion = false }) {
  const available = {
    intro: true,
    journal: content.articles.length > 0,
    photos: content.images.length > 0,
    timeline: Boolean(content.timeline?.length),
    music: Boolean(content.audio),
    creature: true,
  };
  const stage = el('div', 'room-stage');
  stage.innerHTML = svg(roomGrid({ journal: available.journal, photos: available.photos, timeline: available.timeline, music: available.music }), { className: 'pixel-art room-scene' });
  const art = stage.querySelector('svg');
  const ns = 'http://www.w3.org/2000/svg';
  const creature = document.createElementNS(ns, 'g');
  const heart = document.createElementNS(ns, 'g');
  creature.setAttribute('transform', `translate(${CREATURE_AT[0]} ${CREATURE_AT[1]})`);
  heart.innerHTML = gridToPaths([['px-heart', '', 'px-heart'], ['px-heart', 'px-heart', 'px-heart'], ['', 'px-heart', '']]);
  heart.setAttribute('transform', `translate(${CREATURE_AT[0] + 12} ${CREATURE_AT[1] + 1})`);
  heart.style.display = 'none';
  art.append(creature, heart);
  const pose = name => { creature.innerHTML = gridToPaths(creatureGrid(name)); };
  pose('idle');

  const legend = el('div', 'room-legend');
  legend.setAttribute('role', 'toolbar');
  legend.setAttribute('aria-label', '房间里的物品');
  const panel = el('section', 'room-panel');
  panel.setAttribute('aria-live', 'polite');
  const buttons = {};

  for (const [name, [x, y, w, h]] of Object.entries(HOTSPOTS)) {
    if (!available[name]) continue;
    const hotspot = el('button', 'room-hotspot');
    hotspot.type = 'button';
    hotspot.dataset.object = name;
    hotspot.setAttribute('aria-label', LABELS[name]);
    Object.assign(hotspot.style, { left: `${(x / ROOM_WIDTH) * 100}%`, top: `${(y / ROOM_HEIGHT) * 100}%`, width: `${(w / ROOM_WIDTH) * 100}%`, height: `${(h / ROOM_HEIGHT) * 100}%` });
    hotspot.append(el('span', 'room-tip', LABELS[name]));
    stage.append(hotspot);
    if (name !== 'creature') {
      const button = el('button', 'room-choice', LABELS[name]);
      button.type = 'button';
      button.dataset.object = name;
      legend.append(button);
      buttons[name] = button;
    }
  }

  // --- panels ---------------------------------------------------------------
  const media = new Map();
  const urlFor = item => { if (!media.has(item)) media.set(item, mediaUrl(item)); return media.get(item); };
  const panels = {
    intro() {
      return [el('h2', '', content.title), el('p', 'room-text', content.intro)];
    },
    journal() {
      const list = el('div', 'room-tabs');
      const body = el('article', 'room-article');
      const show = index => {
        const article = content.articles[index];
        body.replaceChildren(el('h3', '', article.title), el('p', 'room-text', article.body));
        list.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      };
      content.articles.forEach((article, index) => {
        const button = el('button', 'filter', article.title);
        button.type = 'button';
        button.addEventListener('click', () => show(index));
        list.append(button);
      });
      show(0);
      return [el('h2', '', '日记'), list, body];
    },
    photos() {
      const grid = el('div', 'room-photos');
      content.images.forEach(item => {
        const figure = el('figure');
        const img = el('img');
        img.alt = item.title;
        img.src = urlFor(item);
        figure.append(img, el('figcaption', '', item.title));
        grid.append(figure);
      });
      return [el('h2', '', '照片'), grid];
    },
    music() {
      const audio = el('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = urlFor(content.audio);
      audio.setAttribute('aria-label', content.audio.title);
      return [el('h2', '', '音乐'), el('p', 'room-text', content.audio.title), audio];
    },
    timeline() {
      const list = el('ol', 'trail');
      content.timeline.forEach(entry => {
        const item = el('li');
        item.append(el('span', 'trail-date', entry.date), el('strong', '', entry.title));
        if (entry.text) item.append(el('p', 'room-text', entry.text));
        list.append(item);
      });
      return [el('h2', '', '时间线'), list];
    },
  };

  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function pet() {
    timers.forEach(clearTimeout);
    timers = [];
    heart.style.display = '';
    if (reducedMotion) pose('happy');
    else ['crouch', 'jump', 'jump-high', 'jump', 'crouch', 'happy'].forEach((name, i) => later(i * 90, () => pose(name)));
    later(1600, () => { heart.style.display = 'none'; pose('idle'); });
  }
  function open(name) {
    if (name === 'creature') return pet();
    panel.replaceChildren(...panels[name]());
    Object.entries(buttons).forEach(([key, button]) => button.setAttribute('aria-pressed', String(key === name)));
    stage.querySelectorAll('.room-hotspot').forEach(hotspot => hotspot.classList.toggle('active', hotspot.dataset.object === name));
  }
  const onClick = event => {
    const target = event.target.closest('[data-object]');
    if (target) open(target.dataset.object);
  };
  stage.addEventListener('click', onClick);
  legend.addEventListener('click', onClick);

  // Blink now and then while the room is open.
  let blink;
  const scheduleBlink = () => {
    if (reducedMotion) return;
    blink = setTimeout(() => {
      if (!stage.isConnected) return;
      if (heart.style.display === 'none') { pose('blink'); setTimeout(() => stage.isConnected && heart.style.display === 'none' && pose('idle'), 150); }
      scheduleBlink();
    }, 2500 + Math.random() * 3500);
  };
  scheduleBlink();

  container.append(stage, legend, panel);
  open('intro');
  return () => { clearTimeout(blink); timers.forEach(clearTimeout); };
}
