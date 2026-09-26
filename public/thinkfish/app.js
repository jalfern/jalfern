// LiveArt 98 SketchPad in the browser. The 1998 engine (engine/liveart.wasm) does all the
// rendering -- the page replays its primitives with WebGL (gl.js) as its OpenGL canvas drew
// them -- and this file is SketchPad around it: the pinned page, the LiveArt Toolbar and the
// Model Catalog, rebuilt from LiveArt SketchPad.exe and LiveArt.dll (v1.2, Aug 1998).
import createEngine from './engine/liveart.mjs';
import { parseEPS } from './eps.js';
import { createRenderer } from './gl.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const stage = $('#stage');
const statusEl = $('#status');

let E = null;          // the Emscripten module
let pageGL = null;     // draws the page
let previewGL = null;  // draws the catalog's preview (engine studio 1)
let offGL = null;      // offscreen, for exports
let library = [];      // our sample scenes and models (models/index.json)
let catalog = null;    // the 1998 model catalog (catalog/index.json), loaded on first use

// --- the page ----------------------------------------------------------------------------
// A catalog (.vpe) model is placed as LiveArt 98 placed it (Studio::UseCatalogView): its axes
// are `orient`, turned about the screen by the toolbar and the mouse, `pose` its nudge and
// size. Anything else (a 1.x scene, a .x/.3ds/.dxf file) keeps the editor's orbit camera.
const page = {
  w: 400, h: 400, hasModel: false, name: 'Untitled', id: null, hasOriginal: false,
  style: 'toon', lineScale: 0.5, lineColor: null, fillColor: null, background: null,
  light: null, lightOn: true, catalog: false,
  orient: null, pose: { x: 0, y: 0, size: 1 },
  xRot: 0.15, yRot: 0.5, distance: 18, home: [0.15, 0.5], spinning: false,
  // A .x animation (the catalog's Motion models), played at the file's 30 ticks a second.
  anim: { length: 0, time: 0, playing: false, loop: true, last: 0 },
};
const ANIM_FPS = 30;

// LiveArt.dll FUN_10045fc0 (the Reset Model menu): SetOrientation(0, b, c), degrees.
const HOME_98 = [0, 30, 0];
const PRESETS_98 = { front: [0, 0, 0], back: [0, 180, 0], right: [0, 90, 0], left: [0, 270, 0], top: [0, 0, 270], bottom: [0, 0, 90] };

// FUN_10018930: the model's axes for angles (a, b, c) are the columns of Rz(a) Ry(b) Rx(c).
function euler(a, b, c) {
  const k = Math.PI / 180, [ca, sa, cb, sb, cc, sc] = [Math.cos(a * k), Math.sin(a * k), Math.cos(b * k), Math.sin(b * k), Math.cos(c * k), Math.sin(c * k)];
  const ax = [[ca * cb, cb * sa, -sb], [sc * sb * ca - cc * sa, sc * sb * sa + cc * ca, sc * cb], [cc * sb * ca + sc * sa, cc * sb * sa - sc * ca, cc * cb]];
  return [0, 1, 2].flatMap((r) => [0, 1, 2].map((col) => ax[col][r]));
}
// Turn the model's axes about a world axis u (unit) by t radians: FUN_10021310 / FUN_10018800.
function turn(m, u, t) {
  const [x, y, z] = u, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
  const out = new Array(9);
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++)
    out[r * 3 + col] = R[r * 3] * m[col] + R[r * 3 + 1] * m[3 + col] + R[r * 3 + 2] * m[6 + col];
  return out;
}
// The 1998 camera sits at z = -20 looking down +z with +y up, so on screen right is -x.
const SCREEN = { right: [-1, 0, 0], up: [0, 1, 0], toward: [0, 0, -1] };

// --- styles --------------------------------------------------------------------------------
// kind: 'original' (a scene's own), 'file' (a .liv, loaded into each engine studio on first
// use) or 'preset' (built in C++).
const styles = new Map();

async function ensureStyle(id, studio) {
  const s = styles.get(id);
  if (!s || s.kind !== 'file') return s;
  s.index ??= [];
  s.loading ??= [];
  if (s.index[studio] === undefined) {
    s.loading[studio] ??= (async () => {
      s.bytes ??= new Uint8Array(await (await fetch(`styles/${s.file.split('/').map(encodeURIComponent).join('/')}`)).arrayBuffer());
      E.FS.mkdirTree('/styles');
      const path = `/styles/${s.id}.liv`;
      E.FS.writeFile(path, s.bytes);
      use(studio);
      s.index[studio] = E.ccall('tf_add_style_file', 'number', ['string'], [path]);
    })();
    await s.loading[studio];
  }
  return s;
}

function use(studio) { E._tf_use_studio(studio); }

function applyStyle(id, studio, hasOriginal) {
  const s = styles.get(id);
  if (!s) E._tf_set_style(0);
  else if (s.kind === 'original') { if (hasOriginal) E._tf_use_original_styles(); else E._tf_set_style(0); }
  else if (s.kind === 'file') { const i = s.index?.[studio]; if (i >= 0) E._tf_set_file_style(i); else E._tf_set_style(0); }
  else E._tf_set_style(s.index);
}

