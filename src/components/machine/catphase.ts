// The cat phase of ACQUIRE, one function per variant: given the frame the cat
// lives in, it paints the cat at timeline time t (seconds; the phase runs from
// CAT_AT to the variant's `morph`). scene.ts plays it inside the intro and then
// hands its last frame to the particles; /lab/ loops it in a gallery. Pure
// functions of time, like everything else the Machine draws.
import { BG, E, FAINT, P, RED, TAU, TEXT, lerp, rgb } from './draw';
import { eyesOpen, fillShape, paintCat, rimOf, tailSwing } from './cat';
import { POUNCE, bust, newPose, newShape, pouncePose, skin, walkPose } from './catrig';

/** What the particles are before they resolve into the handle. `?intro=<name>` picks one. */
export const INTROS = ['sit', 'walk', 'silhouette', 'pounce', 'peek'] as const;
export type IntroName = (typeof INTROS)[number];
/** The one that plays when nothing is asked for. */
export const DEFAULT_INTRO: IntroName = 'sit';
export const introName = (s: string | null | undefined): IntroName => (INTROS as readonly string[]).includes(s ?? '') ? (s as IntroName) : DEFAULT_INTRO;
/** Per variant: when (timeline seconds) the cat starts resolving into the handle, and the seconds its cat phase adds to the home cut. */
export const VARIANT: Record<IntroName, { morph: number; extra: number }> = {
  sit: { morph: 8.6, extra: 0 },
  walk: { morph: 8.8, extra: 1.4 },
  silhouette: { morph: 8.6, extra: 0.3 },
  pounce: { morph: 8.63, extra: 0.9 },
  peek: { morph: 8.6, extra: 0.5 },
};
/** Timeline second the cat phase starts (ACQUIRE). */
export const CAT_AT = 6.5;

/** The frame the cat lives in (CSS px): its centre and size. `wide` is the desktop layout. */
export interface CatBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  wide: boolean;
}

export interface CatPhase {
  /** Fills the cat as it is at time t. */
  paint: (o: CanvasRenderingContext2D, t: number) => void;
  /** Drawn under / over everything else in the frame. `a` goes to 0 as the particles leave for the handle. */
  under?: (o: CanvasRenderingContext2D, t: number, a: number) => void;
  over?: (o: CanvasRenderingContext2D, t: number, a: number) => void;
}

const pose = newPose();
const shape = newShape();

/** sit: it rises from the floor of the frame, sitting; looks back over its shoulder, flicks its tail and blinks while it is scanned. */
function sit(box: CatBox): CatPhase {
  const size = Math.min(box.h * 0.94, box.w * 0.7);
  const x0 = box.cx - size / 2;
  const y0 = box.cy - size / 2;
  const fy = y0 + size * 0.97;
  return {
    paint(o, t) {
      const grow = E.outExpo(P(t, 6.5, 7.1));
      if (grow <= 0) return;
      o.save();
      o.translate(box.cx, fy);
      o.scale(grow, grow);
      o.translate(-box.cx, -fy);
      paintCat(o, x0, y0, size, tailSwing(t - 7.25) * P(t, 7.1, 7.4), eyesOpen(t - 5.12), 1 - 2 * E.inOutCubic(P(t, 7.4, 7.75)));
      o.restore();
    },
  };
}

/** silhouette: its outline is traced, the first pass of the scan line fills it in, and only then does it break into particles. */
function silhouette(box: CatBox, dpr: number): CatPhase {
  const size = Math.min(box.h * 0.94, box.w * 0.7);
  const x0 = box.cx - size / 2;
  const y0 = box.cy - size / 2;
  const whole = document.createElement('canvas');
  whole.width = whole.height = Math.max(8, Math.ceil(size * dpr));
  const w = whole.getContext('2d');
  if (w) {
    w.scale(dpr, dpr);
    paintCat(w, 0, 0, size);
  }
  const rim = rimOf(whole, 1.6 * dpr);
  return {
    paint(o, t) {
      const trace = E.inOutCubic(P(t, 6.6, 7.25));
      if (trace > 0 && t < 8) {
        o.save();
        o.beginPath();
        o.moveTo(box.cx, box.cy);
        o.arc(box.cx, box.cy, size, -Math.PI / 2, -Math.PI / 2 + TAU * trace);
        o.closePath();
        o.clip();
        o.drawImage(rim, x0, y0, size, size);
        o.restore();
      }
      if (t < 7) return;
      o.save();
      o.beginPath();
      o.rect(x0 - 4, box.cy - box.h / 2, size + 8, t < 8 ? (t - 7) * box.h : box.h);
      o.clip();
      paintCat(o, x0, y0, size, t < 8 ? 0 : tailSwing(t - 7.55) * 0.5, eyesOpen(t - 5.12));
      o.restore();
    },
  };
}

