// Oliven in 3D. Same geometry, trees and palette as the isometric map (app.js),
// rendered with three.js: toon shading, ink outlines, orthographic camera.
import * as THREE from './vendor/three-bundle.js'

const D = window.OLIVEN
const W = 1374, H = 1458, DEPTH = 46
const deg = Math.PI / 180
// Plan (x, y) + height z  ->  world (X, Y, Z), centered on the property
const V = (x, y, z = 0) => new THREE.Vector3(x - W / 2, z, y - H / 2)

// ---- Shared with app.js (copied verbatim) ----
// Seeded random so the trees land in the same place every load.
let seed = 7
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const distToLine = ([x, y], line) => {
  let best = Infinity
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i]
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
  }
  return best
}
const inPoly = ([x, y], poly) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// ---------- Geometry traced from the aerial ----------
const VINEYARD = [[745,485],[800,478],[880,475],[960,470],[1030,478],[1070,505],[1085,560],[1080,640],[1068,730],[1052,820],[1040,900],[1035,980],[1040,1060],[1050,1140],[1048,1210],[1030,1265],[1000,1285],[600,1330],[300,1370],[175,1392],[158,1372],[175,1300],[210,1220],[270,1140],[350,1060],[440,990],[520,915],[590,840],[650,760],[695,670],[720,590],[730,530]]
const ROAD = [[95,1458],[140,1400],[150,1330],[188,1232],[250,1142],[335,1046],[425,975],[505,900],[575,826],[630,752],[675,662],[700,582],[714,512],[740,468],[800,457],[900,454],[1000,452],[1062,468],[1097,512],[1106,582],[1100,662],[1088,762],[1070,862],[1056,952],[1056,1042],[1068,1140],[1068,1212],[1056,1268],[1040,1300]]
const SPUR = [[735,470],[726,420],[734,380],[742,340]]
const DRIVE = [[1062,1225],[1100,1240],[1160,1258],[1240,1300],[1290,1390],[1300,1458]]
const YARD = [[680,382],[760,356],[852,358],[862,456],[728,462]]
const MEADOW = [[1040,395],[1150,345],[1190,372],[1300,352],[1374,420],[1374,700],[1100,702],[1095,600],[1090,520],[1075,470]]
const PATIO = [1205, 930, 1345, 1090]
const ORCHARD = [1100, 722, 1212, 846]
const ROSES = [1214, 722, 1342, 848]
const LAWN = [812, 1320, 1018, 1356]
const CITRUS = [1040, 1250, 1124, 1334]
const LOW = new Set(['shrub', 'rose', 'grape-red', 'grape-green'])
const NEIGHBOR = [[0,0],[560,0],[540,60],[470,120],[480,260],[460,380],[430,470],[380,560],[300,600],[200,570],[120,680],[130,800],[160,880],[120,960],[60,1010],[0,1060]]
const CORRIDOR = [[470,120],[560,70],[640,60],[705,110],[722,175],[700,300],[652,342],[640,420],[688,470],[690,560],[660,640],[620,720],[560,800],[480,880],[400,950],[300,1030],[230,1110],[182,1200],[150,1300],[118,1380],[60,1405],[0,1385],[0,1060],[60,1010],[120,960],[160,880],[130,800],[120,680],[200,570],[300,600],[380,560],[430,470],[460,380],[480,260]]
const RIVER = [[610,20],[590,140],[565,255],[512,378],[442,500],[362,640],[282,760],[200,862],[120,962],[40,1060],[-10,1110]]
const NORTH_WOODS = [[700,0],[1374,0],[1374,90],[1200,70],[1120,60],[900,72],[780,110],[720,120]]
const EAST_WOODS = [[1310,300],[1374,280],[1374,640],[1350,600],[1330,480]]
const POND = { cx: 982, cy: 232, rx: 160, ry: 120, rot: -20 }

// Vine rows run WSW→ENE. Blocks split along row lines.
const ROW_ANG = -14 * Math.PI / 180
const ux = Math.cos(ROW_ANG), uy = Math.sin(ROW_ANG) // along row
const nx = -uy, ny = ux                                // across rows
const tOf = ([x, y]) => x * nx + y * ny
const ts = VINEYARD.map(tOf)
const T0 = Math.min(...ts), T1 = Math.max(...ts)
const SPLITS = [T0, T0 + (T1 - T0) * 0.42, T0 + (T1 - T0) * 0.7, T1]
function band(t0, t1) {
  const L = 3000, cx = 700, cy = 900
  const c = cx * nx + cy * ny
  const a = t0 - c, b = t1 - c
  return [[cx + nx * a - ux * L, cy + ny * a - uy * L], [cx + nx * a + ux * L, cy + ny * a + uy * L],
          [cx + nx * b + ux * L, cy + ny * b + uy * L], [cx + nx * b - ux * L, cy + ny * b - uy * L]]
}

