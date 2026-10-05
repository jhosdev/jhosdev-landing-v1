// The cat's repertoire, beyond the walk and the pounce: named poses, each a
// function of time for the small motions that never stop (breathing, the tail,
// the ears, the blinks), and timelines that ease from one pose to the next.
// The head leads a move and the tail follows it; a foot that has somewhere else
// to be lifts and takes a step, it never slides. Pure maths, no DOM.

import { E, P, cl, lerp } from './draw';
import { HIND, POUNCE, SIT, STRIDE, TAIL, TAIL_LOW, TAIL_SAT, TAIL_UP, newPose, pouncePose, sitPose, walkFoot, type Pose } from './catrig';

/** A pose at time t (seconds): writes every field of the pose. */
export type PoseFn = (p: Pose, t: number) => void;
/** A timeline: holds (from, to, pose, x offset), in order. Between two holds the pose eases from one to the next. */
export type Keys = readonly (readonly [number, number, PoseFn, number?])[];

const bump = (x: number, at: number, width: number) => Math.exp(-(((x - at) / width) ** 2));
const wave = (t: number, period: number) => Math.sin((2 * Math.PI * t) / period);
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Eyes: a blink every few seconds (the period divides 20, the about loop). */
const blink = (t: number) => 1 - bump(((t % 5) + 5) % 5, 3.6, 0.07);
/** A slow blink, the one a cat gives someone it trusts: the eyes close, stay closed a moment, and open slowly. */
export const slowBlink = (t: number, at: number) => 1 - smooth(P(t, at, at + 0.35)) * (1 - smooth(P(t, at + 0.75, at + 1.35)));

function base(p: Pose) {
  p.bend = 0;
  p.headA = 0;
  p.yaw = 1;
  p.earA = 0;
  p.earB = 0;
  p.open = 1;
  p.roll = 0;
  p.mouth = 0;
  p.tailFront = 0;
  p.blades = 0;
}
/** Feet in order far hind, far fore, near hind, near fore; all on the ground, hocks and pasterns at these angles. */
function feet(p: Pose, xs: readonly number[], hock: number, pastern = 0.87) {
  for (let leg = 0; leg < 4; leg++) {
    p.feet[leg * 4] = xs[leg];
    p.feet[leg * 4 + 1] = 0;
    p.feet[leg * 4 + 2] = HIND[leg] ? hock : pastern;
    p.feet[leg * 4 + 3] = 0;
  }
}
/** The tail's segments (directions, root to tip), bent at the tip by `swing`. */
function tail(p: Pose, k: readonly number[], swing = 0) {
  for (let i = 0; i < TAIL; i++) p.tail[i] = k[i] - swing * Math.pow((i + 1) / TAIL, 1.5);
}

// Tails: wrapped round the front along the floor (lying, and sitting), and held high (standing, stretching).
const TAIL_WRAP = [-1.8, -1.2, -0.42, -0.05, 0, 0.08, 0.4];
const TAIL_CURL = [-0.8, -0.15, 0, 0.02, 0.15, 0.6, 1.3];
const TAIL_HIGH = [2.45, 2.2, 2.05, 2.05, 2.25, 2.6, 3.0];

/** Lying in a loaf: forepaws out in front, hind legs folded under, the tail wrapped round toward you, the head up, facing you. */
export const loaf: PoseFn = (p, t) => {
  base(p);
  const b = wave(t, 4);
  p.hx = -13;
  p.hy = 8.5 + 0.15 * b;
  p.sx = 6;
  p.sy = 10.5 + 0.3 * b;
  p.bend = 2.6;
  feet(p, [-2, 18.5, -3, 17], 1.45);
  p.headX = 15;
  p.headY = 17 + 0.15 * b;
  p.yaw = 0;
  p.roll = 0.05;
  p.open = 0.8 * blink(t);
  tail(p, TAIL_WRAP, 0.12 * wave(t, 5));
  p.tailFront = 1;
};

