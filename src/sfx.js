// Tiny WebAudio synth — every sound is generated, no audio files.
let ctx;
let master;
let enabled = false;
try {
  enabled = localStorage.getItem('cinna-sound') === 'on';
} catch {}

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ type = 'sine', from, to = from, dur = 0.2, vol = 0.5, delay = 0, curve = 'exp' }) {
  const c = ac();
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  else o.frequency.linearRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.3, from = 400, to = 2400, vol = 0.3, q = 1.2, delay = 0 }) {
  const c = ac();
  const t = c.currentTime + delay;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  boing() {
    tone({ type: 'sine', from: 220, to: 720, dur: 0.16, vol: 0.5 });
    tone({ type: 'sine', from: 720, to: 380, dur: 0.35, vol: 0.4, delay: 0.14 });
    tone({ type: 'triangle', from: 1400, to: 900, dur: 0.18, vol: 0.12, delay: 0.14 });
  },
  pop() {
    tone({ type: 'sine', from: 900, to: 1500, dur: 0.08, vol: 0.35 });
    noise({ dur: 0.07, from: 2000, to: 4000, vol: 0.08 });
  },
  chime(step = 0) {
    const base = 660 * Math.pow(2, (Math.min(step, 12) * 2) / 12);
    tone({ type: 'triangle', from: base, dur: 0.22, vol: 0.28 });
    tone({ type: 'sine', from: base * 1.5, dur: 0.35, vol: 0.2, delay: 0.06 });
  },
  gold() {
    [0, 4, 7, 12, 16].forEach((n, i) =>
      tone({ type: 'triangle', from: 880 * Math.pow(2, n / 12), dur: 0.3, vol: 0.22, delay: i * 0.055 }),
    );
  },
  flap() {
    noise({ dur: 0.12, from: 600, to: 1600, vol: 0.12, q: 0.8 });
  },
  whoosh() {
    noise({ dur: 0.55, from: 300, to: 2600, vol: 0.25, q: 0.7 });
  },
  hit() {
    tone({ type: 'square', from: 180, to: 60, dur: 0.35, vol: 0.18 });
    noise({ dur: 0.3, from: 800, to: 200, vol: 0.25, q: 0.6 });
  },
  twinkle() {
    [0, 7, 12].forEach((n, i) => tone({ type: 'sine', from: 1320 * Math.pow(2, n / 12), dur: 0.5, vol: 0.12, delay: i * 0.09 }));
  },
  fanfare() {
    [0, 4, 7, 12].forEach((n, i) => tone({ type: 'triangle', from: 523 * Math.pow(2, n / 12), dur: 0.4, vol: 0.25, delay: i * 0.12 }));
  },
};

export const sfx = {
  get enabled() {
    return enabled;
  },
  toggle() {
    enabled = !enabled;
    try {
      localStorage.setItem('cinna-sound', enabled ? 'on' : 'off');
    } catch {}
    if (enabled) SOUNDS.pop();
    return enabled;
  },
  play(name, ...args) {
    if (!enabled) return;
    try {
      SOUNDS[name]?.(...args);
    } catch {}
  },
};
