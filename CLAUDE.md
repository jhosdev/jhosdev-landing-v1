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
- The home page (`src/layouts/PortfolioPage.astro`, both locales) is "the Machine's file on the asset": six addressable sections (`asset`, `associations`, `projects`, `writing`, `simulation`, `contact`) of server-rendered semantic HTML, complete with JavaScript off. `src/components/machine/` holds everything that enhances it:
  - `copy.ts`: every UI / machine-speak string, EN and ES. No profile facts.
  - `draw.ts`: palette, easing, deterministic noise, shared canvas primitives.
  - `scene.ts`: the authored canvas timeline, a pure function of time (`createMachine().render(seconds)`). The home plays a ~11s cut once per tab; `/lab/machine/` loops the full 26s.
  - `motion.ts`: section movements = cues (`data-m` / `data-at` attributes in the markup) plus one canvas painter per section, driven by one clock.
  - `runtime.ts`: intro, scroll triggers, focus mode (a hash opens just that section), and the docked command line.
  - `machine.css`: the system's styles (also used by `ArticlePage.astro`).
- The command line reuses `src/components/shell/commands.ts` (pure parser, history, tab completion; tested in `tests/shell-commands.test.ts`). Commands return actions that point at markup by `ref`; they never carry content.
- Motion: no library. Canvas 2D + a small cue engine, no new dependencies. Scripts are deferred modules and never block first paint; the intro's scene code is loaded only when the intro plays. Everything respects `prefers-reduced-motion` (no intro, no movements, content simply present). Debug parameters for freezing states: `?seek=6.5` (intro), `?move=0.6` (every section's movement), `?run=help;projects` (commands), `?intro` (force the intro).
- Static output for now (no adapter); the resume fetch above runs at build time, not as runtime ISR.

## Design

Any visual/design change starts from `DESIGN.md` — the five patterns, this site's "Machine" system (near-black blue ramp, five classification colours with one meaning each, IBM Plex Mono for the Machine and Sans for the person, square corners + brackets + tags, the motion rules), and how to brief a design agent. New sections reuse the section-head + bracket/tag grammar. The `/lab/` pages keep the older terminal look.

## Delegation

Implementation (file edits, components, tests, refactors) is delegated to the `sonnet-implementer` agent. The main session plans, reviews, and orchestrates. Non-trivial stack/architecture decisions: research and present options before building.

## Related

Sibling product: `~/personal/cv-forge` — Rust/Axum API (render/audit/tailor resumes, Typst PDF). Its `GET /profile` will eventually feed this site.
