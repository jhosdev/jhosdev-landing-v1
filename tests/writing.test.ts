import { describe, expect, it } from 'vitest';
import enRaw from '../src/content/writing/event-loop-head-of-line-blocking.en.md?raw';
import esRaw from '../src/content/writing/event-loop-head-of-line-blocking.es.md?raw';

// Content collections need Astro's content-layer runtime to run through
// getCollection(), which vitest doesn't have wired up here — read the
// frontmatter directly from the raw file (via Vite's `?raw` import) instead,
// it's what this test actually needs to check.
function readFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('No frontmatter found');
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    fm[key] = value;
  }
  return fm;
}

const en = readFrontmatter(enRaw);
const es = readFrontmatter(esRaw);

describe('writing collection: event-loop-head-of-line-blocking', () => {
  it('has an EN and ES version tagged with the right lang', () => {
    expect(en.lang).toBe('en');
    expect(es.lang).toBe('es');
  });

  it('pairs the two languages via matching slug and translationOf', () => {
    expect(en.slug).toBe(es.slug);
    expect(en.translationOf).toBe(es.translationOf);
    expect(en.translationOf).toBe(en.slug);
  });

  it('both versions have a title, description, and date', () => {
    for (const fm of [en, es]) {
      expect(fm.title).toBeTruthy();
      expect(fm.description).toBeTruthy();
      expect(fm.date).toBeTruthy();
    }
  });
});
