/**
 * Pre-rendered sprite helpers — replace per-frame createRadialGradient/arc
 * calls with cheap drawImage blits (big win on low-end Android GPUs).
 */

/**
 * Radial-gradient sprite centered in a square canvas.
 * @param {number} size canvas size in px (diameter)
 * @param {Array<[number, string]>} stops gradient color stops
 * @returns {HTMLCanvasElement}
 */
export function makeRadialSprite(size, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [offset, color] of stops) {
    g.addColorStop(offset, color);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Solid filled circle sprite (for stars/sparkles drawn many times per frame).
 * @param {number} size canvas size in px
 * @param {string} color fill color
 * @returns {HTMLCanvasElement}
 */
export function makeCircleSprite(size, color) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/**
 * White ellipse sprite (clouds).
 * @returns {HTMLCanvasElement}
 */
export function makeEllipseSprite(width, height, color) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, width / 2 - 0.5, height / 2 - 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}
