// The cat phase of ACQUIRE, one function per variant: given the frame the cat
// lives in, it places the cat's particles at timeline time t (seconds; the phase
// runs from CAT_AT to the variant's `morph`). Every variant opens the way the
// boot does: a quiet panel of dots (the Machine's grid), then dots of that grid
// light up and travel to their places on the cat, and she is grey: the Machine
// sees a shape, brightness only. The first pass of the amber scan classifies
// her: behind the line her coat and her eyes come on. Then she does what she
// does, and scene.ts sends the same particles to the handle; /lab/ loops it in
// a gallery. Pure functions of time, like everything else the Machine draws.
import { E, FAINT, P, RED, TAU, cl, hash, lerp, rgb } from './draw';
import { LOOK, STYLES, catSwarm, placeCat } from './cat';
import { GREY, HIDDEN, POUNCE, newPose, newShape, pouncePose, skin, walkPose, type Pose, type Shape, type Style, type Swarm } from './catrig';
import { PROWL, PROWL_NARROW, PROWL_WIDE, bow, drowsy, keyed, loaf, prowlEnd, prowlPose, sleep, slowBlink, stand, yawn, type Keys } from './catkeys';

/** What the particles are before they resolve into the handle. `?intro=<name>` picks one. */
export const INTROS = ['prowl', 'nap', 'pounce', 'walk', 'stretch'] as const;
export type IntroName = (typeof INTROS)[number];
/** The one that plays when nothing is asked for. */
export const DEFAULT_INTRO: IntroName = 'prowl';
export const introName = (s: string | null | undefined): IntroName => (INTROS as readonly string[]).includes(s ?? '') ? (s as IntroName) : DEFAULT_INTRO;
/** Home seconds the cat takes to materialise. */
export const FORM_HOME = 1;
/** Timeline second the cat phase starts (ACQUIRE). */
export const CAT_AT = 6.5;
/** The home plays the intro cut tighter (4/3 speed); the cat phase gets its own pace. */
export const CUT_RATE = 4 / 3;
/** Timeline seconds of signal tear after a hard cut (scene.ts); the cut into ACQUIRE plays it at the cut's pace, before the cat. */
export const TEAR = 0.16;
/**
 * Per variant, in timeline seconds: `form`, how long the cat takes to materialise out of the panel of dots (the home
 * gives it FORM_HOME seconds); `morph`, when the cat starts resolving into the handle; `extra`, home seconds its motion
 * gets beyond the pace of the rest of the cut (a cat moves at a cat's pace).
 */
export const VARIANT: Record<IntroName, { form: number; morph: number; extra: number }> = {
  // The prowl runs on its own clock (home seconds); `extra` makes the cut end as she settles from the landing.
  prowl: { form: 0.55, morph: 9.1, extra: prowlEnd() + 0.03 - (TEAR / CUT_RATE + FORM_HOME) - (9.1 - CAT_AT - 0.55) / CUT_RATE },
  nap: { form: 0.6, morph: 9.0, extra: 0.48 },
  pounce: { form: 0.35, morph: 8.63, extra: 0.72 },
  walk: { form: 0.55, morph: 8.8, extra: 1.05 },
  stretch: { form: 0.6, morph: 9.1, extra: 0.6 },
};
/** The amber scan line's first pass down the frame (scene.ts draws it), in timeline seconds: it classifies her. */
export const SCAN = [7, 8] as const;

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
  /** The cat's particles at time t: where they are (CSS px), their tones and brightness. */
  frame: (t: number) => Swarm;
  /** Drawn under / over the particles. `a` goes to 0 as the particles leave for the handle. */
  under?: (o: CanvasRenderingContext2D, t: number, a: number) => void;
  over?: (o: CanvasRenderingContext2D, t: number, a: number) => void;
}

const pose = newPose();
const shape = newShape();

/** A cat of particles posed by `at` (returns how open the eyes are, on top of the pose); `times` cover every pose it takes. */
function dotCat(sc: number, ox: number, gy: number, at: (p: Pose, t: number) => number, times: number[], style: Style) {
  // Laid out standing, every part at full length; the poses it takes say how wide each part gets.
  const rest = newShape();
  stand(pose, 0);
  skin(pose, rest);
  const shapes = [rest, ...times.map((t): Shape => {
    const s = newShape();
    at(pose, t);
    skin(pose, s);
    return s;
  })];
  const w = catSwarm(shapes, sc, style);
  return (t: number) => {
    const open = at(pose, t);
    skin(pose, shape);
    placeCat(w, shape, ox, gy, sc, open);
    return w;
  };
}

