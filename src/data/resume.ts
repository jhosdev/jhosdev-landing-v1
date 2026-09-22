import enRaw from './resume.en.json';
import esRaw from './resume.es.json';
import type { Principle, Stat } from './types';

// Minimal typed slice of JSON Resume schema v1.0.0 — the shared fields the
// site and scripts/render-pdf.ts (Typst PDF) both read. Not the full schema.
// https://jsonresume.org/schema/

export type Locale = 'en' | 'es';

export interface ResumeLocation {
  city?: string;
  region?: string;
  countryCode?: string;
}

export interface ResumeProfile {
  network: string;
  username: string;
  url: string;
}

export interface ResumeBasics {
  name: string;
  label: string;
  email: string;
  url?: string;
  summary: string;
  location: ResumeLocation;
  profiles: ResumeProfile[];
}

export interface ResumeWork {
  name: string;
  position: string;
  url?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  summary?: string;
  highlights: string[];
}

export interface ResumeEducation {
  institution: string;
  area: string;
  studyType: string;
  startDate: string;
  endDate?: string;
  status?: string;
  score?: string;
  courses?: string[];
}

export interface ResumeAward {
  title: string;
  date: string;
  awarder: string;
  summary?: string;
}

export interface ResumeSkill {
  name: string;
  keywords: string[];
}

export interface ResumeProject {
  /** Rendered as the project card title (Project.slug) */
  name: string;
  entity?: string;
  /** e.g. "production" | "active" | "archived" — a falsy/missing status means "don't show this card" */
  status?: string;
  /** Localized display text for the status badge — falls back to `status` if absent */
  statusLabel?: string;
  description: string;
  keywords: string[];
}

// The curated page copy that isn't already in basics/work/skills — see docs/resume-data.md.
export interface ResumeMetaSite {
  headlineLine2: string;
  stats: Stat[];
  principles: Principle[];
  contactHeading: string;
  /** Wanted-keyword lists per stack row, checked against skills[] groups by content.ts's pick(). */
  stack: { streaming: string[]; data: string[]; infra: string[] };
}

export interface ResumeMeta {
  canonical?: string;
  version?: string;
  lastModified?: string;
  site: ResumeMetaSite;
}

export interface Resume {
  basics: ResumeBasics;
  work: ResumeWork[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  awards: ResumeAward[];
  skills: ResumeSkill[];
  meta: ResumeMeta;
}

const resumes: Record<Locale, Resume> = {
  en: enRaw as unknown as Resume,
  es: esRaw as unknown as Resume,
};

export function getResume(locale: Locale): Resume {
  return resumes[locale];
}

/** Prefixes a root-relative path with the ES locale segment, e.g. withLocale('es', '/writing/x/') -> '/es/writing/x/'. */
export function withLocale(locale: Locale, path: string): string {
  return locale === 'es' ? `/es${path}` : path;
}

/** The one other locale, e.g. otherLocale('en') -> 'es'. */
export function otherLocale(l: Locale): Locale {
  return l === 'en' ? 'es' : 'en';
}
