import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { animate, createTimeline, stagger, splitText, createDrawable, utils } from 'animejs';
import { createWorld } from './world.js';
import { STAGE_NAMES } from './choreo.js';
import { GAME_TIME } from './game.js';
import { sfx } from './sfx.js';
import './style.css';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

document.body.classList.add('is-loading');
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ————————————————————————————————— 3D world
const world = createWorld($('#gl'));
const cinna = world.cinna;
if (import.meta.env.DEV) window.__world = world;
cinna.react.pop = 0;

// ————————————————————————————————— smooth scroll
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
lenis.stop();

// ————————————————————————————————— layout measurement
const stageEls = $$('[data-stage]');
const fly = $('#fly');
const friendsEl = $('#friends');
let tops = [];
let vh = window.innerHeight;
function measure() {
  vh = window.innerHeight;
  tops = stageEls.map((el) => el.offsetTop);
}
function stickyProgress(el) {
  return clamp((lenis.scroll - el.offsetTop) / (el.offsetHeight - vh), 0, 1);
}
function stageState() {
  const ref = lenis.scroll + vh * 0.5;
  let i = 0;
  for (let k = 0; k < tops.length; k++) if (ref >= tops[k]) i = k;
  const top = tops[i];
  const end = i < tops.length - 1 ? tops[i + 1] : top + stageEls[i].offsetHeight;
  const frac = clamp((ref - top) / (end - top), 0, 1);
  const hold = parseFloat(stageEls[i].dataset.hold || 0.5);
  const b = i < tops.length - 1 ? smooth(hold, 1, frac) : 0;
  return { i, b, frac };
}

// ————————————————————————————————— pointer + cursor
const mouse = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, moved: false };
const cursor = $('.cursor');
const dot = $('.cursor-dot');
const ring = $('.cursor-ring');
const ringPos = { x: mouse.px, y: mouse.py };
let hoverUI = false;
let hoverChar = false;
addEventListener('pointermove', (e) => {
  mouse.px = e.clientX;
  mouse.py = e.clientY;
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -((e.clientY / innerHeight) * 2 - 1);
  mouse.moved = true;
});
document.addEventListener('pointerover', (e) => (hoverUI = !!e.target.closest('[data-hover], a, button')));
addEventListener('pointerdown', () => cursor.classList.add('is-down'));
addEventListener('pointerup', () => cursor.classList.remove('is-down'));

// ————————————————————————————————— click FX (anime.js particles)
const fx = $('#fx');
const HEART = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.7 1.3 5.2 3.1 1.5-1.8 3-3.1 5.2-3.1 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" fill="currentColor" stroke="#6ea4de" stroke-width="1.6"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1.5l2.6 7.2 7.6.3-6 4.7 2.1 7.3L12 16.8 5.7 21l2.1-7.3-6-4.7 7.6-.3z" fill="currentColor" stroke="#6ea4de" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const CLOUD = '<svg viewBox="0 0 32 22" width="100%" height="100%"><path d="M8 20a6 6 0 0 1-.6-12A8 8 0 0 1 23 6.5 6.8 6.8 0 1 1 25 20z" fill="#fff" stroke="#6ea4de" stroke-width="2"/></svg>';
function burst(x, y, n = 10, big = false) {
  const colors = ['#f7a9c0', '#ffd76a', '#9cc9ff', '#ffffff'];
  for (let k = 0; k < n; k++) {
    const p = document.createElement('div');
    p.className = 'p';
    const kind = Math.random();
    p.innerHTML = kind < 0.45 ? HEART : kind < 0.8 ? STAR : CLOUD;
    const size = utils.random(big ? 18 : 12, big ? 38 : 24);
    p.style.cssText = `width:${size}px;height:${size}px;color:${colors[k % colors.length]}`;
    fx.appendChild(p);
    const ang = (k / n) * Math.PI * 2 + utils.random(-0.3, 0.3, 2);
    const dist = utils.random(big ? 90 : 50, big ? 220 : 120);
    animate(p, {
      x: [x - size / 2, x - size / 2 + Math.cos(ang) * dist],
      y: [y - size / 2, y - size / 2 + Math.sin(ang) * dist - (big ? 60 : 20)],
      scale: [{ from: 0, to: 1.2, duration: 260, ease: 'outBack(3)' }, { to: 0, duration: 520, ease: 'inQuad' }],
      rotate: [utils.random(-90, 90), utils.random(-360, 360)],
      duration: big ? 1200 : 900,
      ease: 'outExpo',
      onComplete: () => p.remove(),
    });
  }
}