// Put engine studio 0 in the page's state.
function applyPage() {
  use(0);
  applyStyle(page.style, 0, page.hasOriginal);
  E._tf_set_line_scale(page.lineScale);
  const rgb = (c) => (c ? [1, ...c] : [0, 0, 0, 0]);
  E._tf_set_line_color(...rgb(page.lineColor));
  E._tf_set_surface_color(...rgb(page.fillColor));
  E._tf_set_background(...rgb(page.background));
  E._tf_set_light(...(page.light ? [1, ...page.light] : [0, 0, 0, 0]));
  // A scene shows the pose it was saved in until playback starts, as LiveArt 98 did.
  if (page.anim.length && page.anim.started) E._tf_anim_set_time(page.anim.time);
  if (page.catalog) {
    E._tf_use_catalog_view(0, 0, 0);
    E._tf_set_catalog_orient(...page.orient);
    E._tf_set_catalog_pose(page.pose.x, page.pose.y, page.pose.size);
    E._tf_set_rotation(0, 0);
  } else {
    E._tf_set_rotation(page.xRot, page.yRot);
    E._tf_set_distance(page.distance);
  }
}

// --- drawing ---------------------------------------------------------------------------------
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
let pending = false;
function requestDraw() {
  if (pending || !E) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const now = performance.now();
    if (page.anim.playing) advanceAnimation((now - page.anim.last) / 1000);
    page.anim.last = now;
    drawPage();
    if (page.spinning) { spinStep(); requestDraw(); }
    else if (page.anim.playing) requestDraw();
  });
}
function drawPage() {
  if (!page.hasModel) { pageGL.clear(1, 1, 1); return; }
  applyPage();
  pageGL.draw(E, page.w, page.h, dpr());
}
function spinStep() {
  if (page.catalog) page.orient = turn(page.orient, SCREEN.up, 0.02);
  else page.yRot += 0.02;
}

// Pull the orbit camera in or out until the model fills about `fill` of the page. Measured
// with the untextured default style, since the EPS writer skips textured primitives.
function fitToFrame(fill = 0.72) {
  for (let i = 0; i < 6; i++) {
    applyPage();
    E._tf_set_style(0);
    if (!E._tf_render(400, 400)) return;
    const eps = parseEPS(E.FS.readFile('/frame.eps', { encoding: 'utf8' }));
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
    page.distance *= ratio;
  }
}

function setCanvasSize(w, h) {
  page.w = w; page.h = h;
  const el = $('#page');
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  $('#canvas-size').textContent = `Canvas size ${w} x ${h}`;
  requestDraw();
}

// --- status bar prompts (SketchPad's string table) ----------------------------------------------
let statusText = 'Ready';
function setStatus(text) { statusText = text; statusEl.textContent = text; }
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-prompt]');
  statusEl.textContent = el ? el.dataset.prompt : statusText;
});

// --- models --------------------------------------------------------------------------------------
// .x goes to the engine from memory; .3ds / .dxf / .pcs / .vpe readers take a path, so those are
// written into Emscripten's in-memory filesystem first (a .vpe keeps its name: the decryption key
// is the number in it).
function loadInto(studio, bytes, filename) {
  use(studio);
  const ext = (/\.[^.]+$/.exec(filename) || [''])[0].toLowerCase();
  if (ext === '.x') {
    const ptr = E._malloc(bytes.length);
    E.HEAPU8.set(bytes, ptr);
    const ok = !!E._tf_load_x(ptr, bytes.length);
    E._free(ptr);
    return ok;
  }
  if (!['.3ds', '.dxf', '.pcs', '.vpe'].includes(ext)) return false;
  const path = ext === '.vpe' ? `/${filename.split('/').pop().toLowerCase()}` : `/model${studio}${ext}`;
  E.FS.writeFile(path, bytes);
  return !!E.ccall('tf_load_file', 'number', ['string'], [path]);
}

function resetPose() {
  page.orient = euler(...HOME_98);
  page.pose = { x: 0, y: 0, size: 1 };
  [page.xRot, page.yRot] = page.home;
}

// Open `bytes` on the page. `style` null keeps the page's LiveStyle ("Insert Model Only").
async function openOnPage(bytes, filename, name, { id = null, rot = [0.15, 0.5], style } = {}) {
  setStatus(`Loading ${name}…`);
  if (!loadInto(0, bytes, filename)) { setStatus(`Could not load ${name} — the engine rejected it.`); return false; }
  page.hasModel = true;
  page.name = name;
  page.id = id;
  page.catalog = /\.vpe$/i.test(filename);
  page.home = page.catalog ? [0, 0] : rot;
  page.spinning = false;
  resetPose();
  page.hasOriginal = !!E._tf_has_original_styles();
  page.anim = { length: E._tf_anim_length(), time: 0, playing: false, loop: true, started: false, last: performance.now() };
  if (!page.catalog) fitToFrame();
  $('#doc-name').textContent = name;
  $('#tb-model').textContent = name;
  document.title = `${name} - LiveArt Sketchpad`;
  let s = style ?? page.style;
  if (page.hasOriginal && style === undefined) s = 'original'; // a scene opens in its own LiveStyles
  await selectStyle(s);
  syncTools();
  setStatus('Ready');
  syncURL();
  requestDraw();
  return true;
}

async function openCatalogModel(id, name, style) {
  const res = await fetch(`catalog/dv${id}.vpe`);
  if (!res.ok) { setStatus(`Could not fetch catalog model ${id}`); return; }
  await openOnPage(new Uint8Array(await res.arrayBuffer()), `dv${id}.vpe`, name ?? catalogName(id), { id: `catalog-${id}`, style });
}

async function openSample(id) {
  const m = library.find((x) => x.id === id) || library[0];
  const res = await fetch(`models/${m.file}`);
  if (!res.ok) { setStatus(`Could not fetch ${m.name}`); return; }
  await openOnPage(new Uint8Array(await res.arrayBuffer()), m.file, m.name, { id: m.id, rot: m.rot });
}

async function openUserFile(f) {
  if (!f) return;
  await openOnPage(new Uint8Array(await f.arrayBuffer()), f.name, f.name.replace(/\.[^.]+$/, ''));
}

