// LiveArt in the browser. The 1998 engine (engine/liveart.wasm) does all the rendering:
// the stage replays its primitives with WebGL (gl.js), exactly as its OpenGL canvas
// drew them, and EPS/SVG export goes through its own EPS writer (eps.js).
import createEngine from './engine/liveart.mjs';
import { parseEPS } from './eps.js';
import { createRenderer } from './gl.js';

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const statusEl = $('#status');

const view = { style: 'original', xRot: 0.15, yRot: 0.5, distance: 18, spinning: false, home: [0.15, 0.5] };
let E = null;             // the Emscripten module
let gl = null;            // stage renderer
let thumbs = null;        // offscreen renderer for palette swatches
let hasModel = false;     // nothing to render until a model loads
let hasOriginal = false;  // the loaded model is a scene with its own LiveStyles
let library = [];
let linkedStyle = null;   // a ?style= from the address, honoured over the remembered style
let currentModel = null;

// The palette: a scene's own styles, the LiveArt98 set, and the editor's default.
// kind: 'original' | 'file' (a .liv, loaded on first use) | 'preset' (built in C++).
const styles = new Map();

function setStatus(text) { statusEl.textContent = text; }
function store(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- engine calls -----------------------------------------------------------------

async function ensureStyle(id) {
  const s = styles.get(id);
  if (!s || s.kind !== 'file' || s.index !== undefined) return s;
  if (!s.loading) {
    s.loading = (async () => {
      const bytes = new Uint8Array(await (await fetch(`styles/${s.file.split('/').map(encodeURIComponent).join('/')}`)).arrayBuffer());
      E.FS.mkdirTree('/styles');
      const path = `/styles/${s.id}.liv`;
      E.FS.writeFile(path, bytes);
      s.index = E.ccall('tf_add_style_file', 'number', ['string'], [path]);
      if (s.index < 0) s.broken = true;
    })();
  }
  await s.loading;
  return s;
}

// Put the engine in `id`'s style (it must already be loaded) and the current view.
function applyView(id = view.style) {
  const s = styles.get(id);
  if (!s || s.broken) E._tf_set_style(0);
  else if (s.kind === 'original') { if (hasOriginal) E._tf_use_original_styles(); else E._tf_set_style(0); }
  else if (s.kind === 'file') { if (s.index >= 0) E._tf_set_file_style(s.index); else E._tf_set_style(0); }
  else E._tf_set_style(s.index);
  E._tf_set_rotation(view.xRot, view.yRot);
  E._tf_set_distance(view.distance);
}

function renderEPS(w, h, id = view.style) {
  applyView(id);
  if (!E._tf_render(w, h)) throw new Error('engine render failed');
  return E.FS.readFile('/frame.eps', { encoding: 'utf8' });
}

// Pull the camera in or out until the model fills about `fill` of the frame. Measured
// with the untextured default style, since the EPS writer skips textured primitives.
function fitToFrame(fill = 0.72) {
  for (let i = 0; i < 6; i++) {
    const eps = parseEPS(renderEPS(400, 400, 'editor-default'));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const op of eps.ops) for (let j = 0; j < op.path.length; j += 2) {
      const x = op.path[j], y = op.path[j + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const extent = Math.max(maxX - minX, maxY - minY) / 400;
    if (!Number.isFinite(extent) || extent <= 0) return;
    const ratio = extent / fill;
    if (Math.abs(ratio - 1) < 0.04) return;
    view.distance *= ratio;
  }
}

// --- drawing -------------------------------------------------------------------------

function cssSize(el) {
  const r = el.getBoundingClientRect();
  return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
}
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

let pending = false;
function requestDraw() {
  if (pending || !E || !hasModel) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    drawStage();
    if (view.spinning) { view.yRot += 0.02; requestDraw(); }
  });
}

function drawStage() {
  const { w, h } = cssSize(stage);
  const t0 = performance.now();
  applyView();
  const tris = gl.draw(E, w, h, dpr());
  $('#stat-prims').textContent = `${tris} tris`;
  $('#stat-ms').textContent = `${(performance.now() - t0).toFixed(0)} ms`;
  scheduleSwatches();
}

// --- LiveStyles palette ----------------------------------------------------------------

