// The cat, side-on and able to move. A pose (spine, four feet, head, tail) is
// turned into one solid silhouette: the body, the legs and the tail are swept
// along smooth curves through the joints with a radius that tapers (so a leg is
// one tapering limb, not a chain of capsules), and the skull and ears are
// closed spline outlines. No DOM here: poses are plain maths, a pure function
// of time; cat.ts puts the shape on a canvas.
//
// Rig units: the back is about 32 high, the cat faces +x, y is up, the ground is y = 0.
// Why it reads as a walk and not as a slide:
//   - a lateral-sequence walk, four beats: near hind, near fore, far hind, far fore,
//     a quarter of a stride apart, each foot on the ground 62% of the time;
//   - a planted foot is fixed in the world: its position is computed from the
//     distance travelled, never from the clock, so it cannot slide;
//   - shoulders and hips rise over each planted leg and dip between steps, in
//     opposite phase, so the back rocks; the head stays level; the tail lags.

import { E, P, cl, lerp } from './draw';

const UPPER = 8.5;
const FORE = 13.3;
const FPAW = 2.1;
/** Fore paw, heel to toe. */
const FTOE = 1.9;
const THIGH = 9;
const SHANK = 10;
const META = 7;
const HPAW = 2.7;
const TAIL = 7;
const TAIL_SEG = 5.6;
/** Height of the spine at the hips and shoulders when it stands. */
const BACK = 26;
/** Half the distance between hips and shoulders. */
const HALF = 12.5;

/** Legs, in the order the feet are stored: far hind, far fore, near hind, near fore. */
const HIND = [true, false, true, false];

export const STRIDE = 30;
export const DUTY = 0.62;
/** When each foot lands, as a fraction of the stride. */
const PHASE = [0.5, 0.75, 0, 0.25];
/** Where a foot is under the body at mid-stance. */
const NEUTRAL = [-12.5, 11.5, -12.5, 11.5];
const TAIL_UP = [2.75, 2.5, 2.25, 2.05, 1.95, 2.0, 2.2];
const TAIL_SAT = [2.55, 2.2, 1.95, 1.8, 1.55, 1.05, 0.35];
const TAIL_LOW = [3.3, 3.2, 3.0, 2.7, 2.35, 2.0, 1.7];

export interface Pose {
  /** The spine runs from the hips (hx, hy) to the shoulders (sx, sy); `bend` arches the back. */
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
  /** 1 = in profile, looking where it walks; 0 = facing the camera; -1 = in profile, looking back. */
  yaw: number;
  /** Direction of each tail segment, root to tip. */
  tail: Float32Array;
  /** Ear twitches (radians, tip back about the base): far ear, near ear. */
  earA: number;
  earB: number;
}

export const newPose = (): Pose => ({ hx: 0, hy: 0, sx: 0, sy: 0, bend: 0, feet: new Float32Array(16), headX: 0, headY: 0, headA: 0, yaw: 1, tail: new Float32Array(TAIL), earA: 0, earB: 0 });

/** What a part of the silhouette is: how it joins the rest. */
export const BODY_PART = 0;
export const NEAR_LEG = 1;
export const FAR_LEG = 2;
export const TAIL_PART = 3;

/** A silhouette, in rig units. */
export interface Shape {
  /** Discs (x, y, r), flat: the body, the legs and the tail are swept out of them. */
  discs: number[];
  /**
   * Parts, flat (end, kind, from, to): discs up to `end` (an index into `discs`) belong to a part of that kind;
   * for a leg, discs from..to are its shin or forearm, the stretch a far leg is parted from by a hairline.
   */
  parts: number[];
  /** Closed outlines (x, y, ...): the skull and the ears. */
  polys: number[][];
  /** Eyes (x, y, rx, ry, tilt), flat. */
  eyes: number[];
}
export const newShape = (): Shape => ({ discs: [], parts: [], polys: [], eyes: [] });
const clear = (s: Shape) => {
  s.discs.length = 0;
  s.parts.length = 0;
  s.polys.length = 0;
  s.eyes.length = 0;
};
const part = (s: Shape, kind: number, from = 0, to = 0) => s.parts.push(s.discs.length, kind, from, to);

/* ------------------------------------------------------------------- shape */

/**
 * Sweeps a disc along a smooth curve through the keys (x, y, radius to the left of travel, radius to the right).
 * The curve passes through every key; the radius eases from one to the next, so the limb tapers without a joint.
 */
function sweep(out: number[], k: number[], marks?: number[]) {
  const n = k.length / 4;
  const tx: number[] = [];
  const ty: number[] = [];
  for (let i = 0; i < n; i++) {
    // The tangent at a key bisects its two chords.
    let ax = 0;
    let ay = 0;
    for (const j of [i - 1, i]) {
      if (j < 0 || j >= n - 1) continue;
      const dx = k[j * 4 + 4] - k[j * 4];
      const dy = k[j * 4 + 5] - k[j * 4 + 1];
      const d = Math.hypot(dx, dy) || 1;
      ax += dx / d;
      ay += dy / d;
    }
    const d = Math.hypot(ax, ay) || 1;
    tx.push(ax / d);
    ty.push(ay / d);
  }
  const slope = (o: number, i: number) => (k[Math.min(n - 1, i + 1) * 4 + o] - k[Math.max(0, i - 1) * 4 + o]) / 2;
  for (let i = 0; i < n - 1; i++) {
    marks?.push(out.length);
    const a = i * 4;
    const b = a + 4;
    const len = Math.hypot(k[b] - k[a], k[b + 1] - k[a + 1]);
    const thin = Math.min(k[a + 2] + k[a + 3], k[b + 2] + k[b + 3]) / 2;
    const steps = Math.max(2, Math.ceil(len / (0.1 * thin + 0.1)));
    for (let j = 0; j <= (i === n - 2 ? steps : steps - 1); j++) {
      const u = j / steps;
      const u2 = u * u;
      const u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1;
      const h10 = u3 - 2 * u2 + u;
      const h01 = -2 * u3 + 3 * u2;
      const h11 = u3 - u2;
      const x = h00 * k[a] + h10 * len * tx[i] + h01 * k[b] + h11 * len * tx[i + 1];
      const y = h00 * k[a + 1] + h10 * len * ty[i] + h01 * k[b + 1] + h11 * len * ty[i + 1];
      const dx = (6 * u2 - 6 * u) * (k[a] - k[b]) + (3 * u2 - 4 * u + 1) * len * tx[i] + (3 * u2 - 2 * u) * len * tx[i + 1];
      const dy = (6 * u2 - 6 * u) * (k[a + 1] - k[b + 1]) + (3 * u2 - 4 * u + 1) * len * ty[i] + (3 * u2 - 2 * u) * len * ty[i + 1];
      const d = Math.hypot(dx, dy) || 1;
      const rl = Math.max(0.2, h00 * k[a + 2] + h10 * slope(2, i) + h01 * k[b + 2] + h11 * slope(2, i + 1));
      const rr = Math.max(0.2, h00 * k[a + 3] + h10 * slope(3, i) + h01 * k[b + 3] + h11 * slope(3, i + 1));
      const off = (rl - rr) / 2;
      out.push(x - (dy / d) * off, y + (dx / d) * off, (rl + rr) / 2);
    }
  }
}

