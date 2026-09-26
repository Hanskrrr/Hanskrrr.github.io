// Quiet music for the world inside the picture, made on the spot with Web Audio (no files): slow
// pad chords, a few soft bell notes with an echo, and a breath of wind. Each screen sets a mood
// (meadow, cave, sky, hill). Browsers only allow sound after a key press or a tap, so world.js
// calls start() from one; the choice to mute is remembered in this browser.
const midi = note => 440 * 2 ** ((note - 69) / 12);
const MOODS = {
  meadow: { chords: [[53, 57, 60, 64], [48, 55, 62, 64], [45, 52, 57, 60], [43, 50, 55, 62]], bells: [72, 74, 76, 79, 81, 84], cutoff: 1100, every: [1.8, 4.5], wind: 0.018 },
  hill: { chords: [[53, 57, 60, 64, 67], [45, 52, 57, 60, 64], [50, 57, 62, 65], [43, 50, 55, 59, 62]], bells: [76, 79, 81, 84, 86, 88], cutoff: 1300, every: [2.4, 5.5], wind: 0.022 },
  cave: { chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 55]], bells: [60, 62, 64, 67, 69, 72], cutoff: 620, every: [3, 7], wind: 0.006 },
  sky: { chords: [[55, 62, 66, 69], [52, 59, 64, 67], [48, 55, 62, 64], [50, 57, 62, 66]], bells: [79, 81, 83, 86, 88, 91], cutoff: 1600, every: [1.4, 3.6], wind: 0.03 },
};
const KEY = 'gallery-world-sound';

export function createSound() {
  let muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* no storage: sound on */ }
  let ctx = null;
  let master; let pad; let echo; let windGain; let filter;
  let mood = MOODS.meadow;
  let timers = [];
  let chordIndex = 0;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // An echo: a delay feeding back through a soft filter.
    echo = ctx.createDelay(2);
    echo.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1800;
    echo.connect(tone).connect(feedback).connect(echo);
    tone.connect(master);
    // The pad's filter (the mood sets how bright it is).
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood.cutoff;
    pad = ctx.createGain();
    pad.gain.value = 0.5;
    pad.connect(filter).connect(master);
    // Wind: filtered noise, swelling slowly.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = mood.wind;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = mood.wind * 0.7;
    swell.connect(depth).connect(windGain.gain);
    source.connect(band).connect(windGain).connect(master);
    source.start();
    swell.start();
  }

  function note(frequency, { at, attack, hold, release, level, type = 'sine', out = pad, send = 0 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + attack);
    gain.gain.setValueAtTime(level, at + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    osc.connect(gain).connect(out);
    if (send) { const s = ctx.createGain(); s.gain.value = send; gain.connect(s).connect(echo); }
    osc.start(at);
    osc.stop(at + attack + hold + release + 0.1);
  }
  function chord() {
    const now = ctx.currentTime + 0.05;
    const notes = mood.chords[chordIndex++ % mood.chords.length];
    notes.forEach((n, i) => {
      note(midi(n), { at: now + i * 0.12, attack: 3, hold: 4, release: 5, level: 0.05 });
      note(midi(n) * 1.003, { at: now + i * 0.12, attack: 3.5, hold: 3.5, release: 5, level: 0.03, type: 'triangle' });
    });
    timers.push(setTimeout(chord, 9000));
  }
  function bell() {
    const now = ctx.currentTime + 0.05;
    const n = mood.bells[Math.floor(Math.random() * mood.bells.length)];
    note(midi(n), { at: now, attack: 0.006, hold: 0.05, release: 2.6, level: 0.045, out: master, send: 0.6 });
    note(midi(n) * 2.01, { at: now, attack: 0.004, hold: 0.02, release: 0.9, level: 0.012, out: master, send: 0.3 });
    const [low, high] = mood.every;
    timers.push(setTimeout(bell, (low + Math.random() * (high - low)) * 1000));
  }

  return {
    get muted() { return muted; },
    /** Call from a key press or tap. */
    start() {
      if (muted) return;
      if (!ctx) {
        try { build(); } catch { return; }
        chord();
        timers.push(setTimeout(bell, 2500));
      }
      ctx.resume?.();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
    },
    setMood(name) {
      mood = MOODS[name] || MOODS.meadow;
      if (!ctx) return;
      filter.frequency.linearRampToValueAtTime(mood.cutoff, ctx.currentTime + 2);
      windGain.gain.linearRampToValueAtTime(mood.wind, ctx.currentTime + 2);
    },
    /** A small sound for picking something up, or a drip in a cave. */
    chime(kind = 'take') {
      if (!ctx || muted) return;
      const now = ctx.currentTime + 0.02;
      const notes = kind === 'drip' ? [mood.bells[0] + 12] : kind === 'open' ? [60, 67, 72] : [72, 76, 79, 84];
      notes.forEach((n, i) => note(midi(n), { at: now + i * 0.09, attack: 0.004, hold: 0.03, release: kind === 'drip' ? 0.5 : 1.4, level: kind === 'drip' ? 0.02 : 0.05, out: master, send: 0.5 }));
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* just this visit */ }
      if (muted && ctx) master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      else this.start();
      return muted;
    },
    stop() {
      timers.forEach(clearTimeout);
      timers = [];
      if (!ctx) return;
      const closing = ctx;
      master.gain.cancelScheduledValues(closing.currentTime);
      master.gain.linearRampToValueAtTime(0, closing.currentTime + 0.8);
      setTimeout(() => closing.close?.(), 1000);
      ctx = null;
    },
  };
}
