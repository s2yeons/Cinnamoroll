import * as THREE from 'three';

// One keyframe per page section. Everything in the 3D world is derived
// from blending two of these by scroll position.
const base = {
  pos: [0, 0, 0], rot: [0, 0, 0], scale: 1,
  earL: 0.5, earR: 0.5, flapAmp: 0.05, flapSpeed: 2,
  happy: 0, wave: 0, sleep: 0, look: 1, speed: 0,
  cam: [0, 0.15, 9],
  skyTop: '#8ecbff', skyBot: '#eaf6ff', ambient: '#ffffff',
  stars: 0, roll: 0, friends: 0, bed: 0, sparkle: 1,
};

const raw = {
  hero: {
    pos: [0, -0.2, 0], earL: 1.42, earR: 1.42, flapAmp: 0.16, flapSpeed: 3.2,
    skyTop: '#86c6ff', skyBot: '#eef8ff',
  },
  about: {
    pos: [2.55, -0.35, 0], rot: [0, -0.38, 0], scale: 0.88,
    earL: 0.5, earR: 2.75, flapAmp: 0.05, flapSpeed: 2.4, happy: 1, wave: 1,
    skyTop: '#a8d8ff', skyBot: '#fff1f7',
  },
  fly: {
    pos: [0, 0.1, 0], scale: 0.82, earL: 1.55, earR: 1.55, flapAmp: 0.55, flapSpeed: 15,
    happy: 1, look: 0.3, speed: 1, cam: [0, 0.1, 9.5],
    skyTop: '#5fb0ff', skyBot: '#d4efff',
  },
  cafe: {
    pos: [2.5, -0.28, 0], rot: [0.05, -0.3, 0], scale: 0.6,
    earL: 0.62, earR: 0.62, flapAmp: 0.04, flapSpeed: 2, happy: 1, roll: 1,
    skyTop: '#ffc9a8', skyBot: '#fff4e4', ambient: '#fff6ee',
  },
  friends: {
    pos: [0, 0.05, 0.6], scale: 0.68, earL: 1.25, earR: 1.25, flapAmp: 0.1, flapSpeed: 3,
    happy: 1, friends: 1, cam: [0, 0.3, 9.6],
    skyTop: '#f5bde0', skyBot: '#e9e6ff', ambient: '#fff8fd',
  },
  night: {
    pos: [0, -0.95, 0], rot: [0, 0, 0], scale: 0.85, earL: 0.28, earR: 0.28, flapAmp: 0.01,
    flapSpeed: 1, sleep: 1, look: 0.15, bed: 1, stars: 1, sparkle: 0.3,
    skyTop: '#101a44', skyBot: '#4f4f98', ambient: '#aab3ee',
  },
};

export const STAGE_NAMES = Object.keys(raw);

const COLOR_KEYS = ['skyTop', 'skyBot', 'ambient'];
export const STAGES = STAGE_NAMES.map((k) => {
  const s = { ...base, ...raw[k] };
  COLOR_KEYS.forEach((c) => (s[c] = new THREE.Color(s[c])));
  return s;
});

const lerp = (a, b, t) => a + (b - a) * t;

export function makePose() {
  const p = structuredClone({ ...base, pos: [0, 0, 0], rot: [0, 0, 0], cam: [0, 0, 9] });
  COLOR_KEYS.forEach((c) => (p[c] = new THREE.Color()));
  return p;
}

export function blendPose(out, i, b) {
  const A = STAGES[i];
  const B = STAGES[Math.min(i + 1, STAGES.length - 1)];
  for (const k in A) {
    const a = A[k];
    if (Array.isArray(a)) for (let j = 0; j < a.length; j++) out[k][j] = lerp(a[j], B[k][j], b);
    else if (a instanceof THREE.Color) out[k].copy(a).lerp(B[k], b);
    else out[k] = lerp(a, B[k], b);
  }
  return out;
}