/** A closed smooth outline through the points (x, y, ...), as a polygon. */
function contour(pts: number[], per = 6): number[] {
  const n = pts.length / 2;
  const out: number[] = [];
  const at = (i: number, o: number) => pts[(((i % n) + n) % n) * 2 + o];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < per; j++) {
      const u = j / per;
      const u2 = u * u;
      const u3 = u2 * u;
      for (let o = 0; o < 2; o++) {
        out.push(0.5 * (2 * at(i, o) + (at(i + 1, o) - at(i - 1, o)) * u + (2 * at(i - 1, o) - 5 * at(i, o) + 4 * at(i + 1, o) - at(i + 2, o)) * u2 + (3 * at(i, o) - at(i - 1, o) - 3 * at(i + 1, o) + at(i + 2, o)) * u3));
      }
    }
  }
  return out;
}

// The skull, clockwise from the crown, in profile (nose toward +x) and from the front. Same points, so one becomes the other.
// In profile: a round cranium, the forehead sloping to a short nose, a small chin set back under it, the jaw running back to the throat.
const SKULL_SIDE = [0.6, 4.9, 3.0, 4.05, 4.7, 2.45, 6.3, 0.65, 6.4, -0.45, 5.6, -1.55, 4.3, -2.55, 2.1, -3.45, -0.4, -4.1, -2.6, -3.95, -4.2, -2.9, -5.0, -1.2, -5.1, 0.8, -4.4, 2.7, -3.0, 4.0, -1.2, 4.8];
// From the front: a domed crown, widest at the cheeks under the eyes, a narrower chin.
const SKULL_FRONT = [0, 4.6, 2.6, 4.25, 4.4, 2.9, 5.3, 1.0, 5.9, -1.0, 5.5, -2.6, 3.7, -3.75, 1.5, -4.25, 0, -4.35, -1.5, -4.25, -3.7, -3.75, -5.5, -2.6, -5.9, -1.0, -5.3, 1.0, -4.4, 2.9, -2.6, 4.25];
// Ears: outer base, tip, inner base. In profile the far one shows just ahead of the near one.
const EARS_SIDE = [
  [-4.0, 2.2, -2.9, 8.2, -0.1, 4.5],
  [-1.6, 3.8, -0.3, 7.8, 1.9, 4.2],
];
const EARS_FRONT = [
  [-4.8, 2.4, -4.1, 7.7, -1.5, 4.3],
  [1.5, 4.3, 4.1, 7.7, 4.8, 2.4],
];

/**
 * The head: skull and ears as outlines, and its eyes. (x, y) is the middle of the skull, `pitch` lifts the nose,
 * `yaw` turns it (1 profile, 0 at the camera, -1 profile the other way), `k` is its size, `roll` tilts it
 * (radians, in the picture plane) and `earA` / `earB` turn each ear's tip back about its base (a twitch).
 */
export function head(s: Shape, x: number, y: number, pitch: number, yaw: number, k = 1, roll = 0, earA = 0, earB = 0) {
  const side = Math.abs(yaw);
  const flip = yaw < 0 ? -1 : 1;
  // The pitch fades as the head comes round, so it never jumps when the nose crosses the middle.
  const c = Math.cos(pitch * yaw + roll);
  const sn = Math.sin(pitch * yaw + roll);
  const put = (out: number[], lx: number, ly: number) => out.push(x + (lx * flip * c - ly * sn) * k, y + (lx * flip * sn + ly * c) * k);
  const skull: number[] = [];
  for (let i = 0; i < SKULL_SIDE.length; i += 2) put(skull, lerp(SKULL_FRONT[i], SKULL_SIDE[i], side), lerp(SKULL_FRONT[i + 1], SKULL_SIDE[i + 1], side));
  s.polys.push(contour(skull));
  for (let e = 0; e < 2; e++) {
    const q = EARS_FRONT[e].map((v, i) => lerp(v, EARS_SIDE[e][i], side));
    // A twitch swings the tip about the middle of the base; the base stays put.
    // From the front each ear swings outward; in profile both swing back.
    const tw = (e ? earB : earA) * flip * lerp(e ? -1 : 1, 1, side);
    if (tw) {
      const bx = (q[0] + q[4]) / 2;
      const by = (q[1] + q[5]) / 2;
      const dx = q[2] - bx;
      const dy = q[3] - by;
      q[2] = bx + dx * Math.cos(tw) - dy * Math.sin(tw);
      q[3] = by + dx * Math.sin(tw) + dy * Math.cos(tw) - 0.12 * Math.abs(tw) * 6;
    }
    const ear: number[] = [];
    // Two sides, each bowed a little outward; the tip stays sharp.
    for (const [a, b, bow] of [
      [0, 2, 0.5],
      [2, 4, 0.35],
    ]) {
      const nx = -(q[b + 1] - q[a + 1]);
      const ny = q[b] - q[a];
      const d = Math.hypot(nx, ny) || 1;
      for (let j = 0; j < 6; j++) {
        const u = j / 6;
        const w = 4 * u * (1 - u) * bow;
        put(ear, lerp(q[a], q[b], u) + (nx / d) * w, lerp(q[a + 1], q[b + 1], u) + (ny / d) * w);
      }
    }
    put(ear, q[4], q[5]);
    put(ear, (q[0] + q[4]) / 2, (q[1] + q[5]) / 2 - 2.5);
    s.polys.push(ear);
  }
  // Eyes: two from the front; in profile only the near one is left.
  const depth = Math.sqrt(1 - side * side);
  for (const lat of [-1, 1]) {
    const seen = cl(1 - (lat * yaw * flip < 0 ? 0 : (side - 0.15) / 0.45));
    if (seen <= 0) continue;
    const ex = lat * 2.35 * depth * flip + 3.1 * side;
    const o: number[] = [];
    put(o, ex, lerp(0.35, 1.05, side));
    s.eyes.push(o[0], o[1], k * seen * lerp(1.2, 0.95, side), lerp(0.85, 0.5, side) * k, pitch * yaw + roll + flip * lerp(lat * -0.25, 0.3, side));
  }
}

