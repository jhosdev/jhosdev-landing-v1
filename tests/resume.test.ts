import { describe, expect, it } from 'vitest';
import { getResume } from '../src/data/resume';
import { getContent } from '../src/data/content';

const resumeEn = getResume('en');
const resumeEs = getResume('es');

describe('resume data', () => {
  it('has a name in basics', () => {
    expect(resumeEn.basics.name).toBeTruthy();
  });

  it('has at least one work entry', () => {
    expect(resumeEn.work.length).toBeGreaterThan(0);
  });

  it('every work entry has position, name, and startDate', () => {
    for (const job of resumeEn.work) {
      expect(job.position).toBeTruthy();
      expect(job.name).toBeTruthy();
      expect(job.startDate).toBeTruthy();
    }
  });

  it('has at least one skill group', () => {
    expect(resumeEn.skills.length).toBeGreaterThan(0);
  });
});

describe('es resume', () => {
  // TODO: ES resume sync deferred deliberately (2026-09-12) — unskip when resume.es.json is re-synced
  it.skip('parses and has the same number of work entries as en', () => {
    expect(resumeEs.work.length).toBe(resumeEn.work.length);
  });

  it('has the same basics.email as en', () => {
    expect(resumeEs.basics.email).toBe(resumeEn.basics.email);
  });
});

describe('portfolio content', () => {
  const contentEn = getContent('en');
  const contentEs = getContent('es');

  it('derives contact email from resume basics', () => {
    const emailLink = contentEn.contact.links.find((link) => link.primary);
    expect(emailLink?.label).toBe(resumeEn.basics.email);
    expect(emailLink?.href).toBe(`mailto:${resumeEn.basics.email}`);
  });

  it('derives one experience entry per resume work entry', () => {
    expect(contentEn.experience).toHaveLength(resumeEn.work.length);
  });

  // TODO: ES resume sync deferred deliberately (2026-09-12) — unskip when resume.es.json is re-synced
  it.skip('es experience length matches en experience length', () => {
    expect(contentEs.experience.length).toBe(contentEn.experience.length);
  });

  it('every stack row has at least one item', () => {
    for (const row of contentEn.stack) {
      expect(row.items.length).toBeGreaterThan(0);
    }
  });
});
