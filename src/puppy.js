import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, outlineMaterial, bendUniform, flatMaterial } from './materials.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// Deform a primitive vertex-by-vertex, then weld seams so the cel
// terminator stays perfectly smooth (no UV-seam creases).
function deform(geo, fn) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  return merged;
}

// Paddle-shaped ear: narrow root, broad rounded tip, flat like a wing.
// Pivot sits at the root (y = 0) and the ear hangs down -y.
function earGeometry({ length = 2.1, width = 0.47, thick = 0.075, curly = false }) {
  const cap = width / length;
  return deform(new THREE.SphereGeometry(1, 40, 72), (v) => {
    const th = Math.acos(clamp(v.y, -1, 1));
    const t = th / Math.PI;
    const s = Math.sin(th);
    const xs = s > 1e-5 ? v.x / s : 0;
    const zs = s > 1e-5 ? v.z / s : 0;
    let w = lerp(0.19, width, smooth(0.0, 0.7, t));
    if (curly) w += 0.045 * Math.sin(t * 34) * smooth(0.12, 0.3, t);
    let c = 1;
    if (t > 1 - cap) {
      const u = (t - (1 - cap)) / cap;
      c = Math.sqrt(Math.max(0, 1 - u * u));
    }
    if (t < 0.06) {
      const u = (0.06 - t) / 0.06;
      c *= Math.sqrt(Math.max(0, 1 - u * u));
    }
    w *= c;
    v.set(xs * w, -t * length, zs * thick * Math.min(1, w / 0.16));
  });
}

// Big, wide, dome-shaped head with a slightly flattened chin.
const HEAD = { a: 1.28, b: 0.88, bLow: 0.88 * 0.74, c: 0.96 };
function headGeometry() {
  return deform(new THREE.SphereGeometry(1, 72, 54), (v) => {
    if (v.y < 0) v.y *= 0.74;
    const puff = 1 + 0.05 * (1 - Math.abs(v.y)); // chubby cheeks
    v.set(v.x * HEAD.a * puff, v.y * HEAD.b, v.z * HEAD.c);
  });
}

// Point + normal on the head surface given yaw/pitch (radians).
function headSurface(yaw, pitch, lift = 0.012) {
  const dx = Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = Math.cos(yaw) * Math.cos(pitch);
  const puff = 1 + 0.05 * (1 - Math.abs(dy < 0 ? dy * 0.74 : dy));
  const b = dy < 0 ? HEAD.bLow : HEAD.b;
  const p = new THREE.Vector3(dx * HEAD.a * puff, dy * b, dz * HEAD.c);
  const n = new THREE.Vector3(p.x / (HEAD.a * HEAD.a), p.y / (b * b), p.z / (HEAD.c * HEAD.c)).normalize();
  p.addScaledVector(n, lift);
  return { p, n };
}

function pearGeometry() {
  return deform(new THREE.SphereGeometry(1, 48, 36), (v) => {
    const widen = 1 + 0.2 * clamp(-v.y, 0, 1);
    v.set(v.x * 0.56 * widen, v.y * 0.62, v.z * 0.5 * widen);
  });
}

function blushTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(247,168,188,0.95)');
  grd.addColorStop(0.55, 'rgba(247,172,192,0.75)');
  grd.addColorStop(1, 'rgba(247,180,198,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let BLUSH;

function tubeFrom(points, radius, segs = 48, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, segs, radius, 10, closed);
}

// ω-shaped mouth, exactly like the reference: two soft dips.
function omegaMouth(halfW = 0.13, amp = 0.034) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const x = -1 + (2 * i) / 24;
    pts.push(new THREE.Vector3(x * halfW, amp * 0.5 * (Math.cos(2 * Math.PI * x) - 1) + amp * 0.5, 0));
  }
  return tubeFrom(pts, 0.013, 64);
}

function openMouth() {
  const s = new THREE.Shape();
  s.moveTo(-0.11, 0.02);
  s.quadraticCurveTo(0, 0.05, 0.11, 0.02);
  s.bezierCurveTo(0.1, -0.12, -0.1, -0.12, -0.11, 0.02);
  return new THREE.ShapeGeometry(s, 24);
}