/**
 * Head and shoulders from the front, for a cat that looks over an edge: (x, y) is the middle of the skull, the edge is y = 0.
 * `roll` tilts the head, `earA` / `earB` twitch the ears.
 */
export function bust(s: Shape, x: number, y: number, k: number, roll = 0, earA = 0, earB = 0) {
  clear(s);
  // The neck, and below it the chest widening into two sloping shoulders.
  const neck: number[] = [];
  for (const [dy, r] of [
    [2, 4.6],
    [5.5, 5.1],
    [9, 5.9],
    [16, 6.8],
    [26, 7.2],
  ]) {
    neck.push(x + Math.sin(roll) * 2.2 * (1 - dy / 26), y - dy * k, r * k, r * k);
  }
  sweep(s.discs, neck);
  for (const side of [-1, 1]) {
    const sh: number[] = [];
    sh.push(x + side * 3 * k, y - 8 * k, 4.6 * k, 4.6 * k, x + side * 7 * k, y - 12.5 * k, 5 * k, 5 * k, x + side * 8.2 * k, y - 22 * k, 5 * k, 5 * k);
    sweep(s.discs, sh);
  }
  part(s, BODY_PART);
  head(s, x, y, 0, 0, k, roll, earA, earB);
}

/**
 * The forepaws of a cat looking over an edge (y = 0), hooked over it: `grip` (0..1) brings them up from behind it.
 * Drawn over the bust with a rim of the background around them, they read in front of the chest. `pad` thickens them (the rim).
 */
export function paws(s: Shape, x: number, k: number, grip: number, pad = 0) {
  clear(s);
  for (const side of [-1, 1]) {
    const px = x + side * 3.5 * k;
    const top = lerp(-5, 0.9, grip) * k;
    const paw: number[] = [];
    for (const [dx, dy, r] of [
      [0.8, -9, 2],
      [0.3, -2.8, 1.95],
      [0, -0.4, 2.35],
      [-0.1, 0.15, 2.2],
    ]) {
      paw.push(px + side * dx * k, top + dy * k, r * k + pad, r * k + pad);
    }
    sweep(s.discs, paw);
    // Two toe slits, cut like the eyes, fanning out from the top of the paw.
    if (!pad) for (const toe of [-1, 1]) s.eyes.push(px + toe * 0.75 * k, top + 1.75 * k, 0.13 * k, 0.65 * k, toe * 0.18);
  }
  part(s, BODY_PART);
}

/** Two bones from the root toward the target; `side` picks which way the joint bends (+1 = left of the line). Returns the joint and the reached end. */
function ik(rx: number, ry: number, tx: number, ty: number, a: number, b: number, side: number) {
  let dx = tx - rx;
  let dy = ty - ry;
  const far = Math.hypot(dx, dy) || 1e-6;
  const d = cl(far, Math.abs(a - b) + 0.01, a + b - 0.01);
  dx /= far;
  dy /= far;
  const along = (a * a - b * b + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, a * a - along * along)) * side;
  return [rx + dx * along - dy * off, ry + dy * along + dx * off, rx + dx * d, ry + dy * d];
}

