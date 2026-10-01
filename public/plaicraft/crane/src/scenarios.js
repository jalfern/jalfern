// Locations + lift jobs. Each scenario returns a full config the game consumes:
// crane type & base, environment look, the load spec, target zone, obstacles,
// wind profile, difficulty flags, and the banksman's briefing.
import * as THREE from 'three';
import { surface, waterMaterial, rad } from './util.js';

// Scatter a few small props (barrels, pallets, cones) for lived-in detail.
function scatterProps(group, { x, z, spread = 14, seed = 1, count = 10 }) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const barrelMat = surface('steel', { color: '#3f6ea5', repeat: 1 });
  const rustMat = surface('steel', { color: '#8a5a3a', repeat: 1 });
  const woodMat = surface('wood', { repeat: 1 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xe8621a, roughness: 0.6 });
  for (let i = 0; i < count; i++) {
    const px = x + (rnd() - 0.5) * spread, pz = z + (rnd() - 0.5) * spread, t = rnd();
    if (t < 0.4) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 14), rnd() < 0.5 ? barrelMat : rustMat);
      b.position.set(px, 0.55, pz); b.castShadow = true; b.receiveShadow = true; group.add(b);
    } else if (t < 0.75) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.2), woodMat);
      p.position.set(px, 0.08, pz); p.rotation.y = rnd() * 3.14; p.receiveShadow = true; group.add(p);
    } else {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 12), coneMat);
      cone.position.set(px, 0.4, pz); cone.castShadow = true; group.add(cone);
    }
  }
}

function addProp(group, geo, mat, pos, rotY = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos.x, pos.y, pos.z);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

// The landing spot is a REAL, physical surface — timber dunnage sleepers laid on
// the deck/ground where the load goes — NOT a glowing marker. There is no visual
// "task" indicator; the banksman tells you where it goes and walks you in.
function makeTarget(group, physics, { x, z, padTop, size, yaw = 0, tolXZ, tolY, tolYaw }) {
  const padThick = 0.5;
  // Load-bearing physics surface (invisible thickness under the sleepers).
  physics.addStaticBox(
    { x: size.x + 1.2, y: padThick, z: size.z + 1.2 },
    { x, y: padTop - padThick / 2, z },
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    physics.mat.ground
  );
  // Timber sleepers (dunnage) — subtle, weathered wood.
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, padTop - 0.12, z); g.rotation.y = yaw;
  const span = size.z + 0.6;
  for (const ox of [-size.x / 2 + 0.5, 0, size.x / 2 - 0.5]) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.24, span), wood);
    sleeper.position.set(ox, 0, 0);
    sleeper.castShadow = true; sleeper.receiveShadow = true;
    g.add(sleeper);
  }
  group.add(g);

  return { x, z, padTop, yaw, tolXZ, tolY, tolYaw, size };
}

// Static obstacle: mesh + fragile physics box that fails the lift if struck hard.
function makeObstacle(group, physics, { size, pos, yaw = 0, color = 0x9099a0, breakImpulse = 900, label = 'structure' }) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const m = addProp(group, new THREE.BoxGeometry(size.x, size.y, size.z), mat, pos, yaw);
  const body = physics.addStaticBox(size, pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), physics.mat.obstacle);
  body.isObstacle = true;
  body.breakImpulse = breakImpulse;
  body.label = label;
  return { mesh: m, body };
}

// -------------------------------------------------------------------- helpers
function groundPlane(group, kind, { repeat = 26, seed = 1, color } = {}, y = 0.001) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), surface(kind, { repeat, seed, color }));
  g.rotation.x = -Math.PI / 2;
  g.position.y = y;
  g.receiveShadow = true;
  group.add(g);
  return g;
}

