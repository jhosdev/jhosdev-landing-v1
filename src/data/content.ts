// Portfolio page copy. Everything that's a personal/profile fact (headline,
// stats, project cards, stack keyword picks, principles, contact heading)
// comes from meta.site / projects[] in src/data/resume.{en,es}.json so it can
// never drift from — or duplicate — that data. What's left here is pure UI
// chrome that isn't a fact about the person: skill group-name lookups, the
// "now" label, and article page strings.

import { getResume, type Locale } from './resume';
import type { PortfolioContent } from './types';

interface CuratedLocale {
  groupNames: { languages: string; backendData: string; cloudInfra: string; aiEngineering: string };
  /** Label for an ongoing role's end date, e.g. "2025 — now" / "2025 — actualidad" */
  nowLabel: string;
  article: { minRead: string; translationLink: string };
}

const curated: Record<Locale, CuratedLocale> = {
  en: {
    groupNames: {
      languages: 'Languages',
      backendData: 'Backend & Data',
      cloudInfra: 'Cloud & Infra',
      aiEngineering: 'AI Engineering',
    },
    nowLabel: 'now',
    article: { minRead: 'min read', translationLink: 'leer en español →' },
  },
  es: {
    groupNames: {
      languages: 'Lenguajes',
      backendData: 'Backend y Datos',
      cloudInfra: 'Nube e Infraestructura',
      aiEngineering: 'Ingeniería de IA',
    },
    nowLabel: 'actualidad',
    article: { minRead: 'min de lectura', translationLink: 'read in english →' },
  },
};

function skillGroup(skills: { name: string; keywords: string[] }[], name: string): string[] {
  return skills.find((s) => s.name === name)?.keywords ?? [];
}

function pick(pool: string[], wanted: string[], group: string): string[] {
  return wanted.map((w) => {
    if (!pool.includes(w)) {
      throw new Error(`content.ts: "${w}" not found in resume skill group "${group}" (was it renamed in resume.json?)`);
    }
    return w;
  });
}

function yearOf(date: string): string {
  return date.split('-')[0];
}

export function getContent(locale: Locale): PortfolioContent {
  const resume = getResume(locale);
  const { basics, work, skills, projects, meta } = resume;
  const site = meta.site;
  const c = curated[locale];

  const github = basics.profiles.find((p) => p.network === 'GitHub');
  const linkedin = basics.profiles.find((p) => p.network === 'LinkedIn');

  const backendAndData = skillGroup(skills, c.groupNames.backendData);
  const cloudAndInfra = skillGroup(skills, c.groupNames.cloudInfra);
  const aiEngineering = skillGroup(skills, c.groupNames.aiEngineering);

  return {
    promptUser: `${github?.username ?? 'dev'}@prod`,
    promptSuffix: 'portfolio',
    headline: [`${basics.label}.`, site.headlineLine2],
    lede: basics.summary,
    stats: site.stats,
    // Project cards straight from resume.json projects[] — meta.site has no
    // card-selection field yet, so every entry with a truthy status renders.
    projects: projects
      .filter((p) => p.status)
      .map((p) => ({
        slug: p.name,
        status: p.status as string,
        statusLabel: p.statusLabel ?? (p.status as string),
        description: p.description,
        tags: p.keywords,
      })),
    stack: [
      { category: 'languages', items: skillGroup(skills, c.groupNames.languages) },
      { category: 'streaming', items: pick(backendAndData, site.stack.streaming, c.groupNames.backendData) },
      { category: 'data', items: pick(backendAndData, site.stack.data, c.groupNames.backendData) },
      { category: 'infra', items: pick(cloudAndInfra, site.stack.infra, c.groupNames.cloudInfra) },
      // AI Engineering keywords are already concise curated copy — used as-is instead of pick()
      // against hardcoded names, so a resume rename here can't silently empty this row.
      { category: 'ai', items: aiEngineering },
    ],
    principles: site.principles,
    experience: work.map((job) => ({
      period: `${yearOf(job.startDate)} — ${job.endDate ? yearOf(job.endDate) : c.nowLabel}`,
      title: job.position,
      company: job.name,
      summary: job.summary ?? job.highlights[0],
    })),
    contact: {
      heading: site.contactHeading,
      links: [
        { label: basics.email, href: `mailto:${basics.email}`, primary: true },
        ...(github ? [{ label: 'github ↗', href: github.url }] : []),
        ...(linkedin ? [{ label: 'linkedin ↗', href: linkedin.url }] : []),
        // EN PDF for both locales for now — resume.es.json content is stale, deferred.
        { label: 'resume.pdf ↗', href: '/resume.pdf' },
      ],
    },
    article: c.article,
  };
}
