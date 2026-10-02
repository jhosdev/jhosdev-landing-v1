// The cat, side-on and able to move: a small rig of bones, each carrying the
// particles that were sampled inside its shape once. A particle belongs to one
// bone for good, so the cat stays the same cat from frame to frame (nothing
// shimmers); only the bones move. No DOM here: poses are plain maths, a pure
// function of time.
//
// Rig units: the back is about 39 high, the cat faces +x, y is up, the ground is y = 0.
// Why it reads as a walk and not as a slide:
//   - a lateral-sequence walk, four beats: near hind, near fore, far hind, far fore,
//     a quarter of a stride apart, each foot on the ground 62% of the time;
//   - a planted foot is fixed in the world: its position is computed from the
//     distance travelled, never from the clock, so it cannot slide;
//   - shoulders and hips rise over each planted leg and dip between steps, in
//     opposite phase, so the back rocks; the head stays level; the tail lags.

import { E, P, cl, lerp, mulberry32 } from './draw';

const TORSO = 34;
const UPPER = 12.5;
const FORE = 12.5;
const FPAW = 5.2;
const THIGH = 14.5;
const SHANK = 14.5;
const META = 10;
const HPAW = 4;
const NECK = 9;
const HEAD = 10;
const TAIL = 6;
const TAIL_SEG = 6.5;
/** Height of a planted paw's centre line. */
const GROUND = 1.8;

/** Legs, in the order the feet are stored: far hind, far fore, near hind, near fore. */
const HIND = [true, false, true, false];
const LEG_BONE = [3 + TAIL, 7 + TAIL, 10 + TAIL, 14 + TAIL];
export const BONES = 17 + TAIL;
const HEAD_BONE = 2;

export const STRIDE = 34;
export const DUTY = 0.62;
/** When each foot lands, as a fraction of the stride. */
const PHASE = [0.5, 0.75, 0, 0.25];
/** Where a foot is under the body at mid-stance. */
const NEUTRAL = [-16, 15.5, -16, 15.5];
const TAIL_UP = [2.62, 2.23, 1.88, 1.64, 1.43, 1.08];
const TAIL_SAT = [2.9, 2.45, 1.95, 1.5, 1.2, 1.6];
const TAIL_LOW = [3.35, 3.2, 2.9, 2.4, 1.9, 1.5];

export interface Rig {
  n: number;
  /** Distance between two neighbouring particles, in rig units. */
  step: number;
  bone: Uint8Array;
  /** Along the bone, as a fraction of its rest length (so it follows a bone that stretches). */
  u: Float32Array;
  /** Across the bone, in rig units, positive to the left of its direction. */
  v: Float32Array;
  /** 1 for the near side, less for the legs on the far side. */
  shade: Float32Array;
  /** Head particles only: where they sit when the head faces the camera, from the head's centre. */
  fx: Float32Array;
  fy: Float32Array;
}

export interface Pose {
  /** The torso runs from the hips (hx, hy) to the shoulders (sx, sy); `bend` arches the back. */
  hx: number;
  hy: number;
  sx: number;
  sy: number;
  bend: number;
  /** Four feet: x, height above the ground, and two angles (hind: hock lean, toe droop; fore: paw swing, unused). */
  feet: Float32Array;
  headX: number;
  headY: number;
  /** Head pitch, radians, nose up positive. */
  headA: number;
  /** 0 = in profile, 1 = facing the camera. */
  turn: number;
  /** Direction of each tail segment, root to tip. */
  tail: Float32Array;
}

export const newPose = (): Pose => ({ hx: 0, hy: 0, sx: 0, sy: 0, bend: 0, feet: new Float32Array(16), headX: 0, headY: 0, headA: 0, turn: 0, tail: new Float32Array(TAIL) });

/* ------------------------------------------------------------------ shapes */

