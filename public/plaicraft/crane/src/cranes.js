// Three crane types with authentic control layouts and kinematics.
//   - TowerCrane:  slew (rotate), trolley (radius), hoist            [horizontal jib]
//   - MobileCrane: swing, boom luff (angle), telescope (length), hoist
//   - GantryCrane: long-travel (bridge X), cross-travel (trolley Z), hoist
// Every crane exposes: update(dt,input,micro), anchor (THREE.Vector3),
// telemetry(), cameraRig(mode), controlHelp, axes, and self-collision bodies via
// initColliders()/updateColliders() so a load driven into the structure is caught.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { clamp, surface, deg, rad } from './util.js';

// Move `cur` toward `tgt` by at most `maxDelta`.
function approach(cur, tgt, maxDelta) {
  if (cur < tgt) return Math.min(cur + maxDelta, tgt);
  return Math.max(cur - maxDelta, tgt);
}

// A single proportional control axis with joystick-like ramping + limits.
class Axis {
  constructor({ value = 0, min, max, maxSpeed, accel, decel, wrap = false }) {
    this.value = value;
    this.min = min;
    this.max = max;
    this.maxSpeed = maxSpeed;
    this.accel = accel;
    this.decel = decel ?? accel * 1.6;
    this.wrap = wrap;
    this.vel = 0;
    this.intent = 0;
  }
  step(intent, dt, micro) {
    this.intent = intent;
    const target = intent * this.maxSpeed * (micro ? 0.28 : 1);
    const rate = (Math.abs(target) < Math.abs(this.vel) ? this.decel : this.accel) * dt;
    this.vel = approach(this.vel, target, rate);
    this.value += this.vel * dt;
    if (this.wrap) {
      if (this.value > Math.PI) this.value -= Math.PI * 2;
      if (this.value < -Math.PI) this.value += Math.PI * 2;
    } else if (this.value <= this.min) {
      this.value = this.min;
      if (this.vel < 0) this.vel = 0;
    } else if (this.value >= this.max) {
      this.value = this.max;
      if (this.vel > 0) this.vel = 0;
    }
  }
}

