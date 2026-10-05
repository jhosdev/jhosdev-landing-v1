// Performance bench: drives a headless Chromium (Edge or Chrome) over the DevTools protocol against a running
// preview and prints the numbers docs/performance.md explains; writes them to bench-results.json and exits 1 when
// one is over its limit in perf-budget.json. It builds nothing: `bun run build && bunx astro preview --port 4511`.
//
//   bun run bench [url] [--runs=5] [--profile]     url defaults to $BENCH_URL or http://localhost:4511; --profile
//                                                  prints where the About loop's time goes, saves bench-profile.cpuprofile
//   bun scripts/bench.ts --dist                    file sizes of the built home only, no browser (CI)
//
// The browser is $BENCH_BROWSER, else Edge or Chrome where they usually live. Under WSL the browser is Windows' and
// its DevTools port cannot be reached from Linux, so the script runs itself again with Windows' node (22.18 or later,
// which runs TypeScript as is). Plain TypeScript, no dependencies: Bun or Node, global fetch and WebSocket.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name: string) => argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))?.split('=')[1] ?? (argv.includes(`--${name}`) ? '' : undefined);
const BASE = (argv.find((a) => !a.startsWith('--')) ?? process.env.BENCH_URL ?? 'http://localhost:4511').replace(/\/$/, '');
const RUNS = Number(opt('runs') || 5);
const budget: Record<string, number> = JSON.parse(readFileSync(join(ROOT, 'perf-budget.json'), 'utf8'));
type Results = Record<string, number | null>;

/** Prints the results against the budget and exits 1 when one is over. */
function report(res: Results, file: string) {
  let over = 0;
  console.log(`\n${'metric'.padEnd(28)}${'value'.padStart(10)}${'budget'.padStart(10)}`);
  for (const [k, v] of Object.entries(res)) {
    const lim = budget[k];
    const bad = v !== null && lim !== undefined && v > lim;
    over += bad ? 1 : 0;
    console.log(`${k.padEnd(28)}${(v === null ? 'n/a' : String(v)).padStart(10)}${(lim === undefined ? '' : String(lim)).padStart(10)}${bad ? '  OVER' : ''}`);
  }
  writeFileSync(join(ROOT, file), JSON.stringify({ at: new Date().toISOString(), base: BASE, results: res }, null, 2) + '\n');
  console.log(over ? `\n${over} over budget` : '\nwithin budget');
  process.exit(over ? 1 : 0);
}

/* ---------------------------------------------------------------- --dist: file sizes, no browser */

if (opt('dist') !== undefined) {
  const dist = join(ROOT, 'dist');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const seen = new Set<string>();
  // Everything the home's HTML points at under /_astro/, and every chunk those scripts import, statically or lazily.
  const walk = (rel: string) => {
    if (seen.has(rel) || !existsSync(join(dist, rel))) return;
    seen.add(rel);
    if (!rel.endsWith('.js')) return;
    const src = readFileSync(join(dist, rel), 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']\.\/([^"']+\.js)["']/g)) walk(join(dirname(rel), m[1]).replaceAll('\\', '/'));
  };
  for (const m of html.matchAll(/(?:src|href)="\/(_astro\/[^"]+)"/g)) walk(m[1]);
  // Bytes over the wire: gzipped, as the preview and the host serve them (fonts are compressed already).
  const size = (rel: string) => (/\.(woff2?|jpe?g|png|webp)$/.test(rel) ? statSync(join(dist, rel)).size : gzipSync(readFileSync(join(dist, rel))).length);
  const files = [...seen];
  const js = files.filter((f) => f.endsWith('.js')).reduce((s, f) => s + size(f), 0);
  const total = files.reduce((s, f) => s + size(f), 0) + gzipSync(html).length;
  report({ 'dist.homeJsKB': Math.round(js / 1024), 'dist.homeTotalKB': Math.round(total / 1024) }, 'bench-dist.json');
}

/* ---------------------------------------------------------------- WSL: hop to Windows' node */

if (process.platform === 'linux' && !process.env.BENCH_BROWSER && /microsoft/i.test(readFileSync('/proc/version', 'utf8'))) {
  const self = spawnSync('wslpath', ['-w', fileURLToPath(import.meta.url)]).stdout.toString().trim();
  // (From a Windows directory: cmd.exe will not start in a UNC one.)
  const r = spawnSync('/mnt/c/Windows/System32/cmd.exe', ['/c', 'node', self, ...argv], { stdio: 'inherit', cwd: '/mnt/c/Windows' });
  process.exit(r.status ?? 1);
}

/* ---------------------------------------------------------------- the browser and the protocol */

const BROWSER =
  process.env.BENCH_BROWSER ??
  (process.platform === 'win32'
    ? ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync)
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync));
if (!BROWSER) throw new Error('no browser found: set BENCH_BROWSER');

