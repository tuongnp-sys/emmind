/** Deflection ratio at which output saturates to full speed (60% pull = 100% speed). */
const SATURATION = 0.6;

/**
 * Simple virtual joystick for mobile — maps stick deflection to movement keys.
 */
export class TouchJoystick {
  /**
   * @param {HTMLElement} mountEl — contains .joystick-base and .joystick-stick
   * @param {{ onChange?: (dx: number, dy: number) => void, lockAxis?: 'x' | 'y' | null }} options
   */
  constructor(mountEl, options = {}) {
    this.mount = mountEl;
    this.base = mountEl?.querySelector('.joystick-base');
    this.stick = mountEl?.querySelector('.joystick-stick');
    this.onChange = options.onChange ?? (() => {});
    this.lockAxis = options.lockAxis ?? null;
    this.pointerId = null;
    this.dx = 0;
    this.dy = 0;
    this.radius = 48;
    this.deadZone = 0.10;
    /** Cached base rect — getBoundingClientRect per pointermove forces layout. */
    this.rect = null;

    if (!this.base || !this.stick) return;

    this.mount.style.touchAction = 'none';
    this.base.style.touchAction = 'none';

    // iOS: block long-press text selection / callout at the source.
    this.base.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    this.base.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.base.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.base.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.base.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  setLockAxis(axis) {
    this.lockAxis = axis ?? null;
    if (this.pointerId !== null) {
      return;
    }
    this.resetStick();
  }

  onPointerDown(e) {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.rect = this.base.getBoundingClientRect();
    this.base.setPointerCapture(e.pointerId);
    this.updateFromEvent(e);
    e.preventDefault();
  }

  onPointerMove(e) {
    if (e.pointerId !== this.pointerId) return;
    this.updateFromEvent(e);
    e.preventDefault();
  }

  onPointerUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.rect = null;
    this.resetStick();
    e.preventDefault();
  }

  updateFromEvent(e) {
    const rect = this.rect ?? (this.rect = this.base.getBoundingClientRect());
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = Math.min(rect.width, rect.height) / 2 - 8;
    this.radius = maxR;

    let ox = e.clientX - cx;
    let oy = e.clientY - cy;

    if (this.lockAxis === 'x') {
      oy = 0;
    } else if (this.lockAxis === 'y') {
      ox = 0;
    }

    const dist = Math.hypot(ox, oy);
    if (dist > maxR && dist > 0) {
      ox = (ox / dist) * maxR;
      oy = (oy / dist) * maxR;
    }

    this.stick.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;

    const nx = maxR > 0 ? ox / maxR : 0;
    const ny = maxR > 0 ? oy / maxR : 0;
    const len = Math.hypot(nx, ny);
    if (len < this.deadZone) {
      this.dx = 0;
      this.dy = 0;
    } else if (this.lockAxis === 'x') {
      this.dx = Math.sign(nx) * Math.min(1, Math.abs(nx) / SATURATION);
      this.dy = 0;
    } else if (this.lockAxis === 'y') {
      this.dx = 0;
      this.dy = Math.sign(ny) * Math.min(1, Math.abs(ny) / SATURATION);
    } else {
      const mag = Math.min(1, len / SATURATION);
      this.dx = (nx / len) * mag;
      this.dy = (ny / len) * mag;
    }
    this.onChange(this.dx, this.dy);
  }

  resetStick() {
    this.stick.style.transform = 'translate(-50%, -50%)';
    this.dx = 0;
    this.dy = 0;
    this.onChange(0, 0);
  }

  release() {
    if (this.pointerId !== null && this.base.hasPointerCapture(this.pointerId)) {
      this.base.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.rect = null;
    this.resetStick();
  }
}