// Box beam between two points — the building block for lattice structure.
function beam(parent, a, b, t, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.BoxGeometry(t, t, len);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function steelMat(color) {
  return surface('steel', { color, repeat: 3 });
}

const YELLOW = '#e0a91b';
const DARK = '#3a3f45';

// ---------------------------------------------------------------------------
class BaseCrane {
  constructor() {
    this.group = new THREE.Group();
    this.anchor = new THREE.Vector3();
    this.basePos = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._colliders = [];
  }
  addTo(scene) {
    scene.add(this.group);
    return this;
  }
  dispose(scene) {
    scene.remove(this.group);
  }

  // Create a static box collision body tagged as crane structure.
  _mkCol(physics, sx, sy, sz, label = 'crane') {
    const b = new CANNON.Body({ mass: 0, material: physics.mat.obstacle });
    b.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    b.isCrane = true;
    b.label = label;
    physics.world.addBody(b);
    physics.transient.push(b);
    this._colliders.push(b);
    return b;
  }
  // Resize an existing box body (for the telescoping boom).
  _resizeCol(body, sx, sy, sz) {
    const he = body.shapes[0].halfExtents;
    he.set(sx / 2, sy / 2, sz / 2);
    body.shapes[0].updateConvexPolyhedronRepresentation();
    body.updateBoundingRadius();
    body.aabbNeedsUpdate = true;
  }
  initColliders() {}
  updateColliders() {}
}

// ============================ TOWER CRANE ==================================
export class TowerCrane extends BaseCrane {
  constructor() {
    super();
    this.name = 'Tower Crane (Luffing Trolley)';
    this.scheme = 'Two-lever: LEFT stick = slew + trolley, RIGHT stick = hoist';
    this.mastH = 44;
    this.jibLen = 52;

    this.axes = {
      slew: new Axis({ value: 0, min: -99, max: 99, maxSpeed: rad(9), accel: rad(9), wrap: true }),
      trolley: new Axis({ value: 30, min: 5, max: 48, maxSpeed: 6.5, accel: 9 }),
      hoist: new Axis({ value: 20, min: 2, max: 46, maxSpeed: 4.5, accel: 6 }), // cable length
    };

    this.controlHelp = [
      'A / D — slew jib left / right',
      'W / S — trolley out / in (radius)',
      '↑ / ↓ — hoist up / down',
      'Shift — micro-speed (fine control)',
    ];

    const yellow = steelMat(YELLOW);
    const dark = steelMat(DARK);
    this._build(yellow, dark);
  }

  _build(yellow, dark) {
    const g = this.group;
    // Concrete base pad.
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a9a95, roughness: 0.95 })
    );
    pad.position.y = 0.6;
    pad.receiveShadow = true;
    pad.castShadow = true;
    g.add(pad);

    // Lattice mast.
    const w = 2.2;
    const H = this.mastH;
    const seg = 3.0;
    const corners = [
      new THREE.Vector3(-w / 2, 0, -w / 2),
      new THREE.Vector3(w / 2, 0, -w / 2),
      new THREE.Vector3(w / 2, 0, w / 2),
      new THREE.Vector3(-w / 2, 0, w / 2),
    ];
    const mast = new THREE.Group();
    mast.position.y = 1.2;
    for (const c of corners) beam(mast, c, c.clone().setY(H), 0.28, yellow);
    for (let y = 0; y <= H; y += seg) {
      for (let i = 0; i < 4; i++) {
        const a = corners[i].clone().setY(y);
        const b = corners[(i + 1) % 4].clone().setY(y);
        beam(mast, a, b, 0.18, yellow);
      }
      // diagonals on two opposite faces per level (alternating)
      const yl = y, yh = Math.min(y + seg, H);
      if (yh > yl) {
        beam(mast, corners[0].clone().setY(yl), corners[1].clone().setY(yh), 0.14, yellow);
        beam(mast, corners[2].clone().setY(yl), corners[3].clone().setY(yh), 0.14, yellow);
      }
    }
    g.add(mast);
    this._mastTopY = 1.2 + H;

    // Slewing assembly (rotates).
    this.slewGroup = new THREE.Group();
    this.slewGroup.position.y = this._mastTopY;
    g.add(this.slewGroup);

    // Operator cab under the slew ring.
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.2, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4 })
    );
    cab.position.set(2.4, -0.2, 0);
    cab.castShadow = true;
    this.slewGroup.add(cab);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 1.2, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x88ccee, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.5 })
    );
    glass.position.set(2.4, 0.2, 0);
    this.slewGroup.add(glass);

    // Jib (front) — triangular truss along +X.
    const L = this.jibLen;
    const topY = 2.2;
    const chordBot = new THREE.Vector3(2, 0, 0);
    for (let x = 2; x < L; x += 3) {
      const nx = Math.min(x + 3, L);
      // bottom chords (two, spaced in z)
      beam(this.slewGroup, new THREE.Vector3(x, 0, -0.7), new THREE.Vector3(nx, 0, -0.7), 0.14, yellow);
      beam(this.slewGroup, new THREE.Vector3(x, 0, 0.7), new THREE.Vector3(nx, 0, 0.7), 0.14, yellow);
      // top ridge chord
      const th = topY * (1 - x / (L * 1.6));
      const thn = topY * (1 - nx / (L * 1.6));
      beam(this.slewGroup, new THREE.Vector3(x, th, 0), new THREE.Vector3(nx, thn, 0), 0.13, yellow);
      // web
      beam(this.slewGroup, new THREE.Vector3(x, 0, -0.7), new THREE.Vector3(x, th, 0), 0.1, yellow);
      beam(this.slewGroup, new THREE.Vector3(x, 0, 0.7), new THREE.Vector3(x, th, 0), 0.1, yellow);
      beam(this.slewGroup, new THREE.Vector3(x, 0, -0.7), new THREE.Vector3(nx, 0, 0.7), 0.08, yellow);
    }

    // A-frame + tie bars.
    const apex = new THREE.Vector3(0, 8, 0);
    beam(this.slewGroup, new THREE.Vector3(1, 2, -0.7), apex, 0.16, yellow);
    beam(this.slewGroup, new THREE.Vector3(1, 2, 0.7), apex, 0.16, yellow);
    beam(this.slewGroup, new THREE.Vector3(-1, 2, -0.7), apex, 0.16, yellow);
    beam(this.slewGroup, new THREE.Vector3(-1, 2, 0.7), apex, 0.16, yellow);
    // forestay tie bars to jib
    beam(this.slewGroup, apex, new THREE.Vector3(L * 0.5, topY * 0.66, 0), 0.09, dark);
    beam(this.slewGroup, apex, new THREE.Vector3(L, 0, 0), 0.09, dark);

    // Counter-jib + counterweight.
    const CJ = 16;
    for (let x = -2; x > -CJ; x -= 3) {
      const nx = Math.max(x - 3, -CJ);
      beam(this.slewGroup, new THREE.Vector3(x, 0, -0.7), new THREE.Vector3(nx, 0, -0.7), 0.14, yellow);
      beam(this.slewGroup, new THREE.Vector3(x, 0, 0.7), new THREE.Vector3(nx, 0, 0.7), 0.14, yellow);
    }
    beam(this.slewGroup, apex, new THREE.Vector3(-CJ, 0, 0), 0.09, dark);
    const cw = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 3, 3),
      new THREE.MeshStandardMaterial({ color: 0x777c82, roughness: 0.9 })
    );
    cw.position.set(-CJ + 1.5, -1, 0);
    cw.castShadow = true;
    this.slewGroup.add(cw);

    // Trolley (slides along jib).
    this.trolley = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.6, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.5 })
    );
    this.trolley.castShadow = true;
    this.slewGroup.add(this.trolley);
  }

  update(dt, input, micro) {
    this.axes.slew.step(input.axis('KeyD', 'KeyA'), dt, micro);
    this.axes.trolley.step(input.axis('KeyS', 'KeyW'), dt, micro);
    this.axes.hoist.step(input.axis('ArrowUp', 'ArrowDown'), dt, micro); // up = shorten
    this.slewGroup.rotation.y = this.axes.slew.value;
    const r = this.axes.trolley.value;
    this.trolley.position.set(r, -0.4, 0);
    // Anchor = trolley sheave, in world space.
    this._v.set(r, this._mastTopY - 0.7, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.axes.slew.value);
    this.anchor.copy(this.basePos).add(this._v);
    this.cableLen = this.axes.hoist.value;
  }

  get radius() {
    return this.axes.trolley.value;
  }

  initColliders(physics) {
    // The mast is the load's main self-collision hazard (swinging inboard).
    this._mast = this._mkCol(physics, 2.4, this.mastH, 2.4, 'mast');
    this._mast.position.set(this.basePos.x, this.basePos.y + 1.2 + this.mastH / 2, this.basePos.z);
    // Counterweight slab (rotates with the slew).
    this._cw = this._mkCol(physics, 3.6, 3, 3.2, 'counterweight');
  }
  updateColliders() {
    if (!this._cw) return;
    const s = this.axes.slew.value;
    const off = new THREE.Vector3(-14.5, this._mastTopY - 1, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), s);
    this._cw.position.set(this.basePos.x + off.x, off.y, this.basePos.z + off.z);
    this._cw.quaternion.setFromEuler(0, s, 0);
  }

  telemetry() {
    return [
      ['Slew', `${deg(this.axes.slew.value).toFixed(0)}°`],
      ['Radius', `${this.radius.toFixed(1)} m`],
      ['Hook height', `${(this.anchor.y - this.cableLen).toFixed(1)} m`],
    ];
  }

  cameraRig(mode) {
    const s = this.axes.slew.value;
    if (mode === 'cab') {
      // Just outside/below the cab, looking down the jib toward the hook.
      const pos = this.basePos.clone().add(
        new THREE.Vector3(4.6, this._mastTopY - 3, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), s)
      );
      const target = this.anchor.clone().setY(this.anchor.y - (this.cableLen || 10));
      return { pos, target };
    }
    // chase / external
    const pos = this.basePos.clone().add(new THREE.Vector3(-28, 30, 34));
    return { pos, target: this.basePos.clone().setY(this._mastTopY * 0.5) };
  }
}

