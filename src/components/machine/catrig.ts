// The cat, side-on and able to move. A pose (spine, four feet, head, tail) is
// turned into one silhouette: the body, the legs and the tail are swept along
// smooth curves through the joints with a radius that tapers (so a leg is one
// tapering limb, not a chain of capsules), and the skull and ears are closed
// spline outlines. The silhouette is then a set of particles, each tied to its
// place on the body. No DOM here: poses are plain maths, a pure function of
// time; cat.ts draws the particles.
//
// Rig units: the back is about 32 high, the cat faces +x, y is up, the ground is y = 0.
// Why it reads as a walk and not as a slide:
//   - a lateral-sequence walk, four beats: near hind, near fore, far hind, far fore,
//     a quarter of a stride apart, each foot on the ground 62% of the time;
//   - a planted foot is fixed in the world: its position is computed from the
//     distance travelled, never from the clock, so it cannot slide;
//   - shoulders and hips rise over each planted leg and dip between steps, in
//     opposite phase, so the back rocks; the head stays level; the tail lags.

import { E, P, cl, lerp, mulberry32 } from './draw';

const UPPER = 8.5;
const FORE = 13.3;
const FPAW = 2.1;
/** Fore paw, heel to toe. */
const FTOE = 1.9;
const THIGH = 9;
const SHANK = 10;
const META = 7;
const HPAW = 2.7;
export const TAIL = 7;
/** The head's size against its outlines. */
const HEAD_K = 1.3;
const TAIL_SEG = 5.6;
/** Height of the spine at the hips and shoulders when it stands. */
const BACK = 26;
/** Half the distance between hips and shoulders. */
const HALF = 12.5;

/** Legs, in the order the feet are stored: far hind, far fore, near hind, near fore. */
export const HIND = [true, false, true, false];

export const STRIDE = 30;
export const DUTY = 0.62;
/** When each foot lands, as a fraction of the stride. */
const PHASE = [0.5, 0.75, 0, 0.25];
/** Where a foot is under the body at mid-stance. */
const NEUTRAL = [-12.5, 11.5, -12.5, 11.5];
export const TAIL_UP = [2.75, 2.5, 2.25, 2.05, 1.95, 2.0, 2.2];
export const TAIL_SAT = [2.55, 2.2, 1.95, 1.8, 1.55, 1.05, 0.35];
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
  /** How open the eyes are (0 shut, 1 wide), the head's tilt in the picture plane (radians), how wide the mouth is (a yawn, 0..1). */
  open: number;
  roll: number;
  mouth: number;
  /** 1: the tail is wrapped toward the camera, so it lies over the body and the legs instead of behind them. */
  tailFront: number;
}

export const newPose = (): Pose => ({ hx: 0, hy: 0, sx: 0, sy: 0, bend: 0, feet: new Float32Array(16), headX: 0, headY: 0, headA: 0, yaw: 1, tail: new Float32Array(TAIL), earA: 0, earB: 0, open: 1, roll: 0, mouth: 0, tailFront: 0 });
/** Back to a plain face: eyes open, head upright, mouth shut, tail behind. Every pose starts here. */
const rest = (p: Pose) => {
  p.open = 1;
  p.roll = 0;
  p.mouth = 0;
  p.tailFront = 0;
  p.earA = 0;
  p.earB = 0;
};

/** What a part of the silhouette is: how it joins the rest. */
export const BODY_PART = 0;
export const NEAR_LEG = 1;
export const FAR_LEG = 2;
export const TAIL_PART = 3;

/** A silhouette, in rig units. */
export interface Shape {
  /** Discs (x, y, r), flat: the body, the legs and the tail are swept out of them. */
  discs: number[];
  /** Parts, flat (end, kind): discs up to `end` (an index into `discs`) belong to a part of that kind. */
  parts: number[];
  /** Closed outlines (x, y, ...): the skull and the ears. */
  polys: number[][];
  /** Eyes (x, y, rx, ry, tilt, side of the face: -1 or 1), flat. */
  eyes: number[];
  /** Where the head is turned (the pose's yaw): 1 in profile, 0 at the camera, -1 in profile looking back. */
  yaw: number;
  /** The head's frame, to find the face on it: centre (x, y), cos and sin of its turn, size, mirror (1 or -1), how far in profile (0..1), mouth. */
  head: number[];
  /** The pose's eyes, and whether the tail lies in front. */
  open: number;
  tailFront: number;
}
export const newShape = (): Shape => ({ discs: [], parts: [], polys: [], eyes: [], yaw: 1, head: [0, 0, 1, 0, 1, 1, 1, 0], open: 1, tailFront: 0 });
const clear = (s: Shape) => {
  s.discs.length = 0;
  s.parts.length = 0;
  s.polys.length = 0;
  s.eyes.length = 0;
};
const part = (s: Shape, kind: number) => s.parts.push(s.discs.length, kind);

/* ------------------------------------------------------------------- shape */

/**
 * Sweeps a disc along a smooth curve through the keys (x, y, radius to the left of travel, radius to the right).
 * The curve passes through every key; the radius eases from one to the next, so the limb tapers without a joint.
 */
