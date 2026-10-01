// The ground crew / rigger: a simple articulated figure who walks to the load,
// hooks on, gives hand signals, steadies the load with a tag line, and unhooks.
import * as THREE from 'three';

export class Rigger {
  constructor() {
    this.group = new THREE.Group();
    this.pos = new THREE.Vector3();
    this.walkTarget = null;
    this.walkSpeed = 3.4; // m/s
    this.walking = false;
    this.facing = 0;
    this.gait = 0;
    this.signalName = 'idle';
    this._armT = 0;
    this._build();
  }

  _build() {
    const hi = new THREE.MeshStandardMaterial({ color: 0xffd21e, roughness: 0.6, emissive: 0x3a2f00, emissiveIntensity: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a679, roughness: 0.8 });
    const hat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });

    // Legs (pivot at hips for a simple walk cycle).
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    for (const [leg, x] of [[this.legL, -0.14], [this.legR, 0.14]]) {
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.24), dark);
      shin.position.y = -0.45;
      shin.castShadow = true;
      leg.add(shin);
      leg.position.set(x, 0.9, 0);
      this.group.add(leg);
    }
    // Torso in a hi-vis vest.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), hi);
    torso.position.y = 1.28;
    torso.castShadow = true;
    this.group.add(torso);
    // Reflective bands.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.32), new THREE.MeshStandardMaterial({ color: 0xdfe7ee, roughness: 0.3 }));
    band.position.y = 1.3;
    this.group.add(band);
    // Head + hard hat.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skin);
    head.position.y = 1.78;
    head.castShadow = true;
    this.group.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hat);
    helmet.position.y = 1.82;
    this.group.add(helmet);

    // Arms with shoulder pivots for hand signals.
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    for (const [arm, x] of [[this.armL, -0.32], [this.armR, 0.32]]) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), hi);
      upper.position.y = -0.3;
      upper.castShadow = true;
      arm.add(upper);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0xe86a1a, roughness: 0.6 }));
      glove.position.y = -0.66;
      arm.add(glove);
      arm.position.set(x, 1.5, 0);
      this.group.add(arm);
    }
    this.setSignal('idle');
  }

  addTo(scene) { scene.add(this.group); return this; }
  dispose(scene) { scene.remove(this.group); }

  setPos(x, z, groundY = 0) {
    this.pos.set(x, groundY, z);
    this.group.position.copy(this.pos);
    this.walkTarget = null;
    this.walking = false;
  }

  walkTo(x, z) {
    this.walkTarget = new THREE.Vector3(x, this.pos.y, z);
  }

  get arrived() {
    return !this.walkTarget;
  }

  faceToward(x, z) {
    this.facing = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  // Hand-signal poses (arm rotation about shoulder X axis; +/- for up/down).
  setSignal(name) {
    this.signalName = name;
  }

  update(dt) {
    // Walk toward target.
    if (this.walkTarget) {
      const dx = this.walkTarget.x - this.pos.x;
      const dz = this.walkTarget.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        this.walkTarget = null;
        this.walking = false;
      } else {
        const step = Math.min(this.walkSpeed * dt, d);
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        this.facing = Math.atan2(dx, dz);
        this.walking = true;
        this.gait += dt * 9;
      }
    } else {
      this.walking = false;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;

    // Leg swing while walking.
    const swing = this.walking ? Math.sin(this.gait) * 0.5 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    // Arm signals (smoothly approach the pose).
    this._armT = Math.min(1, this._armT + dt * 6);
    let lTarget = 0.2, rTarget = 0.2, sway = Math.sin(this.gait) * 0.4;
    switch (this.signalName) {
      case 'up': // both forearms up, beckoning
        lTarget = rTarget = -Math.PI * 0.9 + Math.sin(this.gait * 2) * 0.25; break;
      case 'down': // arms low, palms down patting
        lTarget = rTarget = -Math.PI + Math.sin(this.gait * 3) * 0.15; break;
      case 'stop': // both arms straight out
        lTarget = rTarget = -Math.PI / 2; break;
      case 'come': lTarget = rTarget = -Math.PI / 2 + Math.sin(this.gait * 3) * 0.4; break;
      case 'hold': lTarget = rTarget = -Math.PI / 2.3; break;
      case 'walk': lTarget = sway; rTarget = -sway; break;
      default: lTarget = this.walking ? sway : 0.2; rTarget = this.walking ? -sway : 0.2;
    }
    this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, lTarget, 0.2);
    this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, rTarget, 0.2);
    // Splay arms out for a "stop".
    const splay = this.signalName === 'stop' ? 0.5 : 0;
    this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, splay, 0.2);
    this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, -splay, 0.2);
  }
}
