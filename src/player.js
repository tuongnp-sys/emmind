import { makeRadialSprite } from './render-cache.js';

// Glow sprites baked once — per-frame createRadialGradient is slow on mobile GPUs.
let auraSprite = null;
let enlightenSprite = null;
let shockwaveSprite = null;

function getAuraSprite() {
  return (auraSprite ??= makeRadialSprite(128, [
    [0, 'rgba(255, 250, 180, 0.65)'],
    [0.45, 'rgba(255, 220, 80, 0.35)'],
    [1, 'transparent'],
  ]));
}

function getEnlightenSprite() {
  return (enlightenSprite ??= makeRadialSprite(192, [
    [0, 'rgba(255, 252, 230, 0.7)'],
    [0.3, 'rgba(255, 235, 150, 0.45)'],
    [0.65, 'rgba(255, 210, 90, 0.2)'],
    [1, 'transparent'],
  ]));
}

function getShockwaveSprite() {
  return (shockwaveSprite ??= makeRadialSprite(192, [
    [0, 'rgba(212, 184, 150, 0.35)'],
    [0.5, 'rgba(126, 184, 154, 0.25)'],
    [1, 'transparent'],
  ]));
}

export class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.gameWidth = 900;
    this.gameHeight = 520;
    this.width = 36;
    this.height = 48;
    this.speed = 280;
    this.gravity = 1400;
    this.jumpForce = 480;
    this.velocityY = 0;
    this.groundY = 0;

    this.shockwaveActive = false;
    this.shockwaveElapsed = 0;
    this.shockwaveDuration = 0.55;
    this.shockwaveMaxRadius = 165;
    this.shockwaveRadius = 0;

    this.invincible = 0;
    this.enlightenment = 0;
    this.protectiveCharges = 0;
    this.pickupFlash = 0;
    this.driftDirX = 0;
    this.driftDirY = 0;
    this.driftRetargetTimer = 0;
    this.cosmicDriftSpeedFactor = 0.75;
    /** @type {((center: { x: number, y: number }) => void) | null} */
    this.onJump = null;
    this.resetPosition();
  }

  resetPosition() {
    this.x = this.gameWidth * 0.15;
    this.groundY = this.gameHeight - this.height - 24;
    this.y = this.groundY;
    this.velocityY = 0;
    this.shockwaveActive = false;
    this.shockwaveElapsed = 0;
    this.shockwaveRadius = 0;
  }

  onCanvasResize(width, height) {
    if (width <= 0 || height <= 0) return;

    const xRatio = width / this.gameWidth;
    const yRatio = height / this.gameHeight;

    this.x *= xRatio;
    this.y *= yRatio;
    this.gameWidth = width;
    this.gameHeight = height;
    this.groundY = height - this.height - 24;

    const margin = 8;
    this.x = Math.max(margin, Math.min(width - this.width - margin, this.x));
    if (this.y > this.groundY) {
      this.y = this.groundY;
      this.velocityY = 0;
    }
    this._clampToBounds(margin);
  }

  getCenter() {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  isOnGround() {
    return this.y >= this.groundY - 0.5;
  }

  jump() {
    if (this.isOnGround()) {
      this.velocityY = -this.jumpForce;
      if (this.onJump) {
        this.onJump(this.getCenter());
      }
    }
  }

  triggerShockwave() {
    if (this.shockwaveActive) return false;
    this.shockwaveActive = true;
    this.shockwaveElapsed = 0;
    this.shockwaveRadius = 0;
    return true;
  }

  getShockwaveCircle() {
    if (!this.shockwaveActive) return null;
    const c = this.getCenter();
    return { cx: c.x, cy: c.y, r: this.shockwaveRadius };
  }

  getBounds() {
    const pad = 6;
    return {
      x: this.x + pad,
      y: this.y + pad,
      w: this.width - pad * 2,
      h: this.height - pad * 2,
    };
  }

  setProtectiveCharges(charges) {
    this.protectiveCharges = Math.max(0, Math.min(2, charges));
  }

  setEnlightenment(level) {
    this.enlightenment = Math.max(0, Math.min(1, level));
  }

  triggerPickupFlash() {
    this.pickupFlash = 0.45;
  }

  resetCosmicDrift() {
    const angle = Math.random() * Math.PI * 2;
    this.driftDirX = Math.cos(angle);
    this.driftDirY = Math.sin(angle);
    this.driftRetargetTimer = 2 + Math.random() * 2;
  }

  clearCosmicDrift() {
    this.driftDirX = 0;
    this.driftDirY = 0;
    this.driftRetargetTimer = 0;
  }

  _retargetDriftFromBounds(margin = 8) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const midX = this.gameWidth / 2;
    const midY = this.gameHeight / 2;
    let dx = midX - cx;
    let dy = midY - cy;
    if (Math.hypot(dx, dy) < 1) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    }
    const norm = this._normalizeAxis(dx, dy);
    this.driftDirX = norm.dx;
    this.driftDirY = norm.dy;
    this.driftRetargetTimer = 1.5 + Math.random() * 1.5;
  }

  _clampToBounds(margin = 8) {
    const maxY = this.gameHeight - this.height - margin;
    this.x = Math.max(margin, Math.min(this.gameWidth - this.width - margin, this.x));
    this.y = Math.max(margin, Math.min(maxY, this.y));
  }

  _normalizeAxis(dx, dy) {
    if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
    const len = Math.hypot(dx, dy);
    return { dx: dx / len, dy: dy / len };
  }

  update(dt, keys, options = {}) {
    const { freeMove = false, moveVector = null, cosmicDrift = false, dragMove = null } = options;

    if (cosmicDrift) {
      this.driftRetargetTimer -= dt;
      if (this.driftRetargetTimer <= 0) {
        this.resetCosmicDrift();
      }

      const driftSpeed = this.speed * this.cosmicDriftSpeedFactor;
      const margin = 8;
      const maxY = this.gameHeight - this.height - margin;
      this.x += this.driftDirX * driftSpeed * dt;
      this.y += this.driftDirY * driftSpeed * dt;
      this.velocityY = 0;

      const unclampedX = this.x;
      const unclampedY = this.y;
      this.x = Math.max(margin, Math.min(this.gameWidth - this.width - margin, this.x));
      this.y = Math.max(margin, Math.min(maxY, this.y));

      if (this.x !== unclampedX || this.y !== unclampedY) {
        this._retargetDriftFromBounds(margin);
      }
    } else if (freeMove) {
      if (dragMove && (dragMove.dx !== 0 || dragMove.dy !== 0)) {
        // Direct-drag position control: finger displacement is applied 1:1
        // (no speed cap) — the character keeps up with the finger by design.
        this.x += dragMove.dx;
        this.y += dragMove.dy;
        this.velocityY = 0;
        this._clampToBounds();
      } else {
        let dx = 0;
        let dy = 0;

        if (moveVector && (moveVector.x !== 0 || moveVector.y !== 0)) {
          dx = moveVector.x;
          dy = moveVector.y;
        } else {
          if (keys.ArrowLeft || keys.KeyA || keys.a) dx -= 1;
          if (keys.ArrowRight || keys.KeyD || keys.d) dx += 1;
          if (keys.ArrowUp || keys.KeyW || keys.w) dy -= 1;
          if (keys.ArrowDown || keys.KeyS || keys.s) dy += 1;
        }

        const norm = this._normalizeAxis(dx, dy);
        this.x += norm.dx * this.speed * dt;
        this.y += norm.dy * this.speed * dt;
        this.velocityY = 0;
        this._clampToBounds();
      }
    } else {
      if (dragMove && dragMove.dx !== 0) {
        this.x += dragMove.dx;
      } else {
        let dx = 0;
        const analogX = options.groundMoveX;
        if (typeof analogX === 'number' && Math.abs(analogX) > 0.03) {
          dx = analogX;
        } else {
          if (keys.ArrowLeft || keys.KeyA || keys.a) dx -= 1;
          if (keys.ArrowRight || keys.KeyD || keys.d) dx += 1;
          if (dx !== 0) dx /= Math.abs(dx);
        }
        this.x += dx * this.speed * dt;
      }
      this.velocityY += this.gravity * dt;
      this.y += this.velocityY * dt;

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.velocityY = 0;
      }

      const topMargin = 8;
      if (this.y < topMargin) {
        this.y = topMargin;
        if (this.velocityY < 0) this.velocityY = 0;
      }

      this.x = Math.max(8, Math.min(this.gameWidth - this.width - 8, this.x));
    }

    if (this.invincible > 0) this.invincible -= dt;
    if (this.pickupFlash > 0) this.pickupFlash -= dt;

    if (this.shockwaveActive) {
      this.shockwaveElapsed += dt;
      const t = Math.min(1, this.shockwaveElapsed / this.shockwaveDuration);
      const eased = 1 - Math.pow(1 - t, 2.5);
      this.shockwaveRadius = this.shockwaveMaxRadius * eased;
      if (this.shockwaveElapsed >= this.shockwaveDuration) {
        this.shockwaveActive = false;
        this.shockwaveRadius = 0;
      }
    }
  }

  draw(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const flicker = this.invincible > 0 && Math.floor(this.invincible * 20) % 2 === 0;

    if (this.protectiveCharges > 0) {
      const pulse = 0.75 + Math.sin(performance.now() * 0.008) * 0.25;
      const chargeScale = this.protectiveCharges / 2;
      const r = 28 + chargeScale * 22 * pulse;
      ctx.globalAlpha = Math.min(1, pulse);
      ctx.drawImage(getAuraSprite(), cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = `rgba(255, 245, 200, ${0.7 * pulse})`;
      ctx.lineWidth = 2 + chargeScale;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.pickupFlash > 0) {
      const t = this.pickupFlash / 0.45;
      ctx.fillStyle = `rgba(255, 240, 120, ${0.35 * t})`;
      ctx.fillRect(this.x - 8, this.y - 8, this.width + 16, this.height + 16);
    }

    if (this.enlightenment > 0) {
      const pulse = 0.75 + Math.sin(performance.now() * 0.003) * 0.25;
      const r = 55 + this.enlightenment * 95 * pulse;
      ctx.globalAlpha = Math.min(1, this.enlightenment);
      ctx.drawImage(getEnlightenSprite(), cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = `rgba(255, 248, 210, ${0.65 * this.enlightenment * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.shockwaveActive) {
      const alpha = 1 - this.shockwaveElapsed / this.shockwaveDuration;
      const sr = this.shockwaveRadius;
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
      ctx.drawImage(getShockwaveSprite(), cx - sr, cy - sr, sr * 2, sr * 2);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = `rgba(255,240,180,${0.55 * alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (flicker) return;

    ctx.save();
    ctx.translate(cx, cy);

    // Fixed local-space gradient — create once and reuse every frame.
    if (!this._bodyGrad) {
      const g = ctx.createLinearGradient(0, -24, 0, 24);
      g.addColorStop(0, '#e8eef2');
      g.addColorStop(0.5, '#b8c8d4');
      g.addColorStop(1, '#7eb89a');
      this._bodyGrad = g;
    }

    ctx.fillStyle = this._bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.protectiveCharges > 0 ? '#ffe566' : '#d4b896';
    ctx.beginPath();
    ctx.arc(0, -14, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,230,120,${this.protectiveCharges > 0 ? 0.55 : 0.45})`;
    ctx.beginPath();
    ctx.arc(0, -14, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
