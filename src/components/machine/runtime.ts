// Browser runtime for the home page. The page is complete without this file;
// everything here is enhancement: the intro, one movement per section, focus
// mode (a hash opens just that section) and the command line.
//
// Debug query parameters (used to screenshot specific states):
//   ?seek=6.5         freeze the intro at 6.5s (window.seek(s) does the same)
//   ?move=0.6         freeze every section's movement at 60% (1 = settled)
//   ?run=help;proj    run these commands after load (never navigates away)
//   ?intro            play the intro even if this tab has already seen it
//   ?intro=walk       ...with that cat (nap, pounce, walk, stretch); combines with ?seek=
//   ?cat=2.5          the hero's cat, frozen 2.5s after it was summoned (implies ?move=1)
//   ?luna=14.8        the about section's cat, frozen 14.8s into her loop (implies ?move=1)
//   ?bench            count each section's frames and their cost (window.mcCost: id -> [frames, ms]; scripts/bench.ts)

import { complete, execute, suggest, type Action, type ShellContext } from '../shell/commands';
import { P, cl } from './draw';
import { CAT_LEN, applyCues, collectCues, createMovement, settleCues, type Movement } from './motion';
import type { MachineData } from './scene';
import type { SceneCopy } from './copy';

interface RuntimeData {
  context: ShellContext;
  titles: Record<string, string>;
  navigating: string;
  fullFile: string;
  still: string;
  /** What the prompt says when the cat is summoned. Absent when the data has no cat. */
  catSeen?: string;
}

interface Section {
  id: string;
  el: HTMLElement;
  mv: Movement;
  dur: number;
  t: number;
  /** armed: hidden, waiting to scroll into view. playing: cues running. idle: only the canvas moves. */
  phase: 'armed' | 'playing' | 'idle' | 'done';
  idles: boolean;
  visible: boolean;
  /** Cues are still resolving, so every frame counts. */
  hot: boolean;
  /** When its canvas was last painted (ms, the frame clock). */
  painted: number;
}

const SEEN_KEY = 'mc:seen';
/** The shortest gap between two paints of an idle loop (ms): 30 a second, with room for a 60 Hz frame clock's jitter. */
const IDLE_MS = 1000 / 30 - 4;
/** Where the asset's movement picks up after the intro: the name is known, the lock is about to confirm. */
const HANDOFF = 1.3;

const html = document.documentElement;