// ---------- Palette ----------
const C = {
  straw: '#D9C48B', strawDark: '#CDB577', neighbor: '#E3D8B8', neighborLine: '#D6C9A4',
  soilTop: '#6B4A2F', soil: '#8A6240', soil2: '#9E7550', road: '#EFE5CC', roadEdge: '#CDBE9B',
  vineSoil: '#BFA06A', vine: ['#6A9A3E', '#5E8F38', '#72A246'], vineSide: '#3E6326',
  oak: '#446F35', oakHi: '#5E8E45', oakTop: '#7BA658', oakLo: '#2F4F25', shrub: '#6F9C4C',
  water: '#2F6474', waterHi: '#4B8797', liner: '#2B3431', berm: '#B9AE86', river: '#5D93A3', bank: '#9C9467',
  wall: '#F2ECDD', wallSide: '#D8CFBC', slate: '#5D6A78', slateSide: '#48535F',
  metal: '#BCC8CE', metalSide: '#98A7AF', brown: '#7B5A44', brownSide: '#634736',
  pool: '#79C0CF', patio: '#E6DAC0', garden: '#E4D8BA', mulch: '#CDB88E', orchard: '#BFC983', rose: '#C9567A', bed: '#86AE5E', lawn: '#9CBF67', meadow: '#D3BE7E',
  path: '#EADFC4', solar: '#26406A', solarLine: '#6F8DB8', frame: '#C9D2DC', outline: '#2B2620',
}
const HOUSE = { wall: C.wall, wallSide: C.wallSide, roof: C.slate, roofSide: C.slateSide, windows: true }

// ---------- Collect objects (same calls as the 2D map) ----------
const TREES = [], BOXES = [], PANELS = []
const tree = (x, y, r, f, kind = 'oak') => TREES.push({ x, y, r, f, kind })
const box = (x0, y0, x1, y1, h, o) => BOXES.push({ x0, y0, x1, y1, h, o })
const panel = (cx, cy, len, wid, ang, f) => PANELS.push({ cx, cy, len, wid, ang, f })

// Buildings
box(770, 365, 838, 452, 34, { f: 'barn', ridge: 'y', wall: '#E7E2D6', wallSide: '#C9C2B1', roof: C.metal, roofSide: C.metalSide })
box(668, 332, 706, 372, 18, { f: 'barn', ridge: 'x', wall: '#EFEBE2', wallSide: '#D2CBBB', roof: '#C9C9C2', roofSide: '#A9A9A1' })
box(1093, 952, 1146, 1050, 30, Object.assign({ f: 'house', ridge: 'y' }, HOUSE))
box(1235, 932, 1321, 970, 22, Object.assign({ f: 'pool', ridge: 'x' }, HOUSE))
box(1290, 876, 1324, 914, 18, { f: 'gym', flat: true, wall: C.wall, wallSide: C.wallSide, roof: '#D9D4C6' })
box(1197, 1068, 1270, 1196, 24, { f: 'cottage', ridge: 'y', wall: C.wall, wallSide: C.wallSide, roof: C.brown, roofSide: C.brownSide, windows: true })
box(1346, 758, 1372, 824, 3, { f: 'poolheat', flat: true, wall: '#2A3540', wallSide: '#1F2830', roof: '#26323D' })
box(1158, 1202, 1186, 1224, 7, { f: 'bunnies', flat: true, wall: '#D9CBA8', wallSide: '#BFAF88', roof: '#E9DFC4' })
box(1268, 1043, 1330, 1080, 12, { f: 'kitchen', flat: true, wall: '#E8E0CE', wallSide: '#CFC5AF', roof: '#BDB5A3' })
box(1058, 972, 1090, 1004, 4, { f: 'house', flat: true, wall: '#CDBB98', wallSide: '#B7A580', roof: '#D8C7A2' })

// Solar
panel(1270, 148, 66, 26, 52, 'solar')
panel(1245, 228, 92, 30, 52, 'solar')
panel(1215, 298, 92, 30, 52, 'solar')

// River corridor oaks (seeded scatter)
seed = 11
const placed = []
for (let i = 0; i < 6000 && placed.length < 190; i++) {
  const x = rnd() * 740 - 20, y = rnd() * 1420
  if (!inPoly([x, y], CORRIDOR)) continue
  if (distToLine([x, y], RIVER) < 26 && rnd() < .8) continue
  const r = 20 + rnd() * 20
  if (placed.some(p => Math.hypot(p[0] - x, p[1] - y) < (p[2] + r) * .72)) continue
  placed.push([x, y, r])
}
placed.forEach(([x, y, r]) => tree(x, y, r, 'river'))
// Woods on the north and east edges
seed = 21
for (const [poly, n] of [[NORTH_WOODS, 30], [EAST_WOODS, 8]]) {
  const got = []
  for (let i = 0; i < 3000 && got.length < n; i++) {
    const x = rnd() * W, y = rnd() * 700
    if (!inPoly([x, y], poly)) continue
    const r = 22 + rnd() * 16
    if (got.some(p => Math.hypot(p[0] - x, p[1] - y) < (p[2] + r) * .75)) continue
    got.push([x, y, r])
  }
  got.forEach(([x, y, r]) => tree(x, y, r, null))
}
// Roadside row (hedgerow)
for (let x = 110; x < 1130; x += 26) tree(x + (x % 3) * 2, 1412 + ((x / 26) % 2) * 6, 13, 'hedgerow', 'cypress')
// Big trees around the house and cottage
for (const [x, y, r] of [[1292, 1118, 38], [1302, 1232, 40], [1262, 1292, 30]]) tree(x, y, r, null)
// Pond-side trees and shrubs
for (const [x, y, r] of [[1062, 375, 16], [1098, 347, 14], [1162, 148, 14], [1148, 300, 12], [1130, 100, 22]]) tree(x, y, r, null)
seed = 31
for (let a = 200; a < 360; a += 14) {
  const t = a * Math.PI / 180, rr = -20 * Math.PI / 180
  const ex = (POND.rx + 40) * Math.cos(t), ey = (POND.ry + 36) * Math.sin(t)
  tree(POND.cx + ex * Math.cos(rr) - ey * Math.sin(rr), POND.cy + ex * Math.sin(rr) + ey * Math.cos(rr), 7 + rnd() * 3, 'pond', 'shrub')
}
// Garden shrubs and lawn hedge
// Orchard trees and rose bushes
for (let y = 736; y < 842; y += 14) tree(1225, y, 5, 'roses', 'rose')
for (let x = 1297; x < 1338; x += 13) for (const y of [740, 760, 800, 822]) tree(x, y, 5, 'roses', 'rose')
for (let x = 822, i = 0; x < 1012; x += 13, i++) tree(x, 1311, 6, 'tablegrapes', i % 2 ? 'grape-green' : 'grape-red')