// =========================================================================
// 1. CONSTRUCTION — set a steel beam across two column heads (tower crane).
export function construction(physics) {
  const group = new THREE.Group();
  groundPlane(group, 'dirt', { repeat: 30, seed: 11 });

  // Building under construction to the NW.
  const concrete = surface('concrete', { repeat: 4, seed: 2 });
  const bx = -22, bz = -18;
  // Ground floor slab + existing columns.
  addProp(group, new THREE.BoxGeometry(16, 0.6, 14), concrete, { x: bx, y: 0.3, z: bz });
  for (const [ox, oz] of [[-6, -5], [6, -5], [-6, 5], [6, 5], [0, -5], [0, 5]]) {
    addProp(group, new THREE.BoxGeometry(0.9, 6, 0.9), concrete, { x: bx + ox, y: 3, z: bz + oz });
  }
  // First-floor slab already placed on the far side.
  addProp(group, new THREE.BoxGeometry(16, 0.5, 5.5), concrete, { x: bx, y: 6.25, z: bz - 4.2 });

  // The two column heads that must receive the beam (target span).
  const padTop = 6.5;
  const target = makeTarget(group, physics, {
    x: bx, z: bz + 5, padTop, size: { x: 8, y: 0.8, z: 0.8 },
    yaw: 0, tolXZ: 0.55, tolY: 0.35, tolYaw: rad(8),
  });

  // Scaffolding near the target — swing into it and the lift is scrapped.
  const scaffold = new THREE.MeshStandardMaterial({ color: 0x6d7278, metalness: 0.4, roughness: 0.6 });
  makeObstacle(group, physics, { size: { x: 0.4, y: 12, z: 0.4 }, pos: { x: bx + 6.5, y: 6, z: bz + 5 }, color: 0x6d7278, label: 'scaffolding' });
  makeObstacle(group, physics, { size: { x: 0.4, y: 12, z: 0.4 }, pos: { x: bx - 6.5, y: 6, z: bz + 5 }, color: 0x6d7278, label: 'scaffolding' });
  addProp(group, new THREE.BoxGeometry(13.4, 0.3, 0.3), scaffold, { x: bx, y: 8, z: bz + 5 });

  scatterProps(group, { x: 12, z: 9, spread: 12, seed: 31, count: 12 });

  // Site huts + fence for atmosphere.
  const hut = surface('steel', { color: '#3f6ea5', repeat: 2 });
  addProp(group, new THREE.BoxGeometry(6, 3, 3), hut, { x: 18, y: 1.5, z: 16 });
  addProp(group, new THREE.BoxGeometry(6, 3, 3), hut, { x: 24, y: 1.5, z: 16 });

  return {
    id: 'construction',
    title: 'Steel Erection — Beam Set',
    location: 'Downtown high-rise site',
    craneType: 'tower',
    craneBasePos: new THREE.Vector3(0, 0, 0),
    craneInit: { slew: 0, trolley: 10, hoist: 6 },
    difficulty: 'Moderate',
    group,
    env: {
      sunElev: 42, sunAzim: 130, sunIntensity: 2.4,
      fogColor: 0xcfd6dc, fogDensity: 0.0035,
      hemiSky: 0xbcd6ff, hemiGround: 0x6b5d47, ambient: 0.35,
      sky: 'day',
    },
    loadSpec: {
      size: { x: 8, y: 0.7, z: 0.7 }, mass: 3200,
      color: '#c24a3a', label: 'Steel beam · 3.2 t',
    },
    target,
    obstacles: 'auto',
    wind: { base: 3.5, gust: 3, dir: rad(20), enabled: true },
    blindLift: false,
    timeLimit: 0,
    objective: 'Lift the steel beam and land it squarely across the two column heads. Mind the scaffolding — keep the swing under control.',
    briefingLines: [
      'Morning. On the hook today, one steel beam, three point two tonnes.',
      'We\'re setting it across the two column heads on the north face, first floor.',
      'Watch your swing near the scaffold. Take the hoist up first, then bring it over easy.',
      'I\'ll walk you in. Cable up when ready.',
    ],
    tips: ['Hoist up to clearance FIRST', 'Slew slowly — long jibs swing hard', 'Level and square before lowering'],
  };
}

