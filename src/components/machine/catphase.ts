// The cat phase of ACQUIRE, one function per variant: given the frame the cat
// lives in, it places the cat's particles at timeline time t (seconds; the phase
// runs from CAT_AT to the variant's `morph`). Every variant opens the way the
// boot does: a quiet panel of dots (the Machine's grid), then dots of that grid
// light up and travel to their places on the cat, then the cat moves. scene.ts
// plays it inside the intro and then sends the same particles to the handle;
// /lab/ loops it in a gallery. Pure functions of time, like everything else the
// Machine draws.
import { E, FAINT, P, RED, TAU, cl, hash, lerp, rgb } from './draw';
import { catSwarm, eyesOpen, placeCat, tailSwing } from './cat';
import { HIDDEN, POUNCE, newPose, newShape, pouncePose, sitPose, skin, walkPose, type Pose, type Shape, type Swarm } from './catrig';

/** What the particles are before they resolve into the handle. `?intro=<name>` picks one. */
export const INTROS = ['sit', 'walk', 'silhouette', 'pounce'] as const;
export type IntroName = (typeof INTROS)[number];
/** The one that plays when nothing is asked for. */
export const DEFAULT_INTRO: IntroName = 'sit';
export const introName = (s: string | null | undefined): IntroName => (INTROS as readonly string[]).includes(s ?? '') ? (s as IntroName) : DEFAULT_INTRO;
/**
 * Per variant, in timeline seconds: `form`, how long the cat takes to materialise out of the panel of dots (the home
 * gives it FORM_HOME seconds; 0 when the variant's own motion does it); `morph`, when the cat starts resolving into the
 * handle; `extra`, home seconds its motion gets beyond the pace of the rest of the cut.
 */
export const VARIANT: Record<IntroName, { form: number; morph: number; extra: number }> = {
  sit: { form: 0.6, morph: 8.6, extra: 0 },
  walk: { form: 0.55, morph: 8.8, extra: 1.05 },
  silhouette: { form: 0, morph: 8.6, extra: 0.3 },
  pounce: { form: 0.35, morph: 8.63, extra: 0.72 },
};
/** Home seconds the cat takes to materialise. */
export const FORM_HOME = 1;
/** Timeline second the cat phase starts (ACQUIRE). */
export const CAT_AT = 6.5;
/** The home plays the intro cut tighter (4/3 speed); the cat phase gets its own pace. */
export const CUT_RATE = 4 / 3;
/** Timeline seconds of signal tear after a hard cut (scene.ts); the cut into ACQUIRE plays it at the cut's pace, before the cat. */
export const TEAR = 0.16;

/** Piecewise linear through the knots (x, y), held flat past the last one. */
export function along(k: number[][], x: number) {
  for (let i = 1; i < k.length; i++) if (x <= k[i][0]) return lerp(k[i - 1][1], k[i][1], P(x, k[i - 1][0], k[i][0]));
  return k[k.length - 1][1];
}
/** A variant's cat phase in the home's time: knots (home seconds since it started, timeline seconds). */
export function catCut(name: IntroName): number[][] {
  const { form, morph, extra } = VARIANT[name];
  const k = [[0, CAT_AT]];
  let f = 0;
  if (form) {
    k.push([TEAR / CUT_RATE, CAT_AT + TEAR]);
    f = TEAR / CUT_RATE + FORM_HOME;
    k.push([f, CAT_AT + form]);
  }
  k.push([f + (morph - CAT_AT - form) / CUT_RATE + extra, morph]);
  return k;
}
/** Seconds a variant adds to the home cut, against a cat phase played at the cut's pace. */
export const addedTime = (name: IntroName) => {
  const [home, t] = catCut(name).at(-1)!;
  return home - (t - CAT_AT) / CUT_RATE;
};

/** The frame the cat lives in (CSS px): its centre and size. `wide` is the desktop layout. */
export interface CatBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  wide: boolean;
}