const KINDS = D.kinds || {}
;(D.trees || []).forEach((t, i) => { const K = KINDS[t.kind] || { type: 'fruit', r: 9 }; tree(t.x, t.y, t.r || K.r, 'tree-' + i, K.type) })

// ---------- Renderer, scene, camera ----------
const stage = document.getElementById('stage')
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
stage.appendChild(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000)
const controls = new THREE.OrbitControls(camera, renderer.domElement)
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.08, screenSpacePanning: true, zoomToCursor: true,
  minZoom: 0.5, maxZoom: 8, minPolarAngle: 12 * deg, maxPolarAngle: 78 * deg,
  autoRotateSpeed: 0.8,
})

// Three flat tones, like the drawn map
const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat)
ramp.minFilter = ramp.magFilter = THREE.NearestFilter
ramp.needsUpdate = true
const toon = (color, extra = {}) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: ramp }, extra))
const inkLine = new THREE.LineBasicMaterial({ color: C.outline })
const inkHull = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide })

scene.add(new THREE.HemisphereLight(0xfffaf0, 0x9c8a66, 1.55))
const sun = new THREE.DirectionalLight(0xfff2d8, 1.9)
sun.position.set(-620, 1000, 520)
sun.castShadow = true
const small = Math.min(innerWidth, innerHeight) < 700
sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096)
Object.assign(sun.shadow.camera, { left: -1000, right: 1000, top: 1000, bottom: -1000, near: 10, far: 3000 })
sun.shadow.bias = -0.0006
sun.shadow.normalBias = 0.6
scene.add(sun, sun.target)

// ---------- Ground: the drawn map becomes the top of the block ----------
function trace(ctx, pts, close = true) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (close) ctx.closePath()
}
function drawGround() {
  const S = small ? 1.3 : 1.8
  const cv = document.createElement('canvas')
  cv.width = Math.round(W * S); cv.height = Math.round(H * S)
  const c = cv.getContext('2d')
  c.scale(S, S)
  c.lineCap = c.lineJoin = 'round'
  const fill = (pts, col) => { trace(c, pts); c.fillStyle = col; c.fill() }
  const stroke = (pts, col, w, dash) => { trace(c, pts, false); c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]) }
  const rect = ([x0, y0, x1, y1], col) => { c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0) }

  c.fillStyle = C.straw; c.fillRect(0, 0, W, H)
  fill(NEIGHBOR, C.neighbor)
  c.save(); trace(c, NEIGHBOR); c.clip()
  for (let y = 10; y < 1100; y += 22) stroke([[0, y], [600, y - 30]], C.neighborLine, 4)
  c.restore()
  stroke([[178, 0], [172, 200], [168, 380], [176, 530]], '#B6A57A', 10)
  fill(MEADOW, C.meadow)
  for (const p of [[[1150, 380], [1230, 470], [1300, 580], [1350, 690]], [[1060, 440], [1110, 560], [1135, 700]], [[1120, 420], [1200, 470], [1255, 470]]]) stroke(p, C.path, 7)
  c.beginPath(); c.arc(1255, 498, 26, 0, 7); c.strokeStyle = C.path; c.lineWidth = 7; c.stroke()
  rect(LAWN, C.lawn)
  rect(CITRUS, C.mulch)
  fill(YARD, C.road)
  // Orchard
  rect(ORCHARD, C.orchard)
  stroke([[1171, 722], [1171, 846]], C.path, 7)
  // Rose garden
  rect(ROSES, C.garden)
  c.fillStyle = C.bed
  for (const [x, y, w, h] of [[1218, 730, 14, 112], [1290, 730, 46, 40], [1290, 790, 46, 44]]) c.fillRect(x, y, w, h)
  c.fillStyle = '#F4EEDF'; c.fillRect(1236, 752, 46, 78)
  c.strokeStyle = '#B8AB8A'; c.lineWidth = 3; c.strokeRect(1236, 752, 46, 78)
  c.fillStyle = C.bed
  for (const [x, y] of [[1241, 757], [1261, 757], [1241, 795], [1261, 795]]) c.fillRect(x, y, 16, 30)
  c.beginPath(); c.arc(1259, 791, 5, 0, 7); c.fillStyle = '#F4EEDF'; c.fill(); c.lineWidth = 2; c.stroke()
  rect(PATIO, C.patio)
  fill([[1150, 1250], [1374, 1260], [1374, 1395], [1170, 1392]], '#E2D3AE')
  // River corridor
  fill(CORRIDOR, '#B7AE7A')
  stroke(RIVER, C.bank, 34)
  stroke(RIVER, C.river, 18)
  stroke(RIVER, '#8CC0CC', 3, [18, 26])
  // Pond berm + liner (water is its own mesh)
  const { cx, cy, rx, ry, rot } = POND
  c.save(); c.translate(cx, cy); c.rotate(rot * deg)
  c.beginPath(); c.ellipse(0, 0, rx + 26, ry + 24, 0, 0, 7); c.fillStyle = C.berm; c.fill()
  c.beginPath(); c.ellipse(0, 0, rx + 6, ry + 6, 0, 0, 7); c.fillStyle = C.liner; c.fill()
  c.restore()
  // Pool surround
  c.fillStyle = '#F7F2E6'; c.fillRect(1238, 975, 89, 41)
  // Roads
  const roads = [ROAD, SPUR, DRIVE, [[1056, 1010], [1092, 1002]]]
  roads.forEach(r => stroke(r, C.roadEdge, 26))
  roads.forEach(r => stroke(r, C.road, 18))
  c.fillStyle = '#9B978D'; c.fillRect(0, 1432, W, 26)
  stroke([[0, 1445], [W, 1445]], '#E9E3CF', 2, [24, 18])
  // Vineyard soil + avenues between blocks
  fill(VINEYARD, C.vineSoil)
  c.save(); trace(c, VINEYARD); c.clip()
  for (const t of [SPLITS[1], SPLITS[2]]) stroke([[nx * t - ux * 3000, ny * t - uy * 3000], [nx * t + ux * 3000, ny * t + uy * 3000]], C.road, 8)
  c.restore()
  return cv
}
function drawSide(len) {
  const cv = document.createElement('canvas')
  cv.width = 1024; cv.height = 64
  const c = cv.getContext('2d')
  c.fillStyle = C.soil; c.fillRect(0, 0, 1024, 64)
  c.fillStyle = C.soilTop; c.fillRect(0, 0, 1024, 64 * 10 / DEPTH)
  seed = 3
  for (let i = 0; i < 40 * len / 1000; i++) {
    c.fillStyle = rnd() < 0.5 ? '#7C573A' : '#9A734E'
    c.beginPath(); c.ellipse(rnd() * 1024, 20 + rnd() * 38, 3 + rnd() * 5, 2 + rnd() * 2, 0, 0, 7); c.fill()
  }
  return cv
}
const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t }
const groundTop = tex(drawGround())
const groundMats = [
  toon(0xffffff, { map: tex(drawSide(H)) }), toon(C.soil), toon(0xffffff, { map: groundTop }),
  toon(C.soil), toon(0xffffff, { map: tex(drawSide(W)) }), toon(C.soil),
]
const groundGeo = new THREE.BoxGeometry(W, DEPTH, H)
const ground = new THREE.Mesh(groundGeo, groundMats)
ground.position.y = -DEPTH / 2
scene.add(ground)
const top = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), toon(0xffffff, { map: groundTop }))
top.position.y = 0.05
top.receiveShadow = true
scene.add(top)
const groundEdges = new THREE.LineSegments(new THREE.EdgesGeometry(groundGeo), inkLine)
groundEdges.position.copy(ground.position)
scene.add(groundEdges)