function shootingStar() {
  const s = document.createElement('div');
  s.className = 'shoot';
  fx.appendChild(s);
  const x0 = utils.random(innerWidth * 0.3, innerWidth * 1.1);
  const y0 = utils.random(-40, innerHeight * 0.35);
  const len = utils.random(300, 600);
  const ang = utils.random(18, 32);
  const rad = (ang * Math.PI) / 180;
  s.style.transform = `translate(${x0}px, ${y0}px) rotate(${180 + ang}deg)`;
  animate(s, {
    x: [x0, x0 - Math.cos(rad) * len],
    y: [y0, y0 + Math.sin(rad) * len],
    rotate: 180 + ang,
    scaleX: [{ from: 0, to: 1, duration: 300 }, { to: 0, duration: 500, delay: 200 }],
    opacity: [1, 0],
    duration: 1000,
    ease: 'outQuad',
    onComplete: () => s.remove(),
  });
}

// ————————————————————————————————— 3D reactions (anime.js driving three.js state)
let reacting = false;
let reactN = 0;
function reactCinna() {
  if (reacting) return;
  reacting = true;
  const r = cinna.react;
  r.happy = 1;
  const kind = ['spin', 'flip', 'boing'][reactN++ % 3];
  sfx.play('boing');
  const tl = createTimeline({
    onComplete: () => {
      r.spin = 0;
      r.flip = 0;
      reacting = false;
      setTimeout(() => (r.happy = 0), 900);
    },
  });
  tl.add(r, { squash: 0.24, duration: 150, ease: 'outQuad' })
    .add(r, { squash: -0.16, jump: kind === 'boing' ? 1.7 : 1.25, duration: 430, ease: 'outCubic' });
  if (kind === 'spin') tl.add(r, { spin: Math.PI * 2, duration: 850, ease: 'inOutBack(1.4)' }, '<<');
  if (kind === 'flip') tl.add(r, { flip: -Math.PI * 2, duration: 850, ease: 'inOutCubic' }, '<<');
  tl.add(r, { jump: 0, squash: 0.2, duration: 380, ease: 'inQuad' })
    .add(r, { squash: 0, duration: 1000, ease: 'outElastic(1, .32)' });
}

const friendBusy = new Set();
function jumpFriend(i) {
  const f = world.friends[i];
  if (!f || friendBusy.has(i)) return;
  friendBusy.add(i);
  sfx.play('pop');
  createTimeline({ onComplete: () => friendBusy.delete(i) })
    .add(f.react, { squash: 0.22, duration: 120, ease: 'outQuad' })
    .add(f.react, { squash: -0.12, jump: 0.9, duration: 360, ease: 'outCubic' })
    .add(f.react, { spin: Math.PI * 2, duration: 700, ease: 'inOutQuad' }, '<<')
    .add(f.react, { jump: 0, squash: 0.18, duration: 320, ease: 'inQuad' })
    .add(f.react, { squash: 0, duration: 800, ease: 'outElastic(1, .35)', onComplete: () => (f.react.spin = 0) });
}

let hintGone = false;
function hideHint() {
  if (hintGone) return;
  hintGone = true;
  animate('#hero-hint', { opacity: 0, y: -20, duration: 500, ease: 'inQuad' });
}

// ——— grab & fling: drag him around, he springs home ———
const drag = { on: false, x0: 0, y0: 0, moved: 0, suppressClick: false };
const playing = () => document.body.classList.contains('is-playing');
addEventListener('pointerdown', (e) => {
  if (document.body.classList.contains('is-loading') || playing()) return;
  if (e.target.closest('a, button, .dots, .card')) return;
  if (world.pick(e.clientX, e.clientY)?.who !== 'cinna') return;
  if (!world.startDrag(e.clientX, e.clientY)) return;
  drag.on = true;
  drag.x0 = e.clientX;
  drag.y0 = e.clientY;
  drag.moved = 0;
  cinna.react.happy = 1;
  document.body.classList.add('is-grab');
  cursor.classList.add('is-grab');
  lenis.stop();
});
addEventListener('pointermove', (e) => {
  if (!drag.on) return;
  drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
  world.moveDrag(e.clientX, e.clientY);
});
addEventListener(
  'touchmove',
  (e) => {
    if (drag.on || playing()) e.preventDefault();
  },
  { passive: false },
);
function releaseDrag(e) {
  if (!drag.on) return;
  drag.on = false;
  const speed = world.endDrag();
  document.body.classList.remove('is-grab');
  cursor.classList.remove('is-grab');
  lenis.start();
  if (drag.moved > 8) {
    drag.suppressClick = true;
    hideHint();
    if (speed > 3) {
      sfx.play('whoosh');
      setTimeout(() => sfx.play('boing'), 260);
      burst(e.clientX, e.clientY, Math.min(20, 6 + Math.round(speed)), true);
    }
  }
  setTimeout(() => (cinna.react.happy = 0), 1400);
}
addEventListener('pointerup', releaseDrag);
addEventListener('pointercancel', releaseDrag);

