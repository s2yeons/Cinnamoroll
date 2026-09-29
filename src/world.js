import * as THREE from 'three';
import { Puppy, PALETTES } from './puppy.js';
import { shared, toonMaterial, outlineMaterial } from './materials.js';
import { makePose, blendPose } from './choreo.js';
import { cloudGeometry, PUFFS, spiralRoll } from './props.js';
import { Game } from './game.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const outBack = (x) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const rand = (a, b) => a + Math.random() * (b - a);

function starShaderPoints(count, spread, colors, sizeRange) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const [x, y, z] = spread(i);
    pos.set([x, y, z], i * 3);
    c.set(colors[i % colors.length]);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = rand(...sizeRange);
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPixel: { value: 1 }, uLift: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aPhase;
      uniform float uTime, uOpacity, uPixel, uLift;
      varying vec3 vColor; varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.7 + aPhase) * 0.25 + uLift;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * 2.4 + aPhase * 3.0);
        gl_PointSize = aSize * uPixel * (0.55 + 0.7 * tw) * (12.0 / -mv.z);
        vColor = aColor;
        vA = uOpacity * (0.35 + 0.65 * tw);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vA;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float star = 0.018 / (abs(uv.x * uv.y) + 0.018);
        star *= smoothstep(1.0, 0.1, length(uv));
        float core = smoothstep(0.35, 0.0, length(uv));
        float a = clamp(star + core, 0.0, 1.0) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Points(geo, mat);
}

