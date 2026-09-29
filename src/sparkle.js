// Screen-space glitter: a single 2D canvas of twinkling 4-point stars.
// Sprites are pre-rendered per colour so each particle is one drawImage.
const COLORS = ['#ffffff', '#fff3a6', '#ffc4e1', '#bfe4ff', '#d8c8ff', '#b9f3e4'];
const SPRITE = 96;

function makeSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d');
  const m = SPRITE / 2;
  // soft glow
  const glow = g.createRadialGradient(m, m, 0, m, m, m);
  glow.addColorStop(0, color);
  glow.addColorStop(0.18, color + 'cc');
  glow.addColorStop(0.45, color + '33');
  glow.addColorStop(1, color + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE, SPRITE);
  // 4-point star with a blue-ish rim so it reads on white clouds
  const star = (r, w, fill) => {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? w : r;
      g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  star(m * 0.92, m * 0.13, 'rgba(110,164,222,0.55)');
  star(m * 0.82, m * 0.09, color);
  star(m * 0.36, m * 0.07, '#ffffff');
  return c;
}

export function createSparkles(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = COLORS.map(makeSprite);
  const ps = [];
  const MAX = 700;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  resize();
  addEventListener('resize', resize);

  function spawn(x, y, o = {}) {
    if (ps.length >= MAX) ps.shift();
    const ang = o.angle ?? Math.random() * Math.PI * 2;
    const sp = (o.speed ?? 120) * (0.35 + Math.random() * 0.9);
    ps.push({
      x, y,
      vx: Math.cos(ang) * sp + (o.vx || 0),
      vy: Math.sin(ang) * sp + (o.vy || 0),
      g: o.gravity ?? 60,
      drag: o.drag ?? 2.2,
      life: 0,
      max: (o.life ?? 0.9) * (0.6 + Math.random() * 0.8),
      size: (o.size ?? 18) * (0.5 + Math.random() * 0.9),
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 6,
      tw: Math.random() * 10,
      s: sprites[o.color ?? (Math.random() * sprites.length) | 0],
    });
  }

  return {
    // burst of glitter at a screen point
    burst(x, y, n = 24, o = {}) {
      for (let i = 0; i < n; i++) spawn(x, y, o);
    },
    // trail behind a moving pointer
    trail(x, y, vx, vy) {
      const sp = Math.hypot(vx, vy);
      const n = Math.min(4, Math.floor(sp / 350) + (Math.random() < 0.55 ? 1 : 0));
      for (let i = 0; i < n; i++)
        spawn(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14, {
          speed: 40, vx: -vx * 0.04, vy: -vy * 0.04, gravity: 90, life: 0.8, size: 14,
        });
    },
    // glitter falling from the top of the screen
    rain(n = 60) {
      for (let i = 0; i < n; i++)
        spawn(Math.random() * innerWidth, -20 - Math.random() * innerHeight * 0.4, {
          angle: Math.PI / 2, speed: 60, gravity: 160, drag: 0.6, life: 2.4, size: 20,
        });
    },
    update(dt) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!ps.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.life >= p.max) {
          ps.splice(i, 1);
          continue;
        }
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy = p.vy * k + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const t = p.life / p.max;
        const twinkle = 0.55 + 0.45 * Math.sin(p.tw + p.life * 22);
        const scale = Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * (1 - t * t);
        const sz = p.size * scale * (0.7 + 0.5 * twinkle);
        if (sz < 0.5) continue;
        ctx.globalAlpha = Math.min(1, (1 - t) * 1.6) * (0.6 + 0.4 * twinkle);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(p.s, -sz, -sz, sz * 2, sz * 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}
