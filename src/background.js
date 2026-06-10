/** Layer themes for Meditation: 7 Layers of Ascent */

import { makeRadialSprite, makeCircleSprite, makeEllipseSprite } from './render-cache.js';

/** Movement patterns per layer (see obstacle.js for speed multipliers). */
export const MOVEMENT_VERTICAL = 'vertical-down';
export const MOVEMENT_HORIZONTAL = 'horizontal';
export const MOVEMENT_COMBINED = 'combined';

export const LAYER_INFO = [
  {
    id: 1,
    name: 'Earth Ground',
    movement: MOVEMENT_VERTICAL,
    verticalMult: 1,
    horizontalMult: 0,
    music: 'layer-1',
  },
  {
    id: 2,
    name: 'Sky',
    movement: MOVEMENT_HORIZONTAL,
    verticalMult: 0,
    horizontalMult: 1,
    music: 'layer-2',
  },
  {
    id: 3,
    name: 'Stratosphere',
    movement: MOVEMENT_VERTICAL,
    verticalMult: 1.2,
    horizontalMult: 0,
    music: 'layer-3',
  },
  {
    id: 4,
    name: 'Low Earth Orbit',
    movement: MOVEMENT_HORIZONTAL,
    verticalMult: 0,
    horizontalMult: 1.2,
    music: 'layer-4',
  },
  {
    id: 5,
    name: 'Moon Orbit',
    movement: MOVEMENT_VERTICAL,
    verticalMult: 1.44,
    horizontalMult: 0,
    music: 'layer-5',
  },
  {
    id: 6,
    name: 'Mars Orbit',
    movement: MOVEMENT_COMBINED,
    verticalMult: 1,
    horizontalMult: 1,
    music: 'layer-6',
  },
  {
    id: 7,
    name: 'Outside Solar System',
    movement: MOVEMENT_COMBINED,
    verticalMult: 1.2,
    horizontalMult: 1.2,
    music: 'layer-7',
  },
];

/** Layer duration bounds (seconds) — scales with mindfulness (halo). */
export const LAYER_DURATION_MIN = 45;
export const LAYER_DURATION_MAX = 90;

/** Layer overlay duration — keep in sync with main.js `layerTransitionTimer`. */
export const LAYER_TRANSITION_DURATION = 2.2;

export const MAX_LAYER = 7;
export const MAX_DOWNGRADE_STRIKES = 3;

/** Practice points needed within the current layer to ascend (layer 7 uses victory flow). */
export const LAYER_PRACTICE_TARGETS = {
  1: 180,
  2: 200,
  3: 220,
  4: 240,
  5: 260,
  6: 280,
  7: 300,
};

/** In-layer day cycle length (seconds) for gradient tint on lower layers. */
export const DAY_CYCLE_SEC = 90;

const LAYER_THEMES = {
  1: ['#1e3328', '#2d4a3e', '#4a7a5a'],
  2: ['#3a5a8a', '#5a8ab8', '#9ec8f0'],
  3: ['#1a2848', '#3a5088', '#88b0e8'],
  4: ['#080c18', '#141c38', '#2a3868'],
  5: ['#12121a', '#282838', '#585878'],
  6: ['#281018', '#482820', '#885838'],
  7: ['#040208', '#0c0820', '#281050'],
};

const LAYER_THEMES_NIGHT = {
  1: ['#0e1812', '#162820', '#2a4038'],
  2: ['#1a2848', '#2a3868', '#4a6090'],
  3: ['#0a1020', '#1a2848', '#3a5088'],
};

export function getLayerPracticeTarget(layerId) {
  return LAYER_PRACTICE_TARGETS[layerId] ?? 200;
}

