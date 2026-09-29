import * as THREE from 'three';
import { toonMaterial, outlineMaterial, flatMaterial } from './materials.js';
import { cloudGeometry, PUFFS, spiralRoll } from './props.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

export const GAME_TIME = 40;
const LIVES = 3;

// ——— props ———
function stormCloud() {
  const g = new THREE.Group();
  const geo = cloudGeometry(PUFFS);
  const body = new THREE.Mesh(geo, toonMaterial({ color: '#a7afc6', shadow: '#747d9b' }));
  body.add(new THREE.Mesh(geo, outlineMaterial({ color: '#4a5374' })));
  body.scale.setScalar(0.42);
  g.add(body);

  // grumpy little face
  const eyeMat = flatMaterial('#343b5c');
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), eyeMat);
    e.scale.set(0.05, 0.075, 0.02);
    e.position.set(0.17 * s, 0.07, 0.43);
    g.add(e);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.02), eyeMat);
    brow.position.set(0.17 * s, 0.17, 0.43);
    brow.rotation.z = -0.45 * s;
    g.add(brow);
  });

  // lightning bolt hanging beneath
  const s = new THREE.Shape();
  [[0.05, 0.28], [-0.12, -0.02], [0.02, -0.02], [-0.08, -0.32], [0.16, 0.06], [0.02, 0.06], [0.12, 0.28]].forEach(([x, y], i) =>
    i ? s.lineTo(x, y) : s.moveTo(x, y),
  );
  const boltGeo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  boltGeo.center();
  const bolt = new THREE.Mesh(boltGeo, toonMaterial({ color: '#ffe46b', shadow: '#f5b400' }));
  bolt.add(new THREE.Mesh(boltGeo, outlineMaterial({ color: '#c98a00' })));
  bolt.position.set(0.05, -0.42, 0.1);
  g.add(bolt);
  g.userData.bolt = bolt;
  return g;
}

function miniRoll(gold) {
  const g = new THREE.Group();
  const r = gold
    ? spiralRoll({ plate: false, dough: '#ffd84d', doughShadow: '#e39c00', lineColor: '#b17200' })
    : spiralRoll({ plate: false });
  r.scale.setScalar(0.2);
  r.rotation.x = 1.15;
  g.add(r);
  g.userData.spin = r;
  return g;
}