function closedEye(w = 0.1) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const x = -1 + (2 * i) / 16;
    pts.push(new THREE.Vector3(x * w, -0.045 * (1 - x * x), 0));
  }
  return tubeFrom(pts, 0.014, 32);
}

// Cinnamon-roll swirl tail: an Archimedean coil whose turns just touch.
function curlTail(r0 = 0.25, turns = 1.55, tube = 0.068) {
  const pts = [];
  const N = 60;
  const r1 = 0.03;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * turns * Math.PI * 2;
    const r = lerp(r0, r1, t);
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -t * 0.06));
  }
  return tubeFrom(pts, tube, 160);
}

export const PALETTES = {
  cinnamoroll: {
    body: '#ffffff', shadow: '#d6e5f8', outline: '#6ea4de',
    ear: '#ffffff', earShadow: '#d6e5f8', eye: '#5f9de2',
    earLength: 2.1, earWidth: 0.47, tail: 'curl',
  },
  mocha: {
    body: '#fbe0d8', shadow: '#eab5aa', outline: '#c0877a',
    ear: '#d9a18f', earShadow: '#bd8373', eye: '#5a3d44',
    earLength: 1.45, earWidth: 0.4, tail: 'ball', bow: '#f48fb1',
  },
  chiffon: {
    body: '#f8e6c1', shadow: '#e2c38d', outline: '#c29656',
    ear: '#f1d6a0', earShadow: '#d6b476', eye: '#5a4632',
    earLength: 1.6, earWidth: 0.42, tail: 'ball',
  },
  cappuccino: {
    body: '#ffffff', shadow: '#e8ddd0', outline: '#b69069',
    ear: '#e5c39c', earShadow: '#c9a077', eye: '#4d3a2e',
    earLength: 1.35, earWidth: 0.44, tail: 'ball', chubby: 1.18,
  },
  espresso: {
    body: '#fffaf1', shadow: '#eadfcd', outline: '#a88d6f',
    ear: '#f3e6cf', earShadow: '#dac7a6', eye: '#4a3b30',
    earLength: 1.4, earWidth: 0.42, tail: 'ball', curly: true,
  },
  milk: {
    body: '#ffffff', shadow: '#dae7f8', outline: '#7fb0e6',
    ear: '#ffffff', earShadow: '#dae7f8', eye: '#5f9de2',
    earLength: 1.15, earWidth: 0.36, tail: 'ball', baby: true,
  },
};

