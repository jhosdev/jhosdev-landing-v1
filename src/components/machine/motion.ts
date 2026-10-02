// Section movements. A movement is two things driven by one clock:
//   - cues: server-rendered elements marked `data-m` resolve in (decode, rise,
//     lock on, count up, reclassify), each at its own `data-at` second;
//   - a painter: the section's canvas layer (wires, scan bars, waveforms).
// Both are pure functions of the section's time, so a movement can be frozen
// for a screenshot (?move=0.6) and simply skipped under reduced motion.
// Used by the home page (runtime.ts) and the article pages.

import {
  AMBER, BG, BODY, CYAN, E, FAINT, GREEN, MUTED, P, RED, TAU, TEXT,
  along, buildStreets, cl, dash, decode, drawStreets, entPos, font, hash, lerp, pad, rgb,
  type RGB, type Streets,
} from './draw';
import { buildCat, drawCat } from './cat';

/* ------------------------------------------------------------------ cues */

type Stage = [tone: string, text: string, hold: number];

interface Cue {
  el: HTMLElement;
  type: string;
  at: number;
  len: number;
  text: string;
  seed: number;
  /** Element whose time shift applies to this cue (a card, a row): see Cues.shift. */
  group: HTMLElement | null;
  stages: Stage[];
  toneRoot: HTMLElement | null;
  tone: string;
  done: boolean;
}

export interface Cues {
  list: Cue[];
  /** Seconds each group starts late (it was acquired late, or scrolled into view late). */
  shift: Map<HTMLElement, number>;
  /** When the last cue has resolved, shifts included. */
  end: () => number;
}

const LEN: Record<string, number> = { r: 0.5, f: 0.4, l: 0.45, x: 0.7 };

/** Collects the cues under `root`, leaving out those owned by a nested `[data-cues]` root. */
export function collectCues(root: HTMLElement): Cues {
  const list = [...root.querySelectorAll<HTMLElement>('[data-m]')]
    .filter((el) => {
      const owner = el.closest<HTMLElement>('[data-cues]');
      return !owner || owner === root || !root.contains(owner);
    })
    .map((el, i): Cue => {
      const type = el.dataset.m ?? 'r';
      const text = el.textContent?.trim().replace(/\s+/g, ' ') ?? '';
      const group = el.closest<HTMLElement>('[data-g]');
      const toneRoot = type === 't' ? el.closest<HTMLElement>('[data-tone]') : null;
      return {
        el,
        type,
        at: Number(el.dataset.at ?? 0) + Number(group?.dataset.base ?? 0),
        len: Number(el.dataset.len) || LEN[type] || 0.25 + Math.min(0.45, text.length * 0.012),
        text,
        seed: i + 1,
        group: group && root.contains(group) ? group : null,
        stages: type === 't' ? (JSON.parse(el.dataset.pre ?? '[]') as Stage[]) : [],
        toneRoot,
        tone: toneRoot?.dataset.tone ?? '',
        done: false,
      };
    });
  const shift = new Map<HTMLElement, number>();
  const start = (c: Cue) => c.at + (c.group ? (shift.get(c.group) ?? 0) : 0);
  return {
    list,
    shift,
    end: () => Math.max(0, ...list.map((c) => start(c) + c.len + c.stages.reduce((sum, s) => sum + s[2], 0))),
  };
}

function count(text: string, k: number) {
  return text.replace(/[\d.,]+/, (num) => {
    const decimals = (num.split('.')[1] ?? '').length;
    const value = (Number(num.replace(/,/g, '')) * k).toFixed(decimals);
    return num.includes(',') ? Number(value).toLocaleString('en-US') : value.padStart(num.length, '0');
  });
}

function rest(c: Cue) {
  const s = c.el.style;
  c.el.removeAttribute('data-d');
  s.removeProperty('opacity');
  s.removeProperty('transform');
  s.removeProperty('--ls');
  s.removeProperty('--lo');
  s.removeProperty('width');
  if (c.toneRoot) c.toneRoot.dataset.tone = c.tone;
}

