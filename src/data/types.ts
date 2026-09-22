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
}

export interface Principle {
  /** Short lowercase key, e.g. "depth" */
  key: string;
  value: string;
}

export interface PortfolioContent {
  /** Terminal prompt identity, e.g. "your-name@prod" */
  promptUser: string;
  /** Terminal prompt identity suffix, e.g. "portfolio" — hidden on narrow screens */
  promptSuffix: string;
  headline: [string, string]; // two lines of the h1
  lede: string;
  stats: Stat[];
  projects: Project[];
  stack: StackRow[];
  principles: Principle[];
  experience: ExperienceEntry[];
  contact: { heading: string; links: ContactLink[] };
  /** Per-locale UI copy for the article pages, e.g. "min read" / "min de lectura" */
  article: { minRead: string; translationLink: string };
}
