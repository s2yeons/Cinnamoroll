import * as THREE from 'three';

// Uniforms shared by every toon / outline material in the scene.
// The choreography writes into these once per frame.
export const shared = {
  uLight: { value: new THREE.Vector3(0.45, 0.85, 0.7).normalize() },
  uAmbient: { value: new THREE.Color('#ffffff') },
  uFog: { value: new THREE.Color('#e6f4ff') },
  uFogRange: { value: new THREE.Vector2(16, 44) },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uOutline: { value: 2.6 },
};

// Optional per-mesh bend: vertices below the pivot (y < 0) are pushed
// sideways by k². Used for ears so they whip and curl while flapping.
const bendGLSL = /* glsl */ `
  uniform vec2 uBend;
  vec3 bendIt(vec3 p) {
    float k = max(-p.y, 0.0);
    p.x += uBend.x * k * k;
    p.z += uBend.y * k * k;
    return p;
  }
`;

const instancing = /* glsl */ `
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif
`;

export function bendUniform() {
  return { value: new THREE.Vector2() };
}

export function toonMaterial({ color = '#ffffff', shadow = '#d9e7f8', bend, ambient = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uShadow: { value: new THREE.Color(shadow) },
      uBend: bend || bendUniform(),
      uLight: shared.uLight,
      uAmbient: ambient ? shared.uAmbient : { value: new THREE.Color('#ffffff') },
      uFog: shared.uFog,
      uFogRange: shared.uFogRange,
    },
    vertexShader: /* glsl */ `
      ${bendGLSL}
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        ${instancing}
        vec3 p = bendIt(position);
        vec4 mv = modelViewMatrix * im * vec4(p, 1.0);
        vN = normalize(normalMatrix * (mat3(im) * normal));
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uShadow, uLight, uAmbient, uFog;
      uniform vec2 uFogRange;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        vec3 L = normalize((viewMatrix * vec4(uLight, 0.0)).xyz);
        float d = dot(n, L);
        // two-tone cel shading with a soft, painterly terminator
        float lit = smoothstep(-0.12, 0.14, d);
        vec3 c = mix(uShadow, uColor, lit);
        // a whisper of bounce light from below
        c = mix(c, uColor, 0.18 * smoothstep(0.2, 1.0, -n.y));
        // soft rim to separate from the sky
        float fr = 1.0 - max(dot(n, v), 0.0);
        c += 0.10 * smoothstep(0.55, 1.0, fr) * lit;
        c *= uAmbient;
        float f = smoothstep(uFogRange.x, uFogRange.y, length(vV));
        c = mix(c, uFog, f);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Inverted-hull outline with constant *pixel* width, like a marker line.
export function outlineMaterial({ color = '#6ea4de', bend, width = 1 } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uBend: bend || bendUniform(),
      uWidthMul: { value: width },
      uResolution: shared.uResolution,
      uOutline: shared.uOutline,
      uAmbient: shared.uAmbient,
      uFog: shared.uFog,
      uFogRange: shared.uFogRange,
    },
    vertexShader: /* glsl */ `
      ${bendGLSL}
      uniform vec2 uResolution;
      uniform float uOutline, uWidthMul;
      varying float vDepth;
      void main() {
        ${instancing}
        vec3 p = bendIt(position);
        vec4 mv = modelViewMatrix * im * vec4(p, 1.0);
        vec3 n = normalize(normalMatrix * (mat3(im) * normal));
        vec4 clip = projectionMatrix * mv;
        vec2 dir = (projectionMatrix * vec4(n, 0.0)).xy * uResolution;
        dir = normalize(dir + 1e-5);
        clip.xy += dir * (uOutline * uWidthMul * 2.0) / uResolution * clip.w;
        vDepth = -mv.z;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uAmbient, uFog;
      uniform vec2 uFogRange;
      varying float vDepth;
      void main() {
        vec3 c = uColor * mix(vec3(1.0), uAmbient, 0.6);
        c = mix(c, uFog, smoothstep(uFogRange.x, uFogRange.y, vDepth));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function flatMaterial(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}
