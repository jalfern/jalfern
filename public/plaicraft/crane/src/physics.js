// Rigid-body world + a penalty-based cable (rope) model for realistic load swing.
import * as CANNON from 'cannon-es';

export class Physics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
    this.world.solver.iterations = 24;
    this.world.solver.tolerance = 0.001;

    this.mat = {
      ground: new CANNON.Material('ground'),
      load: new CANNON.Material('load'),
      obstacle: new CANNON.Material('obstacle'),
    };
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.mat.ground, this.mat.load, {
        friction: 0.55,
        restitution: 0.04,
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.mat.obstacle, this.mat.load, {
        friction: 0.4,
        restitution: 0.12,
      })
    );

    this.fixedStep = 1 / 120;
    this.transient = []; // bodies removed on scenario reset

    // Ground plane (permanent).
    const ground = new CANNON.Body({ mass: 0, material: this.mat.ground });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
    this.ground = ground;

    this._pre = () => {
      if (this.onPreStep) this.onPreStep();
    };
    this.world.addEventListener('preStep', this._pre);
    // Resolve the cable AFTER each substep so the projection sticks.
    this._post = () => { if (this.cable) this.cable.solve(); };
    this.world.addEventListener('postStep', this._post);
  }

  addBox(size, pos, mass, material) {
    const half = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
    const body = new CANNON.Body({ mass, material: material || this.mat.load });
    body.addShape(new CANNON.Box(half));
    body.position.set(pos.x, pos.y, pos.z);
    // Linear damping lets a well-flown load eventually settle (swing still
    // persists long enough to matter). Angular damping is HIGH: a slung load on
    // tag lines holds its heading and barely yaws.
    body.linearDamping = 0.06;
    body.angularDamping = 0.85;
    this.world.addBody(body);
    this.transient.push(body);
    return body;
  }

  addStaticBox(size, pos, quat, material) {
    const half = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
    const body = new CANNON.Body({ mass: 0, material: material || this.mat.obstacle });
    body.addShape(new CANNON.Box(half));
    body.position.set(pos.x, pos.y, pos.z);
    if (quat) body.quaternion.copy(quat);
    this.world.addBody(body);
    this.transient.push(body);
    return body;
  }

  clearTransient() {
    for (const b of this.transient) this.world.removeBody(b);
    this.transient.length = 0;
    this.cable = null;
    this.onPreStep = null;
  }

  step(dt) {
    this.world.step(this.fixedStep, dt, 8);
  }
}

// An inextensible rope modelled as a ONE-SIDED position constraint, resolved by
// projection after each substep. The rope pulls but never pushes: when the load
// is closer than the cable length it hangs slack (free pendulum / rests on a
// surface); when it reaches the length, its position and radial velocity are
// projected onto the sphere of radius `length` about the anchor. This gives
// authentic swing without the shock-load blow-ups of a stiff penalty spring.
export class Cable {
  constructor(world, loadBody, attachLocal) {
    this.world = world;
    this.load = loadBody;
    this.attachLocal = attachLocal.clone();
    this.anchor = new CANNON.Vec3();
    this.length = 6;
    this.engaged = true;
    this._worldAttach = new CANNON.Vec3();
    this._diff = new CANNON.Vec3();
    this.tension = 0;
  }

  setAnchor(x, y, z) {
    this.anchor.set(x, y, z);
  }

  solve() {
    this.tension = 0;
    if (!this.engaged) return;
    const load = this.load;
    load.pointToWorldFrame(this.attachLocal, this._worldAttach);
    this.anchor.vsub(this._worldAttach, this._diff); // load → anchor
    const dist = this._diff.length();
    if (dist <= this.length + 1e-4) return; // slack: leave gravity/contacts alone
    const inv = 1 / dist;
    const dx = this._diff.x * inv, dy = this._diff.y * inv, dz = this._diff.z * inv; // unit toward anchor
    let err = dist - this.length;
    if (err > 2) err = 2; // guard against pathological jumps

    // Positional correction: bring the attach point back onto the sphere.
    load.position.x += dx * err;
    load.position.y += dy * err;
    load.position.z += dz * err;

    // Velocity: cancel only the component separating from the anchor (rope can't
    // push, so approaching / swinging velocity is preserved).
    const v = load.velocity;
    const vAlong = v.x * dx + v.y * dy + v.z * dz; // + = toward anchor
    if (vAlong < 0) {
      v.x -= dx * vAlong;
      v.y -= dy * vAlong;
      v.z -= dz * vAlong;
    }
    load.wakeUp();
    this.tension = load.mass * 9.82; // taut — report ~static line pull for HUD
  }
}