addEventListener('click', (e) => {
  if (document.body.classList.contains('is-loading') || playing()) return;
  if (drag.suppressClick) {
    drag.suppressClick = false;
    return;
  }
  if (e.target.closest('a, button, .dots')) return;
  const hit = world.pick(e.clientX, e.clientY);
  if (hit?.who === 'cinna') {
    reactCinna();
    burst(e.clientX, e.clientY, 16, true);
    hideHint();
    return;
  }
  if (hit?.who === 'friend') {
    jumpFriend(hit.i);
    burst(e.clientX, e.clientY, 12, true);
    return;
  }
  burst(e.clientX, e.clientY, 9);
  sfx.play('pop');
  if (state.i === STAGE_NAMES.indexOf('night')) {
    shootingStar();
    setTimeout(shootingStar, 180);
    sfx.play('twinkle');
  }
});

// ——— sound toggle ———
const soundBtn = $('#sound');
function syncSound() {
  soundBtn.classList.toggle('is-on', sfx.enabled);
  soundBtn.setAttribute('aria-pressed', sfx.enabled);
}
soundBtn.addEventListener('click', () => {
  sfx.toggle();
  syncSound();
});
syncSound();

// ————————————————————————————————— loader
const spiral = $('#loader-spiral');
{
  let d = '';
  for (let a = 0; a <= Math.PI * 2 * 3.2; a += 0.08) {
    const r = 4 + a * 2.6;
    d += `${d ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  }
  spiral.setAttribute('d', d);
}
const loadState = { pct: 0 };
const loaderAnim = animate(createDrawable(spiral), {
  draw: ['0 0', '0 1'],
  duration: 1700,
  ease: 'inOutQuad',
});
animate($('.loader-roll'), { rotate: [0, 360], duration: 1700, ease: 'inOutQuad' });
const pctAnim = animate(loadState, {
  pct: 100,
  duration: 1700,
  ease: 'inOutQuad',
  onUpdate: () => ($('#loader-pct').textContent = Math.round(loadState.pct)),
});

// hero title → chars
const heroTitle = splitText('#hero-title', { chars: true });
const heroChars = heroTitle.chars;
heroChars.forEach((c) => {
  c.classList.add('char');
  c.style.opacity = 0;
  c.addEventListener('pointerenter', () => {
    animate(c, {
      y: [{ to: '-0.22em', duration: 220, ease: 'outQuad' }, { to: 0, duration: 900, ease: 'outElastic(1, .3)' }],
      rotate: [{ to: utils.random(-14, 14), duration: 220 }, { to: 0, duration: 900, ease: 'outElastic(1, .3)' }],
      scaleY: [{ to: 1.12, duration: 220 }, { to: 1, duration: 900, ease: 'outElastic(1, .3)' }],
    });
  });
});
utils.set([$('#hero-sub'), $('.hero-bottom .pill'), ...$$('.hero-meta span')], { opacity: 0, y: 30 });

Promise.all([document.fonts.ready, new Promise((r) => setTimeout(r, 1750))]).then(() => {
  measure();
    const tl = createTimeline({
    defaults: { ease: 'outExpo' },
    onComplete: () => {
      $('#loader').remove();
    },
  });
  tl.add('.loader-inner', { scale: [1, 0.4], opacity: [1, 0], duration: 420, ease: 'inBack(2)' })
    .add('.loader-panel.top', { y: '-101%', duration: 1100, ease: 'inOutExpo' }, '-=80')
    .add('.loader-panel.bottom', { y: '101%', duration: 1100, ease: 'inOutExpo' }, '<<')
    .call(() => {
      document.body.classList.remove('is-loading');
      lenis.start();
    }, '-=500')
    .add(heroChars, {
      opacity: [0, 1],
      y: ['1.1em', 0],
      rotate: { from: () => utils.random(-40, 40), to: 0 },
      scale: [0.4, 1],
      duration: 1400,
      delay: stagger(55, { from: 'center' }),
      ease: 'outElastic(1, .55)',
    }, '-=650')
    .add(cinna.react, { pop: [0, 1], duration: 1500, ease: 'outElastic(1, .45)' }, '<<+=150')
    .add(cinna.react, { spin: [-Math.PI * 2, 0], duration: 1300, ease: 'outExpo' }, '<<')
    .add('.hero-meta span', { opacity: 1, y: 0, duration: 900, delay: stagger(120) }, '<<+=300')
    .add('#hero-sub', { opacity: 1, y: 0, duration: 1000 }, '<<+=100')
    .add('.hero-bottom .pill', { opacity: 1, y: 0, duration: 1000 }, '<<+=120')
    .add('#hero-hint', { opacity: [0, 1], x: [-30, 0], duration: 800 }, '+=400');
});

// ————————————————————————————————— reveal-on-enter
function countUp(el) {
  const to = parseFloat(el.dataset.count);
  const o = { v: 0 };
  const fmt = (v) => {
    if (el.dataset.format === 'date') {
      const n = Math.round(v);
      return `${String(Math.floor(n / 100)).padStart(2, '0')}.${String(n % 100).padStart(2, '0')}`;
    }
    return Math.round(v) + (el.dataset.suffix ? `<small>${el.dataset.suffix}</small>` : '');
  };
  animate(o, { v: to, duration: 2200, ease: 'outExpo', onUpdate: () => (el.innerHTML = fmt(o.v)) });
}

const io = new IntersectionObserver(
  (entries) => {
    let n = 0;
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      const delay = n++ * 110;
      animate(el, {
        opacity: [0, 1],
        y: [60, 0],
        rotate: el.classList.contains('stat') ? [utils.random(-6, 6), 0] : 0,
        filter: ['blur(10px)', 'blur(0px)'],
        duration: 1300,
        delay,
        ease: 'outExpo',
      });
      const em = el.querySelector('em');
      if (em) animate(em, { '--u': [0, 1], duration: 900, delay: delay + 500, ease: 'inOutQuart' });
      const count = el.querySelector('[data-count]');
      if (count) setTimeout(() => countUp(count), delay + 150);
      if (el.id === 'night-title') floatNightTitle();
    });
  },
  { threshold: 0.25 },
);
$$('.reveal').forEach((el) => io.observe(el));

// night title chars float gently forever
const nightChars = splitText('#night-title', { chars: true }).chars;
function floatNightTitle() {
  animate(nightChars, {
    y: [{ from: 40, to: 0, duration: 1200, ease: 'outElastic(1, .5)' }],
    opacity: [0, 1],
    delay: stagger(70),
    onComplete: () =>
      animate(nightChars, {
        y: [0, -10],
        rotate: [-2, 2],
        duration: 1800,
        delay: stagger(120),
        loop: true,
        alternate: true,
        ease: 'inOutSine',
      }),
  });
}

// ————————————————————————————————— fly section
const captions = $$('#fly-captions .title').map((h) => {
  const chars = splitText(h, { chars: true }).chars;
  return { h, chars };
});
let capIdx = -1;
function showCaption(idx) {
  if (idx === capIdx) return;
  const prev = captions[capIdx];
  if (prev) {
    animate(prev.chars, { y: [0, -60], opacity: [1, 0], rotate: [0, -12], duration: 450, delay: stagger(12), ease: 'inQuad' });
  }
  capIdx = idx;
  const cur = captions[idx];
  if (!cur) return;
  cur.h.style.opacity = 1;
  animate(cur.chars, {
    y: [90, 0],
    opacity: [0, 1],
    rotate: [18, 0],
    scale: [0.6, 1],
    duration: 1100,
    delay: stagger(28, { start: 150 }),
    ease: 'outElastic(1, .6)',
  });
}
utils.set(captions.flatMap((c) => c.chars), { opacity: 0 });
const trail = animate(createDrawable('#fly-trail'), { draw: ['0 0', '0 1'], duration: 1000, ease: 'linear', autoplay: false });
const flyWords = $$('.fly-words span');
const hudAlt = $('#hud-alt');
const hudFlaps = $('#hud-flaps');
const hudBar = $('#hud-bar');
let lastFlyP = -1;

// ————————————————————————————————— friends section
const cards = $$('.card');
let cardsShown = false;
function toggleCards(show) {
  if (show === cardsShown) return;
  cardsShown = show;
  animate(cards, show
    ? { opacity: [0, 1], y: [120, 0], rotateX: [-50, 0], rotateZ: { from: () => utils.random(-10, 10), to: 0 }, duration: 1300, delay: stagger(90), ease: 'outElastic(1, .7)' }
    : { opacity: 0, y: 80, duration: 400, delay: stagger(40, { from: 'last' }), ease: 'inQuad' });
}
cards.forEach((card) => {
  const i = +card.dataset.friend;
  const f = world.friends[i];
  card.addEventListener('pointerenter', () => {
    animate(f, { hover: 1, duration: 600, ease: 'outQuad' });
    jumpFriend(i);
    card.classList.add('is-active');
  });
  card.addEventListener('pointerleave', () => {
    animate(f, { hover: 0, duration: 800, ease: 'outQuad' });
    card.classList.remove('is-active');
    animate(card, { rotateX: 0, rotateY: 0, duration: 800, ease: 'outElastic(1, .5)' });
  });
  card.addEventListener('pointermove', (e) => {
    if (!cardsShown) return;
    const r = card.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    utils.set(card, { rotateY: nx * 18, rotateX: -ny * 18 });
  });
  card.addEventListener('click', () => jumpFriend(i));
});

// ————————————————————————————————— nav / dots / progress
const dots = $('#dots');
stageEls.forEach((el, i) => {
  const li = document.createElement('li');
  li.dataset.hover = '';
  li.title = STAGE_NAMES[i];
  li.addEventListener('click', () => lenis.scrollTo(el, { duration: 2.2 }));
  dots.appendChild(li);
});
const dotEls = [...dots.children];
const navLinks = $$('.nav-links a');
$$('[data-scroll-to]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const t = a.dataset.scrollTo;
    lenis.scrollTo(t === '0' ? 0 : `#${t}`, { duration: 2.2 });
  }),
);
const progressBar = $('#progress-bar');