// =========================================================================
// 2. PORT — pick a container off the quay and land it in a ship cell out over
// the water (gantry). The trolley crosses the waterside leg onto the cantilever.
export function port(physics) {
  const group = new THREE.Group();
  groundPlane(group, 'asphalt', { repeat: 34, seed: 4 });

  // Water on the seaward side (z > ~10).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 260),
    waterMaterial()
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.5, 90);
  group.add(water);

  // Quay-side container stacks (landside, behind the crane).
  const ccols = ['#c0392b', '#2980b9', '#27ae60', '#e67e22', '#8e44ad'];
  for (let i = 0; i < 12; i++) {
    const c = ccols[i % ccols.length];
    const mat = surface('container', { color: c, seed: i + 1, repeat: 2 });
    const x = -30 + (i % 6) * 7;
    const stack = Math.floor(i / 6);
    addProp(group, new THREE.BoxGeometry(6.1, 2.6, 2.44), mat, { x, y: 1.3 + stack * 2.7, z: -26 });
  }

  // The ship, moored out over the water (+Z), reachable on the cantilever.
  const shipZ = 20;
  const hullMat = surface('hull', { repeat: 6 });
  addProp(group, new THREE.BoxGeometry(80, 6, 26), hullMat, { x: 2, y: 0.6, z: shipZ });
  addProp(group, new THREE.BoxGeometry(80, 2.4, 26), new THREE.MeshStandardMaterial({ color: 0x7a1c1c, roughness: 0.7 }), { x: 2, y: -2.6, z: shipZ });
  // Superstructure at the stern.
  addProp(group, new THREE.BoxGeometry(10, 9, 22), new THREE.MeshStandardMaterial({ color: 0xd8dde1, roughness: 0.6 }), { x: -34, y: 8, z: shipZ });
  // Already-loaded containers on deck.
  for (let i = 0; i < 8; i++) {
    const c = ccols[(i + 2) % ccols.length];
    const mat = surface('container', { color: c, seed: i + 20, repeat: 2 });
    addProp(group, new THREE.BoxGeometry(6.1, 2.6, 2.44), mat, { x: -22 + (i % 4) * 6.3, y: 5, z: shipZ - 6 + Math.floor(i / 4) * 6 });
  }

  const padTop = 3.7; // ship deck top
  const cellX = 8, cellZ = shipZ;
  const target = makeTarget(group, physics, {
    x: cellX, z: cellZ, padTop, size: { x: 6.1, y: 2.6, z: 2.44 },
    yaw: 0, tolXZ: 0.42, tolY: 0.4, tolYaw: rad(7),
  });

  // Cell guides flank the cell in X — lower straight down between them.
  const guideMat = 0x556066, guideH = 4;
  makeObstacle(group, physics, { size: { x: 0.3, y: guideH, z: 3.2 }, pos: { x: cellX - 3.75, y: padTop + guideH / 2, z: cellZ }, color: guideMat, label: 'cell guide' });
  makeObstacle(group, physics, { size: { x: 0.3, y: guideH, z: 3.2 }, pos: { x: cellX + 3.75, y: padTop + guideH / 2, z: cellZ }, color: guideMat, label: 'cell guide' });

  return {
    id: 'port',
    title: 'Ship-to-Shore — Cell Load',
    location: 'Container terminal, berth 4',
    craneType: 'gantry',
    craneBasePos: new THREE.Vector3(0, 0, 0),
    craneInit: { bridge: -8, trolley: -6, hoist: 10 },
    difficulty: 'Hard',
    group,
    env: {
      sunElev: 30, sunAzim: 210, sunIntensity: 2.2,
      fogColor: 0xbcc6cf, fogDensity: 0.0038,
      hemiSky: 0xaac4e0, hemiGround: 0x445055, ambient: 0.4,
      sky: 'day',
    },
    loadSpec: {
      size: { x: 6.05, y: 2.55, z: 2.4 }, mass: 24000, surface: 'container',
      color: '#e0a91b', label: 'Container · 24 t',
    },
    target,
    obstacles: 'auto',
    wind: { base: 5, gust: 4, dir: rad(300), enabled: true },
    blindLift: false,
    timeLimit: 0,
    objective: 'Hoist the container off the quay, travel out over the water, and lower it straight down into the ship cell between the guides. Kill the swing and square it up before you commit.',
    briefingLines: [
      'Box on the hook is a loaded forty-foot, twenty-four tonnes.',
      'Pick is on the quay. It goes into the open cell on the ship, out on the waterside.',
      'Hoist up, travel out over the water, then lower straight down between the guides.',
      'If she\'s swinging, do not commit. Take your time.',
    ],
    tips: ['Hoist high, then travel out to sea', 'Kill ALL swing before lowering', 'Lower dead-straight between the guides'],
  };
}