export interface CatPhase {
  /** The cat's particles at time t: where they are (CSS px) and their tones. */
  frame: (t: number) => Swarm;
  /** Drawn under / over the particles. `a` goes to 0 as the particles leave for the handle. */
  under?: (o: CanvasRenderingContext2D, t: number, a: number) => void;
  over?: (o: CanvasRenderingContext2D, t: number, a: number) => void;
}

const pose = newPose();
const shape = newShape();

/** A cat of particles posed by `at` (which returns how open its eyes are); `times` cover every pose it will take. */
function dotCat(sc: number, ox: number, gy: number, at: (p: Pose, t: number) => number, times: number[]) {
  const shapes = times.map((t): Shape => {
    const s = newShape();
    at(pose, t);
    skin(pose, s);
    return s;
  });
  const w = catSwarm(shapes, sc);
  return (t: number) => {
    const open = at(pose, t);
    skin(pose, shape);
    placeCat(w, shape, ox, gy, sc, open);
    return w;
  };
}

/** Pitch of the Machine's dot grid (scene.ts paints it; a dot sits at 14 + 28k in both directions). */
const GRID = 28;

/** Where each particle waits on the panel of dots, and when (timeline seconds) it leaves for its place and how long it travels. */
interface Arrival {
  nx: Float32Array;
  ny: Float32Array;
  go: Float32Array;
  fly: Float32Array;
}

/** `w` holds the formed cat; `when` gives each particle its departure and travel time. Each one waits on a grid dot near its place. */
function arrival(w: Swarm, when: (i: number) => number[]): Arrival {
  const a = { nx: new Float32Array(w.n), ny: new Float32Array(w.n), go: new Float32Array(w.n), fly: new Float32Array(w.n) };
  for (let i = 0; i < w.n; i++) {
    const node = (v: number, seed: number) => 14 + GRID * Math.round((v + (hash(i * 2 + seed) - 0.5) * 2.6 * GRID - 14) / GRID);
    a.nx[i] = node(w.x[i], 0);
    a.ny[i] = node(w.y[i], 1);
    [a.go[i], a.fly[i]] = when(i);
  }
  return a;
}

/** Materialising: a particle not yet gone is not drawn (its grid dot is the panel's), lights up on its dot, then travels to its place. */
function materialise(w: Swarm, a: Arrival, t: number) {
  for (let i = 0; i < w.n; i++) {
    const tone = w.tone[i];
    if (tone === HIDDEN || t >= a.go[i] + a.fly[i]) continue;
    const k = (t - a.go[i]) / a.fly[i];
    if (k < -0.4) {
      w.tone[i] = HIDDEN;
      continue;
    }
    const e = E.inOutCubic(cl(k));
    w.x[i] = lerp(a.nx[i], w.x[i], e);
    w.y[i] = lerp(a.ny[i], w.y[i], e);
    w.tone[i] = k < 0 ? 2 : Math.round(lerp(3, tone, e));
  }
  return w;
}

/** The generic opening, after the cut's tear: a beat of the quiet panel, then the outline rises from the floor and the fill follows it up. */
function rising(w: Swarm, form: number, gy: number) {
  let top = gy;
  for (let i = 0; i < w.n; i++) if (w.tone[i] !== HIDDEN) top = Math.min(top, w.y[i]);
  const span = form - TEAR;
  return arrival(w, (i) => {
    const h = cl((gy - w.y[i]) / (gy - top || 1));
    return [CAT_AT + TEAR + span * ((w.edge[i] ? 0.22 + 0.3 * h : 0.3 + 0.36 * h) + 0.03 * hash(i * 3 + 2)), span * 0.28];
  });
}

/** The sitting cat's place in the frame, as the sit and the silhouette draw it. */
function seat(box: CatBox) {
  const size = Math.min(box.h * 0.94, box.w * 0.7);
  return { sc: size / 52, ox: box.cx - size / 2 + size * 0.648, gy: box.cy - size / 2 + size * 0.97 };
}

