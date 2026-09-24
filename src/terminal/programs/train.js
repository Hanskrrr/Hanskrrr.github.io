// Original ASCII artwork. The `sl` command's idea is a reference, not its art/code.
const BODY = String.raw`
            __
       _____||____         _______________
  ____/  ____    |_______ |               |
 / __ | | [] |   |       ||    GALLERY    |
| |__||_|____|___|_______||_______________|
 \_____________________/  \_____________/
` .trimEnd().split('\n').slice(1);

const SMOKE = [
  ['          .    .', '            o', '           ( )'],
  ['        .     .', '          o   .', '            ( )'],
  ['      .    .', '         o   .', '           ( )'],
  ['    .     .', '        .   o', '            ( )'],
];

const WHEELS = [
  '   (-)==(-)==(-)  (-)       (-)---(-)',
  '   (/)==(/)==(/)  (/)       (/)---(/)',
  '   (|)==(|)==(|)  (|)       (|)---(|)',
  String.raw`   (\)==(\)==(\)  (\)       (\)---(\)`,
];

const FRAMES = SMOKE.map((smoke, index) => [...smoke, ...BODY, WHEELS[index]]);
const COLUMNS = Math.max(...FRAMES.flat().map(line => line.length));
const FRAME_TEXT = FRAMES.map(lines => lines.map(line => line.padEnd(COLUMNS)).join('\n'));
const CELL_WIDTH = 8;
const LINE_HEIGHT = 16;
const DURATION = 4400;

/** Run an original, cancellable text train; it leaves the caller's log intact. */
export async function runTrain(container, { signal, reducedMotion = false } = {}) {
  if (signal?.aborted) return;

  const document = container.ownerDocument;
  const stage = document.createElement('div');
  stage.className = 'tty-train-stage';
  stage.setAttribute('aria-hidden', 'true');
  Object.assign(stage.style, {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    height: `${FRAMES[0].length * LINE_HEIGHT}px`,
    overflow: 'hidden',
    contain: 'layout paint',
  });

  const frame = document.createElement('pre');
  frame.className = 'tty-train-frame';
  Object.assign(frame.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    margin: '0',
    padding: '0',
    width: `${COLUMNS * CELL_WIDTH}px`,
    maxWidth: 'none',
    overflow: 'visible',
    whiteSpace: 'pre',
    font: 'inherit',
    fontSize: `${LINE_HEIGHT}px`,
    lineHeight: `${LINE_HEIGHT}px`,
    letterSpacing: '0',
    fontWeight: '400',
  });
  frame.textContent = FRAME_TEXT[0];
  stage.append(frame);
  container.append(stage);

  await new Promise(resolve => {
    let animationId;
    let timerId;
    let done = false;
    let startedAt;
    let previousFrame = 0;

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(animationId);
      clearTimeout(timerId);
      signal?.removeEventListener('abort', finish);
      stage.remove();
      resolve();
    };

    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) {
      finish();
      return;
    }

    if (reducedMotion) {
      // Keep the engine visible without traversal, smoke changes, or wheel motion.
      frame.style.transform = 'none';
      timerId = setTimeout(finish, 1100);
      return;
    }

    frame.style.transform = `translateX(${stage.clientWidth}px)`;
    const tick = time => {
      if (done) return;
      startedAt ??= time;
      const elapsed = time - startedAt;
      if (elapsed >= DURATION || !stage.isConnected) {
        finish();
        return;
      }

      // Integer character positions retain the text-console feel. Re-read the
      // width so a resized/mobile viewport always clips within its own bounds.
      const viewportWidth = stage.clientWidth;
      const progress = elapsed / DURATION;
      const x = Math.round((viewportWidth - progress * (viewportWidth + COLUMNS * CELL_WIDTH)) / CELL_WIDTH) * CELL_WIDTH;
      frame.style.transform = `translateX(${x}px)`;
      const frameIndex = Math.floor(elapsed / 120) % FRAME_TEXT.length;
      if (frameIndex !== previousFrame) {
        frame.textContent = FRAME_TEXT[frameIndex];
        previousFrame = frameIndex;
      }
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
  });
}
