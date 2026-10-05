# Performance

How fast the site is, how to measure it again, and how to read a regression.

## Running the bench

```bash
bun run build
bunx astro preview --port 4511 &      # any running preview; the bench builds nothing
bun run bench                         # or: bun run bench http://localhost:4600 --runs=3
bun run bench --runs=0 --profile      # steady state only, plus where the About loop's time goes
bun scripts/bench.ts --dist           # file sizes only, no browser (what CI runs after the build)
```

`scripts/bench.ts` drives a headless Chromium (Edge or Chrome; `BENCH_BROWSER` to choose) over the DevTools protocol,
with the GPU on (without it canvas takes a far slower path and every frame number is wrong). Under WSL the browser is
Windows' and its DevTools port is not reachable from Linux, so the script runs itself again with Windows' `node`
(22.18 or later: it runs the TypeScript as is). No dependencies.

It prints a table, writes `bench-results.json` (gitignored), and exits 1 when a number is over its limit in
`perf-budget.json`. `--profile` also saves `bench-profile.cpuprofile` (open it in DevTools' Performance panel).

## What each number means

Loads are cold (cache disabled), median of `--runs` (5).

| key | meaning |
| --- | --- |
| `desktop.*` | 1440x900, no throttling |
| `phone.*` | 390x844 at 3x, CPU 4x slower, DevTools' Fast 4G (165 ms, 9 Mbps down) |
| `fcp` | first contentful paint (ms from navigation) |
| `lcp` | largest contentful paint as a lab run sees it: the last candidate in the first 5 s. The hero's handle, shown when the intro ends (~14 s), is a later candidate by design; skipping the intro shows it at once |
| `load` | load event end |
| `tbt` | total blocking time: the part over 50 ms of every long task in the 10 s after FCP. Noisy: one ~150 ms task straddles FCP and counts on some runs only |
| `introFirstFrame` | when the intro drew its first frame (`performance.mark('mc:intro')`) |
| `introBlock`, `introLong` | blocking time and number of long tasks while the intro plays |
| `home.*KB`, `es.*`, `play.*`, `article.*` | bytes over the wire for one load of `/`, `/es/`, `/play/` and the first article, by type (the preview gzips like the host) |
| `idle.heroMsPerS`, `idle.aboutMsPerS`, `idle.bottomMsPerS` | main-thread ms per second, settled on the hero, with the About loop on screen, and at the bottom of the page (the hero and About off screen) |
| `hero.frameMs`, `about.frameMs` (`.fps`) | one frame of that section's canvas painter (JS, via `?bench`), and how many it paints a second |
| `about.heapMB` | JS heap after a garbage collection, with the About loop running |
| `dist.homeJsKB`, `dist.homeTotalKB` | gzipped bytes of what the built home's HTML points at, its scripts' imports included (CI) |

Headless Chromium runs `requestAnimationFrame` far faster than a screen (about 240 a second here), so the `idle.*`
numbers are an upper bound: on a 60 Hz screen anything tied to the refresh rate costs about a quarter.

## Baseline (2026-10-05, production build, Windows 11 + WSL, Edge headless)

| | earlier pass (before the cat, sections, photo) | before this pass (`20af0f9`) | now |
| --- | --- | --- | --- |
| desktop FCP / LCP | 132 / 132 | 152 / 152 | 160 / 160 |
| desktop TBT | 11 | 63 | 0 to 100 (median 84) |
| desktop intro first frame | 164 | ~330 (2 cat layouts) | 192 |
| phone FCP / LCP | 1084 / n/a | 1176 / 1348 | 1176 / 1308 |
| phone TBT | 54 | 670 | 482 |
| phone intro first frame | 1341 | ~2000 | 1651 |
| home bytes / requests | ~152 KB / 15 | 344 KB / 16 | 345 KB / 16 (JS 45, CSS 9, HTML 13, fonts 100, photo 178) |
| idle hero / About / bottom (ms/s) | ~9% at 165 Hz | 218 / 599 / 235 | 185 / 130 / 91 |
| About frame (`about.frameMs`) | n/a | 2.67 dev | 2.2 dev, ~3.0 production in this harness |

Other pages: `/es/` 345 KB, `/play/` 95 KB (6 KB JS), an article 112 KB (24 KB JS). JS heap with the About loop
running: 3 to 5 MB.

Where the growth since the earlier pass comes from: the About photo (178 KB, lazy, but the About section sits within
the browser's lazy-load distance of the hero, so it loads with the page); the cat's particle layout before ACQUIRE (dart
throwing over every pose she takes: ~100 ms on a desktop, ~400 ms on the phone profile, now done in idle time after the
intro's first frame); the About loop (~8k particles a frame); and the invitation's board, an infinite CSS loop of
`stroke-dashoffset` that the browser repaints on the main thread on every refresh while it is on screen.

## Reading a regression

- Re-run first: on this machine a single run moves FCP by ±30 ms and TBT by ±60 ms. Trust medians, compare with the same
  machine, and bench the commit before the change too (`git archive <sha> | tar -x -C /tmp/base`, build it there, preview
  on another port, bench both).
- `introFirstFrame` up: something runs before the intro's first frame (`createMachine` in `scene.ts`; the cat's layout
  must stay out of it).
- `about.frameMs` up: `bun run bench --runs=0 --profile` lists self time by function. Expect `place` (catrig.ts) first,
  then the canvas `rect` calls (one per visible particle), `field`/`discs`, `bucket`. More visible particles cost
  linearly.
- `idle.*` up with the frame costs flat: something now asks for every frame (an infinite CSS animation that is not
  composited, a canvas loop not going through the runtime's clock). DevTools' Performance panel shows the frames.
- `dist.*` up: a new import in a home script, or a chunk that lost its lazy `import()`.

Raise a limit in `perf-budget.json` only together with the change that earns it, and say why in the commit.