// ============================ MOBILE CRANE =================================
export class MobileCrane extends BaseCrane {
  constructor() {
    super();
    this.name = 'All-Terrain Mobile Crane (Telescopic)';
    this.scheme = 'Swing + boom + telescope + hoist';
    this.pivot = new THREE.Vector3(1.6, 3.4, 0);

    this.axes = {
      swing: new Axis({ value: 0, min: -99, max: 99, maxSpeed: rad(11), accel: rad(10), wrap: true }),
      luff: new Axis({ value: rad(58), min: rad(28), max: rad(80), maxSpeed: rad(6), accel: rad(7) }),
      tele: new Axis({ value: 18, min: 12, max: 40, maxSpeed: 3.2, accel: 4 }),
      hoist: new Axis({ value: 12, min: 2, max: 40, maxSpeed: 4.0, accel: 5.5 }),
    };
    this.controlHelp = [
      'A / D — swing superstructure',
      'W / S — boom up / down (luff)',
      'Q / E — telescope extend / retract',
      '↑ / ↓ — hoist up / down',
      'Shift — micro-speed (fine control)',
    ];

    const yellow = steelMat(YELLOW);
    const dark = steelMat(DARK);
    this._build(yellow, dark);
  }

  _build(yellow, dark) {
    const g = this.group;
    // Carrier + crawler tracks.
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });
    for (const z of [-2.2, 2.2]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 1.6), trackMat);
      t.position.set(0, 0.7, z);
      t.castShadow = true;
      t.receiveShadow = true;
      g.add(t);
    }
    const carbody = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 3.4), dark);
    carbody.position.set(0, 1.9, 0);
    carbody.castShadow = true;
    g.add(carbody);
    // Outrigger pads.
    const padMat = new THREE.MeshStandardMaterial({ color: 0x888d92, roughness: 0.9 });
    for (const [x, z] of [[4.2, 3.2], [4.2, -3.2], [-4.2, 3.2], [-4.2, -3.2]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.4, 16), padMat);
      p.position.set(x, 0.2, z);
      p.receiveShadow = true;
      g.add(p);
      const beamO = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), yellow);
      beamO.position.set(x, 1.2, z);
      g.add(beamO);
    }

    // Superstructure (rotates about Y).
    this.superGroup = new THREE.Group();
    this.superGroup.position.set(0, 2.6, 0);
    g.add(this.superGroup);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.0, 3.2), yellow);
    deck.position.set(-0.4, 0.4, 0);
    deck.castShadow = true;
    this.superGroup.add(deck);
    // Counterweight stack at the rear.
    const cw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 3.2), new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.85 }));
    cw.position.set(-3.0, 1.0, 0);
    cw.castShadow = true;
    this.superGroup.add(cw);
    // Cab.
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.4 }));
    cab.position.set(1.4, 1.3, 1.4);
    cab.castShadow = true;
    this.superGroup.add(cab);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.0, 1.62),
      new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.5, roughness: 0.1 })
    );
    glass.position.set(1.4, 1.5, 1.4);
    this.superGroup.add(glass);

    // Boom pivot group (luffs about Z).
    this.boomPivot = new THREE.Group();
    this.boomPivot.position.copy(this.pivot).sub(new THREE.Vector3(0, 2.6, 0));
    this.superGroup.add(this.boomPivot);

    // Telescoping boom: a unit-length box (along +X) we scale.
    this.boomMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.1, 1.3),
      steelMat(YELLOW)
    );
    this.boomMesh.castShadow = true;
    this.boomPivot.add(this.boomMesh);
    // Boom tip sheave head.
    this.boomHead = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 1.0), dark);
    this.boomPivot.add(this.boomHead);
  }

  update(dt, input, micro) {
    this.axes.swing.step(input.axis('KeyD', 'KeyA'), dt, micro);
    this.axes.luff.step(input.axis('KeyS', 'KeyW'), dt, micro);
    this.axes.tele.step(input.axis('KeyE', 'KeyQ'), dt, micro);
    this.axes.hoist.step(input.axis('ArrowUp', 'ArrowDown'), dt, micro);

    const luff = this.axes.luff.value;
    const len = this.axes.tele.value;
    this.superGroup.rotation.y = this.axes.swing.value;
    this.boomPivot.rotation.z = luff;
    this.boomMesh.scale.x = len;
    this.boomMesh.position.set(len / 2, 0, 0);
    this.boomHead.position.set(len, 0, 0);

    // Tip in super-frame: pivot(local to super) + Rz(luff)*(len,0,0)
    const pivotLocal = this.boomPivot.position;
    const tipLocal = new THREE.Vector3(Math.cos(luff) * len, Math.sin(luff) * len, 0).add(pivotLocal);
    // to world: super rotation about Y then super position then base
    tipLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.axes.swing.value);
    this.anchor.copy(this.basePos).add(new THREE.Vector3(0, 2.6, 0)).add(tipLocal);
    this.cableLen = this.axes.hoist.value;
  }

  get radius() {
    return Math.hypot(this.anchor.x - this.basePos.x, this.anchor.z - this.basePos.z);
  }

  initColliders(physics) {
    this._superCol = this._mkCol(physics, 7.5, 3.0, 3.4, 'crane body');
    this._boomCol = this._mkCol(physics, 1, 1.1, 1.3, 'boom');
    this._qY = new THREE.Quaternion();
    this._qZ = new THREE.Quaternion();
  }
  updateColliders() {
    if (!this._superCol) return;
    const swing = this.axes.swing.value, luff = this.axes.luff.value, len = this.axes.tele.value;
    // Superstructure + counterweight block (rotates with swing).
    const so = new THREE.Vector3(-0.75, 1.0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), swing);
    this._superCol.position.set(this.basePos.x + so.x, this.basePos.y + 2.6 + so.y, this.basePos.z + so.z);
    this._superCol.quaternion.setFromEuler(0, swing, 0);
    // Boom shaft — collide the lower 80% so the hook at the tip stays free.
    this._qY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), swing);
    this._qZ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), luff);
    const q = this._qY.clone().multiply(this._qZ);
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const pivotOff = this.boomPivot.position.clone().applyQuaternion(this._qY);
    const pivotWorld = new THREE.Vector3(this.basePos.x, this.basePos.y + 2.6, this.basePos.z).add(pivotOff);
    const colLen = 0.8 * len;
    const center = pivotWorld.clone().add(dir.clone().multiplyScalar(colLen / 2));
    this._resizeCol(this._boomCol, colLen, 1.1, 1.3);
    this._boomCol.position.set(center.x, center.y, center.z);
    this._boomCol.quaternion.set(q.x, q.y, q.z, q.w);
  }

  telemetry() {
    return [
      ['Swing', `${deg(this.axes.swing.value).toFixed(0)}°`],
      ['Boom angle', `${deg(this.axes.luff.value).toFixed(0)}°`],
      ['Boom length', `${this.axes.tele.value.toFixed(1)} m`],
      ['Radius', `${this.radius.toFixed(1)} m`],
      ['Hook height', `${(this.anchor.y - this.cableLen).toFixed(1)} m`],
    ];
  }

  cameraRig(mode) {
    const s = this.axes.swing.value;
    if (mode === 'cab') {
      const camLocal = new THREE.Vector3(1.4, 4.4, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), s);
      const pos = this.basePos.clone().add(camLocal);
      return { pos, target: this.anchor.clone() };
    }
    const pos = this.basePos.clone().add(new THREE.Vector3(-16, 12, 20));
    return { pos, target: this.basePos.clone().setY(6) };
  }
}