/** How far the poses reach (rig units): left, right, top. */
function reach(at: (p: Pose, t: number) => unknown, times: number[]) {
  let lo = Infinity;
  let hi = -Infinity;
  let top = 0;
  for (const t of times) {
    at(pose, t);
    skin(pose, shape);
    const d = shape.discs;
    for (let i = 0; i < d.length; i += 3) {
      lo = Math.min(lo, d[i] - d[i + 2]);
      hi = Math.max(hi, d[i] + d[i + 2]);
      top = Math.max(top, d[i + 1] + d[i + 2]);
    }
    for (const q of shape.polys) for (let i = 0; i < q.length; i += 2) [lo, hi, top] = [Math.min(lo, q[i]), Math.max(hi, q[i]), Math.max(top, q[i + 1])];
  }
  return { lo, hi, top };
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

/**
 * Materialising: a particle not yet gone is not drawn (its grid dot is the panel's), lights up on its dot, then
 * travels to its place, small and grey until it is there.
 */
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
    w.tone[i] = k < 0 ? 2 : e < 0.6 ? 3 : tone;
    w.lit[i] = k < 0 ? 0 : 1;
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

/** Grey below the scan line until its first pass is over: the Machine has not classified that part of her yet. */
function classified(w: Swarm, box: CatBox, t: number) {
  const k = P(t, SCAN[0], SCAN[1]);
  if (k >= 1) return w;
  const line = box.cy - box.h / 2 + k * box.h;
  for (let i = 0; i < w.n; i++) if (w.tone[i] !== HIDDEN && w.y[i] > line) w.tone[i] = GREY[w.tone[i]];
  return w;
}

/** The ground the side-on cat stands on: a measuring line with a tick every ten rig units. */
function ground(o: CanvasRenderingContext2D, box: CatBox, a: number, ox: number, gy: number, sc: number) {
  const left = box.cx - box.w / 2;
  o.fillStyle = rgb(FAINT, a);
  o.fillRect(left + 10, gy, box.w - 20, 1);
  for (let x = (((ox - left) % (10 * sc)) + 10 * sc) % (10 * sc); x < box.w - 10; x += 10 * sc) if (x > 10) o.fillRect(left + x, gy, 1, 5);
}

/** A variant made of keyed poses: fitted in the box, standing on its ground, materialising out of the panel. */
function keyedPhase(box: CatBox, keys: Keys, form: number, morph: number, style: Style, open?: (t: number) => number): CatPhase {
  const at = (p: Pose, t: number) => {
    keyed(p, keys, t);
    return open ? open(t) : 1;
  };
  const times = Array.from({ length: 13 }, (_, i) => lerp(CAT_AT, morph, i / 12));
  const { lo, hi, top } = reach(at, times);
  // As large as the frame allows, but never larger than the sitting cat of old by more than a quarter: she is a small cat.
  const sc = Math.min((box.h * 0.82) / top, (box.w - 24) / (hi - lo), ((box.h * 0.94) / 52) * 1.3);
  const ox = box.cx - ((lo + hi) / 2) * sc;
  const gy = box.cy + Math.min(box.h * 0.42, (top * sc) / 2 + box.h * 0.08);
  const cat = dotCat(sc, ox, gy, at, times, style);
  const a = rising(cat(CAT_AT + form), form, gy);
  return {
    frame: (t) => classified(materialise(cat(t), a, t), box, t),
    under: (o, t, k) => ground(o, box, k * P(t, 6.5, 6.75), ox, gy, sc),
  };
}

/**
 * nap: she materialises asleep in a loaf, the way she spends most of her day. The scan classifies her while she
 * sleeps; as the line passes her ears one of them twitches; she lifts her head, her eyes open (green: the system's
 * nominal) and she gives the camera a slow blink before the particles leave for the handle.
 */
function nap(box: CatBox, style: Style): CatPhase {
  const { form, morph } = VARIANT.nap;
  const keys: Keys = [
    [CAT_AT, 7.62, (p, t) => {
      sleep(p, t - 4);
      // The scan line crosses her ears: one of them flicks.
      p.earB = 0.55 * Math.exp(-(((t - 7.28) / 0.05) ** 2)) + 0.4 * Math.exp(-(((t - 7.46) / 0.045) ** 2));
    }],
    [7.95, 8.1, drowsy],
    [8.2, morph, (p, t) => {
      drowsy(p, t);
      p.headY = 16.3;
      p.roll = 0.05;
      p.open = 0.75 * slowBlink(t * 2, 8.25 * 2);
    }],
  ];
  return keyedPhase(box, keys, form, morph, style);
}

/** stretch: she materialises lying awake in a loaf, yawns at the scanner, then gets up into a long front stretch, tail high. */
function stretch(box: CatBox, style: Style): CatPhase {
  const { form, morph } = VARIANT.stretch;
  const keys: Keys = [
    [CAT_AT, 7.1, loaf],
    [7.3, 7.95, yawn],
    [8.1, 8.15, (p, t) => {
      loaf(p, t);
      p.open = 0.5;
    }],
    [8.6, morph, bow],
  ];
  return keyedPhase(box, keys, form, morph, style);
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
function walk(box: CatBox, style: Style): CatPhase {
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
    return 1 - Math.exp(-((((((t - 5.44) % 4.3) + 4.3) % 4.3 - 3.2) / 0.09) ** 2));
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
  const cat = dotCat(sc, ox, gy, at, times, style);
  const a = rising(cat(formed), form, gy);
  return {
    frame: (t) => classified(materialise(cat(t), a, t), box, t),
    under: (o, t, k) => ground(o, box, k * P(t, 6.5, 6.75), ox, gy, sc),
  };
}

/** pounce: it materialises crouched, watches the red marker dart about, wiggles, and jumps on it; the landing is the handle. */
function pounce(box: CatBox, style: Style): CatPhase {
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
  }, [formed, 7.3, 7.9, 8.05, 8.15, 8.25, 8.35, 8.45, 8.55, 8.63], style);
  const a = rising(cat(formed), form, gy);
  return {
    frame: (t) => classified(materialise(cat(t), a, t), box, t),
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

/**
 * prowl: she materialises walking, spots the red marker and freezes, a forepaw raised; drops low and creeps toward
 * it, her shoulder blades working; settles into the crouch, the rear wiggles, she leaps, and lands on it.
 */
function prowl(box: CatBox, style: Style): CatPhase {
  const { wide } = box;
  const { form, morph } = VARIANT.prowl;
  const g = wide ? PROWL_WIDE : PROWL_NARROW;
  // Her own clock: home seconds since the cat phase started, so the beats keep a cat's pace however the cut is timed.
  const own = (t: number) => along(catCut('prowl').map(([h, tl]) => [tl, h]), t);
  const L = POUNCE.to;
  // The marker shows up ahead of her as she finishes forming; it jumps while she watches, and ends where she lands.
  const stops = [
    [1.0, L + 26, 4],
    [1.62, L + 23, 10],
    [2.2, L + 21, 3],
    [2.7, L + 22, 7],
    [3.25, L + 17, 1.6],
  ];
  const dot = (s: number) => {
    let x = stops[0][1];
    let y = stops[0][2];
    for (let i = 1; i < stops.length; i++) {
      const k = E.inOutCubic(P(s, stops[i][0] - 0.16, stops[i][0]));
      x = lerp(x, stops[i][1], k);
      y = lerp(y, stops[i][2], k);
    }
    return [x, y];
  };
  const at = (p: Pose, t: number) => {
    const s = own(t);
    const [x, y] = dot(s);
    prowlPose(p, s, x, y, g);
    return 1;
  };
  const times = Array.from({ length: 25 }, (_, i) => lerp(CAT_AT, morph, i / 24));
  const { lo, hi, top } = reach(at, times);
  // On a desktop the short path lets her fill the frame's height (the tail tip, carried up, nearly reaching its top).
  const sc = Math.min((box.h * (wide ? 0.9 : 0.8)) / Math.max(top, 48), (box.w - 24) / (hi - lo));
  const ox = box.cx - ((lo + hi) / 2) * sc;
  const gy = box.cy + box.h * 0.42;
  // Drawn this large, the look's particles (fewer per px as a cat grows) thin out and the coat goes dim: a denser core, more of it bright.
  const look = wide ? { ...style, count: style.count * 1.35, bright: Math.min(0.9, style.bright * 1.25) } : style;
  const cat = dotCat(sc, ox, gy, at, times, look);
  const a = rising(cat(CAT_AT + form), form, gy);
  const land = PROWL.crouched + POUNCE.land - PROWL.from;
  return {
    frame: (t) => classified(materialise(cat(t), a, t), box, t),
    under: (o, t, k) => ground(o, box, k * P(t, 6.5, 6.75), ox, gy, sc),
    over(o, t, k) {
      const s = own(t);
      const [x, y] = dot(s);
      const px = ox + x * sc;
      const py = gy - y * sc;
      const on = k * P(s, stops[0][0] - 0.1, stops[0][0]) * (1 - P(s, land - 0.03, land));
      if (on > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(s * 22);
        o.fillStyle = rgb(RED, 0.18 * on);
        o.beginPath();
        o.arc(px, py, 9 + 3 * pulse, 0, TAU);
        o.fill();
        o.fillStyle = rgb(RED, on);
        o.fillRect(px - 2.5, py - 2.5, 5, 5);
      }
      const hit = P(s, land - 0.03, land + 0.4);
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

/** The cat phase of a variant, laid out in `box`, in a look (the site's, unless the gallery asks for another). */
export function catPhase(name: IntroName, box: CatBox, style: Style = STYLES[LOOK]): CatPhase {
  switch (name) {
    case 'prowl':
      return prowl(box, style);
    case 'nap':
      return nap(box, style);
    case 'pounce':
      return pounce(box, style);
    case 'walk':
      return walk(box, style);
    case 'stretch':
      return stretch(box, style);
  }
}