// =========================================================================
// 3. REFINERY — blind pick: target hidden behind a pipe rack (mobile crane).
export function refinery(physics) {
  const group = new THREE.Group();
  groundPlane(group, 'gravel', { repeat: 30, seed: 9 });

  const steel = surface('steel', { color: '#9aa1a7', repeat: 2 });
  const vessel = surface('steel', { color: '#dfe3e6', repeat: 3 });

  // Tall distillation columns + a big pipe rack that BLOCKS the sightline.
  for (const [x, z, h, r] of [[-30, 24, 26, 3], [-38, 20, 20, 2.4]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), vessel);
    col.position.set(x, h / 2, z);
    col.castShadow = true;
    group.add(col);
  }

  // Pipe rack wall between the crane and the drop zone (the blind wall).
  const rackX = -14;
  for (let i = 0; i < 5; i++) {
    makeObstacle(group, physics, { size: { x: 1.2, y: 14, z: 1.2 }, pos: { x: rackX, y: 7, z: 6 + i * 4 }, color: 0x7f868c, label: 'pipe rack' });
  }
  // horizontal pipes across the rack (visual)
  for (let y = 4; y <= 12; y += 2) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 18, 12), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(rackX, y, 14);
    group.add(pipe);
  }
  // A high crossover the load must clear on the way in.
  makeObstacle(group, physics, { size: { x: 6, y: 0.8, z: 0.8 }, pos: { x: rackX, y: 13.6, z: 10 }, color: 0x7f868c, label: 'pipe crossover' });

  // Drop zone: a foundation skid on the far side of the rack.
  const padTop = 1.2;
  const target = makeTarget(group, physics, {
    x: -30, z: 12, padTop, size: { x: 3.2, y: 2.2, z: 3.2 },
    yaw: 0, tolXZ: 0.4, tolY: 0.35, tolYaw: rad(10),
  });

  return {
    id: 'refinery',
    title: 'Blind Pick — Pump Skid',
    location: 'Petrochemical plant, unit 7',
    craneType: 'mobile',
    craneBasePos: new THREE.Vector3(-8, 0, 2),
    craneInit: { swing: rad(150), luff: rad(60), tele: 18, hoist: 8 },
    difficulty: 'Very Hard',
    group,
    env: {
      sunElev: 18, sunAzim: 255, sunIntensity: 1.8,
      fogColor: 0xc7c2b6, fogDensity: 0.006,
      hemiSky: 0xd7cdb6, hemiGround: 0x4a4740, ambient: 0.45,
      sky: 'hazy',
    },
    loadSpec: {
      size: { x: 3, y: 2, z: 3 }, mass: 9500,
      color: '#3f8f5b', label: 'Pump skid · 9.5 t',
    },
    target,
    obstacles: 'auto',
    wind: { base: 6, gust: 6, dir: rad(255), enabled: true },
    blindLift: true,
    timeLimit: 0,
    objective: 'The landing spot is behind the pipe rack — you cannot see it from the cab. Boom up over the crossover, then work entirely off the banksman\'s calls to set the skid on the foundation.',
    briefingLines: [
      'This one\'s a blind pick. You won\'t see the mark from where you\'re sat.',
      'Skid is nine and a half tonnes. It has to clear the pipe crossover going in.',
      'Boom up, take it high, and follow my voice. I\'ve got eyes on the load and the landing.',
      'Nothing sudden. When I say stop, you stop.',
    ],
    tips: ['You must rely on the banksman', 'Boom UP to clear the crossover', 'Small, deliberate moves only'],
  };
}

