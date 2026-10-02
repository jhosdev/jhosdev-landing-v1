// The cat. A sitting-cat silhouette is drawn with paths on an offscreen canvas
// and sampled into particle targets (the same trick the intro uses for the
// handle); the particles start as a rotating sphere of noise and resolve into
// it. Formed, it idles: the tail sways and flicks, the eyes blink.
// A pure function of time, like everything else the Machine draws.

import { BG, BODY, E, TAU, TEXT, cl, lerp, mulberry32, rgb } from './draw';

interface CatPt {
  /** Target, in px inside the size x size box. */
  x: number;
  y: number;
  /** Home on the unit sphere. */
  ux: number;
  uy: number;
  uz: number;
  r1: number;
  r2: number;
  /** 0 for the body; for the tail, how far along it this point is (0..1). */
  tail: number;
}

export interface Cat {
  size: number;
  dot: number;
  pts: CatPt[];
}

// The silhouette lives on a 100 x 100 grid, y down.
const TAIL_ROOT = [61, 89];
const EYES = [
  [37.5, 30.5, 0.22],
  [53.5, 30.5, -0.22],
];

function body(o: CanvasRenderingContext2D) {
  // Haunches and chest: a pear sitting on the floor.
  o.beginPath();
  o.moveTo(35, 42);
  o.bezierCurveTo(22, 52, 13, 74, 19, 91);
  o.quadraticCurveTo(21, 96, 27, 96);
  o.lineTo(60, 96);
  o.quadraticCurveTo(68, 96, 69, 88);
  o.bezierCurveTo(71, 72, 66, 52, 56, 42);
  o.closePath();
  o.fill();
  // Head, with cheeks a little wider than the skull.
  o.beginPath();
  o.ellipse(45.5, 31, 20.5, 16.5, 0, 0, TAU);
  o.fill();
  // Ears.
  for (const [ax, ay, bx, by, cx, cy] of [
    [26, 27, 27.5, 4, 43, 16.5],
    [48, 16.5, 63.5, 4, 65, 27],
  ]) {
    o.beginPath();
    o.moveTo(ax, ay);
    o.lineTo(bx, by);
    o.lineTo(cx, cy);
    o.closePath();
    o.fill();
  }
  // Whiskers: thin enough to sample as a dotted line.
  o.lineWidth = 1.1;
  o.beginPath();
  for (const side of [-1, 1]) {
    for (const [dy0, dx, dy1] of [
      [35.5, 15, 32.5],
      [38, 17, 38.5],
      [40.5, 14, 44.5],
    ]) {
      o.moveTo(45.5 + side * 17, dy0);
      o.lineTo(45.5 + side * (17 + dx), dy1);
    }
  }
  o.stroke();
  // Cut-outs: the inside of the ears, the gap between the front legs.
  o.globalCompositeOperation = 'destination-out';
  for (const [ax, ay, bx, by, cx, cy] of [
    [31, 22, 31.5, 12.5, 37.5, 18],
    [53.5, 18, 59.5, 12.5, 60, 22],
  ]) {
    o.beginPath();
    o.moveTo(ax, ay);
    o.lineTo(bx, by);
    o.lineTo(cx, cy);
    o.closePath();
    o.fill();
  }
  o.lineWidth = 2.2;
  o.beginPath();
  o.moveTo(42, 76);
  o.lineTo(42, 97);
  o.moveTo(27, 96);
  o.quadraticCurveTo(34, 88, 41, 93);
  o.stroke();
}

function tail(o: CanvasRenderingContext2D) {
  o.lineWidth = 7;
  o.beginPath();
  o.moveTo(TAIL_ROOT[0], TAIL_ROOT[1]);
  o.bezierCurveTo(80, 97, 95, 86, 88, 68);
  o.bezierCurveTo(85, 60, 89, 54, 95, 57);
  o.stroke();
}

function sample(size: number, step: number, paint: (o: CanvasRenderingContext2D) => void): number[][] {
  const n = Math.max(8, Math.ceil(size));
  const off = document.createElement('canvas');
  off.width = off.height = n;
  const o = off.getContext('2d', { willReadFrequently: true });
  if (!o) return [];
  o.scale(size / 100, size / 100);
  o.fillStyle = o.strokeStyle = '#fff';
  o.lineCap = o.lineJoin = 'round';
  paint(o);
  const px = o.getImageData(0, 0, n, n).data;
  const out: number[][] = [];
  for (let row = 0, y = step / 2; y < n; y += step, row++) {
    for (let x = step / 2 + (row % 2 ? step / 2 : 0); x < n; x += step) {
      if (px[(Math.floor(y) * n + Math.floor(x)) * 4 + 3] > 110) out.push([x, y]);
    }
  }
  return out;
}