function newDocument() {
  page.hasModel = false;
  page.anim = { length: 0, time: 0, playing: false, loop: true, last: 0 };
  page.name = 'Untitled'; page.id = null;
  $('#doc-name').textContent = 'Untitled';
  $('#tb-model').textContent = 'Untitled';
  document.title = 'LiveArt Sketchpad';
  syncTools();
  syncURL();
  requestDraw();
}

// --- the LiveStyle picker -------------------------------------------------------------------------
async function selectStyle(id) {
  if (!styles.has(id) && styles.has(`beta-${id}`)) id = `beta-${id}`; // links from before the 1.2 set
  if (!styles.has(id) || (id === 'original' && !page.hasOriginal)) id = page.hasOriginal ? 'original' : 'toon';
  page.style = id;
  if (id !== 'original') store('liveart.style', id);
  await ensureStyle(id, 0);
  $('#style-select').value = id;
  $('[value="original"]', $('#style-select')).hidden = !page.hasOriginal;
  syncTools();
  syncURL();
  requestDraw();
}

function fillStyleSelect(select, withOriginal) {
  select.textContent = '';
  let group = select;
  let current = null;
  for (const s of styles.values()) {
    if (s.kind === 'original' && !withOriginal) continue;
    if ((s.group || '') !== current) {
      current = s.group || '';
      group = current ? document.createElement('optgroup') : select;
      if (current) { group.label = current; select.append(group); }
    }
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    group.append(o);
  }
}

async function buildStyles() {
  const list = (await (await fetch('styles/index.json')).json()).styles;
  styles.set('original', { id: 'original', name: 'Original', kind: 'original' });
  for (const s of list) styles.set(s.id, { ...s, kind: 'file' });
  styles.set('editor-default', { id: 'editor-default', name: 'Classic (editor)', kind: 'preset', index: 0, group: 'Engine' });
  fillStyleSelect($('#style-select'), true);
  fillStyleSelect($('#catalog-style'), false);
  $('#style-select').addEventListener('change', (e) => selectStyle(e.target.value));
}

// --- the LiveArt Toolbar ---------------------------------------------------------------------------
// SketchPad greys out what the LiveStyle doesn't let you change (its interface flags) and what
// the model can't do; Studio::StyleCaps reports the former.
function syncTools() {
  use(0);
  applyStyle(page.style, 0, page.hasOriginal);
  const caps = page.hasModel ? E._tf_style_caps() : 0;
  const set = (tool, on) => { const b = $(`[data-tool="${tool}"]`) || $(`[data-repeat="${tool}"]`); if (b) b.disabled = !on; };
  set('line-thickness', caps & 1);
  set('line-color', caps & 2);
  set('fill-color', caps & 4);
  for (const t of ['background', 'orientation', 'lighting', 'reset']) set(t, page.hasModel);
  set('orientations', page.hasModel && page.catalog);
  set('animation', page.hasModel && page.anim.length > 0);
  for (const b of $$('[data-repeat]')) b.disabled = !page.hasModel || (!page.catalog && /nudge|cw|ccw/.test(b.dataset.repeat));
  $('#style-select').disabled = !page.hasModel;
}

// One click of each (LiveArt.dll 10045030-10045190 -> the control's MoveX/Y, RotateX/Y/Z and
// ScaleModel): a nudge is one world unit, a tilt 0.04 rad about a screen axis, a size step 10%.
const STEPS = {
  'nudge-up': () => { page.pose.y += 1; },
  'nudge-down': () => { page.pose.y -= 1; },
  'nudge-left': () => { page.pose.x -= 1; },
  'nudge-right': () => { page.pose.x += 1; },
  'tilt-up': () => tilt('right', -0.04, 'xRot', -0.04),
  'tilt-down': () => tilt('right', 0.04, 'xRot', 0.04),
  'tilt-left': () => tilt('up', -0.04, 'yRot', -0.04),
  'tilt-right': () => tilt('up', 0.04, 'yRot', 0.04),
  'tilt-cw': () => tilt('toward', -0.04),
  'tilt-ccw': () => tilt('toward', 0.04),
  smaller: () => { if (page.catalog) page.pose.size /= 1.1; else page.distance *= 1.1; },
  bigger: () => { if (page.catalog) page.pose.size *= 1.1; else page.distance /= 1.1; },
};
function tilt(axis, t, orbitKey, orbitStep) {
  if (page.catalog) page.orient = turn(page.orient, SCREEN[axis], t);
  else if (orbitKey) page[orbitKey] += orbitStep;
}