// =========================================================================
// 4. HIGH WIND — set a transformer on its bolts in a gusting crosswind.
export function windstorm(physics) {
  const group = new THREE.Group();
  groundPlane(group, 'dirt', { repeat: 24, seed: 21, color: '#5f6b5a' });

  const concrete = surface('concrete', { repeat: 4, seed: 6 });
  // Substation foundation with anchor bolts (tight target).
  addProp(group, new THREE.BoxGeometry(6, 0.8, 6), concrete, { x: -20, y: 0.4, z: 10 });
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.7, roughness: 0.4 });
  for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    addProp(group, new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), boltMat, { x: -20 + ox, y: 1.1, z: 10 + oz });
  }
  // Existing gear + fence.
  const gear = new THREE.MeshStandardMaterial({ color: 0x8f9499, metalness: 0.4, roughness: 0.6 });
  addProp(group, new THREE.BoxGeometry(3, 4, 3), gear, { x: -30, y: 2, z: 4 });
  addProp(group, new THREE.BoxGeometry(3, 4, 3), gear, { x: -30, y: 2, z: 16 });
  // Adjacent live gear you must not clip.
  makeObstacle(group, physics, { size: { x: 2, y: 5, z: 2 }, pos: { x: -14, y: 2.5, z: 10 }, color: 0xb04a4a, breakImpulse: 400, label: 'live switchgear' });

  const padTop = 0.8;
  const target = makeTarget(group, physics, {
    x: -20, z: 10, padTop, size: { x: 3, y: 2.4, z: 3 },
    yaw: 0, tolXZ: 0.28, tolY: 0.3, tolYaw: rad(5),
  });

  return {
    id: 'windstorm',
    title: 'Precision in Wind — Transformer Set',
    location: 'Substation upgrade, exposed ridge',
    craneType: 'mobile',
    craneBasePos: new THREE.Vector3(-4, 0, 4),
    craneInit: { swing: rad(-30), luff: rad(60), tele: 22, hoist: 8 },
    difficulty: 'Very Hard',
    group,
    env: {
      sunElev: 22, sunAzim: 60, sunIntensity: 1.9,
      fogColor: 0x9fa7ad, fogDensity: 0.007,
      hemiSky: 0x9fb3c6, hemiGround: 0x4b4f45, ambient: 0.5,
      sky: 'overcast',
    },
    loadSpec: {
      size: { x: 3, y: 2.3, z: 3 }, mass: 8000,
      color: '#4b5560', label: 'Transformer · 8 t',
    },
    target,
    obstacles: 'auto',
    wind: { base: 11, gust: 9, dir: rad(70), enabled: true, gusty: true },
    blindLift: false,
    timeLimit: 0,
    objective: 'Land the transformer squarely on its anchor bolts. A gusting crosswind is trying to sail the load — anticipate the swing, use micro-speed, and don\'t fight the gusts.',
    briefingLines: [
      'It\'s blowing hard up here, gusting. This transformer is eight tonnes and it\'s a big sail.',
      'She needs to land square on four bolts. Tolerance is tight.',
      'Anticipate the swing — steer into it, don\'t chase it. Ease everything.',
      'When there\'s a lull, that\'s when you set it. Wait for your moment.',
    ],
    tips: ['Anticipate gusts — don\'t chase the load', 'Use Shift micro-speed', 'Set it during a lull'],
  };
}

// A simple flatbed truck prop. Returns the bed-top Y for use as a target.
function makeTruck(group, { x, z, yaw = 0, color = 0x2a6cdb }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = yaw;
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.8 });
  for (const wx of [-4.5, -2.8, 2.8, 4.5]) for (const wz of [-1.3, 1.3]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16), wheelMat);
    w.rotation.x = Math.PI / 2; w.position.set(wx, 0.7, wz); g.add(w);
  }
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.6 }));
  chassis.position.set(0, 1.2, 0); chassis.castShadow = true; g.add(chassis);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 2.9), surface('wood', { repeat: 3 }));
  bed.position.set(1.5, 1.5, 0); g.add(bed);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.9), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 }));
  cab.position.set(-4.6, 2.6, 0); cab.castShadow = true; g.add(cab);
  group.add(g);
  return 1.65; // bed top height
}

