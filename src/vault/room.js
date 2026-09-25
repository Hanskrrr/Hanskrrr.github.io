// The unlocked exhibit as the creature's room. Each object opens one part of the
// decrypted content in the panel below; a row of text buttons offers the same
// choices for keyboards and small screens. Decrypted text is inserted with
// textContent, except html rendered at publish time from the owner's vault
// (markdown-it with raw HTML off), which is authenticated by the cipher. Media is
// decrypted lazily into blob URLs (revoked on lock); third-party players load only
// when asked, and only from the hosts in embeds.js.
import { svg } from '../blog/pixel-art.js';
import { enhance } from '../blog/rich.js';
import { embedSize, isAllowedEmbed, toScreen } from './embeds.js';
import { HOTSPOTS, ROOM_HEIGHT, ROOM_WIDTH, roomGrid, SCREEN } from './room-art.js';
import { audience, closeUp, curtains, DUST, RECORD_WINDOW } from './room-closeups.js';
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
  // The scene and its hotspots sit in one view, so "walk up to the screen" can zoom it.
  const viewLayer = el('div', 'room-view');
  viewLayer.innerHTML = svg(roomGrid(available), { className: 'pixel-art room-scene' });
  stage.append(viewLayer);
  const art = viewLayer.querySelector('svg');
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
    viewLayer.append(hotspot);
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
    /** Also called by the jukebox's own ▶, so both buttons do the same thing. */
    box.start = () => {
      if (!box.contains(load)) return;
      const frame = el('iframe');
      // You asked for it, so NetEase's player may start at once.
      const source = new URL(url);
      if (source.hostname === 'music.163.com') source.searchParams.set('auto', '1');
      frame.src = source.href;
      frame.title = '播放器';
      frame.loading = 'lazy';
      frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      box.replaceChildren(frame);
      // NetEase's player stays silent for VIP and licensed songs (it gets no audio address).
      if (source.hostname === 'music.163.com') box.after(el('p', 'room-text room-embed-note', '没有声音？网易云的会员或版权歌曲在外链播放器里放不出来。换成 bilibili 的链接，或者用你自己的音频文件（audio:）。'));
      onLoad?.();
    };
    load.addEventListener('click', box.start);
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
  // --- close-ups: the projector and the jukebox ------------------------------------
  // "Walk up" scales the room view so the object fills the stage (room-closeups.js); the
  // player and the record are real elements placed over the object's pixels, resized rather
  // than scaled, so video and covers stay sharp. Nothing third-party loads until played.
  const place = (node, { left, top, width, height }) => {
    node.style.left = `${left * 100}%`;
    node.style.top = `${top * 100}%`;
    node.style.width = `${width * 100}%`;
    node.style.height = `${height * 100}%`;
  };
  const dim = el('div', 'closeup-dim');
  const cinema = el('div', 'cinema');
  cinema.innerHTML = `${curtains()}<div class="cinema-beam">${DUST.map(([x, y, delay, time]) => `<i style="left:${x}%;top:${y}%;animation-delay:${delay}s;animation-duration:${time}s"></i>`).join('')}</div>${audience()}`;
  cinema.setAttribute('aria-hidden', 'true');
  const screen = el('div', 'room-screen');
  const record = el('div', 'jukebox-window');
  const disc = el('div', 'jukebox-cd');
  record.append(disc);
  const strips = el('div', 'jukebox-strips');
  const closeupControls = el('div', 'room-screen-controls');
  stage.append(dim, cinema, screen, record, strips, closeupControls);
  const control = (label, action) => {
    const button = el('button', 'room-choice', label);
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
  };
  /** Remotes in the panel below (one per open panel) redraw through this. */
  const remotes = new Set();
  const syncAll = () => {
    closeupControls.replaceChildren(...({
      screen: [control('← 退后', () => zoom(null)), control('⏻ 关机', powerOff)],
      jukebox: [control('⏮', () => step(-1)), control(deck.link ? (deck.loaded.has(deck.index) ? '↓ 播放器' : '▶') : deck.playing ? '⏸' : '▶', togglePlay), control('⏭', () => step(1)), control('← 退后', () => zoom(null))],
    }[closeup] || []));
    renderStrips();
    for (const sync of remotes) sync();
  };
  /** A remote's sync: stops listening once its panel has been replaced. */
  const listen = (box, sync) => {
    const wrapped = () => {
      if (box.isConnected) box.dataset.shown = '1';
      else if (box.dataset.shown) { remotes.delete(wrapped); return; }
      sync();
    };
    remotes.add(wrapped);
    sync();
  };

  let closeup = null;
  function zoom(name) {
    closeup = name === 'screen' && !projector.url ? null : name;
    const view = closeUp(closeup);
    stage.classList.toggle('zoomed', Boolean(closeup));
    stage.dataset.closeup = closeup || '';
    viewLayer.style.transform = closeup ? view.transform : '';
    place(screen, view.place(SCREEN));
    place(record, view.place(RECORD_WINDOW));
    syncAll();
    if (closeup) stage.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  // The projector.
  const projector = { url: null, title: '' };
  function project(url, title) {
    const frame = el('iframe');
    frame.src = url;
    frame.title = title || '放映机';
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.setAttribute('allowfullscreen', '');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    // A title card flickers on while the player loads underneath.
    const card = el('div', 'screen-card');
    card.append(el('span', '', 'NOW SHOWING'), el('strong', '', title || new URL(url).hostname));
    card.addEventListener('animationend', () => card.remove());
    screen.replaceChildren(frame, card);
    Object.assign(projector, { url, title });
    stage.classList.add('projecting');
    life.setFilm(true);
    life.setTheater(true);
    if (closeup && closeup !== 'screen') zoom('screen'); else syncAll();
  }
  function powerOff() {
    screen.replaceChildren();
    Object.assign(projector, { url: null, title: '' });
    stage.classList.remove('projecting');
    life.setTheater(false);
    life.setFilm(panel.dataset.open === 'films');
    if (closeup === 'screen') zoom(null); else syncAll();
  }
  const playFilm = film => { const url = film.embed && toScreen(film.embed); if (url) project(url, film.title); return Boolean(url); };
  /** The projector remote: an address bar, walk up and power off. */
  function projectorRemote() {
    const box = el('div', 'projector-remote');
    const form = el('form', 'room-unlock-row projector-address');
    const address = el('input');
    address.type = 'url';
    address.placeholder = '粘贴 YouTube 或 bilibili 视频链接';
    address.setAttribute('aria-label', '视频链接');
    address.autocomplete = 'off';
    const go = el('button', 'room-choice', '▶ 放映');
    go.type = 'submit';
    form.append(address, go);
    const message = el('p', 'room-text projector-status');
    message.setAttribute('role', 'status');
    const near = control('', () => zoom(closeup === 'screen' ? null : 'screen'));
    const power = control('⏻ 关机', powerOff);
    const buttons = el('div', 'projector-buttons');
    buttons.append(near, power);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const url = toScreen(address.value);
      if (!url) { message.textContent = '只能放映 YouTube 或 bilibili 的视频页链接（b23.tv 短链请先在浏览器里打开，复制完整地址）。'; return; }
      address.value = '';
      project(url, new URL(url).hostname === 'player.bilibili.com' ? 'bilibili' : 'YouTube');
    });
    box.append(form, buttons, message);
    listen(box, () => {
      power.disabled = near.disabled = !projector.url;
      near.textContent = closeup === 'screen' ? '← 退后' : '⤢ 走近屏幕';
      message.textContent = projector.url ? `正在放映：${projector.title || new URL(projector.url).hostname}` : '放映机关着。选一部片子，或者粘贴一个视频链接。';
    });
    return box;
  }

  // The jukebox: your own audio plays through one shared player; a song that is only a
  // link (NetEase, Spotify…) plays in its own player in the panel below.
  const deck = { index: -1, audio: new Audio(), playing: false, link: false, loaded: new Set() };
  deck.audio.preload = 'metadata';
  const playable = index => { const track = content.music[index]; return track && !track.locked && (track.audio || track.embed); };
  const setSpinning = on => {
    deck.playing = on;
    disc.classList.toggle('spinning', on);
    stage.classList.toggle('music-on', on);
    life.setMusic(on);
    syncAll();
  };
  deck.audio.addEventListener('play', () => setSpinning(true));
  deck.audio.addEventListener('pause', () => setSpinning(false));
  deck.audio.addEventListener('ended', () => step(1, { ownFiles: true }));
  function showDisc(track) {
    disc.style.removeProperty('--cover');
    disc.dataset.title = track.title;
    if (track.cover) urlFor(track.cover).then(url => { if (content.music[deck.index] === track) disc.style.setProperty('--cover', `url("${url}")`); }, () => {});
  }
  /** Put a song on: your own file plays at once; a link song opens its page below. */
  function playTrack(index, { reveal = true, follow = true } = {}) {
    const track = content.music[index];
    if (!playable(index)) return;
    if (follow && closeup && closeup !== 'jukebox') zoom('jukebox');
    deck.index = index;
    deck.link = !track.audio;
    showDisc(track);
    if (track.audio) {
      // The whole file is fetched and decrypted before it can play: say so meanwhile.
      deck.loading = true;
      urlFor(track.audio).then(url => {
        deck.loading = false;
        if (deck.index !== index) return;
        if (deck.audio.src !== url) deck.audio.src = url;
        deck.audio.play().catch(error => { if (error.name === 'NotSupportedError') deck.failed = index; setSpinning(false); });
      }, () => { deck.loading = false; deck.failed = index; setSpinning(false); });
    } else {
      deck.audio.pause();
      // A link song counts as playing once its player has been loaded.
      setSpinning(deck.loaded.has(index));
    }
    if (reveal && (panel.dataset.open === 'music' || deck.link)) openItem('music', track.id);
    else syncAll();
  }
  function togglePlay() {
    if (deck.index < 0) return playTrack(content.music.findIndex((_, index) => playable(index)));
    if (deck.link) {
      // A link song plays in its site's player below the room: ▶ loads it, then points to it.
      if (!deck.embedBox?.isConnected || deck.embedBox.dataset.index !== String(deck.index)) openItem('music', content.music[deck.index].id);
      if (deck.loaded.has(deck.index)) deck.embedBox?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
      else deck.embedBox?.start();
      return;
    }
    if (deck.audio.paused) deck.audio.play().catch(() => {}); else deck.audio.pause();
  }
  /** The next (or previous) song; when a song ends, only your own files follow on. */
  function step(direction, { ownFiles = false } = {}) {
    const count = content.music.length;
    for (let i = 1; i <= count; i++) {
      const index = (deck.index + direction * i + count * count) % count;
      if (playable(index) && (!ownFiles || content.music[index].audio)) return playTrack(index, { reveal: !ownFiles, follow: !ownFiles });
    }
  }
  function renderStrips() {
    if (closeup !== 'jukebox') return strips.replaceChildren();
    const heading = el('p', 'jukebox-now', deck.index >= 0 ? `NOW PLAYING · ${content.music[deck.index].title}` : 'SELECT A SONG');
    const grid = el('div', 'jukebox-strip-grid');
    content.music.forEach((track, index) => {
      if (!playable(index)) return;
      const strip = control('', () => playTrack(index));
      strip.classList.add('jukebox-strip');
      strip.setAttribute('aria-pressed', String(index === deck.index));
      strip.append(el('span', 'strip-code', `${'ABCDEFGH'[Math.floor(index / 10) % 8]}${index % 10 + 1}`), el('span', 'strip-title', track.title), el('span', 'strip-sub', byline(track.artist)));
      grid.append(strip);
    });
    const hint = deck.link && !deck.playing ? el('p', 'jukebox-hint', '这首是链接歌曲：在下方加载它的播放器。') : '';
    strips.replaceChildren(heading, grid, hint);
  }
  /** The jukebox remote: now playing, ⏮ ⏯ ⏭, a progress bar for your own files, walk up. */
  function jukeboxRemote() {
    const box = el('div', 'projector-remote');
    const message = el('p', 'room-text projector-status');
    message.setAttribute('role', 'status');
    const buttons = el('div', 'projector-buttons');
    const play = control('', togglePlay);
    const near = control('', () => zoom(closeup === 'jukebox' ? null : 'jukebox'));
    buttons.append(control('⏮', () => step(-1)), play, control('⏭', () => step(1)), near);
    const seek = el('input', 'jukebox-seek');
    seek.type = 'range';
    seek.min = 0;
    seek.step = 'any';
    seek.setAttribute('aria-label', '播放进度');
    seek.addEventListener('input', () => { deck.audio.currentTime = Number(seek.value); });
    const tick = () => {
      if (!box.isConnected) { deck.audio.removeEventListener('timeupdate', tick); return; }
      seek.max = deck.audio.duration || 0;
      seek.value = deck.audio.currentTime;
    };
    deck.audio.addEventListener('timeupdate', tick);
    box.append(message, buttons, seek);
    listen(box, () => {
      const track = content.music[deck.index];
      play.textContent = deck.link ? (deck.loaded.has(deck.index) ? '↓ 播放器' : '▶') : deck.playing ? '⏸' : '▶';
      near.textContent = closeup === 'jukebox' ? '← 退后' : '⤢ 走近点唱机';
      seek.hidden = !track?.audio;
      message.textContent = !track ? '点唱机等着。选一首歌。'
        : deck.link ? `${track.title}：在下方${deck.loaded.has(deck.index) ? '的播放器里控制' : '加载它的播放器'}（链接歌曲）`
          : deck.failed === deck.index ? `${track.title}：这个浏览器载入或播放不了这个音频（试试 mp3 或 m4a）。`
            : deck.loading ? `正在取出唱片：${track.title}…`
              : `${deck.playing ? '正在播放' : '暂停'}：${track.title}`;
    });
    return box;
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
      // The remote stays on top; the channels (your films) or one film's page below it.
      const body = el('div');
      const showList = () => {
        const list = el('div', 'shelf-items film-items');
        content.films.forEach((film, index) => {
          if (film.locked) { list.append(lockedCard(film, 'shelf-item', () => showItem(index))); return; }
          const button = el('button', 'shelf-item');
          button.type = 'button';
          button.append(cover(film), el('span', 'shelf-title', film.title), el('span', 'shelf-sub', byline(film.kind, film.director, film.year)));
          button.addEventListener('click', () => { playFilm(film); showItem(index); });
          list.append(button);
        });
        body.replaceChildren(overview('films'), list);
      };
      const showItem = index => {
        const film = content.films[index];
        if (film.locked) { body.replaceChildren(unlockForm('films', film.hint, showList)); return; }
        const play = film.embed && toScreen(film.embed) ? control('▶ 在幕布上放映', () => playFilm(film)) : null;
        body.replaceChildren(detail(film, byline(film.kind, film.director, film.year), showList, [play]));
      };
      openers.films = id => { const index = content.films.findIndex(item => item.id === id); if (index >= 0) showItem(index); };
      showList();
      return [el('h2', '', '放映机'), projectorRemote(), body];
    },
    music() {
      // The remote on top; the song list (clicking a song puts it on) or one song's page below.
      const body = el('div');
      const showList = () => {
        const list = el('ol', 'track-list');
        content.music.forEach((track, index) => {
          const item = el('li');
          if (track.locked) { item.append(lockedCard(track, 'track', () => showItem(index))); list.append(item); return; }
          const button = el('button', 'track');
          button.type = 'button';
          button.setAttribute('aria-pressed', String(index === deck.index));
          button.append(cover(track, 'track-cover'), el('span', 'shelf-title', track.title), el('span', 'shelf-sub', byline(track.artist, track.album, track.year)));
          button.addEventListener('click', () => { if (playable(index)) playTrack(index, { reveal: false }); showItem(index); });
          item.append(button);
          list.append(item);
        });
        body.replaceChildren(overview('music'), list);
      };
      const showItem = index => {
        const track = content.music[index];
        if (track.locked) { body.replaceChildren(unlockForm('music', track.hint, showList)); return; }
        const put = track.audio && deck.index !== index ? control('▶ 放进点唱机', () => playTrack(index, { reveal: false })) : null;
        const embed = player(track.embed, () => { deck.loaded.add(index); deck.audio.pause(); if (deck.index !== index) playTrack(index, { reveal: false }); else setSpinning(true); });
        if (embed) { embed.dataset.index = index; if (deck.index === index || deck.index < 0) deck.embedBox = embed; }
        const nothing = !track.audio && !embed ? el('p', 'room-text room-embed-note', '这首歌还没有可以放的声音：在笔记里加上 audio:（你自己的音频文件）或 link:（网易云、bilibili 等链接）。') : null;
        body.replaceChildren(detail(track, byline(track.artist, track.album, track.year), showList, [put, track.audio ? null : embed, nothing]));
      };
      openers.music = id => { const index = content.music.findIndex(item => item.id === id); if (index >= 0) showItem(index); };
      showList();
      return [el('h2', '', '点唱机'), jukeboxRemote(), body];
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
    // A film keeps playing while you look at other things in the room.
    life.setFilm(name === 'films' || Boolean(projector.url));
    if (projector.url) life.setTheater(true);
    life.setMusic(deck.playing);
    panel.dataset.open = name;
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

  const onKey = event => { if (event.key === 'Escape' && closeup) zoom(null); };
  document.addEventListener('keydown', onKey);

  container.append(stage, legend, panel);
  open(available[start] ? start : 'intro', { walk: false });
  zoom(null);
  return () => {
    document.removeEventListener('keydown', onKey);
    screen.replaceChildren();
    deck.audio.pause();
    deck.audio.removeAttribute('src');
    deck.audio.load();
    life.dispose();
  };
}