function sweep(out: number[], k: number[]) {
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
/** How far each point of the front outline drops when the mouth opens wide: the chin and the jaw beside it. */
const YAWN_DROP = [0, 0, 0, 0, 0, 0, 0.5, 1.4, 1.75, 1.4, 0.5, 0, 0, 0, 0, 0];
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
export function head(s: Shape, x: number, y: number, pitch: number, yaw: number, k = 1, roll = 0, earA = 0, earB = 0, mouth = 0) {
  const side = Math.abs(yaw);
  s.yaw = yaw;
  const flip = yaw < 0 ? -1 : 1;
  // The pitch fades as the head comes round, so it never jumps when the nose crosses the middle.
  const c = Math.cos(pitch * yaw + roll);
  const sn = Math.sin(pitch * yaw + roll);
  s.head = [x, y, c, sn, k, flip, side, mouth];
  const put = (out: number[], lx: number, ly: number) => out.push(x + (lx * flip * c - ly * sn) * k, y + (lx * flip * sn + ly * c) * k);
  const skull: number[] = [];
  // A yawn: from the front the chin drops; in profile the jaw swings down about its hinge.
  const jc = Math.cos(-0.55 * mouth);
  const js = Math.sin(-0.55 * mouth);
  for (let i = 0; i < SKULL_SIDE.length; i += 2) {
    let sx = SKULL_SIDE[i];
    let sy = SKULL_SIDE[i + 1];
    if (mouth && i >= 10 && i <= 16) {
      const hx = sx + 0.9;
      const hy = sy + 1.5;
      sx = -0.9 + hx * jc - hy * js;
      sy = -1.5 + hx * js + hy * jc;
    }
    put(skull, lerp(SKULL_FRONT[i], sx, side), lerp(SKULL_FRONT[i + 1] - mouth * YAWN_DROP[i / 2], sy, side));
  }
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
    // Two sides, each bowed a little outward, and a softly rounded tip between them.
    for (const [a, b, bow] of [
      [0, 2, 0.5],
      [2, 4, 0.35],
    ]) {
      const nx = -(q[b + 1] - q[a + 1]);
      const ny = q[b] - q[a];
      const d = Math.hypot(nx, ny) || 1;
      if (a === 2) put(ear, lerp(q[2], (q[0] + q[4]) / 2, 0.08), lerp(q[3], (q[1] + q[5]) / 2, 0.08));
      for (let j = a === 2 ? 1 : 0; j < 6; j++) {
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
    s.eyes.push(o[0], o[1], k * seen * lerp(1.4, 1.0, side), lerp(1.0, 0.62, side) * k, pitch * yaw + roll + flip * lerp(lat * -0.05, 0.3, side), lat);
  }
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
    sweep(s.discs, k);
    part(s, leg < 2 ? FAR_LEG : NEAR_LEG);
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

  head(s, p.headX, p.headY, p.headA, p.yaw, HEAD_K, p.roll, p.earA, p.earB, p.mouth);
  s.open = p.open;
  s.tailFront = p.tailFront;
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
export const SIT = { hx: -11, hy: 6.5, sx: 5, sy: 26.5, bend: 3.2, headX: 7.5, headY: 39, feet: [3.4, 13.4, 2.6, 10.4] };

/** The cat sitting still. `swing` bends the tail (radians at its tip), `yaw` turns the head. */
export function sitPose(p: Pose, swing = 0, yaw = -1) {
  rest(p);
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
  rest(p);
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
  rest(p);
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
// Each part (a leg, the body, the tail) is a hard union of its own discs; the legs and the tail join
// the body with a smooth minimum, so every joint gets a soft fillet instead of a crease, and no two legs
// ever blend with each other. The field is sampled on a grid a few px apart; the particles (below) read
// it to find the outline and to know which part is in front.

/** How far (rig units) a part blends into the body, by kind. */
const BLEND = [0, 2.6, 1.6, 1.8];
const BIG = 1e3;

let grids: Float32Array[] = [];
/** Grids: body, the whole shape, far legs, the part being added, near legs, tail. */
function grid(n: number) {
  if (!grids.length || grids[0].length < n) grids = Array.from({ length: 6 }, () => new Float32Array(n));
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
  /** The same grid for the body alone, the near legs alone, the far legs alone and the tail alone (exact only near them). */
  body: Float32Array;
  near: Float32Array;
  far: Float32Array;
  tail: Float32Array;
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
  if (!(x1 > x0)) {
    const none = new Float32Array(0);
    return { nx: 0, ny: 0, x0: 0, y0: 0, g, d: none, body: none, near: none, far: none, tail: none };
  }
  // Never more than about 200k nodes, however large it is drawn.
  g = Math.max(g, Math.sqrt(((x1 - x0 + 8) * (y1 - y0 + 8)) / 2e5));
  x0 -= 4;
  y0 -= 4;
  const nx = Math.ceil((x1 + 4 - x0) / g) + 1;
  const ny = Math.ceil((y1 + 4 - y0) / g) + 1;
  const n = nx * ny;
  const [B, N, F, Q, L, T] = grid(n);
  B.fill(BIG, 0, n);
  F.fill(BIG, 0, n);
  L.fill(BIG, 0, n);
  T.fill(BIG, 0, n);
  const box = [0, 0, 0, 0];
  /** Hard union of discs [a, b) into `to`, exact to `m` outside them; returns the node box it touched. */
  const discs = (to: Float32Array, a: number, b: number, m: number) => {
    box[0] = nx;
    box[1] = ny;
    box[2] = 0;
    box[3] = 0;
    // The sweeps are dense: a disc close to the last one used adds nothing a pixel would show. Two discs of radius r a
    // distance s apart leave a notch about s^2 / 8r deep between them: kept under a quarter of a grid step.
    let lx = Infinity;
    let ly = 0;
    let lr = 0;
    for (let i = a; i < b; i += 3) {
      const cx = d[i];
      const cy = d[i + 1];
      const r = d[i + 2];
      if (i + 3 < b && Math.abs(r - lr) < 0.25 * g && (cx - lx) ** 2 + (cy - ly) ** 2 < 2 * Math.min(r, lr) * g) continue;
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
  for (let i = 0; i < P.length; i += 2) {
    if (P[i + 1] === BODY_PART) discs(B, from, P[i], 3);
    from = P[i];
  }
  N.set(B.subarray(0, n));
  from = 0;
  for (let i = 0; i < P.length; i += 2) {
    const kind = P[i + 1];
    const a = from;
    from = P[i];
    if (kind === BODY_PART) continue;
    const k = BLEND[kind];
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
      const m = k + g;
      const c0 = Math.max(0, Math.floor((bx0 - m - x0) / g));
      const c1 = Math.min(nx - 1, Math.ceil((bx1 + m - x0) / g));
      for (let j = Math.max(0, Math.floor((by0 - m - y0) / g)), e = Math.min(ny - 1, Math.ceil((by1 + m - y0) / g)); j <= e; j++) Q.fill(BIG, j * nx + c0, j * nx + c1 + 1);
    }
    discs(Q, a, from, k);
    const [i0, j0, i1, j1] = box;
    for (let j = j0; j <= j1; j++) {
      for (let q = j * nx + i0, e = j * nx + i1; q <= e; q++) {
        const v = Q[q];
        if (kind === FAR_LEG) {
          if (v < F[q]) F[q] = v;
          continue;
        }
        if (kind === NEAR_LEG && v < L[q]) L[q] = v;
        if (kind === TAIL_PART) T[q] = v;
        const u = smin(B[q], v, k);
        if (u < N[q]) N[q] = u;
      }
    }
  }
  // Far legs join the body softly too; drawn a step dimmer, they need no cut to read apart from the near ones.
  const k = BLEND[FAR_LEG];
  for (let q = 0; q < n; q++) {
    if (F[q] >= BIG) continue;
    const u = smin(B[q], F[q], k);
    if (u < N[q]) N[q] = u;
  }
  return { nx, ny, x0, y0, g, d: N, body: B, near: L, far: F, tail: T };
}

/* --------------------------------------------------------------- particles */

// The cat is drawn as a cloud of particles. They are scattered once, at rest, by chance but evenly (dart throwing: a
// new one is kept only if no other is too close, so they never clump), more of them toward the outline of each part
// than inside it, and each keeps its place in the coordinates of its part, so frame after frame it follows that place
// and the moving cat never boils:
//   - a leg, the body, the tail (a sweep of discs): how far along the part's middle line, and how far across it as a
//     fraction of its half width there (a few strays sit just outside, dim, so the edge is never a drawn line);
//   - the skull and the ears (closed outlines): an angle about the middle and a fraction of the way to the outline;
//     the skull's are laid out on the face seen from the front, so the face keeps its weave as the head turns;
//   - the eyes: lines of dots, a dark lid over a sliver of green, which close into a short pale curve.
// Each also has a size and a brightness, from skewed draws: mostly small and dim, a few large and bright. A part in
// front hides the particles of the parts behind it (the body hides the legs and the tail, the near legs hide the far
// ones and the tail, the skull hides the body, the near ear the far one); where a near leg crosses the body its
// outline shows as brighter dots. The markings are a tabby's, as tones: the coat's are fixed to each particle, the
// face's are found every frame from where the eyes, the nose and the mouth are.

const SWEPT = 0;
const POLAR = 1;
const EYE_DOT = 2;
const VEIL = 3;
/** Tones 0 to 6 are the Machine's grey ramp (5 the brightest) and the asset's cyan; cat.ts draws them. HIDDEN is not drawn. */
export const HIDDEN = 255;
export const LIT = 5;
// The coat: a tabby in a few warm steps (the darkest are her stripes), cream for the muzzle, chest and belly, and the eyes.
export const DEEP = 7;
export const STRIPE = 8;
export const SHADE = 9;
export const COAT = 10;
export const GINGER = 11;
export const CREAM_DIM = 12;
export const CREAM = 13;
export const EYE = 14;
export const TONE_COUNT = 15;
/** One step back, for what is further away (the far legs, the far ear). */
export const DIMMER = Uint8Array.of(0, 0, 1, 2, 3, 4, 6, DEEP, DEEP, SHADE, SHADE, COAT, SHADE, CREAM_DIM, EYE);
/** What the Machine sees before it has classified her: brightness only, on its grey ramp, and no colour in her eyes. */
export const GREY = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 4, 5, 3);
/** The swept parts come first, in `skin`'s order (far hind, far fore, near hind, near fore, body, tail); then the skull and the two ears. */
const BODY_I = 4;
const TAIL_I = 5;
const SKULL = 6;
const EAR_NEAR = 7;
const EAR_FAR = 8;

/** A look: how many particles, where they gather, how big and how bright they are. */
export interface Style {
  /** Particles for a cat drawn at 6 px per rig unit; a smaller cat gets fewer (by its size to the power 1.5). */
  count: number;
  /** How much denser the band along the outline is than the inside, and how deep it reaches (a fraction of the way in). */
  edge: number;
  band: number;
  /** Share of strays: a little outside the outline, dim. */
  stray: number;
  /** Dot sizes (px at 6 px per rig unit): smallest, largest, and how strongly they lean to the small end. */
  size: readonly [number, number, number];
  /** Share of dots at full brightness and at the middle step; the rest are dim. */
  bright: number;
  mid: number;
  /** How evenly they are spread: 1 keeps them about as far apart as their density allows (blue noise), 0 is pure chance. */
  even: number;
  /** Seconds a streak reaches back behind a moving particle (0: none). */
  trail: number;
  /** A veil of very faint specks on top (count at 6 px per rig unit, like `count`), and how far they stray from the particles they ride on (in spacings). */
  veil?: number;
  fray?: number;
}

export interface Swarm {
  n: number;
  /** Swept part, polar (skull, ears) or eye dot; which part it belongs to. */
  kind: Uint8Array;
  part: Uint8Array;
  /** Swept: a fraction along; polar: an angle in the head's frame; eye dot: an angle around the eye. */
  a: Float32Array;
  /** Swept: across, a fraction of the half width (past 1: a stray); polar: a fraction of the way to the outline; eye dot: which eye (-1, 1). */
  b: Float32Array;
  /** 1 near the outline: the outline is drawn first when the cat materialises. */
  edge: Uint8Array;
  /** Its markings on a leg, the body or the tail (a tone); the head's are found every frame. */
  coat: Uint8Array;
  /** Its dot (px) and its brightness step (0 full, 1 middle, 2 dim, 3 a veil speck). */
  size: Float32Array;
  level: Uint8Array;
  /** A swept particle's spot at its widest over the poses (area per unit of a and b): it shows when the spot needs it now. */
  den: Float32Array;
  /** Particles before the veil; each veil speck's particle (index from `core` on); for a speck, a and b are its offset (rig units). */
  core: number;
  up: Int32Array;
  /** Rig units: the mean spacing it was laid out with, and half a dot. */
  d: number;
  inset: number;
  /** This frame: where each particle is (px), its tone and its brightness step. */
  x: Float32Array;
  y: Float32Array;
  tone: Uint8Array;
  lit: Uint8Array;
}

// Per frame, per point of each swept part's middle line: where it is (x, y), its half width, the length along the part
// to it, its normal, and how the normal turns along it (a bend). The line runs through the part's discs and on into its
// round ends (the rump, a toe, the tail's tip), so particles cover those too: a part's discs reach them, and without
// them the end of a part was flat and a part behind it, hidden there, left a hole.
let VX = new Float32Array(0);
let VY = new Float32Array(0);
let VR = new Float32Array(0);
let CUM = new Float32Array(0);
let NX = new Float32Array(0);
let NY = new Float32Array(0);
let KAP = new Float32Array(0);
let RM = new Float32Array(0);
const PF = [0, 0, 0, 0, 0, 0];
const PE = [0, 0, 0, 0, 0, 0];
/** Per part: how far along the line its discs start, and how long they run (the coat is laid out on them). */
const CAP0 = [0, 0, 0, 0, 0, 0];
const MIDL = [0, 0, 0, 0, 0, 0];
/** Points on each round end. */
const CAPN = 5;

/** The six swept parts as chains: places, half widths, lengths, normals and bends, for this shape. */
function chains(s: Shape) {
  const D = s.discs;
  const m = D.length / 3 + 12 * CAPN;
  if (CUM.length < m) [VX, VY, VR, CUM, NX, NY, KAP, RM] = Array.from({ length: 8 }, () => new Float32Array(m + 512));
  let from = 0;
  let o = 0;
  const put = (x: number, y: number, r: number, nx: number, ny: number) => {
    VX[o] = x;
    VY[o] = y;
    VR[o] = r;
    NX[o] = nx;
    NY[o] = ny;
    o++;
  };
  for (let p = 0; p < 6; p++) {
    const end = s.parts[p * 2] / 3;
    PF[p] = o;
    const normal = (i: number) => {
      const i0 = Math.max(from, i - 2) * 3;
      const i1 = Math.min(end - 1, i + 2) * 3;
      const tx = D[i1] - D[i0];
      const ty = D[i1 + 1] - D[i0 + 1];
      const l = Math.sqrt(tx * tx + ty * ty) || 1;
      return [-ty / l, tx / l];
    };
    // A round end: points along the tangent out to the rim, the half width that of the circle there.
    const cap = (i: number, dir: number) => {
      const [nx, ny] = normal(i);
      const r = D[i * 3 + 2];
      for (let j = 1; j <= CAPN; j++) {
        const k = dir < 0 ? CAPN + 1 - j : j;
        const th = (Math.PI / 2) * (k / (CAPN + 0.5));
        const out = r * Math.sin(th) * dir;
        put(D[i * 3] + ny * out, D[i * 3 + 1] - nx * out, r * Math.cos(th), nx, ny);
      }
    };
    // A leg starts inside the body; the rump and the tail's root are ends (wrapped in front, the root lies over the body).
    if (p >= BODY_I) cap(from, -1);
    for (let i = from; i < end; i++) {
      const [nx, ny] = normal(i);
      put(D[i * 3], D[i * 3 + 1], D[i * 3 + 2], nx, ny);
    }
    cap(end - 1, 1);
    PE[p] = o;
    CUM[PF[p]] = 0;
    KAP[PF[p]] = 0;
    for (let i = PF[p] + 1; i < o; i++) {
      const ds = Math.hypot(VX[i] - VX[i - 1], VY[i] - VY[i - 1]);
      CUM[i] = CUM[i - 1] + ds;
      // Along the tangent, how fast the normal turns: a point off the middle line by `off` travels (1 + KAP * off) as fast.
      KAP[i] = ds > 1e-6 ? ((NX[i] - NX[i - 1]) * NY[i] - (NY[i] - NY[i - 1]) * NX[i]) / ds : 0;
    }
    CAP0[p] = p >= BODY_I ? CUM[PF[p] + CAPN] : 0;
    // The widest the part gets within a half width of each point: where it swells quickly (the rump, a hip), a spot is
    // deeper in its neighbour's disc than in its own, which is not the part folding over itself.
    for (let i = PF[p], lo = PF[p], hi = PF[p]; i < o; i++) {
      while (CUM[i] - CUM[lo] > 1.2 * VR[i]) lo++;
      while (hi < o - 1 && CUM[hi + 1] - CUM[i] <= 1.2 * VR[i]) hi++;
      let m = 0;
      for (let k = lo; k <= hi; k++) m = Math.max(m, VR[k]);
      RM[i] = m;
    }
    MIDL[p] = CUM[PE[p] - 1 - CAPN] - CAP0[p] || 1;
    from = end;
  }
}

/** Bins of a swept part's parameters (along: a, 0..1; across: b, -1..1) the area of a pose is measured in. */
const NA = 40;
const NBI = 8;
/** The most a spot is laid out denser than at rest: past it, a spot is a little sparse at its widest. */
const GAIN = 3;
/**
 * How much area a spot (a, b) of each swept part takes in this shape (chains must be current), per unit of a and b:
 * the part's length, times its half width there, times how much a bend stretches (outside) or squeezes (inside) it.
 */
function areaBins(out: Float32Array) {
  for (let p = 0; p < 6; p++) {
    const L = CUM[PE[p] - 1];
    for (let k = 0; k < NA; k++) {
      const q = seek(CUM, PF[p], PE[p], ((k + 0.5) / NA) * L);
      const q1 = Math.min(q + 1, PE[p] - 1);
      const r = lerp(VR[q], VR[q1], segU);
      const kap = lerp(KAP[q], KAP[q1], segU);
      for (let j = 0; j < NBI; j++) out[(p * NA + k) * NBI + j] = L * r * Math.max(0, 1 + kap * (((j + 0.5) / NBI) * 2 - 1) * r);
    }
  }
}
/** A spot's value in area bins, between their centres. */
function binAt(g: Float32Array, p: number, a: number, b: number) {
  const u = cl(a * NA - 0.5, 0, NA - 1);
  const v = cl(((cl(b, -1, 1) + 1) / 2) * NBI - 0.5, 0, NBI - 1);
  const k = Math.min(NA - 2, Math.floor(u));
  const j = Math.min(NBI - 2, Math.floor(v));
  const at = (kk: number, jj: number) => g[(p * NA + kk) * NBI + jj];
  return lerp(lerp(at(k, j), at(k + 1, j), u - k), lerp(at(k, j + 1), at(k + 1, j + 1), u - k), v - j);
}

/** The index i in c[from, end) with c[i] <= v < c[i + 1]; `segU` is how far between them. */
let segU = 0;
function seek(c: Float32Array, from: number, end: number, v: number) {
  let lo = from;
  let hi = end - 1;
  segU = 0;
  if (hi <= lo || v <= c[lo]) return lo;
  if (v >= c[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c[mid] <= v) lo = mid;
    else hi = mid;
  }
  segU = (v - c[lo]) / (c[hi] - c[lo] || 1);
  return lo;
}

// Per frame, per outline (skull, near ear, far ear; slot 3 is the skull seen from the front): its centre, the length
// around it to each vertex, and how far it reaches from the centre in each direction.
const BINS = 64;
const CEN = [0, 0, 0, 0, 0, 0, 0, 0];
/** How far each outline reaches at most, to rule a point out cheaply. */
const FAR = [0, 0, 0, 0];
/** And how far at least: inside that, a point is inside without looking further. */
const NEAR = [0, 0, 0, 0];
const RAD = [new Float32Array(BINS), new Float32Array(BINS), new Float32Array(BINS), new Float32Array(BINS)];

function outline(q: number[], j: number) {
  const n = q.length / 2;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += q[i * 2];
    cy += q[i * 2 + 1];
  }
  cx /= n;
  cy /= n;
  CEN[j * 2] = cx;
  CEN[j * 2 + 1] = cy;
  const R = RAD[j];
  R.fill(0);
  // Where a ray from the centre through the middle of each bin leaves the outline: exact, so it moves smoothly with the
  // outline (sampled points jumped from bin to bin, and the particles on the rim with them).
  for (let k = 0; k < BINS; k++) {
    const th = ((k + 0.5) / BINS) * 2 * Math.PI - Math.PI;
    const dx = Math.cos(th);
    const dy = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const ax = q[i * 2] - cx;
      const ay = q[i * 2 + 1] - cy;
      const ex = q[((i + 1) % n) * 2] - cx - ax;
      const ey = q[((i + 1) % n) * 2 + 1] - cy - ay;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const u = (ax * dy - ay * dx) / den;
      const t = (ax * ey - ay * ex) / den;
      if (u >= 0 && u <= 1 && t > R[k]) R[k] = t;
    }
  }
  FAR[j] = Math.max(...R);
  NEAR[j] = Math.min(...R);
}

/** How far outline j reaches from its centre at angle `ang`. */
function reach(j: number, ang: number) {
  const f = ((ang + Math.PI) / (2 * Math.PI)) * BINS - 0.5;
  const i = Math.floor(f);
  const R = RAD[j];
  return lerp(R[((i % BINS) + BINS) % BINS], R[(((i + 1) % BINS) + BINS) % BINS], f - i);
}

/** Whether (x, y) is inside outline j, grown by m (shrunk if m < 0). */
function within(j: number, x: number, y: number, m: number) {
  const dx = x - CEN[j * 2];
  const dy = y - CEN[j * 2 + 1];
  const d2 = dx * dx + dy * dy;
  const far = FAR[j] + m;
  if (d2 > far * far) return false;
  return Math.sqrt(d2) < reach(j, Math.atan2(dy, dx)) + m;
}

/** Whether (x, y) is less than the fraction k of the way from outline j's centre to the outline. */
function inside(j: number, x: number, y: number, k: number) {
  const dx = x - CEN[j * 2];
  const dy = y - CEN[j * 2 + 1];
  const d2 = dx * dx + dy * dy;
  const far = k * FAR[j];
  if (d2 > far * far) return false;
  const near = k * NEAR[j];
  if (d2 < near * near) return true;
  return Math.sqrt(dx * dx + dy * dy) < k * reach(j, Math.atan2(dy, dx));
}

/** The field at (x, y), between its nodes. Far from the shape it is large. */
function sample(f: Field, g: Float32Array, x: number, y: number) {
  const u = (x - f.x0) / f.g;
  const v = (y - f.y0) / f.g;
  const i = Math.floor(u);
  const j = Math.floor(v);
  if (i < 0 || j < 0 || i >= f.nx - 1 || j >= f.ny - 1) return BIG;
  const fu = u - i;
  const fv = v - j;
  const q = j * f.nx + i;
  return (g[q] * (1 - fu) + g[q + 1] * fu) * (1 - fv) + (g[q + f.nx] * (1 - fu) + g[q + f.nx + 1] * fu) * fv;
}

const frac = (x: number) => x - Math.floor(x);

/**
 * A tabby's markings on a leg, the body or the tail, at `s` along it (0 where it starts: the hip or shoulder, the rump,
 * the root) and `n` across it (-1 to 1; the back, and the front of a leg, are 1). Mackerel stripes run down the flanks
 * from a dark line along the spine and fade before the belly; a cream bib; the legs are barred, the tail ringed, its tip dark.
 */
function coatOf(p: number, s: number, n: number) {
  if (p === BODY_I) {
    // The body's sweep runs rump (0), shoulders (about 0.6), neck, up to the skull.
    // A small pale bib at the throat; below it the chest is ginger, crossed by a tabby's necklaces.
    if (s > 0.86 && n < -0.45) return CREAM;
    if (s > 0.78 && n < -0.2) return CREAM_DIM;
    if (s > 0.6 && n < 0.05) return frac(s * 13 + 0.2) < 0.26 ? STRIPE : GINGER;
    if (n < -0.55) return GINGER;
    if (s < 0.64 && n > 0.6 && n < 0.9) return STRIPE;
    if (s > 0.06 && s < 0.6 && n > -0.38 && frac(s * 11 + 0.35 * n * n) < 0.34) return STRIPE;
    if (s >= 0.6 && n > 0.05 && frac(s * 15) < 0.3) return STRIPE;
    return n < -0.15 ? GINGER : COAT;
  }
  if (p === TAIL_I) {
    if (s > 0.88) return STRIPE;
    return s > 0.1 && frac(s * 7.5) < 0.42 ? STRIPE : COAT;
  }
  if (s > 0.84) return GINGER;
  return s > 0.2 && frac(s * 6.5 + 0.25) < 0.34 ? STRIPE : COAT;
}

/** A polygon's area. */
function area(q: number[]) {
  let a = 0;
  for (let i = 0, n = q.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += q[i * 2] * q[j * 2 + 1] - q[j * 2] * q[i * 2 + 1];
  }
  return Math.abs(a) / 2;
}

/** Dots per eye: along the lid, then the sliver of green under it. */
const EYE_DOTS = 9;
const IRIS_DOTS = 7;

/**
 * The particles for a cat in the look `style`, drawn at `sc` px per rig unit, that will take the given shapes (the
 * first one, at rest, is where they are laid out). `inset` is half a dot (rig units). Always the same for the same
 * arguments: the chance is seeded.
 */
export function swarm(shapes: Shape[], style: Style, sc: number, inset = 1 / sc, seed = 11): Swarm {
  const s = shapes[0];
  const rnd = mulberry32(seed);
  const K: number[] = [];
  const Pt: number[] = [];
  const A: number[] = [];
  const Bv: number[] = [];
  const Ed: number[] = [];
  const Co: number[] = [];
  const Sz: number[] = [];
  const Lv: number[] = [];
  const De: number[] = [];
  const total = Math.max(220, Math.round(style.count * Math.pow(sc / 6, 1.5)));
  const grow = cl(Math.sqrt(sc / 6), 0.65, 1.15);
  const [s0, s1, skew] = style.size;
  const add = (kind: number, part: number, a: number, b: number, edge: number, stray: boolean) => {
    const size = s0 + (s1 - s0) * Math.pow(rnd(), skew);
    const r = rnd();
    // The big ones are the bright ones; strays are dim.
    const level = stray ? 2 : size > s0 + 0.62 * (s1 - s0) || r < style.bright ? 0 : r < style.bright + style.mid ? 1 : 2;
    K.push(kind);
    Pt.push(part);
    A.push(a);
    Bv.push(b);
    Ed.push(edge);
    Sz.push(size * grow);
    Lv.push(level);
    Co.push(0);
    De.push(0);
  };
  // How much area each spot of the swept parts takes at most, over the poses she will take: the particles are laid out
  // for that, and each frame shows the share the spot needs now (a folded haunch, the outside of a bend, are wider than
  // at rest; laid out at rest they went bald). The inside of a bend needs less: there the share drops below one.
  const den = new Float32Array(6 * NA * NBI);
  const tmp = new Float32Array(6 * NA * NBI);
  for (const sh of shapes) {
    chains(sh);
    areaBins(tmp);
    for (let k = 0; k < den.length; k++) den[k] = Math.max(den[k], tmp[k]);
  }
  chains(s);
  areaBins(tmp);
  /** How much denser than at rest a spot is laid out (capped: past it, a spot is a little sparse at its widest). */
  const gain = tmp.map((r, k) => (den[k] <= 0 ? 1 : r <= 1e-6 ? GAIN : Math.min(GAIN, den[k] / r)));
  /** What each spot is laid out for (area per unit of a and b). */
  const laid = tmp.map((r, k) => r * gain[k]);
  const front = newShape();
  head(front, 0, 0, 0, 0, HEAD_K);
  outline(front.polys[0], 3);
  for (let j = 1; j < 3; j++) outline(s.polys[j], j);
  // Each part gets particles for its area and for its outline (so a thin leg is still drawn), the head more: the face carries the most.
  const areas: number[] = [];
  const shares: number[] = [];
  /** Per swept part: how many more particles it is laid out with than at rest, and the most any spot of it gains. */
  const more: number[] = [];
  const most: number[] = [];
  for (let p = 0; p < 6; p++) {
    let a = 0;
    for (let i = PF[p] + 1; i < PE[p]; i++) a += (VR[i] + VR[i - 1]) * (CUM[i] - CUM[i - 1]);
    areas.push(a);
    shares.push(a + 2.2 * CUM[PE[p] - 1]);
    let r = 0;
    let m = 0;
    let g = 1;
    for (let k = p * NA * NBI; k < (p + 1) * NA * NBI; k++) {
      r += tmp[k];
      m += tmp[k] * gain[k];
      g = Math.max(g, gain[k]);
    }
    more.push(r > 0 ? m / r : 1);
    most.push(g);
  }
  areas.push(area(front.polys[0]), area(s.polys[1]), area(s.polys[2]));
  shares.push(1.5 * areas[6] + 12, areas[7] + 6, areas[8] + 6);
  const sum = areas.reduce((x, y) => x + y, 0);
  const shareSum = shares.reduce((x, y) => x + y, 0);
  const density = (k: number) => 1 + (style.edge - 1) * cl((k - (1 - style.band)) / style.band);
  const mean = 1 + (style.edge - 1) * style.band * 0.5;
  for (let p = 0; p < 9; p++) {
    const even = Math.round((total * shares[p]) / shareSum);
    if (even < 1) continue;
    // Spacing for this part if it were even, and a grid to find neighbours by.
    const spacing = Math.sqrt((areas[p] * mean) / even);
    const swept = p < 6;
    const want = swept ? Math.round(even * more[p]) : even;
    const top = swept ? most[p] : 1;
    const cell = spacing / Math.sqrt(top);
    const grid = new Map<number, number[]>();
    const keyOf = (x: number, y: number) => Math.floor(x / cell) * 73856093 + Math.floor(y / cell);
    // Where each point of the line starts in the part's area, to pick a place along it in proportion to its width there.
    const cum: number[] = [0];
    if (swept) for (let i = PF[p] + 1; i < PE[p]; i++) cum.push(cum[cum.length - 1] + (VR[i] + VR[i - 1]) * (CUM[i] - CUM[i - 1]));
    let got = 0;
    let a = 0;
    let b = 0;
    let x = 0;
    let y = 0;
    /** A place on the part, by chance (in proportion to area): sets a, b, x, y. */
    const pick = () => {
      if (swept) {
        const v = rnd() * cum[cum.length - 1];
        let lo = 0;
        while (lo < cum.length - 2 && cum[lo + 1] < v) lo++;
        const i = PF[p] + lo;
        const i1 = Math.min(i + 1, PE[p] - 1);
        const u = (v - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
        a = lerp(CUM[i], CUM[i1], u) / (CUM[PE[p] - 1] || 1);
        b = rnd() * 2 - 1;
        const r = lerp(VR[i], VR[i1], u);
        x = lerp(VX[i], VX[i1], u) + NX[i] * b * r;
        y = lerp(VY[i], VY[i1], u) + NY[i] * b * r;
      } else {
        const j = p - SKULL;
        const slot = j ? j : 3;
        a = rnd() * 2 * Math.PI - Math.PI;
        b = Math.sqrt(rnd());
        const r = b * reach(slot, a);
        x = CEN[slot * 2] + Math.cos(a) * r;
        y = CEN[slot * 2 + 1] + Math.sin(a) * r;
        if (j) {
          // The ears are laid out in the head's own frame, like the skull, so they turn with it.
          const [, , hc, hs, , flip] = s.head;
          a = Math.atan2(Math.sin(a - Math.atan2(hs, hc)), Math.cos(a - Math.atan2(hs, hc)) * flip);
        }
      }
    };
    for (let tries = want * 60 * top; tries > 0 && got < want; tries--) {
      pick();
      const g = swept ? binAt(gain, p, a, b) : 1;
      const w = density(Math.abs(b)) * g;
      if (rnd() * style.edge * top > w) continue;
      const near = (spacing * style.even * 0.72) / Math.sqrt(w / mean);
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      let clash = false;
      for (let ix = gx - 2; ix <= gx + 2 && !clash; ix++) {
        for (let iy = gy - 2; iy <= gy + 2 && !clash; iy++) {
          const list = grid.get(ix * 73856093 + iy);
          if (!list) continue;
          for (let k = 0; k < list.length; k += 3) {
            if (Math.hypot(list[k] - x, list[k + 1] - y) < (near + list[k + 2]) / 2) {
              clash = true;
              break;
            }
          }
        }
      }
      if (clash) continue;
      const key = keyOf(x, y);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(x, y, near);
      got++;
      // A few in the outline's band step just outside it: strays.
      const stray = Math.abs(b) > 1 - style.band && rnd() < style.stray / style.band;
      if (stray) b = Math.sign(b) * (1.06 + 0.3 * rnd());
      add(swept ? SWEPT : POLAR, p, a, b, Math.abs(b) > 0.8 ? 1 : 0, stray);
      if (swept) De[De.length - 1] = binAt(laid, p, a, b);
      if (swept) Co[Co.length - 1] = coatOf(p, cl((a * CUM[PE[p] - 1] - CAP0[p]) / MIDL[p]), cl(b, -1, 1));
      // Under a veil the outline is lit a step brighter, so the form holds through the haze.
      if (style.veil && !stray && Math.abs(b) > 0.86) Lv[Lv.length - 1] = Math.min(Lv[Lv.length - 1], 1);
    }
  }
  for (const lat of [-1, 1]) {
    for (let j = 0; j < EYE_DOTS; j++) add(EYE_DOT, SKULL, (j / EYE_DOTS) * 2 * Math.PI, lat, 0, false);
    for (let j = 0; j < IRIS_DOTS; j++) add(EYE_DOT, SKULL, 10 + j, lat, 0, false);
  }
  const core = K.length;
  for (let i = core - 2 * (EYE_DOTS + IRIS_DOTS); i < core; i++) Sz[i] = Math.max(Sz[i], 1.5 * grow);
  // The veil: very faint specks, each riding on a particle of the coat a little way off it (rig units), so it costs next
  // to nothing to place. Round the outline half of them fall outside it: the edge frays. Not on the face (it stays clear).
  const Up: number[] = [];
  const spacing = Math.sqrt(sum / total);
  for (let v = Math.round(((style.veil ?? 0) * total) / style.count); v > 0; v--) {
    let i = 0;
    for (let k = 0; k < 8; k++) {
      i = Math.floor(rnd() * core);
      if (K[i] !== EYE_DOT && !(Pt[i] === SKULL && Bv[i] < 0.85)) break;
    }
    if (K[i] === EYE_DOT || (Pt[i] === SKULL && Bv[i] < 0.85)) continue;
    const r = spacing * (0.35 + (style.fray ?? 2) * Math.pow(rnd(), 1.6));
    const an = rnd() * 2 * Math.PI;
    K.push(VEIL);
    Pt.push(Pt[i]);
    A.push(Math.cos(an) * r);
    Bv.push(Math.sin(an) * r);
    Ed.push(0);
    Co.push(0);
    Sz.push((0.7 + 0.5 * rnd()) * grow);
    Lv.push(3);
    De.push(0);
    Up.push(i);
  }
  const n = K.length;
  return {
    n,
    kind: Uint8Array.from(K),
    part: Uint8Array.from(Pt),
    a: Float32Array.from(A),
    b: Float32Array.from(Bv),
    edge: Uint8Array.from(Ed),
    coat: Uint8Array.from(Co),
    size: Float32Array.from(Sz),
    level: Uint8Array.from(Lv),
    den: Float32Array.from(De),
    d: Math.sqrt(sum / total),
    inset,
    core,
    up: Int32Array.from(Up),
    x: new Float32Array(n),
    y: new Float32Array(n),
    tone: new Uint8Array(n),
    lit: new Uint8Array(n),
  };
}

// The face, in the head's own units: across (in profile, toward the nose) and up. Each mark is a stroke seen from the
// front and the same stroke in profile, eased between the two as the head turns: [front x0, y0, x1, y1, profile x0, y0,
// x1, y1, half width].
const MARKS = [
  // The forehead's M: three stripes up from between the eyes, the outer two leaning out; in profile they run back over the crown.
  0, 1.7, 0, 4.4, 3.1, 2.5, 1.3, 4.7, 0.3,
  -1.05, 1.6, -1.8, 4.0, 2.1, 2.3, 0.1, 4.6, 0.28,
  1.05, 1.6, 1.8, 4.0, 4.0, 2.0, 2.5, 4.1, 0.28,
  // The cheeks: a line back from the outer corner of each eye, and a shorter one under it.
  -3.2, -0.1, -5.2, -0.8, 1.9, 0.5, -1.7, -0.2, 0.28,
  3.2, -0.1, 5.2, -0.8, 1.9, 0.5, -1.7, -0.2, 0.28,
  -3.0, -1.3, -4.7, -2.2, 1.9, -0.6, -1.3, -1.5, 0.26,
  3.0, -1.3, 4.7, -2.2, 1.9, -0.6, -1.3, -1.5, 0.26,
];

const MK = new Float32Array((MARKS.length / 9) * 5);
let MK_SIDE = NaN;

/** Distance from (x, y) to the segment (ax, ay)-(bx, by). */
function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const u = cl(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1));
  const dx = x - ax - vx * u;
  const dy = y - ay - vy * u;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Whether (x, y) is inside the ellipse at (cx, cy) with radii (rx, ry). */
const inOval = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

/** A shut eye: the curve of the lower lid (eye radii). */
const shutLid = (u: number) => -0.12 - 0.42 * Math.sqrt(Math.max(0, 1 - u * u));
/** The upper lid, `e` open (eased): from the shut curve up to an almond's top. */
const upperLid = (u: number, e: number) => lerp(shutLid(u), 0.62 * Math.pow(Math.max(0, 1 - u * u), 0.75) - 0.08, e);
const ease = (x: number) => x * x * (3 - 2 * x);
const EYE_OUT: [number, number, number, number] = [0, 0, 0, 0];

/**
 * Her eyes are lines, the way she looks up from a blanket: open, a dark upper lid with a sliver of green under it; shut,
 * a short pale curve. Where eye dot `a` sits in the eye's own frame (u across, v up, in eye radii), its tone and
 * brightness, for eyes `open` (0..1); null when it is not drawn. `a` < 7 is a lid dot (an angle round the eye: its place
 * along the lid), `a` >= 10 an iris dot.
 */
function eyeDot(a: number, open: number): [number, number, number, number] | null {
  const e = ease(open);
  const o = EYE_OUT;
  if (a < 10) {
    const k = Math.round((a / (2 * Math.PI)) * EYE_DOTS);
    const u = (-0.95 + (1.9 * k) / (EYE_DOTS - 1)) * (e < 0.25 ? 0.85 : 1);
    o[0] = u;
    o[1] = upperLid(u, e);
    o[2] = e < 0.25 ? CREAM_DIM : DEEP;
    o[3] = 0;
    return o;
  }
  if (e < 0.25) return null;
  const k = a - 10;
  const u = -0.62 + (1.24 * k) / (IRIS_DOTS - 1);
  o[0] = u;
  o[1] = lerp(shutLid(u), upperLid(u, e), 0.45);
  o[2] = EYE;
  o[3] = k === 3 ? 0 : 1;
  return o;
}

/** Whether a point of the face (eye radii from the eye's centre) is the eye's own gap, round the lid: there the coat is not drawn. */
function eyeGap(eu: number, ev: number, open: number) {
  if (Math.abs(eu) > 1.12) return false;
  const e = ease(open);
  const m = e < 0.25 ? 0.4 : 0.2;
  return ev > shutLid(eu) - m && ev < upperLid(eu, e) + m;
}

/**
 * The tone of the skull at (x, y) (rig units), for eyes `open` (0..1), or HIDDEN where the face is a gap: round an
 * eye's lid, an open mouth. The nose is dark; around it pale whisker pads and a paler chin, the M on the forehead and
 * the lines on the cheeks (dim: a dark mark reads by being dim), a ginger face under a darker crown.
 */
function face(s: Shape, x: number, y: number, open: number) {
  const E = s.eyes;
  for (let e = 0; e < E.length; e += 6) {
    const dx = x - E[e];
    const dy = y - E[e + 1];
    // Far from the eye (most of the face): nothing to work out.
    const far = 1.15 * Math.max(E[e + 2], E[e + 3]);
    if (dx * dx + dy * dy > far * far) continue;
    const c = Math.cos(E[e + 4]);
    const sn = Math.sin(E[e + 4]);
    const eu = (dx * c + dy * sn) / E[e + 2];
    const ev = (-dx * sn + dy * c) / E[e + 3];
    if (eyeGap(eu, ev, open)) return HIDDEN;
  }
  const [hx, hy, c, sn, k, flip, side, mouth] = s.head;
  const dx = (x - hx) / k;
  const dy = (y - hy) / k;
  const lx = (dx * c + dy * sn) * flip;
  const ly = -dx * sn + dy * c;
  const L = (a: number, b: number) => a + (b - a) * side;
  const ny = L(-0.75, -0.1);
  // The nose: a small dark triangle, point down.
  if (inOval(lx, ly, L(0, 6.0), ny, L(1.05, 0.55), L(0.75, 0.5)) && ly < ny + 0.35 && Math.abs(lx - L(0, 6.0)) < 1.05 + (ly - ny) * 1.3) return DEEP;
  if (mouth > 0.05) {
    if (side < 0.5) {
      const cy = -2.1 - 0.85 * mouth;
      const rx = 0.45 + 0.95 * mouth;
      const ry = 0.25 + 1.05 * mouth;
      if (inOval(lx, ly, 0, cy, rx, ry)) {
        if (ly > cy + 0.45 * ry && Math.abs(Math.abs(lx) - 0.6 * rx) < 0.3) return CREAM;
        return ly < cy - 0.45 * ry ? GINGER : HIDDEN;
      }
    } else {
      // In profile: the wedge between the upper jaw and the dropped lower jaw.
      const up = -1.05 + (lx + 0.9) * 0.06;
      const down = -1.5 - (lx + 0.9) * Math.tan(0.55 * mouth);
      if (lx > 0.4 && lx < 5.8 && ly < up && ly > down + 0.35) return ly < down + 0.9 ? GINGER : HIDDEN;
    }
  } else if (side < 0.5 ? Math.abs(lx) < 0.17 && ly < -1.3 && ly > -2.05 : toSegment(lx, ly, 5.6, -1.75, 3.9, -2.15) < 0.17) {
    return STRIPE;
  }
  // The muzzle: two pale whisker pads either side under the nose (one in profile), a paler chin under them.
  // (pale toward their lower edge, softer toward the nose, so they never read as a mask).
  if (inOval(lx, ly, L(-0.95, 4.7), L(-2.2, -1.6), L(1.15, 1.5), L(0.85, 1.0)) || inOval(lx, ly, L(0.95, 4.7), L(-2.2, -1.6), L(1.15, 1.5), L(0.85, 1.0))) return ly < L(-2.15, -1.6) ? CREAM : CREAM_DIM;
  if (ly < L(-3.2, -2.8) && Math.abs(lx - L(0, 4)) < L(1.7, 3)) return CREAM_DIM;
  if (MK_SIDE !== side) {
    // The marks for this turn of the head, worked out once per frame.
    MK_SIDE = side;
    for (let m = 0, o = 0; m < MARKS.length; m += 9, o += 5) MK.set([L(MARKS[m], MARKS[m + 4]), L(MARKS[m + 1], MARKS[m + 5]), L(MARKS[m + 2], MARKS[m + 6]), L(MARKS[m + 3], MARKS[m + 7]), MARKS[m + 8]], o);
  }
  for (let o = 0; o < MK.length; o += 5) if (toSegment(lx, ly, MK[o], MK[o + 1], MK[o + 2], MK[o + 3]) < MK[o + 4]) return STRIPE;
  return ly > 2.7 ? COAT : GINGER;
}

/** Below this, a place off the middle line has folded over itself on the inside of a bend, and is left out. */
const FOLD = 0.08;

/**
 * Places the particles on this shape (its field `f`): rig (0, 0) lands on (ox, gy), `sc` px per rig unit.
 * `open` (0..1) closes the eyes further than the pose has them. Writes each particle's position, tone (HIDDEN when a
 * part in front covers it) and brightness.
 */
export function place(w: Swarm, s: Shape, f: Field, ox: number, gy: number, sc: number, open = 1) {
  const { d, inset } = w;
  chains(s);
  for (let j = 0; j < 3; j++) outline(s.polys[j], j);
  const eyes = cl(s.open * open);
  const [, , hc, hs, , flip, side] = s.head;
  const turn = Math.atan2(hs, hc);
  // The far ear is a step dimmer in profile, the same as the near one from the front.
  const farDim = side > 0.5;
  // Looking back, the head is drawn mirrored, and each ear takes the other ear's particles.
  const back = s.yaw < 0;
  const front = s.tailFront > 0.5;
  const E = s.eyes;
  for (let i = 0; i < w.core; i++) {
    const p = w.part[i];
    const kind = w.kind[i];
    const a = w.a[i];
    const b = w.b[i];
    let x = 0;
    let y = 0;
    let ok = true;
    let tone = w.coat[i];
    let lit = w.level[i];
    if (kind === SWEPT) {
      const from = PF[p];
      const end = PE[p];
      const q = seek(CUM, from, end, a * CUM[end - 1]);
      const q1 = Math.min(q + 1, end - 1);
      const u = segU;
      const r0 = lerp(VR[q], VR[q1], u);
      const r = Math.max(0, r0 - inset);
      const off = b * r;
      x = lerp(VX[q], VX[q1], u) + lerp(NX[q], NX[q1], u) * off;
      y = lerp(VY[q], VY[q1], u) + lerp(NY[q], NY[q1], u) * off;
      // The particles are laid out for the most area this spot takes in any pose; it shows the share it needs now. On the
      // inside of a bend the places bunch up (`squeeze` below one) and fewer show; where it folds over itself, none.
      const squeeze = 1 + lerp(KAP[q], KAP[q1], u) * b * r0;
      ok = squeeze > FOLD && frac(i * 0.7548777) * w.den[i] < CUM[end - 1] * r0 * squeeze;
      // How deep inside its own part it is meant to be (rig units, negative inside).
      const want = Math.abs(off) - r - inset;
      // What is in front: the body before the legs and the tail, the near legs before the far ones and the tail, the
      // skull before the body. A tail wrapped toward the camera lies over the body and the legs instead.
      if (p === TAIL_I && front) {
        if (ok && within(0, x, y, 0)) ok = false;
      } else {
        if (ok && p !== BODY_I && sample(f, f.body, x, y) < -0.6 * d) ok = false;
        if (ok && (p < 2 || p === TAIL_I) && sample(f, f.near, x, y) < 0.4 * d) ok = false;
        if (ok && front && sample(f, f.tail, x, y) < 0.3 * d) ok = false;
      }
      // Inside the skull the face is drawn; on its rim, where the skull's own dots give way to the neck, the body's carry on.
      if (ok && p === BODY_I && inside(0, x, y, side > 0.35 ? 0.8 : 1)) ok = false;
      // Where a part lies over itself (a folded leg: the thigh over the shank), one layer shows: the one the spot is deepest in.
      const own = p === BODY_I ? f.body : p < 2 ? f.far : p < 4 ? f.near : null;
      // (Not the neck near the skull: there the deeper layer runs under the face, which hides it.)
      if (ok && own && sample(f, own, x, y) < want - 1.5 * d - (lerp(RM[q], RM[q1], u) - r0) && !(p === BODY_I && inside(0, x, y, 1.3))) ok = false;
      // A near leg's outline across the body: those dots brighten, the way the reference's inner contours do.
      if (ok && p === BODY_I && lit < 3 && Math.abs(sample(f, f.near, x, y)) < 0.45 * d) lit = 0;
      if (p < 2) tone = DIMMER[tone];
      // A dark mark reads on the dark ground by being dim: its dots step down.
      if (tone === STRIPE || tone === DEEP) lit = Math.max(lit, 2);
    } else if (kind === POLAR) {
      const j = back && p !== SKULL ? EAR_FAR + EAR_NEAR - p - SKULL : p - SKULL;
      // At its angle in the head's frame (mirrored looking back, turned with the head), a fraction of the way to the outline.
      const wa = Math.atan2(Math.sin(a), Math.cos(a) * flip) + turn;
      const r = b * reach(j, wa);
      x = CEN[j * 2] + Math.cos(wa) * r;
      y = CEN[j * 2 + 1] + Math.sin(wa) * r;
      if (p === SKULL) {
        // In profile the back of the skull runs into the neck: there the body's particles carry on. From the front the
        // head is in front of the neck, and its whole outline shows.
        if (b > 0.8 && side > 0.35 && Math.cos(a) < 0.2 && sample(f, f.body, x, y) < -0.6 * d) ok = false;
        tone = face(s, x, y, eyes);
        if (tone === HIDDEN) ok = false;
        if (tone === STRIPE || tone === DEEP) lit = Math.max(lit, 2);
      } else {
        if (within(0, x, y, 0.3 * d)) ok = false;
        if (ok && j === 2 && within(1, x, y, 0.3 * d)) ok = false;
        // Its rim in the coat; inside, pale from the front and the coat's back of the ear in profile.
        tone = b > 0.75 ? COAT : side < 0.6 ? CREAM_DIM : SHADE;
        if (j === 2 && farDim) tone = DIMMER[tone];
      }
    } else {
      // An eye's ring: on the eye on that side of the face, if it shows.
      ok = false;
      const dot = eyeDot(a, eyes);
      for (let e = 0; e < E.length && dot; e += 6) {
        if (E[e + 5] !== b) continue;
        const ex = dot[0] * E[e + 2];
        const ey = dot[1] * E[e + 3];
        const c = Math.cos(E[e + 4]);
        const sn = Math.sin(E[e + 4]);
        x = E[e] + ex * c - ey * sn;
        y = E[e + 1] + ex * sn + ey * c;
        ok = E[e + 2] > 0.35;
        tone = dot[2];
        lit = dot[3];
      }
    }
    w.x[i] = ox + x * sc;
    w.y[i] = gy - y * sc;
    w.tone[i] = ok ? tone : HIDDEN;
    w.lit[i] = lit;
  }
  // The veil follows the particles it rides on, and shows where they do.
  for (let i = w.core; i < w.n; i++) {
    const j = w.up[i - w.core];
    w.x[i] = w.x[j] + w.a[i] * sc;
    w.y[i] = w.y[j] - w.b[i] * sc;
    w.tone[i] = w.tone[j];
    w.lit[i] = 3;
  }
}