// =========================================================================
// 5. DOCK CYCLE — the whole discharge/load cycle with a ship-to-shore gantry:
// ship → yard stack, ship → truck, then yard → ship.
export function dockcycle(physics) {
  const group = new THREE.Group();
  groundPlane(group, 'asphalt', { repeat: 34, seed: 4 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 260),
    waterMaterial());
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.5, 95); group.add(water);

  const shipZ = 20, deckTop = 3.7;
  const hullMat = surface('hull', { repeat: 6 });
  addProp(group, new THREE.BoxGeometry(90, 6, 26), hullMat, { x: 0, y: 0.6, z: shipZ });
  addProp(group, new THREE.BoxGeometry(90, 2.4, 26), new THREE.MeshStandardMaterial({ color: 0x7a1c1c, roughness: 0.7 }), { x: 0, y: -2.6, z: shipZ });
  addProp(group, new THREE.BoxGeometry(11, 10, 22), new THREE.MeshStandardMaterial({ color: 0xd8dde1, roughness: 0.6 }), { x: -38, y: 8.5, z: shipZ });
  // A few containers already on deck (visual context).
  const ccols = ['#c0392b', '#2980b9', '#27ae60', '#e67e22', '#8e44ad'];
  for (let i = 0; i < 6; i++) {
    const mat = surface('container', { color: ccols[i % 5], seed: i + 40, repeat: 2 });
    addProp(group, new THREE.BoxGeometry(6.1, 2.6, 2.44), mat, { x: -24 + i * 6.3, y: deckTop + 1.3, z: shipZ + 4 });
  }
  // Truck on the quay + yard footprint marks.
  const bedTop = makeTruck(group, { x: -20, z: -9 });
  scatterProps(group, { x: -26, z: -6, spread: 16, seed: 51, count: 14 });

  const cont = { x: 6.05, y: 2.55, z: 2.4 };
  const stack = makeTarget(group, physics, { x: -11, z: -9, padTop: 0, size: cont, yaw: 0, tolXZ: 0.7, tolY: 0.4, tolYaw: rad(12) });
  const onTruck = makeTarget(group, physics, { x: -20, z: -9, padTop: bedTop, size: cont, yaw: 0, tolXZ: 0.5, tolY: 0.4, tolYaw: rad(9) });
  const shipCell = makeTarget(group, physics, { x: 8, z: shipZ, padTop: deckTop, size: cont, yaw: 0, tolXZ: 0.45, tolY: 0.4, tolYaw: rad(8) });
  const guideH = 4;
  makeObstacle(group, physics, { size: { x: 0.3, y: guideH, z: 3.2 }, pos: { x: 8 - 3.75, y: deckTop + guideH / 2, z: shipZ }, color: 0x556066, label: 'cell guide' });
  makeObstacle(group, physics, { size: { x: 0.3, y: guideH, z: 3.2 }, pos: { x: 8 + 3.75, y: deckTop + guideH / 2, z: shipZ }, color: 0x556066, label: 'cell guide' });

  const spec = (mass, color, label) => ({ size: cont, mass, color, label, surface: 'container' });
  return {
    id: 'dockcycle',
    title: 'Full Dock Cycle',
    location: 'Container terminal, berth 7',
    craneType: 'gantry',
    craneBasePos: new THREE.Vector3(0, 0, 0),
    craneInit: { bridge: 6, trolley: 16, hoist: 12 },
    difficulty: 'Hard',
    group,
    env: { sunElev: 34, sunAzim: 200, sunIntensity: 2.3, fogColor: 0xbcc6cf, fogDensity: 0.0035, hemiSky: 0xaac4e0, hemiGround: 0x445055, ambient: 0.4, sky: 'day' },
    stages: [
      { loadSpec: spec(20000, '#c0392b', 'Container · 20 t'), pick: { x: 6, z: shipZ + 4, y: deckTop }, target: stack, say: 'First off the ship — discharge her to the yard stack.' },
      { loadSpec: spec(26000, '#2980b9', 'Container · 26 t'), pick: { x: 0, z: shipZ + 4, y: deckTop }, target: onTruck, say: 'Next box straight onto the truck bed. Easy — it\'s a soft target.' },
      { loadSpec: spec(22000, '#27ae60', 'Container · 22 t'), pick: { x: -11, z: -9, y: 0 }, target: shipCell, say: 'Now load the yard box into the ship cell. Straight down between the guides.' },
    ],
    wind: { base: 5, gust: 4, dir: rad(300), enabled: true },
    blindLift: false,
    objective: 'Work the full cycle: discharge two boxes off the ship (one to the yard, one to the truck), then load a box from the yard into the ship cell.',
    briefingLines: [
      'Right, full cycle today. Three boxes.',
      'First two come off the ship — one to the yard stack, one onto the truck.',
      'Then we load the yard box back into the open cell. Mind the cell guides on that last one.',
      'Lower onto each box, I\'ll hook you on. Off we go.',
    ],
    tips: ['Lower the hook — the rigger hooks on', 'Truck bed is a soft, easy target', 'Ship cell is tight — go straight down'],
  };
}

