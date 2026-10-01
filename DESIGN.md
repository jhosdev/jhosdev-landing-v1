# Design system & method

How design work happens in this repo. Two parts: the five patterns every strong site shares (distilled from Apple España, Lamborghini, Superhuman, Osmo, Slash, Auros, Structured), and this site's own answers to them. Any redesign session starts here.

## The five patterns (checks for every artboard/page)

1. **One idea, stated as a place.** Not a mood board — one room. Every later argument resolves against that sentence.
2. **Small palette, one accent, hoarded.** 8–20 named colors, almost all neutral. One accent element per screen; spending it twice destroys it. Surfaces are a 4–5 step ramp of one hue; dark/light bands pace the page instead of dividers.
3. **Two families, extreme size range, few weights.** A voice face for display plus a utility face. Hierarchy comes from big size jumps on a shared scale, not more weights. Display leading 0.84–1.0, body ~1.5.
4. **Imagery is everything or almost nothing.** Full-bleed photography/video, or one made object that does all the work. Never stock, illustration, or decorative icons.
5. **Motion and shadow barely specified.** One hover ease (~0.2s), one scroll-linked reveal, near-zero shadows; separation by surface color and whitespace. Pick the radius pair first and hold it everywhere — radius is the fastest tell between systems.

## This site's answers (the "Machine" system)

The home page and the article pages. The lab pages (`/lab/*`) keep the older terminal system they were sketched in; see the end of this section.

- **The place:** you are looking at the Machine's file on one person. A surveillance system (Person of Interest) has found the site owner, classified them as "the asset", and keeps the record open: who they are, who they are linked to, what they built, what they transmitted. Every section is a view of that file, and every motion is the Machine doing its job (acquiring, analysing, classifying, decoding), never decoration.
- **Palette:** the same near-black blue ramp (`#0b0e13` bg → `#0e1219` panel → `#1c232d` border → `#2e3947` hover) and text steps (`#5d6a79` decorative labels → `#7d8a99` small informational text → `#8d99a8` prose → `#c7d1dc` → `#f0f4f8`). Colour is classification, and each one means exactly one thing:
  - **white** `#f0f4f8`: unclassified. Default brackets, index tags, neutral verdicts.
  - **red** `#ff5c5c`: unidentified, or recording. The REC light, a tag before analysis, an error in the prompt.
  - **amber** `#ffc857`: under analysis / in progress. Tags mid-movement, an `active` project, focus-mode controls ("you are seeing an excerpt").
  - **cyan** `#6ee0ff`: the confirmed asset, and anything you can act on (links, the prompt, the selected entity, the current chip).
  - **green** `#57d9a3`: system nominal. Monitoring, a `production` project, a current employer, a decoded transmission, an open channel.
  A colour used for anything else is a bug. Tokens live in `src/styles/global.css`; the canvas reads the same values from `src/components/machine/draw.ts`.
- **Type:** IBM Plex Mono for everything the Machine says (titles, tags, labels, names, the prompt) and IBM Plex Sans for everything a person wrote (summaries, highlights, descriptions, article prose). Machine-speak is uppercase with tracking; content keeps its own case. The name is the one display size (up to 88px); section titles 22px; prose 14.5 to 16.5px.
- **Imagery:** none. The made objects are the camera feed around the name and the canvas layers (map, wires, scan bars, waveforms).
- **Shape:** square corners everywhere, and no borders where brackets can do the job: a thing the Machine has locked onto gets four corner brackets and a filled classification tag above its top-left corner. Shadows: none (the command output uses a solid outline of the background colour to separate itself).
- **Grammar of a section:** index tag + title + hairline + a short readout on the right, one sentence in sans under it, then the content. New sections reuse this (`SectionHead.astro`) and the bracket/tag primitives (`.mc-lock`, `.mc-tag`).
- **Motion:** this is a motion site now, with JavaScript and canvas. The rules that keep it honest:
  1. **Content first.** Every section is server-rendered semantic HTML that reads correctly with JavaScript off. Canvas is `aria-hidden` and never carries information. Text that "decodes" keeps its real text in the DOM the whole time; the scrambled frame is painted over it from an attribute.
  2. **One intro, once.** A ~11s cut of the authored timeline (boot, sweep, acquire, identify) plays once per tab, never with a hash in the URL, and any key, tap or scroll ends it immediately.
  3. **One movement per section**, under three seconds, played when the section scrolls into view or is navigated to: asset = acquired and confirmed, associations = wired to the asset one per beat, projects = scanned and classified, writing = intercepted and decoded, simulation = games played out, contact = handshake to open channel. An article page gets one short entrance (under two seconds), then nothing moves.
  4. **Pure functions of time.** The intro (`window.seek(seconds)`, `?seek=`) and every movement (`?move=0..1`) render from a time value, so any frame can be reproduced, captured or tested.
  5. **Quiet when idle.** After a movement only ambient canvas motion remains (map, packets, carrier), at half frame rate, paused off screen. Device pixel ratio is capped at 2.
  6. **`prefers-reduced-motion: reduce`:** no intro, no movements, no loops. Content is simply present and the canvases draw one settled frame.
- **Navigation:** sections are addressable (`/#projects`, `/#writing`, `/#projects/<name>`). A hash opens *just that section* (focus mode) with an amber way back to the full file. The docked command line takes section names as commands, with a ghost suggestion and Tab completion; the chips above it do the same for people who will not type.
- **Lab pages** (`/lab/`, `/lab/machine/`, `/lab/shell/`, `/lab/tictactoe/`) are the experiments this system came from. They keep the terminal chrome (`$ prompt` lines, green dot, 6px radius) and are not linked from the site. The tic-tac-toe panel is reused on the home page with its corners squared.

## Briefing a design agent

Give it: the north-star sentence (the Machine's file on the asset), the neutral ramp, the five classification colours with their single meanings, the two families and who speaks in which, square corners + brackets + tags, the six motion rules, then the specific task. Run an "AI tells" audit pass on any finished design and remove one decoration before shipping. Useful session tools when available: the design canvas skill for side-by-side directions (stable names A/B/C, main = leading candidate), aesthetic-direction references for naming the moves, deterministic checkers for contrast/padding.

Checking motion: stills cannot judge it. Freeze frames with `?seek=` and `?move=`, and drive a real browser for anything that depends on the clock, scrolling or typing.

## Rules

- New sections reuse the section grammar (index tag, title, readout, one sentence) and the bracket/tag primitives. No new visual primitive, and no new colour meaning, without updating this file first.
- Every piece of motion must be explainable as something the Machine is doing to the content. If it cannot be, it is decoration: cut it.
- Zero personal facts in code. Names, employers, projects, skills and articles come from the resume data and the writing collection; machine-speak and UI strings live in `src/components/machine/copy.ts`, in both locales.
- Any experiment (e.g. the tic-tac-toe panel) lives inside the system's frame and obeys the palette; it never introduces its own colours.
- Article prose stays plain: sans, max-width 720px, nothing moving after the entrance.