let swatchTimer = 0, swatchRun = 0;
function scheduleSwatches() {
  clearTimeout(swatchTimer);
  swatchTimer = setTimeout(drawSwatches, view.spinning ? 1500 : 300);
}

// One swatch per frame, so the palette fills in without stalling the stage.
async function drawSwatches() {
  if ($('#swatches').hidden) return;
  const run = ++swatchRun;
  for (const b of document.querySelectorAll('#swatches .swatch:not([hidden])')) {
    if (run !== swatchRun) return; // a newer pass started
    const s = await ensureStyle(b.dataset.style);
    if (run !== swatchRun) return;
    const c = b.querySelector('canvas');
    const { w, h } = cssSize(c);
    c.width = w * dpr(); c.height = h * dpr();
    applyView(s.id);
    thumbs.draw(E, w * 2, h * 2, 1);
    c.getContext('2d').drawImage(thumbs.canvas, 0, 0, c.width, c.height);
    await new Promise(requestAnimationFrame);
  }
  applyView(); // leave the engine in the stage's style
}

async function buildStyles() {
  const list = (await (await fetch('styles/index.json')).json()).styles;
  styles.set('original', { id: 'original', name: 'Original', kind: 'original' });
  for (const s of list) styles.set(s.id, { ...s, kind: 'file' });
  styles.set('editor-default', { id: 'editor-default', name: 'Editor Default', kind: 'preset', index: 0 });

  const swatches = $('#swatches');
  const menu = $('#style-menu');
  let group = null;
  for (const s of styles.values()) {
    if (s.group && s.group !== group) {
      group = s.group;
      swatches.append(groupHeader(group));
      const h = document.createElement('div');
      h.className = 'menu-group';
      h.textContent = group;
      menu.append(h);
    }
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.style = s.id;
    b.setAttribute('role', 'option');
    b.innerHTML = `<canvas></canvas><span>${s.name}</span>`;
    b.addEventListener('click', () => selectStyle(s.id));
    swatches.append(b);

    const m = document.createElement('button');
    m.dataset.style = s.id;
    m.setAttribute('role', 'menuitemradio');
    m.textContent = s.name;
    m.addEventListener('click', () => { closeMenus(); selectStyle(s.id); });
    menu.append(m);
  }
  showOriginal(false);
}

function groupHeader(text) {
  const h = document.createElement('div');
  h.className = 'palette-group';
  h.textContent = text;
  return h;
}

function showOriginal(on) {
  hasOriginal = on;
  document.querySelectorAll('[data-style="original"]').forEach((el) => { el.hidden = !on; });
}

async function selectStyle(id) {
  if (!styles.has(id) && styles.has(`beta-${id}`)) id = `beta-${id}`; // links from before the 1.2 set
  if (!styles.has(id) || (id === 'original' && !hasOriginal)) id = hasOriginal ? 'original' : 'toon';
  view.style = id;
  if (id !== 'original') store('liveart.style', id);
  syncURL();
  document.querySelectorAll('[data-style]').forEach((el) => {
    el.setAttribute(el.getAttribute('role') === 'option' ? 'aria-selected' : 'aria-checked', el.dataset.style === id);
  });
  const s = await ensureStyle(id);
  setStatus(s.broken ? `LiveStyle ${s.name} could not be loaded` : `LiveStyle: ${s.name}`);
  requestDraw();
}

// --- stage interaction: DUIPreview's mouse model ----------------------------------------
// left-drag rotates, right-drag (or the wheel) zooms by 0.975 per pixel.

let drag = null;
stage.addEventListener('contextmenu', (e) => e.preventDefault());
stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, zoom: e.button === 2 || e.shiftKey };
  stage.classList.add('dragging');
  view.spinning = false;
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.zoom) view.distance *= Math.pow(0.975, -dy);
  else { view.yRot += dx / 100; view.xRot += dy / 100; }
  requestDraw();
});
const endDrag = () => { drag = null; stage.classList.remove('dragging'); };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.distance *= Math.pow(0.975, e.deltaY / 20);
  requestDraw();
}, { passive: false });

// --- models ----------------------------------------------------------------------------
// .x goes to the engine from memory; .3ds / .dxf / .pcs readers take a path, so those are
// written into Emscripten's in-memory filesystem first.

