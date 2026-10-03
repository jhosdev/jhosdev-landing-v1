// The cat, on a canvas. catrig.ts knows its shape (a pose turned into one
// silhouette) and its particles; this file draws them: in batches, one fill
// colour per tone. In the about section a rotating sphere of noise resolves
// into the sitting cat, which then idles as particles (the tail sways and
// flicks, it blinks, now and then it looks at you).
// A pure function of time, like everything else the Machine draws.

import { BODY, BODY_STRONG, BORDER, CYAN, E, FAINT, MUTED, P, TEXT, cl, lerp, mulberry32, rgb } from './draw';
import { HIDDEN, field, newPose, newShape, place, sitPose, skin, swarm, type Shape, type Swarm } from './catrig';

/**
 * A particle is a square this many px wide, like the handle's, and the cat's particles are at least SPACING px apart
 * (the handle's stipple, a little looser), and at least SPAN rig units, so a cat drawn large does not need more of them.
 */
export const DOT = 2;
const SPACING = 3;
const SPAN = 0.55;
/** The field the particles read is sampled this many px apart. */
const GRAIN = 3;
/** Tones: the Machine's grey ramp, darkest first, then the asset's cyan. */
const TONES = [BORDER, FAINT, MUTED, BODY, BODY_STRONG, TEXT, CYAN].map((c) => rgb(c));
export const CYAN_TONE = 6;

/** Draws n particles centred on (x, y), each in its tone (HIDDEN is skipped), one fill colour per tone. `size` is per particle or for all. */
export function drawDots(ctx: CanvasRenderingContext2D, x: Float32Array, y: Float32Array, tone: Uint8Array, n: number, size: number | Float32Array = DOT) {
  let used = 0;
  for (let i = 0; i < n; i++) if (tone[i] !== HIDDEN) used |= 1 << tone[i];
  for (let b = 0; b < TONES.length; b++) {
    if (!(used & (1 << b))) continue;
    ctx.fillStyle = TONES[b];
    if (typeof size === 'number') {
      const h = size / 2;
      for (let i = 0; i < n; i++) if (tone[i] === b) ctx.fillRect(x[i] - h, y[i] - h, size, size);
    } else {
      for (let i = 0; i < n; i++) if (tone[i] === b) ctx.fillRect(x[i] - size[i] / 2, y[i] - size[i] / 2, size[i], size[i]);
    }
  }
}

/** The particles for a cat drawn at `sc` px per rig unit, that will take the given shapes. */
export const catSwarm = (shapes: Shape[], sc: number) => swarm(shapes, Math.max(SPACING / sc, SPAN), DOT / 2 / sc);
/** Puts the particles on this shape: rig (0, 0) lands on (ox, gy). `open` blinks. */
export const placeCat = (w: Swarm, s: Shape, ox: number, gy: number, sc: number, open = 1) => place(w, s, field(s, GRAIN / sc), ox, gy, sc, open);

const bump = (x: number, at: number, width: number) => Math.exp(-Math.pow((x - at) / width, 2));

/** Idle: how far the tail tip swings (radians). A slow sway, and every few seconds a quick flick. */
export const tailSwing = (t: number) => 0.11 * Math.sin(t * 1.3) + 0.5 * bump(t % 5.2, 0.6, 0.14) - 0.3 * bump(t % 5.2, 0.9, 0.14);
/** Idle: how open the eyes are (0..1). A blink every few seconds. */
export const eyesOpen = (t: number) => 1 - bump(t % 4.3, 3.2, 0.09);
/** Idle: where the head points. It looks back over its shoulder; every so often it turns to you for a moment. */
export const headYaw = (t: number) => -1 + E.inOutCubic(P(t % 13, 7, 7.5)) - E.inOutCubic(P(t % 13, 9.4, 9.9));

/** The sitting cat in a size x size box, as particles, each with a home on a sphere of noise. */
export interface Cat {
  size: number;
  w: Swarm;
  /** Home on the unit sphere, and two random numbers, per particle. */
  home: Float32Array;
  /** Which particles show when it sits still (the others never join the sphere). */
  seen: Uint8Array;
  bx: Float32Array;
  by: Float32Array;
  bt: Uint8Array;
  bs: Float32Array;
}

const pose = newPose();
const shape = newShape();

