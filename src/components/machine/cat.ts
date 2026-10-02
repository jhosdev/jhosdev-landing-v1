// The cat, on a canvas. catrig.ts knows its shape (a pose turned into one solid
// silhouette); this file fills it, cuts the eyes out, and samples it into
// particles: in the about section a rotating sphere of noise resolves into the
// sitting cat, which is then drawn solid and idles (the tail sways and flicks,
// it blinks, now and then it looks at you).
// A pure function of time, like everything else the Machine draws.

import { BG, BODY, E, P, TAU, TEXT, cl, lerp, mulberry32, rgb } from './draw';
import { newPose, newShape, sitPose, skin, trace, type Shape } from './catrig';

export interface CatPt {
  /** Target, in px inside the size x size box. */
  x: number;
  y: number;
  /** Home on the unit sphere. */
  ux: number;
  uy: number;
  uz: number;
  r1: number;
  r2: number;
}

export interface Cat {
  size: number;
  /** Distance between two neighbouring particles. */
  step: number;
  dot: number;
  pts: CatPt[];
}

/**
 * Fills a silhouette in the text colour (or `style`) and cuts its eyes out. Rig (0, 0) lands on (ox, gy), `sc` px per rig unit.
 * `open` (0..1) blinks the eyes; with `look` (-1..1) they get pupils, and the pupils look that way.
 */
export function fillShape(ctx: CanvasRenderingContext2D, s: Shape, ox: number, gy: number, sc: number, open = 1, style: string | CanvasGradient = rgb(TEXT), look?: number) {
  trace(ctx, s, ox, gy, sc);
  ctx.fillStyle = style;
  ctx.fill();
  for (let i = 0; i < s.eyes.length; i += 5) {
    const x = ox + s.eyes[i] * sc;
    const y = gy - s.eyes[i + 1] * sc;
    const rx = s.eyes[i + 2] * sc;
    const ry = s.eyes[i + 3] * sc;
    ctx.fillStyle = rgb(BG);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, Math.max(0.1 * ry, ry * open), -s.eyes[i + 4], 0, TAU);
    ctx.fill();
    if (look === undefined) continue;
    ctx.fillStyle = rgb(TEXT);
    ctx.beginPath();
    ctx.ellipse(x + look * rx * 0.5, y, rx * 0.24, Math.max(0.05 * ry, ry * 0.86 * open), 0, 0, TAU);
    ctx.fill();
  }
}

const pose = newPose();
const shape = newShape();

/**
 * Paints the sitting cat inside the size x size box whose top-left corner is (x, y), about its centre.
 * `swing` bends the tail, `open` blinks, `yaw` turns the head (-1 looks back over its shoulder, 0 at you, 1 ahead).
 */
export function paintCat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, swing = 0, open = 1, yaw = -1) {
  sitPose(pose, swing, yaw);
  skin(pose, shape);
  fillShape(ctx, shape, x + size * 0.648, y + size * 0.97, size / 52, open);
}

/** The inner rim of whatever is on `src`, `w` px wide: the shape minus the shape eroded. */
export function rimOf(src: HTMLCanvasElement, w: number) {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    return c;
  };
  const eroded = make();
  const rim = make();
  const e = eroded.getContext('2d');
  const r = rim.getContext('2d');
  if (!e || !r) return src;
  e.drawImage(src, 0, 0);
  e.globalCompositeOperation = 'destination-in';
  for (let i = 0; i < 8; i++) e.drawImage(src, Math.cos((i * TAU) / 8) * w, Math.sin((i * TAU) / 8) * w);
  r.drawImage(src, 0, 0);
  r.globalCompositeOperation = 'destination-out';
  r.drawImage(eroded, 0, 0);
  return rim;
}

/**
 * Where a painted shape is solid: paints it on a w x h canvas and returns about `n` points inside it, on a staggered
 * grid, with the grid's step. Squares a little larger than the step, one per point, fill the shape without leaving it.
 */
export function sampleSolid(w: number, h: number, n: number, paint: (o: CanvasRenderingContext2D) => void): { pts: number[][]; step: number } {
  const off = document.createElement('canvas');
  off.width = Math.max(8, Math.ceil(w));
  off.height = Math.max(8, Math.ceil(h));
  const o = off.getContext('2d', { willReadFrequently: true });
  if (!o) return { pts: [[w / 2, h / 2]], step: 2 };
  paint(o);
  const px = o.getImageData(0, 0, off.width, off.height).data;
  // Solid means painted and bright: the eyes are painted too, in the background colour.
  const solid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= off.width || y >= off.height) return false;
    const i = (Math.floor(y) * off.width + Math.floor(x)) * 4;
    return px[i + 3] > 128 && px[i] > 128;
  };
  let area = 0;
  for (let y = 0.5; y < off.height; y += 2) for (let x = 0.5; x < off.width; x += 2) if (solid(x, y)) area += 4;
  const step = Math.max(1.5, Math.sqrt(area / (0.866 * Math.max(1, n))));
  const pts: number[][] = [];
  const e = step * 0.45;
  for (let row = 0, y = step / 2; y < off.height; y += step * 0.866, row++) {
    for (let x = step / 2 + (row % 2 ? step / 2 : 0); x < off.width; x += step) {
      // The whole square has to fit, so the particles never stick out of the outline they replace.
      if (solid(x, y) && solid(x - e, y - e) && solid(x + e, y - e) && solid(x - e, y + e) && solid(x + e, y + e)) pts.push([x, y]);
    }
  }
  return pts.length ? { pts, step } : { pts: [[w / 2, h / 2]], step: 2 };
}

