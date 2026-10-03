// Shared vocabulary of the Machine: palette, easing, deterministic noise and the
// few canvas primitives used by both the authored intro (scene.ts) and the
// section movements (runtime.ts). Everything is a pure function of its inputs.

export type RGB = readonly [number, number, number];

// Site tokens + the classification scheme. Each colour means one thing:
// white = unclassified, RED = unidentified / recording, AMBER = under analysis,
// CYAN = confirmed asset (and anything you can act on), GREEN = system nominal.
export const BG: RGB = [11, 14, 19];
export const PANEL: RGB = [14, 18, 25];
export const BORDER: RGB = [28, 35, 45];
export const FAINT: RGB = [61, 71, 84];
export const MUTED: RGB = [93, 106, 121];
export const BODY: RGB = [141, 153, 168];
export const BODY_STRONG: RGB = [199, 209, 220];
export const TEXT: RGB = [240, 244, 248];
export const GREEN: RGB = [87, 217, 163];
export const CYAN: RGB = [110, 224, 255];
export const AMBER: RGB = [255, 200, 87];
export const RED: RGB = [255, 92, 92];
/**
 * The cat's coat, and nothing else: a tabby in warm steps, darkest first (deep stripe, stripe, the coat's far step, coat,
 * ginger, cream's far step, cream). Her eyes are the system's green.
 */
export const COAT_RGB: readonly RGB[] = [
  [104, 74, 54],
  [142, 100, 66],
  [150, 104, 66],
  [196, 138, 84],
  [226, 168, 104],
  [196, 164, 138],
  [236, 225, 208],
];

export const TAU = Math.PI * 2;
/** IBM Plex Mono advance width, in em. */
export const CW = 0.6;

export const rgb = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a < 0 ? 0 : a})`);
export const cl = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Progress of t through [a, b], clamped to 0..1. */
export const P = (t: number, a: number, b: number) => cl((t - a) / (b - a));
export const E = {
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inOutSine: (x: number) => (1 - Math.cos(Math.PI * x)) / 2,
  inOutQuint: (x: number) => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outBack: (x: number, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};

// Seeded PRNG + stateless hash: same frame for the same t, every load.
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(n: number) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&$/<>=+*';
/** Text resolving left to right out of scrambled glyphs; k = 0..1. */
export function decode(str: string, k: number, t: number, seed = 0) {
  if (k >= 1) return str;
  const done = k * str.length;
  const frame = Math.floor(t * 24);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += str[i] === ' ' || str[i] === '\n' || i < done ? str[i] : GLYPHS[Math.floor(hash(i * 131 + seed * 7919 + frame * 977) * GLYPHS.length)];
  }
  return out;
}
export const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
export const pad = (n: number, w: number) => String(n).padStart(w, '0');
export const font = (size: number, weight = 400) => `${weight} ${size}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;

/** Dashed polyline with marching ants, drawn on by k = 0..1. */
export function dash(ctx: CanvasRenderingContext2D, points: number[][], k: number, col: string, t: number) {
  if (k <= 0) return;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  let left = total * cl(k);
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.lineDashOffset = -t * 14;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length && left > 0; i++) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const u = Math.min(1, left / (len || 1));
    ctx.lineTo(lerp(points[i - 1][0], points[i][0], u), lerp(points[i - 1][1], points[i][1], u));
    left -= len;
  }
  ctx.stroke();
  ctx.restore();
}

/** Point at fraction u (0..1) along a polyline. */
export function along(points: number[][], u: number): number[] {
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let left = cl(u) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? cl(left / lens[i]) : 0;
      return [lerp(points[i][0], points[i + 1][0], k), lerp(points[i][1], points[i + 1][1], k)];
    }
    left -= lens[i];
  }
  return points[0];
}

// ---- the map: streets with entities patrolling them (period-periodic) ----
export interface Ent {
  hz: boolean;
  line: number;
  base: number;
  amp: number;
  w: number;
  ph: number;
  id: string;
}
export interface Streets {
  xs: number[];
  ys: number[];
  ents: Ent[];
}

/** Entity 0 is the subject: mid street, right of centre, barely moving. */
export function buildStreets(W: number, H: number, period: number): Streets {
  const rnd = mulberry32(412);
  const nx = cl(Math.round(W / 140), 4, 11);
  const ny = cl(Math.round(H / 120), 4, 7);
  const xs = Array.from({ length: nx }, (_, i) => ((i + 0.5 + (rnd() - 0.5) * 0.5) / nx) * W);
  const ys = Array.from({ length: ny }, (_, i) => ((i + 0.5 + (rnd() - 0.5) * 0.5) / ny) * H);
  const ents: Ent[] = [{ hz: true, line: Math.floor(ny / 2), base: W * 0.56, amp: W * 0.025, w: TAU / period, ph: 1, id: '????' }];
  const n = Math.round(nx * ny * 2);
  for (let i = 0; i < n; i++) {
    const hz = rnd() < 0.5;
    const len = hz ? W : H;
    ents.push({
      hz,
      line: Math.floor(rnd() * (hz ? ny : nx)),
      base: (0.06 + rnd() * 0.88) * len,
      amp: (0.03 + rnd() * 0.08) * len * (rnd() < 0.5 ? -1 : 1),
      w: (TAU * (1 + Math.floor(rnd() * 3))) / period,
      ph: rnd() * TAU,
      id: Math.floor(rnd() * 65536).toString(16).toUpperCase().padStart(4, '0'),
    });
  }
  return { xs, ys, ents };
}

export function entPos(map: Streets, e: Ent, t: number) {
  const pos = e.base + e.amp * Math.sin(t * e.w + e.ph);
  return e.hz ? [pos, map.ys[e.line]] : [map.xs[e.line], pos];
}

export function drawStreets(ctx: CanvasRenderingContext2D, map: Streets, t: number, a: number, W: number, H: number) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgb(FAINT, a * 0.5);
  ctx.beginPath();
  for (const x of map.xs) {
    ctx.moveTo(x, -40);
    ctx.lineTo(x, H + 40);
  }
  for (const y of map.ys) {
    ctx.moveTo(-40, y);
    ctx.lineTo(W + 40, y);
  }
  ctx.stroke();
  ctx.fillStyle = rgb(FAINT, a);
  for (const x of map.xs) for (const y of map.ys) ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
  ctx.fillStyle = rgb(BODY, a);
  for (const e of map.ents) {
    const p = entPos(map, e, t);
    ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
  }
}