function loadAny(bytes, filename) {
  const ext = (/\.[^.]+$/.exec(filename) || [''])[0].toLowerCase();
  let ok;
  if (ext === '.x') {
    const ptr = E._malloc(bytes.length);
    E.HEAPU8.set(bytes, ptr);
    ok = !!E._tf_load_x(ptr, bytes.length);
    E._free(ptr);
  } else if (['.3ds', '.dxf', '.pcs', '.vpe'].includes(ext)) {
    // A .vpe's decryption key is derived from the number in its name, so keep the name.
    const path = ext === '.vpe' ? `/${filename.split('/').pop()}` : `/model${ext}`;
    E.FS.writeFile(path, bytes);
    ok = !!E.ccall('tf_load_file', 'number', ['string'], [path]);
  } else {
    return false;
  }
  if (ok) hasModel = true;
  return ok;
}

async function openBytes(bytes, filename, name, id = null, rot = [0.15, 0.5]) {
  setStatus(`Loading ${name}…`);
  if (!loadAny(bytes, filename)) { setStatus(`Could not load ${name} — the engine rejected it.`); return; }
  currentModel = id;
  $('#doc-name').textContent = name;
  document.title = `LiveArt — ${name}`;
  document.querySelectorAll('#models .swatch').forEach((b) => b.setAttribute('aria-selected', b.dataset.id === id));
  view.home = rot;
  [view.xRot, view.yRot] = rot;
  const scene = !!E._tf_has_original_styles();
  showOriginal(scene);
  fitToFrame();
  if (scene && !linkedStyle) await selectStyle('original'); // a scene opens in its own LiveStyles
  else if (linkedStyle) await selectStyle(linkedStyle);
  else if (view.style === 'original') await selectStyle(recall('liveart.style') || 'toon');
  linkedStyle = null;
  setStatus(`Opened ${name}${scene ? ' — its original LiveStyles' : ''}`);
  syncURL();
  requestDraw();
}

async function openLibraryModel(id) {
  const m = library.find((x) => x.id === id) || library[0];
  const res = await fetch(`models/${m.file}`);
  if (!res.ok) { setStatus(`Could not fetch ${m.name}`); return; }
  await openBytes(new Uint8Array(await res.arrayBuffer()), m.file, m.name, m.id, m.rot);
}

async function buildLibrary() {
  library = (await (await fetch('models/index.json')).json()).models;
  const list = $('#models');
  let group = null;
  for (const m of library) {
    if (m.group && m.group !== group) { group = m.group; list.append(groupHeader(group)); }
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.id = m.id;
    b.setAttribute('role', 'option');
    b.innerHTML = `<img src="models/thumbs/${m.id}.png" alt="" loading="lazy"><span>${m.name}</span>`;
    b.addEventListener('click', () => openLibraryModel(m.id));
    list.append(b);
  }
}

async function openUserFile(f) {
  if (!f) return;
  await openBytes(new Uint8Array(await f.arrayBuffer()), f.name, f.name.replace(/\.[^.]+$/, ''));
}

$('#file').addEventListener('change', async (e) => { await openUserFile(e.target.files[0]); e.target.value = ''; });

const frame = $('.stage-frame');
frame.addEventListener('dragover', (e) => { e.preventDefault(); frame.classList.add('drop'); });
frame.addEventListener('dragleave', () => frame.classList.remove('drop'));
frame.addEventListener('drop', async (e) => {
  e.preventDefault();
  frame.classList.remove('drop');
  await openUserFile(e.dataTransfer.files[0]);
});

// --- palette tabs and shareable URLs -------------------------------------------------------

function showTab(which) {
  const models = which === 'models';
  $('#tab-models').setAttribute('aria-selected', models);
  $('#tab-styles').setAttribute('aria-selected', !models);
  $('#models').hidden = !models;
  $('#swatches').hidden = models;
  if (!models) scheduleSwatches();
}
$('#tab-styles').addEventListener('click', () => showTab('styles'));
$('#tab-models').addEventListener('click', () => showTab('models'));

function syncURL() {
  const q = new URLSearchParams();
  if (currentModel) q.set('model', currentModel);
  q.set('style', view.style);
  history.replaceState(null, '', `${location.pathname}?${q}`);
}