// ---------- Picking registry ----------
const pickables = [], byF = {}
function reg(mesh, f) {
  if (!f) return mesh
  mesh.userData.f = f
  pickables.push(mesh)
  ;(byF[f] = byF[f] || []).push(mesh)
  return mesh
}

// ---------- Vines: one box per row segment, per block ----------
const ROW_YAW = -Math.atan2(uy, ux)
function rowSegments(t) {
  const ss = []
  for (let i = 0, j = VINEYARD.length - 1; i < VINEYARD.length; j = i++) {
    const [ax, ay] = VINEYARD[j], [bx, by] = VINEYARD[i]
    const ta = ax * nx + ay * ny, tb = bx * nx + by * ny
    if ((ta > t) !== (tb > t)) {
      const k = (t - ta) / (tb - ta), px = ax + (bx - ax) * k, py = ay + (by - ay) * k
      ss.push(px * ux + py * uy)
    }
  }
  ss.sort((a, b) => a - b)
  const out = []
  for (let i = 0; i + 1 < ss.length; i += 2) if (ss[i + 1] - ss[i] > 12) out.push([ss[i] + 5, ss[i + 1] - 5])
  return out
}
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0)
for (let b = 0; b < 3; b++) {
  const segs = []
  for (let t = SPLITS[b] + 6; t < SPLITS[b + 1]; t += 12.5) for (const [s0, s1] of rowSegments(t)) segs.push([t, s0, s1])
  const mesh = new THREE.InstancedMesh(unitBox, toon(C.vine[b]), segs.length)
  q.setFromAxisAngle(yAxis, ROW_YAW)
  segs.forEach(([t, s0, s1], i) => {
    const sm = (s0 + s1) / 2
    m4.compose(V(nx * t + ux * sm, ny * t + uy * sm), q, sc.set(s1 - s0, 9, 6))
    mesh.setMatrixAt(i, m4)
  })
  mesh.castShadow = mesh.receiveShadow = true
  scene.add(reg(mesh, 'block-' + (b + 1)))
}

