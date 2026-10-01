// Crane Operator — game bootstrap, main loop, and the lift state machine.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as CANNON from 'cannon-es';
import { Physics, Cable } from './physics.js';
import { CRANE_TYPES } from './cranes.js';
import { SCENARIOS } from './scenarios.js';
import { Input } from './input.js';
import { Banksman, guidanceCall } from './banksman.js';
import { BanksmanAI, ruleFallback } from './llm.js';
import { Rigger } from './rigger.js';
import { HUD } from './hud.js';
import { clamp, damp, deg, rad, surface } from './util.js';

const CRANE_LABEL = { tower: 'Tower crane', mobile: 'Mobile telescopic crane', gantry: 'Rail gantry crane' };
const AXIS_LABELS = {
  tower: { slew: 'Slew', trolley: 'Trolley', hoist: 'Hoist' },
  mobile: { swing: 'Swing', luff: 'Boom', tele: 'Telescope', hoist: 'Hoist' },
  gantry: { bridge: 'Travel', trolley: 'Trolley', hoist: 'Hoist' },
};
const CAPACITY = { tower: { moment: 220 }, mobile: { moment: 320 }, gantry: { flat: 45 } };
const PAR_TIME = 75;

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.baseFov = 74; // wide operator field of view
    this.camZoom = 1;  // 1 = wide, up to ~3.4 = zoomed in (wheel)
    this.camera = new THREE.PerspectiveCamera(this.baseFov, innerWidth / innerHeight, 0.2, 3000);
    this.camera.position.set(-30, 30, 34);
    this.lookAt = new THREE.Vector3();
    // Wheel zooms the operator's view IN (magnify to inspect the load) and out.
    addEventListener('wheel', (e) => {
      this.camZoom = clamp(this.camZoom * (e.deltaY > 0 ? 0.92 : 1.087), 1, 3.4);
    }, { passive: true });

    this.sky = new Sky();
    this.sky.scale.setScalar(6000);
    this.scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.near = 1; sc.far = 300; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x5a4d3a, 0.5);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.28);
    this.scene.add(this.ambient);

    // Image-based lighting: the sky is baked into an environment map so metal,
    // glass and water pick up real sky reflections.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    // Post-processing: bloom for sun glare and bright-highlight blooming.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildAtmosphere();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.maxPolarAngle = Math.PI * 0.495;

    this.physics = new Physics();
    this.physics.onPreStep = () => this.applyWind();
    this.input = new Input();
    this.banksman = new Banksman();
    this.ai = new BanksmanAI();
    this.hud = new HUD();
    this.banksman.onSay = (t) => this.hud.caption(t);
    this.setupRadio();

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.mode = 'menu';
    this.G = null; // current lift runtime

    // scratch
    this._attachC = new CANNON.Vec3();
    this._attachW = new CANNON.Vec3();
    this._windForce = new CANNON.Vec3();

    addEventListener('resize', () => this.onResize());
    const sink = (m) => { const s = document.getElementById('errsink'); if (s) s.textContent += '\n' + m; };
    addEventListener('error', (e) => sink(e.message));
    addEventListener('unhandledrejection', (e) => sink('promise: ' + (e.reason && e.reason.message || e.reason)));

    this.buildMenu();
    document.getElementById('loading').classList.add('hidden');

    // Headless smoke test: exercise every scenario/crane logic path without the
    // (SwiftShader-slow) render loop, then report to #errsink.
    if (location.hash.includes('autoplay')) {
      this.hud.hideMenu(); this.selectScenario(0); this.startLift(); this.loop(); return;
    }
    if (location.hash.includes('radiotest')) { this.runRadioTest(); return; }
    if (location.hash.includes('emu')) { this.runEmu(); return; }
    if (location.hash.includes('autoland')) { this.runAutoLand(); return; }
    if (location.hash.includes('autowin')) { this.runAutoWin(); return; }
    if (location.hash.includes('autotest')) { this.runSmoke(); return; }
    if (location.hash.includes('shot')) { this.runShot(); return; }
    this.loop();
  }

  // Build one scene and hold a stable lifted pose for screenshots.
  runShot() {
    const m = location.hash.match(/shot(\d)/);
    const idx = m ? Math.min(+m[1], SCENARIOS.length - 1) : 0;
    this.hud.hideMenu();
    this.buildLift(idx);
    this.mode = 'playing';
    const up = { isDown: (c) => c === 'ArrowUp', axis(n, p) { return (this.isDown(p) ? 1 : 0) - (this.isDown(n) ? 1 : 0); } };
    const real = this.input; this.input = up;
    for (let i = 0; i < 110 && !this.G.finished; i++) { this.elapsed += 1 / 60; this.updatePlaying(1 / 60); }
    this.input = real;
    this.onResize();
    this.G.camIndex = location.hash.includes('cab') ? 0 : Math.min(1, this.G.cameraModes.length - 1);
    for (let i = 0; i < 40; i++) this.updateCamera(1 / 60);
    this.render();
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, n = 20, buf = new Uint8Array(4);
    let r = 0, g = 0, b = 0, cnt = 0;
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
      gl.readPixels(((xx + 0.5) / n * w) | 0, ((yy + 0.5) / n * h) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      r += buf[0]; g += buf[1]; b += buf[2]; cnt++;
    }
    const cam = this.camera.position, tg = this.lookAt;
    const s = document.getElementById('errsink');
    if (s) s.textContent = `SHOT idx=${idx} mode=${this.G.cameraModes[this.G.camIndex]} avg=${(r / cnt) | 0},${(g / cnt) | 0},${(b / cnt) | 0} cam=${cam.x.toFixed(0)},${cam.y.toFixed(0)},${cam.z.toFixed(0)} look=${tg.x.toFixed(0)},${tg.y.toFixed(0)},${tg.z.toFixed(0)}`;
    document.title = 'SHOT ' + idx;
  }

  // Prove the win condition is achievable: a P-controller flies the gantry
  // (cartesian) load over the cell, kills swing, lowers, and sets it down.
  runAutoWin() {
    this.hud.hideMenu();
    this.buildLift(1); // gantry / port
    this.mode = 'playing';
    this.G.startTime = this.elapsed;
    this.attachLoad(); // hook spawns above the load — rig it directly
    const d = { bridge: 0, trolley: 0, hoist: 0 };
    const stub = {
      isDown: () => false,
      axis: (neg, pos) => {
        if (neg === 'KeyA' && pos === 'KeyD') return d.bridge;
        if (neg === 'KeyS' && pos === 'KeyW') return d.trolley;
        if (neg === 'ArrowUp' && pos === 'ArrowDown') return d.hoist;
        return 0;
      },
    };
    const real = this.input; this.input = real === stub ? real : stub;
    const tgt = this.G.target;
    let ticks = 0;
    this._forceMicro = true; // fly it on micro-speed like a careful operator
    while (ticks < 7000 && !this.G.finished) {
      const lb = this.G.loadBody.position, v = this.G.loadBody.velocity;
      const ex = tgt.x - lb.x, ez = tgt.z - lb.z, horiz = Math.hypot(ex, ez);
      const swingDeg = deg(this.G.swing);
      const loadBottom = lb.y - this.G.loadSize.y / 2;
      const dyPad = loadBottom - tgt.padTop;
      const speedH = Math.hypot(v.x, v.z);
      const clearance = tgt.padTop + 8; // travel well above the 4 m guides
      const overCell = horiz < tgt.tolXZ * 0.5;
      const positioned = horiz < tgt.tolXZ * 0.45 && swingDeg < 0.6 && speedH < 0.1;
      // Anti-sway travel: gentle pull, strong velocity damping, low cap.
      const travel = () => {
        d.bridge = clamp(ex * 0.14 - v.x * 0.7, -0.35, 0.35);
        d.trolley = clamp(ez * 0.14 - v.z * 0.7, -0.35, 0.35);
      };
      if (loadBottom < clearance - 1 && !overCell) {
        d.bridge = 0; d.trolley = 0; d.hoist = -0.7; // lift to clearance BEFORE traversing
      } else if (!overCell) {
        travel();
        d.hoist = clamp((loadBottom - clearance) * 0.25, -1, 1); // hold clearance
      } else {
        travel();
        d.hoist = positioned ? clamp(dyPad > 0.05 ? 0.16 : dyPad < -0.05 ? -0.12 : 0, -1, 1)
          : clamp((loadBottom - clearance) * 0.25, -1, 1); // stay high until centred
      }
      this.elapsed += 1 / 60; ticks++;
      this.updatePlaying(1 / 60);
    }
    this._forceMicro = false;
    this.input = real;
    const s = document.getElementById('errsink');
    if (s) s.textContent = `AUTOWIN ticks=${ticks} success=${this.G.success} grade=${this.G.grade} why="${this.G.reason}" load=${this.G.loadBody.position.x.toFixed(1)},${this.G.loadBody.position.y.toFixed(1)},${this.G.loadBody.position.z.toFixed(1)} tgt=${tgt.x},${tgt.padTop},${tgt.z}`;
    document.title = 'AUTOWIN done';
  }

  // Deterministic check of the win mechanic: place a load correctly on each
  // target, hold, and confirm success + a grade are awarded.
  runAutoLand() {
    const out = [];
    for (let idx = 0; idx < SCENARIOS.length; idx++) {
      this.buildLift(idx);
      this.mode = 'playing';
      this.G.startTime = this.elapsed;
      const G = this.G;
      const real = this.input; this.input = { isDown: () => false, axis: () => 0 };
      let guard = 0, stages = 0;
      // Drive each stage: teleport its load onto the mark, force "hooked", step
      // until the stage completes, then repeat for the next stage.
      while (!G.finished && guard++ < 20) {
        const t = G.target, sz = G.loadSize, lb = G.loadBody, startStage = G.stageIdx;
        lb.position.set(t.x, t.padTop + sz.y / 2, t.z);
        lb.velocity.set(0, 0, 0); lb.angularVelocity.set(0, 0, 0);
        lb.quaternion.setFromEuler(0, t.yaw, 0);
        G.rigged = true; G.cable.engaged = false; G.phase = 'hooked';
        G.rigger.setPos(t.x + sz.x / 2 + 1.2, t.z + sz.z / 2 + 1.2);
        let s = 0;
        while (!G.finished && G.stageIdx === startStage && s++ < 400) { this.elapsed += 1 / 60; this.updatePlaying(1 / 60); }
        stages++;
      }
      this.input = real;
      out.push(`#${idx}:${G.success ? 'WIN' : 'no'}(${stages}st/${G.grade || '-'})`);
    }
    const s = document.getElementById('errsink');
    if (s) s.textContent = 'AUTOLAND ' + out.join(' ');
    document.title = 'AUTOLAND';
  }

  // Exercise the two-way radio (rule-based path) + hook-on action without a key.
  runRadioTest() {
    this.hud.hideMenu();
    this.buildLift(0);
    this.mode = 'playing';
    const G = this.G;
    const before = G.phase;
    const r1 = ruleFallback(this.banksmanContext(), 'hook us on, take the strain');
    this.applyAiAction(r1.action);
    const afterHook = G.phase;
    const r2 = ruleFallback(this.banksmanContext(), 'how am I doing, am I over the mark?');
    const r3 = ruleFallback(this.banksmanContext(), 'all stop!');
    const s = document.getElementById('errsink');
    if (s) s.textContent = `RADIO hook=${r1.action}("${r1.say}") phase ${before}->${afterHook} | status="${r2.say}" | stop=${r3.action}`;
    document.title = 'RADIO';
  }

  // Emulate the exact loop() body (handleKeys → updatePlaying → updateCamera →
  // render) to test the real play path, then read back the framebuffer.
  runEmu() {
    this.selectScenario(0); // real flow — must hide the menu itself
    this.startLift();
    this.onResize();
    let err = '';
    try {
      for (let i = 0; i < 60; i++) {
        const dt = 1 / 60; this.elapsed += dt;
        this.banksman.setTime(this.elapsed);
        this.handleKeys();
        if (this.mode === 'playing' && this.G && !this.G.finished) this.updatePlaying(dt);
        this.updateCamera(dt);
        this.hud.tickCaption(dt);
        this.render();
        this.input.endFrame();
      }
    } catch (e) { err = e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, n = 20, buf = new Uint8Array(4);
    let r = 0, g = 0, b = 0, cnt = 0;
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
      gl.readPixels(((xx + 0.5) / n * w) | 0, ((yy + 0.5) / n * h) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      r += buf[0]; g += buf[1]; b += buf[2]; cnt++;
    }
    const s = document.getElementById('errsink');
    if (s) s.textContent = `EMU mode=${this.mode} menuHidden=${document.getElementById('menu').classList.contains('hidden')} hudHidden=${document.getElementById('hud').classList.contains('hidden')} avg=${(r / cnt) | 0},${(g / cnt) | 0},${(b / cnt) | 0} err="${err}"`;
    document.title = 'EMU';
  }

  runSmoke() {
    const results = [];
    const stub = { axis: () => 0.45 * Math.sin(this._smt * 1.3), isDown: () => false };
    for (let idx = 0; idx < SCENARIOS.length; idx++) {
      try {
        this.buildLift(idx);
        this.mode = 'playing';
        this.G.startTime = this.elapsed;
        const real = this.input;
        this.input = stub;
        for (let i = 0; i < 200 && !this.G.finished; i++) {
          this._smt = i / 60;
          this.elapsed += 1 / 60;
          this.updatePlaying(1 / 60);
        }
        this.input = real;
        this.updateCamera(1 / 60);
        this.render(); // exercise WebGL draw once
        results.push(`#${idx}:${SCENARIOS[idx].meta.craneType}:OK`);
      } catch (e) {
        results.push(`#${idx}:ERR ${e.message} @${(e.stack || '').split('\n')[1] || ''}`);
      }
    }
    const s = document.getElementById('errsink');
    if (s) s.textContent = 'SMOKE ' + results.join(' | ');
    document.title = 'SMOKE ' + results.join(' | ');
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    if (this.composer) this.composer.setSize(innerWidth, innerHeight);
    if (this.bloom) this.bloom.setSize(innerWidth, innerHeight);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Persistent atmosphere: drifting clouds + floating dust motes for depth.
  buildAtmosphere() {
    // Soft radial cloud sprite texture.
    const cc = document.createElement('canvas');
    cc.width = cc.height = 128;
    const cx = cc.getContext('2d');
    const grd = cx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grd;
    cx.fillRect(0, 0, 128, 128);
    const cloudTex = new THREE.CanvasTexture(cc);
    this.clouds = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.16, depthWrite: false });
      const s = new THREE.Sprite(m);
      const scale = 110 + (i * 53) % 130;
      s.scale.set(scale, scale * 0.5, 1);
      s.position.set(((i * 97) % 520) - 260, 110 + (i * 31) % 70, ((i * 61) % 480) - 210);
      this.clouds.add(s);
    }
    this.scene.add(this.clouds);

    // Dust motes (very subtle).
    const N = 260;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.sin(i * 12.9) * 0.5 + 0.5) * 240 - 120;
      pos[i * 3 + 1] = (Math.sin(i * 7.3) * 0.5 + 0.5) * 55 + 1;
      pos[i * 3 + 2] = (Math.sin(i * 4.1) * 0.5 + 0.5) * 240 - 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.24, sizeAttenuation: true, transparent: true, opacity: 0.06, depthWrite: false,
    }));
    this.scene.add(this.dust);
  }

  animateAtmosphere(dt) {
    if (this.clouds) {
      for (const s of this.clouds.children) {
        s.position.x += dt * 1.4;
        if (s.position.x > 260) s.position.x = -260;
      }
    }
    if (this.dust) this.dust.rotation.y += dt * 0.006;
  }

  // Bake the current scene (sky + ground) into the environment map for
  // reflections on metal, glass, and water.
  updateEnvMap() {
    const fog = this.scene.fog; this.scene.fog = null;
    const dustV = this.dust && this.dust.visible; if (this.dust) this.dust.visible = false;
    if (this._envRT) this._envRT.dispose();
    this._envRT = this.pmrem.fromScene(this.scene, 0, 0.1, 2000);
    this.scene.environment = this._envRT.texture;
    this.scene.fog = fog;
    if (this.dust) this.dust.visible = dustV;
  }

  buildMenu() {
    this.mode = 'menu';
    if (this.banksman) this.banksman.stop();
    const cards = SCENARIOS.map((f) => ({ ...f.meta, craneLabel: CRANE_LABEL[f.meta.craneType] }));
    this.hud.showMenu(cards, (i) => this.selectScenario(i));
  }

  // ---- two-way radio (voice/text ↔ LLM/rule-based banksman) ----
  setupRadio() {
    const key = document.getElementById('apiKey');
    const model = document.getElementById('aiModel');
    const status = document.getElementById('aiStatus');
    const upd = () => {
      if (!status) return;
      if (this.ai.enabled) {
        status.textContent = `✓ AI banksman active (${this.ai.model.replace(/-\d{8}$/, '')}). Hold T or type to talk.`;
        status.className = 'radio-status ok';
      } else {
        status.textContent = 'No key — a built-in rule-based banksman still answers. Hold T or type to talk.';
        status.className = 'radio-status';
      }
    };
    if (key) { key.value = this.ai.key; key.addEventListener('change', () => { this.ai.setKey(key.value); this.ai.reset(); upd(); }); }
    if (model) { model.value = this.ai.model; model.addEventListener('change', () => { this.ai.setModel(model.value); upd(); }); }
    upd();

    const radioInput = document.getElementById('radioInput');
    if (radioInput) radioInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = radioInput.value.trim(); radioInput.value = ''; radioInput.blur(); if (v) this.askBanksman(v); }
    });

    const SR = null; // web build: no microphone access, so voice input is off
    if (SR) {
      const r = new SR();
      r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
      r.onresult = (e) => this.askBanksman(e.results[0][0].transcript);
      r.onend = r.onerror = () => { this._listening = false; const el = document.getElementById('listening'); if (el) el.classList.add('hidden'); };
      this.recognition = r;
    }
  }

  startListening() {
    if (!this.recognition) { this.hud.toast('Voice input is off on the web version — type to the banksman'); return; }
    if (this._listening) return;
    try { this.recognition.start(); this._listening = true; const el = document.getElementById('listening'); if (el) el.classList.remove('hidden'); } catch { /* already running */ }
  }
  stopListening() { if (this.recognition && this._listening) { try { this.recognition.stop(); } catch { /* ignore */ } } }

  banksmanContext() {
    const G = this.G, m = this.placement();
    return {
      crane: G.cfg.craneType, phase: G.phase, hooked: G.rigged, load: G.loadLabel,
      stage: `${G.stageIdx + 1} of ${G.stages.length}`, objective: G.cfg.objective,
      swing_deg: +deg(G.swing).toFixed(1), wind_ms: +G.windSpeed.toFixed(1),
      to_mark: { toward_you_m: +m.dzF.toFixed(1), right_m: +m.dxR.toFixed(1), height_above_mark_m: +m.dyPad.toFixed(1) },
      over_mark: m.horiz <= G.target.tolXZ, load_speed_ms: +m.speed.toFixed(2),
      swl_pct: G.rigged ? +this.capacityPct().toFixed(0) : 0, rigger_at_load: G.rigger.arrived,
    };
  }

  async askBanksman(text) {
    text = (text || '').trim();
    if (!text) return;
    if (this.mode !== 'playing' || !this.G) { this.banksman.say('Radio check — pick a job first.', { priority: true }); return; }
    this.hud.toast('You: ' + text);
    const ctx = this.banksmanContext();
    let out;
    try { out = this.ai.enabled ? await this.ai.respond(ctx, text) : ruleFallback(ctx, text); }
    catch (e) { this.hud.toast('AI error: ' + e.message, 'bad'); out = ruleFallback(ctx, text); }
    if (out.say) this.banksman.say(out.say, { priority: true, minGap: 0 });
    this.applyAiAction(out.action);
  }

  applyAiAction(a) {
    const G = this.G;
    if (!G || G.finished) return;
    if (a === 'hook_on' && G.phase === 'approach') {
      const hookY = G.crane.anchor.y - G.crane.cableLen;
      const d = Math.hypot(G.crane.anchor.x - G.loadBody.position.x, hookY - (G.loadBody.position.y + G.loadSize.y / 2), G.crane.anchor.z - G.loadBody.position.z);
      if (d < 6) { G.rigger.setPos(G.loadBody.position.x + G.loadSize.x / 2 + 1.4, G.loadBody.position.z); this.attachLoad(); }
    } else if (a === 'unhook' && G.phase === 'hooked') {
      this.releaseLoad();
    } else if (a === 'hold' || a === 'steady') {
      G.rigger.setSignal('stop');
    }
  }

  // ---- environment / lighting from scenario config ----
  applyEnv(env) {
    const phi = rad(90 - env.sunElev);
    const theta = rad(env.sunAzim);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    const presets = {
      day: { turbidity: 8, rayleigh: 2.0, expo: 0.62 },
      hazy: { turbidity: 14, rayleigh: 1.2, expo: 0.7 },
      overcast: { turbidity: 22, rayleigh: 0.5, expo: 0.5 },
    };
    const p = presets[env.sky] || presets.day;
    const u = this.sky.material.uniforms;
    u.turbidity.value = p.turbidity;
    u.rayleigh.value = p.rayleigh;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    this.renderer.toneMappingExposure = p.expo;

    this.sun.position.copy(dir).multiplyScalar(120);
    this.sun.intensity = env.sunIntensity;
    this.hemi.color.setHex(env.hemiSky);
    this.hemi.groundColor.setHex(env.hemiGround);
    this.hemi.intensity = env.sky === 'overcast' ? 0.8 : 0.5;
    this.ambient.intensity = env.ambient;
    // Light haze only — enough for depth, not enough to wash the scene out.
    this.scene.fog = new THREE.FogExp2(env.fogColor, env.fogDensity * 0.4);
    this.scene.background = new THREE.Color(env.fogColor);
  }

  clearRuntime() {
    const G = this.G;
    if (!G) return;
    G.crane.dispose(this.scene);
    this.scene.remove(G.envGroup);
    for (const mesh of G.allMeshes || []) this.scene.remove(mesh);
    this.scene.remove(G.cableLine);
    this.scene.remove(G.hookMesh);
    if (G.rigger) G.rigger.dispose(this.scene);
    this.physics.clearTransient();
    this.G = null;
  }

  selectScenario(index) {
    this.hud.hideMenu();
    this.buildLift(index);
    this.mode = 'briefing';
    const cfg = this.G.cfg;
    const crane = this.G.crane;
    this.hud.showBriefing(
      { ...cfg, name: crane.name, controlHelp: crane.controlHelp },
      () => this.startLift()
    );
  }

  buildLift(index) {
    this.clearRuntime();
    const cfg = SCENARIOS[index](this.physics);
    this.scene.add(cfg.group);
    this.applyEnv(cfg.env);

    // Crane.
    const crane = new CRANE_TYPES[cfg.craneType]();
    crane.basePos.copy(cfg.craneBasePos);
    crane.group.position.copy(cfg.craneBasePos);
    crane.addTo(this.scene);
    for (const [k, v] of Object.entries(cfg.craneInit)) {
      if (crane.axes[k]) { crane.axes[k].value = v; crane.axes[k].vel = 0; }
    }
    crane.update(0, { axis: () => 0 }, false); // settle anchor
    crane.initColliders(this.physics);
    crane.updateColliders();

    // Stages: a scenario is a sequence of pick→place moves. Single-target
    // scenarios are wrapped as one stage (pick under the initial hook).
    const stages = cfg.stages || [{
      loadSpec: cfg.loadSpec,
      pick: { x: crane.anchor.x, z: crane.anchor.z },
      target: cfg.target,
    }];

    // Persistent cable + hook visuals (shared across stages).
    const cableLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0x0e1013 })
    );
    cableLine.frustumCulled = false;
    this.scene.add(cableLine);
    const hookMesh = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.8, roughness: 0.35 }));
    hookMesh.add(block);
    const hookTip = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 14, Math.PI * 1.5),
      new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.85, roughness: 0.3 }));
    hookTip.rotation.x = Math.PI / 2; hookTip.position.y = -0.6;
    hookMesh.add(hookTip);
    hookMesh.traverse((o) => (o.castShadow = true));
    this.scene.add(hookMesh);

    const rigger = new Rigger().addTo(this.scene);

    // Runtime state.
    const G = {
      index, cfg, crane, envGroup: cfg.group,
      stages, stageIdx: 0, phase: 'approach',
      loadBody: null, loadMesh: null, cable: null, attachLocal: null,
      loadSize: null, loadMass: 0, loadLabel: '', allMeshes: [],
      cableLine, hookMesh, rigger,
      target: null, wind: cfg.wind, blindLift: cfg.blindLift,
      rigged: false, finished: false, result: null,
      startTime: this.elapsed, holdTimer: 0, maxSwing: 0, warnings: 0, hardImpact: 0,
      guidanceTimer: 0, phaseTimer: 0, swing: 0, windSpeed: 0, gustFactor: 0, windDir: cfg.wind.dir,
      // You start in the cab. Before you actuate anything you may glance around
      // (chase/free); the first control input locks you to the operator's view.
      cameraModes: cfg.blindLift ? ['cab'] : ['cab', 'chase', 'free'],
      camIndex: 0, attachW: this._attachW, hookWorld: new THREE.Vector3(), actuated: false,
    };
    this.G = G;

    this.hud.startGame({ objective: cfg.objective, axes: crane.axes, axisLabels: AXIS_LABELS[cfg.craneType] });
    this.beginStage(0);

    const initRig = crane.cameraRig(G.cameraModes[G.camIndex]);
    this.camera.position.copy(initRig.pos);
    this.lookAt.copy(initRig.target);
    this.camera.lookAt(this.lookAt);

    this.updateEnvMap(); // bake sky/ground reflections for this location
  }

  // Spawn the load for a stage on the ground at its pick point (unrigged), place
  // the rigger beside it, and reveal that stage's target.
  beginStage(idx) {
    const G = this.G;
    G.stageIdx = idx;
    const stage = G.stages[idx];
    const spec = stage.loadSpec;
    const sz = spec.size;

    // Spawn the new load FROZEN (static) at its pick — which may be on the ground,
    // a ship deck, a stack, or a truck bed. It stays put until the rigger hooks
    // on, at which point it becomes dynamic. Previously-set loads are left where
    // they are, so a full cycle visibly builds up.
    const surfaceY = stage.pick.y || 0;
    const start = { x: stage.pick.x, y: surfaceY + sz.y / 2 + 0.02, z: stage.pick.z };
    const body = this.physics.addBox(sz, start, 0); // mass 0 → static/frozen
    body.type = CANNON.Body.STATIC;
    if (stage.pick.yaw) body.quaternion.setFromEuler(0, stage.pick.yaw, 0);
    body.addEventListener('collide', (e) => this.onCollide(e, body));
    const kind = spec.surface || 'steel';
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sz.x, sz.y, sz.z),
      surface(kind, { color: spec.color, seed: idx * 7 + 3, repeat: kind === 'container' ? 2 : 3 })
    );
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    G.allMeshes.push(mesh);

    const attachLocal = new CANNON.Vec3(0, sz.y / 2, 0);
    const cable = new Cable(this.physics.world, body, attachLocal);
    cable.engaged = false;
    this.physics.cable = cable;

    Object.assign(G, {
      loadBody: body, loadMesh: mesh, cable, attachLocal,
      loadSize: sz, loadMass: spec.mass, loadLabel: spec.label,
      target: stage.target, rigged: false, phase: 'approach', holdTimer: 0, phaseTimer: 0,
    });

    // Start the empty hook a few metres above the load so it's an easy reach.
    const hoist = G.crane.axes.hoist;
    hoist.value = clamp(G.crane.anchor.y - (surfaceY + sz.y + 4), hoist.min, hoist.max);
    hoist.vel = 0;
    G.crane.cableLen = hoist.value;

    // Reveal this stage's target, hide the rest.
    G.stages.forEach((st, i) => {
      if (st.target && st.target.ghost) {
        st.target.ghost.visible = i === idx;
        st.target.edges.visible = i === idx;
      }
    });

    // Rigger stands beside the load and calls for the hook.
    const off = sz.x / 2 + 1.6;
    G.rigger.setPos(stage.pick.x + off, stage.pick.z + off);
    G.rigger.walkTo(stage.pick.x + off * 0.6, stage.pick.z + off * 0.6);
    G.rigger.faceToward(stage.pick.x, stage.pick.z);
    G.rigger.setSignal('down');

    if (this.mode === 'playing') {
      const n = G.stages.length;
      const where = idx === 0 ? '' : ` Load ${idx + 1} of ${n}. `;
      this.banksman.say(`${where}${stage.say || 'Lower the hook onto the load and I\'ll hook you on.'}`, { priority: true });
    }
  }

  // Rigger hooks the load onto the descended hook.
  attachLoad() {
    const G = this.G;
    const anchor = G.crane.anchor;
    G.loadBody.pointToWorldFrame(G.attachLocal, this._attachW);
    const dist = Math.hypot(anchor.x - this._attachW.x, anchor.y - this._attachW.y, anchor.z - this._attachW.z);
    // Wake the frozen load into a dynamic body now it's on the hook.
    G.loadBody.type = CANNON.Body.DYNAMIC;
    G.loadBody.mass = G.loadMass;
    G.loadBody.updateMassProperties();
    G.loadBody.velocity.set(0, 0, 0);
    G.loadBody.angularVelocity.set(0, 0, 0);
    G.loadBody.wakeUp();
    G.cable.length = dist;
    G.cable.engaged = true;
    G.rigged = true;
    G.phase = 'hooked';
    G.crane.axes.hoist.value = clamp(dist, G.crane.axes.hoist.min, G.crane.axes.hoist.max);
    G.crane.cableLen = G.crane.axes.hoist.value;
    // Rigger steps clear and signals "take it up".
    const p = G.loadBody.position;
    G.rigger.walkTo(p.x + G.loadSize.x / 2 + 3, p.z + G.loadSize.z / 2 + 3);
    G.rigger.setSignal('up');
    this.banksman.say('Hooked on. Take the strain — hoist up slow.', { priority: true });
  }

  detachLoad() {
    const G = this.G;
    G.cable.engaged = false;
    G.rigged = false;
    G.rigger.setSignal('stop');
    this.banksman.say('That\'s unhooked. Good lift.', { priority: true });
    if (G.stageIdx + 1 < G.stages.length) {
      G.phase = 'done-stage';
      G.phaseTimer = 1.2; // brief beat before the next load
    } else {
      this.finish(true, 'All loads landed and unhooked. Cycle complete.');
    }
  }

  startLift() {
    this.hud.hideBriefing();
    this.mode = 'playing';
    this.ai.reset();
    const G = this.G;
    G.startTime = this.elapsed;
    this.banksman.setTime(this.elapsed);
    this.banksman.briefing(G.cfg.briefingLines, () => {
      this.banksman.say('Cable up when you\'re ready.', { priority: true });
    });
  }

  restartLift() {
    if (!this.G) return;
    const i = this.G.index;
    this.buildLift(i);
    this.startLift();
    this.hud.toast('Lift reset');
  }

  onCollide(e, body) {
    const G = this.G;
    if (!G || G.finished) return;
    if (body && body !== G.loadBody) return; // ignore already-set loads
    const other = e.body;
    const vel = G.loadBody.velocity;
    if (other.isObstacle || other.isCrane) {
      // Struck a structure — severity is how fast the load was moving into it.
      const speed = Math.hypot(vel.x, vel.z, vel.y);
      if (speed > 1.3) {
        this.banksman.say('Stop! You\'ve hit it!', { priority: true });
        this.finish(false, `You drove the load into the ${other.label}. That\'s a scrapped lift.`);
      } else if (speed > 0.45) {
        G.warnings++;
        this.hud.toast(`You touched the ${other.label}!`, 'bad');
        this.banksman.say(`Watch it — mind that ${other.label}.`, { priority: true, minGap: 0 });
      }
    } else {
      // Ground / pad — only a DESCENDING contact is a set-down (or a drop).
      const down = -vel.y;
      if (down > 0.4) {
        if (down > G.hardImpact) G.hardImpact = down;
        if (down > 4.6) this.finish(false, 'You dropped the load — it slammed into the deck.');
      }
    }
  }

  // ---- wind ----
  applyWind() {
    const G = this.G;
    if (!G || !G.cable.engaged || this.mode !== 'playing') return;
    const dir = G.windDir;
    const speed = G.windSpeed;
    const s = G.loadSize;
    const area = ((s.x + s.z) / 2) * s.y;
    let f = 0.5 * 1.25 * 1.6 * area * speed * speed; // ρ·Cd·A·v² (sail effect)
    f = Math.min(f, G.loadMass * 6); // clamp accel
    this._windForce.set(Math.cos(dir) * f, 0, Math.sin(dir) * f);
    // Apply at the centre of mass so wind SWAYS the load (pendulum) but doesn't
    // spin it — the slings/tag lines hold its heading, as in reality.
    G.loadBody.applyForce(this._windForce, G.loadBody.position);
  }

  updateWind(dt) {
    const G = this.G;
    const t = this.elapsed;
    let n = 0.5 + 0.34 * Math.sin(t * 0.55) + 0.14 * Math.sin(t * 1.7 + 1.3) + 0.09 * Math.sin(t * 3.3 + 2.1);
    n = clamp(n, 0, 1);
    if (G.wind.gusty) n = clamp(n * n * 1.25 + 0.1 * Math.sin(t * 0.23), 0, 1);
    G.gustFactor = n;
    G.windSpeed = G.wind.enabled ? G.wind.base + G.wind.gust * n : 0;
    G.windDir = G.wind.dir + 0.28 * Math.sin(t * 0.8) * (G.wind.gusty ? 1.6 : 1);
  }

  // ---- controls ----
  handleKeys() {
    const inp = this.input;
    if (inp.justPressed('KeyH')) this.hud.toggleHelp();
    if (inp.justPressed('KeyM')) {
      this.banksman.muted = !this.banksman.muted;
      if (this.banksman.muted) this.banksman.stop();
      this.hud.toast(this.banksman.muted ? 'Banksman muted' : 'Banksman on');
    }
    if (inp.justPressed('Escape')) { this.banksman.stop(); this.clearRuntime(); this.buildMenu(); return; }

    if (this.mode === 'playing') {
      if (inp.justPressed('KeyR')) this.restartLift();
      if (inp.justPressed('KeyC')) this.cycleCamera();
      if (inp.justPressed('Space')) this.releaseLoad();
      if (inp.justPressed('KeyT')) this.startListening(); // push-to-talk
    }
    if (this._listening && !inp.isDown('KeyT')) this.stopListening();
  }

  cycleCamera() {
    const G = this.G;
    if (G.actuated) { this.hud.toast('Operator view locked — you\'re on the sticks'); return; }
    G.camIndex = (G.camIndex + 1) % G.cameraModes.length;
    const mode = G.cameraModes[G.camIndex];
    this.controls.enabled = mode === 'free';
    if (mode === 'free') this.controls.target.copy(this.lookAt);
  }

  // Once the operator touches a control, lock to the cab (no external views).
  lockToCab() {
    const G = this.G;
    G.actuated = true;
    G.cameraModes = ['cab'];
    G.camIndex = 0;
    this.controls.enabled = false;
    this.hud.toast('Cab view — eyes on the load');
  }

  // Space = call the rigger in to unhook (only valid once landed on the mark).
  releaseLoad() {
    const G = this.G;
    if (G.finished || G.phase !== 'hooked') return;
    const m = this.placement();
    const onMark = m.horiz <= G.target.tolXZ * 1.3 && m.dyPad < 0.3 && m.dyPad > -0.3 &&
      m.speed < 0.6 && m.yawErr <= G.target.tolYaw * 1.5;
    if (onMark) {
      G.phase = 'landing';
      const load = G.loadBody;
      G.rigger.walkTo(load.position.x + G.loadSize.x / 2 + 1.2, load.position.z + G.loadSize.z / 2 + 1.2);
      this.banksman.say('Right, hold it there — coming in to unhook.', { priority: true });
    } else {
      this.banksman.say('Not yet — get it on the mark and steady first.', { priority: true });
    }
  }

  // ---- placement metrics (operator frame) ----
  placement() {
    const G = this.G;
    const lb = G.loadBody;
    const tgt = G.target;
    const dxW = tgt.x - lb.position.x;
    const dzW = tgt.z - lb.position.z;
    const horiz = Math.hypot(dxW, dzW);
    const dyPad = (lb.position.y - G.loadSize.y / 2) - tgt.padTop; // + above pad

    // operator forward = base → target
    const fwd = new THREE.Vector3(tgt.x - G.crane.basePos.x, 0, tgt.z - G.crane.basePos.z);
    if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0);
    fwd.normalize();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const dzF = dxW * fwd.x + dzW * fwd.z; // + = move away toward banksman
    const dxR = dxW * right.x + dzW * right.z; // + = move right

    const q = lb.quaternion;
    const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
    let yd = Math.atan2(Math.sin(yaw - tgt.yaw), Math.cos(yaw - tgt.yaw));
    let yawErr = Math.abs(yd);
    if (yawErr > Math.PI / 2) yawErr = Math.PI - yawErr; // box 180° symmetry

    const speed = lb.velocity.length();
    const angSpeed = lb.angularVelocity.length();
    return { horiz, dyPad, dzF, dxR, yawErr, speed, angSpeed };
  }

  updateBanksman(dt, m) {
    const G = this.G;
    G.guidanceTimer -= dt;
    const interval = G.blindLift ? 1.15 : 1.7;
    if (G.guidanceTimer > 0) return;
    G.guidanceTimer = interval;
    const settled = m.horiz <= G.target.tolXZ && m.dyPad < 0.25 && m.speed < 0.45 && m.yawErr <= G.target.tolYaw;
    const call = guidanceCall({
      dx: m.dxR, dz: m.dzF, dyPad: m.dyPad, swing: G.swing,
      speed: m.speed, settled, tol: G.target.tolXZ,
    });
    if (call) this.banksman.say(call, { minGap: 1.0 });
  }

  capacityPct() {
    const G = this.G;
    const type = G.cfg.craneType;
    const cap = CAPACITY[type];
    let capKg;
    if (cap.flat) capKg = cap.flat * 1000;
    else capKg = (cap.moment / Math.max(G.crane.radius, 1.5)) * 1000;
    return (G.loadMass / capKg) * 100;
  }

  finish(success, reason) {
    const G = this.G;
    if (G.finished) return;
    G.finished = true;
    this.mode = 'result';
    G.cable.engaged = success ? false : G.cable.engaged;
    const time = this.elapsed - G.startTime;
    let score = 100;
    score -= clamp(deg(G.maxSwing) * 1.4, 0, 32);
    score -= G.warnings * 8;
    score -= clamp((G.hardImpact - 1.5) * 10, 0, 26);
    score -= clamp((time - PAR_TIME) * 0.2, 0, 20);
    score = Math.round(clamp(score, 0, 100));
    let grade;
    if (!success) grade = 'F';
    else grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'E';
    G.success = success;
    G.grade = grade;
    G.reason = reason;

    if (success) this.banksman.say('Good lift. All stop.', { priority: true });
    this.hud.showResult(
      {
        success, grade, reason,
        stats: [
          ['Time on lift', `${time.toFixed(0)} s`],
          ['Peak swing', `${deg(G.maxSwing).toFixed(1)}°`],
          ['Set-down impact', `${G.hardImpact.toFixed(1)} m/s`],
          ['Contacts / warnings', `${G.warnings}`],
          ['Max wind', `${(G.wind.base + G.wind.gust).toFixed(0)} m/s`],
          ['Score', success ? `${score}/100` : '—'],
        ],
      },
      () => { this.hud.hideResult(); this.restartLift(); },
      () => { this.hud.hideResult(); this.clearRuntime(); this.buildMenu(); }
    );
  }

  // ---- per-frame ----
  updatePlaying(dt) {
    const G = this.G;
    const micro = this._forceMicro || this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    G.crane.update(dt, this.input, micro);
    G.crane.updateColliders();

    G.cable.setAnchor(G.crane.anchor.x, G.crane.anchor.y, G.crane.anchor.z);
    if (G.rigged) G.cable.length = G.crane.cableLen;

    this.updateWind(dt);
    this.physics.step(dt);

    // sync load mesh
    G.loadMesh.position.copy(G.loadBody.position);
    G.loadMesh.quaternion.copy(G.loadBody.quaternion);
    G.loadBody.pointToWorldFrame(G.attachLocal, this._attachW);
    const aw = this._attachW;

    // Hook + cable visual: on the load when rigged, else hanging free.
    let hookX, hookY, hookZ;
    if (G.rigged) { hookX = aw.x; hookY = aw.y; hookZ = aw.z; }
    else { hookX = G.crane.anchor.x; hookY = G.crane.anchor.y - G.crane.cableLen; hookZ = G.crane.anchor.z; }
    const pos = G.cableLine.geometry.attributes.position;
    pos.setXYZ(0, G.crane.anchor.x, G.crane.anchor.y, G.crane.anchor.z);
    pos.setXYZ(1, hookX, hookY, hookZ);
    pos.needsUpdate = true;
    G.hookMesh.position.set(hookX, hookY + (G.rigged ? 0.5 : 0), hookZ);
    G.hookWorld.set(hookX, hookY, hookZ); // operator's cab camera looks here

    // First control input locks the view to the cab — no privileged views once
    // you're actuating the crane.
    if (!G.actuated) {
      for (const ax of Object.values(G.crane.axes)) {
        if (Math.abs(ax.intent) > 0.02) { this.lockToCab(); break; }
      }
    }

    // swing angle from vertical (of whatever hangs on the line)
    const vx = hookX - G.crane.anchor.x, vy = hookY - G.crane.anchor.y, vz = hookZ - G.crane.anchor.z;
    const len = Math.hypot(vx, vy, vz) || 1;
    G.swing = Math.acos(clamp(-vy / len, -1, 1));
    if (G.rigged && G.swing > G.maxSwing) G.maxSwing = G.swing;

    G.rigger.update(dt);
    const m = this.placement();

    // Overload / out-of-bounds only matter with a load on the hook.
    if (G.rigged) {
      const pct = this.capacityPct();
      if (pct > 150 && m.dyPad > 0.5) {
        this.banksman.say('You\'re overloaded — bring your radius in!', { priority: true });
        this.finish(false, 'Overload — the load moment exceeded the chart and the crane started to tip.');
        return;
      } else if (pct > 100 && !G._warnedSWL) {
        G._warnedSWL = true;
        this.banksman.say('Careful, you\'re getting heavy on that radius.', {});
      }
      if (G.loadBody.position.y < -6) { this.finish(false, 'You lost the load over the side.'); return; }
    }

    this.updatePhase(dt, m, hookX, hookY, hookZ);
    this.updateBanksman(dt, m);

    // HUD
    const mode = G.cameraModes[G.camIndex];
    this.hud.update({
      crane: G.crane,
      loadLabel: G.loadLabel,
      swlPct: G.rigged ? this.capacityPct() : 0,
      windSpeed: G.windSpeed,
      windDirDeg: deg(G.windDir) + 90,
      gustFactor: 0.15 + G.gustFactor * 0.85,
      swing: G.swing,
      cameraMode: mode,
      blindLift: G.blindLift,
      rigged: G.rigged,
      phaseHint: this.phaseHint(),
      stageText: G.stages.length > 1 ? `Load ${G.stageIdx + 1}/${G.stages.length}` : '',
      holdProgress: clamp(G.holdTimer / 1.5, 0, 1),
    });
  }

  // Rig → carry → set → unrig state machine (per stage).
  updatePhase(dt, m, hookX, hookY, hookZ) {
    const G = this.G;
    const load = G.loadBody;
    const resting = load.velocity.length() < 0.6;
    const loadTopY = load.position.y + G.loadSize.y / 2;

    if (G.phase === 'approach') {
      // Rigger walks to the load; operator lowers the empty hook onto it.
      G.rigger.setSignal(resting ? 'down' : 'hold');
      const hookToLoad = Math.hypot(hookX - load.position.x, hookY - loadTopY, hookZ - load.position.z);
      if (!G.rigged && G.rigger.arrived && resting && hookToLoad < 1.8) {
        this.attachLoad();
      }
    } else if (G.phase === 'hooked') {
      // Guidance + settle detection.
      const settled = m.horiz <= G.target.tolXZ && m.dyPad < 0.18 && m.dyPad > -0.25 &&
        m.speed < 0.4 && m.angSpeed < 0.6 && m.yawErr <= G.target.tolYaw;
      if (settled) {
        G.holdTimer += dt;
        if (G.holdTimer > 1.2) {
          G.phase = 'landing';
          G.rigger.walkTo(load.position.x + G.loadSize.x / 2 + 1.2, load.position.z + G.loadSize.z / 2 + 1.2);
          G.rigger.faceToward(load.position.x, load.position.z);
          this.banksman.say('That\'s the mark — set it down. I\'ll get the hooks off.', { priority: true });
        }
      } else {
        G.holdTimer = Math.max(0, G.holdTimer - dt * 2);
      }
    } else if (G.phase === 'landing') {
      // Rigger was sent in on entry; wait for arrival + a steady load, then unhook.
      G.rigger.setSignal(resting ? 'down' : 'stop');
      if (G.rigger.arrived && resting) this.detachLoad();
    } else if (G.phase === 'done-stage') {
      G.phaseTimer -= dt;
      if (G.phaseTimer <= 0) this.beginStage(G.stageIdx + 1);
    }
  }

  phaseHint() {
    const G = this.G;
    switch (G.phase) {
      case 'approach': return G.rigger.arrived ? 'Lower the hook onto the load — the rigger will hook you on.' : 'Rigger walking to the load…';
      case 'hooked': return G.holdTimer > 0 ? 'Steady… let it settle on the mark.' : 'Lift, travel over the mark, kill the swing, lower slow.';
      case 'landing': return 'Set down — rigger is coming in to unhook.';
      default: return '';
    }
  }

  updateCamera(dt) {
    const G = this.G;
    if (!G) return;
    const mode = this.mode === 'briefing' ? 'cab' : G.cameraModes[G.camIndex];

    // Zoom only affects the operator (cab) view — magnify the load below.
    const targetFov = mode === 'cab' ? this.baseFov / this.camZoom : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, targetFov, 8, dt);
      this.camera.updateProjectionMatrix();
    }

    if (mode === 'free') { this.controls.update(); return; }

    const rig = G.crane.cameraRig(mode);
    // In the cab, the operator's eyes are always ON THE LOAD (down the line).
    if (mode === 'cab' && this.mode === 'playing') rig.target = G.hookWorld.clone();
    const k = mode === 'cab' ? 10 : 5;
    this.camera.position.x = damp(this.camera.position.x, rig.pos.x, k, dt);
    this.camera.position.y = damp(this.camera.position.y, rig.pos.y, k, dt);
    this.camera.position.z = damp(this.camera.position.z, rig.pos.z, k, dt);
    this.lookAt.x = damp(this.lookAt.x, rig.target.x, k, dt);
    this.lookAt.y = damp(this.lookAt.y, rig.target.y, k, dt);
    this.lookAt.z = damp(this.lookAt.z, rig.target.z, k, dt);
    this.camera.lookAt(this.lookAt);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    // Guarantee the canvas always matches the window (covers the first frame,
    // DPR quirks, and any resize the event listener might miss).
    if (this._lastW !== innerWidth || this._lastH !== innerHeight) {
      this._lastW = innerWidth; this._lastH = innerHeight; this.onResize();
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    this.banksman.setTime(this.elapsed);
    this.handleKeys();
    if (this.mode === 'playing' && this.G && !this.G.finished) this.updatePlaying(dt);
    this.updateCamera(dt);
    this.animateAtmosphere(dt);
    this.hud.tickCaption(dt);
    this.render();
    this.input.endFrame();
  }
}

new Game();