// ————————————————————————————————— marquee
const rows = $$('.marquee-row').map((el) => ({ el, dir: +el.dataset.dir, x: 0 }));

// ————————————————————————————————— mini game: SKY RUN
const game = world.game;
const gameUI = $('#game-ui');
const gScore = $('#g-score');
const gTime = $('#g-time');
const gCombo = $('#g-combo');
const gLives = $('#g-lives');
const gCount = $('#g-count');
const gOver = $('#g-over');
const gTip = $('#g-tip');
const HEART_ICON = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.7 1.3 5.2 3.1 1.5-1.8 3-3.1 5.2-3.1 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" fill="currentColor" stroke="#6ea4de" stroke-width="1.6"/></svg>';
let best = 0;
try {
  best = +(localStorage.getItem('cinna-best') || 0);
} catch {}
$('#best-score').textContent = best;
let flapTimer = 0;

function renderLives(n) {
  gLives.innerHTML = Array.from({ length: 3 }, (_, i) => HEART_ICON.replace('<svg', `<svg class="${i < n ? '' : 'lost'}"`)).join('');
}

function popText(text, at, gold) {
  const el = document.createElement('div');
  el.className = 'pop-pts' + (gold ? ' gold' : '');
  el.textContent = text;
  document.body.appendChild(el);
  animate(el, {
    x: [at.x - 20, at.x - 20 + utils.random(-30, 30)],
    y: [at.y - 20, at.y - 110],
    scale: [{ from: 0.2, to: 1.3, duration: 220, ease: 'outBack(3)' }, { to: 0.9, duration: 600 }],
    opacity: [{ to: 1, duration: 100 }, { to: 0, duration: 400, delay: 450 }],
    duration: 950,
    ease: 'outCubic',
    onComplete: () => el.remove(),
  });
}