/** The sitting cat in its box: the head turned by `yaw`, the tail by `swing`; returns its particles placed. */
function sitDots(w: Swarm, x: number, y: number, size: number, swing: number, open: number, yaw: number) {
  sitPose(pose, swing, yaw);
  skin(pose, shape);
  placeCat(w, shape, x + size * 0.648, y + size * 0.97, size / 52, open);
  return w;
}

/** The sitting cat for a size x size box (CSS px). */
export function buildCat(size: number): Cat {
  const shapes = [-1, 0, 1].map((yaw) => {
    const s = newShape();
    sitPose(pose, 0.5 * yaw, yaw);
    skin(pose, s);
    return s;
  });
  const w = catSwarm(shapes, size / 52);
  sitDots(w, 0, 0, size, 0, 1, -1);
  const n = w.n;
  const seen = Uint8Array.from(w.tone, (t) => (t === HIDDEN ? 0 : 1));
  const rnd = mulberry32(9);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const home = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    // Fibonacci sphere, visited in a shuffled order so neighbours on the cat start far apart.
    const j = (i * 7919) % n;
    const uy = 1 - (j / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(1 - uy * uy);
    home.set([Math.cos(golden * j) * r, uy, Math.sin(golden * j) * r, rnd(), rnd()], i * 5);
  }
  return { size, w, home, seen, bx: new Float32Array(n), by: new Float32Array(n), bt: new Uint8Array(n), bs: new Float32Array(n) };
}

/**
 * Draws the cat with its box's top-left corner at (x, y). `grow` (0..1) brings the sphere of noise in,
 * `form` (0..1) resolves it into the cat: the particles fly to their places on it, and once they are there it idles.
 * `calm` is the still frame: no idle motion.
 */
export function drawCat(ctx: CanvasRenderingContext2D, cat: Cat, x: number, y: number, t: number, grow: number, form: number, calm = false) {
  if (grow <= 0) return;
  const { size, w, home, seen, bx, by, bt, bs } = cat;
  const live = calm ? 0 : Math.pow(cl((form - 0.86) / 0.12), 4);
  sitDots(w, x, y, size, tailSwing(t) * live, calm ? 1 : lerp(1, eyesOpen(t), live), lerp(-1, headYaw(t), live));
  ctx.save();
  ctx.globalAlpha *= grow;
  if (form >= 1) {
    drawDots(ctx, w.x, w.y, w.tone, w.n);
    ctx.restore();
    return;
  }
  const cx = x + size / 2;
  const cy = y + size / 2;
  const R = size * 0.3 * E.outCubic(grow);
  const ry = t * 0.9;
  const rx = 0.4 + 0.25 * Math.sin(t * 0.8);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  for (let i = 0; i < w.n; i++) {
    bt[i] = HIDDEN;
    if (!seen[i]) continue;
    const o = i * 5;
    const r1 = home[o + 3];
    const r2 = home[o + 4];
    const k = E.inOutCubic(cl(form * 1.6 - ((w.x[i] - x) / size) * 0.3 - r1 * 0.2));
    // A particle with no place on the cat this frame (a part in front covers it) fades on the way.
    if (w.tone[i] === HIDDEN && k > 0.5) continue;
    const x1 = home[o] * cosY + home[o + 2] * sinY;
    const z1 = -home[o] * sinY + home[o + 2] * cosY;
    const y2 = home[o + 1] * cosX - z1 * sinX;
    const z2 = home[o + 1] * sinX + z1 * cosX;
    const per = 900 / (900 + z2 * R);
    const depth = (1 - z2) / 2;
    const arc = Math.sin(k * Math.PI);
    bx[i] = lerp(cx + x1 * R * per, w.x[i], k) + arc * (r1 - 0.5) * size * 0.3;
    by[i] = lerp(cy + y2 * R * per, w.y[i], k) - arc * (0.06 + r2 * 0.2) * size * (r2 < 0.5 ? 1 : -1);
    bs[i] = lerp(1 + depth * 1.8, 2, k);
    // In the sphere the far side is dim; on the way the particles brighten to their tone on the cat.
    bt[i] = k > 0.5 && w.tone[i] !== HIDDEN ? w.tone[i] : Math.round(1 + depth * 2 + k * 2);
  }
  drawDots(ctx, bx, by, bt, w.n, bs);
  ctx.restore();
}