// ---------- Trees: toon canopies with ink hulls ----------
const canopyGeo = new THREE.IcosahedronGeometry(1, 1)
canopyGeo.computeVertexNormals() // non-indexed, so this gives flat facets
const trunkGeo = new THREE.CylinderGeometry(1, 1.25, 1, 6).translate(0, 0.5, 0)
const groups = {}
TREES.forEach(t => { const k = (t.f || '') + '|' + t.kind; (groups[k] = groups[k] || []).push(t) })
const tint = new THREE.Color()
seed = 99
for (const k in groups) {
  const list = groups[k], f = list[0].f, kind = list[0].kind
  const base = kind === 'grape-red' ? ['#7A3A55', '#5E8A3E'] : kind === 'grape-green' ? ['#B5CF6A', '#6E9447'] : kind === 'rose' ? ['#B8496A', '#6E9447'] : kind === 'fruit' ? ['#5E9044', '#7BAA54'] : kind === 'shrub' ? ['#5C8A3E', '#7AA956'] : kind === 'cypress' ? ['#3E6A31', '#4F7D3C'] : ['#4A7A39', '#5F9046']
  const can = new THREE.InstancedMesh(canopyGeo, toon(0xffffff), list.length)
  const hull = new THREE.InstancedMesh(canopyGeo, inkHull, list.length)
  const trunks = LOW.has(kind) ? null : new THREE.InstancedMesh(trunkGeo, toon('#5A4330'), list.length)
  list.forEach((t, i) => {
    const r = t.r
    let cy, s
    if (LOW.has(kind)) { cy = r * 0.62; s = [r * 1.05, r * 0.8, r * 1.05] }
    else if (kind === 'cypress') { cy = r * 1.65; s = [r * 0.75, r * 1.45, r * 0.75] }
    else { cy = r * 1.25; s = [r * 1.05, r * 0.95, r * 1.05] }
    q.setFromAxisAngle(yAxis, rnd() * 6.28)
    const p = V(t.x, t.y, cy)
    m4.compose(p, q, sc.set(...s)); can.setMatrixAt(i, m4)
    const g = 1 + 2.4 / s[0]
    m4.compose(p, q, sc.set(s[0] * g, s[1] + 2.4, s[2] * g)); hull.setMatrixAt(i, m4)
    can.setColorAt(i, kind === 'rose' ? tint.set(rnd() < 0.5 ? '#C9567A' : '#E07E9A') : kind.startsWith('grape') ? tint.set(base[rnd() < 0.6 ? 0 : 1]) : tint.set(base[0]).lerp(new THREE.Color(base[1]), rnd()))
    if (trunks) { m4.compose(V(t.x, t.y, 0), q, sc.set(2.6, cy - s[1] * 0.4, 2.6)); trunks.setMatrixAt(i, m4) }
  })
  can.castShadow = true; can.receiveShadow = true
  scene.add(reg(can, f), hull)
  if (trunks) { trunks.castShadow = true; scene.add(reg(trunks, f)) }
}
// Markers for fruit & nut trees added in data.js
const dotGeo = new THREE.SphereGeometry(1, 10, 8)
;(D.trees || []).forEach((t, i) => {
  const K = KINDS[t.kind] || {}
  if (!K.dot) return
  const r = t.r || K.r || 9, mat = toon(K.dot)
  for (const a of [0.4, 2.5, 4.4]) {
    const m = new THREE.Mesh(dotGeo, mat)
    m.scale.setScalar(Math.max(1.6, r * 0.24))
    m.position.copy(V(t.x + Math.cos(a) * r * 0.75, t.y + Math.sin(a) * r * 0.75, r * 1.25 + r * 0.55))
    scene.add(reg(m, 'tree-' + i))
  }
})
;(D.sightings || []).forEach((s, i) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 3, 16), toon('#FFFCF5'))
  m.position.copy(V(s.x, s.y, 3))
  scene.add(reg(m, 'sighting-' + i))
})

// ---------- Buildings ----------
function gable(w, d, rh, alongZ) {
  const sh = new THREE.Shape()
  const a = (alongZ ? w : d) / 2 + 3
  sh.moveTo(-a, 0); sh.lineTo(a, 0); sh.lineTo(0, rh); sh.closePath()
  const len = (alongZ ? d : w) + 6
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2)
  if (!alongZ) g.rotateY(Math.PI / 2)
  return g
}
function inked(geo, mat, parent, f) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = m.receiveShadow = true
  parent.add(reg(m, f), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), inkLine))
  return m
}
for (const { x0, y0, x1, y1, h, o } of BOXES) {
  const w = x1 - x0, d = y1 - y0
  const g = new THREE.Group()
  g.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2))
  inked(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), toon(o.wall), g, o.f)
  if (o.flat) inked(new THREE.BoxGeometry(w + 3, 3, d + 3).translate(0, h + 1.5, 0), toon(o.roof), g, o.f)
  else inked(gable(w, d, Math.min(w, d) * 0.42, o.ridge === 'y').translate(0, h, 0), toon(o.roof), g, o.f)
  if (o.windows) {
    const n = Math.max(1, Math.floor(w / 22)), wm = new THREE.MeshBasicMaterial({ color: '#5B7F95' })
    for (let i = 0; i < n; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(8, h * 0.4, 1), wm)
      win.position.set(-w / 2 + (i + 0.5) * w / n, h * 0.55, d / 2 + 0.6)
      g.add(win)
    }
  }
  scene.add(g)
}

// ---------- Solar ----------
const solarTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96
  const c = cv.getContext('2d')
  c.fillStyle = C.solar; c.fillRect(0, 0, 256, 96)
  c.strokeStyle = C.solarLine; c.lineWidth = 2
  for (let x = 0; x <= 256; x += 256 / 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 96); c.stroke() }
  c.beginPath(); c.moveTo(0, 48); c.lineTo(256, 48); c.stroke()
  c.strokeStyle = C.frame; c.lineWidth = 8; c.strokeRect(0, 0, 256, 96)
  return tex(cv)
})()
for (const { cx, cy, len, wid, ang, f } of PANELS) {
  const g = new THREE.Group()
  g.position.copy(V(cx, cy))
  g.rotation.set(0, -ang * deg, 0)
  const stand = new THREE.Mesh(new THREE.BoxGeometry(len * 0.9, 7, 3).translate(0, 3.5, 0), toon('#8A96A3'))
  stand.castShadow = true
  g.add(reg(stand, f))
  const top = new THREE.Group()
  top.position.y = 9.5
  top.rotation.x = Math.atan(9 / wid)
  inked(new THREE.BoxGeometry(len, 2, wid), [toon('#8A96A3'), toon('#8A96A3'), toon(0xffffff, { map: solarTex }), toon('#8A96A3'), toon('#8A96A3'), toon('#8A96A3')], top, f)
  g.add(top)
  scene.add(g)
}

