// "The Machine": the authored surveillance-HUD timeline. One frame is a pure
// function of time: createMachine() returns render(seconds) and the caller owns
// the clock (the lab page loops it; the home page plays a tightened cut once).
// Every fact on screen comes from the resume data; machine-speak comes from copy.ts.
import {
  AMBER, BG, BODY, BODY_STRONG, BORDER, CW, CYAN, E, FAINT, GREEN, MUTED, P, PANEL, RED, TAU, TEXT,
  buildStreets, cl, dash as drawDash, decode, drawStreets, entPos as streetPos, font, hash, lerp, mulberry32, pad, rgb, trunc,
  type Ent, type RGB, type Streets,
} from './draw';
import { CYAN_TONE, drawDots } from './cat';
import { HIDDEN, LIT } from './catrig';
import { CUT_RATE, DEFAULT_INTRO, TEAR, VARIANT, catCut, catPhase, type CatPhase, type IntroName } from './catphase';
import type { SceneCopy } from './copy';

export { INTROS, DEFAULT_INTRO, along, introName, type IntroName } from './catphase';
/**
 * Home time -> timeline time for the home's cut: the same scenes, cut tighter (boot, sweep,
 * acquire, identify). The cat phase keeps its own pace (catCut): the cat materialises, then moves.
 */
export function homeCut(name: IntroName): number[][] {
  const cat = catCut(name).map(([h, t]) => [4.7 + h, t]);
  const [at, morph] = cat[cat.length - 1];
  const end = at + (10.5 - morph) / CUT_RATE;
  return [[0, 0], [2, 2.5], ...cat, [end, 10.5], [end + 3.5, CUT_END]];
}

export interface MachineData {
  handle: string;
  name: string;
  role: string;
  location: string;
  headline: string;
  stamp: string;
  stats: { value: string; label: string }[];
  projects: { slug: string; status: string; tags: string[] }[];
  stack: { category: string; items: string[] }[];
  experience: { period: string; title: string; company: string }[];
}

export interface MachineOptions {
  /** Machine-speak for the scenes the home intro uses. */
  copy: SceneCopy;
  /** Length of the cut being played, for the HUD progress bar. Defaults to the full intro. */
  total?: number;
  /** Still frame: every line resolved, never caught mid-decode. */
  calm?: boolean;
  /** Which cat opens ACQUIRE. */
  intro?: IntroName;
}

export interface Machine {
  render: (seconds: number) => void;
  /** Call when the canvas box changes; also called by its own ResizeObserver. */
  fit: () => void;
}

// Timeline (seconds). Cuts sit on a 0.5s beat grid (120 BPM).
const IDLE_AT = 25.75; // idle scene starts drawing here...
export const INTRO = 26.5; // ...and has fully settled here
export const LOOP = 12; // idle period: every idle motion divides this
/** The home page stops here: boot, sweep, acquire, identify. */
export const CUT_END = 14;
const FPS = 30;

/** A particle of the handle. Where it sits in the cat before that is the variant's business. */
interface Pt {
  tx: number;
  ty: number;
  r1: number;
  r2: number;
}