// Hold a button to keep going, as the 1998 toolbar did.
for (const b of $$('[data-repeat]')) {
  let timer = 0;
  const stop = () => { clearInterval(timer); timer = 0; };
  b.addEventListener('pointerdown', (e) => {
    if (b.disabled || e.button !== 0) return;
    const step = () => { STEPS[b.dataset.repeat](); requestDraw(); };
    step();
    stop();
    timer = setInterval(step, 50);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
}

const TOOLS = {
  replace: () => showCatalog(),
  'line-thickness': (b) => popup(b, thicknessPad()),
  'line-color': (b) => popup(b, colorPicker('Line', page.lineColor, (c) => { page.lineColor = c; })),
  'fill-color': (b) => popup(b, colorPicker('Fill', page.fillColor, (c) => { page.fillColor = c; })),
  background: (b) => popup(b, colorPicker('Background', page.background, (c) => { page.background = c; })),
  orientation: (b) => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'),
  lighting: (b) => popup(b, lightPad()),
  animation: (b) => popup(b, animationPad()),
  help: () => $('#help').showModal(),
  reset: () => { resetPose(); if (!page.catalog) fitToFrame(); requestDraw(); },
  orientations: (b) => popup(b, orientationMenu()),
};
for (const b of $$('[data-tool]')) b.addEventListener('click', (e) => { e.stopPropagation(); if (!b.disabled) TOOLS[b.dataset.tool]?.(b); });

// --- popups ------------------------------------------------------------------------------------------
let popupOwner = null;
function popup(button, content) {
  const box = $('#popup');
  if (popupOwner === button) { closePopup(); return; }
  closePopup();
  box.textContent = '';
  box.append(content);
  box.hidden = false;
  const desk = $('#desk').getBoundingClientRect(), r = button.getBoundingClientRect();
  box.style.left = `${r.left - desk.left + $('#desk').scrollLeft}px`;
  box.style.top = `${r.bottom - desk.top + $('#desk').scrollTop + 1}px`;
  popupOwner = button;
  button.setAttribute('aria-expanded', 'true');
}
function closePopup() {
  $('#popup').hidden = true;
  popupOwner?.removeAttribute('aria-expanded');
  popupOwner = null;
}
$('#popup').addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', closePopup);

// Line Thickness: a notepad of five weights, LineThicknessScale 0.5, 0.75, 1, 1.5, 2
// (LiveArt.dll FUN_1003cc80..FUN_1003cd40). SketchPad starts at the thinnest.
const THICKNESS = [0.5, 0.75, 1, 1.5, 2];
function thicknessPad() {
  const pad = document.createElement('div');
  pad.className = 'thickness';
  THICKNESS.forEach((scale, i) => {
    const b = document.createElement('button');
    const state = () => (page.lineScale === scale ? 'selected' : 'normal');
    b.style.top = `${6 + i * 18}px`;
    b.title = `Line thickness ${scale}×`;
    b.innerHTML = `<img src="ui/thickness-${i + 1}-${state()}.png" alt="">`;
    b.addEventListener('pointerenter', () => { if (page.lineScale !== scale) b.firstChild.src = `ui/thickness-${i + 1}-hover.png`; });
    b.addEventListener('pointerleave', () => { b.firstChild.src = `ui/thickness-${i + 1}-${state()}.png`; });
    b.addEventListener('click', () => { page.lineScale = scale; closePopup(); requestDraw(); });
    pad.append(b);
  });
  return pad;
}

// Colour popups: the 40 colours of the stone palette (LiveArt.dll bitmap 4601), a row of recent
// picks, "More ... Colors..." and "Default ...".
const PALETTE = [
  ['#000000', '#9c4200', '#394200', '#004210', '#39427b', '#4a0094', '#6b42ad', '#424242'],
  ['#8c1000', '#ef7b00', '#849400', '#009429', '#319494', '#8c00ff', '#8c7bad', '#949494'],
  ['#f72900', '#efad00', '#8cd600', '#39ad7b', '#63d6d6', '#8c73ff', '#9c0894', '#a5a5a5'],
  ['#ff18f7', '#e7d600', '#e7ff00', '#00ff52', '#63ffff', '#73d6ff', '#ad427b', '#cecece'],
  ['#ffadd6', '#f7d6ad', '#efffad', '#d6ffd6', '#deffff', '#bdd6ff', '#e7adff', '#ffffff'],
];
const recentColors = [];
const hex = (c) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function colorPicker(what, current, set) {
  const wrap = document.createElement('div');
  const pal = document.createElement('div');
  pal.className = 'palette';
  const choose = (h) => {
    set(rgb(h));
    if (!recentColors.includes(h)) { recentColors.unshift(h); recentColors.length = Math.min(recentColors.length, 8); }
    closePopup();
    requestDraw();
  };
  const now = current ? hex(current) : null;
  PALETTE.forEach((row, j) => row.forEach((h, i) => {
    const b = document.createElement('button');
    b.style.cssText = `left:${12 + 18 * i}px;top:${36 + 18 * j}px;--c:${h}`;
    b.title = h;
    if (h === now) b.setAttribute('aria-selected', 'true');
    b.addEventListener('click', () => choose(h));
    pal.append(b);
  }));
  recentColors.forEach((h, i) => {
    const b = document.createElement('button');
    b.style.cssText = `left:${12 + 18 * i}px;top:136px;--c:${h}`;
    b.title = h;
    b.addEventListener('click', () => choose(h));
    pal.append(b);
  });
  const more = document.createElement('button');
  more.className = 'btn wide-btn';
  more.textContent = `More ${what} Colors…`;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = now || '#000000';
  input.hidden = true;
  input.addEventListener('change', () => choose(input.value));
  more.addEventListener('click', () => input.click());
  const def = document.createElement('button');
  def.className = 'btn wide-btn';
  def.textContent = `Default ${what}`;
  def.addEventListener('click', () => { set(null); closePopup(); requestDraw(); });
  const sep = document.createElement('hr');
  sep.className = 'popup-sep';
  wrap.append(pal, more, input, sep, def);
  return wrap;
}

// Lighting: eight lamps round a cube that shows where the light comes from, and a switch.
// The lamps shine across the screen (the centre one from the eye); SketchPad's default is the
// right-hand lamp. The engine takes the direction light travels, in view space (x right, y up,
// z toward the viewer), so a lamp at screen offset (sx, sy) (sy down) sends (-sx, sy, 0).
const LAMPS = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['w', -1, 0], ['front', 0, 0], ['e', 1, 0], ['sw', -1, 1], ['s', 0, 1], ['se', 1, 1]];
const lampVector = (x, y) => (x || y ? [-x / Math.hypot(x, y), y / Math.hypot(x, y), 0] : [0, 0, -1]);
function currentLamp() {
  if (!page.light) return page.catalog ? 'e' : null;
  const hit = LAMPS.find(([, x, y]) => lampVector(x, y).every((v, i) => Math.abs(v - page.light[i]) < 1e-6));
  return hit ? hit[0] : null;
}
function lightPad() {
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'lightpad';
  for (const [dir, x, y] of LAMPS) {
    const b = document.createElement('button');
    if (dir === 'front') {
      b.innerHTML = `<img class="cube" src="ui/cube-${page.lightOn ? (currentLamp() ?? 'front') : 'dark'}.png" alt="">`;
      b.title = 'Light from the front';
    } else {
      b.innerHTML = `<img src="ui/lamp-${dir}.png" alt="">`;
      b.title = `Light from the ${dir}`;
    }
    b.setAttribute('aria-pressed', page.lightOn && currentLamp() === dir);
    b.addEventListener('click', () => {
      page.light = lampVector(x, y);
      page.lightOn = true;
      closePopup();
      requestDraw();
    });
    grid.append(b);
  }
  const sw = document.createElement('button');
  sw.className = 'light-switch';
  sw.title = 'On/Off';
  sw.innerHTML = `<img src="ui/light-${page.lightOn ? 'on' : 'off'}.png" alt="">`;
  sw.addEventListener('click', () => {
    page.lightOn = !page.lightOn;
    page.light = page.lightOn ? null : [0, 0, -1]; // switched off: lit flat from the eye
    popup(popupOwner, lightPad());
    requestDraw();
  });
  wrap.append(grid, sw);
  return wrap;
}

// Animation Playback (LiveArt.dll DIALOG 255, strings 4401-4406): Play / Pause, First, Previous
// and Next Frame, Last Frame, Single / Loop Playback, and the frame number.
function advanceAnimation(dt) {
  const a = page.anim;
  a.time += dt;
  if (a.time > a.length) {
    if (a.loop) a.time %= a.length;
    else { a.time = a.length; a.playing = false; }
  }
  refreshAnimationPad();
}
const frameCount = () => Math.max(1, Math.round(page.anim.length * ANIM_FPS));
const currentFrame = () => Math.min(frameCount(), Math.round(page.anim.time * ANIM_FPS));
function setFrame(f) {
  page.anim.started = true;
  page.anim.time = Math.max(0, Math.min(frameCount(), f)) / ANIM_FPS;
  refreshAnimationPad();
  requestDraw();
}
let animPad = null;
function refreshAnimationPad() {
  if (!animPad?.isConnected) return;
  $('.anim-play img', animPad).src = `ui/anim-${page.anim.playing ? 'pause' : 'play'}.png`;
  $('.anim-loop img', animPad).src = `ui/anim-${page.anim.loop ? 'loop' : 'once'}.png`;
  $('.anim-frame', animPad).value = currentFrame();
}
function animationPad() {
  const pad = document.createElement('div');
  pad.className = 'animpad';
  const btn = (cls, img, title, fn) => {
    const b = document.createElement('button');
    b.className = `anim-btn ${cls}`;
    b.title = title;
    b.innerHTML = `<img src="ui/${img}.png" alt="">`;
    b.addEventListener('click', () => { fn(); refreshAnimationPad(); requestDraw(); });
    return b;
  };
  const row1 = document.createElement('div');
  row1.append(
    btn('anim-play', 'anim-play', 'Play / Pause', () => {
      const a = page.anim;
      if (!a.playing && a.time >= a.length) a.time = 0;
      a.playing = !a.playing;
      a.started = true;
      a.last = performance.now();
    }),
    btn('anim-loop', 'anim-loop', 'Single / Loop Playback', () => { page.anim.loop = !page.anim.loop; }));
  const row2 = document.createElement('div');
  row2.append(
    btn('', 'anim-first', 'First Frame', () => { page.anim.playing = false; setFrame(0); }),
    btn('', 'anim-prev', 'Previous Frame', () => { page.anim.playing = false; setFrame(currentFrame() - 1); }),
    btn('', 'anim-next', 'Next Frame', () => { page.anim.playing = false; setFrame(currentFrame() + 1); }),
    btn('', 'anim-last', 'Last Frame', () => { page.anim.playing = false; setFrame(frameCount()); }));
  const row3 = document.createElement('label');
  row3.className = 'anim-count';
  row3.innerHTML = `Frame <input class="anim-frame" type="number" min="0" max="${frameCount()}"> of ${frameCount()}`;
  $('input', row3).addEventListener('change', (e) => { page.anim.playing = false; setFrame(+e.target.value); });
  pad.append(row1, row2, row3);
  animPad = pad;
  queueMicrotask(refreshAnimationPad);
  return pad;
}

function orientationMenu() {
  const menu = document.createElement('div');
  menu.className = 'popup-menu';
  const items = [['Reset Model', 'reset'], null, ['to Front', 'front'], ['to Back', 'back'], ['to Right Side', 'right'],
    ['to Left Side', 'left'], ['to Top', 'top'], ['to Bottom', 'bottom']];
  for (const it of items) {
    if (!it) { const hr = document.createElement('hr'); hr.className = 'popup-sep'; menu.append(hr); continue; }
    const b = document.createElement('button');
    b.textContent = it[0];
    b.addEventListener('click', () => { closePopup(); actions[it[1]](); });
    menu.append(b);
  }
  return menu;
}

// --- the page under the mouse: Model Orientation drags turn it, right-drag / wheel size it ----------
let drag = null;
stage.addEventListener('contextmenu', (e) => e.preventDefault());
stage.addEventListener('pointerdown', (e) => {
  if (!page.hasModel) return;
  stage.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, size: e.button === 2 || e.shiftKey };
  page.spinning = false;
  syncChecks();
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.size) sizeBy(Math.pow(1.01, -dy));
  else if ($('[data-tool="orientation"]').getAttribute('aria-pressed') === 'true') {
    if (page.catalog) {
      page.orient = turn(page.orient, SCREEN.up, dx / 100);
      page.orient = turn(page.orient, SCREEN.right, -dy / 100);
    } else { page.yRot += dx / 100; page.xRot += dy / 100; }
  }
  requestDraw();
});
function sizeBy(f) { if (page.catalog) page.pose.size *= f; else page.distance /= f; }
const endDrag = () => { drag = null; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('wheel', (e) => {
  if (!page.hasModel) return;
  e.preventDefault();
  sizeBy(Math.pow(0.99, e.deltaY / 4));
  requestDraw();
}, { passive: false });

const pageEl = $('#page');
pageEl.addEventListener('dragover', (e) => { e.preventDefault(); pageEl.classList.add('drop'); });
pageEl.addEventListener('dragleave', () => pageEl.classList.remove('drop'));
pageEl.addEventListener('drop', async (e) => { e.preventDefault(); pageEl.classList.remove('drop'); await openUserFile(e.dataTransfer.files[0]); });
$('#file').addEventListener('change', async (e) => { await openUserFile(e.target.files[0]); e.target.value = ''; });

// --- floating windows: drag by the title bar ---------------------------------------------------------
function draggable(win, handle, within) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('b, button')) return;
    e.preventDefault();
    const r = win.getBoundingClientRect();
    const box = within ? within.getBoundingClientRect() : { left: 0, top: 0 };
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const move = (ev) => {
      win.style.transform = 'none';
      win.style.left = `${ev.clientX - ox - box.left + (within ? within.scrollLeft : 0)}px`;
      win.style.top = `${Math.max(0, ev.clientY - oy - box.top + (within ? within.scrollTop : 0))}px`;
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
}
draggable($('#la-toolbar'), $('#la-toolbar .toolwin-title'), $('#desk'));
draggable($('#catalog'), $('#catalog .titlebar'));

