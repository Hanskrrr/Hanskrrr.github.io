// The homepage picture, alive. A small layer of sprites is drawn over the static
// pixel scene and moved in whole pixels at a stepped 10 fps: stars twinkle, clouds
// drift, chimney smoke rises, fireflies wander (night), a shooting star passes now
// and then, and a tiny version of the terminal creature sometimes strolls out of
// the cabin. Clicking the picture calls it out; the Konami code makes it dance and then
// hold up a tiny terminal board: clicking the board opens the (otherwise unlinked) terminal.
// Seasons add falling leaves (autumn), petals (spring) or snow (winter).
// Everything pauses while the picture is off-screen or the tab is hidden, and
// stays still with reduced motion.
import { navigate } from '../core/router.js';
import { gridToPaths, SCENE_HEIGHT, SCENE_WIDTH, sceneLayout, sprite } from './pixel-art.js';

const TICK = 100;
const NS = 'http://www.w3.org/2000/svg';
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const CLOUDS = [
  sprite(['...cc.....', '.cccccc.c.', 'cccccccccc'], { c: 'px-cloud' }),
  sprite(['.ccc...', 'ccccccc'], { c: 'px-cloud' }),
];
const CRITTER_KEYS = { o: 'px-critter-edge', b: 'px-critter-body', e: 'px-critter-eye', g: 'px-grass-light' };
const critterFrames = {
  front: ['.g..g.', '.oooo.', 'obebeo', 'obbbbo', '.o..o.'],
  blink: ['.g..g.', '.oooo.', 'obbbbo', 'obbbbo', '.o..o.'],
  right: ['.g..g.', '.oooo.', 'obbebo', 'obbbbo', '.o..o.'],
  right2: ['.g..g.', '.oooo.', 'obbebo', 'obbbbo', '..oo..'],
  left: ['.g..g.', '.oooo.', 'obebbo', 'obbbbo', '.o..o.'],
  left2: ['.g..g.', '.oooo.', 'obebbo', 'obbbbo', '..oo..'],
};
export const CRITTER = Object.fromEntries(Object.entries(critterFrames).map(([name, rows]) => [name, sprite(rows, CRITTER_KEYS)]));
const HEART = sprite(['h.h', 'hhh', '.h.'], { h: 'px-heart' });
// A tiny terminal on a stick: a prompt and a blinking cursor.
const BOARD_KEYS = { o: 'px-critter-edge', d: 'px-sky0', p: 'px-grass-light', c: 'px-window' };
const BOARD = [
  sprite(['ooooooo', 'opdcddo', 'ooooooo', '...o...', '...o...'], BOARD_KEYS),
  sprite(['ooooooo', 'opddddo', 'ooooooo', '...o...', '...o...'], BOARD_KEYS),
];

function layer(svg) {
  const group = document.createElementNS(NS, 'g');
  svg.append(group);
  return {
    group,
    frame: null,
    draw(grid, x, y) {
      if (this.frame !== grid) { group.innerHTML = gridToPaths(grid); this.frame = grid; }
      group.setAttribute('transform', `translate(${x} ${y})`);
      group.style.display = '';
    },
    hide() { group.style.display = 'none'; },
  };
}
function pixel(svg, className) {
  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('width', 1);
  rect.setAttribute('height', 1);
  rect.setAttribute('class', className);
  svg.append(rect);
  return {
    rect,
    at(x, y, cls = className) {
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      if (rect.getAttribute('class') !== cls) rect.setAttribute('class', cls);
      rect.style.display = '';
    },
    hide() { rect.style.display = 'none'; },
  };
}