/** Puts every cue where it belongs at time t. */
export function applyCues(cues: Cues, t: number) {
  for (const c of cues.list) {
    const t0 = c.at + (c.group ? (cues.shift.get(c.group) ?? 0) : 0);
    const s = c.el.style;
    if (c.type === 't') {
      // A classification tag: walks through its earlier verdicts, then lands on the real one.
      if (t < t0) {
        s.opacity = '0';
        c.done = false;
        continue;
      }
      let since = t0;
      let stage = c.stages.find((st) => {
        if (t < since + st[2]) return true;
        since += st[2];
        return false;
      });
      const k = P(t, since, since + 0.22);
      if (!stage && k >= 1) {
        if (!c.done) rest(c);
        c.done = true;
        continue;
      }
      c.done = false;
      s.opacity = '';
      stage ??= [c.tone, c.text, 0];
      if (c.toneRoot) c.toneRoot.dataset.tone = stage[0];
      // The label is as wide as the verdict it currently shows, not the one it will end on.
      s.width = `calc(${stage[1].length} * (1ch + 0.08em))`;
      c.el.setAttribute('data-d', decode(stage[1], k, t, c.seed));
      continue;
    }
    const k = P(t, t0, t0 + c.len);
    if (k >= 1) {
      if (!c.done) rest(c);
      c.done = true;
      continue;
    }
    c.done = false;
    switch (c.type) {
      case 'd':
        s.opacity = k <= 0 ? '0' : '';
        if (k > 0) c.el.setAttribute('data-d', decode(c.text, k, t, c.seed));
        break;
      case 'n':
        s.opacity = k <= 0 ? '0' : '';
        if (k > 0) c.el.setAttribute('data-d', count(c.text, E.inOutCubic(k)));
        break;
      case 'l':
        // Brackets acquire with overshoot, like lock() on the canvas.
        s.setProperty('--ls', lerp(1.7, 1, E.outBack(k, 2.4)).toFixed(4));
        s.setProperty('--lo', cl(k * 4).toFixed(3));
        s.opacity = cl(k * 4).toFixed(3);
        break;
      case 'x':
        s.transform = `scaleX(${E.inOutCubic(k).toFixed(4)})`;
        break;
      case 'f':
        s.opacity = k.toFixed(3);
        break;
      default: {
        const e = E.outExpo(k);
        s.opacity = e.toFixed(3);
        s.transform = `translateY(${((1 - e) * 12).toFixed(2)}px)`;
      }
    }
  }
}

/** Content simply present: every inline trace of the movement removed. */
export function settleCues(cues: Cues) {
  for (const c of cues.list) {
    rest(c);
    c.done = true;
  }
}

/* ---------------------------------------------------------------- canvas */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Fx {
  host: HTMLElement;
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Still frame: no marching ants, no packets, nothing mid-decode. */
  calm: boolean;
  /** Layout-derived data, dropped on every resize. */
  memo: Record<string, unknown>;
  /** Per-section state the page sets (which entity is selected, and since when). */
  state: Record<string, number>;
  /** Start offsets a painter derives from layout (when the scan bar reaches a card). */
  base: Map<Element, number>;
  /** Effective start time of each group, kept in step with the cues by createMovement. */
  start: Map<Element, number>;
  box: (el: Element) => Box;
  fit: () => void;
}

export function createFx(host: HTMLElement, calm: boolean): Fx | null {
  const cv = host.querySelector<HTMLCanvasElement>('canvas.mc-fx');
  const ctx = cv?.getContext('2d');
  if (!cv || !ctx) return null;
  const fx: Fx = {
    host,
    cv,
    ctx,
    W: 1,
    H: 1,
    calm,
    memo: {},
    state: {},
    base: new Map(),
    start: new Map(),
    box(el) {
      const a = el.getBoundingClientRect();
      const b = cv.getBoundingClientRect();
      return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
    },
    fit() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fx.W = Math.max(1, cv.clientWidth);
      fx.H = Math.max(1, cv.clientHeight);
      cv.width = Math.round(fx.W * dpr);
      cv.height = Math.round(fx.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.memo = {};
    },
  };
  fx.fit();
  return fx;
}