// --- the Model Catalog (LiveArt.dll DIALOG 172) ----------------------------------------------------------
// Search is by keyword, as the 1998 database stores them (plurals: "bats", "witchs"), every word
// must match; ":Category" lists a category and its children. A second engine studio renders the
// preview in the chosen LiveStyle; Insert puts model and style on the page, Insert Model Only
// keeps the page's style.
let results = [];
let selected = -1;
let previewId = null;

async function loadCatalog() {
  if (catalog) return catalog;
  catalog = await (await fetch('catalog/index.json')).json();
  const list = $('#catalog-categories');
  for (const c of catalog.categories) {
    const o = document.createElement('option');
    o.value = `:${c.name}`;
    list.append(o);
  }
  return catalog;
}
function catalogName(id) {
  const m = catalog?.models.find((x) => x[0] === +id);
  return m ? m[1] : `Model ${id}`;
}
function search(q) {
  q = q.trim();
  if (!q) return [];
  let hits;
  if (q.startsWith(':')) {
    const want = q.slice(1).trim().toLowerCase();
    const byName = new Map(catalog.categories.map((c) => [c.name.toLowerCase(), c]));
    hits = new Set();
    const walk = (c, seen = new Set()) => {
      if (!c || seen.has(c)) return;
      seen.add(c);
      c.models.forEach((i) => hits.add(i));
      c.children.forEach((n) => walk(byName.get(n.toLowerCase()), seen));
    };
    for (const c of catalog.categories) if (c.name.toLowerCase() === want) walk(c);
  } else {
    for (const word of q.toLowerCase().split(/[\s,]+/).filter(Boolean)) {
      const forms = [word, `${word}s`, `${word}es`, word.replace(/y$/, 'ies'), word.replace(/s$/, '')];
      const set = new Set();
      for (const f of forms) (catalog.keywords[f] || []).forEach((i) => set.add(i));
      for (const [i, m] of catalog.models.entries()) if (m[1].toLowerCase().includes(word)) set.add(i);
      hits = hits ? new Set([...hits].filter((i) => set.has(i))) : set;
    }
  }
  const seenIds = new Set();
  return [...hits].map((i) => catalog.models[i]).filter((m) => !seenIds.has(m[0]) && seenIds.add(m[0]))
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
}
function showResults(list) {
  results = list;
  selected = -1;
  const box = $('#catalog-results');
  box.textContent = '';
  list.forEach((m, i) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'option');
    d.textContent = m[1];
    d.addEventListener('click', () => selectResult(i));
    d.addEventListener('dblclick', () => insertFromCatalog(true));
    box.append(d);
  });
  $('#catalog-count').textContent = list.length;
  $$('[data-action^="catalog-insert"]').forEach((b) => { if (b.tagName === 'BUTTON' && b.classList.contains('btn')) b.disabled = true; });
  previewGL.clear(1, 1, 1);
}
async function selectResult(i) {
  if (i < 0 || i >= results.length) return;
  selected = i;
  $$('#catalog-results div').forEach((d, j) => d.setAttribute('aria-selected', j === i));
  $$('#catalog-results div')[i].scrollIntoView({ block: 'nearest' });
  const [id] = results[i];
  $$('.cat-buttons [data-action^="catalog-insert"]').forEach((b) => { b.disabled = false; });
  if (previewId === id) { drawPreview(); return; }
  previewId = id;
  const res = await fetch(`catalog/dv${id}.vpe`);
  if (!res.ok || previewId !== id) return;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (previewId !== id) return;
  if (!loadInto(1, bytes, `dv${id}.vpe`)) { previewId = null; previewGL.clear(1, 1, 1); return; }
  drawPreview();
}
async function drawPreview() {
  if (previewId === null) return;
  const id = $('#catalog-style').value;
  await ensureStyle(id, 1);
  use(1);
  applyStyle(id, 1, false);
  E._tf_set_line_scale(0.5);
  E._tf_set_line_color(0, 0, 0, 0); E._tf_set_surface_color(0, 0, 0, 0);
  E._tf_set_background(0, 0, 0, 0); E._tf_set_light(0, 0, 0, 0);
  E._tf_use_catalog_view(...HOME_98);
  E._tf_set_catalog_pose(0, 0, 1);
  E._tf_set_rotation(0, 0);
  const r = $('#catalog-preview').getBoundingClientRect();
  previewGL.draw(E, Math.round(r.width), Math.round(r.height), dpr());
  use(0);
}
async function insertFromCatalog(withStyle) {
  if (selected < 0) return;
  const [id, name] = results[selected];
  hideCatalog();
  await openCatalogModel(id, name, withStyle ? $('#catalog-style').value : null);
}
async function showCatalog() {
  $('#catalog').hidden = false;
  $('#catalog-style').value = page.style !== 'original' ? page.style : (recall('liveart.style') || 'toon');
  setStatus('Loading the Model Catalog…');
  await loadCatalog();
  setStatus('Ready');
  $('#catalog-query').focus();
  if (!results.length && !$('#catalog-query').value) {
    $('#catalog-query').value = ':Creatures Air';
    showResults(search(':Creatures Air'));
  }
}
function hideCatalog() { $('#catalog').hidden = true; }
$('#catalog-search').addEventListener('submit', (e) => {
  e.preventDefault();
  showResults(search($('#catalog-query').value));
  if (results.length) selectResult(0);
});
$('#catalog-style').addEventListener('change', drawPreview);
$('#catalog-results').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selectResult(Math.max(0, selected + (e.key === 'ArrowDown' ? 1 : -1))); }
  else if (e.key === 'Enter') insertFromCatalog(true);
});