/** Turns a pose into its silhouette. */
export function skin(p: Pose, s: Shape) {
  clear(s);
  const len = Math.hypot(p.sx - p.hx, p.sy - p.hy) || 1;
  const dx = (p.sx - p.hx) / len;
  const dy = (p.sy - p.hy) / len;
  const at = (ox: number, oy: number, along: number, up: number) => [ox + dx * along - dy * up, oy + dy * along + dx * up];
  const mid = (a: number[], b: number[], k: number) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const key = (list: number[], q: number[], rl: number, rr = rl) => list.push(q[0], q[1], rl, rr);

  for (let leg = 0; leg < 4; leg++) {
    // The far pair hangs a little ahead of the near pair, so two legs side by side leave a sliver between them.
    const far = leg < 2 ? 1 : 0;
    const fx = p.feet[leg * 4];
    // The joint a leg hangs from gives a little toward its foot, the way a shoulder blade slides.
    const hip = at(p.hx, p.hy, -0.5 + far, -1.5);
    hip[0] += 0.15 * cl(fx - hip[0], -12, 12);
    const shoulder = at(p.sx, p.sy, -0.5 + 1.6 * far, -4.5);
    shoulder[0] += 0.3 * cl(fx - shoulder[0], -12, 12);
    const fy = p.feet[leg * 4 + 1];
    const a = p.feet[leg * 4 + 2];
    const k: number[] = [];
    if (HIND[leg]) {
      // Thigh forward, shank back, then the long foot: the Z of a cat's hind leg.
      const j = ik(hip[0], hip[1], fx - Math.sin(a) * META, fy + 1.3 + Math.cos(a) * META, THIGH, SHANK, 1);
      const knee = [j[0], j[1]];
      const hock = [j[2], j[3]];
      // If the leg cannot reach, the foot hangs from the hock instead of stretching.
      const toe = [hock[0] + Math.sin(a) * META, hock[1] - Math.cos(a) * META];
      const droop = p.feet[leg * 4 + 3];
      // Only with the hips low (sitting, crouching) does a folded leg bunch into a haunch; folded in the air, it stays a leg.
      const fold = cl((1 - Math.hypot(hock[0] - hip[0], hock[1] - hip[1]) / (THIGH + SHANK) - 0.2) / 0.3) * cl((21 - p.hy) / 5);
      const tuck = cl((1 - Math.hypot(hock[0] - hip[0], hock[1] - hip[1]) / (THIGH + SHANK) - 0.2) / 0.3) - fold;
      // Thigh muscle, a slim shank that narrows to a bony hock, a thin long foot and an oval paw.
      key(k, hip, 6 + 1.6 * fold - 0.8 * tuck);
      key(k, mid(hip, knee, 0.5), 4.9 + 3 * fold - 0.9 * tuck);
      key(k, knee, 3 + 3.4 * fold - 0.6 * tuck);
      key(k, mid(knee, hock, 0.35), 2.3 + 1.6 * fold);
      key(k, mid(knee, hock, 0.8), 1.6 + 0.6 * fold);
      key(k, hock, 1.45);
      key(k, mid(hock, toe, 0.4), 1.25);
      key(k, toe, 1.3);
      const px = Math.cos(droop) * HPAW;
      const py = Math.sin(droop) * HPAW;
      key(k, [toe[0] + px * 0.55, toe[1] + py * 0.55], 1.5);
      key(k, [toe[0] + px, toe[1] + py], 1.2);
    } else {
      // The paw lies flat when the pastern leans at its standing angle; it folds with the wrist in the air.
      const ta = a - 0.87;
      const heel = [fx - Math.cos(ta) * FTOE, fy + 1.25 - Math.sin(ta) * FTOE];
      const j = ik(shoulder[0], shoulder[1], heel[0] - Math.sin(a) * FPAW, heel[1] + Math.cos(a) * FPAW, UPPER, FORE, -1);
      const elbow = [j[0], j[1]];
      const wrist = [j[2], j[3]];
      const reach = [wrist[0] + Math.sin(a) * FPAW, wrist[1] - Math.cos(a) * FPAW];
      // Shoulder, the elbow and the forearm's muscle under it, a slim wrist and pastern, then an oval paw.
      key(k, shoulder, 3.9);
      key(k, elbow, 2.9);
      key(k, mid(elbow, wrist, 0.3), 2.25);
      key(k, mid(elbow, wrist, 0.78), 1.55);
      key(k, wrist, 1.35);
      key(k, mid(wrist, reach, 0.6), 1.25);
      key(k, reach, 1.35);
      key(k, [reach[0] + Math.cos(ta) * FTOE * 0.55, reach[1] + Math.sin(ta) * FTOE * 0.55], 1.5);
      key(k, [reach[0] + Math.cos(ta) * FTOE, reach[1] + Math.sin(ta) * FTOE], 1.25);
    }
    const marks: number[] = [];
    sweep(s.discs, k, marks);
    // Hind: just under the knee to the hock; fore: just under the elbow to the end of the pastern.
    part(s, leg < 2 ? FAR_LEG : NEAR_LEG, marks[HIND[leg] ? 3 : 2], marks[5]);
  }

  // Rump to skull in one sweep: the back is the left side of the curve, the belly and chest the right.
  const body: number[] = [];
  const neck = at(p.sx, p.sy, 5, 1.5);
  const skull = [p.headX, p.headY];
  key(body, at(p.hx, p.hy, -3.2, -0.3), 4.2, 4.2);
  key(body, at(p.hx, p.hy, -1, 0), 5.4, 5.6);
  key(body, at(lerp(p.hx, p.sx, 0.33), lerp(p.hy, p.sy, 0.33), 0, p.bend), 4.8, 4.2);
  key(body, at(lerp(p.hx, p.sx, 0.68), lerp(p.hy, p.sy, 0.68), 0, p.bend), 5.1, 6.6);
  key(body, [p.sx, p.sy], 6.1, 8);
  key(body, neck, 4.2, 6.7);
  // The throat fills in under the jaw, so the chin runs into the chest in one curve.
  key(body, mid(neck, skull, 0.5), 3.3, 4.3);
  key(body, [p.headX - 1.3 * p.yaw, p.headY + 0.2], 5.3, 3.5);
  sweep(s.discs, body);
  part(s, BODY_PART);

  const tail: number[] = [];
  let q = at(p.hx, p.hy, -6.5, 2.4);
  key(tail, at(p.hx, p.hy, -2, 1), 2.6);
  key(tail, q, 1.7);
  for (let i = 0; i < TAIL; i++) {
    q = [q[0] + Math.cos(p.tail[i]) * TAIL_SEG, q[1] + Math.sin(p.tail[i]) * TAIL_SEG];
    key(tail, q, lerp(1.6, 0.8, (i + 1) / TAIL));
  }
  sweep(s.discs, tail);
  part(s, TAIL_PART);

  // Nothing goes through the floor: what would is flattened against it.
  for (let i = 0; i < s.discs.length; i += 3) s.discs[i + 1] = Math.max(s.discs[i + 1], s.discs[i + 2]);

  head(s, p.headX, p.headY, p.headA, p.yaw, 1.2, 0, p.earA, p.earB);
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
  feet[o + 2] = HIND[leg] ? lerp(0.12, 0.55, u) + 0.6 * up : 0.87 - 0.45 * up;
  feet[o + 3] = HIND[leg] ? -0.5 * up : 0;
}

/** Sitting: where the spine, the head and the feet (far hind, far fore, near hind, near fore) are. x = 0 is where it sits. */
const SIT = { hx: -11, hy: 6.5, sx: 5, sy: 26.5, bend: 3.2, headX: 7.5, headY: 39, feet: [1.4, 13.4, 0, 10.4] };