// ---------- Water ----------
const pond = new THREE.Mesh(
  new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2),
  new THREE.MeshPhongMaterial({ color: C.water, shininess: 90, specular: 0x6f9aa8 }),
)
pond.scale.set(POND.rx, 1, POND.ry)
pond.rotation.y = -POND.rot * deg
pond.position.copy(V(POND.cx, POND.cy, 0.8))
pond.receiveShadow = true
scene.add(reg(pond, 'pond'))
const ripples = []
for (const [fx, fy, dly] of [[1000, 162, 0], [940, 222, 1.2], [1010, 228, 2.1]]) {
  const jet = new THREE.Mesh(new THREE.ConeGeometry(3, 10, 8).translate(0, 5, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
  jet.position.copy(V(fx, fy, 0.8))
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }))
  ring.position.copy(V(fx, fy, 1.2))
  scene.add(jet, ring)
  ripples.push([ring, dly])
}
const dock = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 8), toon('#CFC3A3'))
dock.position.copy(V(853, 322, 1.5)); dock.rotation.y = 35 * deg
scene.add(dock)
const pool = new THREE.Mesh(new THREE.PlaneGeometry(79, 31).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: C.pool, shininess: 100, specular: 0xffffff }))
pool.position.copy(V(1282.5, 995.5, 0.7))
scene.add(reg(pool, 'pool'))

// ---------- Footprints for highlight + ground picking ----------
const rectPoly = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const ellPoly = (e, grow) => Array.from({ length: 48 }, (_, i) => {
  const a = i / 48 * Math.PI * 2, r = e.rot * deg
  const x = (e.rx + grow) * Math.cos(a), y = (e.ry + grow) * Math.sin(a)
  return [e.cx + x * Math.cos(r) - y * Math.sin(r), e.cy + x * Math.sin(r) + y * Math.cos(r)]
})
function clipHalf(poly, keep) {
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ka = keep(a), kb = keep(b)
    if (ka) out.push(a)
    if (ka !== kb) {
      const ta = a[0] * nx + a[1] * ny, tb = b[0] * nx + b[1] * ny
      const lim = keep.t, k = (lim - ta) / (tb - ta)
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k])
    }
  }
  return out
}
function blockPoly(i) {
  const lo = p => p[0] * nx + p[1] * ny >= SPLITS[i]; lo.t = SPLITS[i]
  const hi = p => p[0] * nx + p[1] * ny <= SPLITS[i + 1]; hi.t = SPLITS[i + 1]
  return clipHalf(clipHalf(VINEYARD, lo), hi)
}
const FOOT = {
  'block-1': blockPoly(0), 'block-2': blockPoly(1), 'block-3': blockPoly(2),
  pond: ellPoly(POND, 34), meadow: MEADOW, orchard: rectPoly(ORCHARD), roses: rectPoly(ROSES), pool: rectPoly([1205, 925, 1345, 1035]),
  gym: rectPoly([1286, 872, 1328, 918]), kitchen: rectPoly([1262, 1038, 1336, 1086]), poolheat: rectPoly([1342, 754, 1374, 828]),
  barn: [[660, 325], [852, 356], [862, 458], [728, 462], [680, 382]], river: CORRIDOR,
  house: rectPoly([1056, 948, 1150, 1054]), cottage: rectPoly([1191, 1062, 1276, 1202]),
  solar: [[1235, 105], [1305, 160], [1250, 340], [1180, 300]], hedgerow: rectPoly([95, 1398, 1140, 1428]),
  citrus: rectPoly(CITRUS), leach: rectPoly(LAWN), tablegrapes: rectPoly([814, 1303, 1016, 1319]), bunnies: rectPoly([1152, 1196, 1192, 1230]),
}
const GROUND_ORDER = ['bunnies', 'citrus', 'tablegrapes', 'leach', 'pond', 'gym', 'kitchen', 'poolheat', 'pool', 'cottage', 'house', 'orchard', 'roses', 'barn', 'solar', 'meadow', 'hedgerow', 'block-1', 'block-2', 'block-3', 'river']
function groundFeature(x, y) {
  for (const id of GROUND_ORDER) if (inPoly([x, y], FOOT[id])) return id
  return null
}
const hiGroup = new THREE.Group()
scene.add(hiGroup)
const hiFill = new THREE.MeshBasicMaterial({ color: '#7A1F3D', transparent: true, opacity: 0.22, depthWrite: false })
const hiLine = new THREE.LineDashedMaterial({ color: '#7A1F3D', dashSize: 14, gapSize: 8 })
function showFootprint(id) {
  hiGroup.clear()
  const poly = FOOT[id]
  if (!poly || poly.length < 3) return
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - W / 2, -(y - H / 2))))
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), hiFill)
  m.position.y = 1.6
  const pts = poly.concat([poly[0]]).map(([x, y]) => V(x, y, 2))
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), hiLine)
  l.computeLineDistances()
  hiGroup.add(m, l)
}