/** peek: ears over the bottom edge of the frame, then eyes that look both ways, then the whole head. */
function peek(box: CatBox): CatPhase {
  const sc = Math.min(box.h * 0.6, box.w * 0.48) / 11.2;
  const floor = box.cy + box.h / 2;
  // How high the middle of the skull is over the edge, in head units: ears, then eyes, then all of it.
  const rise = (t: number) =>
    lerp(lerp(lerp(-14, -5.3, E.outCubic(P(t, 6.6, 6.95))), 1.7, E.inOutCubic(P(t, 7.25, 7.5))), 8, E.outBack(P(t, 8.02, 8.34), 2.2));
  return {
    paint(o, t) {
      // First to the left, then to the right, then at you.
      const look = -E.inOutCubic(P(t, 7.5, 7.62)) + 2 * E.inOutCubic(P(t, 7.76, 7.9)) - E.inOutCubic(P(t, 8.02, 8.14));
      const y = rise(t);
      const px = (x: number) => box.cx + x * sc;
      const py = (dy: number) => floor - (y + dy) * sc;
      o.save();
      o.beginPath();
      o.rect(box.cx - box.w / 2, box.cy - box.h / 2 - 60, box.w, box.h + 59);
      o.clip();
      bust(shape, 0, y, 1);
      o.strokeStyle = rgb(TEXT);
      o.lineWidth = Math.max(1, 0.13 * sc);
      o.lineCap = 'round';
      o.beginPath();
      for (const side of [-1, 1]) {
        for (const [from, to] of [
          [-1.4, -0.3],
          [-2, -2],
          [-2.6, -3.6],
        ]) {
          o.moveTo(px(side * 4.4), py(from));
          o.lineTo(px(side * 9.4), py(to));
        }
      }
      o.stroke();
      fillShape(o, shape, box.cx, floor, sc, eyesOpen(t - 5.24), rgb(TEXT), look);
      o.fillStyle = rgb(BG);
      o.beginPath();
      o.moveTo(px(-0.6), py(-1.5));
      o.lineTo(px(0.6), py(-1.5));
      o.lineTo(px(0), py(-2.3));
      o.closePath();
      o.fill();
      o.restore();
    },
    under(o, _t, a) {
      o.fillStyle = rgb(FAINT, a);
      o.fillRect(box.cx - box.w / 2, floor, box.w, 1);
    },
  };
}

/** The ground the side-on cat stands on: a measuring line with a tick every ten rig units. */
function ground(o: CanvasRenderingContext2D, box: CatBox, a: number, ox: number, gy: number, sc: number) {
  const left = box.cx - box.w / 2;
  o.fillStyle = rgb(FAINT, a);
  o.fillRect(left + 10, gy, box.w - 20, 1);
  for (let x = (((ox - left) % (10 * sc)) + 10 * sc) % (10 * sc); x < box.w - 10; x += 10 * sc) if (x > 10) o.fillRect(left + x, gy, 1, 5);
}

/** walk: it walks in from the left in profile, stops, sits down and looks back over its shoulder. */
function walk(box: CatBox): CatPhase {
  const sc = Math.min((box.h * 0.84) / 60, box.w / 84);
  const ox = box.cx + 8 * sc;
  const gy = box.cy + box.h * 0.42;
  const left = box.cx - box.w / 2;
  return {
    paint(o, t) {
      walkPose(pose, t - 6.5);
      skin(pose, shape);
      // It comes in through the left edge of the frame.
      const edge = o.createLinearGradient(left - 6, 0, left + 22, 0);
      edge.addColorStop(0, rgb(TEXT, 0));
      edge.addColorStop(1, rgb(TEXT));
      fillShape(o, shape, ox, gy, sc, eyesOpen(t - 5.44), edge);
    },
    under: (o, t, a) => ground(o, box, a * P(t, 6.5, 6.75), ox, gy, sc),
  };
}

/** pounce: crouched, it watches the red marker dart about, wiggles, and jumps on it; the landing is the handle. */
function pounce(box: CatBox): CatPhase {
  const { wide } = box;
  // A narrow frame keeps the cat large and lets the tail hang out of it.
  const sc = Math.min((box.h * 0.8) / 52, box.w / (wide ? 112 : 92));
  const ox = box.cx + (wide ? 22 : 12.5) * sc;
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
  return {
    paint(o, t) {
      const [x, y] = dot(t - 6.5);
      pouncePose(pose, t - 6.5, x, y);
      skin(pose, shape);
      o.save();
      o.globalAlpha *= P(t, 6.5, 6.75);
      fillShape(o, shape, ox, gy, sc);
      o.restore();
    },
    under: (o, t, a) => ground(o, box, a * P(t, 6.5, 6.75), ox, gy, sc),
    over(o, t, a) {
      const tl = t - 6.5;
      const [x, y] = dot(tl);
      const px = ox + x * sc;
      const py = gy - y * sc;
      // The marker: the same red square the sweep put on the subject.
      const on = a * P(tl, 0.1, 0.2) * (1 - P(tl, POUNCE.land - 0.03, POUNCE.land));
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

/** The cat phase of a variant, laid out in `box`. `dpr` is the canvas's device pixel ratio. */
export function catPhase(name: IntroName, box: CatBox, dpr = 1): CatPhase {
  switch (name) {
    case 'sit':
      return sit(box);
    case 'walk':
      return walk(box);
    case 'silhouette':
      return silhouette(box, dpr);
    case 'pounce':
      return pounce(box);
    case 'peek':
      return peek(box);
  }
}
