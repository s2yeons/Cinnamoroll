import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, outlineMaterial } from './materials.js';

const lerp = (a, b, t) => a + (b - a) * t;

// ————————————————————————————————— geometry helpers
export function cloudGeometry(puffs) {
  const parts = puffs.map(([x, y, z, r]) => {
    const g = new THREE.SphereGeometry(r, 28, 20);
    g.translate(x, y, z);
    return g;
  });
  let g = mergeGeometries(parts);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    if (y < -0.25) y = -0.25 + (y + 0.25) * 0.35; // flat cloud belly
    p.setY(i, y * 0.85);
  }
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

export const PUFFS = [
  [0, 0.1, 0, 1], [0.95, -0.1, 0.1, 0.78], [-0.95, -0.12, 0, 0.74], [0.42, 0.55, -0.1, 0.66],
  [-0.45, 0.45, 0.12, 0.62], [1.7, -0.3, 0, 0.5], [-1.72, -0.3, 0.05, 0.46],
];

export function spiralRoll({ plate: withPlate = true, dough: doughColor = '#f5c58c', doughShadow = '#c27a45', lineColor = '#9c5d34' } = {}) {
  const g = new THREE.Group();
  const dough = toonMaterial({ color: doughColor, shadow: doughShadow });
  const icing = toonMaterial({ color: '#ffffff', shadow: '#f1e3d6' });
  const line = outlineMaterial({ color: lineColor });
  const plateMat = toonMaterial({ color: '#ffffff', shadow: '#cfe1f7' });
  const plateLine = outlineMaterial({ color: '#6ea4de' });

  const pts = [];
  const turns = 3;
  for (let i = 0; i <= 240; i++) {
    const t = i / 240;
    const a = t * turns * Math.PI * 2;
    const r = 0.22 + t * turns * 0.43;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 600, 0.205, 16);
  const roll = new THREE.Mesh(tube, dough);
  roll.add(new THREE.Mesh(tube, line));
  roll.scale.set(1, 1.5, 1);
  g.add(roll);
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 14), dough);
  endCap.position.copy(pts[pts.length - 1]).multiply(roll.scale);
  endCap.scale.set(1, 1.5, 1);
  endCap.add(new THREE.Mesh(endCap.geometry, line));
  g.add(endCap);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), dough);
  core.scale.set(1, 1.4, 1);
  g.add(core);

  // icing drizzle zig-zagging over the top
  const ip = [];
  for (let i = 0; i <= 8; i++) {
    const x = lerp(-0.95, 0.95, i / 8);
    const zr = Math.sqrt(Math.max(0, 1.45 * 1.45 - x * x)) * 0.62;
    ip.push(new THREE.Vector3(x, 0.34, i % 2 ? zr : -zr));
  }
  const iceGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ip, false, 'catmullrom', 0.35), 300, 0.045, 10);
  const ice = new THREE.Mesh(iceGeo, icing);
  ice.add(new THREE.Mesh(iceGeo, line));
  g.add(ice);

  if (!withPlate) return g;
  const plateGeo = new THREE.CylinderGeometry(1.85, 1.6, 0.12, 64);
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.add(new THREE.Mesh(plateGeo, plateLine));
  plate.position.y = -0.37;
  g.add(plate);
  return g;
}
