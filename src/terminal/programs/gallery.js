import { createTextScreen } from '../text-screen.js';
import { photoCatalog } from '../../content/photos.js';
import { fitImageToCells, imageDataToCharacterLines } from './gallery-renderer.js';

export { fitImageToCells, imageDataToCharacterLines } from './gallery-renderer.js';

export function mountGallery(container, {
  signal,
  onExit = () => {},
  announce = () => {},
  photos = photoCatalog,
  mode = 'ascii',
  onOpenPhoto = () => {},
} = {}) {
  if (signal?.aborted) return () => {};
  const document = container.ownerDocument;
  const window = document.defaultView || globalThis;
  const cache = new Map();
  const pending = new Map();
  const loads = new Set();
  let disposed = false;
  let current = 0;
  let generation = 0;
  let imageData = null;
  let failure = false;
  let screen;
  if (!['ascii', 'mono', 'blocks'].includes(mode)) mode = 'ascii';

  function draw() {
    if (disposed || !screen) return;
    const photo = photos[current];
    const label = { ascii: '彩色 ASCII', mono: '单色 ASCII', blocks: '彩色半块' }[mode];
    const lines = [
      [{ text: 'gallery ', fg: 'accent' }, { text: photo ? `${photo.file}  [${current + 1}/${photos.length}]` : '(empty)' }],
      [{ text: label, fg: 'muted' }],
    ];
    if (screen.rows >= 8) lines.push('');
    const availableRows = Math.max(1, screen.rows - lines.length - 3);
    if (imageData) {
      const fit = fitImageToCells(imageData.width, imageData.height, Math.max(1, screen.columns), availableRows, mode);
      const padding = ' '.repeat(Math.floor((screen.columns - fit.columns) / 2));
      for (const row of imageDataToCharacterLines(imageData, { ...fit, mode })) {
        lines.push([{ text: padding }, ...row]);
      }
    } else {
      lines.push([{ text: !photo ? '此目录没有图像。' : failure ? '图像读取失败；N/P 切换。' : '正在读取图像…', fg: failure ? 'error' : 'muted' }]);
    }
    lines.push('', [{ text: '←/→ N/P image  A/M/B style', fg: 'muted' }], [{ text: 'O original  Q/Esc exit', fg: 'muted' }]);
    screen.render(lines);
  }

  function loadImage(photo) {
    if (cache.has(photo.src)) return Promise.resolve(cache.get(photo.src));
    if (pending.has(photo.src)) return pending.get(photo.src);
    const request = new Promise((resolve, reject) => {
      const image = new window.Image();
      const load = { image, reject };
      loads.add(load);
      function finish() {
        loads.delete(load);
        image.onload = null;
        image.onerror = null;
      }
      image.onload = () => {
        finish();
        if (disposed) { reject(new Error('Gallery closed.')); return; }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context || !canvas.width || !canvas.height) throw new Error('Image sampling unavailable.');
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          cache.set(photo.src, pixels);
          resolve(pixels);
        } catch (error) { reject(error); }
      };
      image.onerror = () => { finish(); reject(new Error('Image load failed.')); };
      image.src = photo.src;
    });
    pending.set(photo.src, request);
    request.then(() => pending.delete(photo.src), () => pending.delete(photo.src));
    return request;
  }

  async function select(index) {
    if (disposed || !photos.length) { draw(); return; }
    current = (index + photos.length) % photos.length;
    const request = ++generation;
    imageData = null;
    failure = false;
    draw();
    try {
      const pixels = await loadImage(photos[current]);
      if (disposed || generation !== request) return;
      imageData = pixels;
      announce(`${photos[current].title}，${current + 1}/${photos.length}，${mode === 'mono' ? '单色' : '彩色'}字符预览。`);
    } catch {
      if (disposed || generation !== request) return;
      failure = true;
      announce('图像读取失败，可按 N 或 P 切换。');
    }
    draw();
  }

  function exit() {
    if (disposed) return;
    dispose();
    onExit();
  }

  function onKey(event) {
    if (disposed || event.isComposing) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' || key === 'q' || event.ctrlKey && key === 'c') {
      event.preventDefault(); exit(); return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (key === 'arrowright' || key === 'n' || key === 'arrowleft' || key === 'p') {
      event.preventDefault();
      void select(current + (key === 'arrowright' || key === 'n' ? 1 : -1));
    } else if (['a', 'm', 'b'].includes(key)) {
      event.preventDefault();
      mode = { a: 'ascii', m: 'mono', b: 'blocks' }[key];
      draw();
    } else if (key === 'o' && photos[current]) {
      event.preventDefault();
      onOpenPhoto(photos[current]);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    signal?.removeEventListener('abort', dispose);
    for (const load of loads) {
      load.image.onload = null;
      load.image.onerror = null;
      load.image.src = '';
      load.reject(new Error('Gallery closed.'));
    }
    loads.clear();
    pending.clear();
    cache.clear();
    imageData = null;
    screen?.dispose();
  }

  screen = createTextScreen(container, { signal, title: '字符相册', onKey, onResize: draw });
  signal?.addEventListener('abort', dispose, { once: true });
  draw();
  screen.focus();
  void select(0);
  return dispose;
}