type Inside = (x: number, y: number) => boolean;
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function tri(x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
/** A limb: a capsule from (0, 0) to (len, 0) whose radius tapers from r0 to r1. */
const capsule = (len: number, r0: number, r1: number): Inside => (x, y) =>
  x < 0 ? x * x + y * y <= r0 * r0 : x > len ? (x - len) ** 2 + y * y <= r1 * r1 : Math.abs(y) <= lerp(r0, r1, x / len);

const torso: Inside = (x, y) => {
  if (ell(x, y, 1.5, -0.8, 9.5, 8.6) || ell(x, y, 31.5, -1.6, 10, 9.6)) return true;
  const k = (x - 1.5) / 30;
  // The belly tucks up toward the hind legs.
  return k >= 0 && k <= 1 && y <= lerp(7.8, 8, k) && y >= lerp(-8.4, -11.2, k);
};
const headSide: Inside = (x, y) =>
  ell(x, y, 0, 0, 7.8, 7.2) || ell(x, y, 5.4, -2.6, 3.9, 3.3) || tri(x, y, -6.4, 3.2, -4.4, 13.6, 1.4, 6.2) || tri(x, y, -1.6, 5.8, 2.4, 12.8, 5.2, 4.4);
const headFront: Inside = (x, y) => {
  const ax = Math.abs(x);
  if (tri(ax, y, 7.25, 4.5, 7, 9.25, 4, 6.5)) return false; // inside of the ear
  return ell(x, y, 0, 0, 10.2, 8.2) || tri(ax, y, 9.75, 2, 9, 13.5, 1.25, 7.25);
};

interface Part {
  bone: number;
  rest: number;
  shade: number;
  box: [number, number, number, number];
  inside: Inside;
}
function parts(): Part[] {
  const limb = (bone: number, rest: number, r0: number, r1: number, shade: number): Part => {
    const r = Math.max(r0, r1);
    return { bone, rest, shade, box: [-r, rest + r, -r, r], inside: capsule(rest, r0, r1) };
  };
  const list: Part[] = [
    { bone: 0, rest: TORSO, shade: 1, box: [-9, 42, -12, 9], inside: torso },
    limb(1, NECK, 6.6, 5.6, 1),
  ];
  for (let i = 0; i < TAIL; i++) list.push(limb(3 + i, TAIL_SEG, lerp(2.7, 1.9, i / TAIL), lerp(2.7, 1.9, (i + 1) / TAIL), 1));
  HIND.forEach((hind, leg) => {
    const b = LEG_BONE[leg];
    const shade = leg < 2 ? 0.5 : 1;
    if (hind) list.push(limb(b, THIGH, 6.2, 3.3, shade), limb(b + 1, SHANK, 3.1, 2.1, shade), limb(b + 2, META, 2.1, 2, shade), limb(b + 3, HPAW, 2.3, 2.5, shade));
    else list.push(limb(b, UPPER, 4, 2.9, shade), limb(b + 1, FORE, 2.8, 2.1, shade), limb(b + 2, FPAW, 2.1, 2.6, shade));
  });
  return list;
}

function fill(step: number, box: [number, number, number, number], inside: Inside) {
  const out: number[][] = [];
  for (let row = 0, y = box[2]; y <= box[3]; y += step * 0.866, row++) {
    for (let x = box[0] + (row % 2 ? step / 2 : 0); x <= box[1]; x += step) if (inside(x, y)) out.push([x, y]);
  }
  return out;
}

/** Samples every bone's shape into about `count` particles, in a shuffled order (any prefix covers the whole cat). */
export function buildRig(count: number): Rig {
  const list = parts();
  const collect = (step: number) => {
    const rows: number[][] = []; // bone, u, v, shade, fx, fy
    for (const p of list) for (const [x, y] of fill(step, p.box, p.inside)) rows.push([p.bone, x / p.rest, y, p.shade, NaN, NaN]);
    // The head has two views; a particle keeps its rank (top to bottom, left to right) in both.
    const side = fill(step, [-8, 11, -7, 14], headSide);
    const front = fill(step, [-11, 11, -9, 14], headFront);
    front.forEach(([x, y], j) => {
      const s = side[Math.floor((j * side.length) / front.length)];
      rows.push([HEAD_BONE, s[0] / HEAD, s[1], 1, x, y]);
    });
    return rows;
  };
  const rough = collect(1);
  const step = Math.sqrt(rough.length / Math.max(1, count));
  const rows = collect(step);
  const rnd = mulberry32(11);
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  const n = rows.length;
  const rig: Rig = { n, step, bone: new Uint8Array(n), u: new Float32Array(n), v: new Float32Array(n), shade: new Float32Array(n), fx: new Float32Array(n), fy: new Float32Array(n) };
  rows.forEach((r, i) => {
    rig.bone[i] = r[0];
    rig.u[i] = r[1];
    rig.v[i] = r[2];
    rig.shade[i] = r[3];
    rig.fx[i] = r[4];
    rig.fy[i] = r[5];
  });
  return rig;
}

/* ------------------------------------------------------------------- bones */

function setBone(B: Float32Array, i: number, ax: number, ay: number, bx: number, by: number, bend = 0) {
  B[i * 5] = ax;
  B[i * 5 + 1] = ay;
  B[i * 5 + 2] = bx;
  B[i * 5 + 3] = by;
  B[i * 5 + 4] = bend;
}

/** Two bones from the root toward the target; `side` picks which way the joint bends (+1 = left of the line). Writes both bones, returns the reached end in `end`. */
const end = [0, 0];
function ik(B: Float32Array, i: number, rx: number, ry: number, tx: number, ty: number, a: number, b: number, side: number) {
  let dx = tx - rx;
  let dy = ty - ry;
  const far = Math.hypot(dx, dy) || 1e-6;
  const d = cl(far, Math.abs(a - b) + 0.01, a + b - 0.01);
  dx /= far;
  dy /= far;
  const along = (a * a - b * b + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, a * a - along * along)) * side;
  const jx = rx + dx * along - dy * off;
  const jy = ry + dy * along + dx * off;
  end[0] = rx + dx * d;
  end[1] = ry + dy * d;
  setBone(B, i, rx, ry, jx, jy);
  setBone(B, i + 1, jx, jy, end[0], end[1]);
}

