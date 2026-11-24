/**
 * Movement input for lobby + battle: virtual joystick (touch/mouse) merged with
 * WASD / arrow keys. `vector` is normalised to length <= 1.
 */
export class Input {
  constructor() {
    this.stick = { x: 0, y: 0 };
    this.keys = new Set();
    this.bindKeyboard();
    this.bindStick();
  }

  bindKeyboard() {
    const isMoveKey = (k) =>
      ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k);
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!isMoveKey(k)) return;
      this.keys.add(k);
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  bindStick() {
    const base = document.getElementById('stickBase');
    const knob = document.getElementById('stickKnob');
    const R = 44;
    let pointerId = null;

    const apply = (dx, dy) => {
      const d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      const x = dx * k;
      const y = dy * k;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      this.stick.x = x / R;
      this.stick.y = y / R;
    };

    const move = (e) => {
      const r = base.getBoundingClientRect();
      apply(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    };

    base.addEventListener('pointerdown', (e) => {
      pointerId = e.pointerId;
      base.setPointerCapture(pointerId);
      move(e);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      move(e);
      e.preventDefault();
    });
    const end = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      apply(0, 0);
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  get vector() {
    let x = this.stick.x;
    let y = this.stick.y;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, len: Math.min(1, len) };
  }
}