// --- exports, print, copy ------------------------------------------------------------------------------
function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const baseName = () => `${page.name} - ${styles.get(page.style)?.name ?? 'LiveArt'}`;
function renderPNG(w, h) {
  applyPage();
  offGL.draw(E, w, h, 1);
  return new Promise((resolve) => offGL.canvas.toBlob(resolve));
}
// EPS and SVG are the engine's own vector output, which (as in 1998) leaves out textures.
function renderEPS(w, h) {
  applyPage();
  if (!E._tf_render(w, h)) throw new Error('engine render failed');
  return E.FS.readFile('/frame.eps', { encoding: 'utf8' });
}
function epsToSVG(epsText) {
  const eps = parseEPS(epsText);
  const parts = eps.ops.map((op) => {
    const p = op.path;
    let d = `M${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    for (let i = 2; i < p.length; i += 2) d += `L${p[i].toFixed(2)},${p[i + 1].toFixed(2)}`;
    return op.fill
      ? `<path d="${d}Z" fill="${op.color}" stroke="${op.color}" stroke-width="0.6"/>`
      : `<path d="${d}" fill="none" stroke="${op.color}" stroke-width="${op.lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${eps.width} ${eps.height}">\n` +
    `<rect width="100%" height="100%" fill="#fff"/>\n${parts.join('\n')}\n</svg>\n`;
}
async function exportImage(fmt, w, h) {
  if (!page.hasModel) return;
  if (fmt === 'png') download(await renderPNG(w, h), `${baseName()}.png`);
  else if (fmt === 'svg') download(new Blob([epsToSVG(renderEPS(w, h))], { type: 'image/svg+xml' }), `${baseName()}.svg`);
  else download(new Blob([`${renderEPS(w, h)}\nshowpage\n`], { type: 'application/postscript' }), `${baseName()}.eps`);
}
async function copyImage() {
  if (!page.hasModel) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderPNG(page.w, page.h) })]);
    setStatus('Copied the image to the Clipboard');
  } catch { setStatus('This browser would not let LiveArt use the Clipboard'); }
}
async function printPage() {
  if (!page.hasModel) return;
  const url = URL.createObjectURL(await renderPNG(page.w * 2, page.h * 2));
  const w = window.open('', '_blank');
  if (!w) { setStatus('The print window was blocked'); return; }
  w.document.write(`<title>${page.name}</title><img src="${url}" style="width:${page.w}px" onload="print()">`);
  w.document.close();
}

// --- dialogs ---------------------------------------------------------------------------------------------
function canvasDialog() {
  const d = $('#canvas-dialog'), w = $('#canvas-w'), h = $('#canvas-h'), lock = $('#canvas-lock');
  w.value = page.w; h.value = page.h;
  const ratio = page.w / page.h;
  w.oninput = () => { if (lock.checked) h.value = Math.round(w.value / ratio); };
  h.oninput = () => { if (lock.checked) w.value = Math.round(h.value * ratio); };
  d.onclose = () => { if (d.returnValue === 'ok') setCanvasSize(Math.max(50, Math.min(2000, +w.value)), Math.max(50, Math.min(2000, +h.value))); };
  d.showModal();
}
function exportDialog() {
  const d = $('#export-dialog');
  $('#export-w').value = page.w * 2; $('#export-h').value = page.h * 2;
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const fmt = $('input[name=fmt]:checked', d).value;
    exportImage(fmt, Math.max(16, +$('#export-w').value), Math.max(16, +$('#export-h').value));
  };
  d.showModal();
}
function samplesDialog() {
  const box = $('#samples');
  if (!box.childElementCount) {
    let group = null;
    for (const m of library) {
      if (m.group !== group) { group = m.group; const g = document.createElement('div'); g.className = 'group'; g.textContent = group; box.append(g); }
      const b = document.createElement('button');
      b.innerHTML = `<img src="models/thumbs/${m.id}.png" alt="" loading="lazy"><span>${m.name}</span>`;
      b.addEventListener('click', () => { $('#samples-dialog').close(); openSample(m.id); });
      box.append(b);
    }
  }
  $('#samples-dialog').showModal();
}

// --- menus, toggles and keys -------------------------------------------------------------------------------
function closeMenus() { $$('.menu.open').forEach((m) => m.classList.remove('open')); }
for (const menu of $$('.menu')) {
  const title = $('.menu-title', menu);
  title.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = menu.classList.contains('open');
    closeMenus();
    closePopup();
    if (!wasOpen) menu.classList.add('open');
  });
  title.addEventListener('mouseenter', () => {
    const open = $('.menu.open');
    if (open && open !== menu && open.parentElement === menu.parentElement) { closeMenus(); menu.classList.add('open'); }
  });
}
document.addEventListener('click', closeMenus);

function toggle(el, menuAction) {
  el.hidden = !el.hidden;
  const item = $(`[data-action="${menuAction}"][role=menuitemcheckbox]`);
  if (item) item.setAttribute('aria-checked', !el.hidden);
}
function syncChecks() { $('[data-action="spin"][role=menuitemcheckbox]').setAttribute('aria-checked', page.spinning); }

const actions = {
  new: newDocument,
  open: () => $('#file').click(),
  samples: samplesDialog,
  export: exportDialog,
  print: printPage,
  copy: copyImage,
  exit: () => { $('#app').hidden = true; $('#reopen').hidden = false; },
  canvas: canvasDialog,
  'toggle-doc-toolbar': () => toggle($('#doc-toolbar'), 'toggle-doc-toolbar'),
  'toggle-status': () => toggle($('#statusbar'), 'toggle-status'),
  'toggle-la-toolbar': () => toggle($('#la-toolbar'), 'toggle-la-toolbar'),
  catalog: showCatalog,
  'catalog-close': hideCatalog,
  'catalog-insert': () => insertFromCatalog(true),
  'catalog-insert-model': () => insertFromCatalog(false),
  spin: () => { if (!page.hasModel) return; page.spinning = !page.spinning; syncChecks(); requestDraw(); },
  about: () => $('#about').showModal(),
  help: () => $('#help').showModal(),
  web: () => window.open('https://web.archive.org/web/1998/http://www.viewpoint.com/liveart/', '_blank', 'noopener'),
  reset: () => TOOLS.reset(),
  ...Object.fromEntries(Object.entries(PRESETS_98).map(([k, o]) => [k, () => {
    if (!page.catalog) return; // the presets belong to catalog models
    page.orient = euler(...o);
    requestDraw();
  }])),
};
for (const b of $$('[data-action]')) {
  b.addEventListener('click', (e) => {
    if (b.disabled) return;
    e.stopPropagation();
    closeMenus();
    closePopup();
    actions[b.dataset.action]?.();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('dialog')) return;
  const inField = e.target.matches('input, select, textarea');
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'o') { e.preventDefault(); actions.open(); }
  else if (mod && e.key === 'n') { e.preventDefault(); actions.new(); }
  else if (mod && e.key === 'p') { e.preventDefault(); actions.print(); }
  else if (mod && e.key === 'c' && !inField && !getSelection().toString()) { e.preventDefault(); actions.copy(); }
  else if (e.altKey && e.key === 'i' && !$('#catalog').hidden) actions['catalog-insert']();
  else if (e.altKey && e.key === 'm' && !$('#catalog').hidden) actions['catalog-insert-model']();
  else if (e.key === 'Escape') { closeMenus(); closePopup(); if (!$('#catalog').hidden) hideCatalog(); }
  else if (inField) return;
  else if (e.key === 'Home') actions.reset();
  else if (e.key === ' ') { e.preventDefault(); actions.spin(); }
});

// --- shareable URLs ---------------------------------------------------------------------------------------
function store(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }
function syncURL() {
  const q = new URLSearchParams();
  if (page.id) q.set('model', page.id);
  if (page.hasModel) q.set('style', page.style);
  history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
}

// --- boot --------------------------------------------------------------------------------------------------
const reopen = document.createElement('button');
reopen.id = 'reopen';
reopen.className = 'desktop-icon';
reopen.hidden = true;
reopen.innerHTML = '<img src="ui/logo-viewpoint.png" alt=""><span>LiveArt Sketchpad</span>';
reopen.addEventListener('dblclick', () => { $('#app').hidden = false; reopen.hidden = true; });
reopen.addEventListener('click', (e) => { if (e.detail === 0) { $('#app').hidden = false; reopen.hidden = true; } });
$('.desktop').append(reopen);

try {
  setCanvasSize(400, 400);
  E = await createEngine({ locateFile: (f) => `engine/${f}` });
  pageGL = createRenderer(stage);
  previewGL = createRenderer($('#catalog-preview'));
  offGL = createRenderer(document.createElement('canvas'));
  if (!pageGL || !previewGL || !offGL) throw new Error('this browser has no WebGL 2');
  use(0);
  const [, lib] = await Promise.all([buildStyles(), fetch('models/index.json').then((r) => r.json())]);
  library = lib.models;
  const q = new URLSearchParams(location.search);
  page.style = recall('liveart.style') || 'toon';
  const style = q.get('style') && q.get('style') !== 'original' ? q.get('style') : undefined;
  const m = q.get('model') || 'girl';
  if (/^catalog-\d+$/.test(m)) { await loadCatalog(); await openCatalogModel(m.slice(8), undefined, style); }
  else {
    await openSample(m);
    if (style) await selectStyle(style);
  }
} catch (err) {
  setStatus(`LiveArt failed to start: ${err.message}`);
  throw err;
}
