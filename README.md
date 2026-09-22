# jhosdev-landing

Personal portfolio site — single-page, dark-mode-first, built with Astro 7 and plain CSS. All content is read from `src/data/resume.en.json` (JSON Resume schema v1.0.0).

## Commands

```bash
bun install
bun run dev        # dev server on :4321
bun run build      # production build (static output in dist/)
bun run preview    # preview the production build
bun run test       # vitest
bunx astro check   # type/content checks
```

## Stack

- [Astro 7](https://astro.build) — static output, no adapter (deployed to Vercel zero-config).
- Plain CSS: design tokens as `:root` custom properties, hand-rolled reset, no framework.
- No animation library — CSS `steps()`/`@keyframes` for the terminal-typing hero and hover cursors.
- TypeScript strict (`astro/tsconfigs/strict`), Vitest, Bun as package manager/runtime.

## Content updates

Resume JSON (`src/data/resume.en.json` / `resume.es.json`, gitignored) is fetched at build time when `RESUME_URL_EN` / `RESUME_URL_ES` are set, overwriting the local files; unset, the existing local file is kept, or `resume.sample.json` (mock data, committed) is copied into place if it's missing. `public/resume.pdf` is always rendered from that same data via Typst.

See `CLAUDE.md` for architecture notes.
