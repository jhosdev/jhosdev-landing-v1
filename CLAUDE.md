# jhosdev-landing

Personal portfolio site. Astro 7 + TypeScript (strict) + plain CSS custom properties, built with Bun, deployed on Vercel.

## Commands

```bash
bun install
bun run dev        # dev server on :4321
bun run build      # production build (must pass before commit)
bun run test       # vitest
bunx astro check   # type/content checks
bun run bench      # performance against a running preview (bun run build && bunx astro preview --port 4511); see docs/performance.md
```

## Architecture

- All resume/profile content comes from `src/data/resume.en.json` / `resume.es.json` — **JSON Resume schema v1.0.0**, gitignored (never committed). At build time, `scripts/fetch-resume.ts` fetches `RESUME_URL_EN` / `RESUME_URL_ES` (when set) and overwrites the local files; unset, it keeps the local file if present, else copies `src/data/resume.sample.json` (mock data, committed) into place. Never hardcode profile facts in components — read from the JSON. See `docs/resume-data.md`.
- `public/resume.pdf` is rendered at build time by `scripts/render-pdf.ts` (Typst) from that same `resume.en.json`, so the PDF and the site never drift.
- i18n: manual locale routing via the `withLocale()` helper (`src/data/resume.ts`) plus `src/pages/es/` wrappers around shared layouts — EN unprefixed at `/`, ES at `/es/`. Curated per-locale copy lives in `src/data/content.ts`; articles are a content collection in `src/content/writing/` with `.en.md`/`.es.md` pairs.
- No CSS framework: design tokens are plain `:root` custom properties in `src/styles/global.css`, hand-rolled reset (no Tailwind preflight).
- The home page (`src/layouts/PortfolioPage.astro`, both locales) is "the Machine's file on the asset": up to seven addressable sections (`asset`, `about`, `associations`, `projects`, `opensource`, `writing`, `contact`; `opensource` and `about` only when `meta.site` has them; `about.photo` `{ src, alt }`, optional, is filed as an evidence print above the cat's frame, cropped to her, faded into the page and reflected as on still water) of server-rendered semantic HTML, complete with JavaScript off. The hero is the monitor screen: the handle (GitHub username), role, location and full name, with stack telemetry on the left and employers on the right. An invitation above the asset heading links to `/play/` (`src/layouts/PlayPage.astro`), where the tic-tac-toe game lives; `simulation` is a command and a chip, not a section. `src/components/machine/` holds everything that enhances it:
  - `copy.ts`: every UI / machine-speak string. `MACHINE` is the Machine's own vocabulary, English in every locale; `HUMAN` is what is said to the visitor, EN and ES. No profile facts.
  - `cat.ts`: draws the cat's particles (batched by tone and brightness, small ones square, big ones round, streaks for a look that trails), keeps the looks (`STYLES`; the site's is `LOOK`, `haze`: a dense core plus a veil of faint specks riding on it) and the stage the about section and the hero share (`buildLuna` / `drawLuna`: a sphere of particles resolves into her, then her timeline plays, framed by a camera that eases with her pose). Shown when `about.facts` names a cat; its name is a command.
  - `catrig.ts`: the cat as particles from a pose (walk cycle, sit, pounce; eyes, yawn, head tilt, tail in front): each part is swept discs joined by a smooth-min distance field (read on a ~3px grid); particles are scattered once at rest by seeded dart throwing, laid out for the most area each spot takes over the poses passed in (a swept part's middle line runs on into its round ends), each frame showing the share it needs now (no bald folded haunch, no bunching inside a bend), denser at each part's outline, each tied to its place in its part's coordinates (along and across a swept part; angle and fraction of the way to the outline on the head), with its own size and brightness; parts in front hide the dots behind; tabby markings are tones (the coat's fixed per particle, the face's found per frame; dark marks drawn dim), the eyes are the photo's (a pointed almond of green dots in a dark rim over a pale lower lid; shut, a pale curve), grey until classified (`GREY`). Pure maths, no DOM.
  - `draw.ts`: palette, easing, deterministic noise, shared canvas primitives.
  - `scene.ts`: the authored canvas timeline, a pure function of time (`createMachine().render(seconds)`). The home plays a ~11s cut once per tab; `/lab/machine/` loops the full 26s. The cat that opens ACQUIRE is a variant (`INTROS`, `DEFAULT_INTRO` = `prowl`).
  - `catphase.ts`: each intro variant's cat phase as particles at time t (`catPhase(name, box, style?)`; `prowl` default (walk, freeze, stalk, pounce, on its own clock), `nap`, `pounce`, `stretch`, `walk`): it opens on the dot grid, she materialises grey out of it, the scan's first pass classifies her coat, then she moves; played by the intro (its home timing is `catCut`) and looped in the `/lab/` gallery.
  - `catkeys.ts`: the cat's repertoire: named poses (sleep, drowsy, yawn, stand, bow, sitting with the tail wrapped) and keyed timelines with follow-through and stepping feet: `ABOUT_KEYS` (the about section's 20s loop, with `ABOUT_LOG` for the Machine's log of it) and `HERO_KEYS` (the `luna` command); and `prowlPose` (the prowl intro: the walk into a freeze, a stalk, then `pouncePose`).
  - `motion.ts`: section movements = cues (`data-m` / `data-at` attributes in the markup) plus one canvas painter per section, driven by one clock.
  - `runtime.ts`: intro, scroll triggers, focus mode (a hash opens just that section), and the docked command line.
  - `machine.css`: the system's styles (also used by `ArticlePage.astro`).
- The command line reuses `src/components/shell/commands.ts` (pure parser, history, tab completion; tested in `tests/shell-commands.test.ts`). Commands return actions that point at markup by `ref`; they never carry content.
- Motion: no library. Canvas 2D + a small cue engine, no new dependencies. Scripts are deferred modules and never block first paint; the intro's scene code is loaded only when the intro plays. Everything respects `prefers-reduced-motion` (no intro, no movements, content simply present). Debug parameters for freezing states: `?seek=6.5` (intro), `?move=0.6` (every section's movement), `?run=help;projects` (commands), `?intro` (force the intro; `?intro=pounce` picks the cat variant), `?cat=3` (the hero's cat, 3s after it was summoned), `?luna=14.8` (the about section's cat, 14.8s into her loop), `?bench` (counts each section's frames and their cost in `window.mcCost`; `scripts/bench.ts` reads it). The intro marks its first frame (`performance.mark('mc:intro')`).
- Static output for now (no adapter); the resume fetch above runs at build time, not as runtime ISR.

## Design

Any visual/design change starts from `DESIGN.md` — the five patterns, this site's "Machine" system (near-black blue ramp, five classification colours with one meaning each, IBM Plex Mono for the Machine and Sans for the person, square corners + brackets + tags, the motion rules), and how to brief a design agent. New sections reuse the section-head + bracket/tag grammar. The `/lab/` pages keep the older terminal look.

## Delegation

Implementation (file edits, components, tests, refactors) is delegated to the `sonnet-implementer` agent. The main session plans, reviews, and orchestrates. Non-trivial stack/architecture decisions: research and present options before building.

## Related

Sibling product: `~/personal/cv-forge` — Rust/Axum API (render/audit/tailor resumes, Typst PDF). Its `GET /profile` will eventually feed this site.
