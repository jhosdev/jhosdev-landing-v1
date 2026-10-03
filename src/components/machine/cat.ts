// The cat, on a canvas. catrig.ts knows her shape (a pose turned into one
// silhouette) and her particles; catkeys.ts what she does; this file draws
// them: in batches, one fill colour per tone and brightness. It also keeps the
// looks (how many particles, how they are spread, sized and lit) and the stage
// the about section and the hero share: a sphere of particles the Machine
// analyses until it resolves into her, and then she goes on with her day.
// A pure function of time, like everything else the Machine draws.

import { BODY, BODY_STRONG, BORDER, COAT_RGB, CYAN, E, FAINT, GREEN, MUTED, TEXT, cl, lerp, mulberry32, rgb } from './draw';
import { GREY, HIDDEN, TONE_COUNT, field, newPose, newShape, place, skin, swarm, type Shape, type Style, type Swarm } from './catrig';
import { keyed, stand, type Keys } from './catkeys';

/** The handle's particle: a square this many px wide. */
export const DOT = 2;
/** The field the particles read is sampled this many px apart. */
const GRAIN = 4;
/**
 * Tones: the Machine's grey ramp, darkest first, and the asset's cyan; then the cat's coat (catrig.ts names them):
 * two stripe browns, the coat and its far step, ginger, cream and its far step, and her eyes in the system's green.
 */
const RGBS = [BORDER, FAINT, MUTED, BODY, BODY_STRONG, TEXT, CYAN, ...COAT_RGB, GREEN];
const TONES = RGBS.map((c) => rgb(c));
/** Each tone at the brightness steps a particle can have: full, middle, dim, and a veil's faint speck. */
const ALPHA = [1, 0.74, 0.46, 0.3];
const STEPS = ALPHA.length;
const LIT = RGBS.flatMap((c) => ALPHA.map((a) => rgb(c, a)));
const STREAK = RGBS.flatMap((c) => ALPHA.map((a) => rgb(c, a * 0.45)));
export const CYAN_TONE = 6;

/**
 * The looks, after the owner's reference sheet: each a particle count (for a cat 6 px per rig unit; smaller cats get
 * fewer), how much the outline gathers them, how many stray, their sizes and brightness, and whether they streak.
 */
export const STYLES = {
  /** Few particles, far apart, a scatter of big bright ones: the cat is a constellation. */
  sparse: { count: 1300, edge: 5, band: 0.2, stray: 0.03, size: [1.5, 3.8, 2.2], bright: 0.5, mid: 0.32, even: 0.85, trail: 0 },
  /** More of them, from specks to large drops. */
  varied: { count: 2300, edge: 2.6, band: 0.26, stray: 0.05, size: [0.9, 4.2, 2.3], bright: 0.36, mid: 0.36, even: 0.75, trail: 0 },
  /** A dense cloud of fine particles, the outline only a little stronger. */
  cloud: { count: 5600, edge: 1.9, band: 0.3, stray: 0.025, size: [0.9, 1.9, 1.7], bright: 0.34, mid: 0.4, even: 0.55, trail: 0 },
  /** Fine, even and clean: a strong outline, no strays. */
  detail: { count: 3800, edge: 4.2, band: 0.15, stray: 0, size: [1.2, 2.2, 1.4], bright: 0.55, mid: 0.33, even: 0.95, trail: 0 },
  /** Soft: very many faint specks, a frayed edge. */
  soft: { count: 7500, edge: 1.6, band: 0.35, stray: 0.12, size: [0.8, 1.6, 1.4], bright: 0.18, mid: 0.36, even: 0.35, trail: 0 },
  /** Cloud and soft at once: a dense core of fine particles carries the form, a veil of faint specks frays its edge. */
  haze: { count: 4400, edge: 2.1, band: 0.3, stray: 0.02, size: [0.9, 1.9, 1.7], bright: 0.4, mid: 0.4, even: 0.55, trail: 0, veil: 6000, fray: 2.6 },
  /** Sparse, and every moving particle leaves a short streak behind it. */
  motion: { count: 1500, edge: 3, band: 0.24, stray: 0.07, size: [1.1, 3.4, 2.4], bright: 0.42, mid: 0.34, even: 0.8, trail: 0.035 },
} satisfies Record<string, Style>;
export type StyleName = keyof typeof STYLES;
/** The look the site uses (the intro, the about section, the hero). */
export const LOOK: StyleName = 'haze';

