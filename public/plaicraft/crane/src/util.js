// Small shared helpers: math + procedural canvas textures + materials.
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Deterministic pseudo-random for repeatable textures.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Grainy value-noise fill, tinted. Good for concrete / dirt / gravel.
export function noiseTexture({
  size = 512,
  base = '#8a8a8a',
  spec = 0.15,
  grain = 22,
  cells = 0,
  seed = 1,
  repeat = 1,
} = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(seed);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * grain;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  // Optional scattered stones/aggregate.
  for (let k = 0; k < cells; k++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1 + rnd() * 3;
    const shade = 60 + rnd() * 120;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

// Painted steel plate with subtle streaks — for crane structure & loads.
export function metalTexture({ size = 256, base = '#d8a419', seed = 3 } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(seed);
  for (let i = 0; i < 400; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
    ctx.beginPath();
    const x = rnd() * size;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * 10, size);
    ctx.stroke();
  }
  // rust flecks
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(120,60,20,${0.15 + rnd() * 0.25})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, rnd() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Diagonal hazard stripes for target pads.
export function hazardTexture({ size = 256, a = '#111', b = '#f2c200' } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = a;
  ctx.lineWidth = size / 8;
  for (let i = -size; i < size * 2; i += size / 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function corrugatedTexture({ size = 256, base = '#c24a3a', seed = 7 } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 8) {
    const s = 0.12 + 0.12 * Math.sin((x / size) * Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s})`;
    ctx.fillRect(x, 0, 3, size);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + 4, 0, 3, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

// Shared reusable materials factory.
export function pbr(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

// =================== Procedural PBR materials (albedo + normal + roughness) ===
// Multi-octave value-noise height field, normalized to 0..1.
function heightField(size, seed, layers) {
  const h = new Float32Array(size * size);
  for (const [g, amp] of layers) {
    const rnd = mulberry32((seed * 131 + g * 17) >>> 0);
    const gr = new Float32Array((g + 1) * (g + 1));
    for (let i = 0; i < gr.length; i++) gr[i] = rnd();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * g, y0 = Math.floor(fy) % g, ty = fy - Math.floor(fy), sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * g, x0 = Math.floor(fx) % g, tx = fx - Math.floor(fx), sx = tx * tx * (3 - 2 * tx);
        const r0 = y0 * (g + 1) + x0, r1 = r0 + (g + 1);
        const top = gr[r0] + (gr[r0 + 1] - gr[r0]) * sx;
        const bot = gr[r1] + (gr[r1 + 1] - gr[r1]) * sx;
        h[y * size + x] += (top + (bot - top) * sy) * amp;
      }
    }
  }
  let max = 1e-6;
  for (let i = 0; i < h.length; i++) if (h[i] > max) max = h[i];
  for (let i = 0; i < h.length; i++) h[i] /= max;
  return h;
}

function normalTexFromHeight(h, size, strength, repeat) {
  const c = canvas(size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const idx = (x, y) => (((y % size) + size) % size) * size + (((x % size) + size) % size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h[idx(x - 1, y)] - h[idx(x + 1, y)]) * strength;
    const dy = (h[idx(x, y - 1)] - h[idx(x, y + 1)]) * strength;
    const l = Math.hypot(dx, dy, 1), o = (y * size + x) * 4;
    d[o] = (dx / l * 0.5 + 0.5) * 255; d[o + 1] = (dy / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  return t;
}

function roughTexFromHeight(h, size, base, variation, repeat) {
  const c = canvas(size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < h.length; i++) {
    const v = clamp((base + (h[i] - 0.5) * variation) * 255, 0, 255);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  return t;
}

function hexRGB(hex) {
  if (typeof hex === 'number') return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const s = hex.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function albedoCanvas(size, baseHex, h, shade) {
  const c = canvas(size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const [r, g, b] = hexRGB(baseHex);
  for (let i = 0; i < size * size; i++) {
    const s = 1 + (h[i] - 0.5) * shade;
    d[i * 4] = clamp(r * s, 0, 255); d[i * 4 + 1] = clamp(g * s, 0, 255); d[i * 4 + 2] = clamp(b * s, 0, 255); d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

const PRESETS = {
  concrete: {
    color: '#b6b2a8', layers: [[3, 0.5], [8, 0.28], [24, 0.14], [64, 0.08]], shade: 0.4, normal: 2.2, normalScale: 0.7, rough: 0.92, roughVar: 0.18, metal: 0,
    overlay(ctx, size, seed) {
      const rnd = mulberry32(seed + 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); let x = rnd() * size, y = rnd() * size; ctx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; ctx.lineTo(x, y); } ctx.stroke(); }
      for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(40,36,30,${0.05 + rnd() * 0.08})`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, 10 + rnd() * 40, 0, 7); ctx.fill(); }
    },
  },
  dirt: {
    color: '#6f6046', layers: [[4, 0.5], [10, 0.3], [28, 0.18], [64, 0.12]], shade: 0.6, normal: 3, normalScale: 1.0, rough: 0.98, roughVar: 0.1, metal: 0,
    overlay(ctx, size, seed) { const rnd = mulberry32(seed + 9); for (let i = 0; i < 120; i++) { const s = 40 + rnd() * 70; ctx.fillStyle = `rgba(${s | 0},${s * 0.85 | 0},${s * 0.6 | 0},0.5)`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, 1 + rnd() * 3, 0, 7); ctx.fill(); } },
  },
  gravel: {
    color: '#6a6f74', layers: [[6, 0.5], [16, 0.3], [40, 0.2], [90, 0.14]], shade: 0.7, normal: 3.5, normalScale: 1.2, rough: 0.9, roughVar: 0.15, metal: 0,
    overlay(ctx, size, seed) { const rnd = mulberry32(seed + 3); for (let i = 0; i < 240; i++) { const s = 60 + rnd() * 120; ctx.fillStyle = `rgba(${s | 0},${s | 0},${s | 0},0.6)`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, 1 + rnd() * 2.6, 0, 7); ctx.fill(); } },
  },
  asphalt: {
    color: '#4b4f55', layers: [[8, 0.5], [24, 0.3], [64, 0.2]], shade: 0.5, normal: 2.5, normalScale: 0.9, rough: 0.85, roughVar: 0.14, metal: 0.05,
    overlay(ctx, size, seed) { const rnd = mulberry32(seed + 7); for (let i = 0; i < 200; i++) { const s = 70 + rnd() * 60; ctx.fillStyle = `rgba(${s | 0},${s | 0},${s | 0},0.35)`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, 0.8 + rnd() * 1.6, 0, 7); ctx.fill(); } },
  },
  steel: {
    color: '#d8a419', layers: [[2, 0.5], [8, 0.3], [40, 0.2]], shade: 0.25, normal: 1.2, normalScale: 0.35, rough: 0.5, roughVar: 0.22, metal: 0.65,
    overlay(ctx, size, seed) {
      const rnd = mulberry32(seed + 11);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 200; i++) { ctx.beginPath(); const x = rnd() * size; ctx.moveTo(x, 0); ctx.lineTo(x + (rnd() - 0.5) * 8, size); ctx.stroke(); }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(120,60,25,${0.1 + rnd() * 0.2})`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, 1 + rnd() * 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let x = 16; x < size; x += 48) for (let y = 16; y < size; y += 48) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
    },
  },
  container: {
    color: '#c0392b', layers: [[8, 0.4], [40, 0.2]], shade: 0.2, normal: 2.5, normalScale: 0.8, rough: 0.66, roughVar: 0.2, metal: 0.35,
    heightMod(h, size) { const ribs = 18; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = clamp(0.35 + 0.4 * (0.5 + 0.5 * Math.sin(x / size * ribs * 6.283)) + (h[y * size + x] - 0.5) * 0.25, 0, 1); },
    overlay(ctx, size, seed) {
      const rnd = mulberry32(seed + 13);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, size, 10); ctx.fillRect(0, size - 10, size, 10);
      for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(90,50,25,${0.1 + rnd() * 0.25})`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, 2 + rnd() * 6, 0, 7); ctx.fill(); }
    },
  },
  hull: {
    color: '#33414d', layers: [[3, 0.5], [10, 0.3], [40, 0.2]], shade: 0.3, normal: 1.8, normalScale: 0.5, rough: 0.62, roughVar: 0.18, metal: 0.4,
    heightMod(h, size) { for (let y = 0; y < size; y++) if (y % 42 < 2) for (let x = 0; x < size; x++) h[y * size + x] *= 0.4; for (let x = 0; x < size; x++) if (x % 64 < 2) for (let y = 0; y < size; y++) h[y * size + x] *= 0.5; },
    overlay(ctx, size, seed) { const rnd = mulberry32(seed + 17); for (let i = 0; i < 24; i++) { ctx.fillStyle = `rgba(110,60,30,${0.08 + rnd() * 0.18})`; const x = rnd() * size; ctx.fillRect(x, rnd() * size * 0.5, 2 + rnd() * 3, 20 + rnd() * 60); } },
  },
  wood: {
    color: '#6a5232', layers: [[4, 0.4], [30, 0.3]], shade: 0.35, normal: 1.6, normalScale: 0.6, rough: 0.9, roughVar: 0.12, metal: 0,
    heightMod(h, size) { for (let y = 0; y < size; y++) if (y % 32 < 2) for (let x = 0; x < size; x++) h[y * size + x] *= 0.5; },
    overlay(ctx, size, seed) { const rnd = mulberry32(seed + 19); ctx.strokeStyle = 'rgba(40,28,14,0.2)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); const y = rnd() * size; ctx.moveTo(0, y); ctx.bezierCurveTo(size * 0.3, y + (rnd() - 0.5) * 8, size * 0.6, y + (rnd() - 0.5) * 8, size, y + (rnd() - 0.5) * 6); ctx.stroke(); } },
  },
  panel: { color: '#9aa1a7', layers: [[3, 0.5], [12, 0.3], [48, 0.2]], shade: 0.3, normal: 1.6, normalScale: 0.5, rough: 0.85, roughVar: 0.14, metal: 0.05 },
};