// =========================================================================
// 6. CONSTRUCTION CYCLE — a tower crane placing a sequence of varied loads
// onto the structure: a steel beam, a heavy precast panel, and a pipe bundle.
export function constructioncycle(physics) {
  const group = new THREE.Group();
  groundPlane(group, 'dirt', { repeat: 30, seed: 11 });
  const concrete = surface('concrete', { repeat: 4, seed: 2 });
  const bx = -20, bz = -16;
  addProp(group, new THREE.BoxGeometry(18, 0.6, 16), concrete, { x: bx, y: 0.3, z: bz });
  for (const [ox, oz] of [[-7, -6], [7, -6], [-7, 6], [7, 6], [0, -6], [0, 6]]) {
    addProp(group, new THREE.BoxGeometry(0.9, 7, 0.9), concrete, { x: bx + ox, y: 3.5, z: bz + oz });
  }
  addProp(group, new THREE.BoxGeometry(18, 0.5, 6), concrete, { x: bx, y: 7.25, z: bz - 5 });
  // Laydown area near the crane (where loads are rigged).
  addProp(group, new THREE.BoxGeometry(14, 0.1, 10), surface('asphalt', { repeat: 3, seed: 4 }), { x: 12, y: 0.05, z: 8 });
  scatterProps(group, { x: 12, z: 8, spread: 11, seed: 71, count: 12 });

  const beam = makeTarget(group, physics, { x: bx, z: bz + 6, padTop: 7.5, size: { x: 8, y: 0.7, z: 0.7 }, yaw: 0, tolXZ: 0.55, tolY: 0.35, tolYaw: rad(8) });
  const panel = makeTarget(group, physics, { x: bx, z: bz - 5, padTop: 7.5, size: { x: 5, y: 2.6, z: 0.4 }, yaw: 0, tolXZ: 0.4, tolY: 0.3, tolYaw: rad(6) });
  const bundle = makeTarget(group, physics, { x: bx + 7, z: bz, padTop: 0.6, size: { x: 7, y: 0.8, z: 1.2 }, yaw: rad(90), tolXZ: 0.6, tolY: 0.4, tolYaw: rad(10) });
  // Scaffolding hazard near the beam target.
  makeObstacle(group, physics, { size: { x: 0.4, y: 13, z: 0.4 }, pos: { x: bx + 7.5, y: 6.5, z: bz + 6 }, color: 0x6d7278, label: 'scaffolding' });

  return {
    id: 'constructioncycle',
    title: 'Structure Build — Mixed Loads',
    location: 'High-rise site, level 2 set-out',
    craneType: 'tower',
    craneBasePos: new THREE.Vector3(0, 0, 0),
    craneInit: { slew: 0, trolley: 12, hoist: 8 },
    difficulty: 'Very Hard',
    group,
    env: { sunElev: 44, sunAzim: 140, sunIntensity: 2.5, fogColor: 0xcfd6dc, fogDensity: 0.0032, hemiSky: 0xbcd6ff, hemiGround: 0x6b5d47, ambient: 0.35, sky: 'day' },
    stages: [
      { loadSpec: { size: { x: 8, y: 0.7, z: 0.7 }, mass: 3200, color: '#c24a3a', label: 'Steel beam · 3.2 t' }, pick: { x: 12, z: 10, y: 0.1 }, target: beam, say: 'Steel beam first — across the two column heads. Mind the scaffold.' },
      { loadSpec: { size: { x: 5, y: 2.6, z: 0.4 }, mass: 6800, color: '#9aa1a7', surface: 'panel', label: 'Precast panel · 6.8 t' }, pick: { x: 14, z: 6, y: 0.1, yaw: rad(0) }, target: panel, say: 'Now the precast panel — it\'s a big sail, take the swing gently.' },
      { loadSpec: { size: { x: 7, y: 0.8, z: 1.2 }, mass: 2400, color: '#4b5560', label: 'Pipe bundle · 2.4 t' }, pick: { x: 10, z: 4, y: 0.1, yaw: rad(90) }, target: bundle, say: 'Last one, the pipe bundle, down onto the low stands. Watch the orientation.' },
    ],
    wind: { base: 4, gust: 4, dir: rad(20), enabled: true },
    blindLift: false,
    objective: 'Set three different loads: a steel beam across the columns, a heavy precast panel on the slab edge, and a pipe bundle onto the ground stands. Each behaves differently on the hook.',
    briefingLines: [
      'Three picks today, all different.',
      'Steel beam across the columns first, then the heavy precast panel on the slab edge.',
      'Finish with the pipe bundle on the low stands — mind the orientation on that one.',
      'Lower onto each and I\'ll hook you up.',
    ],
    tips: ['Panel is heavy and catches the wind', 'Square each load to its marks', 'Different loads swing differently'],
  };
}

