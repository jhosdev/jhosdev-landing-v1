import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
  // Custom generateId: the glob loader's default treats a `slug` frontmatter field as
  // the entry id, which would collide since the en/es versions share the same slug.
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/writing',
    generateId: ({ data }) => `${data.slug}.${data.lang}`,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    lang: z.enum(['en', 'es']),
    // URL slug for this entry, plus the shared key linking the EN/ES versions
    // of the same article to each other (their `translationOf` values match).
    slug: z.string(),
    translationOf: z.string(),
  }),
});

export const collections = { writing };