// A textured MeshStandardMaterial (map + normalMap + roughnessMap) for a kind.
export function surface(kind, { color, repeat = 4, seed = 1 } = {}) {
  const size = 256, P = PRESETS[kind] || PRESETS.concrete;
  const h = heightField(size, seed, P.layers);
  if (P.heightMod) P.heightMod(h, size);
  const { c, ctx } = albedoCanvas(size, color || P.color, h, P.shade);
  if (P.overlay) P.overlay(ctx, size, seed, h);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map, normalMap: normalTexFromHeight(h, size, P.normal, repeat),
    roughnessMap: roughTexFromHeight(h, size, P.rough, P.roughVar, repeat),
    metalness: P.metal, roughness: 1,
  });
  mat.normalScale.set(P.normalScale, P.normalScale);
  return mat;
}

// Reflective, gently rippled water (relies on the scene env map for sky reflection).
export function waterMaterial() {
  const size = 256, h = heightField(size, 42, [[8, 0.4], [20, 0.3], [48, 0.3]]);
  const nrm = normalTexFromHeight(h, size, 2.0, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0x18384e, roughness: 0.1, metalness: 0.55, normalMap: nrm });
  mat.normalScale.set(0.32, 0.32);
  mat.userData.animNormal = nrm;
  return mat;
}