/** Asleep: the loaf with the head down on the paws and tilted, eyes shut, breathing slowly; now and then an ear twitches (she is dreaming). */
export const sleep: PoseFn = (p, t) => {
  loaf(p, t);
  const b = wave(t, 4);
  p.sy = 10 + 0.45 * b;
  p.hy = 8.3 + 0.2 * b;
  p.headX = 16.5;
  p.headY = 10.5 + 0.25 * b;
  p.roll = 0.3;
  p.open = 0;
  const tw = ((t % 10) + 10) % 10;
  p.earB = 0.5 * bump(tw, 2.4, 0.06) + 0.35 * bump(tw, 2.62, 0.05);
  tail(p, TAIL_WRAP, 0.18 * bump(tw, 6.5, 0.25));
};

/** Awake but in no hurry: the loaf with heavy lids, the way she looks up from a blanket. */
export const drowsy: PoseFn = (p, t) => {
  loaf(p, t);
  p.headY = 15.5;
  p.roll = 0.12;
  p.open = 0.42 * blink(t);
};

/** A yawn: the head goes up, the mouth opens wide, the eyes screw shut and the ears go back. */
export const yawn: PoseFn = (p, t) => {
  loaf(p, t);
  p.headX = 15.5;
  p.headY = 19;
  p.roll = -0.04;
  p.open = 0;
  p.mouth = 1;
  p.earA = 0.4;
  p.earB = 0.4;
};

/** Standing, tail up. */
export const stand: PoseFn = (p, t) => {
  base(p);
  const b = wave(t, 4);
  p.hx = -12.5;
  p.hy = 25.5;
  p.sx = 12.5;
  p.sy = 25.5 + 0.25 * b;
  p.bend = 0.4;
  feet(p, [-11.5, 13, -13, 11.5], 0.35);
  p.headX = 24;
  p.headY = 31.5;
  p.headA = -0.08;
  p.open = blink(t);
  tail(p, TAIL_UP, 0.15 * wave(t, 2.5));
};

/** The front stretch: forepaws far out, chest down, rump up, the tail high and trembling, eyes squeezed. */
export const bow: PoseFn = (p, t) => {
  base(p);
  p.hx = -12;
  p.hy = 23;
  p.sx = 10;
  p.sy = 9.5;
  p.bend = -1.2;
  feet(p, [-10, 27, -11, 25.5], 0.45, 1.05);
  p.headX = 21;
  p.headY = 15.5;
  p.headA = 0.3;
  p.open = 0.2;
  tail(p, TAIL_HIGH, 0.06 * Math.sin(t * 30));
};

/** Sitting with the tail wrapped round the front paws; `yaw` turns the head (-1 looks back over the shoulder). */
const sitWrapped = (yaw: number): PoseFn => (p, t) => {
  sitPose(p, 0, yaw);
  const b = wave(t, 4);
  p.sy = SIT.sy + 0.3 * b;
  p.headY = SIT.headY + 0.15 * b;
  p.open = blink(t);
  tail(p, TAIL_CURL, 0.15 * bump(((t % 5) + 5) % 5, 1.2, 0.2));
  p.tailFront = 1;
};
/** Sitting, looking back over her shoulder: from the about section's frame, at the file beside her. */
export const sitBack = sitWrapped(-1);
/** Sitting, looking at you. */
export const sitLook = sitWrapped(0);
/** Sitting, the tail behind her, the way the sitting cat has always sat (it flicks and sways). */
export const sitTail: PoseFn = (p, t) => {
  sitPose(p, 0.11 * wave(t, 4.8), -1);
  p.open = blink(t);
  for (let i = 0; i < TAIL; i++) p.tail[i] = TAIL_SAT[i] - 0.11 * wave(t, 4.8) * Math.pow((i + 1) / TAIL, 1.5);
};

/* ---------------------------------------------------------------- blending */

const A = newPose();
const B = newPose();
const H = newPose();
const T = newPose();
/** When each foot takes its step, as a fraction of the move (far hind, far fore, near hind, near fore). */
const STEP = [0.12, 0.3, 0, 0.2];
/** Seconds the head is ahead of the body, and the tail behind it. */
const LEAD = 0.1;
const LAG = 0.16;

