import { createTextScreen, clipCells } from '../ui/text-screen.js';

export function formatTime(seconds) {
  const total = Math.floor(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Keep asynchronous play/resume attempts from reviving an exited or paused player.
export function createPlaybackSession(audio, { onState = () => {}, onError = () => {} } = {}) {
  let generation = 0;
  let disposed = false;
  let wantsPlay = false;
  return {
    get wantsPlay() { return wantsPlay; },
    get disposed() { return disposed; },
    setTrack(src) {
      if (disposed) return;
      generation++;
      wantsPlay = false;
      audio.pause();
      audio.src = src;
      audio.load();
      onState('idle');
    },
    async play(prepare = async () => {}) {
      if (disposed) return false;
      const request = ++generation;
      wantsPlay = true;
      onState('loading');
      try {
        await prepare();
        if (disposed || request !== generation) return false;
        await audio.play();
        if (disposed || request !== generation) {
          if (!wantsPlay) audio.pause();
          return false;
        }
        onState('playing');
        return true;
      } catch (error) {
        if (disposed || request !== generation) return false;
        wantsPlay = false;
        audio.pause();
        onState('paused');
        onError(error);
        return false;
      }
    },
    pause() {
      if (disposed) return;
      generation++;
      wantsPlay = false;
      audio.pause();
      onState('paused');
    },
    dispose() {
      if (disposed) return;
      generation++;
      disposed = true;
      wantsPlay = false;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
}

export function spectrumText(frequencies, sampleRate, fftSize, columns = 32, rows = 8) {
  const levels = Array.from({ length: columns }, (_, i) => {
    const low = Math.floor(55 * (6000 / 55) ** (i / columns) * fftSize / sampleRate);
    const high = Math.ceil(55 * (6000 / 55) ** ((i + 1) / columns) * fftSize / sampleRate);
    let peak = 0;
    for (let bin = Math.max(1, low); bin < Math.min(frequencies.length, high + 1); bin++) peak = Math.max(peak, frequencies[bin]);
    return Math.round(peak / 255 * rows);
  });
  return Array.from({ length: rows }, (_, row) => levels.map(level => level >= rows - row ? '|' : ' ').join('')).join('\n') + '\n' + '.'.repeat(columns);
}

// All visible output is a grid of characters. The hidden audio element only
// handles media playback; selection, seeking and volume remain keyboard actions.
export function mountPlayer(container, { signal, onExit = () => {}, announce = () => {}, tracks = [], startIndex = 0 } = {}) {
  if (signal?.aborted) return () => {};
  const document = container.ownerDocument;
  const window = document.defaultView || globalThis;
  const listeners = [];
  let disposed = false;
  let current = Math.min(Math.max(0, Number.isInteger(startIndex) ? startIndex : 0), Math.max(0, tracks.length - 1));
  let selected = current;
  let status = 'idle';
  let message = '';
  let context = null;
  let analyser = null;
  let source = null;
  let frequencyData = null;
  let frame = 0;
  let lastFrame = 0;
  let graphUnavailable = false;
  let screen = null;
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = !!motionQuery?.matches;
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.volume = .65;
  audio.setAttribute('playsinline', '');
  audio.hidden = true;
  container.append(audio);
  container.classList.add('tty-player');

  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const session = createPlaybackSession(audio, {
    onState: value => { status = value; render(); },
    onError: error => {
      message = error?.name === 'NotAllowedError' ? '请按 Space 开始播放。' : '无法播放，请切换音轨或重试。';
      render();
      announce(message);
    },
  });

  function render() {
    if (disposed || !screen) return;
    const width = Math.max(1, screen.columns);
    const height = Math.max(1, screen.rows);
    const rule = '-'.repeat(width);
    const statusText = { idle: 'READY', loading: 'LOADING', playing: 'PLAYING', paused: 'PAUSED' }[status];
    const lines = [[{ text: 'PLAYER', fg: 'accent' }, { text: '  ~/audio/' }], [{ text: rule, fg: 'muted' }]];
    // Keep the selected track visible if a small terminal cannot show the list.
    const listRows = Math.max(1, Math.min(tracks.length, height - 17));
    const first = Math.max(0, Math.min(selected - listRows + 1, tracks.length - listRows));
    if (!tracks.length) lines.push('没有可播放的音轨。');
    for (let index = first; index < Math.min(tracks.length, first + listRows); index++) {
      const track = tracks[index];
      const marker = index === selected ? '>' : ' ';
      const playing = index === current && session.wantsPlay ? '*' : ' ';
      const prefix = `${marker}${playing} ${String(index + 1).padStart(2, '0')} `;
      const suffix = ` ${formatTime(track.duration)}`;
      lines.push([{ text: prefix + clipCells(track.file, Math.max(0, width - prefix.length - suffix.length)) + suffix, fg: index === selected ? 'user' : 'ink' }]);
    }
    if (tracks.length > listRows) lines.push([{ text: `${first + 1}-${Math.min(tracks.length, first + listRows)} / ${tracks.length} tracks`, fg: 'muted' }]);
    lines.push('');
    lines.push([{ text: `${statusText}  `, fg: 'accent' }, { text: tracks[current]?.file || '--' }]);
    const duration = Number.isFinite(audio.duration) ? audio.duration : tracks[current]?.duration || 0;
    const elapsed = Math.min(audio.currentTime || 0, duration);
    const times = `${formatTime(elapsed)} / ${formatTime(duration)}`;
    const barWidth = Math.max(1, Math.min(48, width - times.length - 3));
    const progress = duration ? Math.min(barWidth, Math.floor(elapsed / duration * barWidth)) : 0;
    const bar = '='.repeat(progress) + (progress < barWidth ? '>' + '-'.repeat(barWidth - progress - 1) : '');
    if (width >= times.length + 9) lines.push(`[${bar}] ${times}`);
    else lines.push(times);
    lines.push(`VOLUME ${Math.round(audio.volume * 100)}%  [- / +]`);
    if (message) lines.push([{ text: message, fg: 'error' }]);
    lines.push('');
    const footer = width >= 64
      ? ['Up/Down select  Enter play  Space pause', 'Left/Right seek 5s  N/P track  +/- volume  Q/Esc exit']
      : ['Up/Down select  Enter play', 'Space pause  Left/Right seek 5s', 'N/P track  +/- volume  Q/Esc exit'];
    const spectrumRows = Math.max(0, Math.min(8, height - lines.length - footer.length - 4));
    if (spectrumRows > 0) {
      const note = reducedMotion ? 'SPECTRUM  reduced motion' : graphUnavailable ? 'SPECTRUM  unavailable' : 'SPECTRUM  55 Hz - 6 kHz';
      lines.push([{ text: note, fg: 'muted' }]);
      const bins = !reducedMotion && !audio.paused && frequencyData ? frequencyData : [];
      for (const row of spectrumText(bins, context?.sampleRate || 22050, analyser?.fftSize || 1024, Math.min(width, 64), spectrumRows).split('\n')) {
        lines.push([{ text: row, fg: 'accent' }]);
      }
    }
    lines.splice(Math.max(0, height - footer.length - 1));
    while (lines.length < height - footer.length - 1) lines.push('');
    lines.push([{ text: rule, fg: 'muted' }]);
    footer.forEach(text => lines.push([{ text, fg: 'muted' }]));
    screen.render(lines);
  }

  async function prepareAudio() {
    if (disposed || graphUnavailable) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { graphUnavailable = true; render(); return; }
    if (!context) {
      try {
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = .72;
        source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        graphUnavailable = true;
        if (source && context) {
          source.disconnect();
          source.connect(context.destination);
        }
        analyser = null;
        frequencyData = null;
        render();
      }
    }
    if (disposed) return;
    if (context?.state === 'suspended') await context.resume();
    if (!disposed) scheduleSpectrum();
  }

  function scheduleSpectrum() {
    if (disposed || reducedMotion || !analyser || frame || audio.paused) return;
    frame = window.requestAnimationFrame(drawSpectrum);
  }

  function drawSpectrum(now) {
    frame = 0;
    if (disposed || reducedMotion || !analyser || audio.paused) return;
    if (now - lastFrame >= 80) {
      lastFrame = now;
      analyser.getByteFrequencyData(frequencyData);
      render();
    }
    scheduleSpectrum();
  }

  function stopSpectrum() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    frequencyData?.fill(0);
    render();
  }

  function switchTrack(index, autoplay) {
    if (disposed || !tracks.length || !Number.isFinite(index)) return;
    current = (index + tracks.length) % tracks.length;
    selected = current;
    message = '';
    stopSpectrum();
    session.setTrack(tracks[current].src);
    if (autoplay) void session.play(prepareAudio);
    render();
  }

  function toggle() {
    if (!tracks.length || disposed) return;
    message = '';
    if (session.wantsPlay) session.pause();
    else void session.play(prepareAudio);
  }

  function seekBy(seconds) {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    render();
  }

  function keys(event) {
    if (disposed || event.isComposing || event.altKey || event.metaKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Escape' || key === 'q' || (event.ctrlKey && key === 'c')) {
      event.preventDefault(); event.stopPropagation(); exit(); return;
    }
    if (event.ctrlKey) return;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      if (tracks.length) selected = (selected + (key === 'ArrowUp' ? -1 : 1) + tracks.length) % tracks.length;
      render();
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault(); seekBy(key === 'ArrowLeft' ? -5 : 5);
    } else if (key === 'Enter') {
      event.preventDefault(); switchTrack(selected, true);
    } else if (key === ' ') {
      event.preventDefault(); toggle();
    } else if (key === 'n' || key === 'p') {
      event.preventDefault(); switchTrack(current + (key === 'n' ? 1 : -1), true);
    } else if (['+', '=', '-', '_'].includes(key)) {
      event.preventDefault();
      audio.volume = Math.max(0, Math.min(1, Math.round((audio.volume + (key === '+' || key === '=' ? .05 : -.05)) * 100) / 100));
      render();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    listeners.splice(0).forEach(remove => remove());
    signal?.removeEventListener('abort', dispose);
    session.dispose();
    stopSpectrum();
    source?.disconnect();
    analyser?.disconnect();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    screen?.dispose();
    audio.remove();
    container.classList.remove('tty-player');
  }

  function exit() {
    if (disposed) return;
    dispose();
    onExit();
  }

  listen(audio, 'loadedmetadata', render);
  listen(audio, 'durationchange', render);
  listen(audio, 'timeupdate', render);
  listen(audio, 'playing', () => { status = 'playing'; render(); scheduleSpectrum(); });
  listen(audio, 'pause', () => { stopSpectrum(); if (!disposed && !audio.ended && status !== 'loading') { status = 'paused'; render(); } });
  listen(audio, 'ended', () => switchTrack(current + 1, true));
  listen(audio, 'error', () => {
    session.pause();
    message = '音频加载失败，请切换音轨或重试。';
    render();
    announce(message);
  });
  if (motionQuery?.addEventListener) listen(motionQuery, 'change', event => {
    reducedMotion = event.matches;
    if (reducedMotion) stopSpectrum(); else scheduleSpectrum();
    render();
  });
  screen = createTextScreen(container, { signal, title: '终端音频播放器', onKey: keys, onResize: render });
  signal?.addEventListener('abort', dispose, { once: true });
  if (tracks.length) switchTrack(current, true);
  else render();
  screen.focus();
  announce('音频播放器已打开。上下选择，Enter 播放，空格暂停，左右跳转，加减调整音量，Q 退出。');
  return dispose;
}
