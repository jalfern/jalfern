// Ground crew / banksman voice using the Web Speech API, plus the contextual
// logic that decides what a real signaller would call out during a lift.
export class Banksman {
  constructor() {
    this.enabled = 'speechSynthesis' in window;
    this.voice = null;
    this.muted = false;
    this.lastPhrase = '';
    this.lastAt = -999;
    this.now = 0;
    this.queueBusy = false;
    if (this.enabled) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        // Prefer an English male-ish voice for the "on the radio" feel.
        const pref = ['Daniel', 'Google UK English Male', 'Fred', 'Alex', 'Google US English'];
        for (const name of pref) {
          const v = voices.find((x) => x.name === name);
          if (v) { this.voice = v; return; }
        }
        this.voice = voices.find((v) => v.lang && v.lang.startsWith('en')) || voices[0] || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  setTime(t) {
    this.now = t;
  }

  // Speak immediately unless recently muted/repeated. minGap avoids chatter.
  // Captions (onSay) are shown even when muted so guidance is never lost.
  say(text, { minGap = 2.2, priority = false, rate = 1.02, pitch = 0.9 } = {}) {
    if (!priority && text === this.lastPhrase && this.now - this.lastAt < 4) return;
    if (!priority && this.now - this.lastAt < minGap) return;
    this.lastPhrase = text;
    this.lastAt = this.now;
    if (this.onSay) this.onSay(text);
    if (!this.enabled || this.muted) return;
    if (priority) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 1;
    speechSynthesis.speak(u);
  }

  briefing(lines, onDone) {
    // Muted / unsupported: caption the first line and move on.
    if (!this.enabled || this.muted) {
      if (this.onSay && lines.length) this.onSay(lines[0]);
      if (onDone) onDone();
      return;
    }
    speechSynthesis.cancel();
    let i = 0;
    const next = () => {
      if (i >= lines.length) { if (onDone) onDone(); return; }
      const line = lines[i++];
      if (this.onSay) this.onSay(line);
      const u = new SpeechSynthesisUtterance(line);
      if (this.voice) u.voice = this.voice;
      u.rate = 1.0;
      u.pitch = 0.9;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    };
    next();
  }

  stop() {
    if (this.enabled) speechSynthesis.cancel();
  }
}

// Signals guidance from load/target geometry. Returns a short call string, or ''.
// dx, dz are load-to-target offsets in the OPERATOR'S frame (x = across, z = away).
export function guidanceCall({ dx, dz, dyPad, swing, speed, settled, tol }) {
  const near = Math.max(tol * 1.4, 0.4);
  const far = 2.5;
  if (settled) return 'That’s the load. All stop. Good lift.';
  if (swing > 0.9) return 'Whoa — steady the load! Ease off, let it settle.';

  const horiz = Math.hypot(dx, dz);
  if (horiz > far) {
    // Coarse positioning: call the dominant direction.
    if (Math.abs(dz) >= Math.abs(dx)) {
      return dz > 0 ? 'Bring it toward me, come on.' : 'Take it away from me.';
    }
    return dx > 0 ? 'Swing it right, keep coming.' : 'Swing it left, keep coming.';
  }

  if (horiz > near) {
    const parts = [];
    if (Math.abs(dz) > near) parts.push(dz > 0 ? 'a touch toward me' : 'a touch back');
    if (Math.abs(dx) > near) parts.push(dx > 0 ? 'little right' : 'little left');
    return parts.length ? 'Easy now — ' + parts.join(', ') + '.' : 'Hold it right there.';
  }

  // Over the mark — vertical.
  if (dyPad > 1.2) return 'You’re over the mark. Come down slow.';
  if (dyPad > 0.25) return 'Down slow… down slow…';
  if (speed > 0.6) return 'Easy! Cushion it down.';
  return 'Right there — set it down gently.';
}