/** Compound +20% obstacle speed per layer, plus tier bonus (+20% L1–4, +10% L5–7). */
export function getLayerSpeedFactor(layer) {
  const safeLayer = Math.max(1, Math.min(MAX_LAYER, layer));
  const compound = Math.pow(1.2, safeLayer - 1);
  const tierBonus = safeLayer <= 4 ? 1.2 : 1.1;
  return compound * tierBonus;
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function lerpHexColor(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const r = lerpChannel(ca.r, cb.r, t);
  const g = lerpChannel(ca.g, cb.g, t);
  const bl = lerpChannel(ca.b, cb.b, t);
  return `rgb(${r},${g},${bl})`;
}

function getThemeColors(layer, cyclePhase = 0) {
  const base = LAYER_THEMES[layer] || LAYER_THEMES[1];
  if (layer > 3 || cyclePhase <= 0) return [...base];
  const night = LAYER_THEMES_NIGHT[layer];
  if (!night) return [...base];
  const duskStart = 0.55;
  if (cyclePhase < duskStart) return [...base];
  const t = (cyclePhase - duskStart) / (1 - duskStart);
  return [
    lerpHexColor(base[0], night[0], t),
    lerpHexColor(base[1], night[1], t),
    lerpHexColor(base[2], night[2], t),
  ];
}

export function getLayerConfig(layerId) {
  return LAYER_INFO.find((l) => l.id === layerId) || LAYER_INFO[0];
}

/** Duration for current layer: 45–90s from accumulated mindfulness (halo 0–100). */
export function getLayerDuration(haloEnergy, haloMax = 100) {
  const t = Math.max(0, Math.min(1, haloEnergy / haloMax));
  return LAYER_DURATION_MIN + t * (LAYER_DURATION_MAX - LAYER_DURATION_MIN);
}

export function getLayerName(layerId) {
  const info = getLayerConfig(layerId);
  return `Layer ${info.id}: ${info.name}`;
}

export function getLayerMindfulnessQuote(layerId) {
  const quotes = {
    1: 'Root yourself in the present moment.',
    2: 'Let thoughts drift like clouds.',
    3: 'Rise above distraction with gentle breath.',
    4: 'Observe without attachment.',
    5: 'Illuminate the path with inner light.',
    6: 'Release what no longer serves you.',
    7: 'Rest in boundless awareness.',
  };
  return quotes[layerId] || 'Breathe. Focus. Ascend.';
}

/** Congratulatory message when ascending to a layer. */
export function getLayerAscendMessage(layerId) {
  const messages = {
    1: 'Welcome to Earth Ground — root your breath and begin.',
    2: 'With joy, you rise into the Sky — move freely in all directions.',
    3: 'Well done! The Stratosphere welcomes your steady focus.',
    4: 'Splendid ascent! Low Earth Orbit shines beneath your calm.',
    5: 'Brilliant! Moon Orbit reflects your growing light.',
    6: 'Outstanding! Mars Orbit cannot shake your patience.',
    7: 'Magnificent! You stand at the edge of the cosmos.',
  };
  return messages[layerId] || 'Your ascent continues — breathe and rejoice.';
}

/** Encouragement when descending a layer. */
export function getLayerDescendMessage(layerId) {
  const messages = {
    1: 'Be gentle on Earth Ground. Each breath is a fresh beginning.',
    2: 'The Sky waits for you. Be gentle — return when you are ready.',
    3: 'Stratosphere calls again. Persist with kindness toward yourself.',
    4: 'Orbit is within reach. Slow down, breathe, and try once more.',
    5: 'The Moon still glows for you. Patience is your path back.',
    6: 'Mars Orbit is not lost forever. Center yourself and ascend again.',
    7: 'Even here, at the cosmos edge, patience opens the way forward.',
  };
  return messages[layerId] || 'Be patient. Mindfulness will carry you upward again.';
}

// --- Shared sprites (rendered once; drawImage is far cheaper than per-frame
// --- gradient/arc rasterization on low-end Android GPUs) ----------------------

const STAR_HUES = [200, 225, 250, 275, 300];
let spriteSet = null;

function getSprites() {
  if (spriteSet) return spriteSet;
  spriteSet = {
    starWhite: makeCircleSprite(16, '#ffffff'),
    starHues: STAR_HUES.map((hue) => makeCircleSprite(16, `hsl(${hue}, 75%, 90%)`)),
    sparkle: makeCircleSprite(16, 'rgb(255, 220, 160)'),
    cloud: makeEllipseSprite(64, 26, '#ffffff'),
    glow: makeRadialSprite(64, [
      [0, 'rgba(255, 252, 240, 0.55)'],
      [1, 'rgba(255, 252, 240, 0)'],
    ]),
  };
  return spriteSet;
}

function hueSpriteIndex(hue) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < STAR_HUES.length; i++) {
    const d = Math.abs(STAR_HUES[i] - hue);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Offscreen caches render at half logical resolution — gradients are soft, upscale is invisible. */
const BG_CACHE_SCALE = 0.5;
/** Day-cycle re-render granularity (~every 1.9s of the 90s cycle). */
const CYCLE_BUCKETS = 48;
/** Layer transition re-render granularity (~16 re-renders over 2.2s). */
const BLEND_BUCKETS = 16;

export class Background {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layer = 1;
    this.time = 0;
    this.ascentBorderPulse = 0;
    this.victoryGlow = 0;
    this.logicalWidth = 900;
    this.logicalHeight = 520;
    this.stars = [];
    this.clouds = [];
    this.sparkles = [];
    this.cosmicEnlightenment = false;
    this.cosmicStars = [];
    this.layerElapsed = 0;
    this.transitionBlend = 1;
    this.transitionFrom = null;
    this.transitionTo = null;
    /** @type {HTMLCanvasElement | null} sky + ambient + moon, re-rendered only on key change */
    this._bgCache = null;
    this._bgCacheKey = '';
    /** @type {HTMLCanvasElement | null} nebula baked at pulse=1, drawn with globalAlpha */
    this._nebulaCache = null;
    this._nebulaCacheKey = '';
    /** @type {HTMLCanvasElement | null} victory radiance baked at full alpha */
    this._victoryCache = null;
    this._victoryCacheKey = '';
    /** @type {HTMLCanvasElement | null} enlightenment deep space + nebulas */
    this._cosmicCache = null;
    this._cosmicCacheKey = '';
    this._initParticles();
  }

  _initParticles() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const starCount = 80 + this.layer * 25;
    this.stars = Array.from({ length: starCount }, () => {
      const hue = 200 + Math.random() * 80;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.2,
        speed: Math.random() * 0.4 + 0.08,
        alpha: Math.random() * 0.6 + 0.2,
        hue,
        spriteIdx: hueSpriteIndex(hue),
      };
    });
    this.clouds = Array.from({ length: 8 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.5,
      w: 60 + Math.random() * 80,
      speed: 0.2 + Math.random() * 0.4,
      alpha: 0.12 + Math.random() * 0.18,
    }));
    this.sparkles = Array.from({ length: 40 + this.layer * 12 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      phase: Math.random() * Math.PI * 2,
      size: Math.random() * 2 + 0.5,
    }));
  }

  setLayer(layer) {
    const next = Math.max(1, Math.min(MAX_LAYER, layer));
    if (next !== this.layer) {
      this.beginLayerTransition(this.layer, next);
      this.layer = next;
      this._initParticles();
    } else {
      this.layer = next;
    }
  }

  beginLayerTransition(fromLayer, toLayer) {
    this.transitionFrom = getThemeColors(fromLayer, 0);
    this.transitionTo = getThemeColors(toLayer, 0);
    this.transitionBlend = 0;
  }

  setLayerElapsed(seconds) {
    this.layerElapsed = Math.max(0, seconds);
  }

  setAscentBorderPulse(value) {
    this.ascentBorderPulse = Math.max(0, Math.min(1, value));
  }

  setVictoryGlow(value) {
    this.victoryGlow = Math.max(0, Math.min(1, value));
  }

  setCosmicEnlightenment(enabled) {
    this.cosmicEnlightenment = Boolean(enabled);
    if (this.cosmicEnlightenment) {
      this._initCosmicField();
    } else {
      this.cosmicStars = [];
    }
  }

  _initCosmicField() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const layerSpecs = [
      { count: 220, depth: 0.25, rMin: 0.15, rMax: 0.9, bright: 0.12 },
      { count: 180, depth: 0.55, rMin: 0.35, rMax: 1.4, bright: 0.22 },
      { count: 120, depth: 1.0, rMin: 0.6, rMax: 2.2, bright: 0.38 },
    ];
    this.cosmicStars = [];
    for (const spec of layerSpecs) {
      for (let i = 0; i < spec.count; i++) {
        const hue = 200 + Math.random() * 100;
        this.cosmicStars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: spec.rMin + Math.random() * (spec.rMax - spec.rMin),
          depth: spec.depth,
          driftX: (Math.random() - 0.5) * 12 * spec.depth,
          driftY: (4 + Math.random() * 18) * spec.depth,
          phase: Math.random() * Math.PI * 2,
          hue,
          spriteIdx: hueSpriteIndex(hue),
          bright: spec.bright + Math.random() * 0.35,
          glow: Math.random() < 0.08,
        });
      }
    }
    // Depth order is fixed — sort once here instead of every frame.
    this.cosmicStars.sort((a, b) => a.depth - b.depth);
  }

  setDimensions(width, height) {
    if (width <= 0 || height <= 0) return;
    if (width === this.logicalWidth && height === this.logicalHeight) return;
    this.logicalWidth = width;
    this.logicalHeight = height;
    this._initParticles();
    if (this.cosmicEnlightenment) {
      this._initCosmicField();
    }
  }

  update(dt) {
    this.time += dt;
    if (this.cosmicEnlightenment) {
      this._updateCosmicField(dt);
      return;
    }
    if (this.transitionBlend < 1) {
      this.transitionBlend = Math.min(1, this.transitionBlend + dt * 1.4);
    }
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const starSpeed = 0.4 + this.layer * 0.35;

    for (const s of this.stars) {
      s.y += s.speed * starSpeed * dt * 60;
      s.alpha = 0.25 + Math.sin(this.time * 2 + s.x) * 0.2 + this.layer * 0.04;
      if (s.y > h) {
        s.y = 0;
        s.x = Math.random() * w;
      }
    }

    for (const c of this.clouds) {
      c.x -= c.speed * 40 * dt;
      if (c.x + c.w < 0) {
        c.x = w + 20;
        c.y = Math.random() * h * 0.4;
      }
    }

    for (const sp of this.sparkles) {
      sp.phase += dt * (1.5 + this.layer * 0.3);
    }
  }

  _updateCosmicField(dt) {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    for (const s of this.cosmicStars) {
      s.x += s.driftX * dt;
      s.y += s.driftY * dt;
      s.phase += dt * (0.8 + s.depth * 1.6);
      if (s.y > h + 4) {
        s.y = -4;
        s.x = Math.random() * w;
      }
      if (s.x < -4) s.x = w + 4;
      if (s.x > w + 4) s.x = -4;
    }
  }

  /** Create (or reuse) a half-res offscreen canvas with logical-coordinate transform. */
  _prepareCacheCanvas(existing, w, h) {
    const cw = Math.max(1, Math.ceil(w * BG_CACHE_SCALE));
    const ch = Math.max(1, Math.ceil(h * BG_CACHE_SCALE));
    let cv = existing;
    if (!cv || cv.width !== cw || cv.height !== ch) {
      cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = ch;
    }
    const cctx = cv.getContext('2d');
    cctx.setTransform(BG_CACHE_SCALE, 0, 0, BG_CACHE_SCALE, 0, 0);
    cctx.clearRect(0, 0, w, h);
    return { canvas: cv, ctx: cctx };
  }

  _getCosmicCache(w, h) {
    const key = `${w}x${h}`;
    if (this._cosmicCacheKey === key && this._cosmicCache) return this._cosmicCache;

    const { canvas, ctx } = this._prepareCacheCanvas(this._cosmicCache, w, h);

    const deep = ctx.createLinearGradient(0, 0, 0, h);
    deep.addColorStop(0, '#060818');
    deep.addColorStop(0.35, '#0c0824');
    deep.addColorStop(0.7, '#140a30');
    deep.addColorStop(1, '#040208');
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, w, h);

    const nebula = ctx.createRadialGradient(w * 0.35, h * 0.4, 0, w * 0.35, h * 0.4, w * 0.75);
    nebula.addColorStop(0, 'rgba(100, 60, 180, 0.18)');
    nebula.addColorStop(0.5, 'rgba(40, 20, 90, 0.08)');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);

    const nebula2 = ctx.createRadialGradient(w * 0.78, h * 0.25, 0, w * 0.78, h * 0.25, w * 0.45);
    nebula2.addColorStop(0, 'rgba(180, 140, 255, 0.1)');
    nebula2.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, w, h);

    this._cosmicCache = canvas;
    this._cosmicCacheKey = key;
    return canvas;
  }

  _drawCosmicEnlightenment(ctx, w, h) {
    ctx.drawImage(this._getCosmicCache(w, h), 0, 0, w, h);

    const sprites = getSprites();
    for (const s of this.cosmicStars) {
      const twinkle = 0.55 + Math.sin(this.time * 2.2 + s.phase) * 0.45;
      const alpha = Math.min(1, Math.max(0, s.bright * twinkle));
      if (alpha <= 0.01) continue;
      if (s.glow) {
        const gr = s.r * 5;
        ctx.globalAlpha = alpha * 0.5;
        ctx.drawImage(sprites.glow, s.x - gr, s.y - gr, gr * 2, gr * 2);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprites.starHues[s.spriteIdx], s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;

    if (this.victoryGlow > 0) {
      this._drawVictoryRadiance(ctx, w, h);
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    if (this.cosmicEnlightenment) {
      this._drawCosmicEnlightenment(ctx, w, h);
      return;
    }

    const L = this.layer;

    ctx.drawImage(this._getStaticBackground(w, h), 0, 0, w, h);

    if (this.transitionBlend < 0.35) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 240, 180, ${(1 - this.transitionBlend / 0.35) * 0.12})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (L >= 2 && L <= 3) this._drawClouds(ctx);
    if (L >= 3) this._drawStars(ctx);
    if (L >= 5) this._drawSparkles(ctx);
    if (L === 1) this._drawGround(ctx, w, h);
    if (L >= 6) this._drawNebula(ctx, w, h);
    if (L === 7) this._drawCosmicRings(ctx, w, h);

    if (this.victoryGlow > 0) {
      this._drawVictoryRadiance(ctx, w, h);
    }

    if (this.ascentBorderPulse > 0) {
      this._drawAscentBorderPulse(ctx, w, h);
    }
  }

  /**
   * Sky gradient + ambient glow + moon, cached offscreen. Re-rendered only
   * when layer/size changes, the day cycle moves a bucket, or during the
   * 2.2s layer transition (16 quantized steps).
   */
  _getStaticBackground(w, h) {
    const L = this.layer;
    const cyclePhase =
      L <= 3 && DAY_CYCLE_SEC > 0
        ? (this.layerElapsed % DAY_CYCLE_SEC) / DAY_CYCLE_SEC
        : 0;
    const cycleBucket = Math.floor(cyclePhase * CYCLE_BUCKETS);

    const inTransition = this.transitionFrom && this.transitionTo && this.transitionBlend < 1;
    const blendBucket = inTransition
      ? Math.floor(this.transitionBlend * BLEND_BUCKETS)
      : BLEND_BUCKETS;

    const key = `${L}|${w}x${h}|${cycleBucket}|${blendBucket}`;
    if (this._bgCacheKey === key && this._bgCache) return this._bgCache;

    let colors = getThemeColors(L, cycleBucket / CYCLE_BUCKETS);
    if (inTransition) {
      const t = blendBucket / BLEND_BUCKETS;
      colors = colors.map((c, i) =>
        lerpHexColor(this.transitionFrom[i] || c, this.transitionTo[i] || c, t)
      );
    }

    const { canvas, ctx } = this._prepareCacheCanvas(this._bgCache, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colors[2]);
    grad.addColorStop(0.45, colors[1]);
    grad.addColorStop(1, colors[0]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (L === 5) this._drawMoon(ctx, w, h);
    this._drawAmbientGlow(ctx, w, h);

    this._bgCache = canvas;
    this._bgCacheKey = key;
    return canvas;
  }

  _drawGround(ctx, w, h) {
    ctx.fillStyle = '#1e3328';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) {
      const y = h - 40 - Math.sin(x * 0.02 + this.time) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  _drawClouds(ctx) {
    const sprites = getSprites();
    for (const c of this.clouds) {
      ctx.globalAlpha = Math.min(1, Math.max(0, c.alpha));
      ctx.drawImage(sprites.cloud, c.x - c.w * 0.5, c.y - c.w * 0.2, c.w, c.w * 0.4);
    }
    ctx.globalAlpha = 1;
  }

  _drawStars(ctx) {
    const sprites = getSprites();
    const useHue = this.layer >= 6;
    for (const s of this.stars) {
      const a = Math.min(1, Math.max(0, s.alpha));
      if (a <= 0.01) continue;
      const sprite = useHue ? sprites.starHues[s.spriteIdx] : sprites.starWhite;
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  _drawSparkles(ctx) {
    const sprites = getSprites();
    const layerFactor = this.layer / 7;
    for (const sp of this.sparkles) {
      const a = (0.2 + Math.sin(sp.phase) * 0.35) * layerFactor;
      if (a <= 0.01) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprites.sparkle, sp.x - sp.size, sp.y - sp.size, sp.size * 2, sp.size * 2);
    }
    ctx.globalAlpha = 1;
  }

  _drawMoon(ctx, w, h) {
    const mx = w * 0.75;
    const my = h * 0.2;
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
    glow.addColorStop(0, 'rgba(220,220,255,0.5)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - 90, my - 90, 180, 180);

    ctx.fillStyle = '#d8d8f0';
    ctx.beginPath();
    ctx.arc(mx, my, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Nebula baked at pulse=1; the per-frame pulse becomes a globalAlpha multiply. */
  _getNebulaCache(w, h) {
    const key = `${w}x${h}`;
    if (this._nebulaCacheKey === key && this._nebulaCache) return this._nebulaCache;

    const { canvas, ctx } = this._prepareCacheCanvas(this._nebulaCache, w, h);

    const g = ctx.createRadialGradient(w * 0.3, h * 0.35, 0, w * 0.3, h * 0.35, w * 0.55);
    g.addColorStop(0, 'rgba(160,100,220,1)');
    g.addColorStop(0.45, 'rgba(80,50,140,0.5)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * 0.8, h * 0.6, 0, w * 0.8, h * 0.6, w * 0.4);
    g2.addColorStop(0, 'rgba(255,180,100,0.35)');
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    this._nebulaCache = canvas;
    this._nebulaCacheKey = key;
    return canvas;
  }

  _drawNebula(ctx, w, h) {
    const pulse = 0.35 + Math.sin(this.time * 0.5) * 0.12;
    ctx.globalAlpha = Math.min(1, Math.max(0, pulse));
    ctx.drawImage(this._getNebulaCache(w, h), 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  _drawCosmicRings(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.45;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      const r = 80 + i * 55 + Math.sin(this.time * 0.3 + i) * 8;
      ctx.strokeStyle = `rgba(180, 140, 255, ${0.08 + i * 0.04})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.35, this.time * 0.1 + i * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawAmbientGlow(ctx, w, h) {
    const sage = 0.06 + this.layer * 0.02;
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.85, 0, w * 0.5, h, h * 0.65);
    glow.addColorStop(0, `rgba(126,184,154,${sage})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    if (this.layer >= 5) {
      const topGlow = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, h * 0.3, h * 0.5);
      topGlow.addColorStop(0, `rgba(200, 160, 255, ${0.06 + this.layer * 0.015})`);
      topGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** Victory radiance baked at full alpha; pulse applied via globalAlpha. */
  _getVictoryCache(w, h) {
    const key = `${w}x${h}`;
    if (this._victoryCacheKey === key && this._victoryCache) return this._victoryCache;

    const { canvas, ctx } = this._prepareCacheCanvas(this._victoryCache, w, h);

    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
    g.addColorStop(0, 'rgba(255, 240, 180, 0.45)');
    g.addColorStop(0.4, 'rgba(255, 200, 120, 0.2)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    this._victoryCache = canvas;
    this._victoryCacheKey = key;
    return canvas;
  }

  _drawVictoryRadiance(ctx, w, h) {
    const pulse = 0.5 + Math.sin(this.time * 1.2) * 0.25;
    const a = this.victoryGlow * pulse;
    if (a <= 0.01) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(this._getVictoryCache(w, h), 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  _drawAscentBorderPulse(ctx, w, h) {
    const flicker = 0.65 + Math.sin(this.time * 10) * 0.35;
    const alpha = this.ascentBorderPulse * flicker * 0.55;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 220, 140, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.restore();
  }
}