function hold(p: Pose, k: Keys[number], t: number) {
  k[2](p, t);
  const dx = k[3] ?? 0;
  if (!dx) return;
  p.hx += dx;
  p.sx += dx;
  p.headX += dx;
  for (let leg = 0; leg < 4; leg++) p.feet[leg * 4] += dx;
}

/** Writes into p, as the timeline has it at time t (wrapped into `loop` seconds, when it loops). */
function at(p: Pose, keys: Keys, t: number, loop: number) {
  if (loop) t = ((t % loop) + loop) % loop;
  let i = 0;
  while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
  const k = keys[i];
  if (t <= k[1] || i === keys.length - 1) return hold(p, k, t);
  const n = keys[i + 1];
  hold(A, k, t);
  hold(B, n, t);
  const u = P(t, k[1], n[0]);
  mix(p, A, B, u);
}

const mixArr = (o: Float32Array, a: Float32Array, b: Float32Array, u: number) => {
  for (let i = 0; i < o.length; i++) o[i] = lerp(a[i], b[i], u);
};

/** p = a eased toward b by u (0..1); feet that move step, one after the other. */
export function mix(p: Pose, a: Pose, b: Pose, u: number) {
  const e = E.inOutCubic(u);
  p.hx = lerp(a.hx, b.hx, e);
  p.hy = lerp(a.hy, b.hy, e);
  p.sx = lerp(a.sx, b.sx, e);
  p.sy = lerp(a.sy, b.sy, e);
  p.bend = lerp(a.bend, b.bend, e);
  p.headX = lerp(a.headX, b.headX, e);
  p.headY = lerp(a.headY, b.headY, e);
  p.headA = lerp(a.headA, b.headA, e);
  p.yaw = lerp(a.yaw, b.yaw, e);
  p.roll = lerp(a.roll, b.roll, e);
  p.earA = lerp(a.earA, b.earA, e);
  p.earB = lerp(a.earB, b.earB, e);
  p.open = lerp(a.open, b.open, e);
  p.mouth = lerp(a.mouth, b.mouth, e);
  p.blades = lerp(a.blades, b.blades, e);
  p.tailFront = e < 0.5 ? a.tailFront : b.tailFront;
  mixArr(p.tail, a.tail, b.tail, e);
  for (let leg = 0; leg < 4; leg++) {
    const o = leg * 4;
    const dx = b.feet[o] - a.feet[o];
    const grounded = a.feet[o + 1] === 0 && b.feet[o + 1] === 0;
    // A planted foot that has to move lifts and steps; otherwise it follows the move.
    const f = grounded && Math.abs(dx) > 0.3 ? smooth(P(u, STEP[leg], STEP[leg] + 0.55)) : e;
    p.feet[o] = a.feet[o] + dx * f;
    p.feet[o + 1] = lerp(a.feet[o + 1], b.feet[o + 1], f) + (grounded ? Math.sin(Math.PI * f) * Math.min(4, 0.9 + 0.22 * Math.abs(dx)) : 0);
    p.feet[o + 2] = lerp(a.feet[o + 2], b.feet[o + 2], f);
    p.feet[o + 3] = lerp(a.feet[o + 3], b.feet[o + 3], f);
  }
}

/**
 * The timeline's pose at time t, with follow-through: the head is where the timeline will be a moment later, the tail
 * where it was a moment before. `loop` (seconds) wraps time, so the last hold flows into the first.
 */
export function keyed(p: Pose, keys: Keys, t: number, loop = 0) {
  at(p, keys, t, loop);
  at(H, keys, loop ? t + LEAD : Math.min(t + LEAD, keys[keys.length - 1][0]), loop);
  at(T, keys, Math.max(t - LAG, loop ? t - LAG : keys[0][0]), loop);
  p.headX = H.headX;
  p.headY = H.headY;
  p.headA = H.headA;
  p.yaw = H.yaw;
  p.roll = H.roll;
  p.tail.set(T.tail);
}

/** How long a timeline runs, from its first hold to the end of its last. */
export const length = (keys: Keys) => keys[keys.length - 1][1];

