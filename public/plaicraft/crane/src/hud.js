// All DOM/overlay handling: menu, briefing, in-game HUD, captions, result panel.
import { clamp, deg } from './util.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.leverEls = [];
    this.captionTimer = 0;
  }

  // -------- Menu --------
  showMenu(scenarios, onSelect) {
    const menu = $('menu');
    const grid = $('scenarioGrid');
    grid.innerHTML = '';
    scenarios.forEach((cfg, i) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-diff diff-${cfg.difficulty.replace(/\s/g, '')}">${cfg.difficulty}</div>
        <h3>${cfg.title}</h3>
        <div class="card-loc">${cfg.location}</div>
        <div class="card-crane">${cfg.craneLabel}</div>
        <p>${cfg.objective}</p>`;
      card.onclick = () => onSelect(i);
      grid.appendChild(card);
    });
    menu.classList.remove('hidden');
    $('briefing').classList.add('hidden');
    $('result').classList.add('hidden');
    $('hud').classList.add('hidden');
  }

  hideMenu() {
    $('menu').classList.add('hidden');
  }

  // -------- Briefing --------
  showBriefing(cfg, onStart) {
    const b = $('briefing');
    $('briefTitle').textContent = cfg.title;
    $('briefLoc').textContent = `${cfg.location}  ·  ${cfg.name}`;
    $('briefObjective').textContent = cfg.objective;
    $('briefTips').innerHTML = cfg.tips.map((t) => `<li>${t}</li>`).join('');
    $('briefControls').innerHTML = cfg.controlHelp.map((t) => `<li>${t}</li>`).join('');
    b.classList.remove('hidden');
    $('startBtn').onclick = onStart;
  }

  hideBriefing() {
    $('briefing').classList.add('hidden');
  }

  // -------- In-game --------
  startGame(cfg) {
    $('hud').classList.remove('hidden');
    // Build lever gauges for this crane's axes.
    const wrap = $('levers');
    wrap.innerHTML = '';
    this.leverEls = [];
    const labels = cfg.axisLabels;
    for (const key of Object.keys(cfg.axes)) {
      const row = document.createElement('div');
      row.className = 'lever';
      row.innerHTML = `
        <span class="lever-name">${labels[key] || key}</span>
        <div class="lever-track"><div class="lever-fill"></div><div class="lever-center"></div></div>
        <span class="lever-val">0</span>`;
      wrap.appendChild(row);
      this.leverEls.push({ key, fill: row.querySelector('.lever-fill'), val: row.querySelector('.lever-val') });
    }
  }

  update(s) {
    // Levers.
    for (const l of this.leverEls) {
      const ax = s.crane.axes[l.key];
      const intent = clamp(ax.intent, -1, 1);
      const fill = l.fill;
      const pct = Math.abs(intent) * 50;
      if (intent >= 0) {
        fill.style.left = '50%';
        fill.style.width = pct + '%';
        fill.style.background = intent > 0.02 ? '#4fd1ff' : 'transparent';
      } else {
        fill.style.left = 50 - pct + '%';
        fill.style.width = pct + '%';
        fill.style.background = '#ffb14f';
      }
      l.val.textContent = /slew|swing/.test(l.key) ? deg(ax.value).toFixed(0) + '°' : ax.value.toFixed(1);
    }

    // Telemetry.
    $('telem').innerHTML = s.crane.telemetry().map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');

    // Load / SWL.
    const swlPct = s.swlPct;
    const swlEl = $('swl');
    const stage = s.stageText ? `${s.stageText}  ·  ` : '';
    swlEl.textContent = s.rigged ? `${stage}${s.loadLabel}   ·   ${swlPct.toFixed(0)}% SWL`
      : `${stage}${s.loadLabel}   ·   hook free`;
    swlEl.className = s.rigged && swlPct > 100 ? 'danger' : s.rigged && swlPct > 85 ? 'warn' : '';
    const ph = $('phaseHint');
    if (ph) ph.textContent = s.phaseHint || '';

    // Wind.
    $('windSpeed').textContent = `${s.windSpeed.toFixed(1)} m/s`;
    $('windArrow').style.transform = `rotate(${s.windDirDeg}deg)`;
    $('windGust').style.opacity = s.gustFactor.toFixed(2);

    // Swing meter.
    const swingDeg = deg(s.swing);
    const bar = $('swingBar');
    bar.style.width = clamp((swingDeg / 20) * 100, 0, 100) + '%';
    bar.style.background = swingDeg > 8 ? '#ff5252' : swingDeg > 4 ? '#ffc14f' : '#4fd18a';
    $('swingVal').textContent = swingDeg.toFixed(1) + '°';

    // Camera + status.
    $('camMode').textContent = s.cameraMode.toUpperCase() + (s.blindLift ? ' · BLIND LIFT' : '');
    $('rigged').textContent = s.rigged ? 'HOOKED' : 'HOOK FREE';
    $('rigged').className = s.rigged ? 'ok' : 'muted';

    // Placement progress ring.
    $('placeFill').style.width = clamp(s.holdProgress * 100, 0, 100) + '%';
  }

  caption(text) {
    const c = $('caption');
    c.textContent = '“' + text + '”';
    c.classList.add('show');
    this.captionTimer = 3.5;
  }

  tickCaption(dt) {
    if (this.captionTimer > 0) {
      this.captionTimer -= dt;
      if (this.captionTimer <= 0) $('caption').classList.remove('show');
    }
  }

  toast(text, kind = '') {
    const t = $('toast');
    t.textContent = text;
    t.className = 'show ' + kind;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => (t.className = ''), 2600);
  }

  showResult(r, onRetry, onMenu) {
    const el = $('result');
    $('resultTitle').textContent = r.success ? 'LIFT COMPLETE' : 'LIFT FAILED';
    $('resultTitle').className = r.success ? 'ok' : 'fail';
    $('resultGrade').textContent = r.grade;
    $('resultGrade').style.color = r.success ? '#4fd18a' : '#ff5252';
    $('resultReason').textContent = r.reason;
    $('resultStats').innerHTML = r.stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    el.classList.remove('hidden');
    $('retryBtn').onclick = onRetry;
    $('menuBtn').onclick = onMenu;
  }

  hideResult() {
    $('result').classList.add('hidden');
  }

  toggleHelp() {
    $('help').classList.toggle('hidden');
  }
}