const memo = <T,>(fx: Fx, key: string, make: () => T): T => (fx.memo[key] ??= make()) as T;
const all = (fx: Fx, selector: string) => [...fx.host.querySelectorAll<HTMLElement>(selector)];

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', weight = 400) {
  ctx.font = font(size, weight);
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function corners(ctx: CanvasRenderingContext2D, b: Box, l: number, col: string, lw = 1.5) {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const [px, py, sx, sy] of [
    [b.x, b.y, 1, 1],
    [b.x + b.w, b.y, -1, 1],
    [b.x, b.y + b.h, 1, -1],
    [b.x + b.w, b.y + b.h, -1, -1],
  ]) {
    ctx.moveTo(px + sx * l, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + sy * l);
  }
  ctx.stroke();
}

const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 });

/** Classification tag on the canvas: filled label, dark text. (x, y) is its bottom-left. */
function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: RGB, a = 1, size = 11) {
  const w = s.length * size * 0.66 + 14;
  ctx.fillStyle = rgb(c, a);
  ctx.fillRect(x, y - size * 1.9, w, size * 1.9);
  ctx.save();
  ctx.letterSpacing = '0.06em';
  text(ctx, s, x + 7, y - size * 0.55, size, rgb(BG, a), 'left', 500);
  ctx.restore();
}

/** How long the cat stays in the hero when it is summoned, in seconds. */
export const CAT_LEN = 6.4;

/** Idle period shared with the intro's map: every idle motion divides it. */
const LOOP = 12;

type Painter = (fx: Fx, t: number) => void;

/**
 * 01 ASSET: a camera feed. The street map from the intro keeps moving, passers-by
 * get tracked and wired to the subject, and the subject is analysed, then confirmed.
 */