function countdown() {
  const steps = ['3', '2', '1', 'GO!'];
  const tl = createTimeline();
  steps.forEach((txt, i) => {
    tl.call(() => {
      gCount.innerHTML = `<span>${txt}</span>`;
      sfx.play(i === 3 ? 'gold' : 'pop');
    }, i * 650);
    tl.add(gCount, { scale: [2.2, 1], opacity: [0, 1], rotate: [i % 2 ? 12 : -12, 0], duration: 450, ease: 'outElastic(1, .6)' }, i * 650);
    tl.add(gCount, { scale: 0.6, opacity: 0, duration: 180, ease: 'inQuad' }, i * 650 + 460);
  });
  tl.call(() => {
    game.begin();
    animate(gTip, { opacity: [0, 1], y: [20, 0], duration: 500, ease: 'outBack(2)' });
    setTimeout(() => animate(gTip, { opacity: 0, duration: 500 }), 2600);
  }, steps.length * 650 - 200);
}

function startGame() {
  const sec = $('#play');
  lenis.scrollTo(sec.offsetTop + (sec.offsetHeight - vh) / 2, { immediate: true });
  lenis.stop();
  document.body.classList.add('is-playing');
  gameUI.setAttribute('aria-hidden', 'false');
  gOver.classList.remove('is-on');
  utils.set(gOver, { opacity: 0 });
  game.enter();
  gScore.textContent = '0';
  gCombo.textContent = '';
  renderLives(3);
  sfx.play('whoosh');
  countdown();
}

