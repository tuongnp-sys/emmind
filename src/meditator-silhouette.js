/** Shared meditator body draw — player + Layer 7 shadow selves. */

import { makeRadialSprite } from './render-cache.js';

let falseGoldGlowSprite = null;

function getFalseGoldGlowSprite() {
  return (falseGoldGlowSprite ??= makeRadialSprite(96, [
    [0, 'rgba(255, 220, 60, 0.55)'],
    [0.45, 'rgba(255, 200, 40, 0.28)'],
    [1, 'transparent'],
  ]));
}

/** @typedef {'ego' | 'doubt' | 'craving' | 'false-gold'} ShadowVariant */

export const SHADOW_VARIANTS = ['ego', 'doubt', 'craving', 'false-gold'];

const PALETTES = {
  ego: {
    body: ['#9aa0a8', '#6a7078', '#505860'],
    head: '#8a9098',
    halo: 'rgba(180, 188, 200, 0.35)',
    dashed: true,
  },
  doubt: {
    body: ['#a898c8', '#6a5888', '#483868'],
    head: '#9078b0',
    halo: 'rgba(140, 110, 200, 0.4)',
    haloOffsetX: 4,
    dashed: true,
  },
  craving: {
    body: ['#d07088', '#a04058', '#782838'],
    head: '#c85870',
    halo: 'rgba(220, 80, 100, 0.38)',
    dashed: false,
  },
  'false-gold': {
    body: ['#f0d878', '#c8a840', '#a08828'],
    head: '#e8c850',
    halo: 'rgba(255, 220, 80, 0.55)',
    falseGoldGlow: true,
    dashed: true,
  },
};

/**
 * @param {CanvasRenderingContext2D} ctx — origin at silhouette center
 * @param {ShadowVariant | 'player'} variant
 * @param {{ scale?: number, time?: number, protectiveCharges?: number }} [opts]
 */
export function drawMeditatorSilhouette(ctx, variant, opts = {}) {
  const scale = opts.scale ?? 1;
  const time = opts.time ?? performance.now();
  const palette = variant === 'player' ? null : PALETTES[variant];
  const flicker =
    palette?.dashed && Math.floor(time * 0.012) % 2 === 0 ? 0.72 : 1;

  ctx.save();
  ctx.scale(scale, scale);
  if (flicker < 1) ctx.globalAlpha = flicker;

  if (palette?.falseGoldGlow) {
    const pulse = 0.65 + Math.sin(time * 0.006) * 0.25;
    ctx.globalAlpha = Math.min(1, pulse);
    ctx.drawImage(getFalseGoldGlowSprite(), -36, -36, 72, 72);
    ctx.globalAlpha = flicker;
  }

  const bodyStops =
    variant === 'player'
      ? ['#e8eef2', '#b8c8d4', '#7eb89a']
      : palette.body;
  const headColor =
    variant === 'player'
      ? opts.protectiveCharges > 0
        ? '#ffe566'
        : '#d4b896'
      : palette.head;
  const haloColor =
    variant === 'player'
      ? `rgba(255,230,120,${opts.protectiveCharges > 0 ? 0.55 : 0.45})`
      : palette.halo;

  const g = ctx.createLinearGradient(0, -24, 0, 24);
  g.addColorStop(0, bodyStops[0]);
  g.addColorStop(0.5, bodyStops[1]);
  g.addColorStop(1, bodyStops[2]);

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = headColor;
  ctx.beginPath();
  const headOx = palette?.haloOffsetX ?? 0;
  ctx.arc(headOx, -14, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = haloColor;
  ctx.beginPath();
  ctx.arc(headOx, -14, 18, 0, Math.PI * 2);
  ctx.fill();

  if (palette?.dashed) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.ellipse(0, 4, 15, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