/** The cat sitting still. `swing` bends the tail (radians at its tip), `yaw` turns the head. */
export function sitPose(p: Pose, swing = 0, yaw = -1) {
  p.hx = SIT.hx;
  p.hy = SIT.hy;
  p.sx = SIT.sx;
  p.sy = SIT.sy;
  p.bend = SIT.bend;
  p.headX = SIT.headX - 0.6 * (1 - yaw);
  p.headY = SIT.headY;
  p.headA = 0.1;
  p.yaw = yaw;
  p.earA = 0;
  p.earB = 0;
  for (let leg = 0; leg < 4; leg++) {
    p.feet[leg * 4] = SIT.feet[leg];
    p.feet[leg * 4 + 1] = 0;
    p.feet[leg * 4 + 2] = HIND[leg] ? 1.45 : 0.87;
    p.feet[leg * 4 + 3] = 0;
  }
  for (let i = 0; i < TAIL; i++) p.tail[i] = TAIL_SAT[i] - swing * Math.pow((i + 1) / TAIL, 1.5);
}

/** Seconds the walk-in takes, the settle into a sit, and the look back. */
export const WALK = { stride: 1.5, sitAt: 1.4, sat: 1.98, turnAt: 1.86, turned: 2.14 };
/** How far it walks: two and three quarter strides, then the sit shifts it back a little. */
const WALK_DIST = STRIDE * 2.75;
const SIT_BACK = 6;
/** When each foot steps to its place as it sits. */
const SIT_STEP = [0, 0.5, 0.14, 0.26];

/**
 * The walk variant, `t` seconds after the cat enters. It walks in from the left, slows and stops,
 * shuffles its feet under itself and sits, then turns its head to look back. x = 0 is where it sits.
 */
export function walkPose(p: Pose, t: number) {
  // Steady pace, then a smooth stop.
  const u = P(t, 0, WALK.stride);
  const u0 = 0.68;
  const v = 2 / (1 + u0);
  const s = WALK_DIST * (u <= u0 ? v * u : v * u0 + v * (u - u0) - (v * (u - u0) ** 2) / (2 * (1 - u0)));
  const go = cl((1 - u) / (1 - u0) * 1.6);
  const sit = P(t, WALK.sitAt, WALK.sat);
  // A gentle ease: a cat lowers itself, it does not drop.
  const q = E.inOutSine(sit);
  const x0 = SIT_BACK - WALK_DIST; // s-space -> rig space
  const ph = s / STRIDE;

  for (let leg = 0; leg < 4; leg++) {
    walkFoot(s, leg, go, p.feet);
    const o = leg * 4;
    p.feet[o] += x0;
    // Sitting down: each foot takes one short step to its place, one after the other.
    const k = smooth(P(sit, SIT_STEP[leg], SIT_STEP[leg] + 0.42));
    p.feet[o] = lerp(p.feet[o], SIT.feet[leg], k);
    p.feet[o + 1] += Math.sin(Math.PI * k) * 2.2;
    p.feet[o + 2] = lerp(p.feet[o + 2], HIND[leg] ? 1.45 : 0.87, HIND[leg] ? q : k);
    p.feet[o + 3] = lerp(p.feet[o + 3], 0, q);
  }

  // Each girdle rises over its planted leg and dips between steps; hips and shoulders are a quarter stride apart.
  const bob = 0.5 + 0.5 * go;
  const hipBob = 0.9 * bob * Math.cos(4 * Math.PI * (ph - DUTY / 2));
  const shBob = 0.9 * bob * Math.cos(4 * Math.PI * (ph + 0.25 - DUTY / 2));
  const c = s + x0;
  p.hx = lerp(c - HALF, SIT.hx, q);
  p.hy = lerp(BACK + hipBob, SIT.hy, E.inOutSine(P(sit, 0.08, 0.85)));
  p.sx = lerp(c + HALF, SIT.sx, q);
  // Sat, it breathes: the chest rises and falls, slowly.
  const breath = 0.3 * Math.sin((2 * Math.PI * (t - WALK.sat)) / 1.7) * P(t, WALK.sat, WALK.sat + 0.3);
  p.sy = lerp(BACK + shBob, SIT.sy, q) + breath;
  p.bend = SIT.bend * q;
  // Follow-through: as the body stops, the head carries on a little and the tail swings over; both come back.
  const stop = Math.exp(-(((t - WALK.stride * 0.97) / 0.13) ** 2));

  // The head is carried level and a little low (it takes a third of the shoulders' bob) and nods slightly behind the beat.
  const turn = E.inOutCubic(P(t, WALK.turnAt, WALK.turned));
  p.yaw = 1 - 2 * turn;
  p.headX = lerp(c + HALF + 11, SIT.headX - 0.6 * (1 - p.yaw), q);
  p.headX += 1.1 * stop;
  p.headY = lerp(32 + shBob * 0.35, SIT.headY, q) - 1.5 * Math.sin(Math.PI * sit) + breath * 0.6;
  // Turned, a small nod settles the look; then the near ear twitches.
  const nod = Math.exp(-(((t - WALK.turned - 0.05) / 0.07) ** 2));
  p.headA = lerp(-0.14 + 0.05 * bob * Math.sin(4 * Math.PI * ph - 0.9), 0.1, q) - 0.09 * nod;
  p.earA = 0;
  p.earB = 0.45 * Math.exp(-(((t - WALK.turned - 0.12) / 0.035) ** 2));

  // The tail is carried up, and a wave runs along it a little behind the stride; sitting, it curls behind and flicks.
  const flick = Math.exp(-(((t - WALK.sat - 0.22) / 0.09) ** 2));
  for (let i = 0; i < TAIL; i++) {
    const wave = (0.05 + 0.035 * i) * Math.sin(2 * Math.PI * ph - i * 0.75) * bob;
    p.tail[i] = lerp(TAIL_UP[i] + wave - 0.05 * i * stop, TAIL_SAT[i] - 0.09 * i * flick, q);
  }
}

/**
 * A value keyed in time (t0, v0, t1, v1, ...), eased through its keys without overshooting:
 * between two equal keys it does not move at all, which is what keeps a planted foot planted.
 */