export class Game {
  constructor(scene, camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.items = [];
    const add = (type, n, make) => {
      for (let i = 0; i < n; i++) {
        const obj = make();
        obj.visible = false;
        this.group.add(obj);
        this.items.push({ type, obj, active: false, x: 0, y: 0, phase: 0, hit: 0 });
      }
    };
    add('roll', 12, () => miniRoll(false));
    add('gold', 2, () => miniRoll(true));
    add('storm', 6, stormCloud);

    this.state = 'idle'; // idle → ready → play → over
    this.blend = 0;
    this.holding = false;
    this.handlers = {};
    this.char = { x: -3, y: 0, vy: 0, scale: 0.42 };
    this.bounds = { w: 5, h: 2.8 };
    this._v = new THREE.Vector3();
    this.reset();
  }

  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }
  emit(name, data) {
    this.handlers[name]?.(data);
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.best = 0;
    this.lives = LIVES;
    this.time = GAME_TIME;
    this.elapsed = 0;
    this.spawnT = 0.6;
    this.invuln = 0;
    this.char.y = 0;
    this.char.vy = 0;
    this.items.forEach((it) => {
      it.active = false;
      it.obj.visible = false;
    });
  }

  get mult() {
    return Math.min(5, 1 + Math.floor(this.combo / 5));
  }

  enter() {
    this.reset();
    this.state = 'ready';
    this.group.visible = true;
  }
  begin() {
    this.state = 'play';
  }
  exit() {
    this.state = 'idle';
    this.holding = false;
  }

  toScreen(x, y) {
    this._v.set(x, y, 0).project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth, y: (-this._v.y * 0.5 + 0.5) * innerHeight };
  }

  spawn() {
    const stormChance = lerp(0.26, 0.45, this.elapsed / GAME_TIME);
    const r = Math.random();
    const type = r < 0.05 ? 'gold' : r < 0.05 + stormChance ? 'storm' : 'roll';
    const it = this.items.find((i) => !i.active && i.type === type) || this.items.find((i) => !i.active && i.type === 'roll');
    if (!it) return;
    it.active = true;
    it.hit = 0;
    it.x = this.bounds.w + 1.2;
    it.y = rand(-this.bounds.h * 0.78, this.bounds.h * 0.78);
    it.phase = Math.random() * 10;
    it.obj.visible = true;
    it.obj.scale.setScalar(1);
    it.obj.rotation.set(0, 0, 0);
  }

  // Called by the world every frame. Returns nothing; world reads this.char.
  update(dt, t) {
    const target = this.state === 'idle' ? 0 : 1;
    this.blend = lerp(this.blend, target, 1 - Math.exp(-4 * dt));
    if (this.state === 'idle' && this.blend < 0.01) {
      this.group.visible = false;
      return;
    }

    // play-area bounds at z = 0
    const cam = this.camera;
    const dist = cam.position.z;
    const h = dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    this.bounds.h = h;
    this.bounds.w = h * cam.aspect;
    const mob = cam.aspect < 0.85;
    this.char.x = -this.bounds.w * (mob ? 0.5 : 0.55);
    this.char.scale = mob ? 0.34 : 0.42;

    const c = this.char;
    const speed = lerp(4.2, 8.2, clamp(this.elapsed / GAME_TIME, 0, 1));
    this.speed = speed;

    if (this.state === 'play') {
      this.elapsed += dt;
      this.time = Math.max(0, GAME_TIME - this.elapsed);
      c.vy += (this.holding ? 15 : -9.5) * dt;
      c.vy = clamp(c.vy, -5.2, 5.2);
      c.y += c.vy * dt;
      const lim = this.bounds.h * 0.82;
      if (c.y > lim) (c.y = lim), (c.vy = Math.min(0, c.vy));
      if (c.y < -lim) (c.y = -lim), (c.vy = Math.max(0, c.vy) * -0.4 + 2.5);

      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawn();
        this.spawnT = lerp(0.62, 0.36, this.elapsed / GAME_TIME) * rand(0.8, 1.2);
      }
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.time <= 0) this.finish();
    } else if (this.state === 'ready') {
      c.y = lerp(c.y, Math.sin(t * 2) * 0.3, 1 - Math.exp(-5 * dt));
      c.vy = 0;
    } else if (this.state === 'over') {
      c.y = lerp(c.y, 0, 1 - Math.exp(-3 * dt));
    }

    // ——— items ———
    const cy = c.y + 0.1;
    const rChar = 0.52 * (c.scale / 0.42);
    for (const it of this.items) {
      if (!it.active) continue;
      const o = it.obj;
      if (this.state === 'over') {
        it.y += dt * 6;
        o.scale.multiplyScalar(1 - dt * 2.5);
        if (o.scale.x < 0.05) (it.active = false), (o.visible = false);
      } else if (this.state === 'play') {
        it.x -= speed * dt * (it.type === 'storm' ? 0.85 : 1);
      }
      if (it.hit > 0) {
        it.hit -= dt;
        o.scale.setScalar(1 + (0.4 - it.hit) * 3);
        if (it.hit <= 0) (it.active = false), (o.visible = false);
      }
      const bob = Math.sin(t * 2.4 + it.phase) * 0.18;
      o.position.set(it.x, it.y + bob, 0);
      if (it.type === 'storm') {
        o.rotation.z = Math.sin(t * 3 + it.phase) * 0.08;
        o.userData.bolt.visible = Math.sin(t * 9 + it.phase) > -0.3;
      } else {
        o.userData.spin.rotation.z += dt * (it.type === 'gold' ? 6 : 2.5);
        o.rotation.z = Math.sin(t * 2 + it.phase) * 0.25;
      }

      if (this.state !== 'play' || it.hit > 0) continue;
      const dx = it.x - c.x;
      const dy = it.y + bob - cy;
      const rItem = it.type === 'storm' ? 0.55 : 0.36;
      if (dx * dx + dy * dy < (rChar + rItem) ** 2) {
        if (it.type === 'storm') {
          if (this.invuln > 0) continue;
          this.lives--;
          this.combo = 0;
          this.invuln = 1.5;
          c.vy = -3;
          it.hit = 0.25;
          this.emit('hit', { lives: this.lives, at: this.toScreen(c.x, c.y) });
          if (this.lives <= 0) this.finish();
        } else {
          this.combo++;
          const pts = (it.type === 'gold' ? 5 : 1) * this.mult;
          this.score += pts;
          it.hit = 0.4;
          this.emit('collect', { pts, gold: it.type === 'gold', combo: this.combo, mult: this.mult, at: this.toScreen(it.x, it.y + bob) });
        }
        continue;
      }
      if (it.x < -this.bounds.w - 2) {
        if (it.type !== 'storm' && this.combo > 0) {
          this.combo = 0;
          this.emit('miss');
        }
        it.active = false;
        o.visible = false;
      }
    }
  }

  finish() {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.holding = false;
    this.emit('over', { score: this.score });
  }

  // Pose overrides for Cinnamoroll while playing.
  applyPose(pose, t) {
    const c = this.char;
    const flying = this.state === 'play' && this.holding;
    pose.earL = pose.earR = flying ? 1.35 : 1.75;
    pose.flapAmp = flying ? 0.6 : 0.1;
    pose.flapSpeed = flying ? 17 : 3.5;
    pose.happy = this.invuln > 0 ? 0 : 1;
    pose.wave = this.state === 'over' ? 1 : 0;
    pose.look = 0;
    pose.speed = this.state === 'play' ? 0.6 : 0;
    return {
      x: c.x,
      y: c.y,
      rx: 0,
      ry: 0.75 - (this.state === 'over' ? 0.75 : 0),
      rz: clamp(-c.vy * 0.07, -0.4, 0.4) + (this.invuln > 1.1 ? (1.5 - this.invuln) * Math.PI * 5 : 0),
      scale: c.scale,
      hidden: this.invuln > 0 && this.invuln < 1.1 && Math.floor(t * 18) % 2 === 0,
    };
  }
}