const profileDir = mkdtempSync(join(tmpdir(), 'bench-'));
// GPU on: without it canvas falls back to a far slower path and every frame number is wrong.
const browser = spawn(BROWSER, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let port = '';
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  try {
    port = readFileSync(join(profileDir, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  } catch {
    // not up yet
  }
}
if (!port) throw new Error('the browser did not open its DevTools port');
const http = `http://127.0.0.1:${port}`;

interface Tab {
  send: (method: string, params?: object) => Promise<any>;
  on: (event: string, fn: (p: any) => void) => void;
  eval: (expr: string) => Promise<any>;
  close: () => Promise<void>;
}

async function openTab(): Promise<Tab> {
  const t = await (await fetch(`${http}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const wait = new Map<number, [(v: any) => void, (e: Error) => void]>();
  const subs = new Map<string, ((p: any) => void)[]>();
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data));
    if (msg.id) {
      const [ok, fail] = wait.get(msg.id)!;
      wait.delete(msg.id);
      if (msg.error) fail(new Error(msg.error.message));
      else ok(msg.result);
    } else for (const fn of subs.get(msg.method) ?? []) fn(msg.params);
  };
  const tab: Tab = {
    send: (method, params = {}) =>
      new Promise((ok, fail) => {
        wait.set(++id, [ok, fail]);
        ws.send(JSON.stringify({ id, method, params }));
      }),
    on: (event, fn) => subs.set(event, [...(subs.get(event) ?? []), fn]),
    eval: async (expression) => (await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value,
    close: async () => {
      ws.close();
      await fetch(`${http}/json/close/${t.id}`);
    },
  };
  return tab;
}

/* ---------------------------------------------------------------- one cold load */

const PROFILES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, cpu: 1, net: null },
  // The earlier pass's phone: 4x slower CPU, DevTools' Fast 4G (165 ms, 9 Mbps down, 1.5 up, at its 0.9 factor).
  phone: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, cpu: 4, net: { latency: 165, downloadThroughput: 1_012_500, uploadThroughput: 168_750 } },
};
type Profile = (typeof PROFILES)[keyof typeof PROFILES];

/** Collects long tasks and the largest paint from the first byte on. */
const COLLECT = `window.__b = { lt: [], lcp: [] };
new PerformanceObserver((l) => { for (const e of l.getEntries()) __b.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' });
new PerformanceObserver((l) => { for (const e of l.getEntries()) __b.lcp.push(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });`;

const KIND: Record<string, string> = { Document: 'html', Script: 'js', Stylesheet: 'css', Font: 'font', Image: 'img' };

async function load(path: string, p: Profile, intro = true) {
  const tab = await openTab();
  const bytes: Record<string, number> = { html: 0, js: 0, css: 0, font: 0, img: 0, other: 0 };
  const types = new Map<string, string>();
  let requests = 0;
  tab.on('Network.responseReceived', (e) => types.set(e.requestId, KIND[e.type] ?? 'other'));
  tab.on('Network.loadingFinished', (e) => {
    requests++;
    bytes[types.get(e.requestId) ?? 'other'] += e.encodedDataLength;
  });
  let loaded = false;
  tab.on('Page.loadEventFired', () => (loaded = true));
  await tab.send('Page.enable');
  await tab.send('Network.enable');
  await tab.send('Network.setCacheDisabled', { cacheDisabled: true });
  await tab.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: p.deviceScaleFactor, mobile: p.mobile });
  await tab.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  if (p.net) await tab.send('Network.emulateNetworkConditions', { offline: false, ...p.net });
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: COLLECT });
  await tab.send('Page.navigate', { url: BASE + path });
  for (let i = 0; i < 300 && !loaded; i++) await sleep(100);
  // The intro (when it plays) ends by itself; its scene code arrives lazily, so the bytes count it too.
  let introEnd = 0;
  for (let i = 0; intro && i < 120; i++) {
    introEnd = await tab.eval(`document.documentElement.classList.contains('mc-intro-on') ? 0 : performance.now()`);
    if (introEnd) break;
    await sleep(250);
  }
  await sleep(500);
  const m = await tab.eval(`(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const intro = performance.getEntriesByName('mc:intro')[0]?.startTime ?? null;
    // As a lab run sees it: the last candidate in the first 5 s (the handle shown when the intro ends comes later, by design).
    const lcp = Math.max(fcp, ...__b.lcp.filter((t) => t < 5000));
    return { fcp, lcp, load: nav.loadEventEnd, intro, lt: __b.lt, article: document.querySelector('a[href*="/writing/"]')?.getAttribute('href') ?? null };
  })()`);
  await tab.close();
  const block = (from: number, to: number) => m.lt.filter(([s]: number[]) => s >= from && s < to).reduce((a: number, [, d]: number[]) => a + Math.max(0, d - 50), 0);
  return {
    ...m,
    // Total blocking time from first paint over the next 10 s (the intro included: it is the first thing people see).
    tbt: block(m.fcp, m.fcp + 10_000),
    introBlock: m.intro === null ? null : block(m.intro - 1, introEnd || Infinity),
    introLong: m.intro === null ? null : m.lt.filter(([s]: number[]) => s >= m.intro - 1 && s < (introEnd || Infinity)).length,
    bytes,
    requests,
  };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const kb = (b: number) => Math.round(b / 1024);
const res: Results = {};

for (const [name, p] of RUNS ? Object.entries(PROFILES) : []) {
  const loads = [];
  for (let i = 0; i < RUNS; i++) loads.push(await load('/', p));
  for (const k of ['fcp', 'lcp', 'load', 'tbt', 'intro', 'introBlock', 'introLong'] as const) {
    const xs = loads.map((l) => l[k]).filter((x): x is number => x !== null);
    res[`${name}.${k === 'intro' ? 'introFirstFrame' : k}`] = xs.length ? Math.round(median(xs)) : null;
  }
  if (name === 'desktop') {
    const l = loads[0];
    res['home.jsKB'] = kb(l.bytes.js);
    res['home.cssKB'] = kb(l.bytes.css);
    res['home.htmlKB'] = kb(l.bytes.html);
    res['home.fontKB'] = kb(l.bytes.font);
    res['home.imgKB'] = kb(l.bytes.img);
    res['home.totalKB'] = kb(Object.values(l.bytes).reduce((a, b) => a + b, 0));
    res['home.requests'] = l.requests;
    for (const [key, path] of [['es', '/es/'], ['play', '/play/'], ['article', l.article]] as const) {
      if (!path) continue;
      const o = await load(path, p, key === 'es');
      res[`${key}.jsKB`] = kb(o.bytes.js);
      res[`${key}.totalKB`] = kb(Object.values(o.bytes).reduce((a, b) => a + b, 0));
    }
  }
}

/* ---------------------------------------------------------------- steady state (desktop) */

{
  const tab = await openTab();
  await tab.send('Page.enable');
  await tab.send('Performance.enable');
  await tab.send('Page.navigate', { url: `${BASE}/?bench` });
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    if (await tab.eval(`document.readyState === 'complete' && !document.documentElement.classList.contains('mc-intro-on')`)) break;
  }
  /** Main-thread ms per second over `ms`, after letting the page settle for `settle`. */
  const busy = async (settle: number, ms = 5000) => {
    await sleep(settle);
    const task = async () => (await tab.send('Performance.getMetrics')).metrics.find((x: any) => x.name === 'TaskDuration').value;
    const a = await task();
    await tab.eval('window.mcCost && Object.keys(mcCost).forEach((k) => delete mcCost[k])');
    await sleep(ms);
    return Math.round(((await task()) - a) * 1000 * (1000 / ms) * 10) / 10;
  };
  res['idle.heroMsPerS'] = await busy(4000);
  const hero = await tab.eval(`window.mcCost?.asset ?? null`);
  res['hero.frameMs'] = hero ? Math.round((hero[1] / hero[0]) * 100) / 100 : null;
  res['hero.fps'] = hero ? Math.round(hero[0] / 5) : null;
  await tab.eval(`document.getElementById('about')?.scrollIntoView()`);
  const profiling = opt('profile') !== undefined;
  if (profiling) {
    await tab.send('Profiler.enable');
    await tab.send('Profiler.setSamplingInterval', { interval: 100 });
  }
  res['idle.aboutMsPerS'] = await busy(4000);
  const about = await tab.eval(`window.mcCost?.about ?? null`);
  res['about.frameMs'] = about ? Math.round((about[1] / about[0]) * 100) / 100 : null;
  res['about.fps'] = about ? Math.round(about[0] / 5) : null;
  if (profiling) {
    await tab.send('Profiler.start');
    await sleep(5000);
    const { profile } = await tab.send('Profiler.stop');
    writeFileSync(join(ROOT, 'bench-profile.cpuprofile'), JSON.stringify(profile));
    const self = new Map<string, number>();
    const dt = new Map<number, number>();
    profile.samples.forEach((id: number, i: number) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    for (const n of profile.nodes) {
      const f = n.callFrame;
      const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (dt.get(n.id) ?? 0) / 1000);
    }
    console.log('\nself time over 5 s of the About loop (ms):');
    for (const [k, v] of [...self].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${v.toFixed(1).padStart(8)}  ${k}`);
  }
  await tab.send('HeapProfiler.collectGarbage');
  res['about.heapMB'] = Math.round((await tab.send('Runtime.getHeapUsage')).usedSize / 1e5) / 10;
  await tab.eval(`scrollTo(0, document.documentElement.scrollHeight)`);
  res['idle.bottomMsPerS'] = await busy(4000);
  await tab.close();
}

browser.kill();
await sleep(300);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {
  // the browser may still hold a file for a moment; it is a temp dir
}
report(res, 'bench-results.json');
