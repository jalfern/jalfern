// Oliven isometric map. Plain SVG, no libraries.
// Plan coordinates = pixels on the aerial photo. Screen = 2:1 isometric of plan.
(function () {
  const D = window.OLIVEN
  const W = 1374, H = 1458, DEPTH = 46
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.getElementById('map')
  const P = (x, y, z = 0) => [x - y, (x + y) / 2 - z]
  const pts = arr => arr.map(p => p.join(',')).join(' ')
  const planPts = arr => arr.map(([x, y]) => x + ',' + y).join(' ')
  const ISO = 'matrix(1 0.5 -1 0.5 0 0)'

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    if (parent) parent.appendChild(e)
    return e
  }
  // Flat layer drawn in plan coordinates, lifted by z.
  function flatLayer(parent, z = 0, attrs = {}) {
    const lift = el('g', Object.assign({ transform: `translate(0 ${-z})` }, attrs), parent)
    return el('g', { transform: ISO }, lift)
  }

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

  // ---------- Layers ----------
  const root = el('g', {}, svg)
  const defs = el('defs', {}, svg)
  const L = {
    base: el('g', {}, root), ground: el('g', {}, root), water: el('g', {}, root),
    roads: el('g', {}, root), vines: el('g', {}, root), objects: el('g', {}, root),
    marks: el('g', {}, root), outline: el('g', { 'pointer-events': 'none' }, root),
  }

  // Diorama block: two earth faces under the property.
  ;(function base() {
    const g = L.base
    const south = [P(0, H), P(W, H), P(W, H, -DEPTH), P(0, H, -DEPTH)]
    const east = [P(W, 0), P(W, H), P(W, H, -DEPTH), P(W, 0, -DEPTH)]
    el('polygon', { points: pts(south), fill: C.soil }, g)
    el('polygon', { points: pts(east), fill: C.soil2 }, g)
    // Topsoil band
    el('polygon', { points: pts([P(0, H), P(W, H), P(W, H, -10), P(0, H, -10)]), fill: C.soilTop }, g)
    el('polygon', { points: pts([P(W, 0), P(W, H), P(W, H, -10), P(W, 0, -10)]), fill: '#7A5638' }, g)
    // Pebbles in the earth
    seed = 3
    for (let i = 0; i < 60; i++) {
      const onSouth = rnd() < 0.5, u = rnd(), v = 16 + rnd() * (DEPTH - 22)
      const [sx, sy] = onSouth ? P(u * W, H, -v) : P(W, u * H, -v)
      el('ellipse', { cx: sx, cy: sy, rx: 3 + rnd() * 4, ry: 2 + rnd() * 2, fill: onSouth ? '#7C573A' : '#8C6746', opacity: .8 }, g)
    }
    el('polyline', { points: pts([P(0, H, -DEPTH), P(W, H, -DEPTH), P(W, 0, -DEPTH)]), fill: 'none', stroke: C.outline, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g)
    el('polygon', { points: pts([P(0, 0), P(W, 0), P(W, H), P(0, H)]), fill: 'none', stroke: C.outline, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g)
  })()

  // Ground
  ;(function ground() {
    const g = flatLayer(L.ground)
    el('rect', { x: 0, y: 0, width: W, height: H, fill: C.straw }, g)
    // Neighbor fields, muted with plough lines
    el('polygon', { points: planPts(NEIGHBOR), fill: C.neighbor }, g)
    const clip = el('clipPath', { id: 'nclip' }, defs)
    el('polygon', { points: planPts(NEIGHBOR) }, clip)
    const ng = el('g', { 'clip-path': 'url(#nclip)' }, g)
    for (let y = 10; y < 1100; y += 22) el('line', { x1: 0, y1: y, x2: 600, y2: y - 30, stroke: C.neighborLine, 'stroke-width': 4 }, ng)
    el('polyline', { points: planPts([[178, 0], [172, 200], [168, 380], [176, 530]]), fill: 'none', stroke: '#B6A57A', 'stroke-width': 10, 'stroke-linecap': 'round' }, g)
    // Meadow with mown paths
    const mg = el('g', { 'data-f': 'meadow' }, g)
    el('polygon', { points: planPts(MEADOW), fill: C.meadow }, mg)
    const pathStyle = { fill: 'none', stroke: C.path, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
    el('polyline', Object.assign({ points: planPts([[1150, 380], [1230, 470], [1300, 580], [1350, 690]]) }, pathStyle), mg)
    el('polyline', Object.assign({ points: planPts([[1060, 440], [1110, 560], [1135, 700]]) }, pathStyle), mg)
    el('polyline', Object.assign({ points: planPts([[1120, 420], [1200, 470], [1255, 470]]) }, pathStyle), mg)
    el('circle', Object.assign({ cx: 1255, cy: 498, r: 26 }, pathStyle), mg)
    // Lawn strip south of vineyard
    el('rect', { x: LAWN[0], y: LAWN[1], width: LAWN[2] - LAWN[0], height: LAWN[3] - LAWN[1], rx: 6, fill: C.lawn }, el('g', { 'data-f': 'leach' }, g))
    el('rect', { x: CITRUS[0], y: CITRUS[1], width: CITRUS[2] - CITRUS[0], height: CITRUS[3] - CITRUS[1], rx: 8, fill: C.mulch }, el('g', { 'data-f': 'citrus' }, g))
    // Barn yard gravel
    el('polygon', { points: planPts(YARD), fill: C.road }, el('g', { 'data-f': 'barn' }, g))
    // Orchard: grass with a cross of gravel paths (trees are objects)
    const og = el('g', { 'data-f': 'orchard' }, g)
    el('rect', { x: ORCHARD[0], y: ORCHARD[1], width: ORCHARD[2] - ORCHARD[0], height: ORCHARD[3] - ORCHARD[1], rx: 6, fill: C.orchard }, og)
    el('line', { x1: 1171, y1: 722, x2: 1171, y2: 846, stroke: C.path, 'stroke-width': 7 }, og)
    // Rose garden: beds around a parterre
    const rg = el('g', { 'data-f': 'roses' }, g)
    el('rect', { x: ROSES[0], y: ROSES[1], width: ROSES[2] - ROSES[0], height: ROSES[3] - ROSES[1], rx: 6, fill: C.garden }, rg)
    for (const [x, y, w, h] of [[1218, 730, 14, 112], [1290, 730, 46, 40], [1290, 790, 46, 44]]) el('rect', { x, y, width: w, height: h, rx: 3, fill: C.bed }, rg)
    el('rect', { x: 1236, y: 752, width: 46, height: 78, fill: '#F4EEDF', stroke: '#B8AB8A', 'stroke-width': 3 }, rg)
    for (const [x, y] of [[1241, 757], [1261, 757], [1241, 795], [1261, 795]]) el('rect', { x, y, width: 16, height: 30, rx: 2, fill: C.bed }, rg)
    el('circle', { cx: 1259, cy: 791, r: 5, fill: '#F4EEDF', stroke: '#B8AB8A', 'stroke-width': 2 }, rg)
    // Terrace + pool
    const pg = el('g', { 'data-f': 'pool' }, g)
    el('rect', { x: PATIO[0], y: PATIO[1], width: PATIO[2] - PATIO[0], height: PATIO[3] - PATIO[1], rx: 4, fill: C.patio }, pg)
    // SE yard
    el('polygon', { points: planPts([[1150, 1250], [1374, 1260], [1374, 1395], [1170, 1392]]), fill: '#E2D3AE' }, g)
  })()

  // Water: river corridor, pond, pool
  ;(function water() {
    const g = flatLayer(L.water, 0, { 'data-f': 'river' })
    el('polygon', { points: planPts(CORRIDOR), fill: '#B7AE7A' }, g)
    el('polyline', { points: planPts(RIVER), fill: 'none', stroke: C.bank, 'stroke-width': 34, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
    el('polyline', { points: planPts(RIVER), fill: 'none', stroke: C.river, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
    el('polyline', { points: planPts(RIVER), fill: 'none', stroke: '#8CC0CC', 'stroke-width': 3, 'stroke-dasharray': '18 26', 'stroke-linecap': 'round', class: 'flow' }, g)

    const pg = flatLayer(L.water, 0, { 'data-f': 'pond' })
    const { cx, cy, rx, ry, rot } = POND
    const t = `rotate(${rot} ${cx} ${cy})`
    el('ellipse', { cx, cy, rx: rx + 26, ry: ry + 24, transform: t, fill: C.berm }, pg)
    el('ellipse', { cx, cy, rx: rx + 6, ry: ry + 6, transform: t, fill: C.liner }, pg)
    el('ellipse', { cx, cy, rx, ry, transform: t, fill: C.water }, pg)
    el('ellipse', { cx: cx - 30, cy: cy - 25, rx: rx * .55, ry: ry * .35, transform: t, fill: C.waterHi, opacity: .5 }, pg)
    for (const [fx, fy, d] of [[1000, 162, 0], [940, 222, 1.2], [1010, 228, 2.1]]) {
      el('circle', { cx: fx, cy: fy, r: 5, fill: '#fff', opacity: .9 }, pg)
      const ring = el('circle', { cx: fx, cy: fy, r: 8, fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: .6 }, pg)
      el('animate', { attributeName: 'r', values: '6;22', dur: '3s', begin: d + 's', repeatCount: 'indefinite' }, ring)
      el('animate', { attributeName: 'opacity', values: '.7;0', dur: '3s', begin: d + 's', repeatCount: 'indefinite' }, ring)
    }
    el('rect', { x: 930, y: 268, width: 18, height: 14, fill: '#E8E1CC', stroke: '#fff', 'stroke-width': 2, transform: 'rotate(-20 939 275)' }, pg)
    el('rect', { x: 836, y: 318, width: 34, height: 8, fill: '#CFC3A3', transform: 'rotate(-35 853 322)' }, pg)

    const poolg = flatLayer(L.water, 0, { 'data-f': 'pool' })
    el('rect', { x: 1238, y: 975, width: 89, height: 41, rx: 4, fill: '#F7F2E6' }, poolg)
    el('rect', { x: 1243, y: 980, width: 79, height: 31, rx: 3, fill: C.pool }, poolg)
    el('path', { d: 'M1252 995 q10 -6 20 0 t20 0 t20 0', fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: .7 }, poolg)
  })()

  // Roads
  ;(function roads() {
    const g = flatLayer(L.roads)
    for (const line of [ROAD, SPUR, DRIVE, [[1056, 1010], [1092, 1002]]]) {
      el('polyline', { points: planPts(line), fill: 'none', stroke: C.roadEdge, 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
    }
    for (const line of [ROAD, SPUR, DRIVE, [[1056, 1010], [1092, 1002]]]) {
      el('polyline', { points: planPts(line), fill: 'none', stroke: C.road, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
    }
    // Greenwood Ave along the south edge (unlabeled on purpose)
    el('rect', { x: 0, y: 1432, width: W, height: 26, fill: '#9B978D' }, g)
    el('line', { x1: 0, y1: 1445, x2: W, y2: 1445, stroke: '#E9E3CF', 'stroke-width': 2, 'stroke-dasharray': '24 18' }, g)
  })()

  // Vineyard: soil, then rows per block, lifted for volume
  ;(function vines() {
    const soil = flatLayer(L.vines)
    el('polygon', { points: planPts(VINEYARD), fill: C.vineSoil }, soil)
    const vclip = el('clipPath', { id: 'vclip' }, defs)
    el('polygon', { points: planPts(VINEYARD) }, vclip)
    const rowsFor = (t0, t1) => {
      const out = []
      const c0 = 700 * ux + 900 * uy
      for (let t = t0 + 6; t < t1; t += 12.5) {
        const base = [nx * t, ny * t]
        const a = [base[0] + ux * (c0 - 1400), base[1] + uy * (c0 - 1400)]
        const b = [base[0] + ux * (c0 + 1400), base[1] + uy * (c0 + 1400)]
        out.push([a, b])
      }
      return out
    }
    for (let i = 0; i < 3; i++) {
      const id = 'block-' + (i + 1)
      const bclip = el('clipPath', { id: 'bclip' + i }, defs)
      el('polygon', { points: planPts(band(SPLITS[i], SPLITS[i + 1])) }, bclip)
      const grp = el('g', { 'data-f': id }, L.vines)
      // Hit area
      const hit = flatLayer(grp)
      el('g', { 'clip-path': 'url(#vclip)' }, hit).appendChild(Object.assign(el('polygon', { points: planPts(band(SPLITS[i], SPLITS[i + 1])), fill: 'transparent', 'clip-path': 'url(#bclip' + i + ')' })))
      const rows = rowsFor(SPLITS[i], SPLITS[i + 1])
      for (const [z, color, w] of [[3, C.vineSide, 7], [8, C.vine[i], 6]]) {
        const layer = flatLayer(grp, z)
        const c1 = el('g', { 'clip-path': 'url(#vclip)' }, layer)
        const c2 = el('g', { 'clip-path': `url(#bclip${i})` }, c1)
        for (const [a, b] of rows) el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, c2)
      }
      // Avenue between blocks
      if (i > 0) {
        const lg = flatLayer(L.vines, 9)
        const cl = el('g', { 'clip-path': 'url(#vclip)' }, lg)
        const t = SPLITS[i], L2 = 3000
        el('line', { x1: nx * t - ux * L2, y1: ny * t - uy * L2, x2: nx * t + ux * L2, y2: ny * t + uy * L2, stroke: C.road, 'stroke-width': 5, 'stroke-dasharray': '2 10', 'stroke-linecap': 'round', opacity: .9 }, cl)
      }
    }
  })()

  // ---------- Objects: trees, buildings, panels (depth-sorted) ----------
  const objects = []
  const tree = (x, y, r, f, kind = 'oak') => objects.push({ d: x + y, f, draw: g => drawTree(g, x, y, r, kind) })
  const DOTS = { rose: C.rose, 'grape-red': '#6E2343', 'grape-green': '#C4DA6E' }
  function drawTree(g, x, y, r, kind, dot) {
    const low = LOW.has(kind)
    const h = low ? r * .7 : r * 1.25
    const [bx, by] = P(x, y)
    const [sx, sy] = P(x + r * .45, y + r * .45)
    el('ellipse', { cx: sx, cy: sy, rx: r * 1.15, ry: r * .6, fill: '#2C3A18', opacity: .22 }, g)
    if (!low) el('rect', { x: bx - 2.5, y: by - h * .7, width: 5, height: h * .7, fill: '#5A4330' }, g)
    const rs = kind === 'cypress' ? r * .75 : r * 1.05
    const cy = by - h
    const pal = low ? ['#4E7A34', C.shrub, '#8DB866'] : kind === 'fruit' ? ['#4F7F36', '#6E9F49', '#93C065'] : [C.oakLo, C.oak, C.oakHi]
    if (kind === 'cypress') {
      el('ellipse', { cx: bx, cy: cy - r * .4, rx: rs, ry: rs * 1.9, fill: pal[0], stroke: C.outline, 'stroke-width': 1.5 }, g)
      el('ellipse', { cx: bx - rs * .25, cy: cy - r * .7, rx: rs * .55, ry: rs * 1.3, fill: pal[2] }, g)
      return
    }
    el('circle', { cx: bx, cy, r: rs, fill: pal[0], stroke: C.outline, 'stroke-width': low ? 1 : 1.6 }, g)
    el('circle', { cx: bx - rs * .18, cy: cy - rs * .2, r: rs * .78, fill: pal[1] }, g)
    el('circle', { cx: bx - rs * .32, cy: cy - rs * .38, r: rs * .42, fill: pal[2] }, g)
    const dc = dot || DOTS[kind]
    if (dc) for (const [dx, dy] of [[-.3, -.4], [.35, -.1], [-.05, .25]]) el('circle', { cx: bx + rs * dx, cy: cy + rs * dy, r: rs * (dot ? .22 : .28), fill: dc, stroke: dot ? '#fff' : 'none', 'stroke-width': .8 }, g)
    if (!dc && !low) el('circle', { cx: bx - rs * .42, cy: cy - rs * .5, r: rs * .16, fill: C.oakTop }, g)
  }

  function box(x0, y0, x1, y1, h, o) {
    objects.push({ d: (x0 + x1) / 2 + (y0 + y1) / 2 + (o.bias || 0), f: o.f, draw: g => drawBox(g, x0, y0, x1, y1, h, o) })
  }
  function drawBox(g, x0, y0, x1, y1, h, o) {
    const S = { stroke: C.outline, 'stroke-width': 2, 'stroke-linejoin': 'round' }
    const poly = (a, fill) => el('polygon', Object.assign({ points: pts(a.map(p => P(...p))), fill }, S), g)
    const [sx, sy] = P(x1 + 6, y1 + 6)
    el('ellipse', { cx: sx, cy: sy, rx: (x1 - x0 + y1 - y0) * .55, ry: (x1 - x0 + y1 - y0) * .2, fill: '#2C3A18', opacity: .15 }, g)
    const rh = o.flat ? 0 : Math.min(x1 - x0, y1 - y0) * .42
    const Hh = h + rh, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2
    if (o.flat) {
      poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], o.wall)
      poly([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], o.wallSide)
      poly([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], o.roof)
      return
    }
    if (o.ridge === 'y') {
      poly([[x0, y0, h], [x0, y1, h], [xm, y1, Hh], [xm, y0, Hh]], o.roofSide)
      poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [xm, y1, Hh], [x0, y1, h]], o.wall)
      poly([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], o.wallSide)
      poly([[x1, y0, h], [x1, y1, h], [xm, y1, Hh], [xm, y0, Hh]], o.roof)
    } else {
      poly([[x0, y0, h], [x1, y0, h], [x1, ym, Hh], [x0, ym, Hh]], o.roofSide)
      poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], o.wall)
      poly([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, ym, Hh], [x1, y0, h]], o.wallSide)
      poly([[x0, y1, h], [x1, y1, h], [x1, ym, Hh], [x0, ym, Hh]], o.roof)
    }
    // Windows on the south face
    if (o.windows) {
      const n = Math.max(1, Math.floor((x1 - x0) / 22))
      for (let i = 0; i < n; i++) {
        const wx = x0 + (i + .5) * (x1 - x0) / n
        el('polygon', { points: pts([P(wx - 4, y1, h * .35), P(wx + 4, y1, h * .35), P(wx + 4, y1, h * .75), P(wx - 4, y1, h * .75)]), fill: '#5B7F95' }, g)
      }
    }
  }
  const HOUSE = { wall: C.wall, wallSide: C.wallSide, roof: C.slate, roofSide: C.slateSide, windows: true }

  function panel(cx, cy, len, wid, ang, f) {
    objects.push({ d: cx + cy, f, draw: g => {
      const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx
      const c = (s, t) => [cx + dx * s * len / 2 + px * t * wid / 2, cy + dy * s * len / 2 + py * t * wid / 2]
      const A = c(-1, -1), B = c(1, -1), Cc = c(1, 1), Dd = c(-1, 1)
      const [sx, sy] = P(cx + 8, cy + 8)
      el('ellipse', { cx: sx, cy: sy, rx: len * .6, ry: len * .22, fill: '#2C3A18', opacity: .15 }, g)
      const zb = 14, zf = 5
      el('polygon', { points: pts([P(...Dd, 0), P(...Cc, 0), P(...Cc, zf), P(...Dd, zf)]), fill: '#8A96A3' }, g)
      el('polygon', { points: pts([P(...A, zb), P(...B, zb), P(...Cc, zf), P(...Dd, zf)]), fill: C.solar, stroke: C.frame, 'stroke-width': 2 }, g)
      for (let i = 1; i < 6; i++) {
        const s = -1 + i / 3
        el('line', { x1: P(...c(s, -1), zb)[0], y1: P(...c(s, -1), zb)[1], x2: P(...c(s, 1), zf)[0], y2: P(...c(s, 1), zf)[1], stroke: C.solarLine, 'stroke-width': 1 }, g)
      }
      el('line', { x1: P(...c(-1, 0), (zb + zf) / 2)[0], y1: P(...c(-1, 0), (zb + zf) / 2)[1], x2: P(...c(1, 0), (zb + zf) / 2)[0], y2: P(...c(1, 0), (zb + zf) / 2)[1], stroke: C.solarLine, 'stroke-width': 1 }, g)
    } })
  }

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
  // User-added fruit & nut trees
  const KINDS = D.kinds || {}
  ;(D.trees || []).forEach((t, i) => {
    const K = KINDS[t.kind] || { type: 'fruit', r: 9 }
    objects.push({ d: t.x + t.y, f: 'tree-' + i, draw: g => drawTree(g, t.x, t.y, t.r || K.r, K.type, K.dot) })
  })

  objects.sort((a, b) => a.d - b.d)
  for (const o of objects) {
    const g = el('g', o.f ? { 'data-f': o.f } : {}, L.objects)
    o.draw(g)
  }

  // Wildlife sightings
  ;(D.sightings || []).forEach((s, i) => {
    const [x, y] = P(s.x, s.y, 4)
    const g = el('g', { 'data-f': 'sighting-' + i }, L.marks)
    el('circle', { cx: x, cy: y, r: 10, fill: '#fff', stroke: C.outline, 'stroke-width': 2 }, g)
    el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 12 }, g).textContent = ({ otters: '🦦', salmon: '🐟', herons: '🐦', frogs: '🐸', coyote: '🐺', bobcat: '🐈', hares: '🐇' })[s.what] || '•'
  })

  // ---------- Features, footprints, labels, card ----------
  const FEAT = {}
  D.features.forEach(f => { FEAT[f.id] = f })
  ;(D.trees || []).forEach((t, i) => { FEAT['tree-' + i] = { id: 'tree-' + i, name: ((D.kinds || {})[t.kind] || {}).label || cap(t.kind || 'Tree'), kicker: t.group || 'Trees', text: t.note || '' } })
  ;(D.sightings || []).forEach((s, i) => { FEAT['sighting-' + i] = { id: 'sighting-' + i, name: cap(s.what), kicker: 'Wildlife' + (s.when ? ' · ' + s.when : ''), text: s.note || '', label: [s.x, s.y, 20], minor: true } })
  function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1) }

  const FOOT = {
    'block-1': { clip: 'bclip0' }, 'block-2': { clip: 'bclip1' }, 'block-3': { clip: 'bclip2' },
    pond: { ellipse: POND }, meadow: { poly: MEADOW }, orchard: { rect: ORCHARD }, roses: { rect: ROSES }, pool: { rect: [1205, 925, 1345, 1035] },
    gym: { rect: [1286, 872, 1328, 918] }, kitchen: { rect: [1262, 1038, 1336, 1086] }, poolheat: { rect: [1342, 754, 1374, 828] },
    barn: { poly: [[660, 325], [852, 356], [862, 458], [728, 462], [680, 382]] }, river: { poly: CORRIDOR },
    house: { rect: [1056, 948, 1150, 1054] }, cottage: { rect: [1191, 1062, 1276, 1202] },
    solar: { poly: [[1235, 105], [1305, 160], [1250, 340], [1180, 300]] }, hedgerow: { rect: [95, 1398, 1140, 1428] },
    citrus: { rect: CITRUS }, leach: { rect: LAWN }, tablegrapes: { rect: [814, 1303, 1016, 1319] }, bunnies: { rect: [1152, 1196, 1192, 1230] },
  }
  function outline(id) {
    L.outline.innerHTML = ''
    const fp = FOOT[id]
    if (!fp) return
    const g = flatLayer(L.outline, 1)
    const s = { fill: 'rgba(122,31,61,.10)', stroke: '#7A1F3D', 'stroke-width': 5, 'stroke-dasharray': '14 8', 'stroke-linejoin': 'round' }
    if (fp.poly) el('polygon', Object.assign({ points: planPts(fp.poly) }, s), g)
    if (fp.rect) el('rect', Object.assign({ x: fp.rect[0], y: fp.rect[1], width: fp.rect[2] - fp.rect[0], height: fp.rect[3] - fp.rect[1], rx: 8 }, s), g)
    if (fp.ellipse) { const e = fp.ellipse; el('ellipse', Object.assign({ cx: e.cx, cy: e.cy, rx: e.rx + 34, ry: e.ry + 32, transform: `rotate(${e.rot} ${e.cx} ${e.cy})` }, s), g) }
    if (fp.clip) {
      const c1 = el('g', { 'clip-path': 'url(#vclip)' }, g)
      const c2 = el('g', { 'clip-path': `url(#${fp.clip})` }, c1)
      el('polygon', Object.assign({ points: planPts(VINEYARD) }, s, { fill: 'rgba(122,31,61,.28)', 'stroke-width': 10 }), c2)
    }
  }

  const card = document.getElementById('card')
  const gapHTML = t => t.replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>')
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
        return `<div class="bar${y === best ? ' best' : ''}" style="height:${(y.lbs / max) * 100}%" title="${fmt(y.lbs)} lbs · ${y.bins} bins · ${y.date}"><em>${(y.lbs / 1000).toFixed(1)}k</em><span>'${String(yr).slice(2)}</span></div>`
      }).join('') + `</div>
      <div class="big">${fmt(last.lbs)} lbs<small>${last.year} · ${(last.lbs / 2000).toFixed(1)} tons · ${last.bins} bins · best year ${best.year} (${fmt(best.lbs)} lbs)</small></div>
      <div class="t" style="margin-top:14px">${last.year} across the vineyard</div>
      <div class="cmp">` + peers.map(([k, y]) => `<div class="row${k === f.chart ? ' me' : ''}"><span>${esc((FEAT[k] || {}).name || k)}</span><i style="width:${y ? (y.lbs / top) * 100 : 0}%"></i><b>${y ? fmt(y.lbs) : '—'}</b></div>`).join('') + `</div>
      <p class="note" style="margin-top:10px">Whole vineyard, ${last.year}: ${fmt(total)} lbs (${(total / 2000).toFixed(1)} tons). From Schramsberg weigh tags.</p>`
    return html + '</div>'
  }
  function showCard(id) {
    const f = FEAT[id]
    if (!f) { hideCard(); return }
    const vineyardNote = f.group === 'vineyard' ? '<p class="note">Block lines on the map are a placeholder until we know where they really fall.</p>' : ''
    card.innerHTML = `<button class="x" aria-label="Close">×</button>
      <div class="k">${esc(f.kicker || '')}</div><h2>${esc(f.name)}</h2>
      ${f.text ? `<p>${esc(f.text)}</p>` : ''}${chartHTML(f)}${vineyardNote}
      ${f.needs ? `<div class="gap">Still to fill in: ${gapHTML(esc(f.needs))}</div>` : ''}`
    card.classList.add('show')
    card.querySelector('.x').onclick = () => select(null)
  }
  function hideCard() { card.classList.remove('show') }

  let pinned = null, hovered = null
  function markHot(id) {
    svg.querySelectorAll('.hot').forEach(n => n.classList.remove('hot'))
    labelEls.forEach((e, k) => e.classList.toggle('on', k === id))
    if (!id) { L.outline.innerHTML = ''; return }
    svg.querySelectorAll(`[data-f="${id}"]`).forEach(n => n.classList.add('hot'))
    outline(id)
  }
  function select(id) {
    pinned = id
    markHot(id)
    id ? showCard(id) : hideCard()
  }

  // HTML labels, positioned from plan coords
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
    b.onpointerleave = () => { if (!pinned) { markHot(null); hideCard() } }
    labelBox.appendChild(b)
    labelEls.set(f.id, b)
  })

  // ---------- View: pan & zoom via viewBox ----------
  const FULL = { x: -H - 60, y: -170, w: W + H + 120, h: (W + H) / 2 + DEPTH + 230 }
  const CORE = (() => { // vineyard + house, for tall screens
    const a = P(560, 400), b = P(1374, 460), c = P(150, 1400), d = P(1374, 1458)
    const xs = [a[0], b[0], c[0], d[0]], ys = [a[1], b[1], c[1], d[1]]
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) - 80, y1 = Math.max(...ys) + DEPTH + 40
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  })()
  let vb = { ...FULL }
  const stage = document.getElementById('stage')
  function rect() { return svg.getBoundingClientRect() }
  function fit(target) {
    const r = rect(), ar = r.width / r.height
    let w = target.w, h = target.h
    if (w / h > ar) h = w / ar; else w = h * ar
    vb = { x: target.x + (target.w - w) / 2, y: target.y + (target.h - h) / 2, w, h }
    apply()
  }
  function apply() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
    const r = rect(), k = r.width / vb.w
    const show = document.body.dataset.labels !== 'off'
    labelEls.forEach((e, id) => {
      const f = FEAT[id]
      const [sx, sy] = P(...f.label)
      e.style.left = (sx - vb.x) * k + 'px'
      e.style.top = (sy - vb.y) * k + 'px'
      const tooSmall = (k < .45 && (f.minor || ['hedgerow', 'meadow', 'pool', 'roses', 'leach', 'tablegrapes'].includes(id))) || (k < .7 && ['gym', 'kitchen', 'poolheat', 'bunnies'].includes(id)) || (k < .2 && id === 'solar')
      e.classList.toggle('hide', !show || tooSmall)
    })
  }
  function zoomAt(factor, cx, cy) {
    const r = rect()
    const px = vb.x + (cx - r.left) / r.width * vb.w, py = vb.y + (cy - r.top) / r.height * vb.h
    const w = Math.min(Math.max(vb.w * factor, 300), FULL.w * 1.6)
    const f = w / vb.w
    vb = { x: px - (px - vb.x) * f, y: py - (py - vb.y) * f, w, h: vb.h * f }
    apply()
  }
  const initial = () => {
    if (innerWidth / innerHeight >= .9) return fit(FULL)
    const r = rect(), k = .34, w = r.width / k, h = r.height / k
    const [cx, cy] = P(900, 760)
    vb = { x: cx - w / 2, y: cy - h / 2, w, h }
    apply()
  }
  initial()
  addEventListener('resize', initial)

  stage.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * .0015), e.clientX, e.clientY) }, { passive: false })
  const ptrs = new Map()
  let moved = 0, downTarget = null, pinchD = 0
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId)
    ptrs.set(e.pointerId, [e.clientX, e.clientY])
    if (ptrs.size === 1) { moved = 0; downTarget = e.target }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); moved = 99 }
  })
  stage.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !pinned) {
        const n = e.target.closest && e.target.closest('[data-f]')
        const id = n ? n.dataset.f : null
        if (id !== hovered) { hovered = id; markHot(id); id ? showCard(id) : hideCard() }
      }
      return
    }
    const prev = ptrs.get(e.pointerId)
    ptrs.set(e.pointerId, [e.clientX, e.clientY])
    if (ptrs.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1]
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 6) {
        stage.classList.add('dragging')
        const k = vb.w / rect().width
        vb.x -= dx * k; vb.y -= dy * k; apply()
      }
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]
      const d = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (pinchD) zoomAt(pinchD / d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      pinchD = d
    }
  })
  const up = e => {
    ptrs.delete(e.pointerId)
    if (ptrs.size === 0) {
      stage.classList.remove('dragging')
      if (moved <= 6 && downTarget) {
        const n = downTarget.closest && downTarget.closest('[data-f]')
        const id = n ? n.dataset.f : null
        select(id && id !== pinned ? id : null)
      }
      downTarget = null; pinchD = 0
    }
  }
  stage.addEventListener('pointerup', up)
  stage.addEventListener('pointercancel', up)
  stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pinned && hovered) { hovered = null; markHot(null); hideCard() } })

  const btn = id => document.getElementById(id)
  btn('zIn').onclick = () => { const r = rect(); zoomAt(1 / 1.4, r.left + r.width / 2, r.top + r.height / 2) }
  btn('zOut').onclick = () => { const r = rect(); zoomAt(1.4, r.left + r.width / 2, r.top + r.height / 2) }
  btn('zFit').onclick = initial
  btn('tLabels').onclick = e => {
    const off = document.body.dataset.labels !== 'off'
    document.body.dataset.labels = off ? 'off' : 'on'
    e.currentTarget.setAttribute('aria-pressed', String(!off))
    apply()
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') select(null) })

  // Gentle river flow
  const flow = svg.querySelector('.flow')
  if (flow && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let off = 0
    const tick = () => { off -= .6; flow.setAttribute('stroke-dashoffset', off); requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }
})()