export async function createMachine(cv: HTMLCanvasElement, data: MachineData, options: MachineOptions): Promise<Machine | null> {
  const maybe = cv.getContext('2d');
  if (!maybe) return null;
  const ctx: CanvasRenderingContext2D = maybe;
  const c = options.copy;
  const total = options.total ?? INTRO;
  const calm = options.calm ?? false;
  const variant = options.intro ?? DEFAULT_INTRO;
  const MORPH = VARIANT[variant].morph;

  await Promise.all([
    document.fonts.load('400 20px "IBM Plex Mono"'),
    document.fonts.load('500 20px "IBM Plex Mono"'),
  ]).catch(() => undefined);

  // ---- content, uppercased once: the Machine speaks in capitals ----
  const NAME = data.name.toUpperCase();
  const ROLE = data.role.toUpperCase();
  const words = NAME.split(/\s+/).filter(Boolean);
  const half = Math.ceil(words.length / 2);
  const slots = words.length <= 3 ? words : [words.slice(0, half).join(' '), words.slice(half).join(' ')];
  const ROLE_AT = 11 + 0.5 * Math.max(1, slots.length);
  const job = data.experience[0];
  const rows = (
    [
      [c.rows.subject, NAME],
      [c.rows.alias, data.handle],
      [c.rows.designation, ROLE],
      [c.rows.location, data.location.toUpperCase()],
      [c.rows.current, job ? `${job.company} · ${job.period}`.toUpperCase() : ''],
    ] as const
  ).filter((r) => r[1]);
  // Known associations: systems (projects) first, then affiliations (employers).
  const nodes: { title: string; sub: string; tag: string; col: RGB }[] = [
    ...data.projects.slice(0, 4).map((p) => ({ title: p.slug, sub: p.tags.join(' · '), tag: p.status.toUpperCase(), col: GREEN })),
    ...data.experience.slice(0, 2).map((e) => ({ title: e.company, sub: `${e.title} · ${e.period}`, tag: 'AFFILIATION', col: TEXT })),
  ];
  const stats = data.stats.slice(0, 4);
  const ticker = data.stack.map((r) => `${r.category.toUpperCase()} [ ${r.items.join(' · ')} ]`).join('    //    ') + '    //    ';
  const leftCol = data.stack.flatMap((r) => [`> ${r.category.toUpperCase()}`, ...r.items.map((i) => `  ${i}`)]);
  const rightCol = data.experience.flatMap((e) => [e.period.toUpperCase(), e.title.toUpperCase(), `@ ${e.company.toUpperCase()}`, '']);

  const SCENES = ([0, 2.5, 6.5, 10.5, 14, 19, 23, IDLE_AT] as const)
    .map((at, i): [number, string] => [at, c.scenes[i] ?? ''])
    .filter((s) => s[0] < total);
  // Hard cuts (glitch + camera punch) and softer accents (punch only).
  const CUTS = [2.5, 6.5, 10.5, 11, ...slots.slice(1).map((_, i) => 11.5 + i * 0.5), ROLE_AT, 14, 19, 23, IDLE_AT];
  const HITS = [2, 5.25, 10, ...nodes.map((_, i) => 14.5 + i * 0.5), ...stats.map((_, i) => 19.5 + i * 0.5), 24.5];

  // ---- stage (CSS px; rebuilt on resize) ----
  let W = 1;
  let H = 1;
  let dpr = 1;
  let wide = true;
  let m = 28; // HUD margin
  let fs = 12; // small text size
  let top = 0; // content safe area
  let bot = 0;
  let map: Streets = { xs: [], ys: [], ents: [] };
  let ents: Ent[] = [];
  let tracked: number[] = [];
  let idleTracked: number[] = [];
  let pts: Pt[] = [];
  let phase: CatPhase | null = null;
  /** The cat as it is when it starts resolving: where each of its particles is, its tone, and which ones show. */
  let still = { x: new Float32Array(0), y: new Float32Array(0), tone: new Uint8Array(0), seen: new Int32Array(0) };
  /** The handle's particles this frame. */
  let hx = new Float32Array(0);
  let hy = new Float32Array(0);
  let ht = new Uint8Array(0);
  let box = { cx: 0, cy: 0, w: 0, h: 0 };
  let dotPattern: CanvasPattern | null = null;
  let scanPattern: CanvasPattern | null = null;
  let grainPattern: CanvasPattern | null = null;
  let vignette: CanvasGradient | null = null;
  const wrapCache = new Map<string, { lines: string[]; size: number }>();

  // ---- drawing primitives ----
  function txt(s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', weight = 400) {
    ctx.font = font(size, weight);
    ctx.fillStyle = col;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function fill(c: RGB, a = 1) {
    ctx.fillStyle = rgb(c, a);
    ctx.fillRect(-40, -40, W + 80, H + 80);
  }
  function dots(a: number) {
    if (!dotPattern) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = dotPattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  /** Classification tag: filled label, dark text. (x, y) is its bottom-left. */
  function tag(s: string, x: number, y: number, c: RGB, a = 1, size = fs) {
    const w = s.length * size * CW + size;
    const h = size * 1.7;
    ctx.fillStyle = rgb(c, a);
    ctx.fillRect(x, y - h, w, h);
    txt(s, x + size / 2, y - h * 0.3, size, rgb(BG, a), 'left', 500);
    return w;
  }
  /** Corner brackets that snap onto a target: k = 0..1 acquires with overshoot. */
  function lock(cx: number, cy: number, w: number, h: number, k: number, c: RGB, a = 1, lw = 1.5) {
    if (k <= 0) return;
    const s = lerp(1.7, 1, E.outBack(cl(k), 2.4));
    const bw = w * s;
    const bh = h * s;
    const x = cx - bw / 2;
    const y = cy - bh / 2;
    const l = Math.min(28, Math.min(bw, bh) * 0.24);
    ctx.strokeStyle = rgb(c, a * cl(k * 4));
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const [px, py, sx, sy] of [
      [x, y, 1, 1],
      [x + bw, y, -1, 1],
      [x, y + bh, 1, -1],
      [x + bw, y + bh, -1, -1],
    ]) {
      ctx.moveTo(px + sx * l, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py + sy * l);
    }
    ctx.stroke();
  }
  const dash = (points: number[][], k: number, col: string, t: number) => drawDash(ctx, points, k, col, t);
  /** Point where the ray from a rect's centre toward (px, py) leaves the rect. */
  function edge(cx: number, cy: number, hw: number, hh: number, px: number, py: number) {
    const dx = px - cx;
    const dy = py - cy;
    const s = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
    return [cx + dx * s, cy + dy * s];
  }
  /** Masked, staggered letter rise (the kinetic-type move). */
  function rise(str: string, cx: number, base: number, size: number, col: string, t: number, t0: number, stroke = false) {
    const cw = size * CW;
    const x0 = cx - (str.length * cw) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-40, base - size * 0.95, W + 80, size * 1.25);
    ctx.clip();
    ctx.font = font(size, 500);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1.25, size / 70);
    // The whole word lands within 0.2s + one letter's travel, however long it is.
    const stagger = Math.min(0.018, 0.2 / str.length);
    for (let i = 0; i < str.length; i++) {
      const k = E.outExpo(P(t, t0 + i * stagger, t0 + i * stagger + 0.34));
      if (k <= 0) continue;
      const y = base + (1 - k) * size * 1.1;
      if (stroke) ctx.strokeText(str[i], x0 + i * cw, y);
      else ctx.fillText(str[i], x0 + i * cw, y);
    }
    ctx.restore();
    return x0;
  }
  const bigSize = (str: string, maxH = H * 0.42, maxW = W * 0.86) => Math.min(maxH, maxW / (Math.max(1, str.length) * CW));
  /** Largest mono size at which str wraps into maxW x maxH. */
  function fitWrap(str: string, maxW: number, maxH: number, maxSize: number) {
    const key = `${str}|${maxW | 0}|${maxH | 0}|${maxSize | 0}`;
    const hit = wrapCache.get(key);
    if (hit) return hit;
    const tokens = str.split(/\s+/).filter(Boolean);
    let best = { lines: [str], size: 10 };
    for (let size = Math.floor(maxSize); size >= 10; size--) {
      const cpl = Math.floor(maxW / (size * CW));
      if (tokens.some((w) => w.length > cpl)) continue;
      const lines: string[] = [];
      for (const w of tokens) {
        const last = lines.length - 1;
        if (last >= 0 && lines[last].length + 1 + w.length <= cpl) lines[last] += ' ' + w;
        else lines.push(w);
      }
      if (lines.length * size * 1.18 <= maxH) {
        best = { lines, size };
        break;
      }
    }
    wrapCache.set(key, best);
    return best;
  }

  // ---- the map: streets with entities patrolling them (12s-periodic) ----
  const entPos = (e: Ent, t: number) => streetPos(map, e, t);
  function buildMap() {
    map = buildStreets(W, H, LOOP);
    ents = map.ents;
    // Tracked = spread-out entities clear of the HUD and the big counter.
    tracked = [];
    const want = wide ? 13 : 7;
    const gap = wide ? 170 : 100;
    const chosen = [0];
    const clash = (i: number) =>
      [3, 4, 5, 5.6].some((time) => {
        const p = entPos(ents[i], time);
        if (p[0] < m + 30 || p[0] > W - m - (wide ? 150 : 90) || p[1] < top + 30 || p[1] > bot - 40) return true;
        if (p[0] < W * 0.36 && p[1] > H * 0.58) return true;
        return chosen.some((j) => {
          const q = entPos(ents[j], time);
          return Math.abs(q[0] - p[0]) < gap && Math.abs(q[1] - p[1]) < 56;
        });
      });
    for (let i = 1; i < ents.length && tracked.length < want; i++) {
      if (clash(i)) continue;
      chosen.push(i);
      tracked.push(i);
    }
    idleTracked = tracked
      .filter((i) => {
        const p = entPos(ents[i], 0);
        return Math.abs(p[0] - W / 2) > W * (wide ? 0.24 : 0.3) || Math.abs(p[1] - H * 0.46) > H * 0.24;
      })
      .slice(0, wide ? 5 : 3);
  }
  const drawMap = (t: number, a: number) => drawStreets(ctx, map, t, a, W, H);

  // ---- particles: a cat (catphase.ts) that resolves into the handle ----
  function buildParticles() {
    box = wide
      ? { cx: W * 0.355, cy: (top + bot) / 2 - 6, w: W * 0.47, h: Math.min((bot - top) * 0.56, W * 0.26) }
      : { cx: W / 2, cy: top + 34 + H * 0.19, w: W - 2 * m - 20, h: H * 0.38 };
    phase = catPhase(variant, { ...box, wide });
    const cat = phase.frame(MORPH);
    const seen: number[] = [];
    for (let i = 0; i < cat.n; i++) if (cat.tone[i] !== HIDDEN) seen.push(i);
    still = { x: cat.x.slice(), y: cat.y.slice(), tone: cat.tone.slice(), seen: Int32Array.from(seen) };
    const ow = Math.max(8, Math.round(box.w));
    const oh = Math.max(8, Math.round(box.h));
    const off = document.createElement('canvas');
    off.width = ow;
    off.height = oh;
    const o = off.getContext('2d', { willReadFrequently: true });
    const found: number[][] = [];
    if (o) {
      const label = data.handle || '>_';
      const size = Math.min(oh * 0.74, (ow * 0.84) / (label.length * CW));
      o.font = font(size, 500);
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillStyle = '#fff';
      o.fillText(label, ow / 2, oh / 2);
      const px = o.getImageData(0, 0, ow, oh).data;
      for (let y = 0; y < oh; y += 2) {
        for (let x = (y / 2) % 2; x < ow; x += 2) if (px[(y * ow + x) * 4 + 3] > 128) found.push([x, y]);
      }
    }
    if (found.length === 0) found.push([ow / 2, oh / 2]);
    const rnd = mulberry32(7);
    for (let i = found.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [found[i], found[j]] = [found[j], found[i]];
    }
    // At least one handle particle for every particle of the cat, so none of the cat's vanishes when they leave.
    const n = Math.max(wide ? 3400 : 1700, seen.length);
    pts = Array.from({ length: n }, (_, i) => {
      const f = found[i % found.length];
      return { tx: box.cx - ow / 2 + f[0], ty: box.cy - oh / 2 + f[1], r1: rnd(), r2: rnd() };
    });
    hx = new Float32Array(n);
    hy = new Float32Array(n);
    ht = new Uint8Array(n);
  }

  // =====================================================================
  // 0.0 – 2.5  BOOT: cursor -> line -> slit opens on a reticle coming online
  // =====================================================================
  const LOG = c.log;
  const logWidth = Math.max(...LOG.map((l) => l[0].length)) + 3;
  function boot(t: number) {
    fill(BG);
    const cx = W / 2;
    const cy = H / 2;
    if (t < 0.5) {
      if (Math.floor(t * 8) % 2 === 0) {
        ctx.fillStyle = rgb(TEXT);
        ctx.fillRect(cx - 5, cy - 9, 10, 18);
      }
      return;
    }
    if (t < 1) {
      // Anticipation: the cursor squashes back before it fires into a line.
      const pull = E.inOutCubic(P(t, 0.5, 0.62));
      const fire = E.outExpo(P(t, 0.62, 0.98));
      const hw = lerp(lerp(5, 2.5, pull), W / 2 + 40, fire);
      const hh = lerp(lerp(9, 12, pull), 1, cl(fire * 6));
      ctx.fillStyle = rgb(TEXT);
      ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
      return;
    }
    const open = E.inOutQuint(P(t, 1, 1.5));
    const h = lerp(2, H + 80, open);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-40, cy - h / 2, W + 80, h);
    ctx.clip();
    dots(1);

    const R = Math.min(W, H) * 0.27;
    const k = E.inOutCubic(P(t, 1.1, 2));
    const on = t >= 2;
    const col = on ? GREEN : TEXT;
    const snap = on ? 1 + 0.14 * Math.exp(-(t - 2) * 10) : lerp(0.86, 1, E.outBack(P(t, 1, 1.5)));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(snap, snap);
    ctx.lineWidth = 1.25;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU - Math.PI / 2;
      const lit = i / 72 <= k;
      const r0 = R * (i % 6 === 0 ? 0.9 : 0.95);
      ctx.strokeStyle = rgb(lit ? col : FAINT, lit ? 0.95 : 0.7);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.strokeStyle = rgb(col);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.1, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgb(MUTED);
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.74, t * 0.8, t * 0.8 + TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const a = -t * 0.6 + (i * TAU) / 4;
      ctx.strokeStyle = rgb(col, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.24, a, a + 0.5);
      ctx.stroke();
      const b = (i * TAU) / 4;
      ctx.strokeStyle = rgb(FAINT);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(b) * R * 1.34, Math.sin(b) * R * 1.34);
      ctx.lineTo(Math.cos(b) * R * 1.6, Math.sin(b) * R * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    if (on) {
      // Shock ring on the beat.
      const sk = P(t, 2, 2.5);
      ctx.strokeStyle = rgb(GREEN, 0.6 * (1 - sk));
      ctx.lineWidth = 1 + 4 * (1 - sk);
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1.1 + E.outExpo(sk) * 1.2), 0, TAU);
      ctx.stroke();
    }
    const size = R * 0.36;
    txt(on ? c.online : `${pad(Math.floor(k * 100), 3)}%`, cx, cy + size * 0.2, size, rgb(col), 'center', 500);
    txt(on ? c.nominal : c.initializing, cx, cy + size * 0.2 + fs * 2, fs, rgb(MUTED), 'center');

    LOG.forEach(([key, val], i) => {
      const t0 = 1.15 + i * 0.2;
      if (t < t0) return;
      const y = top + fs * 2 + i * fs * 1.7;
      const line = `> ${key} ${'.'.repeat(logWidth - key.length)} `;
      const n = Math.floor(P(t, t0, t0 + 0.15) * line.length);
      txt(line.slice(0, n), m + 10, y, fs, rgb(MUTED));
      if (t > t0 + 0.15) {
        txt(decode(val, P(t, t0 + 0.15, t0 + 0.4), t, i), m + 10 + line.length * fs * CW, y, fs, rgb(i === 4 ? TEXT : GREEN));
      }
    });
    ctx.restore();
    if (open < 1) {
      ctx.fillStyle = rgb(TEXT);
      ctx.fillRect(-40, cy - h / 2 - 1, W + 80, 1.5);
      ctx.fillRect(-40, cy + h / 2 - 0.5, W + 80, 1.5);
    }
  }

  // =====================================================================
  // 2.5 – 6.5  SWEEP: a scan bar crosses the map; everyone is boxed white
  // (irrelevant) until one entity comes back red (unidentified)
  // =====================================================================
  function sweep(t: number) {
    fill(BG);
    const subj = entPos(ents[0], t);
    const follow = E.inOutCubic(P(t, 5.25, 6.3));
    const zoom = lerp(1.08, 1, P(t, 2.5, 5.5)) * lerp(1, 9, E.inExpo(P(t, 5.7, 6.5)));
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-lerp(W / 2, subj[0], follow), -lerp(H / 2, subj[1], follow));
    drawMap(t, 1);

    const barX = lerp(-60, W + 60, P(t, 2.55, 5));
    const tOn = (x: number) => 2.55 + ((x + 60) / (W + 120)) * 2.45;
    const release = P(t, 5.5, 5.75);
    const size = wide ? 40 : 26;
    const pos = tracked.map((i) => entPos(ents[i], t));
    // Dashed associations between consecutive tracked entities.
    for (let j = 1; j < pos.length; j++) {
      const k = P(t, Math.max(tOn(pos[j][0]), tOn(pos[j - 1][0])) + 0.15, Math.max(tOn(pos[j][0]), tOn(pos[j - 1][0])) + 0.5);
      if (j % 2 === 1 || !wide) dash([pos[j - 1], pos[j]], E.outCubic(k), rgb(MUTED, 0.6 * (1 - release)), t);
    }
    tracked.forEach((i, j) => {
      const [x, y] = pos[j];
      const k = P(t, tOn(x), tOn(x) + 0.32);
      if (k <= 0 || release >= 1) return;
      const a = 1 - release;
      lock(x, y, size, size, k, TEXT, a, 1.25);
      if (k > 0.5) {
        txt(decode(`ID ${ents[i].id}`, P(t, tOn(x) + 0.15, tOn(x) + 0.5), t, i), x + size / 2 + 8, y - 2, fs + 1, rgb(TEXT, a), 'left', 500);
        if (wide) txt(c.irrelevant, x + size / 2 + 8, y + fs + 2, fs - 1, rgb(MUTED, a));
      }
    });
    // The scan bar, with a trailing wash.
    if (barX < W + 60) {
      const g = ctx.createLinearGradient(barX - 160, 0, barX, 0);
      g.addColorStop(0, rgb(TEXT, 0));
      g.addColorStop(1, rgb(TEXT, 0.09));
      ctx.fillStyle = g;
      ctx.fillRect(barX - 160, -40, 160, H + 80);
      ctx.fillStyle = rgb(TEXT, 0.85);
      ctx.fillRect(barX, -40, 1.5, H + 80);
    }
    // The subject: flagged red on the beat.
    const rk = P(t, 5.25, 5.6);
    if (rk > 0) {
      const pulse = 1 + 0.08 * Math.sin((t - 5.25) * TAU * 2);
      lock(subj[0], subj[1], size * 1.5 * pulse, size * 1.5 * pulse, rk, RED, 1, 2);
      const sk = P(t, 5.25, 6);
      ctx.strokeStyle = rgb(RED, 0.7 * (1 - sk));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(subj[0], subj[1], 10 + E.outExpo(sk) * 120, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgb(RED);
      ctx.fillRect(subj[0] - 2.5, subj[1] - 2.5, 5, 5);
      if (rk > 0.4) tag(c.unidentified, subj[0] - size * 0.75, subj[1] - size * 0.75 - 6, RED);
    }
    ctx.restore();

    // Big counter: how many entities the bar has seen.
    const fade = 1 - P(t, 5.7, 6.1);
    const seen = ents.filter((e) => entPos(e, t)[0] < barX).length;
    const big = Math.min(H * 0.2, W * 0.17);
    txt(pad(seen, 3), m + 10, bot - 6, big, rgb(t >= 5.25 ? RED : TEXT, fade), 'left', 500);
    txt(t >= 5.25 ? c.oneUnidentified : c.inFrame, m + 12, bot - 6 - big * 0.86, fs, rgb(t >= 5.25 ? RED : MUTED, fade));
  }

  // =====================================================================
  // 6.5 – 10.5  ACQUIRE: red box -> amber analysis -> cyan lock, while
  // noise resolves into the handle and the record decodes
  // =====================================================================
  function acquire(t: number) {
    fill(BG);
    dots(0.8);
    const { cx, cy, w, h } = box;
    const locked = t >= 10;
    const state: RGB = locked ? CYAN : t >= 7 ? AMBER : RED;
    const label = locked ? c.confirmed : t >= 7 ? c.analyzing : c.unidentified;

    // Particles: the cat, then the handle. They leave left to right, each on a small arc.
    const sweepX = lerp(box.cx - w * 0.6, box.cx + w * 0.6, E.inOutCubic(P(t, 10, 10.45)));
    const pace = Math.min(1, (9.86 - MORPH) / 1.14);
    const leave = 1 - P(t, MORPH, MORPH + 0.16);
    if (phase) {
      phase.under?.(ctx, t, leave);
      if (t < MORPH) {
        const cat = phase.frame(t);
        drawDots(ctx, cat.x, cat.y, cat.tone, cat.n);
      } else {
        // Each particle of the handle starts on one of the cat's (all of them used, evenly).
        const V = still.seen.length;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const c = still.seen[Math.floor((i * V) / pts.length)];
          const del = MORPH + (((p.tx - (cx - w / 2)) / w) * 0.4 + p.r1 * 0.12) * pace;
          const k = E.inOutCubic(P(t, del, del + 0.62 * pace));
          const arc = Math.sin(k * Math.PI);
          const x = lerp(still.x[c], p.tx, k) + arc * (p.r1 - 0.5) * 120;
          hx[i] = x;
          hy[i] = lerp(still.y[c], p.ty, k) - arc * (30 + p.r2 * 90) * (p.r2 < 0.5 ? 1 : -1);
          ht[i] = locked && x < sweepX ? CYAN_TONE : k > 0.5 ? LIT : still.tone[c];
        }
        drawDots(ctx, hx, hy, ht, pts.length);
      }
      phase.over?.(ctx, t, leave);
    }

    // Box, scan line, tag.
    lock(cx, cy, w, h, P(t, 6.5, 6.95), state, 1, 2);
    if (locked) {
      const fk = P(t, 10, 10.5);
      ctx.fillStyle = rgb(CYAN, 0.16 * Math.exp(-(t - 10) * 8));
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      lock(cx, cy, w * (1 + 0.16 * E.outExpo(fk)), h * (1 + 0.24 * E.outExpo(fk)), 1, CYAN, 1 - fk, 1);
    } else if (t >= 7) {
      const sy = cy - h / 2 + (((t - 7) % 1) * h);
      const g = ctx.createLinearGradient(0, sy - 40, 0, sy);
      g.addColorStop(0, rgb(AMBER, 0));
      g.addColorStop(1, rgb(AMBER, 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(cx - w / 2, Math.max(cy - h / 2, sy - 40), w, Math.min(40, sy - (cy - h / 2)));
      ctx.fillStyle = rgb(AMBER, 0.8);
      ctx.fillRect(cx - w / 2, sy, w, 1);
    }
    if (t > 6.7) {
      // The tag re-types whenever the classification changes.
      const since = locked ? 10 : t >= 7 ? 7 : 6.7;
      tag(decode(label, P(t, since, since + 0.25), t, 3), cx - w / 2, cy - h / 2 - 8, state);
    }

    // Match meter under the box.
    const match = locked ? 1 : E.inOutCubic(P(t, 7, 10)) * 0.992;
    const my = cy + h / 2 + fs * 2.2;
    const mk = E.outExpo(P(t, 6.9, 7.4));
    txt(c.match, cx - w / 2, my, fs, rgb(MUTED, mk));
    const bx = cx - w / 2 + fs * CW * (c.match.length + 2);
    const bw = (w - fs * CW * (c.match.length + 10)) * mk;
    ctx.fillStyle = rgb(BORDER);
    ctx.fillRect(bx, my - fs * 0.55, bw, 3);
    ctx.fillStyle = rgb(state);
    ctx.fillRect(bx, my - fs * 0.55, bw * match, 3);
    txt(`${(match * 100).toFixed(1).padStart(5, '0')}%`, cx + w / 2, my, fs, rgb(locked ? CYAN : TEXT, mk), 'right', 500);

    // The record, one field per beat.
    const px = wide ? cx + w / 2 + W * 0.07 : cx - w / 2;
    const py = wide ? cy - h / 2 + fs : my + fs * 3;
    const maxW = W - m - 12 - px;
    const vs = W >= 1100 ? 24 : wide ? 17 : fs + 3;
    rows.forEach(([key, val], i) => {
      const t0 = 7 + i * 0.5;
      if (t < t0) return;
      const k = P(t, t0, t0 + 0.45);
      const lit = locked && i === 0;
      if (wide) {
        const y = py + i * Math.max((fs + vs) * 1.75, h / rows.length);
        ctx.fillStyle = rgb(lit ? CYAN : t < t0 + 0.5 ? AMBER : FAINT);
        ctx.fillRect(px - 12, y - fs * 0.8, 2, fs + vs * 1.35);
        txt(key, px, y, fs, rgb(MUTED));
        txt(decode(trunc(val, Math.floor(maxW / (vs * CW))), k, t, i + 11), px, y + vs * 1.35, vs, rgb(lit ? CYAN : TEXT), 'left', 500);
      } else {
        const y = py + i * vs * 2.1;
        txt(key, px, y, fs - 1, rgb(MUTED));
        txt(decode(trunc(val, Math.floor((maxW - fs * CW * 12) / (vs * CW))), k, t, i + 11), px + (fs - 1) * CW * 13, y, vs, rgb(lit ? CYAN : TEXT), 'left', 500);
      }
    });
  }

  // =====================================================================
  // 10.5 – 14  IDENTIFY: kinetic type, one word per beat. The accent is
  // spent once, full-bleed, on the classification; then name, then role.
  // =====================================================================
  function note(s: string, y: number, c: RGB, t: number, t0: number) {
    const k = E.outExpo(P(t, t0, t0 + 0.3));
    txt(s, W / 2, y + (1 - k) * 14, fs + 1, rgb(c, k * 0.9), 'center');
  }
  function roleBlock(t: number) {
    const f = fitWrap(ROLE, W * 0.8, H * 0.4, Math.min(H * 0.3, 150));
    const lh = f.size * 1.14;
    const bw = Math.max(...f.lines.map((l) => l.length)) * f.size * CW;
    const bh = f.lines.length * lh;
    const y0 = H / 2 - bh / 2;
    f.lines.forEach((line, i) => {
      const k = P(t, ROLE_AT + i * 0.12, ROLE_AT + i * 0.12 + 0.6);
      txt(decode(line, k, t, i + 40), W / 2, y0 + i * lh + f.size * 0.86, f.size, rgb(TEXT), 'center', 500);
    });
    const padX = wide ? 36 : 14;
    lock(W / 2, H / 2, bw + padX * 2, bh + padX * 1.4, P(t, ROLE_AT + 0.25, ROLE_AT + 0.7), TEXT, 1, 2);
    if (t > ROLE_AT + 0.5) {
      tag(decode(c.designation, P(t, ROLE_AT + 0.5, ROLE_AT + 0.75), t, 5), W / 2 - bw / 2 - padX, y0 - padX * 0.7 - 8, TEXT);
    }
    if (t > ROLE_AT + 0.75) {
      const s = trunc([data.location.toUpperCase(), data.handle].filter(Boolean).join('  ·  '), Math.floor((W * 0.86) / ((fs + 2) * CW)));
      txt(decode(s, P(t, ROLE_AT + 0.75, ROLE_AT + 1.2), t, 6), W / 2, y0 + bh + padX * 0.7 + fs * 2.6, fs + 2, rgb(BODY), 'center');
    }
  }
  function identity(t: number) {
    if (t < 11) {
      fill(CYAN);
      const size = bigSize(c.asset);
      rise(c.asset, W / 2, H / 2 + size * 0.34, size, rgb(BG), t, 10.47);
      note(`[ ${c.classification} ]`, H / 2 - size * 0.52, BG, t, 10.5);
      return;
    }
    fill(BG);
    if (t < ROLE_AT) {
      const i = Math.min(slots.length - 1, Math.floor((t - 11) / 0.5));
      const t0 = 11 + i * 0.5 - 0.03;
      const s = slots[i];
      const size = bigSize(s);
      const base = H / 2 + size * 0.34;
      if (i % 2 === 1) {
        // Outline rises, then a solid fill wipes through it.
        const x0 = rise(s, W / 2, base, size, rgb(TEXT), t, t0, true);
        const wipe = E.inOutCubic(P(t, t0 + 0.14, t0 + 0.42));
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 - 10, 0, (s.length * size * CW + 20) * wipe, H);
        ctx.clip();
        rise(s, W / 2, base, size, rgb(TEXT), t, t0);
        ctx.restore();
      } else {
        rise(s, W / 2, base, size, rgb(TEXT), t, t0);
      }
      note(`[ ${c.subject} ${i + 1} / ${slots.length} ]`, H / 2 - size * 0.52, MUTED, t, t0);
      return;
    }
    // Role, then a slice-glitch exit.
    const slice = E.inExpo(P(t, 13.72, 14));
    if (slice <= 0) return roleBlock(t);
    const strips = 14;
    const sh = H / strips;
    for (let s = 0; s < strips; s++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40, s * sh, W + 80, sh + 0.5);
      ctx.clip();
      ctx.translate((s % 2 ? 1 : -1) * (0.6 + hash(s) * 0.8) * slice * W * 1.2, 0);
      roleBlock(t);
      ctx.restore();
    }
  }

  // =====================================================================
  // 14 – 19  SYSTEMS: the asset at the centre, its projects acquired one
  // per beat and wired to it; the stack runs underneath as telemetry
  // =====================================================================
  function network(t: number) {
    fill(BG);
    dots(0.8);
    const exit = E.inExpo(P(t, 18.6, 19));
    const big = W >= 1100;
    const list = wide ? nodes : nodes.slice(0, 4);
    const n = list.length;
    const midY = (top + bot) / 2 - fs;
    const nodeX = W / 2;
    const nodeY = wide ? midY : top + 66;
    const hs = big ? 40 : wide ? 30 : 18;
    const nw = data.handle.length * hs * CW + (wide ? 60 : 36);
    const nh = hs * 2.2;
    const rx = W * 0.31;
    const ry = (bot - top) * 0.3;
    const seen = Math.min(n, Math.max(0, Math.floor((t - 14) / 0.5)));

    if (wide) {
      // Orbits and a radar sweep give the graph a ground to sit on.
      const ok = E.outExpo(P(t, 14, 14.9)) * (1 - exit);
      ctx.save();
      ctx.translate(nodeX, nodeY);
      ctx.scale(1, ry / rx);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      [0.55, 1, 1.5].forEach((r, i) => {
        ctx.strokeStyle = rgb(MUTED, 0.8 - i * 0.2);
        ctx.beginPath();
        ctx.arc(0, 0, rx * r, -Math.PI / 2, -Math.PI / 2 + TAU * ok * (i % 2 ? -1 : 1), i % 2 === 1);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (let i = 0; i < 24; i++) {
        const a = t * 0.9 - i * 0.03;
        ctx.fillStyle = rgb(CYAN, 0.05 * ok * (1 - i / 24));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rx * 1.5, a - 0.032, a);
        ctx.fill();
      }
      ctx.strokeStyle = rgb(CYAN, 0.5 * ok);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t * 0.9) * rx * 1.5, Math.sin(t * 0.9) * rx * 1.5);
      ctx.stroke();
      ctx.restore();
      const cs = big ? 72 : 48;
      txt('KNOWN ASSOCIATIONS', m + 12, top + fs * 2, fs, rgb(MUTED, 1 - exit));
      txt(pad(seen, 2), m + 10, top + fs * 2 + cs * 0.95, cs, rgb(TEXT, 1 - exit), 'left', 500);
    } else {
      txt('KNOWN ASSOCIATIONS', m + 10, top + fs * 2, fs, rgb(MUTED));
      txt(pad(seen, 2), W - m - 10, top + fs * 2, fs, rgb(TEXT), 'right', 500);
    }

    const ts = big ? 20 : wide ? 16 : fs + 3;
    for (let i = 0; i < n; i++) {
      const node = list[i];
      const t0 = 14.5 + i * 0.5;
      const room = Math.floor((W - 2 * m - 76) / (ts * CW));
      const title = trunc(node.title, wide ? 30 : room);
      const sub = trunc(node.sub, wide ? 40 : Math.floor((W - 2 * m - 76) / ((fs - 1) * CW)));
      const bw = wide ? Math.max(title.length * ts * CW, sub.length * (fs - 1) * CW) + 40 : W - 2 * m - 44;
      const bh = ts + fs * 3.4;
      let x: number;
      let y: number;
      let path: number[][];
      if (wide) {
        const a = -Math.PI / 2 + (TAU * (i + 0.5)) / n + 0.04 * Math.sin(t * 0.6 + i);
        x = cl(nodeX + Math.cos(a) * rx, m + 16 + bw / 2, W - m - 16 - bw / 2);
        y = nodeY + Math.sin(a) * ry;
        path = [edge(nodeX, nodeY, nw / 2 + 10, nh / 2 + 10, x, y), edge(x, y, bw / 2 + 8, bh / 2 + 8, nodeX, nodeY)];
      } else {
        const busX = m + 14;
        x = busX + 20 + bw / 2;
        y = top + 164 + i * Math.min(bh + 62, (bot - top - 220) / Math.max(1, n - 1));
        path = [
          [nodeX - nw / 2 - 8, nodeY],
          [busX, nodeY],
          [busX, y],
          [x - bw / 2 - 6, y],
        ];
      }
      dash(path, E.outExpo(P(t, t0 - 0.35, t0 + 0.1)) * (1 - exit), rgb(BODY, 0.9), t);
      if (t > t0 && exit <= 0) {
        // A packet rides each link once it is up.
        const u = ((t - t0) * 0.7 + i * 0.37) % 1;
        const seg = wide ? [path[0], path[1]] : [path[1], path[2]];
        ctx.fillStyle = rgb(CYAN);
        ctx.fillRect(lerp(seg[0][0], seg[1][0], u) - 2.5, lerp(seg[0][1], seg[1][1], u) - 2.5, 5, 5);
      }
      const k = P(t, t0, t0 + 0.35) * (1 - exit);
      if (k <= 0) continue;
      ctx.fillStyle = rgb(PANEL, cl(k * 2));
      ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
      lock(x, y, bw, bh, k, TEXT, 1 - exit, 1.5);
      const left = x - bw / 2 + (wide ? 20 : 14);
      txt(decode(title, P(t, t0 + 0.05, t0 + 0.5), t, i + 20), left, y + ts * 0.05, ts, rgb(TEXT, 1 - exit), 'left', 500);
      txt(decode(sub, P(t, t0 + 0.2, t0 + 0.7), t, i + 30), left, y + ts * 0.05 + fs * 1.7, fs - 1, rgb(BODY, 1 - exit));
      if (t > t0 + 0.25) tag(node.tag, x - bw / 2, y - bh / 2 - 6, node.col, 1 - exit, fs - 1);
    }

    // The asset node: it kicks on every acquisition.
    const nk = P(t, 14, 14.4);
    ctx.fillStyle = rgb(BG);
    ctx.fillRect(nodeX - nw / 2, nodeY - nh / 2, nw, nh);
    let kick = 1;
    for (let i = 0; i < n; i++) if (t >= 14.5 + i * 0.5) kick += 0.08 * Math.exp(-(t - 14.5 - i * 0.5) * 9);
    lock(nodeX, nodeY, nw * kick, nh * kick, nk, CYAN, 1, 2);
    txt(decode(data.handle, P(t, 14, 14.4), t, 9), nodeX, nodeY + hs * 0.34, hs, rgb(TEXT), 'center', 500);
    if (t > 14.25) tag('ASSET', nodeX - nw / 2, nodeY - nh / 2 - 8, CYAN);

    // Stack ticker.
    const tk = E.outExpo(P(t, 14.2, 14.8)) * (1 - exit);
    const tw = ticker.length * fs * CW;
    const tx = -(((t - 14) * 70) % tw);
    ctx.fillStyle = rgb(BORDER, tk);
    ctx.fillRect(m + 10, bot - fs * 1.9, (W - 2 * m - 20) * tk, 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(m + 10, bot - fs * 2, W - 2 * m - 20, fs * 2.4);
    ctx.clip();
    for (let x = tx; x < W; x += tw) txt(ticker, m + 10 + x, bot - 2, fs, rgb(BODY, tk));
    ctx.restore();
  }

  // =====================================================================
  // 19 – 23  RECORD: the numbers, one band per beat
  // =====================================================================
  function record(t: number) {
    fill(BG);
    const n = stats.length;
    if (n === 0) return;
    const y0 = top + 6;
    const bh = (bot - 6 - y0) / n;
    const longest = Math.max(...stats.map((s) => s.value.length));
    const size = Math.min(bh * 0.74, (W * (wide ? 0.4 : 0.44)) / (longest * CW));
    stats.forEach((s, i) => {
      const dir = i % 2 ? 1 : -1;
      const t0 = 19 + i * 0.5;
      const kin = E.outExpo(P(t, t0 - 0.04, t0 + 0.5));
      const kout = E.inExpo(P(t, 22.55 + i * 0.06, 22.95 + i * 0.06));
      if (kin <= 0) return;
      const off = dir * (1 - kin) * W * 1.05 - dir * kout * W * 1.05;
      const y = y0 + i * bh;
      ctx.save();
      ctx.translate(off, 0);
      ctx.fillStyle = rgb(i % 2 ? BG : PANEL);
      ctx.fillRect(-4, y, W + 8, bh);
      ctx.fillStyle = rgb(BORDER);
      ctx.fillRect(-4, y, W + 8, 1);
      // Speed streaks while the band is moving.
      const vel = 1 - kin + kout;
      if (vel > 0.02 && vel < 0.98) {
        ctx.fillStyle = rgb(CYAN, 0.5);
        for (let j = 0; j < 4; j++) ctx.fillRect(dir > 0 ? -260 * vel - 20 : W + 20, y + bh * (0.2 + j * 0.2), 260 * vel, 2);
      }
      const drift = (t - 21) * (i % 2 ? -6 : 6);
      const vx = m + 20 + drift;
      const base = y + bh / 2 + size * 0.34;
      txt(decode(s.value, P(t, t0 + 0.1, t0 + 0.75), t, i + 50), vx, base, size, rgb(CYAN), 'left', 500);
      const lx = W - m - 20 - drift;
      const label = s.label.toUpperCase();
      const avail = lx - (vx + longest * size * CW) - 30;
      const ls = cl(avail / (label.length * CW), 9, W >= 1100 ? 28 : wide ? 20 : 13);
      const lk = E.outExpo(P(t, t0 + 0.2, t0 + 0.7));
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40, y, W + 80, bh);
      ctx.clip();
      txt(label, lx, y + bh / 2 + ls * 0.6 + (1 - lk) * bh, ls, rgb(TEXT), 'right', 500);
      ctx.restore();
      txt(`RECORD ${pad(i + 1, 2)} / ${pad(n, 2)}`, lx, y + bh / 2 - ls * 0.9, fs - 1, rgb(MUTED, lk), 'right');
      const rx0 = vx + s.value.length * size * CW + 24;
      const rx1 = lx - label.length * ls * CW - 24;
      if (rx1 > rx0) {
        ctx.fillStyle = rgb(FAINT);
        ctx.fillRect(rx0, y + bh / 2, (rx1 - rx0) * E.outExpo(P(t, t0 + 0.3, t0 + 0.9)), 1);
      }
      ctx.restore();
    });
  }

  // =====================================================================
  // 23 – 25.75  ASSESS: black interstitial, the verdict typed out, then
  // the frame collapses to a line and a point
  // =====================================================================
  function assess(t: number) {
    fill(BG);
    const f = fitWrap(data.headline, W * (wide ? 0.72 : 0.84), H * 0.42, wide ? 64 : 30);
    const lh = f.size * 1.22;
    const bw = Math.max(...f.lines.map((l) => l.length)) * f.size * CW;
    const bh = f.lines.length * lh;
    const x0 = W / 2 - bw / 2;
    const y0 = H / 2 - bh / 2;
    const close = E.inOutQuint(P(t, 25, 25.4));
    const shrink = E.inExpo(P(t, 25.4, 25.75));
    if (close >= 1) {
      const hw = (W / 2) * (1 - shrink);
      ctx.fillStyle = rgb(TEXT);
      ctx.fillRect(W / 2 - hw - 2, H * 0.46 - 1, hw * 2 + 4, 2);
      return;
    }
    const cy = lerp(H / 2, H * 0.46, close);
    const hh = lerp(H, 1, close);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-40, cy - hh / 2, W + 80, hh);
    ctx.clip();
    const total = f.lines.join(' ').length;
    const typed = Math.floor(P(t, 23.25, 24.4) * total);
    let seen = 0;
    f.lines.forEach((line, i) => {
      const n = cl(typed - seen, 0, line.length);
      const y = y0 + i * lh + f.size * 0.86;
      txt(line.slice(0, n), x0, y, f.size, rgb(TEXT), 'left', 500);
      const here = typed >= seen && typed <= seen + line.length && (i === f.lines.length - 1 || typed < seen + line.length);
      if (here && (typed < total || Math.floor(t * 4) % 2 === 0)) {
        ctx.fillStyle = rgb(GREEN);
        ctx.fillRect(x0 + n * f.size * CW + 3, y - f.size * 0.78, f.size * 0.5, f.size * 0.95);
      }
      seen += line.length + 1;
    });
    const verdict = t >= 24.5;
    tag(decode(verdict ? 'RELEVANT' : 'ASSESSING', P(t, verdict ? 24.5 : 23, verdict ? 24.75 : 23.25), t, 8), x0, y0 - fs * 1.6, verdict ? CYAN : AMBER);
    if (verdict) {
      const k = P(t, 24.5, 24.9);
      lock(W / 2, H / 2, Math.min(bw + (wide ? 90 : 26), W - 2 * m - 8), bh + (wide ? 110 : 80), k, CYAN, 1, 2);
    }
    txt(trunc(`${NAME}  ·  ${ROLE}`, Math.floor(bw / (fs * CW))), x0, y0 + bh + fs * 2.2, fs, rgb(MUTED, P(t, 23.1, 23.4)));
    ctx.restore();
    if (close > 0) {
      ctx.fillStyle = rgb(TEXT);
      ctx.fillRect(-40, cy - hh / 2 - 1, W + 80, 1.5);
      ctx.fillRect(-40, cy + hh / 2 - 0.5, W + 80, 1.5);
    }
  }

  // =====================================================================
  // 25.75 ->  MONITOR: the calm idle loop (12s period). The asset stays
  // locked; the map keeps moving; the Machine keeps watching.
  // =====================================================================
  function column(lines: string[], x: number, align: CanvasTextAlign, tau: number, a: number, seed: number) {
    const lh = fs * 1.7;
    // Long lines wrap by word (continuations keep the indent) instead of being cut mid-word.
    const wrapped = lines.flatMap((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const out: string[] = [];
      for (const word of line.trim().split(/\s+/)) {
        const last = out.length - 1;
        if (last >= 0 && out[last].length + 1 + word.length <= 26) out[last] += ` ${word}`;
        else out.push(indent + word);
      }
      return out.length ? out : [''];
    });
    const shown = wrapped.slice(0, Math.floor((bot - top - 120) / lh));
    const y0 = (top + bot) / 2 - (shown.length * lh) / 2;
    const active = Math.floor((tau / LOOP) * shown.length * 2) % shown.length;
    const local = ((tau / LOOP) * shown.length * 2) % 1;
    shown.forEach((line, i) => {
      const s = line.toUpperCase();
      const on = i === active;
      txt(on && !calm ? decode(s, cl(local * 2.5), tau, seed + i) : s, x, y0 + i * lh, fs, rgb(on ? TEXT : line.startsWith('>') || align === 'right' ? BODY : MUTED, a), align);
    });
  }
  function idle(t: number) {
    fill(BG);
    const k = P(t, IDLE_AT, INTRO);
    const tau = (t - IDLE_AT) % LOOP;
    const ph = (tau / LOOP) * TAU;
    const cols = W >= 1100;
    const cx = W / 2;
    const cy = H * 0.46;
    // The handle is the headline; role, location and the full name sit under it.
    const f = fitWrap((data.handle || NAME).toUpperCase(), W * (cols ? 0.5 : 0.78), H * 0.3, wide ? 88 : 44);
    const size = f.size;
    const lh = size * 1.12;
    const bw = Math.max(...f.lines.map((l) => l.length)) * size * CW + (wide ? 72 : 28);
    const bh = f.lines.length * lh + size;

    drawMap(tau, 0.8 * k);
    // Tracked passers-by, each wired to the asset for part of the loop.
    idleTracked.forEach((i, j) => {
      const local = (tau - j * (LOOP / idleTracked.length) + LOOP) % LOOP;
      const on = P(local, 0, 0.35) * (1 - P(local, 6.2, 6.5)) * k;
      if (on <= 0) return;
      const [x, y] = entPos(ents[i], tau);
      dash([[x, y], edge(cx, cy, bw / 2 + 12, bh / 2 + 12, x, y)], E.outCubic(P(local, 0.2, 1)) , rgb(MUTED, 0.55 * cl(on * 2)), tau);
      lock(x, y, 26, 26, on, TEXT, 0.9, 1.25);
      txt(`ID ${ents[i].id}`, x + 19, y + 4, fs - 2, rgb(BODY, cl(on * 2 - 1)));
    });

    // A soft pool of background keeps the name legible over the map.
    const pool = ctx.createRadialGradient(cx, cy + 20, bh * 0.4, cx, cy + 20, bw * 0.75);
    pool.addColorStop(0, rgb(BG, 0.94 * k));
    pool.addColorStop(1, rgb(BG, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, W, H);

    const breath = 1 + 0.014 * Math.sin(ph * 2);
    lock(cx, cy, bw * breath, bh * (1 + (breath - 1) * 3), k, CYAN, 1, 2);
    f.lines.forEach((line, i) => {
      const y = cy - ((f.lines.length - 1) * lh) / 2 + i * lh + size * 0.34;
      txt(decode(line, P(t, IDLE_AT + 0.1, INTRO), t, 60 + i), cx, y, size, rgb(TEXT), 'center', 500);
    });
    if (k > 0.4) tag('ASSET', cx - bw / 2, cy - bh / 2 - 8, CYAN, cl(k * 2 - 0.8));
    const rk = P(t, IDLE_AT + 0.4, INTRO + 0.4);
    const rs = wide ? 20 : 13;
    txt(decode(trunc(ROLE, Math.floor((W * 0.86) / (rs * CW))), rk, t, 61), cx, cy + bh / 2 + rs * 2.4, rs, rgb(BODY_STRONG), 'center');
    [data.location.toUpperCase(), NAME].filter(Boolean).forEach((line, i) => {
      txt(decode(trunc(line, Math.floor((W * 0.86) / (fs * CW))), rk, t, 62 + i), cx, cy + bh / 2 + rs * 2.4 + fs * 2 * (i + 1), fs, rgb(MUTED), 'center');
    });
    // Status line right of the tag: a slow heartbeat.
    const beat = 0.5 + 0.5 * Math.sin(ph * 6);
    ctx.fillStyle = rgb(GREEN, k * (0.35 + 0.65 * beat));
    ctx.beginPath();
    ctx.arc(cx + bw / 2 - fs * CW * 10 - 10, cy - bh / 2 - 8 - fs * 0.75, 3, 0, TAU);
    ctx.fill();
    txt('MONITORING', cx + bw / 2, cy - bh / 2 - 8 - fs * 0.4, fs, rgb(GREEN, k), 'right');

    if (cols) {
      column(leftCol, m + 12, 'left', tau, k, 70);
      column(rightCol, W - m - 12, 'right', tau, k, 90);
    }

    // Hand-off to the page below.
    const bob = Math.sin(ph * 6) * 3;
    txt('FILE CONTINUES', cx, bot - fs * 2.2, fs, rgb(MUTED, k), 'center');
    ctx.strokeStyle = rgb(GREEN, k);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 6, bot - fs * 1.2 + bob);
    ctx.lineTo(cx, bot - fs * 1.2 + 6 + bob);
    ctx.lineTo(cx + 6, bot - fs * 1.2 + bob);
    ctx.stroke();
  }

  // =====================================================================
  // Global: camera punch, HUD, post (cut glitch, scanlines, grain, vignette)
  // =====================================================================
  function punch(t: number) {
    let k = 1;
    for (const c of CUTS) if (t >= c) k += 0.035 * Math.exp(-(t - c) * 11);
    for (const c of HITS) if (t >= c) k += 0.014 * Math.exp(-(t - c) * 11);
    return k;
  }
  function timecode(t: number) {
    const fr = Math.floor(t * FPS + 1e-6);
    const s = Math.floor(fr / FPS);
    return `${pad(Math.floor(s / 3600), 2)}:${pad(Math.floor(s / 60) % 60, 2)}:${pad(s % 60, 2)}:${pad(fr % FPS, 2)}`;
  }
  function hud(t: number) {
    const inv = t >= 10.5 && t < 11;
    const hi: RGB = inv ? BG : BODY;
    const lo: RGB = inv ? BG : MUTED;
    const a = t < 1 ? 0 : P(t, 1, 1.5);
    if (a <= 0) return;
    ctx.strokeStyle = rgb(hi, a);
    ctx.lineWidth = 1.5;
    const l = wide ? 14 : 9;
    ctx.beginPath();
    for (const [x, y, sx, sy] of [
      [m, m, 1, 1],
      [W - m, m, -1, 1],
      [m, H - m, 1, -1],
      [W - m, H - m, -1, -1],
    ]) {
      ctx.moveTo(x + sx * l, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * l);
    }
    ctx.stroke();

    const ty = m + fs * 1.5;
    const live = t >= IDLE_AT;
    const blink = Math.floor(t * 2) % 2 === 0;
    ctx.fillStyle = rgb(inv ? BG : live ? GREEN : RED, a * (blink ? 1 : 0.3));
    ctx.beginPath();
    ctx.arc(m + 14, ty - fs * 0.35, 3, 0, TAU);
    ctx.fill();
    txt(wide ? c.rec : c.recShort, m + 24, ty, fs, rgb(hi, a));
    txt((wide && data.stamp ? data.stamp + '  ' : '') + timecode(t), W - m - 10, ty, fs, rgb(hi, a), 'right');

    let idx = 0;
    SCENES.forEach((s, i) => {
      if (t >= s[0]) idx = i;
    });
    const by = H - m - fs * 0.7;
    txt(`${pad(idx, 2)} — ${SCENES[idx][1]}`, m + 10, by, fs, rgb(hi, a));
    // Beat blocks.
    const beat = Math.floor(t / 0.5) % 4;
    ctx.fillStyle = rgb(hi, a);
    for (let i = 0; i < 4; i++) {
      const x = W - m - 10 - (4 - i) * 14 + 4;
      if (i === beat && !live) ctx.fillRect(x, by - 10, 10, 11);
      else ctx.fillRect(x, by - 1, 10, 2);
    }
    if (wide) txt(live ? 'LIVE' : '120 BPM', W - m - 10 - 4 * 14 - 8, by, fs, rgb(lo, a), 'right');
    // Progress with a tick per scene.
    const py = by - fs * 1.6;
    const x0 = m + 10;
    const x1 = W - m - 10;
    ctx.fillStyle = rgb(lo, a * 0.5);
    ctx.fillRect(x0, py, x1 - x0, 1);
    ctx.fillStyle = rgb(hi, a);
    ctx.fillRect(x0, py - 1, (x1 - x0) * cl(t / total), live ? 1 : 3);
    for (const s of SCENES) ctx.fillRect(x0 + ((x1 - x0) * s[0]) / total, py - 4, 1, 9);
  }
  function post(t: number) {
    const fr = Math.floor(t * FPS + 1e-6);
    // Signal tear for a few frames after each hard cut.
    let age = 99;
    for (const c of CUTS) if (t >= c) age = Math.min(age, t - c);
    if (age < TEAR) {
      const amt = (1 - age / TEAR) * (wide ? 70 : 30);
      for (let i = 0; i < 7; i++) {
        const sy = hash(fr * 31 + i) * H;
        const sh = 6 + hash(fr * 17 + i * 5) * H * 0.09;
        const dx = (hash(fr * 13 + i * 3) - 0.5) * 2 * amt;
        ctx.drawImage(cv, 0, sy * dpr, cv.width, sh * dpr, dx, sy, W, sh);
      }
      ctx.fillStyle = rgb(TEXT, 0.1 * (1 - age / TEAR));
      ctx.fillRect(0, 0, W, H);
    }
    if (scanPattern) {
      ctx.fillStyle = scanPattern;
      ctx.fillRect(0, 0, W, H);
    }
    if (grainPattern) {
      ctx.save();
      ctx.globalAlpha = 0.03;
      ctx.translate(-((fr * 97) % 128), -((fr * 57) % 128));
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, W + 128, H + 128);
      ctx.restore();
    }
    if (vignette) {
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function render(seconds: number) {
    const t = Math.max(0, seconds);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    const k = punch(t);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.translate(-W / 2, -H / 2);
    if (t < 2.5) boot(t);
    else if (t < 6.5) sweep(t);
    else if (t < 10.5) acquire(t);
    else if (t < 14) identity(t);
    else if (t < 19) network(t);
    else if (t < 23) record(t);
    else if (t < IDLE_AT) assess(t);
    else idle(t);
    ctx.restore();
    hud(t);
    post(t);
  }

  function tile(w: number, h: number, paint: (o: CanvasRenderingContext2D) => void) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const o = c.getContext('2d');
    if (!o) return null;
    paint(o);
    return ctx.createPattern(c, 'repeat');
  }

  let current = 0;
  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, cv.clientWidth);
    H = Math.max(1, cv.clientHeight);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    wide = W >= 820;
    m = wide ? 28 : 14;
    fs = W < 600 ? 10 : W < 1100 ? 11 : 12;
    top = m + fs * 2.2;
    bot = H - m - fs * 3.6;
    wrapCache.clear();
    buildMap();
    buildParticles();
    dotPattern = tile(28, 28, (o) => {
      o.fillStyle = rgb(BORDER);
      o.fillRect(13, 13, 2, 2);
    });
    scanPattern = tile(1, 3, (o) => {
      o.fillStyle = 'rgba(0,0,0,0.12)';
      o.fillRect(0, 2, 1, 1);
    });
    const rnd = mulberry32(1337);
    grainPattern = tile(128, 128, (o) => {
      const id = o.createImageData(128, 128);
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = id.data[i + 1] = id.data[i + 2] = 255;
        id.data[i + 3] = rnd() * 255;
      }
      o.putImageData(id, 0, 0);
    });
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    render(current);
  }
  new ResizeObserver(fit).observe(cv);
  fit();
  return { render: (s) => render((current = s)), fit };
}
