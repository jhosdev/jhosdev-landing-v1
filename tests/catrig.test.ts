import { describe, expect, it } from 'vitest';
import { DUTY, STRIDE, walkFoot } from '../src/components/machine/catrig';
import { DEFAULT_INTRO, INTROS, homeCut } from '../src/components/machine/scene';

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

describe('the home cut', () => {
  it('is as long as before for the default cat, and at most 1.5s longer for any other', () => {
    expect(homeCut(DEFAULT_INTRO).at(-1)![0]).toBeCloseTo(11.2, 6);
    for (const name of INTROS) {
      const cut = homeCut(name);
      expect(cut.at(-1)![0] - 11.2).toBeLessThan(1.5 + 1e-6);
      // Time only ever runs forward.
      for (let i = 1; i < cut.length; i++) expect(cut[i][0]).toBeGreaterThan(cut[i - 1][0]);
    }
  });
});
