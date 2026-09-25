// The unlocked exhibit as the creature's room. Each object opens one part of the
// decrypted content in the panel below; a row of text buttons offers the same
// choices for keyboards and small screens. Decrypted text is inserted with
// textContent, except html rendered at publish time from the owner's vault
// (markdown-it with raw HTML off), which is authenticated by the cipher. Media is
// decrypted lazily into blob URLs (revoked on lock); third-party players load only
// when asked, and only from the hosts in embeds.js.
import { svg } from '../blog/pixel-art.js';
import { enhance } from '../blog/rich.js';
import { embedSize, isAllowedEmbed } from './embeds.js';
import { HOTSPOTS, ROOM_HEIGHT, ROOM_WIDTH, roomGrid } from './room-art.js';
import { animateRoom } from './room-life.js';

const LABELS = { lamp: '台灯', intro: '窗外', journal: '日记', serials: '手稿', books: '书架', photos: '照片', thoughts: '便签', timeline: '时间线', films: '放映机', music: '点唱机', creature: '小生物' };

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
 * onUnlock(passphrase, panel) → Promise<boolean>: opens the inner lock (the caller re-renders).
 * start: the panel to open first. Returns dispose().
 */
export function mountRoom(container, content, { mediaUrl, onUnlock, start = 'intro', reducedMotion = false }) {
  const available = {
    intro: true,
    journal: content.articles.length > 0,
    serials: content.serials.length > 0,
    books: content.books.length > 0,
    photos: content.photos.length > 0,
    thoughts: content.thoughts.length > 0,
    timeline: Boolean(content.timeline?.length),
    films: content.films.length > 0,
    music: content.music.length > 0,
    creature: true,
    lamp: true,
  };
  const stage = el('div', 'room-stage');
  stage.innerHTML = svg(roomGrid(available), { className: 'pixel-art room-scene' });
  const art = stage.querySelector('svg');
  const life = animateRoom({ stage, art, reducedMotion });

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
    if (name !== 'creature' && name !== 'lamp') {
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
  function player(url, onLoad) {
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
      onLoad?.();
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
    node.addEventListener('play', () => life.setMusic(true));
    for (const type of ['pause', 'ended']) node.addEventListener(type, () => life.setMusic(false));
    return node;
  }
  // --- the inner lock ------------------------------------------------------------
  /** A form for the inner password; on success the caller re-renders the room at `name`. */
  function unlockForm(name, hint, back) {
    const form = el('form', 'room-unlock');
    form.append(el('h3', '', '上锁的内容'));
    if (hint) form.append(el('p', 'room-text', hint));
    const input = el('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', '口令');
    input.placeholder = '口令';
    const submit = el('button', 'room-choice', '解锁');
    submit.type = 'submit';
    const message = el('p', 'room-text room-unlock-message');
    message.setAttribute('role', 'status');
    const row = el('div', 'room-unlock-row');
    row.append(input, submit);
    form.append(row, message);
    if (back) {
      const backButton = el('button', 'room-choice', '← 返回');
      backButton.type = 'button';
      backButton.addEventListener('click', back);
      form.prepend(backButton);
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const value = input.value;
      input.value = '';
      if (!value || !onUnlock) return;
      submit.disabled = true;
      message.textContent = '正在解锁…';
      const opened = await onUnlock(value, name);
      if (form.isConnected && !opened) { message.textContent = '口令不对。'; submit.disabled = false; input.focus(); }
    });
    queueMicrotask(() => input.focus());
    return form;
  }
  /** A locked item in a list: a padlock card with its hint. */
  function lockedCard(item, className, open) {
    const button = el('button', `${className} room-locked`);
    button.type = 'button';
    button.append(el('span', 'room-lock-icon', '▣'), el('span', 'shelf-title', '上锁'), el('span', 'shelf-sub', item.hint || '需要另一个口令'));
    button.addEventListener('click', open);
    return button;
  }

  /** Your overview notes for one object: rankings, scores, one-line comments. */
  function overview(kind) {
    const section = el('div', 'room-lists');
    for (const item of content.lists.filter(entry => entry.kind === kind)) section.append(el('h3', '', item.title), prose(item.html));
    return section;
  }
  /** Links inside notes ([[三体]]) open that item: kind → (id → shows it). */
  const openers = {};
  /** A list panel whose items open a detail view in place. */
  function collection(title, items, renderList, renderDetail, kind) {
    const wrap = el('div');
    const showList = () => wrap.replaceChildren(el('h2', '', title), overview(kind), renderList(index => showItem(index)));
    const showItem = index => wrap.replaceChildren(renderDetail(items[index], showList));
    openers[kind] = id => { const index = items.findIndex(item => item.id === id); if (index >= 0) showItem(index); };
    showList();
    return [wrap];
  }
  function openItem(kind, id) {
    open(kind);
    openers[kind]?.(id);
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
        if (article.locked) body.replaceChildren(unlockForm('journal', article.hint));
        else {
          body.replaceChildren(el('h3', '', article.title));
          body.append(article.html ? prose(article.html) : el('p', 'room-text', article.body));
        }
        list.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      };
      content.articles.forEach((article, index) => {
        const button = el('button', 'filter', article.locked ? '▣ 上锁' : article.title);
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
            if (book.locked) { list.append(lockedCard(book, 'shelf-item', () => open(index))); continue; }
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
      }, (book, back) => book.locked ? unlockForm('books', book.hint, back) : detail(book, byline(book.author, book.year, book.shelf), back), 'books');
    },
    films() {
      return collection('放映机', content.films, open => {
        const list = el('div', 'shelf-items film-items');
        content.films.forEach((film, index) => {
          if (film.locked) { list.append(lockedCard(film, 'shelf-item', () => open(index))); return; }
          const button = el('button', 'shelf-item');
          button.type = 'button';
          button.append(cover(film), el('span', 'shelf-title', film.title), el('span', 'shelf-sub', byline(film.kind, film.director, film.year)));
          button.addEventListener('click', () => open(index));
          list.append(button);
        });
        return list;
      }, (film, back) => film.locked ? unlockForm('films', film.hint, back) : detail(film, byline(film.kind, film.director, film.year), back, [player(film.embed, () => life.setTheater(true))]), 'films');
    },
    music() {
      return collection('点唱机', content.music, open => {
        const list = el('ol', 'track-list');
        content.music.forEach((track, index) => {
          const item = el('li');
          if (track.locked) { item.append(lockedCard(track, 'track', () => open(index))); list.append(item); return; }
          const button = el('button', 'track');
          button.type = 'button';
          button.append(cover(track, 'track-cover'), el('span', 'shelf-title', track.title), el('span', 'shelf-sub', byline(track.artist, track.album, track.year)));
          button.addEventListener('click', () => open(index));
          item.append(button);
          list.append(item);
        });
        return list;
      }, (track, back) => track.locked ? unlockForm('music', track.hint, back) : detail(track, byline(track.artist, track.album, track.year), back, [track.audio && audio(track.audio, track.title), player(track.embed, () => life.setMusic(true))]), 'music');
    },
    serials() {
      const wrap = el('div');
      const list = () => {
        const items = el('div', 'serial-list');
        content.serials.forEach(serial => {
          if (serial.locked) { items.append(lockedCard(serial, 'serial-card', () => wrap.replaceChildren(unlockForm('serials', serial.hint, list)))); return; }
          const button = el('button', 'serial-card');
          button.type = 'button';
          button.append(el('span', 'shelf-title', serial.title), el('span', 'shelf-sub', `${serial.chapters.length} 章`));
          if (serial.summary) button.append(el('span', 'room-text serial-summary', serial.summary));
          button.addEventListener('click', () => contents(serial));
          items.append(button);
        });
        wrap.replaceChildren(el('h2', '', '手稿'), overview('serials'), items);
      };
      openers.serials = id => {
        const serial = content.serials.find(item => item.id === id);
        if (serial?.locked) wrap.replaceChildren(unlockForm('serials', serial.hint, list));
        else if (serial) contents(serial);
      };
      const contents = serial => {
        const view = el('article', 'serial');
        const back = el('button', 'room-choice', '← 返回');
        back.type = 'button';
        back.addEventListener('click', list);
        view.append(back, el('h3', '', serial.title));
        if (serial.html) view.append(prose(serial.html));
        const toc = el('ol', 'serial-chapters');
        serial.chapters.forEach((chapter, index) => {
          const item = el('li');
          const button = el('button', 'room-choice', `${String(chapter.chapter).padStart(2, '0')}  ${chapter.title}`);
          button.type = 'button';
          button.addEventListener('click', () => read(serial, index));
          item.append(button);
          toc.append(item);
        });
        view.append(toc);
        wrap.replaceChildren(view);
      };
      const read = (serial, index) => {
        const chapter = serial.chapters[index];
        const view = el('article', 'serial');
        const nav = el('div', 'serial-nav');
        const step = (label, target) => {
          const button = el('button', 'room-choice', label);
          button.type = 'button';
          button.disabled = target === null;
          button.addEventListener('click', () => (target === 'toc' ? contents(serial) : read(serial, target)));
          return button;
        };
        nav.append(step('← 上一章', index > 0 ? index - 1 : null), step('目录', 'toc'), step('下一章 →', index < serial.chapters.length - 1 ? index + 1 : null));
        view.append(el('p', 'shelf-sub', `《${serial.title}》 · 第 ${chapter.chapter} 章`), el('h3', '', chapter.title), prose(chapter.html), nav);
        wrap.replaceChildren(view);
        panel.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
      };
      list();
      return [wrap];
    },
    thoughts() {
      const board = el('div', 'note-board');
      content.thoughts.forEach(thought => {
        if (thought.locked) { board.append(lockedCard(thought, 'note-card', () => panel.replaceChildren(unlockForm('thoughts', thought.hint, () => open('thoughts'))))); return; }
        const note = el('article', 'note-card');
        note.append(el('time', 'shelf-sub', thought.date.replaceAll('-', '.')), prose(thought.html));
        board.append(note);
      });
      return [el('h2', '', '便签'), board];
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

  function open(name, { walk = true } = {}) {
    if (name === 'creature') return life.pet();
    if (name === 'lamp') return life.toggleLamp();
    if (walk) life.goTo(name);
    life.setFilm(name === 'films');
    life.setMusic(false);
    panel.replaceChildren(...panels[name]());
    Object.entries(buttons).forEach(([key, button]) => button.setAttribute('aria-pressed', String(key === name)));
    stage.querySelectorAll('.room-hotspot').forEach(hotspot => hotspot.classList.toggle('active', hotspot.dataset.object === name));
  }
  panel.addEventListener('click', event => {
    const link = event.target.closest('a[data-room]');
    if (!link) return;
    event.preventDefault();
    const [kind, id] = link.dataset.room.split(':');
    openItem(kind, id);
  });
  const onClick = event => {
    const target = event.target.closest('[data-object]');
    if (target) open(target.dataset.object);
  };
  stage.addEventListener('click', onClick);
  legend.addEventListener('click', onClick);

  container.append(stage, legend, panel);
  open(available[start] ? start : 'intro', { walk: false });
  return () => life.dispose();
}