const asset: Painter = (fx, t) => {
  const { ctx, W, H, calm } = fx;
  const L = memo(fx, 'asset', () => {
    const map: Streets = buildStreets(W, H, LOOP);
    const name = fx.host.querySelector('[data-box]');
    const subject = fx.host.querySelector('.mc-subject');
    const lock = name ? fx.box(name) : { x: W / 2, y: H / 2, w: 0, h: 0 };
    const pool = subject ? fx.box(subject) : lock;
    // The telemetry and employment columns: text that must stay readable over the map.
    const cols = all(fx, '[data-col]').map((el) => fx.box(el));
    const far = (p: number[], b: Box, by: number) => p[0] < b.x - by || p[0] > b.x + b.w + by || p[1] < b.y - by * 0.6 || p[1] > b.y + b.h + by * 0.6;
    // Tracked passers-by: inside the frame, clear of the subject, spread out.
    const tracked: number[] = [];
    for (let i = 1; i < map.ents.length && tracked.length < (W > 700 ? 5 : 3); i++) {
      const p = entPos(map, map.ents[i], 0);
      if (p[0] < 30 || p[0] > W - 90 || p[1] < 44 || p[1] > H - 70) continue;
      // Clear of the subject at both ends of its patrol, not just where it starts.
      if ([0, 3, 6, 9].some((time) => !far(entPos(map, map.ents[i], time), pool, 70) || cols.some((b) => !far(entPos(map, map.ents[i], time), b, 24)))) continue;
      if (tracked.some((j) => Math.hypot(...entPos(map, map.ents[j], 0).map((v, n) => v - p[n])) < 150)) continue;
      tracked.push(i);
    }
    return { map, lock: grow(lock, 14), pool, cols, tracked };
  });
  ctx.clearRect(0, 0, W, H);
  const on = calm ? 1 : E.outCubic(P(t, 0, 0.8));
  const tau = calm ? 0 : t;
  drawStreets(ctx, L.map, tau, 0.85 * on, W, H);

  const cx = L.lock.x + L.lock.w / 2;
  const cy = L.lock.y + L.lock.h / 2;
  L.tracked.forEach((i, j) => {
    const local = (tau - 1.6 - j * (LOOP / L.tracked.length) + LOOP * 4) % LOOP;
    const k = calm ? (j % 2 ? 0 : 1) : P(local, 0, 0.35) * (1 - P(local, 6.2, 6.5)) * P(t, 1.5, 1.6);
    if (k <= 0) return;
    const [x, y] = entPos(L.map, L.map.ents[i], tau);
    const dx = x - cx;
    const dy = y - cy;
    const s = Math.min((L.lock.w / 2 + 6) / (Math.abs(dx) || 1e-6), (L.lock.h / 2 + 6) / (Math.abs(dy) || 1e-6));
    dash(ctx, [[x, y], [cx + dx * s, cy + dy * s]], calm ? 1 : E.outCubic(P(local, 0.2, 1)), rgb(MUTED, 0.6 * cl(k * 2)), tau);
    corners(ctx, { x: x - 12, y: y - 12, w: 24, h: 24 }, 6, rgb(TEXT, 0.9 * k), 1.25);
    text(ctx, `ID ${L.map.ents[i].id}`, x + 18, y + 4, 10, rgb(BODY, cl(k * 2 - 1)));
  });

  // A pool of background keeps the record legible over the map.
  const px = L.pool.x + L.pool.w / 2;
  const py = L.pool.y + L.pool.h / 2;
  const pool = ctx.createRadialGradient(px, py, Math.min(L.pool.w, L.pool.h) * 0.35, px, py, Math.max(L.pool.w * 0.72, L.pool.h * 0.9));
  pool.addColorStop(0, rgb(BG, 0.96));
  pool.addColorStop(1, rgb(BG, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, W, H);
  for (const b of L.cols) {
    // A band of background behind each column, soft at its sides.
    const band = ctx.createLinearGradient(b.x - 36, 0, b.x + b.w + 36, 0);
    const edge = 36 / (b.w + 72);
    band.addColorStop(0, rgb(BG, 0));
    band.addColorStop(edge, rgb(BG, 0.9));
    band.addColorStop(1 - edge, rgb(BG, 0.9));
    band.addColorStop(1, rgb(BG, 0));
    ctx.fillStyle = band;
    ctx.fillRect(b.x - 36, b.y - 14, b.w + 72, b.h + 28);
  }

  if (!calm && t >= 0.45 && t < 1.4) {
    // Under analysis: an amber line scans the subject.
    const sy = L.lock.y + (((t - 0.45) % 0.5) / 0.5) * L.lock.h;
    const wash = ctx.createLinearGradient(0, sy - 36, 0, sy);
    wash.addColorStop(0, rgb(AMBER, 0));
    wash.addColorStop(1, rgb(AMBER, 0.12));
    ctx.fillStyle = wash;
    ctx.fillRect(L.lock.x, Math.max(L.lock.y, sy - 36), L.lock.w, Math.min(36, sy - L.lock.y));
    ctx.fillStyle = rgb(AMBER, 0.8);
    ctx.fillRect(L.lock.x, sy, L.lock.w, 1);
  }
  if (!calm && t >= 1.4 && t < 2.2) {
    // Confirmed: the box flashes and a second set of brackets flies outward.
    const k = P(t, 1.4, 1.95);
    ctx.fillStyle = rgb(CYAN, 0.16 * Math.exp(-(t - 1.4) * 8));
    ctx.fillRect(L.lock.x, L.lock.y, L.lock.w, L.lock.h);
    corners(ctx, grow(L.lock, 26 * E.outExpo(k)), 18, rgb(CYAN, 1 - k), 1);
  }

  // Feed chrome.
  const blink = calm || Math.floor(t * 2) % 2 === 0;
  ctx.fillStyle = rgb(RED, on * (blink ? 1 : 0.3));
  ctx.beginPath();
  ctx.arc(18, 19, 3, 0, TAU);
  ctx.fill();
  text(ctx, fx.host.dataset.label ?? 'REC', 28, 23, 11, rgb(BODY, on));
  if (!calm) {
    const s = Math.floor(t);
    text(ctx, `${pad(Math.floor(s / 3600), 2)}:${pad(Math.floor(s / 60) % 60, 2)}:${pad(s % 60, 2)}:${pad(Math.floor((t % 1) * 30), 2)}`, W - 16, 23, 11, rgb(BODY, on), 'right');
  }
  if (fx.host.dataset.scene) text(ctx, fx.host.dataset.scene, 18, H - 17, 11, rgb(BODY, on));
  corners(ctx, { x: 8, y: 8, w: W - 16, h: H - 16 }, 10, rgb(MUTED, on), 1.5);

  // The cat, when summoned: the particles gather over the subject, hold, and leave again.
  const at = fx.state.catAt;
  if (at === undefined) return;
  const local = calm ? CAT_LEN / 2 : t - at;
  if (local <= 0 || local >= CAT_LEN) return;
  const C = memo(fx, 'cat', () => {
    const size = Math.min(L.pool.w * 0.92, L.pool.h * 0.9, 400);
    return { cat: buildCat(size), x: px - size / 2, y: py - size / 2, size };
  });
  const out = CAT_LEN - 1.7;
  drawCat(ctx, C.cat, C.x, C.y, t, P(local, 0, 0.5) * (1 - P(local, CAT_LEN - 0.5, CAT_LEN)), E.inOutCubic(P(local, 0.4, 1.8)) * (1 - P(local, out, CAT_LEN - 0.4)), calm);
  const a = calm ? 1 : P(local, 1.7, 1.95) * (1 - P(local, out - 0.1, out + 0.15));
  if (a <= 0) return;
  const box = grow({ x: C.x, y: C.y, w: C.size, h: C.size }, 4 + 14 * (1 - E.outExpo(P(local, 1.7, 2.2))));
  corners(ctx, box, 16, rgb(TEXT, a), 1.5);
  if (fx.host.dataset.cat) label(ctx, fx.host.dataset.cat.toUpperCase(), box.x, box.y - 8, TEXT, a);
};

/**
 * 02 ASSOCIATIONS: a bus from the asset node to every entity, drawn on one per
 * beat; the selected entity is wired to its record and a packet rides the link.
 */
const associations: Painter = (fx, t) => {
  const { ctx, W, H, calm } = fx;
  // Measured every frame: on wide screens the list is sticky, so it moves against the record while you read.
  const D = memo(fx, 'assoc', () => ({ node: fx.host.querySelector('[data-node]'), ents: all(fx, '[data-ent]'), records: all(fx, '.mc-record') }));
  const record = D.records.find((el) => !el.hidden);
  const L = { node: D.node ? fx.box(D.node) : null, ents: D.ents, boxes: D.ents.map((el) => fx.box(el)), record: record ? fx.box(record) : null };
  ctx.clearRect(0, 0, W, H);
  if (!L.node || !L.boxes.length) return;
  const sel = fx.state.sel ?? -1;
  const selT = fx.state.selT ?? 0;
  const busX = L.boxes[0].x - 18;
  const y0 = L.node.y + L.node.h + 12;
  const tick = calm ? 0 : t;

  L.boxes.forEach((b, i) => {
    if (i === sel) return;
    const at = Number(L.ents[i].dataset.at ?? 0);
    const cy = b.y + b.h / 2;
    dash(ctx, [[busX, y0], [busX, cy], [b.x - 8, cy]], calm ? 1 : E.outExpo(P(t, at - 0.3, at + 0.2)), rgb(BODY, 0.55), tick);
  });
  const b = L.boxes[sel];
  if (!b) return;
  const cy = b.y + b.h / 2;
  const at = Number(L.ents[sel].dataset.at ?? 0);
  const feed = [[busX, y0], [busX, cy], [b.x - 8, cy]];
  dash(ctx, feed, calm ? 1 : E.outExpo(P(t, at - 0.3, at + 0.2)), rgb(CYAN, 0.9), tick);

  // From the entity to its record: sideways when they sit side by side, down the bus when stacked.
  const r = L.record;
  if (!r) return;
  const beside = r.x > b.x + b.w;
  const ry = r.y + 30;
  const link = beside
    ? [[b.x + b.w + 8, cy], [(b.x + b.w + r.x) / 2, cy], [(b.x + b.w + r.x) / 2, ry], [r.x - 8, ry]]
    : [[busX, cy], [busX, ry], [r.x - 8, ry]];
  const k = calm ? 1 : E.outExpo(P(t, selT, selT + 0.5));
  dash(ctx, link, k, rgb(CYAN, 0.9), tick);
  const tip = along(link, k);
  ctx.fillStyle = rgb(CYAN);
  ctx.fillRect(tip[0] - 2.5, tip[1] - 2.5, 5, 5);
  if (calm || t < selT + 0.5) return;
  const u = ((t - selT) * 0.4) % 1;
  for (const path of [feed, link]) {
    const p = along(path, u);
    ctx.fillRect(p[0] - 2.5, p[1] - 2.5, 5, 5);
  }
};

/**
 * 03 PROJECTS: a scan bar crosses the grid; each target it reaches is boxed,
 * analysed under an amber line, then classified.
 */
const projects: Painter = (fx, t) => {
  const { ctx, W, H, calm } = fx;
  const L = memo(fx, 'targets', () => {
    const cards = all(fx, '[data-g]');
    const boxes = cards.map((el) => fx.box(el.querySelector('.mc-target-box') ?? el));
    const across = new Set(boxes.map((b) => Math.round(b.x))).size > 1;
    // The sweep runs along the grid's long reading axis; a card starts when the bar reaches it.
    const reach = (b: Box) => 0.25 + ((across ? b.x : b.y) + 60) / ((across ? W : H) + 120) * 1.1;
    cards.forEach((el, i) => fx.base.set(el, reach(boxes[i])));
    return { cards, boxes, across };
  });
  ctx.clearRect(0, 0, W, H);
  if (calm) return;
  const u = P(t, 0.25, 1.35);
  if (u > 0 && u < 1) {
    const at = lerp(-60, (L.across ? W : H) + 60, u);
    const wash = L.across ? ctx.createLinearGradient(at - 160, 0, at, 0) : ctx.createLinearGradient(0, at - 160, 0, at);
    wash.addColorStop(0, rgb(TEXT, 0));
    wash.addColorStop(1, rgb(TEXT, 0.08));
    ctx.fillStyle = wash;
    if (L.across) ctx.fillRect(at - 160, 0, 160, H);
    else ctx.fillRect(0, at - 160, W, 160);
    ctx.fillStyle = rgb(TEXT, 0.85);
    if (L.across) ctx.fillRect(at, 0, 1.5, H);
    else ctx.fillRect(0, at, W, 1.5);
  }
  L.boxes.forEach((b, i) => {
    const local = t - (fx.start.get(L.cards[i]) ?? 0);
    if (local < 0.1 || local > 0.62) return;
    const sy = b.y + ((local - 0.1) / 0.52) * b.h;
    const wash = ctx.createLinearGradient(0, sy - 40, 0, sy);
    wash.addColorStop(0, rgb(AMBER, 0));
    wash.addColorStop(1, rgb(AMBER, 0.14));
    ctx.fillStyle = wash;
    ctx.fillRect(b.x, Math.max(b.y, sy - 40), b.w, Math.min(40, sy - b.y));
    ctx.fillStyle = rgb(AMBER, 0.85);
    ctx.fillRect(b.x, sy, b.w, 1);
  });
};

/**
 * OPEN SOURCE: a commit rail down the left of the listing. It grows to each
 * repository as that row is indexed, and leaves a node on it.
 */
const opensource: Painter = (fx, t) => {
  const { ctx, W, H, calm } = fx;
  const L = memo(fx, 'repos', () => all(fx, '[data-g]').map((el) => ({ el, box: fx.box(el) })));
  ctx.clearRect(0, 0, W, H);
  const x = 6.5;
  let from = 0;
  L.forEach((row) => {
    const local = calm ? 9 : t - (fx.start.get(row.el) ?? 0);
    const y = row.box.y + 31;
    const k = E.outExpo(P(local, -0.3, 0.1));
    dash(ctx, [[x, from], [x, y - 7]], k, rgb(BODY, 0.6), calm ? 0 : t);
    from = y + 7;
    if (local < 0) return;
    // The node: hollow while the row is being indexed, filled once it is.
    const done = local > 0.55;
    ctx.fillStyle = rgb(done ? TEXT : AMBER);
    ctx.fillRect(x - 4.5, y - 4.5, 9, 9);
    if (!done) {
      ctx.fillStyle = rgb(BG);
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    ctx.fillStyle = rgb(BODY, 0.6);
    ctx.fillRect(x + 7, y - 0.5, (row.box.x - x - 13) * E.outExpo(P(local, 0, 0.3)), 1);
  });
};

/** ABOUT: a second entity in the frame. A sphere of noise is analysed and resolves into the cat, which then idles. */
const about: Painter = (fx, t) => {
  const { ctx, W, H, calm } = fx;
  const L = memo(fx, 'pet', () => {
    const size = Math.min(W, H) * 0.84;
    return { cat: buildCat(size), x: (W - size) / 2, y: (H - size) / 2, size };
  });
  ctx.clearRect(0, 0, W, H);
  if (!calm && t >= 0.8 && t < 1.8) {
    // Under analysis: an amber line scans the frame.
    const sy = (((t - 0.8) % 0.5) / 0.5) * H;
    const wash = ctx.createLinearGradient(0, sy - 36, 0, sy);
    wash.addColorStop(0, rgb(AMBER, 0));
    wash.addColorStop(1, rgb(AMBER, 0.12));
    ctx.fillStyle = wash;
    ctx.fillRect(0, Math.max(0, sy - 36), W, Math.min(36, sy));
    ctx.fillStyle = rgb(AMBER, 0.8);
    ctx.fillRect(0, sy, W, 1);
  }
  drawCat(ctx, L.cat, L.x, L.y, t, calm ? 1 : P(t, 0.2, 0.8), calm ? 1 : E.inOutCubic(P(t, 0.8, 2.2)), calm);
};

/** One strip of signal: red noise ahead of the decode front, a calm green carrier behind it. */
function wave(fx: Fx, b: Box, t: number, local: number, seed: number) {
  const { ctx, calm } = fx;
  const front = calm ? 1 : P(local, 0.25, 1.05);
  const mid = b.y + b.h / 2;
  const frame = Math.floor(t * 18);
  const pulse = calm ? -1 : ((t * 0.22 + seed * 0.37) % 1.3) * b.w;
  const live = calm ? 1 : P(local, 0, 0.25);
  for (let x = 0, j = 0; x < b.w - 1; x += 4, j++) {
    const clear = x / b.w < front;
    let h: number;
    let col: RGB;
    if (clear) {
      const near = Math.exp(-Math.pow((x - pulse) / 26, 2));
      h = b.h * (0.1 + 0.07 * Math.sin(j * 0.55 + (calm ? 0 : t * 1.6)) + 0.32 * near);
      col = near > 0.25 ? TEXT : GREEN;
    } else {
      h = b.h * (0.12 + 0.88 * hash(j * 7 + frame * 31 + seed * 101)) * live;
      col = hash(j * 13 + seed) < 0.3 ? AMBER : RED;
    }
    ctx.fillStyle = rgb(col, clear ? 0.75 : 0.9);
    ctx.fillRect(b.x + x, mid - h / 2, 2, Math.max(1, h));
  }
  if (!calm && front > 0 && front < 1) {
    ctx.fillStyle = rgb(TEXT);
    ctx.fillRect(b.x + b.w * front, b.y, 1.5, b.h);
  }
}

/** 04 WRITING: every transmission arrives as noise and decodes left to right. */
const writing: Painter = (fx, t) => {
  const L = memo(fx, 'waves', () => all(fx, '[data-wave]').map((el) => ({ box: fx.box(el), group: el.closest('[data-g]') })));
  fx.ctx.clearRect(0, 0, fx.W, fx.H);
  L.forEach((w, i) => wave(fx, w.box, t, t - (w.group ? (fx.start.get(w.group) ?? 0) : 0), i + 1));
};

/** 06 CONTACT: two signals out of phase negotiate, then lock into one carrier. */
const contact: Painter = (fx, t) => {
  const { ctx, W, H, calm } = fx;
  ctx.clearRect(0, 0, W, H);
  const k = calm ? 1 : E.inOutCubic(P(t, 0.15, 1.25));
  const open = calm || t >= 1.25;
  const mid = H / 2;
  const amp = H * lerp(0.34, 0.16, k);
  const f = 0.045;
  const phase = calm ? 0 : t * 2.4;
  const line = (freq: number, shift: number, col: string, lw: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      // A pulse travels down the open channel every few seconds.
      const pulse = open && !calm ? 1 + 1.6 * Math.exp(-Math.pow((x - ((t * 0.3) % 1.4) * W) / 40, 2)) : 1;
      const y = mid + Math.sin(x * freq - phase + shift) * amp * pulse;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.fillStyle = rgb(FAINT, 0.6);
  ctx.fillRect(0, mid, W, 1);
  if (!open) line(lerp(f * 1.9, f, k), (1 - k) * 2.6, rgb(AMBER, 0.9), 1.25);
  line(f, 0, open ? rgb(GREEN) : rgb(TEXT, 0.85), open ? 1.75 : 1.25);
  if (!calm && t >= 1.25 && t < 1.9) {
    ctx.fillStyle = rgb(GREEN, 0.14 * Math.exp(-(t - 1.25) * 7));
    ctx.fillRect(0, 0, W, H);
  }
};

const painters: Record<string, Painter> = { asset, associations, projects, opensource, writing, about, contact };

/* -------------------------------------------------------------- movement */

export interface Movement {
  cues: Cues;
  fx: Fx | null;
  /** Re-measures the layout and forgets which groups have been seen. Call before playing from the top. */
  reset: () => void;
  /** Renders time t. `all` treats every group as on screen (frozen frames). Returns true while cues are pending. */
  frame: (t: number, all?: boolean) => boolean;
  /** Content simply present, canvas on its settled frame. */
  settle: () => void;
  /** Hidden again, ready to replay. */
  clear: () => void;
}

const UNSEEN = 1e6;

/**
 * Binds the cues and the canvas under `root` to one clock. Groups (`data-g`:
 * a card, a row) start no earlier than the moment they scroll into view, so a
 * tall section on a phone still shows each of its parts arriving.
 */
export function createMovement(root: HTMLElement, calm: boolean, onResize?: () => void): Movement {
  const cues = collectCues(root);
  const host = root.matches('[data-fx]') ? root : root.querySelector<HTMLElement>('[data-fx]');
  const fx = host ? createFx(host, calm) : null;
  const paint = fx ? painters[fx.host.dataset.fx ?? ''] : undefined;
  const groups = [...new Set(cues.list.map((c) => c.group).filter((g): g is HTMLElement => g !== null))];
  const first = new Map(groups.map((g) => [g, Math.min(...cues.list.filter((c) => c.group === g).map((c) => c.at))]));
  const seen = new Map<HTMLElement, number>();
  let settled = false;

  const movement: Movement = {
    cues,
    fx,
    reset() {
      seen.clear();
      settled = false;
      fx?.fit();
      if (fx && paint) paint(fx, 0); // lets the painter derive its layout offsets
    },
    frame(t, all = false) {
      for (const g of groups) {
        if (!seen.has(g)) {
          const r = g.getBoundingClientRect();
          if (all || (r.top < innerHeight * 0.88 && r.bottom > 0)) seen.set(g, all ? 0 : t);
        }
        const authored = fx?.base.get(g) ?? 0;
        const at = seen.get(g);
        const shift = at === undefined ? UNSEEN : authored + Math.max(0, at - (first.get(g) ?? 0) - authored);
        cues.shift.set(g, shift);
        fx?.start.set(g, Number(g.dataset.base ?? 0) + shift);
      }
      const pending = t < cues.end();
      if (pending) {
        applyCues(cues, t);
        settled = false;
      } else if (!settled) {
        settleCues(cues);
        settled = true;
      }
      if (fx && paint) paint(fx, t);
      return pending;
    },
    settle() {
      settleCues(cues);
      settled = true;
      for (const g of groups) fx?.start.set(g, 0);
      if (fx && paint) paint(fx, 1e3);
    },
    clear() {
      settleCues(cues);
      fx?.ctx.clearRect(0, 0, fx.W, fx.H);
    },
  };
  if (fx) {
    let w = fx.W;
    let h = fx.H;
    new ResizeObserver(() => {
      if (fx.cv.clientWidth === w && fx.cv.clientHeight === h) return;
      fx.fit();
      w = fx.W;
      h = fx.H;
      onResize?.();
    }).observe(fx.cv);
  }
  return movement;
}