// ============================ GANTRY CRANE =================================
// Ship-to-shore style. Rails run along X (the quay). The portal is WIDE in X so
// the load — which hangs at the portal centre (x = bridge) — travels cleanly
// between the legs. The boom/girder cantilevers out over the water (+Z) so the
// trolley can reach ship cells past the waterside leg.
export class GantryCrane extends BaseCrane {
  constructor() {
    super();
    this.name = 'Ship-to-Shore Gantry Crane';
    this.scheme = 'Gantry long-travel + trolley cross-travel + hoist';
    this.railZ = 12;   // waterside (+) / landside (-) rails
    this.legX = 8.5;   // leg half-spacing along the rail (well wider than any load)
    this.height = 30;
    this.zBack = -16;  // landside backreach
    this.zFwd = 30;    // waterside cantilever (out over the ship)
    this._girderY = this.height + 0.9;

    this.axes = {
      bridge: new Axis({ value: 0, min: -34, max: 34, maxSpeed: 7, accel: 6 }),
      trolley: new Axis({ value: 0, min: this.zBack + 3, max: this.zFwd - 4, maxSpeed: 6.5, accel: 7 }),
      hoist: new Axis({ value: 14, min: 2, max: this.height - 1, maxSpeed: 5, accel: 6.5 }),
    };
    this.controlHelp = [
      'A / D — gantry travel (along the quay)',
      'W / S — trolley across (out to sea / back to quay)',
      '↑ / ↓ — hoist up / down',
      'Shift — micro-speed (fine control)',
    ];

    const yellow = steelMat(YELLOW);
    const dark = steelMat(DARK);
    this._build(yellow, dark);
  }