/** The particles for a cat drawn at `sc` px per rig unit, that will take the given shapes (the first is where they are laid out). */
export const catSwarm = (shapes: Shape[], sc: number, style: Style = STYLES[LOOK]) => swarm(shapes, style, sc, DOT / 2 / sc);
/** Puts the particles on this shape: rig (0, 0) lands on (ox, gy). `open` closes the eyes. */
export const placeCat = (w: Swarm, s: Shape, ox: number, gy: number, sc: number, open = 1) => place(w, s, field(s, GRAIN / sc), ox, gy, sc, open);

/** Draws n square particles centred on (x, y), each in its tone (HIDDEN is skipped), one fill colour per tone. `size` is per particle or for all. */
export function drawDots(ctx: CanvasRenderingContext2D, x: Float32Array, y: Float32Array, tone: Uint8Array, n: number, size: number | Float32Array = DOT) {
  const start = bucket(tone, null, n, 1);
  for (let b = 0; b < TONE_COUNT; b++) {
    if (start[b] === start[b + 1]) continue;
    ctx.fillStyle = TONES[b];
    for (let j = start[b]; j < start[b + 1]; j++) {
      const i = order[j];
      const s = typeof size === 'number' ? size : size[i];
      ctx.fillRect(x[i] - s / 2, y[i] - s / 2, s, s);
    }
  }
}

let order = new Int32Array(0);
/** Sorts the shown particles by tone (and brightness step, `steps` of them) once, a counting sort; returns where each batch starts in `order`. */
function bucket(tone: Uint8Array, lit: Uint8Array | null, n: number, steps: number) {
  const start = new Int32Array(TONE_COUNT * steps + 1);
  if (order.length < n) order = new Int32Array(n + 1024);
  for (let i = 0; i < n; i++) if (tone[i] !== HIDDEN) start[tone[i] * steps + (lit ? lit[i] : 0) + 1]++;
  for (let b = 0; b < TONE_COUNT * steps; b++) start[b + 1] += start[b];
  const at = start.slice();
  for (let i = 0; i < n; i++) if (tone[i] !== HIDDEN) order[at[tone[i] * steps + (lit ? lit[i] : 0)]++] = i;
  return start;
}

/**
 * Draws a cat's particles: each its own size and brightness, small ones as squares and big ones round. With `prev`
 * (where they were a moment ago), each leaves a faint streak back to it.
 */