// Lightweight metadata for the menu (no world building required).
construction.meta = {
  title: 'Steel Erection — Beam Set', location: 'Downtown high-rise site',
  difficulty: 'Moderate', craneType: 'tower',
  objective: 'Set a steel beam across two column heads without clipping the scaffolding.',
};
port.meta = {
  title: 'Ship-to-Shore — Cell Load', location: 'Container terminal, berth 4',
  difficulty: 'Hard', craneType: 'gantry',
  objective: 'Lower a 24-tonne container straight down into a tight ship cell between the guides.',
};
refinery.meta = {
  title: 'Blind Pick — Pump Skid', location: 'Petrochemical plant, unit 7',
  difficulty: 'Very Hard', craneType: 'mobile',
  objective: 'A blind lift behind a pipe rack — set the skid working entirely off the banksman\'s voice.',
};
windstorm.meta = {
  title: 'Precision in Wind — Transformer Set', location: 'Substation upgrade, exposed ridge',
  difficulty: 'Very Hard', craneType: 'mobile',
  objective: 'Land an 8-tonne transformer on its bolts through a gusting crosswind.',
};

dockcycle.meta = {
  title: 'Full Dock Cycle', location: 'Container terminal, berth 7',
  difficulty: 'Hard', craneType: 'gantry',
  objective: 'The whole cycle: discharge ship→yard and ship→truck, then load yard→ship cell.',
};
constructioncycle.meta = {
  title: 'Structure Build — Mixed Loads', location: 'High-rise site, level 2',
  difficulty: 'Very Hard', craneType: 'tower',
  objective: 'Set a steel beam, a heavy precast panel, and a pipe bundle — each handles differently.',
};

export const SCENARIOS = [construction, port, dockcycle, refinery, windstorm, constructioncycle];