/** Start the animation on a rendered .pixel-scene <svg>. Returns stop(). */
export function animateScene(svg, { reducedMotion = false } = {}) {
  const { stars, surface, cabin, tree, season } = sceneLayout();
  const live = document.createElementNS(NS, 'g');
  live.setAttribute('class', 'scene-live');
  svg.append(live);

  const clouds = CLOUDS.map((grid, index) => ({ grid, x: index ? 58 : 6, y: index ? 21 : 9, every: index ? 9 : 6, sprite: layer(live) }));
  clouds.forEach(cloud => cloud.sprite.draw(cloud.grid, cloud.x, cloud.y));
  if (reducedMotion) return () => live.remove();

  // --- entities -----------------------------------------------------------
  const twinkles = [...stars].sort(() => Math.random() - 0.5).slice(0, 8)
    .map(([x, y]) => ({ x, y, wait: rand(10, 90), on: 0, px: pixel(live, 'px-twinkle') }));
  twinkles.forEach(star => star.px.hide());

  const [chimneyX, chimneyTop] = cabin.chimney;
  const smoke = Array.from({ length: 5 }, () => ({ age: -1, x: 0, y: 0, px: pixel(live, 'px-smoke') }));
  smoke.forEach(puff => puff.px.hide());

  const fireflies = Array.from({ length: { summer: 6, spring: 3, autumn: 3, winter: 0 }[season] ?? 4 }, () => {
    const x = rand(30, SCENE_WIDTH - 4);
    return { x, y: surface(x) - rand(2, 6), on: true, px: pixel(live, 'px-firefly') };
  });

  const meteor = { wait: rand(120, 260), step: -1, x: 0, y: 0, head: pixel(live, 'px-meteor'), tail: [pixel(live, 'px-meteor-tail'), pixel(live, 'px-meteor-tail'), pixel(live, 'px-meteor-tail')] };
  [meteor.head, ...meteor.tail].forEach(part => part.hide());

  // Seasonal particles: leaves and petals fall from the tree, snow from the sky.
  const falling = season === 'summer' ? [] : Array.from({ length: season === 'winter' ? 12 : 4 }, () => ({ age: -1, x: 0, y: 0, rest: 0, px: pixel(live, 'px-snow') }));
  falling.forEach(item => item.px.hide());
  const fallClass = { autumn: ['px-leaf-autumn', 'px-leaf-autumn-light'], spring: ['px-blossom', 'px-blossom-light'], winter: ['px-snow', 'px-snow'] }[season];
  function spawnFalling(item) {
    if (season === 'winter') Object.assign(item, { age: 0, x: rand(0, SCENE_WIDTH - 1), y: rand(-20, 0), rest: 0 });
    else Object.assign(item, { age: 0, x: rand(tree.x, tree.x + tree.width - 1), y: tree.top + rand(2, tree.canopyRows), rest: 0 });
    item.cls = fallClass[rand(0, 1)];
  }

  const home = cabin.door - 3;           // critter's x when standing at the door
  const critter = { state: 'home', wait: rand(40, 120), x: home, target: home, pause: 0, hop: 0, heart: 0, step: 0, board: false, sprite: layer(live), heartSprite: layer(live), boardSprite: layer(live) };
  critter.sprite.hide();
  critter.heartSprite.hide();
  critter.boardSprite.hide();
  let boardAt = null;

  // --- behaviour ----------------------------------------------------------
  let tick = 0;
  function update() {
    tick += 1;
    for (const cloud of clouds) {
      if (tick % cloud.every === 0) {
        cloud.x += 1;
        if (cloud.x > SCENE_WIDTH) cloud.x = -cloud.grid[0].length;
        cloud.sprite.draw(cloud.grid, cloud.x, cloud.y);
      }
    }
    for (const star of twinkles) {
      if (star.on > 0) { star.on -= 1; if (!star.on) star.px.hide(); }
      else if (--star.wait <= 0) { star.px.at(star.x, star.y); star.on = 3; star.wait = rand(30, 120); }
    }
    if (tick % 14 === 0) {
      const puff = smoke.find(item => item.age < 0);
      if (puff) Object.assign(puff, { age: 0, x: chimneyX, y: chimneyTop - 1 });
    }
    for (const puff of smoke) {
      if (puff.age < 0) continue;
      puff.age += 1;
      if (puff.age % 4 === 0) puff.y -= 1;
      if (puff.age % 9 === 0) puff.x += 1;
      if (puff.age > 26) { puff.age = -1; puff.px.hide(); }
      else puff.px.at(puff.x, puff.y, puff.age > 14 ? 'px-smoke-thin' : 'px-smoke');
    }
    if (tick % 3 === 0) {
      for (const fly of fireflies) {
        fly.x = Math.max(28, Math.min(SCENE_WIDTH - 2, fly.x + rand(-1, 1)));
        fly.y = Math.max(surface(fly.x) - 7, Math.min(surface(fly.x) - 2, fly.y + rand(-1, 1)));
        if (Math.random() < 0.2) fly.on = !fly.on;
        fly.on ? fly.px.at(fly.x, fly.y) : fly.px.hide();
      }
    }
    updateFalling();
    updateMeteor();
    updateCritter();
  }

  function updateFalling() {
    for (const item of falling) {
      if (item.age < 0) {
        if (Math.random() < (season === 'winter' ? 0.2 : 0.02)) spawnFalling(item);
        continue;
      }
      item.age += 1;
      if (item.rest > 0) {                       // lying on the ground for a moment
        if (--item.rest === 0) { item.age = -1; item.px.hide(); }
        continue;
      }
      const slow = season === 'winter' ? 2 : 3;
      if (item.age % slow === 0) item.y += 1;
      if (item.age % 4 === 0) item.x += season === 'spring' ? 1 : rand(-1, 1);
      if (item.x < 0 || item.x >= SCENE_WIDTH) { item.age = -1; item.px.hide(); continue; }
      if (item.y >= surface(item.x) - 1) { item.y = surface(item.x) - 1; item.rest = season === 'winter' ? 6 : 25; }
      if (item.y >= 0) item.px.at(item.x, item.y, item.cls); else item.px.hide();
    }
  }

  function updateMeteor() {
    if (meteor.step < 0) {
      if (--meteor.wait > 0) return;
      Object.assign(meteor, { step: 0, x: rand(40, SCENE_WIDTH - 6), y: rand(1, 10) });
    }
    meteor.step += 1;
    const hx = meteor.x - meteor.step * 2;
    const hy = meteor.y + meteor.step;
    meteor.head.at(hx, hy);
    meteor.tail.forEach((part, index) => part.at(hx + (index + 1) * 2, hy - (index + 1)));
    if (meteor.step > 9) {
      [meteor.head, ...meteor.tail].forEach(part => part.hide());
      Object.assign(meteor, { step: -1, wait: rand(150, 320) });
    }
  }

  function drawCritter(frame) {
    const y = surface(critter.x + 3) - 5 - (critter.hop ? [0, 1, 2, 1][critter.hop % 4] : 0);
    critter.sprite.draw(CRITTER[frame], critter.x, y);
    // After the dance, the board goes up (and the heart gives way to it).
    if (critter.board && critter.hop === 0) {
      boardAt = [critter.x - 1, y - 5];
      critter.boardSprite.draw(BOARD[Math.floor(tick / 5) % 2], ...boardAt);
      critter.heartSprite.hide();
      return;
    }
    boardAt = null;
    critter.boardSprite.hide();
    if (critter.heart > 0) critter.heartSprite.draw(HEART, critter.x + 2, y - 5 - (critter.heart < 8 ? 1 : 0));
    else critter.heartSprite.hide();
  }
  function comeOut() {
    Object.assign(critter, { state: 'walk', x: home, target: rand(home + 12, 70), step: 0 });
  }
  function updateCritter() {
    if (critter.heart > 0) critter.heart -= 1;
    if (critter.hop > 0) critter.hop -= 1;
    switch (critter.state) {
      case 'home':
        critter.sprite.hide();
        critter.heartSprite.hide();
        critter.boardSprite.hide();
        critter.board = false;
        boardAt = null;
        if (--critter.wait <= 0) comeOut();
        return;
      case 'walk': {
        if (tick % 2 === 0) {
          critter.x += Math.sign(critter.target - critter.x);
          critter.step += 1;
        }
        const dir = critter.target > critter.x ? 'right' : 'left';
        drawCritter(critter.step % 2 ? `${dir}2` : dir);
        if (critter.x === critter.target) {
          if (critter.target === home) Object.assign(critter, { state: 'home', wait: rand(250, 500) });
          else Object.assign(critter, { state: 'idle', pause: rand(25, 60) });
        }
        return;
      }
      case 'idle':
        drawCritter(critter.hop > 8 ? (critter.hop % 8 < 4 ? 'left' : 'right') : critter.pause % 17 === 0 ? 'blink' : 'front');
        if (--critter.pause <= 0 && !critter.hop) Object.assign(critter, { state: 'walk', target: home });
    }
  }

  // Clicking the picture calls the critter out, or makes it hop with a heart.
  function onClick(event) {
    // A click on (or right next to) the raised board opens the terminal.
    if (boardAt) {
      const box = svg.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * SCENE_WIDTH;
      const y = ((event.clientY - box.top) / box.height) * SCENE_HEIGHT;
      if (x >= boardAt[0] - 1 && x <= boardAt[0] + 8 && y >= boardAt[1] - 1 && y <= boardAt[1] + 4) return navigate('terminal');
    }
    if (critter.state === 'home') comeOut();
    else {
      Object.assign(critter, { state: 'idle', pause: rand(30, 50), hop: 8, heart: 16 });
    }
  }
  // The Konami code (see main.js) makes it dance.
  function onDance() {
    if (critter.state === 'home') Object.assign(critter, { x: home + 10, target: home + 10 });
    Object.assign(critter, { state: 'idle', pause: 450, hop: 48, heart: 48, board: true });
  }
  const art = svg.closest('.hero-art');
  art?.addEventListener('click', onClick);
  addEventListener('gallery:dance', onDance);

  // --- scheduling ---------------------------------------------------------
  let visible = true;
  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); })
    : null;
  observer?.observe(svg);
  let timer;
  function loop() {
    if (!svg.isConnected) return stop();
    if (visible && !document.hidden) update();
    timer = setTimeout(loop, visible && !document.hidden ? TICK : 400);
  }
  function stop() {
    clearTimeout(timer);
    observer?.disconnect();
    art?.removeEventListener('click', onClick);
    removeEventListener('gallery:dance', onDance);
  }
  timer = setTimeout(loop, TICK);
  return stop;
}