function leaveGame() {
  game.exit();
  document.body.classList.remove('is-playing');
  gameUI.setAttribute('aria-hidden', 'true');
  gOver.classList.remove('is-on');
  gCount.innerHTML = '';
  lenis.start();
}

game
  .on('collect', ({ pts, gold, combo, mult, at }) => {
    gScore.textContent = game.score;
    animate(gScore, { scale: [1.35, 1], duration: 500, ease: 'outElastic(1, .5)' });
    popText(gold ? `+${pts} ✦` : `+${pts}`, at, gold);
    burst(at.x, at.y, gold ? 16 : 6, gold);
    sfx.play(gold ? 'gold' : 'chime', combo);
    if (mult > 1) {
      gCombo.textContent = `x${mult} COMBO · ${combo}`;
      animate(gCombo, { scale: [1.4, 1], rotate: [-6, 0], duration: 500, ease: 'outElastic(1, .5)' });
    }
  })
  .on('miss', () => {
    gCombo.textContent = '';
  })
  .on('hit', ({ lives }) => {
    renderLives(lives);
    gCombo.textContent = '';
    sfx.play('hit');
    const hearts = gLives.querySelectorAll('svg');
    if (hearts[lives]) animate(hearts[lives], { scale: [1.8, 1], rotate: [-30, 0], duration: 600, ease: 'outElastic(1, .4)' });
    animate('#g-flash', { opacity: [0.9, 0], duration: 600, ease: 'outQuad' });
    animate('#gl', { x: [{ to: -14, duration: 50 }, { to: 12, duration: 50 }, { to: -8, duration: 50 }, { to: 5, duration: 50 }, { to: 0, duration: 60 }] });
  })
  .on('over', ({ score }) => {
    const isBest = score > best;
    if (isBest) {
      best = score;
      try {
        localStorage.setItem('cinna-best', String(best));
      } catch {}
      $('#best-score').textContent = best;
    }
    const rank =
      score >= 80 ? '☁ 하늘의 제왕, 시나모롤급!' : score >= 45 ? '✦ 펄럭 마스터' : score >= 20 ? '♨ 카페 단골손님' : '구름 산책 초보';
    $('#g-rank').textContent = rank;
    $('#g-best').textContent = isBest ? '🎉 최고 기록 달성!' : `최고 기록 ${best}점`;
    $('#g-best').classList.toggle('new', isBest);
    const final = { v: 0 };
    gOver.classList.add('is-on');
    createTimeline()
      .add(gOver, { opacity: [0, 1], scale: [0.6, 1], rotate: [-4, 0], duration: 900, ease: 'outElastic(1, .6)' }, 300)
      .add(final, { v: score, duration: 1200, ease: 'outExpo', onUpdate: () => ($('#g-final').textContent = Math.round(final.v)) }, 500)
      .call(() => {
        sfx.play(isBest ? 'fanfare' : 'pop');
        if (isBest) {
          const r = gOver.getBoundingClientRect();
          for (let k = 0; k < 4; k++) setTimeout(() => burst(r.left + utils.random(0, r.width), r.top + utils.random(0, r.height * 0.5), 14, true), k * 160);
        }
      }, 1300);
  });