function start(root: HTMLElement, data: RuntimeData) {
  const ctx = data.context;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector) as T;
  const $$ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = root) => [...scope.querySelectorAll<T>(selector)];

  const params = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const frozen = params.has('move') ? cl(Number(params.get('move')) || 0) : params.has('cat') || params.has('luna') ? 1 : null;
  const scripted = params.has('run');
  const still = reduced || frozen !== null;
  const costs: Record<string, number[]> | null = params.has('bench') ? ((window as unknown as { mcCost: object }).mcCost = {}) : null;

  /* ---------------- sections and their movements ---------------- */

  const secs: Section[] = $$('[data-section]').map((el) => {
    const sec: Section = {
      id: el.id,
      el,
      mv: createMovement(el, reduced, () => redraw(sec)),
      dur: Number(el.dataset.dur) || 2,
      t: 0,
      phase: reduced ? 'done' : 'armed',
      idles: el.hasAttribute('data-idle'),
      visible: false,
      hot: false,
      painted: 0,
    };
    return sec;
  });
  const byId = (id: string) => secs.find((s) => s.id === id);
  let focus: string | null = html.dataset.focus ?? null;
  let introOn = html.classList.contains('mc-intro-on');
  let handoff = 0;

  /* Associations: a list of entities, one open record. */
  const assoc = byId('associations');
  const tabs = $$<HTMLAnchorElement>('[data-ent]');
  const records = tabs.map((tab) => document.getElementById(tab.dataset.ent ?? '') as HTMLElement);
  const recordCues = records.map((record) => collectCues(record));
  const selectAt = Number(assoc?.el.dataset.selectAt) || 1;
  let selected = -1;
  let wanted = 0;

  function select(i: number, byUser = false) {
    if (!assoc || !records[i]) return;
    if (selected >= 0) settleCues(recordCues[selected]);
    selected = i;
    tabs.forEach((tab, n) => {
      tab.setAttribute('aria-selected', String(n === i));
      tab.tabIndex = n === i ? 0 : -1;
      tab.classList.toggle('is-sel', n === i);
      records[n].hidden = n !== i;
    });
    const fx = assoc.mv.fx;
    if (fx) {
      fx.state.sel = i;
      fx.state.selT = byUser ? assoc.t : selectAt;
      fx.memo = {};
    }
    if (!byUser) return;
    history.replaceState(null, '', `#${records[i].id}`);
    if (still) return redraw(assoc);
    assoc.hot = true;
    wake();
    // Stacked layout: the record opens below the list, so bring it into view.
    if (records[i].getBoundingClientRect().top > innerHeight * 0.8) records[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /** The open record resolves in on its own clock, counted from the moment it was selected. */
  function frameRecord(t: number) {
    const record = records[selected];
    const fx = assoc?.mv.fx;
    if (!record || !fx) return false;
    const local = t - (fx.state.selT ?? 0);
    const cues = recordCues[selected];
    const pending = local < cues.end();
    if (pending) {
      applyCues(cues, local);
      record.style.opacity = P(local, 0, 0.25).toFixed(3);
    } else {
      settleCues(cues);
      record.style.removeProperty('opacity');
    }
    return pending;
  }

  if (tabs.length) {
    const list = $('[data-ents]');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-orientation', 'vertical');
    $$('li', list).forEach((li) => li.setAttribute('role', 'presentation'));
    tabs.forEach((tab, i) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', records[i].id);
      records[i].setAttribute('role', 'tabpanel');
      records[i].setAttribute('aria-label', tab.textContent?.trim().replace(/\s+/g, ' ') ?? '');
    });
    list.addEventListener('keydown', (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      const to = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : step ? (selected + step + tabs.length) % tabs.length : -1;
      if (to < 0) return;
      event.preventDefault();
      select(to, true);
      tabs[to].focus();
    });
  }

  /* The cat: summoned into the hero's feed, it stays a few seconds and leaves. */
  const asset = byId('asset');
  let leaving = 0;

  function dismiss() {
    const fx = asset?.mv.fx;
    if (!fx) return;
    delete fx.state.catAt;
    fx.host.classList.remove('is-cat');
  }

  /** `after`: the section is about to play its entrance, so the cat comes right after it. `local` (frozen frames) starts it that many seconds in. */
  function summon(after = false, local = 0, hold = false) {
    const fx = asset?.mv.fx;
    if (!asset || !fx) return;
    clearTimeout(leaving);
    fx.state.catAt = (after && !still ? asset.dur : asset.t) - (still && !local ? CAT_LEN / 2 : local);
    if (!still) return wake();
    fx.host.classList.add('is-cat');
    redraw(asset);
    if (hold) return;
    leaving = window.setTimeout(() => {
      dismiss();
      redraw(asset);
    }, 4000);
  }

  /** While the cat is in the frame the subject steps back for it. Returns true while it is there. */
  function frameCat(t: number) {
    const fx = asset?.mv.fx;
    const at = fx?.state.catAt;
    if (!fx || at === undefined || still) return false;
    const local = t - at;
    if (local >= CAT_LEN) dismiss();
    else fx.host.classList.toggle('is-cat', local > 0.2 && local < CAT_LEN - 1.4);
    return local < CAT_LEN;
  }

  function frame(sec: Section, all = false) {
    const cat = sec === asset && frameCat(sec.t);
    const pending = sec.mv.frame(sec.t, all);
    return (sec === assoc ? frameRecord(sec.t) || pending : pending) || cat;
  }

  /** Repaints a section that is not animating: after a resize, a selection, a late font. */
  function redraw(sec: Section) {
    if (reduced) return sec.mv.settle();
    if (sec.phase === 'armed') return;
    frame(sec, frozen !== null);
  }

  function play(sec: Section, from = 0) {
    sec.t = from;
    sec.phase = 'playing';
    sec.el.dataset.played = '';
    sec.mv.reset();
    if (sec === assoc) select(wanted);
    frame(sec);
    wake();
  }

  function arm(sec: Section) {
    sec.phase = 'armed';
    delete sec.el.dataset.played;
    sec.mv.clear();
    if (sec === asset) dismiss();
    if (sec === assoc && selected >= 0) {
      settleCues(recordCues[selected]);
      records[selected].style.removeProperty('opacity');
    }
  }

  // One clock for every section; it sleeps when nothing on screen is moving.
  let raf = 0;
  let nap = 0;
  let prev = 0;
  function tick(now: number) {
    raf = 0;
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    let busy = false;
    /** When the next idle loop is due a paint; -1 while something needs every frame. */
    let due = Infinity;
    for (const sec of secs) {
      if ((sec.phase !== 'playing' && sec.phase !== 'idle') || !sec.visible) continue;
      sec.t += dt;
      busy = true;
      // Idle loops are ambient: about 30 frames a second is plenty, whatever the screen's refresh rate (on a 60 Hz
      // screen, every other frame).
      if (sec.phase === 'idle' && !sec.hot && now - sec.painted < IDLE_MS) {
        if (due >= 0) due = Math.min(due, sec.painted + IDLE_MS);
        continue;
      }
      sec.painted = now;
      const t0 = costs ? performance.now() : 0;
      const pending = frame(sec);
      if (costs) {
        const c = (costs[sec.id] ??= [0, 0]);
        c[0]++;
        c[1] += performance.now() - t0;
      }
      sec.hot = pending;
      if (!pending && sec.phase === 'playing') sec.phase = sec.idles ? 'idle' : 'done';
      if (sec.phase === 'playing' || sec.hot) due = -1;
      else if (sec.phase === 'idle' && due >= 0) due = Math.min(due, now + IDLE_MS);
    }
    if (!busy) return;
    // Only idle loops left: sleep until the next one is due, instead of asking the browser for every frame in between.
    if (due > now + 20 && due !== Infinity) {
      nap = window.setTimeout(() => {
        nap = 0;
        raf = requestAnimationFrame(tick);
      }, due - now - 10);
    } else raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (nap) {
      // Asleep between idle frames: something wants the clock now.
      clearTimeout(nap);
      nap = 0;
      raf = requestAnimationFrame(tick);
      return;
    }
    if (raf || still) return;
    prev = performance.now();
    raf = requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const sec = secs.find((s) => s.el === entry.target);
      if (sec) sec.visible = entry.isIntersecting;
    }
    wake();
  });
  secs.forEach((sec) => observer.observe(sec.el));

  /* ---------------- where we are: scroll spy, triggers, focus ---------------- */

  const now = root.querySelector<HTMLElement>('[data-now]');
  const chips = $$('[data-chip]');
  const shown = (sec: Section) => !focus || focus === sec.id;

  function check() {
    const live = secs.filter(shown);
    let current = live[0];
    for (const sec of live) {
      const r = sec.el.getBoundingClientRect();
      if (r.top <= innerHeight * 0.45) current = sec;
      if (!introOn && sec.phase === 'armed' && r.top < innerHeight * 0.72 && r.bottom > innerHeight * 0.15) {
        play(sec, sec.id === 'asset' ? handoff : 0);
        if (sec.id === 'asset') handoff = 0;
      }
    }
    if (!current) return;
    const index = secs.indexOf(current) + 1;
    if (now) now.textContent = `${String(index).padStart(2, '0')} / ${String(secs.length).padStart(2, '0')} — ${data.titles[current.id] ?? current.id}`;
    for (const chip of chips) {
      if (chip.dataset.chip !== current.id) chip.removeAttribute('aria-current');
      else if (!chip.hasAttribute('aria-current')) {
        chip.setAttribute('aria-current', 'true');
        // On a phone the chip row scrolls: keep the current section's chip in it.
        const row = chip.parentElement;
        if (row && row.scrollWidth > row.clientWidth) row.scrollTo({ left: chip.offsetLeft - 24, behavior: reduced ? 'instant' : 'smooth' });
      }
    }
  }
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      check();
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  function setFocus(id: string | null) {
    const was = focus;
    focus = id;
    if (id) html.dataset.focus = id;
    else delete html.dataset.focus;
    // Leaving focus: stay on the section you were reading instead of jumping to the top of the file.
    if (was && !id) byId(was)?.el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  const hashRef = () => {
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return '';
    }
  };

  /** Shows the section holding `ref` (a section id, or the id of something inside one) and plays its movement. */
  function go(ref: string, push = true): boolean {
    const el = ref ? document.getElementById(ref) : null;
    const sec = el && secs.find((s) => s.el.contains(el));
    if (!el || !sec) return false;
    if (push && hashRef() !== ref) history.pushState(null, '', `#${ref}`);
    if (focus) setFocus(sec.id);
    $$('.is-target').forEach((node) => node.classList.remove('is-target'));
    let anchor: HTMLElement = sec.el;
    const record = records.indexOf(el);
    if (record >= 0) {
      wanted = record;
      if (still) select(record);
    } else if (el !== sec.el) {
      el.classList.add('is-target');
      anchor = el;
    }
    if (!still) arm(sec);
    if (focus && anchor === sec.el) scrollTo({ top: 0, behavior: 'instant' });
    else anchor.scrollIntoView({ block: 'start', behavior: reduced || focus || scripted ? 'instant' : 'smooth' });
    if (still) secs.forEach(redraw);
    check();
    return true;
  }

  addEventListener('popstate', () => {
    const ref = hashRef();
    if (ref && go(ref, false)) return;
    setFocus(null);
    scrollTo({ top: 0, behavior: 'instant' });
    check();
  });

  /* ---------------- intro ---------------- */

  const overlay = $('[data-intro]');
  const introCanvas = $<HTMLCanvasElement>('[data-intro] canvas');
  const skipButton = $<HTMLButtonElement>('[data-skip]');
  const host = window as unknown as { seek?: (s: number) => void; DURATION?: number; __mc?: boolean };

  function endIntro(skipped: boolean) {
    if (!introOn) return;
    introOn = false;
    for (const type of ['keydown', 'pointerdown', 'wheel', 'touchmove']) removeEventListener(type, skip, true);
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage can be blocked; the intro then simply plays again next time.
    }
    // The overlay keeps catching the pointer while it fades, so the tap that skips cannot also press a link.
    overlay.classList.add('is-out');
    overlay.classList.toggle('is-skip', skipped);
    setTimeout(() => html.classList.remove('mc-intro-on'), skipped ? 160 : 420);
    handoff = HANDOFF;
    check();
    if (finePointer && !skipped) input.focus({ preventScroll: true });
    else if (document.activeElement === skipButton) skipButton.blur();
  }

  function skip(event: Event) {
    // The key that skips must not also land in the prompt.
    if (event.type === 'keydown') {
      event.stopPropagation();
      event.preventDefault();
    }
    endIntro(true);
  }

  async function intro(freeze: number | null) {
    introOn = true;
    overlay.classList.remove('is-out', 'is-skip');
    html.classList.add('mc-intro-on');
    if (freeze === null) {
      addEventListener('keydown', skip, true);
      addEventListener('pointerdown', skip, true);
      addEventListener('wheel', skip, { capture: true, passive: true });
      addEventListener('touchmove', skip, { capture: true, passive: true });
      // The way out is a real control: first in line for the keyboard and for assistive technology.
      skipButton.focus({ preventScroll: true });
    }
    const { createMachine, along, homeCut, introName, CUT_END } = await import('./scene');
    const variant = introName(params.get('intro'));
    const machine = await createMachine(introCanvas, JSON.parse(introCanvas.dataset.machine ?? '{}') as MachineData, {
      copy: JSON.parse(introCanvas.dataset.copy ?? '{}') as SceneCopy,
      total: CUT_END,
      intro: variant,
    });
    if (!machine) return endIntro(true);
    // Intro time -> timeline time: the same scenes, cut tighter.
    const cut = homeCut(variant);
    const INTRO_END = cut[cut.length - 1][0];
    const render = (s: number) => machine.render(Math.min(along(cut, Math.max(0, s)), CUT_END - 0.001));
    host.seek = render;
    host.DURATION = INTRO_END;
    if (freeze !== null) return render(freeze);
    let at = 0;
    let last = performance.now();
    const step = (time: number) => {
      if (!introOn) return;
      at += Math.min(0.1, (time - last) / 1000);
      last = time;
      if (at >= INTRO_END) return endIntro(false);
      render(at);
      // For scripts/bench.ts: when the intro's first frame was drawn.
      if (!performance.getEntriesByName('mc:intro').length) performance.mark('mc:intro');
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  skipButton.addEventListener('click', () => endIntro(true));

  /* ---------------- the command line ---------------- */

  const dock = $('[data-dock]');
  const out = $('[data-out]');
  // (`data-log` is taken: the tic-tac-toe panel has a move log of its own.)
  const log = $('[data-output]');
  const form = $<HTMLFormElement>('[data-form]');
  const input = $<HTMLInputElement>('#mc-input');
  const ghost = $('[data-ghost]');
  const past: string[] = []; // what was typed, oldest first
  let cursor = 0; // position in it while walking with the arrow keys
  let draft = '';
  let closing = 0;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  function close() {
    clearTimeout(closing);
    out.classList.remove('is-open');
  }

  /** Renders one action into the output block. Returns true when the result needs no reading (it can fade on its own). */
  function render(action: Action, block: HTMLElement): boolean {
    switch (action.type) {
      case 'print': {
        const ok = go(action.ref);
        if (ok) block.append(el('p', 'mc-line is-dim', data.navigating.replace('{}', `#${action.ref}`)));
        return ok;
      }
      case 'lines':
        for (const line of action.lines) block.append(el('p', `mc-line${action.tone ? ` is-${action.tone}` : ''}`, line));
        return action.tone === 'dim';
      case 'menu': {
        const list = el('ul', `mc-menu${action.wide ? ' is-wide' : ''}`);
        for (const item of action.items) {
          const row = el('li');
          const button = el('button', '', item.label);
          button.type = 'button';
          button.dataset.run = item.run;
          row.append(button);
          if (item.hint) row.append(el('span', '', item.hint));
          list.append(row);
        }
        block.append(list);
        return false;
      }
      case 'go': {
        // ?run= is for screenshots; do not navigate away from the frame being captured.
        if (scripted) return true;
        const { href, external, download } = action;
        setTimeout(() => {
          if (download) {
            const link = el('a');
            link.href = href;
            link.download = '';
            link.click();
          } else if (external) window.open(href, '_blank', 'noopener');
          else location.assign(href);
        }, 350);
        return true;
      }
      case 'reset':
        setFocus(null);
        history.replaceState(null, '', location.pathname + location.search);
        block.append(el('p', 'mc-line is-dim', data.fullFile));
        check();
        return true;
      case 'reboot':
        if (reduced) {
          block.append(el('p', 'mc-line is-dim', data.still));
          return false;
        }
        try {
          sessionStorage.removeItem(SEEN_KEY);
        } catch {
          // Nothing to forget.
        }
        setFocus(null);
        history.replaceState(null, '', location.pathname);
        scrollTo({ top: 0, behavior: 'instant' });
        secs.forEach(arm);
        input.blur();
        void intro(null);
        return true;
      case 'cat': {
        if (!asset || !data.catSeen) return true;
        const r = asset.el.getBoundingClientRect();
        // Bring the hero into view first, unless it already is.
        const away = !shown(asset) || r.bottom < innerHeight * 0.4 || r.top > innerHeight * 0.5;
        if (away) go('asset');
        summon(away);
        block.append(el('p', 'mc-line', data.catSeen));
        return true;
      }
      case 'title':
        block.append(el('p', 'mc-line', action.text));
        return false;
      case 'glitch':
        root.classList.remove('is-tear');
        void root.offsetWidth; // restart the animation if it is already there
        if (!reduced) root.classList.add('is-tear');
        return true;
      default:
        return true;
    }
  }

  /**
   * Runs one line and shows its result above the prompt, replacing the previous one.
   * `quiet` (a tapped chip) keeps the panel shut when the result is only "going there":
   * the page moving is the answer. The log still gets the line, so it is announced.
   */
  function run(line: string, quiet = false) {
    const text = line.trim();
    if (!text) return;
    past.push(text);
    cursor = past.length;
    const result = execute(text, ctx, past);
    clearTimeout(closing);
    if (result.actions.some((action) => action.type === 'clear')) {
      log.replaceChildren();
      return close();
    }
    const block = el('div', 'mc-block');
    block.append(el('p', 'mc-echo', text));
    let transient = true;
    for (const action of result.actions) transient = render(action, block) && transient;
    log.replaceChildren(block);
    if (quiet && transient) return close();
    out.classList.add('is-open');
    out.scrollTop = 0;
    if (transient && !scripted) closing = window.setTimeout(close, 2400);
  }

  function showGhost() {
    const hidden = el('span', '', input.value);
    ghost.replaceChildren(hidden, suggest(input.value, ctx));
    form.classList.toggle('has-ghost', Boolean(ghost.lastChild?.textContent));
  }

  function setInput(value: string) {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    showGhost();
  }

  /** Tab: extend to the longest unambiguous completion; when there is nothing to add, list what it could be. */
  function tab() {
    const { value, options } = complete(input.value, ctx);
    if (value !== input.value) return setInput(value);
    if (options.length < 2) return;
    const block = el('div', 'mc-block');
    block.append(el('p', 'mc-echo', input.value));
    const head = input.value.split(/\s+/).slice(0, -1);
    render({ type: 'menu', wide: true, items: options.map((option) => ({ label: option, run: [...head, option].join(' ') })) }, block);
    log.replaceChildren(block);
    clearTimeout(closing);
    out.classList.add('is-open');
  }

  // The same key as a button, for phones: there is no Tab on a touch keyboard.
  $('[data-complete]').addEventListener('click', () => {
    tab();
    input.focus({ preventScroll: true });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const line = input.value;
    setInput('');
    run(line);
  });

  input.addEventListener('input', showGhost);

  input.addEventListener('keydown', (event) => {
    const atEnd = input.selectionStart === input.value.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (cursor === past.length) draft = input.value;
      cursor = Math.max(0, Math.min(past.length, cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      setInput(cursor === past.length ? draft : past[cursor]);
    } else if (event.key === 'Tab' && !event.shiftKey && input.value.trim()) {
      // An empty prompt lets Tab move focus as usual.
      event.preventDefault();
      tab();
    } else if ((event.key === 'ArrowRight' || event.key === 'End') && atEnd && ghost.lastChild?.textContent) {
      event.preventDefault();
      setInput(input.value + suggest(input.value, ctx));
    } else if (event.key === 'Escape') {
      if (out.classList.contains('is-open')) close();
      else if (input.value) setInput('');
      else input.blur();
    } else if (event.ctrlKey && event.key === 'l') {
      event.preventDefault();
      run('clear');
    } else if (event.ctrlKey && event.key === 'c' && input.selectionStart === input.selectionEnd) {
      event.preventDefault();
      setInput('');
    }
  });

  $('[data-close]').addEventListener('click', close);

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLAnchorElement>('[data-ent]');
    if (tab) {
      event.preventDefault();
      return select(tabs.indexOf(tab), true);
    }
    // Chips, help rows and listings all run a command.
    const runner = target.closest<HTMLElement>('[data-run]');
    if (runner) {
      event.preventDefault();
      const listed = Boolean(runner.closest('[data-output]'));
      run(runner.dataset.run ?? '', !listed);
      if (finePointer && listed) input.focus({ preventScroll: true });
      return;
    }
    // In-page links move like commands do, so they get the movement and the history entry.
    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (link && link.origin === location.origin && link.pathname === location.pathname && link.hash.length > 1) {
      let ref = '';
      try {
        ref = decodeURIComponent(link.hash.slice(1));
      } catch {
        return;
      }
      if (go(ref)) event.preventDefault();
      return;
    }
    // A click on the page (not the dock: Enter in the prompt clicks its submit button) puts the spotlight back on everything.
    if (target.closest('[data-dock]')) return;
    if (!target.closest('.is-target')) $$('.is-target').forEach((node) => node.classList.remove('is-target'));
    close();
  });

  // "/" focuses the prompt; so does simply starting to type.
  document.addEventListener('keydown', (event) => {
    if (introOn || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (event.key === 'Escape' && target !== input) return close();
    if (event.key.length !== 1 || event.key === ' ' || target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === '/') event.preventDefault();
    input.focus({ preventScroll: true });
  });

  // A phone's keyboard covers a fixed dock; ride the visual viewport instead.
  const viewport = window.visualViewport;
  if (viewport) {
    const lift = () => {
      const gap = Math.max(0, innerHeight - viewport.height - viewport.offsetTop);
      dock.style.transform = gap > 1 ? `translateY(${-gap}px)` : '';
    };
    viewport.addEventListener('resize', lift);
    viewport.addEventListener('scroll', lift);
  }
  if (matchMedia('(max-width: 560px)').matches && input.dataset.short) input.placeholder = input.dataset.short;
  new ResizeObserver(() => html.style.setProperty('--mc-dock', `${dock.offsetHeight}px`)).observe(dock);

  /* ---------------- go ---------------- */

  host.__mc = true;

  // Infinite CSS loops are painted on the main thread every frame, even off screen: off screen they hold still. The
  // invitation's board, and the monitor's live light.
  for (const el of document.querySelectorAll<HTMLElement | SVGElement>('.mc-ttt, .mc-live i')) {
    if (reduced) break;
    new IntersectionObserver(([e]) => {
      for (const a of el.getAnimations({ subtree: true })) {
        if (e.isIntersecting) a.play();
        else a.pause();
      }
    }).observe(el);
  }
  const ref = hashRef();
  const landed = ref ? document.getElementById(ref) : null;
  wanted = Math.max(0, landed ? records.indexOf(landed) : 0);
  select(wanted);
  const landing = landed ? secs.find((s) => s.el.contains(landed)) : undefined;
  if (landing) setFocus(landing.id);
  else if (focus) setFocus(null);

  if (frozen !== null) {
    // Every section frozen at the same fraction of its movement.
    html.classList.remove('mc-intro-on');
    introOn = false;
    if (landing && ref) go(ref, false);
    const luna = byId('about')?.mv.fx;
    if (luna && params.has('luna')) luna.state.luna = Math.max(0, Number(params.get('luna')) || 0);
    for (const sec of secs) {
      sec.el.dataset.played = '';
      sec.phase = 'done';
      sec.mv.reset();
      sec.t = frozen * sec.dur;
      frame(sec, true);
    }
    if (params.has('cat')) summon(false, Number(params.get('cat')) || CAT_LEN / 2, true);
    check();
  } else if (introOn) {
    void intro(params.has('seek') ? Number(params.get('seek')) || 0 : null);
  } else if (landing && ref) {
    go(ref, false);
  } else {
    if (reduced) secs.forEach(redraw);
    check();
  }
  // Late fonts move boxes; the canvases measure the DOM, so measure again.
  void document.fonts.ready.then(() => {
    for (const sec of secs) {
      if (sec.mv.fx) sec.mv.fx.memo = {};
      if (sec.phase === 'done' || still) redraw(sec);
    }
  });

  const script = (params.get('run') ?? '').split(';').filter(Boolean);
  // After first paint, like a visitor would.
  if (script.length) addEventListener('load', () => setTimeout(() => script.forEach((line) => run(line)), 80));
}

const root = document.querySelector<HTMLElement>('[data-machine-root]');
const payload = document.getElementById('mc-data');
if (root && payload) start(root, JSON.parse(payload.textContent ?? '{}') as RuntimeData);