/** Samples the silhouette for a size x size box (CSS px). About 1100 particles whatever the size. */
export function buildCat(size: number): Cat {
  const step = Math.max(2, size / 62);
  const s = size / 100;
  const reach = 46 * s; // the tail tip is about this far from its root
  const found = [
    ...sample(size, step, body).map(([x, y]) => [x, y, 0]),
    ...sample(size, step, tail).map(([x, y]) => [x, y, cl(Math.hypot(x - TAIL_ROOT[0] * s, y - TAIL_ROOT[1] * s) / reach, 0.02, 1)]),
  ];
  const rnd = mulberry32(9);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = found.length;
  const pts = found.map(([x, y, along], i): CatPt => {
    // Fibonacci sphere, visited in a shuffled order so neighbours on the cat start far apart.
    const j = (i * 7919) % n;
    const uy = 1 - (j / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(1 - uy * uy);
    return { x, y, ux: Math.cos(golden * j) * r, uy, uz: Math.sin(golden * j) * r, r1: rnd(), r2: rnd(), tail: along };
  });
  return { size, dot: Math.max(1.6, step * 0.56), pts };
}

const bump = (x: number, at: number, width: number) => Math.exp(-Math.pow((x - at) / width, 2));

/**
 * Draws the cat with its box's top-left corner at (x, y). `grow` (0..1) brings the sphere of
 * noise in, `form` (0..1) resolves it into the cat. `calm` is the still frame: no idle motion.
 */
export function drawCat(ctx: CanvasRenderingContext2D, cat: Cat, x: number, y: number, t: number, grow: number, form: number, calm = false) {
  if (grow <= 0) return;
  const { size, dot, pts } = cat;
  const s = size / 100;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const R = size * 0.3 * E.outCubic(grow);
  const ry = t * 0.9;
  const rx = 0.4 + 0.25 * Math.sin(t * 0.8);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  // Idle: a slow sway, and every few seconds a quick flick of the tail and a blink.
  const swing = calm ? 0.05 : 0.11 * Math.sin(t * 1.3) + 0.5 * bump(t % 5.2, 0.6, 0.14) - 0.3 * bump(t % 5.2, 0.9, 0.14);
  const open = calm ? 1 : 1 - bump(t % 4.3, 3.2, 0.09);
  const rootX = x + TAIL_ROOT[0] * s;
  const rootY = y + TAIL_ROOT[1] * s;

  let last = '';
  for (const p of pts) {
    const k = E.inOutCubic(cl(form * 1.5 - (p.x / size) * 0.3 - p.r1 * 0.2));
    let tx = x + p.x;
    let ty = y + p.y;
    if (p.tail) {
      // The tail bends more toward its tip.
      const a = swing * Math.pow(p.tail, 1.5);
      const dx = tx - rootX;
      const dy = ty - rootY;
      tx = rootX + dx * Math.cos(a) - dy * Math.sin(a);
      ty = rootY + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (!calm) {
      // The dots never sit completely still.
      tx += Math.sin(t * 1.7 + p.r1 * TAU) * 0.45;
      ty += Math.cos(t * 1.3 + p.r2 * TAU) * 0.45;
    }
    const x1 = p.ux * cosY + p.uz * sinY;
    const z1 = -p.ux * sinY + p.uz * cosY;
    const y2 = p.uy * cosX - z1 * sinX;
    const z2 = p.uy * sinX + z1 * cosX;
    const per = 900 / (900 + z2 * R);
    const depth = (1 - z2) / 2;
    const arc = Math.sin(k * Math.PI);
    const px = lerp(cx + x1 * R * per, tx, k) + arc * (p.r1 - 0.5) * size * 0.3;
    const py = lerp(cy + y2 * R * per, ty, k) - arc * (0.06 + p.r2 * 0.2) * size * (p.r2 < 0.5 ? 1 : -1);
    const sz = lerp(1 + depth * 1.8, dot, k);
    const alpha = Math.round(lerp(0.2 + depth * 0.8, 0.6 + p.r2 * 0.4, k) * grow * 5) / 5;
    const style = rgb(k > 0.5 ? TEXT : BODY, alpha);
    if (style !== last) ctx.fillStyle = last = style;
    ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
  }

  // The face arrives last: eyes (they blink) and a nose, cut out of the dots.
  const face = cl((form - 0.86) / 0.14) * grow;
  if (face <= 0) return;
  for (const [ex, ey, tilt] of EYES) {
    ctx.fillStyle = rgb(BG, face);
    ctx.beginPath();
    ctx.ellipse(x + ex * s, y + ey * s, 5.2 * s, 4.2 * s, tilt, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(TEXT, face);
    ctx.beginPath();
    ctx.ellipse(x + ex * s, y + ey * s, 4 * s, Math.max(0.35, 3.1 * open) * s, tilt, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(BG, face);
    ctx.beginPath();
    ctx.ellipse(x + ex * s, y + ey * s, 1.05 * s, Math.max(0.2, 2.7 * open) * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgb(BG, face);
  ctx.beginPath();
  ctx.moveTo(x + 43.4 * s, y + 36.6 * s);
  ctx.lineTo(x + 47.6 * s, y + 36.6 * s);
  ctx.lineTo(x + 45.5 * s, y + 39.4 * s);
  ctx.closePath();
  ctx.fill();
}
