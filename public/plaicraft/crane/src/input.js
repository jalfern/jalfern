// Keyboard input with held-state + edge-triggered (just-pressed) queries.
export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set(); // just-pressed this frame
    this._blockDefault = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF',
    ]);
    const typing = (e) => {
      const el = e.target;
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    target.addEventListener('keydown', (e) => {
      if (typing(e)) return; // don't drive the crane while typing to the banksman
      if (this._blockDefault.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      if (typing(e)) return;
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  isDown(code) {
    return this.down.has(code);
  }

  // Axis from a pair of keys → [-1, 1].
  axis(negCode, posCode) {
    return (this.isDown(posCode) ? 1 : 0) - (this.isDown(negCode) ? 1 : 0);
  }

  justPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}