/* --------------------------------------------------------------- timelines */

/**
 * The about section's loop, 20 seconds: asleep in a loaf; she wakes, yawns, gets up into a long stretch, sits beside
 * the file and looks back at it, turns to you and gives you a slow blink, lies down again and goes back to sleep.
 */
export const ABOUT = 20;
export const ABOUT_KEYS: Keys = [
  [0, 4.6, sleep],
  [5.3, 6.0, drowsy],
  [6.3, 7.1, yawn],
  [7.5, 7.9, loaf],
  [8.8, 10.0, bow],
  [10.6, 10.9, stand],
  [11.8, 13.4, sitBack],
  [13.8, 16.1, (p, t) => {
    sitLook(p, t);
    p.open = Math.min(p.open, slowBlink(t, 14.6));
  }],
  [17.1, 17.6, loaf],
  [18.6, 20, sleep],
];
/** What she is doing, as the Machine logs it: from the second it starts, an index into the copy's list. */
export const ABOUT_LOG: readonly (readonly [number, number])[] = [
  [0, 0],
  [4.6, 1],
  [6.0, 2],
  [7.9, 3],
  [10.9, 4],
  [14.4, 5],
  [16.1, 6],
  [18.0, 0],
];

/** A yawn, sitting. */
const sitYawn: PoseFn = (p, t) => {
  sitLook(p, t);
  p.headY += 1.2;
  p.open = 0;
  p.mouth = 1;
  p.earA = 0.4;
  p.earB = 0.4;
};

/**
 * Summoned into the hero (the `luna` command), HERO seconds: she forms sitting, looking back over her shoulder; turns
 * to you, yawns, and gives you a slow blink; then she goes.
 */
export const HERO = 7.2;
export const HERO_KEYS: Keys = [
  [0, 1.9, sitBack],
  [2.25, 2.45, sitLook],
  [2.65, 3.2, sitYawn],
  [3.45, HERO, (p, t) => {
    sitLook(p, t);
    p.open = Math.min(p.open, slowBlink(t, 3.8));
  }],
];

/* ------------------------------------------------------------------ prowl */

/**
 * The prowl, in seconds since the cat phase starts (the home's own time, so it keeps a cat's pace): she walks on,
 * spots the marker and freezes with a forepaw raised, drops low and creeps, her shoulder blades working, settles
 * into the crouch, and from there it is the pounce (pouncePose, from `from` seconds into it): the wiggle, the leap,
 * the landing.
 */
export const PROWL = { spot: 1.2, freeze: 1.45, low: [1.7, 2.1], creep: 1.85, still: 2.6, crouched: 2.9, from: 0.62 } as const;
/** Where it plays (rig x): the crouch (the pounce's start), how far it walks before the freeze, how far it creeps. */
export interface ProwlGround {
  crouch: number;
  walk: number;
  creep: number;
}
/** The frame of the desktop (the walk ends with the near forepaw raised) and of a phone (shorter: the far one). */
export const PROWL_WIDE: ProwlGround = { crouch: -26, walk: STRIDE * 1.522, creep: 9 };
export const PROWL_NARROW: ProwlGround = { crouch: -20, walk: STRIDE * 1.022, creep: 7 };
/** Seconds of the pounce the prowl ends on: it settles there, and resolves into the handle. */
export const prowlEnd = () => PROWL.crouched + POUNCE.settled - PROWL.from;

/** Distance (fraction of a move) covered x of the way through an ease to a stop, and through an ease from still. */
const stopping = (x: number) => x - x ** 3 + x ** 4 / 2;
const starting = (x: number) => x ** 3 - x ** 4 / 2;
const ACCEL = 0.2;
const DECEL = 0.25;