function track(t: number, ...k: number[]) {
  const n = k.length / 2;
  if (t <= k[0]) return k[1];
  if (t >= k[n * 2 - 2]) return k[n * 2 - 1];
  let i = 0;
  while (t >= k[i * 2 + 2]) i++;
  const sec = (j: number) => (j < 0 || j >= n - 1 ? 0 : (k[j * 2 + 3] - k[j * 2 + 1]) / (k[j * 2 + 2] - k[j * 2]));
  const slope = (j: number) => {
    const a = sec(j - 1);
    const b = sec(j);
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  };
  const h = k[i * 2 + 2] - k[i * 2];
  const u = (t - k[i * 2]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * k[i * 2 + 1] + (u3 - 2 * u2 + u) * h * slope(i) + (-2 * u3 + 3 * u2) * k[i * 2 + 3] + (u3 - u2) * h * slope(i + 1);
}

/** Seconds: the crouch, the wiggle, the squeeze before the leap, the leap, the landing and its squash; and where it starts and lands (rig x of the body). */
export const POUNCE = { crouch: 0.35, wiggleAt: 0.75, coilAt: 1.34, leapAt: 1.5, land: 1.86, squash: 1.96, settled: 2.1, from: -34, to: 4 };
const TAIL_LANDED = [2.95, 2.75, 2.5, 2.25, 2.05, 1.95, 2.0];

/**
 * The pounce variant: crouched low with its rear up, watching the dot at (dotX, dotY); the hind-quarters wiggle;
 * it squeezes down and goes, stretched out in the air; the forepaws land first and the body squashes over them.
 * x = 0 is the middle of the frame; `F` is where it starts (a narrow frame starts it closer).
 */
export function pouncePose(p: Pose, t: number, dotX: number, dotY: number, F: number = POUNCE.from) {
  const { crouch, wiggleAt, coilAt, leapAt: a, land, squash, settled, to: L } = POUNCE;
  const air = land - a;
  const u = P(t, a, land);
  const wig = P(t, wiggleAt, wiggleAt + 0.12) * (1 - P(t, coilAt - 0.08, coilAt));
  const w = Math.sin(t * 36) * wig;

  const c = track(t, 0, F, coilAt, F, a, F - 3, land, L - 1.5, squash, L + 0.8, settled, L);
  const hy = track(t, 0, 22, crouch, 15.5, wiggleAt, 15.5, wiggleAt + 0.15, 19.5, coilAt, 19.5, a, 14, a + 0.2 * air, 22, a + 0.5 * air, 36, a + 0.8 * air, 33, land, 23, squash, 13, settled, 17) + 1.5 * w;
  const sy = track(t, 0, 20, crouch, 12, wiggleAt + 0.15, 10.5, coilAt, 10.5, a, 11.5, a + 0.2 * air, 29, a + 0.5 * air, 37, a + 0.8 * air, 26, land, 14, squash, 9.5, settled, 11);
  const half = track(t, 0, 12.5, crouch, 12, coilAt, 12, a, 11, a + 0.25 * air, 14, a + 0.5 * air, 15, a + 0.8 * air, 14.5, land, 13.5, squash, 10.5, settled, 12);
  const reach = Math.sqrt(Math.max(4, half * half - ((sy - hy) / 2) ** 2));
  p.hx = c - reach + 0.9 * w;
  p.hy = hy;
  p.sx = c + reach;
  p.sy = sy;
  p.bend = track(t, 0, 0, crouch, 1.5, coilAt, 1, a, 3.2, a + 0.25 * air, 0.5, a + 0.55 * air, 2.4, land, 1, squash, 3.6, settled, 1.5);

  for (let leg = 0; leg < 4; leg++) {
    const o = leg * 4;
    const far = leg < 2 ? 1.4 : 0;
    if (HIND[leg]) {
      // Treading on the spot while it wiggles; they push off, trail stretched out behind, and swing under for the landing.
      const tread = Math.max(0, leg < 2 ? w : -w);
      const trail = c + track(u, 0.1, -half - 9, 0.45, -half - 26, 0.8, -half - 20, 1, -10);
      const x = lerp(F - 12 + far, trail, smooth(P(u, 0.1, 0.3)));
      p.feet[o] = lerp(x, L - 8 + far, smooth(P(t, land - 0.05, squash - 0.02)));
      p.feet[o + 1] = 1.5 * tread + track(t, a + 0.1 * air, 0, a + 0.3 * air, 13, a + 0.5 * air, 28, a + 0.8 * air, 25, land, 9, squash - 0.02, 0);
      p.feet[o + 2] = track(t, 0, 0.5, crouch, 1, a, 1, a + 0.1 * air, 0.1, a + 0.45 * air, -1.2, a + 0.8 * air, -0.5, land, 0.5, squash, 1.05);
      p.feet[o + 3] = track(t, a + 0.1 * air, 0, a + 0.45 * air, -2.6, a + 0.8 * air, -1.6, squash - 0.02, 0);
    } else {
      // The forelegs reach for the dot and get there first.
      const reachX = c + half + track(u, 0, 4, 0.3, 27, 0.7, 26, 1, 4);
      const x = lerp(F + 18 + far, reachX, smooth(P(u, 0, 0.25)));
      p.feet[o] = lerp(x, L + 16 + far, smooth(P(u, 0.7, 1)));
      p.feet[o + 1] = track(t, a, 0, a + 0.25 * air, 25, a + 0.5 * air, 33, a + 0.8 * air, 14, land, 0);
      p.feet[o + 2] = track(t, a, 0.87, a + 0.3 * air, 1.5, a + 0.75 * air, 1.3, land, 0.87);
      p.feet[o + 3] = 0;
    }
  }

  // The head follows the dot: low and forward, pitched toward it. In the air it leads; landed, the nose goes down to the paws.
  const hx = p.sx + track(t, 0, 11.5, crouch, 12, coilAt, 12, a, 10.5, a + 0.4 * air, 12.5, land, 11.5, squash, 10.5);
  const hy0 = p.sy + track(t, 0, 6, crouch, 3.5, coilAt, 3.5, a, 3, a + 0.2 * air, 6, a + 0.5 * air, 4.5, a + 0.8 * air, -1, land, 0.5, squash, 1.5, settled, 4);
  const look = cl(Math.atan2(dotY - hy0, dotX - hx), -0.45, 0.4) * 0.8;
  // Locked on: the rear wiggles, the head does not.
  p.headX = hx;
  p.headY = hy0;
  p.headA = lerp(look, track(t, a, look, a + 0.2 * air, 0.3, a + 0.5 * air, -0.05, a + 0.8 * air, -0.5, squash, -0.6, settled, -0.3), P(t, a - 0.01, a));
  p.yaw = 1;
  // Ears forward while it stalks; they flick back at the impact and come up again.
  const flinch = Math.exp(-(((t - land - 0.06) / 0.07) ** 2));
  p.earA = 0.35 * flinch;
  p.earB = 0.45 * flinch;

  // Tail low and straight behind, its tip twitching; it streams out in the air and whips up as it lands.
  const down = E.outCubic(P(t, 0, crouch));
  const pitch = Math.atan2(sy - hy, 2 * reach);
  for (let i = 0; i < TAIL; i++) {
    const twitch = 0.07 * i * Math.sin(t * 9 - i * 0.6) * (1 - u) + 0.05 * i * w;
    const stream = lerp(lerp(TAIL_UP[i], TAIL_LOW[i], down) + twitch, Math.PI + pitch * 0.6 - 0.05 * i, smooth(P(u, 0, 0.3)));
    p.tail[i] = lerp(stream, TAIL_LANDED[i], smooth(P(t, land - 0.04, settled)));
  }
}

/* ------------------------------------------------------------------- field */

// The parts are not simply laid over each other: the silhouette is the zero line of a distance field.
// Each part (a leg, the body, the tail) is a hard union of its own discs; a near leg and the tail join
// the body with a smooth minimum, so every joint gets a soft fillet instead of a crease, and no two legs
// ever blend with each other. The far legs are cut back by a hairline around the near legs, so when two
// legs cross they still read as two. The field is sampled on a grid about 1.5px apart and contoured
// with marching squares into one path; the skull and the ears stay exact outlines on top.

/** How far (rig units) a part blends into the body, and the hairline left between near and far legs. */
const BLEND = [0, 2.6, 1.6, 1.8];
const GAP = 0.55;
const BIG = 1e3;

let grids: Float32Array[] = [];
/** Grids: body, the shape so far (near), far legs, near legs, the part being added. */
function grid(n: number) {
  if (!grids.length || grids[0].length < n) grids = Array.from({ length: 5 }, () => new Float32Array(n));
  return grids;
}

const smin = (a: number, b: number, k: number) => {
  const h = k - Math.abs(a - b);
  return h <= 0 ? Math.min(a, b) : Math.min(a, b) - (h * h) / (4 * k);
};

/** The silhouette's distance field on a grid of step g (rig units): negative inside. */
export interface Field {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  g: number;
  /** One value per node, row by row from y0 up. */
  d: Float32Array;
}

/** Samples the silhouette's field (discs only; the head's outlines are not in it). */
export function field(s: Shape, g: number): Field {
  const d = s.discs;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < d.length; i += 3) {
    x0 = Math.min(x0, d[i] - d[i + 2]);
    x1 = Math.max(x1, d[i] + d[i + 2]);
    y0 = Math.min(y0, d[i + 1] - d[i + 2]);
    y1 = Math.max(y1, d[i + 1] + d[i + 2]);
  }
  if (!(x1 > x0)) return { nx: 0, ny: 0, x0: 0, y0: 0, g, d: new Float32Array(0) };
  // Never more than about 200k nodes, however large it is drawn.
  g = Math.max(g, Math.sqrt(((x1 - x0 + 8) * (y1 - y0 + 8)) / 2e5));
  x0 -= 4;
  y0 -= 4;
  const nx = Math.ceil((x1 + 4 - x0) / g) + 1;
  const ny = Math.ceil((y1 + 4 - y0) / g) + 1;
  const n = nx * ny;
  const [B, N, F, L, Q] = grid(n);
  B.fill(BIG, 0, n);
  F.fill(BIG, 0, n);
  L.fill(BIG, 0, n);
  const box = [0, 0, 0, 0];
  /** Hard union of discs [a, b) into `to`, exact to `m` outside them; returns the node box it touched. */
  const discs = (to: Float32Array, a: number, b: number, m: number) => {
    box[0] = nx;
    box[1] = ny;
    box[2] = 0;
    box[3] = 0;
    // The sweeps are dense: a disc that barely moves on from the last one used adds nothing a pixel would show.
    let lx = Infinity;
    let ly = 0;
    let lr = 0;
    for (let i = a; i < b; i += 3) {
      const cx = d[i];
      const cy = d[i + 1];
      const r = d[i + 2];
      if (i + 3 < b && Math.hypot(cx - lx, cy - ly) + Math.abs(r - lr) < 0.5 * g) continue;
      lx = cx;
      ly = cy;
      lr = r;
      const i0 = Math.max(0, Math.floor((cx - r - m - x0) / g));
      const i1 = Math.min(nx - 1, Math.ceil((cx + r + m - x0) / g));
      const j0 = Math.max(0, Math.floor((cy - r - m - y0) / g));
      const j1 = Math.min(ny - 1, Math.ceil((cy + r + m - y0) / g));
      box[0] = Math.min(box[0], i0);
      box[1] = Math.min(box[1], j0);
      box[2] = Math.max(box[2], i1);
      box[3] = Math.max(box[3], j1);
      for (let j = j0; j <= j1; j++) {
        const dy = y0 + j * g - cy;
        const row = j * nx;
        for (let k = i0; k <= i1; k++) {
          const dx = x0 + k * g - cx;
          const v = Math.sqrt(dx * dx + dy * dy) - r;
          if (v < to[row + k]) to[row + k] = v;
        }
      }
    }
  };
  const P = s.parts;
  let from = 0;
  for (let i = 0; i < P.length; i += 4) {
    if (P[i + 1] === BODY_PART) discs(B, from, P[i], 3);
    from = P[i];
  }
  N.set(B.subarray(0, n));
  from = 0;
  for (let i = 0; i < P.length; i += 4) {
    const kind = P[i + 1];
    const a = from;
    from = P[i];
    if (kind === BODY_PART) continue;
    const k = BLEND[kind];
    if (kind === NEAR_LEG) discs(L, P[i + 2], P[i + 3], GAP + g);
    // Clear only the part's own box, then add its discs.
    {
      let bx0 = Infinity;
      let bx1 = -Infinity;
      let by0 = Infinity;
      let by1 = -Infinity;
      for (let q = a; q < from; q += 3) {
        bx0 = Math.min(bx0, d[q] - d[q + 2]);
        bx1 = Math.max(bx1, d[q] + d[q + 2]);
        by0 = Math.min(by0, d[q + 1] - d[q + 2]);
        by1 = Math.max(by1, d[q + 1] + d[q + 2]);
      }
      const m = k + GAP + g;
      const c0 = Math.max(0, Math.floor((bx0 - m - x0) / g));
      const c1 = Math.min(nx - 1, Math.ceil((bx1 + m - x0) / g));
      for (let j = Math.max(0, Math.floor((by0 - m - y0) / g)), e = Math.min(ny - 1, Math.ceil((by1 + m - y0) / g)); j <= e; j++) Q.fill(BIG, j * nx + c0, j * nx + c1 + 1);
    }
    discs(Q, a, from, k + GAP);
    const [i0, j0, i1, j1] = box;
    for (let j = j0; j <= j1; j++) {
      for (let q = j * nx + i0, e = j * nx + i1; q <= e; q++) {
        const v = Q[q];
        if (kind === FAR_LEG) {
          if (v < F[q]) F[q] = v;
          continue;
        }
        const u = smin(B[q], v, k);
        if (u < N[q]) N[q] = u;
      }
    }
  }
  // Far legs: cut back by a hairline around the near legs, then joined to the body, softly.
  const k = BLEND[FAR_LEG];
  // What is left of a far leg thinner than a couple of pixels is dropped: it would only read as specks.
  const thin = 0.7 * g;
  for (let q = 0; q < n; q++) {
    if (F[q] >= BIG) continue;
    const cut = Math.max(F[q], GAP - L[q]) + thin;
    const u = smin(B[q], cut, k);
    if (u < N[q]) N[q] = u;
  }
  return { nx, ny, x0, y0, g, d: N };
}