/** Turns a pose into bones (ax, ay, bx, by, bend per bone). */
export function solve(p: Pose, B: Float32Array) {
  const len = Math.hypot(p.sx - p.hx, p.sy - p.hy) || 1;
  const dx = (p.sx - p.hx) / len;
  const dy = (p.sy - p.hy) / len;
  const at = (ox: number, oy: number, along: number, up: number) => [ox + dx * along - dy * up, oy + dy * along + dx * up];
  setBone(B, 0, p.hx, p.hy, p.sx, p.sy, p.bend);
  const neck = at(p.sx, p.sy, 2.5, 2.5);
  setBone(B, 1, neck[0], neck[1], p.headX - Math.cos(p.headA) * 2, p.headY - Math.sin(p.headA) * 2);
  setBone(B, HEAD_BONE, p.headX, p.headY, p.headX + Math.cos(p.headA) * HEAD, p.headY + Math.sin(p.headA) * HEAD);
  let [x, y] = at(p.hx, p.hy, -8, 2.5);
  for (let i = 0; i < TAIL; i++) {
    const nx = x + Math.cos(p.tail[i]) * TAIL_SEG;
    const ny = y + Math.sin(p.tail[i]) * TAIL_SEG;
    setBone(B, 3 + i, x, y, nx, ny);
    x = nx;
    y = ny;
  }
  const hip = at(p.hx, p.hy, 3.5, -2);
  const shoulder = at(p.sx, p.sy, -3, -2.5);
  for (let leg = 0; leg < 4; leg++) {
    const b = LEG_BONE[leg];
    const fx = p.feet[leg * 4];
    const fy = p.feet[leg * 4 + 1] + GROUND;
    const a = p.feet[leg * 4 + 2];
    if (HIND[leg]) {
      // Thigh forward, shank back, then the long foot: the Z of a cat's hind leg.
      ik(B, b, hip[0], hip[1], fx - Math.sin(a) * META, fy + Math.cos(a) * META, THIGH, SHANK, 1);
      const droop = p.feet[leg * 4 + 3];
      // If the leg cannot reach, the foot hangs from the hock instead of stretching.
      const bx = end[0] + Math.sin(a) * META;
      const by = end[1] - Math.cos(a) * META;
      setBone(B, b + 2, end[0], end[1], bx, by);
      setBone(B, b + 3, bx, by, bx + Math.cos(droop) * HPAW, by + Math.sin(droop) * HPAW);
    } else {
      ik(B, b, shoulder[0], shoulder[1], fx - 1.5, fy + 3.3, UPPER, FORE, -1);
      setBone(B, b + 2, end[0], end[1], end[0] + Math.sin(a) * FPAW, end[1] - Math.cos(a) * FPAW);
    }
  }
}

