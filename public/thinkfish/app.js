// LiveArt in the browser: the 1998 engine (engine/liveart.wasm) renders every frame
// through its own EPS canvas; this file is only the window around it.
import createEngine from './engine/liveart.mjs';
import { parseEPS, drawEPS } from './eps.js';

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const ctx = stage.getContext('2d');
const statusEl = $('#status');

const view = { style: 0, xRot: 0.15, yRot: 0.5, distance: 18, spinning: false };
let E = null;          // the Emscripten module
let styleNames = [];
let lastEPS = null;    // text of the most recent stage frame, for Export EPS
let hasModel = false;  // the engine has nothing to render until a model loads

function setStatus(text) { statusEl.textContent = text; }

function store(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }

// --- engine calls ---------------------------------------------------------


// Render one frame at (w, h) EPS points and return the EPS text.
function renderEPS(w, h, style = view.style) {
  E._tf_set_style(style);
  E._tf_set_rotation(view.xRot, view.yRot);
  E._tf_set_distance(view.distance);
  if (!E._tf_render(w, h)) throw new Error('engine render failed');
  return E.FS.readFile('/frame.eps', { encoding: 'utf8' });
}

// Pull the camera in or out until the model fills about `fill` of the frame.
function fitToFrame(fill = 0.72) {
  for (let i = 0; i < 6; i++) {
    const eps = parseEPS(renderEPS(400, 400));
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

// --- drawing -----------------------------------------------------------------

function sizeCanvas(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  return { w, h, dpr };
}

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
  const { w, h, dpr } = sizeCanvas(stage);
  const t0 = performance.now();
  lastEPS = renderEPS(w, h);
  const eps = parseEPS(lastEPS);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawEPS(ctx, eps, w, h, '#ffffff');
  const ms = performance.now() - t0;
  $('#stat-prims').textContent = `${eps.ops.length} prims`;
  $('#stat-ms').textContent = `${ms.toFixed(0)} ms`;
  scheduleSwatches();
}

// --- LiveStyles palette ---------------------------------------------------------

let swatchTimer = 0;
function scheduleSwatches() {
  clearTimeout(swatchTimer);
  swatchTimer = setTimeout(drawSwatches, view.spinning ? 1200 : 250);
}

function drawSwatches() {
  document.querySelectorAll('.swatch canvas').forEach((c, i) => {
    const { w, h, dpr } = sizeCanvas(c);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEPS(g, parseEPS(renderEPS(w * 2, h * 2, i)), w, h, '#ffffff');
  });
}

function buildStyles() {
  const count = E._tf_style_count();
  styleNames = Array.from({ length: count }, (_, i) => E.UTF8ToString(E._tf_style_name(i)));
  const swatches = $('#swatches');
  const menu = $('#style-menu');
  styleNames.forEach((name, i) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.setAttribute('role', 'option');
    b.innerHTML = `<canvas width="56" height="56"></canvas><span>${name}</span>`;
    b.addEventListener('click', () => selectStyle(i));
    swatches.append(b);

    const m = document.createElement('button');
    m.setAttribute('role', 'menuitemradio');
    m.innerHTML = `${name}<span>${i + 1}</span>`;
    m.addEventListener('click', () => { closeMenus(); selectStyle(i); });
    menu.append(m);
  });
}

function selectStyle(i) {
  view.style = i;
  store('liveart.style', String(i));
  syncURL();
  document.querySelectorAll('.swatch').forEach((b, j) => b.setAttribute('aria-selected', j === i));
  document.querySelectorAll('#style-menu button').forEach((b, j) => b.setAttribute('aria-checked', j === i));
  setStatus(`LiveStyle: ${styleNames[i]}`);
  requestDraw();
}

// --- stage interaction: DUIPreview's mouse model -----------------------------------
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

// --- models -----------------------------------------------------------------------
// .x goes to the engine from memory; .3ds / .dxf loaders read a path, so those are
// written into Emscripten's in-memory filesystem first.

let library = [];
let currentModel = null; // library id, or null for a user's own file