/** sit: it materialises sitting, looks back over its shoulder, flicks its tail and blinks while it is scanned. */
function sit(box: CatBox): CatPhase {
  const { sc, ox, gy } = seat(box);
  const { form } = VARIANT.sit;
  const cat = dotCat(sc, ox, gy, (p, t) => {
    sitPose(p, tailSwing(t - 7.25) * P(t, 7.1, 7.4), 1 - 2 * E.inOutCubic(P(t, 7.4, 7.75)));
    return eyesOpen(t - 5.12);
  }, [6.5, 7.55, 7.75, 7.9, 8.3]);
  const a = rising(cat(CAT_AT + form), form, gy);
  return { frame: (t) => materialise(cat(t), a, t) };
}

/** silhouette: its outline is traced dot by dot, and the first pass of the scan line fills it in. */
function silhouette(box: CatBox): CatPhase {
  const { sc, ox, gy } = seat(box);
  const cat = dotCat(sc, ox, gy, (p, t) => {
    sitPose(p, t < 8 ? 0 : tailSwing(t - 7.55) * 0.5);
    return eyesOpen(t - 5.12);
  }, [6.5, 8.2, 8.5]);
  const w = cat(CAT_AT);
  const top = box.cy - box.h / 2;
  // The outline clockwise from the top, as the trace goes round; the fill as the scan line (scene.ts, 7 to 8) passes.
  const a = arrival(w, (i) =>
    w.edge[i] ? [6.6 + 0.55 * ((Math.atan2(w.x[i] - box.cx, box.cy - w.y[i]) / TAU + 1) % 1), 0.12] : [6.93 + cl((w.y[i] - top) / box.h), 0.07],
  );
  return { frame: (t) => materialise(cat(t), a, t) };
}

/** The ground the side-on cat stands on: a measuring line with a tick every ten rig units. */
function ground(o: CanvasRenderingContext2D, box: CatBox, a: number, ox: number, gy: number, sc: number) {
  const left = box.cx - box.w / 2;
  o.fillStyle = rgb(FAINT, a);
  o.fillRect(left + 10, gy, box.w - 20, 1);
  for (let x = (((ox - left) % (10 * sc)) + 10 * sc) % (10 * sc); x < box.w - 10; x += 10 * sc) if (x > 10) o.fillRect(left + x, gy, 1, 5);
}

/** How far a shape reaches left and right (rig units). */
function span(s: Shape) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < s.discs.length; i += 3) {
    lo = Math.min(lo, s.discs[i] - s.discs[i + 2]);
    hi = Math.max(hi, s.discs[i] + s.discs[i + 2]);
  }
  for (const q of s.polys) for (let i = 0; i < q.length; i += 2) [lo, hi] = [Math.min(lo, q[i]), Math.max(hi, q[i])];
  return [lo, hi];
}