/** Where particle i is, in rig units. Writes [x, y]. */
export function rigPoint(rig: Rig, B: Float32Array, p: Pose, i: number, out: number[]) {
  const b = rig.bone[i] * 5;
  const ax = B[b];
  const ay = B[b + 1];
  const dx = B[b + 2] - ax;
  const dy = B[b + 3] - ay;
  const len = Math.hypot(dx, dy) || 1;
  const u = rig.u[i];
  const v = rig.v[i] + (B[b + 4] ? B[b + 4] * Math.sin(Math.PI * cl(u)) : 0);
  let x = ax + dx * u - (dy / len) * v;
  let y = ay + dy * u + (dx / len) * v;
  if (p.turn > 0 && rig.fx[i] === rig.fx[i]) {
    // The head comes round: it narrows halfway through, like anything that turns.
    x = lerp(x, p.headX + rig.fx[i], p.turn);
    y = lerp(y, p.headY + rig.fy[i], p.turn);
    x = p.headX + (x - p.headX) * (1 - 0.3 * Math.sin(Math.PI * p.turn));
  }
  out[0] = x;
  out[1] = y;
}

/* ------------------------------------------------------------------- poses */

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * One foot of the walk, from the distance travelled `s`. Planted, it stays where it landed;
 * in the air it travels one stride. `lift` (0..1) scales how high it goes, so a cat that
 * stops sets its raised foot down. Writes x (in the same space as s), height and angles.
 */
export function walkFoot(s: number, leg: number, lift: number, feet: Float32Array) {
  const p = s / STRIDE + PHASE[leg];
  const n = Math.floor(p);
  const ph = p - n;
  const landed = (n - PHASE[leg]) * STRIDE + NEUTRAL[leg] + (STRIDE * DUTY) / 2;
  const o = leg * 4;
  if (ph < DUTY) {
    const k = ph / DUTY;
    feet[o] = landed;
    feet[o + 1] = 0;
    // The hock starts leaned back and comes upright as the leg pushes off; the fore paw points forward.
    feet[o + 2] = HIND[leg] ? lerp(0.55, 0.12, k) : 0.87;
    feet[o + 3] = 0;
    return;
  }
  const u = (ph - DUTY) / (1 - DUTY);
  const up = Math.sin(Math.PI * Math.pow(u, 0.8)) * lift;
  feet[o] = landed + STRIDE * smooth(u);
  feet[o + 1] = (HIND[leg] ? 3.6 : 4.6) * up;
  // In the air the hind foot trails and the fore paw folds back at the wrist.
  feet[o + 2] = HIND[leg] ? lerp(0.12, 0.55, u) + 0.6 * up : 0.87 - 1.5 * up;
  feet[o + 3] = HIND[leg] ? -0.9 * up : 0;
}

/** Seconds the walk-in takes, the settle into a sit, and the look at the camera. */
export const WALK = { stride: 1.5, sitAt: 1.46, sat: 1.9, turnAt: 1.82, turned: 2.02 };
/** How far it walks: two and a quarter strides, then the sit shifts it back a little. */
const WALK_DIST = STRIDE * 2.25;
const SIT_BACK = 6;
/** Where the feet end up when it sits (far hind, far fore, near hind, near fore) and when each one steps there. */
const SIT_FEET = [1.4, 13.6, 2.8, 12];
const SIT_STEP = [0, 0.5, 0.14, 0.26];