/** How far she has walked by s: a steady walk easing to a stop at the freeze, still, then a slow creep to a stop. */
function prowlDistance(s: number, g: ProwlGround) {
  const { spot, freeze, creep, still } = PROWL;
  const v = g.walk / (spot + (freeze - spot) / 2);
  if (s < spot) return v * Math.max(0, s);
  if (s < freeze) return v * (spot + (freeze - spot) * stopping((s - spot) / (freeze - spot)));
  if (s < creep) return g.walk;
  const vs = g.creep / (still - creep - ACCEL / 2 - DECEL / 2);
  const t = Math.min(s, still) - creep;
  let d = vs * ACCEL * starting(Math.min(t, ACCEL) / ACCEL);
  if (t > ACCEL) d += vs * (Math.min(t, still - creep - DECEL) - ACCEL);
  if (t > still - creep - DECEL) d += vs * DECEL * stopping((t - (still - creep - DECEL)) / DECEL);
  return g.walk + d;
}

const PA = newPose();
const PB = newPose();

/** The walk and the stalk, before the crouch. */
function stalkPose(p: Pose, s: number, dotX: number, dotY: number, g: ProwlGround) {
  base(p);
  const { spot, freeze, low: lw } = PROWL;
  const d = prowlDistance(s, g);
  const x0 = g.crouch - g.walk - g.creep;
  const ph = d / STRIDE;
  const low = smooth(P(s, lw[0], lw[1]));
  // A paw in the air when she freezes stays there; creeping, she lifts each one a little less.
  for (let leg = 0; leg < 4; leg++) {
    walkFoot(d, leg, 1 - 0.25 * low, p.feet);
    p.feet[leg * 4] += x0;
  }
  // Each girdle rises over its planted leg and dips between steps; low, the shoulders work harder than the hips.
  const hipBob = 0.9 * Math.cos(4 * Math.PI * (ph - 0.31));
  const shBob = 0.9 * Math.cos(4 * Math.PI * (ph + 0.25 - 0.31));
  const c = d + x0;
  p.hy = lerp(26, 20.5, low) + hipBob * (1 - 0.5 * low);
  p.sy = lerp(26, 16, low) + shBob * (1 + 0.7 * low);
  const reach = Math.sqrt(12.5 * 12.5 - ((p.sy - p.hy) / 2) ** 2);
  p.hx = c - reach;
  p.sx = c + reach;
  p.bend = 0.6 * low;
  p.blades = low;
  // She spots it: the head comes up a touch and turns to it, the near ear flicks; low, the head is level with the back.
  const alert = smooth(P(s, freeze - 0.12, freeze + 0.12)) * (1 - low);
  p.headX = p.sx + lerp(11, 12, low) + 0.8 * alert;
  p.headY = lerp(32 + shBob * 0.35, p.sy + 3.5, low) + 1.4 * alert;
  const look = cl(Math.atan2(dotY - p.headY, dotX - p.headX), -0.45, 0.4) * 0.8;
  p.headA = lerp(-0.14 + 0.05 * Math.sin(4 * Math.PI * ph - 0.9), look, smooth(P(s, spot, freeze)));
  p.earB = 0.4 * bump(s, freeze - 0.02, 0.045);
  // The tail is carried up with a wave along it while she walks; stalking, it is held low and straight, the tip twitching.
  for (let i = 0; i < TAIL; i++) {
    const wave = (0.05 + 0.035 * i) * Math.sin(2 * Math.PI * ph - i * 0.75);
    const twitch = 0.07 * i * Math.sin(s * 9 - i * 0.6);
    p.tail[i] = lerp(TAIL_UP[i] + wave, TAIL_LOW[i] + twitch, low);
  }
}

/** The prowl at s; the marker is at (dotX, dotY). */
export function prowlPose(p: Pose, s: number, dotX: number, dotY: number, g: ProwlGround = PROWL_WIDE) {
  const { still, crouched, from } = PROWL;
  const tp = s - crouched + from;
  if (s >= crouched) return pouncePose(p, tp, dotX, dotY, g.crouch);
  if (s <= still - 0.05) return stalkPose(p, s, dotX, dotY, g);
  // Settling into the crouch: the feet step to their places, the rear comes up, the pounce takes over.
  stalkPose(PA, s, dotX, dotY, g);
  pouncePose(PB, Math.max(tp, POUNCE.crouch), dotX, dotY, g.crouch);
  mix(p, PA, PB, P(s, still - 0.05, crouched));
}