// ————————————————————————————————— world
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
  camera.position.set(0, 0.2, 9);

  // ——— hero ———
  const cinna = new Puppy(PALETTES.cinnamoroll);
  scene.add(cinna.root);

  // ——— friends ———
  const FRIEND_KEYS = ['mocha', 'chiffon', 'cappuccino', 'espresso', 'milk'];
  const FRIEND_SPOTS = [
    [-3.5, -0.35, -1.1, 0.54], [-2.0, 1.25, -2.6, 0.5], [2.0, 1.25, -2.6, 0.5],
    [3.5, -0.35, -1.1, 0.54], [1.55, -0.75, 1.9, 0.36],
  ];
  const friends = FRIEND_KEYS.map((k, i) => {
    const p = new Puppy(PALETTES[k]);
    p.spot = FRIEND_SPOTS[i];
    p.hover = 0;
    p.pose = {
      earL: 0.7, earR: 0.7, flapAmp: 0.08, flapSpeed: 3 + i * 0.4, happy: 1, wave: 0,
      sleep: 0, look: 0.6, speed: 0,
    };
    p.root.visible = false;
    scene.add(p.root);
    return p;
  });

  // ——— clouds (instanced, cel shaded + outlined) ———
  const cloudGeo = cloudGeometry(PUFFS);
  const cloudMat = toonMaterial({ color: '#ffffff', shadow: '#d3e3fa' });
  const cloudLine = outlineMaterial({ color: '#94bdea', width: 0.8 });
  const CLOUDS = 44;
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUDS);
  const cloudOutline = new THREE.InstancedMesh(cloudGeo, cloudLine, CLOUDS);
  cloudOutline.instanceMatrix = clouds.instanceMatrix;
  clouds.frustumCulled = cloudOutline.frustumCulled = false;
  scene.add(clouds, cloudOutline);
  const cloudData = Array.from({ length: CLOUDS }, (_, i) => {
    const near = i < 3;
    const z = near ? rand(2, 3.5) : rand(-32, -5);
    return {
      x: rand(-1, 1), y: rand(-1, 1), z, near,
      s: near ? rand(0.7, 1) : rand(0.6, 1.9),
      drift: rand(0.05, 0.2), ry: rand(-0.4, 0.4),
    };
  });
  const dummy = new THREE.Object3D();

  // cozy cloud bed for the night scene
  const bed = new THREE.Mesh(cloudGeometry(PUFFS), cloudMat);
  bed.add(new THREE.Mesh(bed.geometry, outlineMaterial({ color: '#94bdea' })));
  scene.add(bed);

  // giant cinnamon roll for the café
  const roll = spiralRoll();
  scene.add(roll);

  // moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 40, 28),
    toonMaterial({ color: '#fff6cc', shadow: '#f6d77e', ambient: false }),
  );
  moon.add(new THREE.Mesh(moon.geometry, outlineMaterial({ color: '#e2b650' })));
  {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,240,180,0.55)');
    grd.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    halo.position.z = -0.9;
    moon.add(halo);
  }
  scene.add(moon);

  // sparkles & stars
  const sparkles = starShaderPoints(
    140,
    () => [rand(-14, 14), rand(-8, 8), rand(-16, 4)],
    ['#ffd76a', '#ff9fc9', '#8fc6ff', '#ffffff'],
    [10, 26],
  );
  scene.add(sparkles);
  const stars = starShaderPoints(
    650,
    () => [rand(-60, 60), rand(-30, 34), rand(-50, -34)],
    ['#ffffff', '#fff3c4', '#cfe1ff'],
    [8, 26],
  );
  scene.add(stars);

  // flight speed lines
  const LINES = 46;
  const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), lineMat, LINES);
  lines.frustumCulled = false;
  scene.add(lines);
  const lineData = Array.from({ length: LINES }, () => ({
    x: rand(-14, 14), y: rand(-5, 5), z: rand(-8, 3), len: rand(1.5, 4.5), v: rand(22, 40),
  }));

  // ——— state ———
  const pose = makePose();
  const target = makePose();
  let first = true;
  let aspect = 1;
  let flightDrift = 0;
  const camLook = new THREE.Vector3();

  // mini-game + grab-and-fling physics
  const game = new Game(scene, camera);
  const cPose = {};
  const fling = {
    off: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(),
    grab: new THREE.Vector3(), dragging: false, plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
  };
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  function dampPose(dt) {
    const k = first ? 1 : 1 - Math.exp(-5.5 * dt);
    for (const key in target) {
      const v = target[key];
      if (Array.isArray(v)) for (let j = 0; j < v.length; j++) pose[key][j] = lerp(pose[key][j], v[j], k);
      else if (v instanceof THREE.Color) pose[key].lerp(v, k);
      else pose[key] = lerp(pose[key], v, k);
    }
    first = false;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 48 : 35;
    camera.updateProjectionMatrix();
    shared.uResolution.value.set(w * dpr, h * dpr);
    shared.uOutline.value = 1.25 * dpr * clamp(h / 900, 0.75, 1.25);
    sparkles.material.uniforms.uPixel.value = dpr;
    stars.material.uniforms.uPixel.value = dpr;
  }
  resize();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(cinna.root, true).length) return { who: 'cinna' };
    for (let i = 0; i < friends.length; i++) {
      if (friends[i].root.visible && raycaster.intersectObject(friends[i].root, true).length) return { who: 'friend', i };
    }
    return null;
  }

  function rayAt(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function startDrag(x, y) {
    if (game.state !== 'idle') return false;
    rayAt(x, y);
    fling.plane.constant = -cinna.root.position.z;
    if (!raycaster.ray.intersectPlane(fling.plane, tmpA)) return false;
    fling.grab.copy(tmpA).sub(cinna.root.position);
    fling.target.copy(cinna.root.position);
    fling.dragging = true;
    return true;
  }
  function moveDrag(x, y) {
    if (!fling.dragging) return;
    rayAt(x, y);
    if (raycaster.ray.intersectPlane(fling.plane, tmpA)) fling.target.copy(tmpA).sub(fling.grab);
  }
  function endDrag() {
    if (!fling.dragging) return 0;
    fling.dragging = false;
    fling.vel.clampLength(0, 30);
    return fling.vel.length();
  }

  function update(dt, t, s) {
    const mob = aspect < 0.85;
    const rf = mob ? 0 : clamp(aspect / 1.6, 0.62, 1.05);

    blendPose(target, s.i, s.b);
    dampPose(dt);
    const P = pose;

    // shared look
    shared.uAmbient.value.copy(P.ambient);
    shared.uFog.value.copy(P.skyBot).lerp(P.skyTop, 0.3);

    // ——— Cinnamoroll transform ———
    let [x, y, z] = P.pos;
    let [rx, ry, rz] = P.rot;
    let sc = P.scale;
    if (mob) {
      // stack vertically on phones: character above the copy
      const L = [0, 2.35, 0.6, 2.2, 0.2, 2.3, 0];
      const lift = L[s.i] * (1 - s.b) + L[Math.min(s.i + 1, L.length - 1)] * s.b;
      y += lift;
      sc *= 0.62;
    }
    x *= mob ? 0 : rf;

    // flight loop — a figure-eight with a barrel roll in the middle
    const fp = s.flyP;
    const env = smooth(0.02, 0.14, fp) * (1 - smooth(0.82, 0.97, fp));
    if (env > 0) {
      const a = fp * Math.PI * 2 * 1.5;
      const span = mob ? 1.1 : 2.9 * rf;
      x += Math.sin(a) * span * env;
      y += Math.sin(a * 2) * 0.75 * env;
      z += (Math.cos(a) - 1) * 1.4 * env;
      ry += Math.cos(a) * 0.75 * env;
      rz += -Math.cos(a) * 0.45 * env;
      rx += Math.sin(a * 2) * 0.2 * env;
      const barrel = smooth(0.44, 0.6, fp);
      rz += barrel * Math.PI * 2 * env;
    }
    // mini-game takes over the character
    game.update(dt, t);
    Object.assign(cPose, P);
    cinna.root.visible = true;
    if (game.blend > 0.001) {
      const g = game.applyPose(cPose, t);
      const k = game.blend;
      x = lerp(x, g.x, k);
      y = lerp(y, g.y, k);
      z = lerp(z, 0, k);
      rx = lerp(rx, g.rx, k);
      ry = lerp(ry, g.ry, k);
      rz = lerp(rz, g.rz, k);
      sc = lerp(sc, g.scale, k);
      cinna.root.visible = !g.hidden;
    }

    // grab & fling: an underdamped spring pulls him home
    if (fling.dragging) {
      tmpA.copy(fling.target).sub(tmpB.set(x, y, z));
      tmpB.copy(fling.off);
      fling.off.lerp(tmpA, 1 - Math.exp(-18 * dt));
      if (dt > 0) fling.vel.lerp(tmpA.copy(fling.off).sub(tmpB).divideScalar(dt), 0.5);
    } else {
      fling.vel.addScaledVector(fling.off, -36 * dt).multiplyScalar(Math.exp(-2.6 * dt));
      fling.off.addScaledVector(fling.vel, dt);
    }
    const flv = fling.vel;
    x += fling.off.x;
    y += fling.off.y;
    z += fling.off.z;
    rz += clamp(-flv.x * 0.05, -0.9, 0.9);
    rx += clamp(-flv.y * 0.035, -0.6, 0.6);
    ry += clamp(flv.x * 0.05, -1, 1);
    const flail = clamp(flv.length() / 10 + (fling.dragging ? 0.35 : 0), 0, 1);
    if (flail > 0.01) {
      cPose.flapAmp = lerp(cPose.flapAmp, 0.75, flail);
      cPose.flapSpeed = lerp(cPose.flapSpeed, 22, flail);
      cPose.earL = lerp(cPose.earL, 1.6, flail);
      cPose.earR = lerp(cPose.earR, 1.6, flail);
      cPose.look *= 1 - flail;
      cPose.sleep *= 1 - flail;
      if (flail > 0.25) cPose.happy = 1;
    }

    cinna.root.position.set(x, y, z);
    cinna.root.rotation.set(rx, ry, rz);
    cinna.root.scale.setScalar(sc);
    cinna.update(dt, t, cPose, s.mouse);

    // ——— friends ———
    const fv = P.friends;
    friends.forEach((f, i) => {
      const local = clamp(fv * 1.8 - i * 0.16, 0, 1);
      const v = local > 0 ? outBack(local) : 0;
      f.root.visible = local > 0.08;
      if (!f.root.visible) return;
      const [fx, fy, fz, fs] = f.spot;
      const fxm = mob ? fx * 0.36 : fx * rf;
      const fym = mob ? fy * 1.25 + 0.3 : fy;
      f.root.position.set(fxm, fym + Math.sin(t * 1.4 + i) * 0.08 + (1 - v) * -2, fz);
      f.root.rotation.y = -fxm * 0.12 + Math.sin(t * 0.8 + i) * 0.1;
      f.root.scale.setScalar(fs * v * (mob ? 0.72 : 1));
      f.pose.wave = f.hover;
      f.pose.earL = 0.7 + f.hover * 0.8;
      f.pose.earR = 0.7 + f.hover * 2.0;
      f.pose.flapAmp = 0.08 + f.hover * 0.25;
      f.pose.flapSpeed = 3 + f.hover * 9;
      f.update(dt, t + i, f.pose, s.mouse);
    });

    // ——— café roll ———
    const rv = P.roll;
    roll.visible = rv > 0.06;
    if (roll.visible) {
      roll.position.set(mob ? 0 : 2.5 * rf, (mob ? 1.55 * 0.62 + -0.28 * 0.62 : 0) - 1.28 + (1 - rv) * -1.5, 0);
      if (mob) roll.position.y = y - 0.62 * 1.08;
      roll.scale.setScalar(outBack(clamp(rv, 0, 1)) * (mob ? 0.62 : 1));
      roll.rotation.y += dt * 0.35;
      roll.rotation.x = 0.42;
    }

    // ——— night ———
    const bv = P.bed;
    bed.visible = bv > 0.04;
    if (bed.visible) {
      bed.position.set(0, -2.5 * (mob ? 0.62 : 1) + (1 - bv) * -3, 0.1);
      bed.scale.set(1.55, 1, 1.15).multiplyScalar(mob ? 0.62 : 1);
    }
    moon.visible = P.stars > 0.02;
    moon.position.set(mob ? 1.3 : 5 * rf, (mob ? 4.2 : 2.7) + (1 - P.stars) * 3, -7);
    moon.rotation.y = t * 0.1;
    stars.visible = moon.visible;
    stars.material.uniforms.uOpacity.value = P.stars;
    stars.material.uniforms.uTime.value = t;

    sparkles.material.uniforms.uOpacity.value = P.sparkle * 0.9;
    sparkles.material.uniforms.uTime.value = t;
    sparkles.material.uniforms.uLift.value = s.scroll * 1.2;

    // ——— clouds ———
    flightDrift += dt * (0.3 + Math.max(P.speed, cPose.speed) * 9);
    clouds.visible = cloudOutline.visible = true;
    for (let i = 0; i < CLOUDS; i++) {
      const c = cloudData[i];
      const d = camera.position.z - c.z;
      const hv = 0.34 * d * 1.4;
      const hw = hv * Math.max(aspect, 0.8) * 1.1;
      const yoff = s.scroll * d * 0.2;
      let cy = ((c.y * hv + yoff + hv) % (2 * hv) + 2 * hv) % (2 * hv) - hv;
      let cx = ((c.x * hw - flightDrift * c.drift * 4 - t * c.drift + hw) % (2 * hw) + 2 * hw) % (2 * hw) - hw;
      if (c.near) cx = Math.sign(cx || 1) * Math.max(Math.abs(cx), hw * 0.75);
      dummy.position.set(cx, cy, c.z);
      dummy.rotation.set(0, c.ry, 0);
      dummy.scale.setScalar(c.s);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;

    // ——— speed lines ———
    const gameRush = game.state === 'play' ? game.blend : 0;
    const rush = Math.max(P.speed * env, gameRush * 0.8);
    lineMat.opacity = rush * 0.75;
    lines.visible = lineMat.opacity > 0.01;
    if (lines.visible) {
      lineData.forEach((l, i) => {
        l.x -= dt * l.v * rush;
        if (l.x < -16) {
          l.x = 16;
          l.y = rand(-5, 5);
        }
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(l.len, 0.028, 1);
        dummy.updateMatrix();
        lines.setMatrixAt(i, dummy.matrix);
      });
      lines.instanceMatrix.needsUpdate = true;
    }

    // ——— camera ———
    const [cx, cy, cz] = P.cam;
    camera.position.x = lerp(camera.position.x, cx + s.mouse.x * 0.45, 1 - Math.exp(-3 * dt));
    camera.position.y = lerp(camera.position.y, cy + s.mouse.y * 0.25, 1 - Math.exp(-3 * dt));
    camera.position.z = cz + (mob ? 3 : 0);
    camLook.set(0, cy * 0.4, 0);
    camera.lookAt(camLook);

    renderer.render(scene, camera);
    return P;
  }

  return { update, resize, pick, startDrag, moveDrag, endDrag, fling, game, cinna, friends, renderer, camera };
}