/** Anything a path can be built on (a canvas context). */
interface Pen {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

let links = new Int32Array(0);

/**
 * Contours a field into the pen with marching squares: rig (0, 0) lands on (ox, gy), `sc` px per rig unit.
 * Each cell links the zero crossings on its edges, the inside on the left in rig space (clockwise on screen),
 * and the links are walked into closed outlines: a few polygons, one vertex per crossing. A hole runs the other way.
 */
export function contourField(pen: Pen, f: Field, ox: number, gy: number, sc: number) {
  const { nx, ny, x0, y0, g, d } = f;
  const n = nx * ny;
  if (links.length < 2 * n) links = new Int32Array(2 * n);
  // Edge ids: the edge from node q to its right neighbour is q, to the one above it is n + q.
  links.fill(-1, 0, 2 * n);
  const starts: number[] = [];
  const ids = [0, 0, 0, 0];
  const v = [0, 0, 0, 0];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const q = j * nx + i;
      // Corners counter-clockwise (rig y is up): bottom-left, bottom-right, top-right, top-left.
      v[0] = d[q];
      v[1] = d[q + 1];
      v[2] = d[q + 1 + nx];
      v[3] = d[q + nx];
      const inside = (v[0] < 0 ? 1 : 0) | (v[1] < 0 ? 2 : 0) | (v[2] < 0 ? 4 : 0) | (v[3] < 0 ? 8 : 0);
      if (inside === 0 || inside === 15) continue;
      // Edge k runs from corner k to corner k + 1.
      ids[0] = q;
      ids[1] = n + q + 1;
      ids[2] = q + nx;
      ids[3] = n + q;
      // A saddle stays joined across the middle when the middle is inside.
      const joined = v[0] + v[1] + v[2] + v[3] < 0;
      for (let k = 0; k < 4; k++) {
        if (!(v[k] < 0) || v[(k + 1) % 4] < 0) continue;
        // Leaving the inside across edge k: the outline comes back in across the next edge that enters it.
        let e = -1;
        for (let m = 1; m < 4; m++) {
          const kk = joined ? (k + m) % 4 : (k + 4 - m) % 4;
          if (!(v[kk] < 0) && v[(kk + 1) % 4] < 0) {
            e = kk;
            break;
          }
        }
        if (e < 0) continue;
        // Walk the outline with the inside on its left: from where it comes in to where it leaves.
        links[ids[e]] = ids[k];
        starts.push(ids[e]);
      }
    }
  }
  const point = (id: number, first: boolean) => {
    const up = id >= n;
    const q = up ? id - n : id;
    const r = up ? q + nx : q + 1;
    const u = d[q] / (d[q] - d[r]);
    const i = (q % nx) + (up ? 0 : u);
    const j = Math.floor(q / nx) + (up ? u : 0);
    const px = ox + (x0 + i * g) * sc;
    const py = gy - (y0 + j * g) * sc;
    if (first) pen.moveTo(px, py);
    else pen.lineTo(px, py);
  };
  for (const s0 of starts) {
    if (links[s0] < 0) continue;
    let id = s0;
    point(id, true);
    for (let guard = 0; guard < 2 * n; guard++) {
      const next = links[id];
      links[id] = -1;
      if (next < 0 || next === s0) break;
      point(next, false);
      id = next;
    }
    pen.closePath();
  }
}

/* ------------------------------------------------------------------ canvas */

/** Traces the silhouette as one path: rig (0, 0) lands on (ox, gy), `sc` px per rig unit. Fill it once and the parts are one shape. */
export function trace(ctx: CanvasRenderingContext2D, s: Shape, ox: number, gy: number, sc: number) {
  ctx.beginPath();
  contourField(ctx, field(s, 2 / sc), ox, gy, sc);
  for (const q of s.polys) {
    // Every outline runs clockwise on screen, like the field's cells, so overlaps add up instead of cancelling.
    let area = 0;
    for (let i = 0; i < q.length; i += 2) area += q[i] * q[(i + 3) % q.length] - q[(i + 2) % q.length] * q[i + 1];
    const n = q.length / 2;
    for (let j = 0; j < n; j++) {
      const i = (area > 0 ? n - 1 - j : j) * 2;
      if (j) ctx.lineTo(ox + q[i] * sc, gy - q[i + 1] * sc);
      else ctx.moveTo(ox + q[i] * sc, gy - q[i + 1] * sc);
    }
    ctx.closePath();
  }
}