/** walk: it materialises mid-stride, walks on, stops, sits down and looks back over its shoulder. */
function walk(box: CatBox): CatPhase {
  const { form, morph } = VARIANT.walk;
  const formed = CAT_AT + form;
  // Walk seconds already behind it when it materialises; a narrow frame has less room, so it is further in.
  const from = box.wide ? form : 0.8;
  const end = morph - CAT_AT;
  // It sets off from still: the walk's clock eases in, then catches up, and it sits on time.
  const clock = (t: number) => {
    const u = P(t, formed, morph);
    const r = 0.1;
    return from + ((end - from) * (u < r ? (u * u) / (2 * r) : u - r / 2)) / (1 - r / 2);
  };
  const at = (p: Pose, t: number) => {
    walkPose(p, clock(t));
    return eyesOpen(t - 5.44);
  };
  // Fit the whole walk, from where it materialises to where it sits, in the frame.
  const times = [6.5, 7.3, 7.6, 7.9, 8.2, 8.5, 8.8];
  let lo = Infinity;
  let hi = -Infinity;
  for (const t of times) {
    at(pose, t);
    skin(pose, shape);
    const [a, b] = span(shape);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  const sc = Math.min((box.h * 0.84) / 60, (box.w - 24) / (hi - lo));
  const ox = box.cx - ((lo + hi) / 2) * sc;
  const gy = box.cy + box.h * 0.42;
  const cat = dotCat(sc, ox, gy, at, times);
  const a = rising(cat(formed), form, gy);
  return {
    frame: (t) => materialise(cat(t), a, t),
    under: (o, t, k) => ground(o, box, k * P(t, 6.5, 6.75), ox, gy, sc),
  };
}

/** pounce: it materialises crouched, watches the red marker dart about, wiggles, and jumps on it; the landing is the handle. */
function pounce(box: CatBox): CatPhase {
  const { wide } = box;
  const { form } = VARIANT.pounce;
  const formed = CAT_AT + form;
  // A narrow frame starts it closer to the marker (a shorter leap), so the whole cat, tail and all, stays in it.
  const from = wide ? POUNCE.from : -24;
  const sc = Math.min((box.h * 0.8) / 52, box.w / (wide ? 112 : 110));
  const ox = box.cx + (wide ? 22 : 20) * sc;
  const gy = box.cy + box.h * 0.42;
  // The marker's stops (seconds, rig x, rig y): it ends where the forepaws will land.
  const stops = [
    [0.15, 30, 12],
    [0.5, 14, 5],
    [0.82, 34, 17],
    [1.08, 18, 9],
    [1.3, POUNCE.to + 17, 1.6],
  ];
  const dot = (tl: number) => {
    let x = stops[0][1];
    let y = stops[0][2];
    for (let i = 1; i < stops.length; i++) {
      const k = E.inOutCubic(P(tl, stops[i][0] - 0.16, stops[i][0]));
      x = lerp(x, stops[i][1], k);
      y = lerp(y, stops[i][2], k);
    }
    return [x, y];
  };
  // Pounce time: it materialises already crouched (the crouch is over by `form`), and holds still until it is whole.
  const clock = (t: number) => Math.max(t, formed) - CAT_AT;
  const cat = dotCat(sc, ox, gy, (p, t) => {
    const tl = clock(t);
    const [x, y] = dot(tl);
    pouncePose(p, tl, x, y, from);
    return 1;
  }, [formed, 7.3, 7.9, 8.05, 8.15, 8.25, 8.35, 8.45, 8.55, 8.63]);
  const a = rising(cat(formed), form, gy);
  return {
    frame: (t) => materialise(cat(t), a, t),
    under: (o, t, k) => ground(o, box, k * P(t, 6.5, 6.75), ox, gy, sc),
    over(o, t, k) {
      const tl = clock(t);
      const [x, y] = dot(tl);
      const px = ox + x * sc;
      const py = gy - y * sc;
      // The marker: the same red square the sweep put on the subject. It shows up as the cat is made.
      const on = k * P(t, CAT_AT + 0.7 * form, formed) * (1 - P(tl, POUNCE.land - 0.03, POUNCE.land));
      if (on > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(tl * 22);
        o.fillStyle = rgb(RED, 0.18 * on);
        o.beginPath();
        o.arc(px, py, 9 + 3 * pulse, 0, TAU);
        o.fill();
        o.fillStyle = rgb(RED, on);
        o.fillRect(px - 2.5, py - 2.5, 5, 5);
      }
      const hit = P(tl, POUNCE.land - 0.03, POUNCE.land + 0.4);
      if (hit > 0 && hit < 1) {
        o.strokeStyle = rgb(RED, 0.7 * (1 - hit));
        o.lineWidth = 1.5;
        o.beginPath();
        o.arc(px, py, 6 + E.outExpo(hit) * 90, 0, TAU);
        o.stroke();
      }
    },
  };
}

/** The cat phase of a variant, laid out in `box`. */
export function catPhase(name: IntroName, box: CatBox): CatPhase {
  switch (name) {
    case 'sit':
      return sit(box);
    case 'walk':
      return walk(box);
    case 'silhouette':
      return silhouette(box);
    case 'pounce':
      return pounce(box);
  }
}
