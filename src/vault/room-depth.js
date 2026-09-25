// Looking around the room: its depth layers (wall, tilted floor, furniture, creature, foreground)
// shift by different amounts, so the flat picture reads as a space. Drag to turn your head
// (it eases back when you let go); on a desktop the view also drifts a little with the mouse,
// and on a phone with its tilt. Shifts are a few room pixels at most. Nothing moves with
// reduced motion, or while a close-up is open.

const RANGE = { x: 4, y: 2 };                   // room pixels, at depth factor 1
// How far each layer moves. Things standing on the floor move like the floor where they stand:
// the furniture against the wall (feet around row 45), the creature out on the rug (row 52), and
// the plant, armchair and sofa at the front (feet on row 58: floorDepth(58) ≈ 0.93).
export const DEPTH = { far: 0.3, mid: 0.45, actor: 0.7, fore: 0.93 };
// The floor is tilted between its back edge, joined to the wall, and its front edge.
const FLOOR = { back: 41, front: 60, near: 1 };
/** Depth factor of the floor at a row (the wall's factor at the back edge). */
export const floorDepth = row => DEPTH.far + ((row - FLOOR.back) / (FLOOR.front - FLOOR.back)) * (FLOOR.near - DEPTH.far);

/** Offsets in room pixels for each layer, for a look direction in [-1, 1]². */
export function depthOffsets(look) {
  const clamp = value => Math.max(-1, Math.min(1, value));
  const x = clamp(look.x);
  const y = clamp(look.y);
  const at = factor => ({ x: x * RANGE.x * factor, y: y * RANGE.y * factor });
  return { ...Object.fromEntries(Object.entries(DEPTH).map(([name, factor]) => [name, at(factor)])), floorFront: at(FLOOR.near) };
}

/** The floor's SVG transform: every row shifts by the floor's depth there, so it shears. */
export function floorTransform({ far, floorFront }) {
  const span = FLOOR.front - FLOOR.back;
  const a = (floorFront.x - far.x) / span;
  const b = (floorFront.y - far.y) / span;
  const f = value => value.toFixed(4);
  return `matrix(1 0 ${f(a)} ${f(1 + b)} ${f(far.x - FLOOR.back * a)} ${f(far.y - FLOOR.back * b)})`;
}

/**
 * stage: .room-stage; art: its <svg> with <g class="depth-far|mid|fore">. Hotspots and overlays
 * follow through CSS variables --far-x/--far-y, --mid-x/--mid-y (in px) set on the stage.
 * Returns { enable(on), dispose() }.
 */
export function attachDepth({ stage, art, reducedMotion = false }) {
  if (reducedMotion) return { enable() {}, dispose() {} };
  const groups = Object.fromEntries([...Object.keys(DEPTH), 'floor'].map(name => [name, art.querySelector(`.depth-${name}`)]));
  const look = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const hover = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, active: false };
  let enabled = true;
  let drag = null;
  let frame = 0;
  let swallowClick = false;

  function paint() {
    const offsets = depthOffsets(look);
    const unit = stage.clientWidth / 128;
    for (const name of Object.keys(DEPTH)) {
      const { x, y } = offsets[name];
      groups[name]?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      if (name !== 'fore') {
        stage.style.setProperty(`--${name}-x`, `${(x * unit).toFixed(1)}px`);
        stage.style.setProperty(`--${name}-y`, `${(y * unit).toFixed(1)}px`);
      }
    }
    groups.floor?.setAttribute('transform', floorTransform(offsets));
  }
  function animate() {
    const base = drag ? drag.look : tilt.active ? tilt : hover;
    target.x = enabled ? base.x : 0;
    target.y = enabled ? base.y : 0;
    look.x += (target.x - look.x) * 0.18;
    look.y += (target.y - look.y) * 0.18;
    const settled = Math.abs(target.x - look.x) < 0.002 && Math.abs(target.y - look.y) < 0.002;
    if (settled) { look.x = target.x; look.y = target.y; }
    paint();
    frame = settled ? 0 : requestAnimationFrame(animate);
  }
  const kick = () => { frame ||= requestAnimationFrame(animate); };

  // The mouse: looking towards a side pulls the near things the other way.
  const onMove = event => {
    if (drag && event.pointerId === drag.id) {
      const dx = (event.clientX - drag.x) / (stage.clientWidth * 0.35);
      const dy = (event.clientY - drag.y) / (stage.clientHeight * 0.6);
      if (Math.abs(event.clientX - drag.x) > 6) { drag.moved = true; stage.classList.add('looking'); }
      drag.look = { x: drag.start.x + dx, y: drag.start.y + dy };
      kick();
      return;
    }
    if (event.pointerType !== 'mouse') return;
    const box = stage.getBoundingClientRect();
    hover.x = -((event.clientX - box.left) / box.width - 0.5) * 0.8;
    hover.y = -((event.clientY - box.top) / box.height - 0.5) * 0.8;
    kick();
  };
  const onLeave = event => { if (event.pointerType === 'mouse' && !drag) { hover.x = hover.y = 0; kick(); } };
  const onDown = event => {
    if (!enabled || event.button > 0) return;
    askForTilt();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { ...look }, look: { ...look }, moved: false };
  };
  const onUp = event => {
    if (!drag || event.pointerId !== drag.id) return;
    // A drag is not a click: don't open whatever the pointer happened to be over.
    swallowClick = drag.moved;
    drag = null;
    stage.classList.remove('looking');
    kick();
  };
  const onClick = event => { if (swallowClick) { event.stopPropagation(); event.preventDefault(); swallowClick = false; } };

  // A phone's tilt, relative to how it was held when the room opened.
  let rest = null;
  const onTilt = event => {
    if (event.gamma === null || event.beta === null) return;
    rest ??= { gamma: event.gamma, beta: event.beta };
    tilt.x = -(event.gamma - rest.gamma) / 20;
    tilt.y = -(event.beta - rest.beta) / 25;
    tilt.active = true;
    kick();
  };
  let tiltAsked = false;
  function askForTilt() {
    if (tiltAsked || !matchMedia('(pointer: coarse)').matches || typeof DeviceOrientationEvent === 'undefined') return;
    tiltAsked = true;
    // iPhone asks the visitor once; elsewhere the events simply arrive.
    const ask = DeviceOrientationEvent.requestPermission;
    if (typeof ask === 'function') ask.call(DeviceOrientationEvent).then(state => { if (state === 'granted') addEventListener('deviceorientation', onTilt); }, () => {});
    else addEventListener('deviceorientation', onTilt);
  }

  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  stage.addEventListener('click', onClick, true);
  const onResize = () => paint();
  addEventListener('resize', onResize);
  paint();

  return {
    /** Off while a close-up is open: everything eases back to straight ahead. */
    enable(on) { enabled = on; if (!on) drag = null; kick(); },
    dispose() {
      cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick, true);
      removeEventListener('resize', onResize);
      removeEventListener('deviceorientation', onTilt);
    },
  };
}