// ---------- Cards and labels (same as the 2D map) ----------
const FEAT = {}
D.features.forEach(f => { FEAT[f.id] = f })
const cap = s => (s || '').charAt(0).toUpperCase() + (s || '').slice(1)
;(D.trees || []).forEach((t, i) => { FEAT['tree-' + i] = { id: 'tree-' + i, name: ((D.kinds || {})[t.kind] || {}).label || cap(t.kind || 'Tree'), kicker: t.group || 'Trees', text: t.note || '' } })
;(D.sightings || []).forEach((s, i) => { FEAT['sighting-' + i] = { id: 'sighting-' + i, name: cap(s.what), kicker: 'Wildlife' + (s.when ? ' · ' + s.when : ''), text: s.note || '', label: [s.x, s.y, 20], minor: true } })

const card = document.getElementById('card')
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function chartHTML(f) {
  if (!f.chart) return ''
  if (f.chart === 'river') {
    const rows = D.river || []
    if (!rows.length) return '<div class="chart"><div class="t">High water by season</div><div class="empty">No river readings yet</div></div>'
    return '<div class="chart"><div class="t">High water by season</div>' + rows.map(r => `<div>${esc(r.season)}: <b>${esc(r.level)}</b> ${esc(r.note || '')}</div>`).join('') + '</div>'
  }
  const Y = D.yields || {}
  const ys = (Y[f.chart] || []).slice().sort((a, b) => a.year - b.year)
  if (!ys.length) return '<div class="chart"><div class="t">Harvest, net lbs</div><div class="empty">No yield numbers yet.</div></div>'
  const fmt = n => n.toLocaleString('en-US')
  const allYears = [...new Set(Object.values(Y).flat().map(y => y.year))].sort()
  const last = ys[ys.length - 1]
  const best = ys.reduce((a, b) => (b.lbs > a.lbs ? b : a))
  const peers = Object.keys(Y).map(k => [k, (Y[k] || []).find(y => y.year === last.year)])
  const total = peers.reduce((s, p) => s + (p[1] ? p[1].lbs : 0), 0), top = Math.max(...peers.map(p => (p[1] ? p[1].lbs : 0)))
  const max = Math.max(...ys.map(y => y.lbs))
  let html = `<div class="chart"><div class="t">Net harvest by year</div>
    <div class="bars" style="margin:18px 0 22px">` + allYears.map(yr => {
      const y = ys.find(v => v.year === yr)
      if (!y) return `<div class="bar none" title="No weigh tag for ${yr}"><em>?</em><span>'${String(yr).slice(2)}</span></div>`
      return `<div class="bar${y === best ? ' best' : ''}" style="height:${(y.lbs / max) * 100}%" title="${fmt(y.lbs)} lbs · ${y.bins} bins · ${y.date}${(D.harvestNotes || {})[yr] ? ' · light year' : ''}"><em>${(y.lbs / 1000).toFixed(1)}k</em><span>'${String(yr).slice(2)}</span></div>`
    }).join('') + `</div>
    <div class="big">${fmt(last.lbs)} lbs<small>${last.year} · ${(last.lbs / 2000).toFixed(1)} tons · ${last.bins} bins · best year ${best.year} (${fmt(best.lbs)} lbs)</small></div>
    <div class="t" style="margin-top:14px">${last.year} across the vineyard</div>
    <div class="cmp">` + peers.map(([k, y]) => `<div class="row${k === f.chart ? ' me' : ''}"><span>${esc((FEAT[k] || {}).name || k)}</span><i style="width:${y ? (y.lbs / top) * 100 : 0}%"></i><b>${y ? fmt(y.lbs) : '—'}</b></div>`).join('') + `</div>
    <p class="note" style="margin-top:10px">Whole vineyard, ${last.year}: ${fmt(total)} lbs (${(total / 2000).toFixed(1)} tons). From Schramsberg weigh tags.</p>`
    const hn = (D.harvestNotes || {})[last.year]
    if (hn) html += `<p class="hnote"><b>${last.year}:</b> ${esc(hn)}</p>`
    if (D.wine) html += `<p><a class="more" href="${esc(D.wine.url)}" target="_blank" rel="noopener">Our wine: ${esc(D.wine.short)} →</a></p>`
  return html + '</div>'
}
function showCard(id) {
  const f = FEAT[id]
  if (!f) { card.classList.remove('show'); return }
  const note = f.group === 'vineyard' ? '<p class="note">Block lines on the map are a placeholder until we know where they really fall.</p>' : ''
  card.innerHTML = `<button class="x" aria-label="Close">×</button>
    <div class="k">${esc(f.kicker || '')}</div><h2>${esc(f.name)}</h2>
    ${f.text ? `<p>${esc(f.text)}</p>` : ''}${chartHTML(f)}${f.link ? `<p><a class="more" href="../${esc(f.link[0])}">${esc(f.link[1])} →</a></p>` : ''}${note}
    ${f.needs ? `<div class="gap">Still to fill in: ${esc(f.needs)}</div>` : ''}`
  card.classList.add('show')
  card.querySelector('.x').onclick = () => select(null)
}
const WINE = new THREE.Color('#7A1F3D')
let hotId = null, pinned = null
function markHot(id) {
  if (id === hotId) return
  if (hotId) (byF[hotId] || []).forEach(m => [].concat(m.material).forEach(mt => mt.emissive && mt.emissive.setRGB(0, 0, 0)))
  hotId = id
  labelEls.forEach((e, k) => e.classList.toggle('on', k === id))
  if (!id) { hiGroup.clear(); return }
  ;(byF[id] || []).forEach(m => [].concat(m.material).forEach(mt => mt.emissive && mt.emissive.copy(WINE).multiplyScalar(0.35)))
  showFootprint(id)
}
function select(id) {
  pinned = id
  markHot(id)
  id ? showCard(id) : card.classList.remove('show')
}

