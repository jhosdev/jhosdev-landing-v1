// Small shared helpers for the writing article pages (EN + ES), so the
// per-locale route files stay near-identical templates, not duplicated logic.

import { getCollection, type CollectionEntry } from 'astro:content';
import { withLocale, type Locale } from './resume';

export function writingByLang(lang: Locale) {
  return getCollection('writing', (entry) => entry.data.lang === lang);
}

/** Root-relative path to an article page, e.g. articlePath('es', 'foo') -> '/es/writing/foo/'. */
export function articlePath(locale: Locale, slug: string): string {
  return withLocale(locale, `/writing/${slug}/`);
}

// Built once at module load so findTranslation is a map lookup instead of
// re-filtering the whole collection on every article page render.
const byLangAndTranslation = new Map(
  (await getCollection('writing')).map((e) => [`${e.data.lang}:${e.data.translationOf}`, e]),
);

export function findTranslation(
  entry: CollectionEntry<'writing'>,
  lang: Locale,
): CollectionEntry<'writing'> | undefined {
  return byLangAndTranslation.get(`${lang}:${entry.data.translationOf}`);
}

/** ~200 words/min, rounded up to at least 1 minute. */
export function readingTime(body: string | undefined): number {
  const words = body?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return Math.max(1, Math.round(words / 200));
}