export class Puppy {
  constructor(palette = PALETTES.cinnamoroll) {
    const P = (this.pal = palette);
    BLUSH ||= blushTexture();

    this.root = new THREE.Group();
    this.bob = new THREE.Group();
    this.root.add(this.bob);

    const bodyMat = toonMaterial({ color: P.body, shadow: P.shadow });
    const line = outlineMaterial({ color: P.outline });
    this.materials = [bodyMat, line];

    const part = (geo, mat, outline, parent) => {
      const m = new THREE.Mesh(geo, mat);
      if (outline) m.add(new THREE.Mesh(geo, outline));
      parent.add(m);
      return m;
    };

    // ——— body ———
    const chub = P.chubby || 1;
    this.body = part(pearGeometry(), bodyMat, line, this.bob);
    this.body.position.set(0, -0.55, 0.02);
    this.body.scale.setScalar(chub);

    // feet
    const footGeo = new THREE.SphereGeometry(0.2, 32, 20);
    this.feet = [-1, 1].map((s) => {
      const f = part(footGeo, bodyMat, line, this.bob);
      f.position.set(0.27 * s * chub, -1.1, 0.2);
      f.scale.set(1, 0.72, 1.18);
      return f;
    });

    // arms — pivot at the shoulder
    const armGeo = new THREE.CapsuleGeometry(0.115, 0.2, 8, 20);
    armGeo.translate(0, -0.16, 0);
    this.arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.4 * s * chub, -0.3, 0.2);
      this.bob.add(pivot);
      part(armGeo, bodyMat, line, pivot);
      return pivot;
    });

    // tail
    this.tail = new THREE.Group();
    this.tail.position.set(0.12, -0.8, -0.42 * chub);
    this.tail.rotation.set(0.25, Math.PI + 0.35, 0);
    this.bob.add(this.tail);
    if (P.tail === 'curl') {
      part(curlTail(), bodyMat, line, this.tail);
      part(new THREE.SphereGeometry(0.075, 16, 12), bodyMat, null, this.tail);
    } else {
      part(new THREE.SphereGeometry(0.16, 24, 16), bodyMat, line, this.tail);
    }

    // ——— head ———
    this.head = new THREE.Group();
    this.head.position.set(0, 0.62, 0);
    this.bob.add(this.head);
    part(headGeometry(), bodyMat, line, this.head);

    // ears
    const earGeo = earGeometry({ length: P.earLength, width: P.earWidth, curly: P.curly });
    this.ears = [-1, 1].map((s) => {
      const bend = bendUniform();
      const mat = toonMaterial({ color: P.ear, shadow: P.earShadow, bend });
      const lineMat = outlineMaterial({ color: P.outline, bend });
      this.materials.push(mat, lineMat);
      const pivot = new THREE.Group();
      pivot.position.set(0.74 * s, 0.56, -0.14);
      pivot.rotation.y = 0.22 * s;
      this.head.add(pivot);
      part(earGeo, mat, lineMat, pivot);
      return { pivot, bend, side: s, angle: 0.5, prev: 0.5 };
    });

    // ——— face ———
    const place = (mesh, yaw, pitch, lift) => {
      const { p, n } = headSurface(yaw, pitch, lift);
      mesh.position.copy(p);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      this.head.add(mesh);
      return mesh;
    };

    const eyeMat = flatMaterial(P.eye);
    const eyeGeo = new THREE.SphereGeometry(1, 24, 16);
    const eyeYaw = P.baby ? 0.5 : 0.55;
    this.eyes = [-1, 1].map((s) => {
      const holder = place(new THREE.Group(), eyeYaw * s, -0.06, 0.004);
      const e = new THREE.Mesh(eyeGeo, eyeMat);
      e.scale.set(0.088, 0.128, 0.02);
      holder.add(e);
      return e;
    });

    const closedGeo = closedEye(0.085);
    this.closedEyes = [-1, 1].map((s) => {
      const m = place(new THREE.Mesh(closedGeo, eyeMat), eyeYaw * s, -0.1, 0.02);
      m.visible = false;
      return m;
    });

    const blushMat = new THREE.MeshBasicMaterial({
      map: BLUSH, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.cheeks = [-1, 1].map((s) => {
      const m = place(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.25), blushMat), 0.83 * s, -0.36, 0.03);
      m.renderOrder = 2;
      return m;
    });

    const mouthLine = flatMaterial(P.outline === '#6ea4de' ? '#5b95d8' : P.outline);
    this.mouthW = place(new THREE.Mesh(omegaMouth(), mouthLine), 0, -0.26, 0.016);
    this.mouthOpen = place(new THREE.Group(), 0, -0.3, 0.012);
    const om = openMouth();
    const inner = new THREE.Mesh(om, flatMaterial('#f6a9c3', { side: THREE.DoubleSide }));
    inner.position.z = 0.004;
    const rim = new THREE.Mesh(om, flatMaterial(mouthLine.color, { side: THREE.DoubleSide }));
    rim.scale.setScalar(1.18);
    rim.position.y = 0.004;
    this.mouthOpen.add(rim, inner);
    this.mouthOpen.visible = false;

    // accessories
    if (P.bow) {
      const bowMat = toonMaterial({ color: P.bow, shadow: '#d96b93' });
      const bow = new THREE.Group();
      const lobe = new THREE.SphereGeometry(0.16, 20, 14);
      [-1, 1].forEach((s) => {
        const l = part(lobe, bowMat, line, bow);
        l.position.x = 0.14 * s;
        l.scale.set(1, 0.7, 0.45);
        l.rotation.z = 0.35 * s;
      });
      part(new THREE.SphereGeometry(0.07, 14, 10), bowMat, line, bow);
      place(bow, 0.5, 0.72, 0.05);
    }
    if (P.baby) {
      const paci = new THREE.Group();
      const ringMat = toonMaterial({ color: '#9fcbff', shadow: '#6fa5e6' });
      part(new THREE.TorusGeometry(0.1, 0.03, 12, 32), ringMat, line, paci).position.z = 0.1;
      part(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 32).rotateX(Math.PI / 2), ringMat, line, paci);
      place(paci, 0, -0.34, 0.02);
      this.mouthW.visible = false;
      this.noMouth = true;
      // one little curl of hair on top
      const curl = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const a = t * Math.PI * 1.7;
        curl.push(new THREE.Vector3(Math.sin(a) * 0.12 * (1 - t * 0.4), t * 0.22 + (1 - Math.cos(a)) * 0.06, 0));
      }
      const hair = part(tubeFrom(curl, 0.035, 40), bodyMat, line, this.head);
      hair.position.set(0, HEAD.b - 0.04, 0.1);
    }

    // interaction state (driven by anime.js)
    this.react = { jump: 0, spin: 0, squash: 0, flip: 0, pop: 1, happy: 0 };
    this.phase = Math.random() * 10;
    this.blinkT = 1 + Math.random() * 3;
    this.blink = 0;
    this.look = new THREE.Vector2();
  }

  // Apply a pose (see choreo.js) with damping for softness.
  update(dt, t, pose, mouse) {
    const r = this.react;
    const sleep = pose.sleep;

    // ——— ears: base angle + flapping + whip bend ———
    this.phase += dt * pose.flapSpeed;
    const flap = Math.sin(this.phase) * pose.flapAmp;
    const flapVel = Math.cos(this.phase) * pose.flapAmp * pose.flapSpeed;
    for (const e of this.ears) {
      const base = e.side > 0 ? pose.earR : pose.earL;
      const wiggle = Math.sin(t * 1.3 + e.side) * 0.04 * (1 - sleep);
      e.angle = base + flap + wiggle;
      e.pivot.rotation.z = e.angle * e.side;
      e.pivot.rotation.x = -0.08 + 0.15 * sleep;
      // tip lags the motion; raised ears get a gentle S-curve like the art
      const raised = smooth(1.8, 2.8, base);
      const bx = clamp(-flapVel * 0.01, -0.12, 0.12) * e.side + raised * 0.07 * e.side;
      e.bend.value.x = damp(e.bend.value.x, bx, 12, dt);
      e.bend.value.y = damp(e.bend.value.y, -0.02 - 0.03 * pose.speed, 6, dt);
    }

    // ——— arms ———
    const [armL, armR] = this.arms;
    const waveA = 2.35 + Math.sin(t * 9) * 0.32;
    armR.rotation.z = lerp(0.45, waveA, pose.wave);
    armL.rotation.z = -0.45 - flap * 0.3;
    armR.rotation.x = armL.rotation.x = -0.35 - pose.speed * 0.6;

    // ——— head look-at ———
    this.look.x = damp(this.look.x, mouse.x * pose.look, 5, dt);
    this.look.y = damp(this.look.y, mouse.y * pose.look, 5, dt);
    this.head.rotation.y = this.look.x * 0.5;
    this.head.rotation.x = -this.look.y * 0.22 + sleep * 0.12;
    this.head.rotation.z = -this.look.x * 0.08 + sleep * 0.18 + pose.wave * 0.1 * Math.sin(t * 2);

    // ——— bobbing / breathing ———
    const breathe = Math.sin(t * 1.6);
    this.bob.position.y = breathe * 0.07 * (1 - sleep) + r.jump;
    this.bob.rotation.y = r.spin;
    this.bob.rotation.x = r.flip;
    const sq = r.squash + sleep * 0.02 * Math.sin(t * 1.1);
    this.bob.scale.set((1 + sq) * r.pop, (1 - sq) * r.pop, (1 + sq) * r.pop);

    // ——— face ———
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = 1;
      this.blinkT = 2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const open = 1 - Math.sin(this.blink * Math.PI);
    const happy = Math.max(pose.happy, r.happy) > 0.5;
    this.eyes.forEach((e) => {
      e.scale.y = 0.128 * Math.max(0.08, open);
      e.visible = sleep < 0.5;
    });
    this.closedEyes.forEach((e) => (e.visible = sleep >= 0.5));
    if (!this.noMouth) {
      this.mouthOpen.visible = happy && sleep < 0.5;
      this.mouthW.visible = !this.mouthOpen.visible;
    }
  }
}