const labelBox = document.getElementById('labels')
const labelEls = new Map()
Object.values(FEAT).forEach(f => {
  if (!f.label) return
  const b = document.createElement('button')
  b.className = 'lbl'
  b.innerHTML = `<i></i>${esc(f.name)}`
  if (f.group === 'vineyard') b.style.setProperty('--dot', '#6A9A3E')
  b.onclick = e => { e.stopPropagation(); select(pinned === f.id ? null : f.id) }
  b.onpointerenter = () => { if (!pinned && matchMedia('(hover: hover)').matches) { markHot(f.id); showCard(f.id) } }
  b.onpointerleave = () => { if (!pinned) { markHot(null); card.classList.remove('show') } }
  labelBox.appendChild(b)
  labelEls.set(f.id, b)
})
const tmp = new THREE.Vector3()
function placeLabels() {
  const show = document.body.dataset.labels !== 'off'
  const ppu = innerWidth / ((camera.right - camera.left) / camera.zoom)
  labelEls.forEach((e, id) => {
    const f = FEAT[id]
    tmp.copy(V(f.label[0], f.label[1], Math.max(f.label[2], 12))).project(camera)
    e.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'
    e.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px'
    const tooSmall = (ppu < 0.45 && (f.minor || ['hedgerow', 'meadow', 'pool', 'roses', 'leach', 'tablegrapes'].includes(id))) || (ppu < 0.7 && ['gym', 'kitchen', 'poolheat', 'bunnies'].includes(id)) || (ppu < 0.2 && id === 'solar')
    e.classList.toggle('hide', !show || tooSmall)
  })
}

// ---------- View ----------
const ISO_DIR = new THREE.Vector3(Math.cos(30 * deg) * Math.sin(45 * deg), Math.sin(30 * deg), Math.cos(30 * deg) * Math.cos(45 * deg))
function frustum() {
  const aspect = innerWidth / innerHeight
  const portrait = aspect < 0.9
  const halfW = portrait ? innerWidth / (2 * 0.34) : Math.max(1060, 600 * aspect)
  Object.assign(camera, { left: -halfW, right: halfW, top: halfW / aspect, bottom: -halfW / aspect })
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  return portrait
}
function resetView() {
  const portrait = frustum()
  const tgt = portrait ? V(900, 760, 0) : V(W / 2, H / 2, -DEPTH / 2)
  controls.target.copy(tgt)
  camera.position.copy(tgt).addScaledVector(ISO_DIR, 3000)
  camera.zoom = 1
  camera.updateProjectionMatrix()
  controls.update()
}
resetView()
addEventListener('resize', frustum)

// ---------- Pointer: tap to select, hover to preview ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
function pick(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObjects([...pickables, top], false)[0]
  if (!hit) return null
  if (hit.object.userData.f) return hit.object.userData.f
  if (hit.object === top) return groundFeature(hit.point.x + W / 2, hit.point.z + H / 2)
  return null
}
const cvs = renderer.domElement
let down = null
cvs.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY] })
cvs.addEventListener('pointerup', e => {
  if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) {
    const id = pick(e.clientX, e.clientY)
    select(id && id !== pinned ? id : null)
  }
  down = null
})
let hoverQueued = null
cvs.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || pinned || e.buttons) return
  hoverQueued = [e.clientX, e.clientY]
})
cvs.addEventListener('pointerleave', () => { if (!pinned) { markHot(null); card.classList.remove('show') } })

const btn = id => document.getElementById(id)
btn('zIn').onclick = () => { camera.zoom = Math.min(camera.zoom * 1.4, controls.maxZoom); camera.updateProjectionMatrix() }
btn('zOut').onclick = () => { camera.zoom = Math.max(camera.zoom / 1.4, controls.minZoom); camera.updateProjectionMatrix() }
btn('zFit').onclick = resetView
btn('tSpin').onclick = e => { controls.autoRotate = !controls.autoRotate; e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate)) }
btn('tLabels').onclick = e => {
  const off = document.body.dataset.labels !== 'off'
  document.body.dataset.labels = off ? 'off' : 'on'
  e.currentTarget.setAttribute('aria-pressed', String(!off))
}
addEventListener('keydown', e => { if (e.key === 'Escape') select(null) })

// ---------- Loop ----------
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const t0 = performance.now()
const northArrow = document.querySelector('#north svg g')
const nA = new THREE.Vector3(), nB = new THREE.Vector3()
let lastHover = null
renderer.setAnimationLoop(() => {
  const t = (performance.now() - t0) / 1000
  nA.copy(V(W / 2, H / 2)).project(camera); nB.copy(V(W / 2, H / 2 - 200)).project(camera)
  const ang = Math.atan2((nB.x - nA.x) * innerWidth, (nB.y - nA.y) * innerHeight) * 180 / Math.PI
  if (northArrow) northArrow.setAttribute('transform', `rotate(${ang.toFixed(1)})`)
  controls.update()
  if (!reduced) for (const [ring, dly] of ripples) {
    const p = ((t + dly) % 3) / 3
    ring.scale.setScalar(6 + p * 18)
    ring.material.opacity = 0.7 * (1 - p)
  }
  if (hoverQueued) {
    const id = pick(...hoverQueued)
    hoverQueued = null
    if (id !== lastHover && !pinned) { lastHover = id; markHot(id); id ? showCard(id) : card.classList.remove('show') }
  }
  placeLabels()
  renderer.render(scene, camera)
})