  _build(yellow, dark) {
    const g = this.group;
    const railMat = new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.6, metalness: 0.6 });
    for (const z of [-this.railZ, this.railZ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(90, 0.35, 0.6), railMat);
      rail.position.set(0, 0.18, z);
      rail.receiveShadow = true;
      g.add(rail);
    }

    this.portal = new THREE.Group();
    g.add(this.portal);
    const H = this.height, lx = this.legX, rz = this.railZ;

    // Four near-vertical legs (slight inward lean), two per rail.
    const feet = [[-lx, -rz], [lx, -rz], [-lx, rz], [lx, rz]];
    for (const [fx, fz] of feet) {
      beam(this.portal, new THREE.Vector3(fx, 0, fz), new THREE.Vector3(fx * 0.55, H, fz), 0.7, yellow);
      // knee brace
      beam(this.portal, new THREE.Vector3(fx, H * 0.5, fz), new THREE.Vector3(fx * 0.3, H, fz * 0.86), 0.3, dark);
    }
    // Portal cross beams joining each leg pair (across X on each rail).
    beam(this.portal, new THREE.Vector3(-lx * 0.55, H, -rz), new THREE.Vector3(lx * 0.55, H, -rz), 0.6, yellow);
    beam(this.portal, new THREE.Vector3(-lx * 0.55, H, rz), new THREE.Vector3(lx * 0.55, H, rz), 0.6, yellow);
    // Cross-tie between the two rails at the top.
    for (const sx of [-1.4, 1.4]) {
      beam(this.portal, new THREE.Vector3(sx, H, -rz), new THREE.Vector3(sx, H, rz), 0.4, dark);
    }
    // Twin box girders running Z, cantilevered over the water.
    const gy = this._girderY;
    for (const gx of [-1.4, 1.4]) {
      beam(this.portal, new THREE.Vector3(gx, gy, this.zBack), new THREE.Vector3(gx, gy, this.zFwd), 0.7, yellow);
      // diagonal cantilever stays
      beam(this.portal, new THREE.Vector3(gx, H, rz), new THREE.Vector3(gx, gy + 4, this.zFwd), 0.22, dark);
    }
    // Apex mast + stays holding the cantilever.
    beam(this.portal, new THREE.Vector3(0, gy, rz), new THREE.Vector3(0, gy + 7, rz), 0.4, yellow);
    beam(this.portal, new THREE.Vector3(0, gy + 7, rz), new THREE.Vector3(0, gy, this.zFwd), 0.2, dark);
    beam(this.portal, new THREE.Vector3(0, gy + 7, rz), new THREE.Vector3(0, gy, this.zBack), 0.2, dark);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.7 });
    for (const [fx, fz] of feet) {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 2.4), wheelMat);
      bogie.position.set(fx, 0.5, fz);
      this.portal.add(bogie);
    }

    // Trolley rides Z on the girders, at the portal centre in X.
    this.trolley = new THREE.Group();
    this.portal.add(this.trolley);
    const tbody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 3.0), dark);
    tbody.position.y = gy + 0.9;
    tbody.castShadow = true;
    this.trolley.add(tbody);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.7, 1.8), new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.4 }));
    cab.position.set(2.4, gy - 0.4, 0);
    this.trolley.add(cab);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.82, 1.0, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.5 })
    );
    glass.position.set(2.4, gy - 0.3, 0);
    this.trolley.add(glass);
  }

  update(dt, input, micro) {
    this.axes.bridge.step(input.axis('KeyA', 'KeyD'), dt, micro);
    this.axes.trolley.step(input.axis('KeyS', 'KeyW'), dt, micro);
    this.axes.hoist.step(input.axis('ArrowUp', 'ArrowDown'), dt, micro);
    this.portal.position.x = this.axes.bridge.value;
    this.trolley.position.z = this.axes.trolley.value;
    this.anchor.set(
      this.basePos.x + this.axes.bridge.value,
      this.basePos.y + this._girderY,
      this.basePos.z + this.axes.trolley.value
    );
    this.cableLen = this.axes.hoist.value;
  }

  get radius() {
    return Math.abs(this.axes.trolley.value);
  }

  initColliders(physics) {
    // Four legs (load stays clear at portal centre, but a mis-driven load is caught).
    this._legCols = [];
    for (let i = 0; i < 4; i++) this._legCols.push(this._mkCol(physics, 1.2, this.height, 1.2, 'gantry leg'));
    // Girder overhead (catches an over-hoist / two-block).
    this._girderCol = this._mkCol(physics, 3.2, 1.2, this.zFwd - this.zBack, 'girder');
  }
  updateColliders() {
    if (!this._legCols) return;
    const bx = this.basePos.x + this.axes.bridge.value;
    const feet = [[-this.legX, -this.railZ], [this.legX, -this.railZ], [-this.legX, this.railZ], [this.legX, this.railZ]];
    for (let i = 0; i < 4; i++) {
      this._legCols[i].position.set(bx + feet[i][0] * 0.78, this.basePos.y + this.height / 2, this.basePos.z + feet[i][1]);
    }
    this._girderCol.position.set(bx, this.basePos.y + this._girderY, this.basePos.z + (this.zBack + this.zFwd) / 2);
  }

  telemetry() {
    const reach = this.axes.trolley.value;
    return [
      ['Gantry X', `${this.axes.bridge.value.toFixed(1)} m`],
      ['Trolley', `${reach.toFixed(1)} m ${reach > this.railZ ? '(over water)' : '(over quay)'}`],
      ['Hook height', `${(this.anchor.y - this.cableLen).toFixed(1)} m`],
    ];
  }

  cameraRig(mode) {
    if (mode === 'cab') {
      const pos = this.basePos.clone().add(new THREE.Vector3(this.axes.bridge.value + 3, this._girderY - 0.6, this.axes.trolley.value));
      return { pos, target: this.anchor.clone().setY(this.anchor.y - 12) };
    }
    const pos = this.basePos.clone().add(new THREE.Vector3(-40, 30, -34));
    return { pos, target: this.basePos.clone().setY(10).add(new THREE.Vector3(0, 0, 8)) };
  }
}

export const CRANE_TYPES = { tower: TowerCrane, mobile: MobileCrane, gantry: GantryCrane };
