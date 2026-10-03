import { describe, expect, it } from 'vitest';
import { BODY_PART, DUTY, HIDDEN, POUNCE, STRIDE, field, newPose, newShape, place, pouncePose, sitPose, skin, swarm, walkFoot, walkPose, type Swarm } from '../src/components/machine/catrig';
import { DEFAULT_INTRO, INTROS, homeCut } from '../src/components/machine/scene';
import { addedTime } from '../src/components/machine/catphase';

describe('the cat walks, it does not slide', () => {
  const feet = new Float32Array(16);
  const foot = (s: number, leg: number) => {
    walkFoot(s, leg, 1, feet);
    return { x: feet[leg * 4], y: feet[leg * 4 + 1] };
  };

  it('keeps a planted foot where it landed, and moves a raised one a full stride', () => {
    for (let leg = 0; leg < 4; leg++) {
      let planted = 0;
      for (let s = 0; s < STRIDE * 3; s += 0.25) {
        const a = foot(s, leg);
        const b = foot(s + 0.25, leg);
        // No jump at lift-off or landing either: a step never covers more than a stride's worth of travel.
        expect(Math.abs(b.x - a.x)).toBeLessThan(2.5);
        if (a.y === 0 && b.y === 0) {
          expect(b.x).toBeCloseTo(a.x, 4);
          planted++;
        }
      }
      expect(planted / (STRIDE * 12)).toBeGreaterThan(DUTY - 0.05);
      expect(foot(STRIDE * 2, leg).x - foot(STRIDE, leg).x).toBeCloseTo(STRIDE, 4);
    }
  });

  it('always has at least two feet on the ground, never all four in the air', () => {
    for (let s = 0; s < STRIDE; s += 0.1) {
      const down = [0, 1, 2, 3].filter((leg) => foot(s, leg).y === 0).length;
      expect(down).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the silhouette', () => {
  const p = newPose();
  const s = newShape();
  /** How far above the ground the lowest part of the shape is, around x. */
  const gap = (x: number) => {
    let low = Infinity;
    for (let i = 0; i < s.discs.length; i += 3) if (Math.abs(s.discs[i] - x) < 2.5) low = Math.min(low, s.discs[i + 1] - s.discs[i + 2]);
    return low;
  };

  it('stands on its feet: a planted foot is drawn on the ground, walking and sitting', () => {
    for (let t = 0; t < 2.4; t += 0.02) {
      walkPose(p, t);
      skin(p, s);
      for (let leg = 0; leg < 4; leg++) if (p.feet[leg * 4 + 1] === 0) expect(gap(p.feet[leg * 4])).toBeLessThan(0.3);
    }
    sitPose(p);
    skin(p, s);
    for (let leg = 0; leg < 4; leg++) expect(gap(p.feet[leg * 4])).toBeLessThan(0.3);
  });

  it('is a shape at every moment of the pounce, and never goes through the floor', () => {
    for (let t = 0; t < POUNCE.settled + 0.2; t += 0.01) {
      pouncePose(p, t, 20, 2);
      skin(p, s);
      expect(s.discs.every(Number.isFinite)).toBe(true);
      expect(s.polys.every((q) => q.every(Number.isFinite))).toBe(true);
      for (let i = 0; i < s.discs.length; i += 3) expect(s.discs[i + 1] - s.discs[i + 2]).toBeGreaterThan(-1e-6);
    }
  });
});

describe('the outline', () => {
  it('is the distance to the shape: zero on the edge of a lone disc', () => {
    const s = newShape();
    s.discs.push(10, 10, 3);
    s.parts.push(3, BODY_PART);
    const f = field(s, 0.25);
    const at = (x: number, y: number) => f.d[Math.round((y - f.y0) / f.g) * f.nx + Math.round((x - f.x0) / f.g)];
    expect(at(10, 10)).toBeCloseTo(-3, 1);
    expect(Math.abs(at(13, 10))).toBeLessThan(0.15);
    expect(at(14, 10)).toBeGreaterThan(0.8);
  });

});

describe('the particles', () => {
  const p = newPose();
  const s = newShape();
  // The walk (the far legs swing under the near ones, it sits) and a sitting cat whose head turns past the camera.
  const moves = [
    [(t: number) => walkPose(p, t), 0.2, 2.3],
    [(t: number) => sitPose(p, 0.5 * Math.sin(t * 3), Math.cos(t)), 0, 3],
  ] as const;
  const cat = (pose: (t: number) => void, from: number, to: number) => {
    const shapes = [from, (from + to) / 2, to].map((t) => {
      const sh = newShape();
      pose(t);
      skin(p, sh);
      return sh;
    });
    return [0, 1, 2].map(() => swarm(shapes, 0.45, 0.15));
  };
  const at = (pose: (t: number) => void, t: number, w: Swarm) => {
    pose(t);
    skin(p, s);
    place(w, s, field(s, 0.3), 0, 0, 1);
  };

  it('keep their place on the body: over three frames close together, no particle jumps', () => {
    // A particle re-sampled or swapped with another would jump about one spacing (0.45) between frames;
    // one that follows its place moves smoothly, and its second difference all but vanishes.
    const dt = 1 / 3840;
    for (const [pose, from, to] of moves) {
      const w = cat(pose, from, to);
      let worst = 0;
      let fewest = Infinity;
      for (let t = from; t < to; t += 0.03) {
        w.forEach((x, k) => at(pose, t + k * dt, x));
        let shown = 0;
        for (let i = 0; i < w[0].n; i++) {
          if (w[0].tone[i] === HIDDEN || w[1].tone[i] === HIDDEN || w[2].tone[i] === HIDDEN) continue;
          shown++;
          worst = Math.max(worst, Math.hypot(w[0].x[i] - 2 * w[1].x[i] + w[2].x[i], w[0].y[i] - 2 * w[1].y[i] + w[2].y[i]));
        }
        fewest = Math.min(fewest, shown);
      }
      expect(worst).toBeLessThan(0.35);
      expect(fewest).toBeGreaterThan(1500);
    }
  });

  it('stand on the ground: none goes below the floor', () => {
    const [pose, from, to] = moves[0];
    const [w] = cat(pose, from, to);
    for (let t = 0; t < 2.4; t += 0.05) {
      at(pose, t, w);
      // Screen y is down and the floor is y = 0; a dot may straddle it by half its width.
      for (let i = 0; i < w.n; i++) if (w.tone[i] !== HIDDEN) expect(w.y[i]).toBeLessThan(0.3);
    }
  });
});

describe('the home cut', () => {
  it('adds at most 0.7s for the default cat, at most 2.1s for any other, and runs forward', () => {
    expect(homeCut(DEFAULT_INTRO).at(-1)![0] - 11.2).toBeLessThan(0.7);
    for (const name of INTROS) {
      const cut = homeCut(name);
      expect(cut.at(-1)![0] - 11.2).toBeCloseTo(addedTime(name), 6);
      expect(addedTime(name)).toBeLessThan(2.1);
      for (let i = 1; i < cut.length; i++) expect(cut[i][0]).toBeGreaterThan(cut[i - 1][0]);
    }
  });
});
