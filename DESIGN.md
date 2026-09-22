# Design system & method

How design work happens in this repo. Two parts: the five patterns every strong site shares (distilled from Apple España, Lamborghini, Superhuman, Osmo, Slash, Auros, Structured), and this site's own answers to them. Any redesign session starts here.

## The five patterns (checks for every artboard/page)

1. **One idea, stated as a place.** Not a mood board — one room. Every later argument resolves against that sentence.
2. **Small palette, one accent, hoarded.** 8–20 named colors, almost all neutral. One accent element per screen; spending it twice destroys it. Surfaces are a 4–5 step ramp of one hue; dark/light bands pace the page instead of dividers.
3. **Two families, extreme size range, few weights.** A voice face for display plus a utility face. Hierarchy comes from big size jumps on a shared scale, not more weights. Display leading 0.84–1.0, body ~1.5.
4. **Imagery is everything or almost nothing.** Full-bleed photography/video, or one made object that does all the work. Never stock, illustration, or decorative icons.
5. **Motion and shadow barely specified.** One hover ease (~0.2s), one scroll-linked reveal, near-zero shadows; separation by surface color and whitespace. Pick the radius pair first and hold it everywhere — radius is the fastest tell between systems.

## This site's answers (the "terminal" system)

- **The place:** a senior engineer's terminal at night. Shell-prompt section headers (`$ whoami`, `$ cat stack.txt`) are the signature element.
- **Palette:** near-black blue ramp (`#0b0e13` bg → `#0e1219` panel → `#1c232d` border → `#2e3947` hover) with text steps `#3d4754 → #5d6a79 → #7d8a99 → #8d99a8 → #c7d1dc → #f0f4f8`. Accents: green `#57d9a3` (prompts, active states) and cyan `#6ee0ff` (links, stats) — treat green as structure, cyan as the hoarded accent.
- **Type:** IBM Plex Mono (prompts, nav, tags, dates, panels) + IBM Plex Sans (headings, prose). Latin subsets only, self-hosted.
- **Imagery:** none — the terminal chrome IS the made object. No icons beyond text glyphs (`●`, `▋`, `↗`, `·`).
- **Motion:** hero typing (CSS `steps()`), blinking `▋` cursors, border-color hovers. Everything off under `prefers-reduced-motion`. **Radius: 6px, everywhere.**
- Dark-only by design; tokens live as `:root` custom properties in `src/styles/global.css`.

## Briefing a design agent

Give it: the north-star sentence, the neutral ramp + accent with the one-per-screen rule, the two families with the size range, the radius (6px), the section gap (88px) — then the specific task. Run an "AI tells" audit pass on any finished design and remove one decoration before shipping. Useful session tools when available: the design canvas skill for side-by-side directions (stable names A/B/C, main = leading candidate), aesthetic-direction references for naming the moves, deterministic checkers for contrast/padding.

## Next-session candidates (obsidianui.dev research, 2026-09-22)

ObsidianUI is a React + Tailwind + Motion/GSAP copy-paste library — nothing imports directly (zero-JS budget), but these ideas port to pure CSS and fit the terminal rules:

1. **Static dot-grid hero texture** — tiled `radial-gradient` one step above `#0b0e13`, radially masked to fade at the edges. Depth without a new color or JS. Cheapest win.
2. **CSS-only role stream after `$ whoami`** — fixed prompt + vertically cycling role list (`steps()` keyframe on stacked lines, `mask-image` center-focus fade). Extends the existing typing grammar; reduced-motion shows the first role statically.
3. **Hover file-tree reveal on project panels** — hovering a card expands a mono `tree`-style listing (stack, key files, links) via `max-height` + `opacity`. Deepens both panel grammar and shell metaphor.
- Runner-up: 2px accent scroll-progress bar via CSS `animation-timeline: scroll()` (progressive enhancement, degrades to nothing).
- Also cheap and on-theme: `Kbd` keycap styling for shortcuts/command hints; accent-only `background-clip: text` fill on link hover.
- Rejected from their catalog (violate the rules): cursor effects, 3D flips, glassmorphism, multi-color glow, scroll hijacking, continuous ambient motion.

## Rules

- New sections must reuse the panel grammar (prompt line + bordered panel + mono body) — no new visual primitives without updating this file first.
- Any 3D/experiment (e.g. WASM checkers board) lives inside a panel and obeys the palette; it never introduces its own colors.
- Blog/article pages inherit the same tokens; prose max-width ~720px.