export function drawSwarm(ctx: CanvasRenderingContext2D, w: Swarm, prev?: { x: Float32Array; y: Float32Array }) {
  const { x, y, size } = w;
  const start = bucket(w.tone, w.lit, w.n, STEPS);
  for (let b = 0; b < TONE_COUNT * STEPS; b++) {
    if (start[b] === start[b + 1]) continue;
    if (prev) {
      ctx.strokeStyle = STREAK[b];
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let j = start[b]; j < start[b + 1]; j++) {
        const i = order[j];
        const dx = prev.x[i] - x[i];
        const dy = prev.y[i] - y[i];
        const l = Math.hypot(dx, dy);
        if (l < 2) continue;
        // A streak never longer than a few dots: a fast leap smears, it does not turn into lines.
        const k = Math.min(1, 16 / l);
        ctx.moveTo(x[i], y[i]);
        ctx.lineTo(x[i] + dx * k, y[i] + dy * k);
      }
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.fillStyle = LIT[b];
    let round = false;
    // The small ones, as squares in paths of a few hundred: one fill for many instead of one each.
    ctx.beginPath();
    for (let j = start[b], k = 0; j < start[b + 1]; j++) {
      const i = order[j];
      const s = size[i];
      if (s >= 2.4) round = true;
      else ctx.rect(x[i] - s / 2, y[i] - s / 2, s, s);
      if (++k % 256 === 0) {
        ctx.fill();
        ctx.beginPath();
      }
    }
    ctx.fill();
    if (!round) continue;
    ctx.beginPath();
    for (let j = start[b]; j < start[b + 1]; j++) {
      const i = order[j];
      const s = size[i];
      if (s < 2.4) continue;
      ctx.moveTo(x[i] + s / 2, y[i]);
      ctx.arc(x[i], y[i], s / 2, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
}

const prevX = { x: new Float32Array(0), y: new Float32Array(0) };
/**
 * Draws the particles `frame` puts out at time t. A look with a trail asks for them a moment earlier too, and each
 * particle streaks back to where it was then (still a pure function of t).
 */
export function drawFrame(ctx: CanvasRenderingContext2D, frame: (t: number) => Swarm, t: number, trail: number = STYLES[LOOK].trail) {
  if (trail > 0) {
    const w = frame(t - trail);
    if (prevX.x.length < w.n) [prevX.x, prevX.y] = [new Float32Array(w.n), new Float32Array(w.n)];
    prevX.x.set(w.x);
    prevX.y.set(w.y);
  }
  drawSwarm(ctx, frame(t), trail > 0 ? prevX : undefined);
}

/** The Machine has not classified her yet below `line` (px): there she is brightness only, on its grey ramp. */
export function unclassified(w: Swarm, line: number) {
  for (let i = 0; i < w.n; i++) if (w.tone[i] !== HIDDEN && w.y[i] > line) w.tone[i] = GREY[w.tone[i]];
}

/* ------------------------------------------------------------------ stage */

/** A cat on a timeline, fitted in a box: her particles and, for each, a home on a sphere of noise. */
export interface Luna {
  keys: Keys;
  loop: number;
  /** The closest the camera gets (px per rig unit): the particles are laid out for it. */
  sc: number;
  ox: number;
  gy: number;
  w: Swarm;
  /** Home on the unit sphere, and two random numbers, per particle. */
  home: Float32Array;
  /** Where she is drawn when the particles are still on their way (the sphere's own drawing). */
  bx: Float32Array;
  by: Float32Array;
  bt: Uint8Array;
  bs: Float32Array;
  bl: Uint8Array;
  /** The box (CSS px). */
  W: number;
  H: number;
  /** The camera every CAM seconds of the timeline: px per rig unit, where rig x = 0 and the ground land. */
  cam: Float32Array;
  /** Where the timeline starts. */
  from: number;
}

/** The camera is worked out this often (seconds), then eased between. */
const CAM = 0.1;

const pose = newPose();
const shape = newShape();

/** How far one pose reaches (rig units): left, right, top. */
function bounds() {
  let lo = Infinity;
  let hi = -Infinity;
  let top = 0;
  const d = shape.discs;
  for (let i = 0; i < d.length; i += 3) {
    lo = Math.min(lo, d[i] - d[i + 2]);
    hi = Math.max(hi, d[i] + d[i + 2]);
    top = Math.max(top, d[i + 1] + d[i + 2]);
  }
  for (const q of shape.polys) {
    for (let i = 0; i < q.length; i += 2) {
      lo = Math.min(lo, q[i]);
      hi = Math.max(hi, q[i]);
      top = Math.max(top, q[i + 1]);
    }
  }
  return [lo, hi, top];
}

/**
 * Lays out a cat that plays `keys` (looping every `loop` seconds, if it loops; else from `from` to `to`) in a W x H
 * box. The Machine's camera keeps her framed: for every moment it works out the closest framing that holds her pose,
 * then eases it over about a second either way, so it drifts in as she curls up and out as she stretches.
 */
export function buildLuna(keys: Keys, loop: number, W: number, H: number, from = 0, to = loop, style: Style = STYLES[LOOK]): Luna {
  const n0 = Math.max(2, Math.round((to - from) / CAM) + 1);
  const raw = new Float32Array(n0 * 3);
  for (let k = 0; k < n0; k++) {
    keyed(pose, keys, from + k * CAM, loop);
    skin(pose, shape);
    const [lo, hi, top] = bounds();
    // Never closer than this, or a sleeping cat would fill the frame.
    const sc = Math.min((H * 0.8) / Math.max(top, 30), (W * 0.86) / (hi - lo));
    raw.set([sc, (lo + hi) / 2, Math.max(top, 30)], k * 3);
  }
  const cam = new Float32Array(n0 * 3);
  const reach = Math.round(1.1 / CAM);
  for (let k = 0; k < n0; k++) {
    let wsum = 0;
    let sc = 0;
    let mid = 0;
    let top = 0;
    let least = Infinity;
    for (let j = -reach; j <= reach; j++) {
      let q = k + j;
      if (loop) q = ((q % (n0 - 1)) + (n0 - 1)) % (n0 - 1);
      else q = Math.min(n0 - 1, Math.max(0, q));
      const w = Math.exp(-((j / (reach * 0.5)) ** 2));
      wsum += w;
      sc += w * raw[q * 3];
      mid += w * raw[q * 3 + 1];
      top += w * raw[q * 3 + 2];
      least = Math.min(least, raw[q * 3]);
    }
    // Eased, but never closer than the nearest moment needs: no part of her leaves the frame.
    const s = Math.min(sc / wsum, least * 1.06);
    cam.set([s, W / 2 - (mid / wsum) * s, H / 2 + ((top / wsum) * s) / 2], k * 3);
  }
  let near = 0;
  for (let k = 0; k < n0; k++) near = Math.max(near, cam[k * 3]);
  // Laid out standing, every part at its full length; then the poses she takes, for how wide each part gets.
  const rest = newShape();
  stand(pose, 0);
  skin(pose, rest);
  const shapes = [rest, ...[0.25, 0.5, 0.75].map((k) => {
    const s = newShape();
    keyed(pose, keys, lerp(from, to, k), loop);
    skin(pose, s);
    return s;
  })];
  const w = catSwarm(shapes, near, style);
  const n = w.n;
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
  return { keys, loop, sc: near, ox: W / 2, gy: H, w, home, bx: new Float32Array(n), by: new Float32Array(n), bt: new Uint8Array(n), bs: new Float32Array(n), bl: new Uint8Array(n), W, H, cam, from };
}

/** Puts her particles where the timeline has her at `lt` (seconds into it). */
export function poseLuna(L: Luna, lt: number) {
  keyed(pose, L.keys, lt, L.loop);
  skin(pose, shape);
  const n = L.cam.length / 3;
  const f = cl((lt - L.from) / CAM, 0, n - 1);
  const k = Math.min(n - 2, Math.floor(f));
  const u = f - k;
  const c = L.cam;
  const sc = lerp(c[k * 3], c[k * 3 + 3], u);
  placeCat(L.w, shape, lerp(c[k * 3 + 1], c[k * 3 + 4], u), lerp(c[k * 3 + 2], c[k * 3 + 5], u), sc);
  return L.w;
}

/**
 * Draws her with the box's top-left corner at (x, y) (translate first), `lt` seconds into her timeline. `grow` (0..1)
 * brings the sphere of noise in, `form` (0..1) resolves it into her (the particles fly to their places); `line` (px,
 * from the box's top) is how far down the Machine has classified her (below it she is grey). `t` turns the sphere.
 */
export function drawLuna(ctx: CanvasRenderingContext2D, L: Luna, lt: number, t: number, grow: number, form: number, line = Infinity) {
  if (grow <= 0) return;
  const w = poseLuna(L, lt);
  unclassified(w, line);
  ctx.save();
  ctx.globalAlpha *= grow;
  if (form >= 1) {
    drawSwarm(ctx, w);
    ctx.restore();
    return;
  }
  const { W, H, home, bx, by, bt, bs, bl } = L;
  const size = Math.min(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const R = size * 0.3 * E.outCubic(grow);
  const ry = t * 0.9;
  const rx = 0.4 + 0.25 * Math.sin(t * 0.8);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  for (let i = 0; i < w.n; i++) {
    const o = i * 5;
    const r1 = home[o + 3];
    const r2 = home[o + 4];
    const k = E.inOutCubic(cl(form * 1.6 - (w.x[i] / W) * 0.3 - r1 * 0.2));
    // A particle with no place on her this frame (a part in front covers it) fades on the way.
    bt[i] = HIDDEN;
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
    bs[i] = lerp(0.8 + depth * 1.6, w.size[i], k);
    // In the sphere the far side is dim and grey; on the way the particles take their tone on her.
    bt[i] = k > 0.5 && w.tone[i] !== HIDDEN ? w.tone[i] : Math.round(1 + depth * 2 + k * 2);
    bl[i] = k > 0.5 ? w.lit[i] : 1;
  }
  drawSwarm(ctx, { ...w, x: bx, y: by, tone: bt, size: bs, lit: bl });
  ctx.restore();
}