$('#game-start').addEventListener('click', startGame);
$('#g-retry').addEventListener('click', startGame);
$('#g-leave').addEventListener('click', leaveGame);
$('#g-exit').addEventListener('click', leaveGame);
const hold = (on) => {
  if (game.state !== 'play') return;
  if (on && !game.holding) sfx.play('flap');
  game.holding = on;
};
gameUI.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  hold(true);
});
addEventListener('pointerup', () => hold(false));
addEventListener('pointercancel', () => hold(false));
addEventListener('keydown', (e) => {
  if (!playing()) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    hold(true);
  }
  if (e.code === 'Escape') leaveGame();
});
addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') hold(false);
});

// ————————————————————————————————— main loop
const root = document.documentElement.style;
const state = { i: 0, b: 0, flyP: 0, scroll: 0, mouse };
let last = performance.now();
let frame = 0;
let activeStage = -1;

function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  const t = now / 1000;
  frame++;
  lenis.raf(now);

  const st = stageState();
  state.i = st.i;
  state.b = st.b;
  state.flyP = stickyProgress(fly);
  state.scroll = lenis.scroll / vh;
  const friendsP = stickyProgress(friendsEl);

  const pose = world.update(dt, t, state);

  // sky
  root.setProperty('--sky-top', `#${pose.skyTop.getHexString()}`);
  root.setProperty('--sky-bot', `#${pose.skyBot.getHexString()}`);

  // stage-dependent chrome
  const cur = st.b > 0.5 ? st.i + 1 : st.i;
  if (cur !== activeStage) {
    activeStage = cur;
    dotEls.forEach((d, k) => d.classList.toggle('is-active', k === cur));
    navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.scrollTo === STAGE_NAMES[cur]));
    document.body.classList.toggle('is-night', STAGE_NAMES[cur] === 'night');
  }
  const max = document.documentElement.scrollHeight - vh;
  progressBar.style.transform = `scaleX(${max > 0 ? lenis.scroll / max : 0})`;

  // fly
  const fp = state.flyP;
  if (Math.abs(fp - lastFlyP) > 0.0005) {
    lastFlyP = fp;
    trail.seek(smooth(0.03, 0.85, fp) * 1000);
    flyWords.forEach((w) => (w.style.transform = `translateX(${(0.5 - fp) * parseFloat(w.dataset.speed) * 70}vw)`));
    hudAlt.textContent = Math.round(320 + smooth(0, 1, fp) * 2680).toLocaleString();
    hudBar.style.transform = `scaleX(${fp})`;
    if (fp > 0 && fp < 1) showCaption(clamp(Math.floor((fp - 0.02) / 0.2), 0, 3));
  }
  hudFlaps.textContent = (pose.flapSpeed / (Math.PI * 2)).toFixed(1);

  // game HUD
  if (game.state === 'play') {
    gTime.style.transform = `scaleX(${game.time / GAME_TIME})`;
    flapTimer -= dt;
    if (game.holding && flapTimer <= 0) {
      sfx.play('flap');
      flapTimer = 0.2;
    }
  }

  // friends
  toggleCards(friendsP > 0.06 && STAGE_NAMES[cur] === 'friends');

  // marquee — scroll velocity makes it skate and skew
  const vel = lenis.velocity || 0;
  rows.forEach((r) => {
    const half = r.el.scrollWidth / 2;
    r.x -= (40 + Math.abs(vel) * 6) * dt * r.dir;
    r.x = ((r.x % half) + half) % half;
    r.el.style.transform = `translateX(${-r.x}px) skewX(${clamp(-vel * 0.6, -14, 14)}deg)`;
  });

  // cursor
  dot.style.transform = `translate(${mouse.px}px, ${mouse.py}px)`;
  ringPos.x += (mouse.px - ringPos.x) * (1 - Math.exp(-dt * 16));
  ringPos.y += (mouse.py - ringPos.y) * (1 - Math.exp(-dt * 16));
  ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
  if (mouse.moved && frame % 4 === 0) {
    mouse.moved = false;
    hoverChar = !!world.pick(mouse.px, mouse.py);
  }
  cursor.classList.toggle('is-hover', hoverUI || hoverChar);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('resize', () => {
  world.resize();
  measure();
});
measure();