/** Samples the sitting cat for a size x size box (CSS px): about 2200 particles whatever the size. */
export function buildCat(size: number): Cat {
  const { pts: found, step } = sampleSolid(size, size, 2200, (o) => paintCat(o, 0, 0, size));
  const rnd = mulberry32(9);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = found.length;
  const pts = found.map(([x, y], i): CatPt => {
    // Fibonacci sphere, visited in a shuffled order so neighbours on the cat start far apart.
    const j = (i * 7919) % n;
    const uy = 1 - (j / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(1 - uy * uy);
    return { x, y, ux: Math.cos(golden * j) * r, uy, uz: Math.sin(golden * j) * r, r1: rnd(), r2: rnd() };
  });
  return { size, step, dot: step * 1.08, pts };
}

const bump = (x: number, at: number, width: number) => Math.exp(-Math.pow((x - at) / width, 2));

/** Idle: how far the tail tip swings (radians). A slow sway, and every few seconds a quick flick. */
export const tailSwing = (t: number) => 0.11 * Math.sin(t * 1.3) + 0.5 * bump(t % 5.2, 0.6, 0.14) - 0.3 * bump(t % 5.2, 0.9, 0.14);
/** Idle: how open the eyes are (0..1). A blink every few seconds. */
export const eyesOpen = (t: number) => 1 - bump(t % 4.3, 3.2, 0.09);
/** Idle: where the head points. It looks back over its shoulder; every so often it turns to you for a moment. */
export const headYaw = (t: number) => -1 + E.inOutCubic(P(t % 13, 7, 7.5)) - E.inOutCubic(P(t % 13, 9.4, 9.9));

/**
 * Draws the cat with its box's top-left corner at (x, y). `grow` (0..1) brings the sphere of noise in,
 * `form` (0..1) resolves it into the cat: the particles pack into its shape and it turns solid.
 * `calm` is the still frame: no idle motion.
 */
export function drawCat(ctx: CanvasRenderingContext2D, cat: Cat, x: number, y: number, t: number, grow: number, form: number, calm = false) {
  if (grow <= 0) return;
  const { size, dot, pts } = cat;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const R = size * 0.3 * E.outCubic(grow);
  const ry = t * 0.9;
  const rx = 0.4 + 0.25 * Math.sin(t * 0.8);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  // Solid once the particles have arrived: they fade into the shape they made, and only then does it start to move.
  const solid = cl((form - 0.86) / 0.12);
  const dots = 1 - solid * solid;

  if (solid < 1) {
    let last = '';
    for (const p of pts) {
      const k = E.inOutCubic(cl(form * 1.6 - (p.x / size) * 0.3 - p.r1 * 0.2));
      const x1 = p.ux * cosY + p.uz * sinY;
      const z1 = -p.ux * sinY + p.uz * cosY;
      const y2 = p.uy * cosX - z1 * sinX;
      const z2 = p.uy * sinX + z1 * cosX;
      const per = 900 / (900 + z2 * R);
      const depth = (1 - z2) / 2;
      const arc = Math.sin(k * Math.PI);
      const px = lerp(cx + x1 * R * per, x + p.x, k) + arc * (p.r1 - 0.5) * size * 0.3;
      const py = lerp(cy + y2 * R * per, y + p.y, k) - arc * (0.06 + p.r2 * 0.2) * size * (p.r2 < 0.5 ? 1 : -1);
      const sz = lerp(1 + depth * 1.8, dot, k);
      const alpha = Math.round(lerp(0.2 + depth * 0.8, 1, k) * grow * dots * 5) / 5;
      const style = rgb(k > 0.5 ? TEXT : BODY, alpha);
      if (style !== last) ctx.fillStyle = last = style;
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
  }
  if (solid <= 0) return;
  const live = calm ? 0 : Math.pow(solid, 4);
  ctx.save();
  ctx.globalAlpha = Math.sqrt(solid) * grow;
  paintCat(ctx, x, y, size, tailSwing(t) * live, calm ? 1 : eyesOpen(t), lerp(-1, headYaw(t), live));
  ctx.restore();
}