/**
 * The walk variant, `t` seconds after the cat enters. It walks in from the left, slows and stops,
 * shuffles its feet under itself and sits, then turns its head to the camera. x = 0 is where it sits.
 */
export function walkPose(p: Pose, t: number) {
  // Steady pace, then a smooth stop.
  const u = P(t, 0, WALK.stride);
  const u0 = 0.68;
  const v = 2 / (1 + u0);
  const s = WALK_DIST * (u <= u0 ? v * u : v * u0 + v * (u - u0) - (v * (u - u0) ** 2) / (2 * (1 - u0)));
  const go = cl((1 - u) / (1 - u0) * 1.6);
  const sit = P(t, WALK.sitAt, WALK.sat);
  const q = E.inOutCubic(sit);
  const x0 = SIT_BACK - WALK_DIST; // s-space -> rig space
  const ph = s / STRIDE;

  for (let leg = 0; leg < 4; leg++) {
    walkFoot(s, leg, go, p.feet);
    const o = leg * 4;
    p.feet[o] += x0;
    // Sitting down: each foot takes one short step to its place, one after the other.
    const k = smooth(P(sit, SIT_STEP[leg], SIT_STEP[leg] + 0.42));
    p.feet[o] = lerp(p.feet[o], SIT_FEET[leg], k);
    p.feet[o + 1] += Math.sin(Math.PI * k) * 2.2;
    p.feet[o + 2] = lerp(p.feet[o + 2], HIND[leg] ? 1.45 : 0.87, HIND[leg] ? q : k);
    p.feet[o + 3] = lerp(p.feet[o + 3], 0, q);
  }

  // Each girdle rises over its planted leg and dips between steps; hips and shoulders are a quarter stride apart.
  const bob = 0.5 + 0.5 * go;
  const hipBob = 0.9 * bob * Math.cos(4 * Math.PI * (ph - DUTY / 2));
  const shBob = 0.9 * bob * Math.cos(4 * Math.PI * (ph + 0.25 - DUTY / 2));
  const c = s + x0;
  p.hx = lerp(c - 17, -13, q);
  p.hy = lerp(31 + hipBob, 10, E.inOutCubic(P(sit, 0.1, 0.8)));
  p.sx = lerp(c + 17, 8.5, q);
  p.sy = lerp(31 + shBob, 33.5, q);
  p.bend = 3.4 * q;

  // The head is carried level (it takes a third of the shoulders' bob) and nods slightly behind the beat.
  const turn = E.inOutCubic(P(t, WALK.turnAt, WALK.turned));
  p.headX = lerp(c + 30.5, 13, q) - 1.2 * turn;
  p.headY = lerp(40 + shBob * 0.35, 44.5, q) - 1.5 * Math.sin(Math.PI * sit);
  p.headA = lerp(-0.1 + 0.05 * bob * Math.sin(4 * Math.PI * ph - 0.9), 0.04, q) * (1 - turn);
  p.turn = turn;

  // The tail is carried up, and a wave runs along it a little behind the stride; sitting, it curls behind and flicks.
  const flick = Math.exp(-(((t - WALK.sat - 0.22) / 0.09) ** 2));
  for (let i = 0; i < TAIL; i++) {
    const wave = (0.05 + 0.035 * i) * Math.sin(2 * Math.PI * ph - i * 0.75) * bob;
    p.tail[i] = lerp(TAIL_UP[i] + wave, TAIL_SAT[i] - 0.11 * i * flick, q);
  }
}

/** Seconds: the crouch and wiggle, the leap, and where the leap lands (rig x of the body). */
export const POUNCE = { crouch: 0.35, wiggleAt: 0.9, leapAt: 1.72, land: 2.1, from: -40, to: 2 };

/**
 * The pounce variant: crouched, watching the dot at (dotX, dotY); a wiggle of the hips; the leap.
 * x = 0 is the middle of the frame, where the dot ends up and the cat lands on it.
 */
