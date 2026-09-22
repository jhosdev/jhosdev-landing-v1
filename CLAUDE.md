# jhosdev-landing

Personal portfolio site. Astro 7 + TypeScript (strict) + plain CSS custom properties, built with Bun, deployed on Vercel.

## Commands

```bash
bun install
bun run dev        # dev server on :4321
bun run build      # production build (must pass before commit)
bun run test       # vitest
bunx astro check   # type/content checks
```

## Architecture

- All resume/profile content comes from `src/data/resume.en.json` / `resume.es.json` — **JSON Resume schema v1.0.0**, gitignored (never committed). At build time, `scripts/fetch-resume.ts` fetches `RESUME_URL_EN` / `RESUME_URL_ES` (when set) and overwrites the local files; unset, it keeps the local file if present, else copies `src/data/resume.sample.json` (mock data, committed) into place. Never hardcode profile facts in components — read from the JSON. See `docs/resume-data.md`.
- `public/resume.pdf` is rendered at build time by `scripts/render-pdf.ts` (Typst) from that same `resume.en.json`, so the PDF and the site never drift.
- i18n: manual locale routing via the `withLocale()` helper (`src/data/resume.ts`) plus `src/pages/es/` wrappers around shared layouts — EN unprefixed at `/`, ES at `/es/`. Curated per-locale copy lives in `src/data/content.ts`; articles are a content collection in `src/content/writing/` with `.en.md`/`.es.md` pairs.
- No CSS framework: design tokens are plain `:root` custom properties in `src/styles/global.css`, hand-rolled reset (no Tailwind preflight).
- Animations: no library — CSS `steps()`/`@keyframes` only (hero terminal-typing effect, hover-triggered blinking cursors on section prompts). Site is dark-mode-first with a single accent color; everything respects `prefers-reduced-motion`.
- Static output for now (no adapter); the resume fetch above runs at build time, not as runtime ISR.

## Design

Any visual/design change starts from `DESIGN.md` — the five patterns, this site's terminal system (palette ramp, IBM Plex pair, 6px radius, 88px section gap), and how to brief a design agent. New sections reuse the prompt-line + panel grammar.

## Delegation

Implementation (file edits, components, tests, refactors) is delegated to the `sonnet-implementer` agent. The main session plans, reviews, and orchestrates. Non-trivial stack/architecture decisions: research and present options before building.

## Related

Sibling product: `~/personal/cv-forge` — Rust/Axum API (render/audit/tailor resumes, Typst PDF). Its `GET /profile` will eventually feed this site.
