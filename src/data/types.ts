// Data model for the portfolio page. All page content should be driven
// from these types (e.g. a single content.ts) so copy edits never touch markup.

/** Free-form — comes straight from resume.json projects[].status; only "active" gets a distinct badge color (see .status.active in global.css). */
export type ProjectStatus = string;

export interface Project {
  /** Repo-style slug shown as the card title, e.g. "casino-aggregation-platform" */
  slug: string;
  /** Semantic status, drives badge color — not rendered directly */
  status: ProjectStatus;
  /** Localized display text for the status badge, e.g. "production" / "producción" */
  statusLabel: string;
  /** 1–2 sentence description */
  description: string;
  /** Lowercase tech tags rendered as "kafka · dynamodb · …" */
  tags: string[];
  /** Who it was built for, e.g. an employer name from work[] */
  entity?: string;
  href?: string;
}

export interface StackRow {
  /** Left column label, lowercase: "languages", "streaming", "data", "infra", "ai" */
  category: string;
  items: string[];
}

export interface ExperienceEntry {
  /** e.g. "2021 — now" */
  period: string;
  title: string;
  company: string;
  summary: string;
  /** URL-safe id derived from the company name, unique within the list */
  id: string;
  /** No end date in the resume: still there */
  current: boolean;
  location?: string;
  url?: string;
  highlights: string[];
}

export interface SpokenLanguage {
  language: string;
  fluency: string;
}

export interface Post {
  year: number;
  /** Filename-style title, e.g. "exactly-once-is-a-lie.md" */
  slug: string;
  /** Subtitle after the em-dash */
  subtitle: string;
  href: string;
  tags?: string[];
  readingMinutes?: number;
}

export interface Stat {
  /** Big cyan value, e.g. "16+", "millions" */
  value: string;
  /** Small muted label, e.g. "providers integrated" */
  label: string;
}

export interface ContactLink {
  label: string;
  href: string;
  primary?: boolean; // primary = cyan, secondary = muted
  /** Save the file instead of opening it (the resume PDF) */
  download?: boolean;
}

export interface Principle {
  /** Short lowercase key, e.g. "depth" */
  key: string;
  value: string;
}

/** The person outside of work: meta.site.about. */
export interface About {
  paragraphs: string[];
  /** Short label / value rows, e.g. "coding since" / "2015" */
  facts: { label: string; value: string }[];
  /** Optional: a photo for the section (a path under public/, e.g. "/pet.jpg", and its alt text). Nothing renders without it. */
  photo?: { src: string; alt: string };
}

/** A public repository: meta.site.openSource[]. */
export interface Repository {
  name: string;
  url: string;
  language: string;
  description: string;
}

export interface PortfolioContent {
  /** The handle shown as the headline and in the top bar: the GitHub username, e.g. "your-name" */
  promptUser: string;
  /** Terminal prompt identity suffix, e.g. "portfolio" — hidden on narrow screens */
  promptSuffix: string;
  headline: [string, string]; // two lines of the h1
  lede: string;
  stats: Stat[];
  projects: Project[];
  stack: StackRow[];
  /** Every skill group of this locale, as named in the resume: the full stack */
  skillGroups: StackRow[];
  /** Spoken languages, from resume languages[] */
  spoken: SpokenLanguage[];
  principles: Principle[];
  experience: ExperienceEntry[];
  /** Absent when the resume has no meta.site.about: the section is not rendered. */
  about?: About;
  /** Empty when the resume has no meta.site.openSource: the section is not rendered. */
  openSource: Repository[];
  /** The cat's name, when about.facts has one: the particle cat appears, and answers to it as a command. */
  cat?: string;
  contact: { heading: string; links: ContactLink[] };
  /** Per-locale UI copy for the article pages, e.g. "min read" / "min de lectura" */
  article: { minRead: string; translationLink: string };
}