export function pouncePose(p: Pose, t: number, dotX: number, dotY: number) {
  const down = E.outCubic(P(t, 0, POUNCE.crouch));
  const wig = P(t, POUNCE.wiggleAt, POUNCE.wiggleAt + 0.15) * (1 - P(t, POUNCE.leapAt - 0.14, POUNCE.leapAt - 0.04));
  const coil = E.inOutCubic(P(t, POUNCE.leapAt - 0.16, POUNCE.leapAt)); // the last squeeze before it goes
  const air = P(t, POUNCE.leapAt, POUNCE.land);
  const fly = smooth(air);
  const arc = Math.sin(Math.PI * air);
  const w = Math.sin(t * 38) * wig;
  const c = lerp(POUNCE.from - 2.5 * coil, POUNCE.to, fly);
  const lift = 19 * arc;
  // Nose up on the way up, nose down on the way down.
  const pitch = 0.5 * Math.cos(Math.PI * air) * arc + 0.1 * arc;
  const half = lerp(17, 15, down) + 3 * arc;
  const midY = lerp(27, 16.5, down) - 1.5 * coil + lift + 4 * arc;
  p.hx = c - Math.cos(pitch) * half - 1.5 * coil;
  p.hy = midY - Math.sin(pitch) * half + 3.5 * down * (1 - arc) + 0.9 * w;
  p.sx = c + Math.cos(pitch) * half;
  p.sy = midY + Math.sin(pitch) * half - 2 * down * (1 - arc);
  p.bend = 2 * down * (1 - arc) + 2.5 * coil * (1 - air);

  for (let leg = 0; leg < 4; leg++) {
    const o = leg * 4;
    const far = leg < 2 ? 1.4 : 0;
    if (HIND[leg]) {
      // Treading on the spot while it wiggles; left behind and stretched in the air, then swung under for the landing.
      const tread = Math.max(0, leg < 2 ? w : -w);
      p.feet[o] = lerp(POUNCE.from - 13 + far, c - 26 + 20 * P(air, 0.55, 1), P(air, 0.12, 0.3));
      p.feet[o + 1] = 1.6 * tread + lift * P(air, 0.12, 0.4) + 6 * arc;
      p.feet[o + 2] = lerp(lerp(0.55, 1.1, down), 0.3, P(air, 0.05, 0.3)) + 1.1 * arc;
      p.feet[o + 3] = -1.1 * arc;
    } else {
      // The forelegs reach for the dot and get there first.
      p.feet[o] = lerp(POUNCE.from + 17 + far, c + 22 - 12 * P(air, 0.75, 1), P(air, 0, 0.2));
      p.feet[o + 1] = lift * P(air, 0, 0.25) * (1 - P(air, 0.8, 1)) + 7 * arc * (1 - P(air, 0.6, 1));
      p.feet[o + 2] = 0.87 + 0.6 * arc;
      p.feet[o + 3] = 0;
    }
  }

  // The head follows the dot: low and forward, pitched toward it.
  const hx = p.sx + lerp(13.5, 12.5, down);
  const hy = p.sy + lerp(9, 1.5, down) + 2 * arc;
  const look = Math.atan2(dotY - hy, dotX - hx);
  p.headX = hx + 0.4 * w;
  p.headY = hy + 6 * cl(look, -0.2, 0.5) * (1 - air);
  p.headA = cl(look, -0.35, 0.6) * 0.8 * (1 - air) + pitch * 0.6;
  p.turn = 0;

  // Tail low and straight behind, its tip twitching; it streams out in the air.
  for (let i = 0; i < TAIL; i++) {
    const twitch = 0.09 * i * Math.sin(t * 9 - i * 0.6) * (1 - air) + 0.06 * i * w;
    p.tail[i] = lerp(lerp(TAIL_UP[i], TAIL_LOW[i], down) + twitch, Math.PI + pitch - 0.05 * i, P(air, 0, 0.3));
  }
}