function loadAny(bytes, filename) {
  const ext = (/\.[^.]+$/.exec(filename) || [''])[0].toLowerCase();
  let ok;
  if (ext === '.x') {
    const ptr = E._malloc(bytes.length);
    E.HEAPU8.set(bytes, ptr);
    ok = !!E._tf_load_x(ptr, bytes.length);
    E._free(ptr);
  } else if (ext === '.3ds' || ext === '.dxf') {
    const path = `/model${ext}`;
    E.FS.writeFile(path, bytes);
    ok = !!E.ccall('tf_load_file', 'number', ['string'], [path]);
  } else {
    return false;
  }
  if (ok) hasModel = true;
  return ok;
}

function openBytes(bytes, filename, name, id = null) {
  setStatus(`Loading ${name}…`);
  if (!loadAny(bytes, filename)) { setStatus(`Could not load ${name} — the engine rejected it.`); return; }
  currentModel = id;
  $('#doc-name').textContent = name;
  document.title = `LiveArt — ${name}`;
  document.querySelectorAll('#models .swatch').forEach((b) => b.setAttribute('aria-selected', b.dataset.id === id));
  view.xRot = 0.15; view.yRot = 0.5;
  fitToFrame();
  setStatus(`Opened ${name}`);
  syncURL();
  requestDraw();
}

async function openLibraryModel(id) {
  const m = library.find((x) => x.id === id) || library[0];
  const res = await fetch(`models/${m.file}`);
  if (!res.ok) { setStatus(`Could not fetch ${m.name}`); return; }
  openBytes(new Uint8Array(await res.arrayBuffer()), m.file, m.name, m.id);
}

async function buildLibrary() {
  library = (await (await fetch('models/index.json')).json()).models;
  const list = $('#models');
  for (const m of library) {
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
  openBytes(new Uint8Array(await f.arrayBuffer()), f.name, f.name.replace(/\.[^.]+$/, ''));
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

// --- palette tabs and shareable URLs ------------------------------------------------

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

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function syncURL() {
  const q = new URLSearchParams();
  if (currentModel) q.set('model', currentModel);
  if (styleNames.length) q.set('style', slug(styleNames[view.style]));
  history.replaceState(null, '', `${location.pathname}?${q}`);
}

// --- export -----------------------------------------------------------------------

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function baseName() { return `${$('#doc-name').textContent} - ${styleNames[view.style]}`; }

function exportEPS() {
  download(new Blob([lastEPS + '\nshowpage\n'], { type: 'application/postscript' }), `${baseName()}.eps`);
}

function exportSVG() {
  const eps = parseEPS(lastEPS);
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
  const { w, h } = sizeCanvas(stage);
  const c = document.createElement('canvas');
  c.width = w * 3; c.height = h * 3;
  const g = c.getContext('2d');
  g.scale(3, 3);
  drawEPS(g, parseEPS(renderEPS(w, h)), w, h, '#ffffff');
  c.toBlob((b) => download(b, `${baseName()}.png`));
}

// --- menus and keys ------------------------------------------------------------------

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
  reset: () => { view.xRot = 0.15; view.yRot = 0.5; fitToFrame(); requestDraw(); },
  spin: () => { view.spinning = !view.spinning; requestDraw(); },
  about: () => $('#about').showModal(),
};
document.querySelectorAll('[data-action]').forEach((b) =>
  b.addEventListener('click', () => { closeMenus(); actions[b.dataset.action](); }));

document.addEventListener('keydown', (e) => {
  if (e.target.closest('dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); actions.open(); }
  else if (e.key === 'Home') actions.reset();
  else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); actions.spin(); }
  else if (e.key === 'Escape') closeMenus();
  else if (/^[1-9]$/.test(e.key) && +e.key <= styleNames.length) selectStyle(+e.key - 1);
});

new ResizeObserver(() => requestDraw()).observe(stage);

// --- boot -----------------------------------------------------------------------------

try {
  E = await createEngine({ locateFile: (f) => `engine/${f}` });
  buildStyles();
  await buildLibrary();
  const q = new URLSearchParams(location.search);
  const fromURL = styleNames.findIndex((n) => slug(n) === q.get('style'));
  const saved = Number(recall('liveart.style'));
  selectStyle(fromURL >= 0 ? fromURL : Number.isInteger(saved) && saved < styleNames.length ? saved : 0);
  await openLibraryModel(q.get('model') || 'businessman');
} catch (err) {
  setStatus(`Engine failed to start: ${err.message}`);
  throw err;
}