// --- export ---------------------------------------------------------------------------------

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function baseName() { return `${$('#doc-name').textContent} - ${styles.get(view.style).name}`; }

// EPS and SVG are the engine's vector output, which (as in 1998) leaves out textures.
function exportEPS() {
  const { w, h } = cssSize(stage);
  download(new Blob([renderEPS(w, h) + '\nshowpage\n'], { type: 'application/postscript' }), `${baseName()}.eps`);
}

function exportSVG() {
  const { w, h } = cssSize(stage);
  const eps = parseEPS(renderEPS(w, h));
  const parts = eps.ops.map((op) => {
    const p = op.path;
    let d = `M${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    for (let i = 2; i < p.length; i += 2) d += `L${p[i].toFixed(2)},${p[i + 1].toFixed(2)}`;
    return op.fill
      ? `<path d="${d}Z" fill="${op.color}" stroke="${op.color}" stroke-width="0.6"/>`
      : `<path d="${d}" fill="none" stroke="${op.color}" stroke-width="${op.lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${eps.width} ${eps.height}">\n` +
    `<rect width="100%" height="100%" fill="#fff"/>\n${parts.join('\n')}\n</svg>\n`;
  download(new Blob([svg], { type: 'image/svg+xml' }), `${baseName()}.svg`);
}

function exportPNG() {
  const { w, h } = cssSize(stage);
  applyView();
  thumbs.draw(E, w, h, 3);
  thumbs.canvas.toBlob((b) => download(b, `${baseName()}.png`));
}

// --- menus and keys ---------------------------------------------------------------------------

function closeMenus() { document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open')); }
document.querySelectorAll('.menu').forEach((menu) => {
  const title = menu.querySelector('.menu-title');
  title.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = menu.classList.contains('open');
    closeMenus();
    if (!wasOpen) menu.classList.add('open');
  });
  title.addEventListener('mouseenter', () => {
    if (document.querySelector('.menu.open') && !menu.classList.contains('open')) { closeMenus(); menu.classList.add('open'); }
  });
});
document.addEventListener('click', closeMenus);

const actions = {
  open: () => $('#file').click(),
  models: () => showTab('models'),
  eps: exportEPS, svg: exportSVG, png: exportPNG,
  reset: () => { [view.xRot, view.yRot] = view.home; fitToFrame(); requestDraw(); },
  spin: () => { view.spinning = !view.spinning; requestDraw(); },
  about: () => $('#about').showModal(),
};
document.querySelectorAll('[data-action]').forEach((b) =>
  b.addEventListener('click', () => { closeMenus(); actions[b.dataset.action](); }));

// Arrow keys step through the palette, as a listbox would.
document.addEventListener('keydown', (e) => {
  if (e.target.closest('dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); actions.open(); }
  else if (e.key === 'Home') actions.reset();
  else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); actions.spin(); }
  else if (e.key === 'Escape') closeMenus();
  else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target === document.body) {
    e.preventDefault();
    const ids = [...document.querySelectorAll('#swatches .swatch:not([hidden])')].map((b) => b.dataset.style);
    const i = ids.indexOf(view.style) + (e.key === 'ArrowDown' ? 1 : -1);
    if (i >= 0 && i < ids.length) {
      selectStyle(ids[i]);
      document.querySelector(`#swatches [data-style="${ids[i]}"]`).scrollIntoView({ block: 'nearest' });
    }
  }
});

new ResizeObserver(() => requestDraw()).observe(stage);

// --- boot ------------------------------------------------------------------------------------

try {
  E = await createEngine({ locateFile: (f) => `engine/${f}` });
  gl = createRenderer(stage);
  thumbs = createRenderer(document.createElement('canvas'));
  if (!gl || !thumbs) throw new Error('this browser has no WebGL 2');
  await Promise.all([buildStyles(), buildLibrary()]);
  const q = new URLSearchParams(location.search);
  if (q.get('style') && q.get('style') !== 'original') linkedStyle = q.get('style');
  await openLibraryModel(q.get('model') || 'girl');
} catch (err) {
  setStatus(`Engine failed to start: ${err.message}`);
  throw err;
}
