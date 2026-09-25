// The unlocked exhibit as the creature's room. Each object opens one part of the
// decrypted content in the panel below; a row of text buttons offers the same
// choices for keyboards and small screens. Decrypted text is inserted with
// textContent, except html rendered at publish time from the owner's vault
// (markdown-it with raw HTML off), which is authenticated by the cipher. Media is
// decrypted lazily into blob URLs (revoked on lock); third-party players load only
// when asked, and only from the hosts in embeds.js.
import { gridToPaths, svg } from '../blog/pixel-art.js';
import { enhance } from '../blog/rich.js';
import { embedSize, isAllowedEmbed } from './embeds.js';
import { creatureGrid, CREATURE_AT, HOTSPOTS, ROOM_HEIGHT, ROOM_WIDTH, roomGrid } from './room-art.js';

const LABELS = { intro: '窗外', journal: '日记', books: '书架', photos: '照片', timeline: '时间线', films: '放映机', music: '点唱机', creature: '小生物' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function prose(html) {
  const node = el('div', 'prose room-prose');
  node.innerHTML = html;
  enhance(node);
  return node;
}
const byline = (...parts) => parts.filter(Boolean).join(' · ');

/**
 * Render the room into `container`. content: decrypted exhibit (crypto.js readExhibit).
 * mediaUrl(ref) → Promise<blob URL> (tracked by the caller for revocation).
 * Returns dispose().
 */
export function mountRoom(container, content, { mediaUrl, reducedMotion = false }) {
  const available = {
    intro: true,
    journal: content.articles.length > 0,
    books: content.books.length > 0,
    photos: content.photos.length > 0,
    timeline: Boolean(content.timeline?.length),
    films: content.films.length > 0,
    music: content.music.length > 0,
    creature: true,
  };
  const stage = el('div', 'room-stage');
  stage.innerHTML = svg(roomGrid(available), { className: 'pixel-art room-scene' });
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

  // --- media ------------------------------------------------------------------
  const urls = new Map();
  const urlFor = ref => { if (!urls.has(ref)) urls.set(ref, mediaUrl(ref)); return urls.get(ref); };
  /** An <img> whose source is decrypted in the background. */
  function image(ref, alt, className) {
    const img = el('img', className);
    img.alt = alt;
    img.decoding = 'async';
    urlFor(ref).then(url => { img.src = url; }, () => img.classList.add('room-media-failed'));
    return img;
  }
  function cover(item, className = 'shelf-cover') {
    if (item.cover) return image(item.cover, item.title, className);
    const blank = el('div', `${className} shelf-blank`);
    blank.append(el('span', '', item.title));
    return blank;
  }
  /** A third-party player that loads only when asked. */
  function player(url) {
    if (!url || !isAllowedEmbed(url)) return null;
    const box = el('div', 'room-embed');
    const size = embedSize(url);
    if (size.aspect) box.style.aspectRatio = size.aspect;
    else box.style.height = `${size.height}px`;
    const load = el('button', 'room-choice room-embed-load', `▶ 加载播放器（${new URL(url).hostname}）`);
    load.type = 'button';
    load.addEventListener('click', () => {
      const frame = el('iframe');
      frame.src = url;
      frame.title = '播放器';
      frame.loading = 'lazy';
      frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      box.replaceChildren(frame);
    });
    box.append(load);
    return box;
  }
  /** Detail view shared by the bookshelf, projector and jukebox. */
  function detail(item, meta, back, extras = []) {
    const view = el('article', 'shelf-detail');
    const header = el('div', 'shelf-detail-head');
    const info = el('div');
    info.append(el('h3', '', item.title));
    if (meta) info.append(el('p', 'room-text shelf-meta', meta));
    if (item.link) {
      const link = el('a', 'small-link', '打开链接 ↗');
      link.href = item.link;
      link.target = '_blank';
      link.rel = 'noreferrer';
      info.append(link);
    }
    header.append(cover(item, 'shelf-detail-cover'), info);
    const backButton = el('button', 'room-choice', '← 返回');
    backButton.type = 'button';
    backButton.addEventListener('click', back);
    view.append(backButton, header, ...extras.filter(Boolean));
    if (item.html) view.append(prose(item.html));
    return view;
  }
  function audio(ref, title) {
    const node = el('audio');
    node.controls = true;
    node.preload = 'metadata';
    node.setAttribute('aria-label', title);
    urlFor(ref).then(url => { node.src = url; }, () => node.replaceWith(el('p', 'room-text', '音频无法解密或加载。')));
    return node;
  }
  /** A list panel whose items open a detail view in place. */
  function collection(title, items, renderList, renderDetail) {
    const wrap = el('div');
    const showList = () => wrap.replaceChildren(el('h2', '', title), renderList(index => wrap.replaceChildren(renderDetail(items[index], showList))));
    showList();
    return [wrap];
  }

  // --- panels -------------------------------------------------------------------
  const panels = {
    intro() {
      return [el('h2', '', content.title), content.introHtml ? prose(content.introHtml) : el('p', 'room-text', content.intro)];
    },
    journal() {
      const list = el('div', 'room-tabs');
      const body = el('article', 'room-article');
      const show = index => {
        const article = content.articles[index];
        body.replaceChildren(el('h3', '', article.title));
        body.append(article.html ? prose(article.html) : el('p', 'room-text', article.body));
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
    books() {
      return collection('书架', content.books, open => {
        const shelves = el('div', 'bookshelf');
        const groups = Map.groupBy ? Map.groupBy(content.books.map((book, index) => ({ book, index })), entry => entry.book.shelf || '')
          : content.books.reduce((map, book, index) => map.set(book.shelf || '', [...(map.get(book.shelf || '') || []), { book, index }]), new Map());
        for (const [name, entries] of groups) {
          const row = el('section', 'shelf-row');
          if (name) row.append(el('h3', '', name));
          const list = el('div', 'shelf-items');
          for (const { book, index } of entries) {
            const button = el('button', 'shelf-item');
            button.type = 'button';
            button.append(cover(book), el('span', 'shelf-title', book.title), el('span', 'shelf-sub', byline(book.author, book.year)));
            button.addEventListener('click', () => open(index));
            list.append(button);
          }
          row.append(list);
          shelves.append(row);
        }
        return shelves;
      }, (book, back) => detail(book, byline(book.author, book.year, book.shelf), back));
    },
    films() {
      return collection('放映机', content.films, open => {
        const list = el('div', 'shelf-items film-items');
        content.films.forEach((film, index) => {
          const button = el('button', 'shelf-item');
          button.type = 'button';
          button.append(cover(film), el('span', 'shelf-title', film.title), el('span', 'shelf-sub', byline(film.kind, film.director, film.year)));
          button.addEventListener('click', () => open(index));
          list.append(button);
        });
        return list;
      }, (film, back) => detail(film, byline(film.kind, film.director, film.year), back, [player(film.embed)]));
    },
    music() {
      return collection('点唱机', content.music, open => {
        const list = el('ol', 'track-list');
        content.music.forEach((track, index) => {
          const item = el('li');
          const button = el('button', 'track');
          button.type = 'button';
          button.append(cover(track, 'track-cover'), el('span', 'shelf-title', track.title), el('span', 'shelf-sub', byline(track.artist, track.album, track.year)));
          button.addEventListener('click', () => open(index));
          item.append(button);
          list.append(item);
        });
        return list;
      }, (track, back) => detail(track, byline(track.artist, track.album, track.year), back, [track.audio && audio(track.audio, track.title), player(track.embed)]));
    },
    photos() {
      const grid = el('div', 'room-photos');
      content.photos.forEach(item => {
        const figure = el('figure');
        figure.append(image(item.media, item.title), el('figcaption', '', item.title));
        grid.append(figure);
      });
      return [el('h2', '', '照片'), grid];
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
