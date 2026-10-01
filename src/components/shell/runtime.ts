// Browser runtime for /lab/shell: the authored intro and the working prompt.
// The page is complete without this file; everything here is enhancement.
//
// Debug query parameters (used to screenshot specific states):
//   ?t=3.5            freeze the intro at 3.5s (animations paused on that frame)
//   ?run=help;ls      skip the intro and run these commands
//   ?intro            play the intro even if this tab has already seen it

import { complete, execute, suggest, type Action, type ShellContext } from './commands';

const SEEN_KEY = 'sh:booted';
const html = document.documentElement;

/** Seeded PRNG (same one as BootScene): the typing rhythm is identical on every run, so ?t= is reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cue = [at: number, apply: () => void];

function start(root: HTMLElement, ctx: ShellContext) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector) as T;
  const $$ = (selector: string, scope: ParentNode = root) => [...scope.querySelectorAll<HTMLElement>(selector)];

  const session = $('[data-session]');
  const log = $('[data-log]');
  const form = $<HTMLFormElement>('[data-form]');
  const input = $<HTMLInputElement>('#sh-input');
  const ghost = $('[data-ghost]');
  const boot = $('[data-boot]');
  const title = $('[data-title]');
  const ps1 = $('.sh-ps1');
  const blocks = $$('[data-block]', session);

  const params = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const frozen = params.has('t') ? Number(params.get('t')) || 0 : null;
  const rnd = mulberry32(1337);
  const history: string[] = [];
  let cursor = 0; // position in history while walking it with the arrow keys
  let draft = '';

  const indexLines = (scope: ParentNode) => $$('.sh-l', scope).forEach((line, i) => line.style.setProperty('--i', String(i)));
  blocks.forEach(indexLines);

  /* ---------------- timeline: cues on a clock ---------------- */

  function timeline() {
    const cues: Cue[] = [];
    /** Schedules `apply` at `t` seconds. When a frame is frozen, `el` learns how far past the cue it is. */
    const at = (t: number, el: HTMLElement, apply: () => void, lag = '--lag') =>
      cues.push([
        t,
        () => {
          if (frozen !== null) el.style.setProperty(lag, `${(t - frozen).toFixed(3)}s`);
          apply();
        },
      ]);
    return { cues, at };
  }
  type Timeline = ReturnType<typeof timeline>;

  /** Plays cues against the frame clock; returns a stop function. */
  function play(cues: Cue[], done?: () => void): () => void {
    cues.sort((a, b) => a[0] - b[0]);
    let next = 0;
    let raf = 0;
    const origin = performance.now();
    const tick = (now: number) => {
      const t = (now - origin) / 1000;
      while (next < cues.length && cues[next][0] <= t) cues[next++][1]();
      if (next < cues.length) raf = requestAnimationFrame(tick);
      else done?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  /** Types `el`'s text by revealing --n characters. Uneven on purpose: hands hesitate at spaces and sometimes mid-word. */
  function typeCues(tl: Timeline, el: HTMLElement, t: number, pace = 1): number {
    const text = el.textContent ?? '';
    tl.at(t, el, () => el.style.setProperty('--n', '0'));
    for (let i = 1; i <= text.length; i++) {
      const ch = text[i - 1];
      t += (0.045 + rnd() * 0.06 + (ch === ' ' || ch === '/' ? 0.07 : 0) + (rnd() < 0.12 ? 0.08 : 0)) * pace;
      const n = String(i);
      tl.at(t, el, () => el.style.setProperty('--n', n));
    }
    return t;
  }

  /** wait -> typing -> (beat before Enter) -> run. Returns the time the output starts printing. */
  function blockCues(tl: Timeline, block: HTMLElement, t: number, pace = 1): number {
    tl.at(t, block, () => (block.dataset.state = 'typing'));
    const typed = typeCues(tl, $$('.sh-typed', block)[0], t + 0.22 * pace, pace);
    const enter = typed + 0.2 * pace;
    tl.at(enter, block, () => (block.dataset.state = 'run'));
    return enter;
  }

  /* ---------------- intro ---------------- */

  const scene = (name: string | null) => (name ? (boot.dataset.scene = name) : delete boot.dataset.scene);

  function setTitle(text: string) {
    const words = text.trim().split(/\s+/);
    title.replaceChildren(
      ...words.map((word, i) => {
        const span = document.createElement('span');
        span.textContent = span.dataset.text = word;
        span.style.setProperty('--i', String(i));
        return span;
      }),
    );
    title.style.setProperty('--chars', String(Math.max(...words.map((w) => w.length))));
    title.style.setProperty('--rows', String(words.length));
    title.classList.remove('is-jolt', 'is-out');
  }

  function tear() {
    if (reduced) return;
    root.classList.remove('is-tear');
    void root.offsetWidth; // restart the animation if it is already there
    root.classList.add('is-tear');
    setTimeout(() => root.classList.remove('is-tear'), 500);
  }

  let stopIntro = () => {};
  let reveal: IntersectionObserver | undefined;

  /** Everything visible, nothing pending. Safe to call more than once. */
  function settle() {
    stopIntro();
    reveal?.disconnect();
    scene(null);
    blocks.forEach((block) => delete block.dataset.state);
    html.classList.remove('sh-intro');
    html.classList.add('sh-docked');
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage can be blocked; the intro then simply plays again next time.
    }
    window.removeEventListener('keydown', skip, true);
    window.removeEventListener('pointerdown', skip, true);
    window.removeEventListener('wheel', skip, true);
    window.removeEventListener('touchmove', skip, true);
  }

  function skip(event: Event) {
    // The key that skips must not also land in the prompt.
    if (event.type === 'keydown') event.stopPropagation();
    settle();
  }

  function intro() {
    const tl = timeline();
    setTitle(title.dataset.text ?? '');
    $('[data-login-date]').textContent = new Date().toString().slice(0, 24);
    blocks.forEach((block) => (block.dataset.state = 'wait'));

    // 0.0  power on, then the boot log at its authored rhythm.
    tl.at(0, boot, () => scene('log'));
    let t = 0.35;
    for (const line of $$('.sh-bl', boot)) {
      t += Number(line.dataset.gap) / 1000;
      tl.at(t, line, () => line.classList.add('on'));
    }

    // Title card lands on the next half-second beat and holds for 3.5 beats.
    const card = Math.ceil((t + 0.25) * 2) / 2;
    tl.at(card, boot, () => scene('title'));
    const role = $('[data-role]');
    typeCues(tl, role, card + 0.5, 0.45);
    tl.at(card + 1, title, () => title.classList.add('is-jolt'), '--lag-jolt');
    tl.at(card + 1.62, title, () => title.classList.add('is-out'), '--lag-out');

    // Login.
    const login = card + 1.75;
    const [userLine, passLine, lastLine] = $$('[data-login]', boot);
    const cur = (line: HTMLElement) => [userLine, passLine, lastLine].forEach((l) => l.classList.toggle('is-cur', l === line));
    tl.at(login, boot, () => {
      scene('login');
      userLine.classList.add('on');
      cur(userLine);
    });
    t = typeCues(tl, $$('.sh-typed', userLine)[0], login + 0.3, 0.9);
    tl.at(t + 0.18, passLine, () => {
      passLine.classList.add('on');
      cur(passLine);
    });
    t = typeCues(tl, $$('.sh-typed', passLine)[0], t + 0.4, 0.5);
    tl.at(t + 0.2, lastLine, () => {
      lastLine.classList.add('on');
      cur(lastLine);
    });

    // The overlay cuts away; the session types itself.
    const session0 = t + 0.6;
    const progress = $('[data-progress]');
    for (let i = 1; i <= 24; i++) {
      const p = i / 24;
      tl.at(session0 * p, progress, () => progress.style.setProperty('--p', p.toFixed(3)));
    }
    tl.at(session0, root, () => {
      html.classList.remove('sh-intro');
      scene(null);
      tear();
    });
    t = blockCues(tl, blocks[0], session0 + 0.1);
    if (blocks[1]) t = blockCues(tl, blocks[1], t + 0.7, 0.7);
    const end = t + 0.5;

    const finish = () => {
      const pending = blocks.filter((block) => block.dataset.state === 'wait');
      settleChrome();
      // The rest of the transcript runs as it scrolls into view.
      reveal = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            reveal?.unobserve(entry.target);
            const one = timeline();
            blockCues(one, entry.target as HTMLElement, 0, 0.55);
            play(one.cues);
          }
        },
        { rootMargin: '0px 0px -18% 0px' },
      );
      pending.forEach((block) => reveal?.observe(block));
      // Unprinted text is invisible to find-in-page; do not keep it that way for long.
      setTimeout(settle, 12000);
    };
    /** End of the intro without touching the blocks still waiting below the fold. */
    const settleChrome = () => {
      const states = blocks.map((block) => block.dataset.state);
      settle();
      blocks.forEach((block, i) => states[i] === 'wait' && (block.dataset.state = 'wait'));
      if (finePointer) input.focus({ preventScroll: true });
    };
    tl.at(end, root, finish);

    if (frozen !== null) {
      html.classList.add('sh-frozen');
      tl.cues.sort((a, b) => a[0] - b[0]);
      for (const [time, apply] of tl.cues) if (time <= frozen) apply();
      return;
    }
    stopIntro = play(tl.cues);
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    window.addEventListener('wheel', skip, { capture: true, passive: true });
    window.addEventListener('touchmove', skip, { capture: true, passive: true });
  }

  /** Easter egg: one title card, then back to the session. */
  function flashTitle(text: string) {
    setTitle(text);
    boot.classList.add('is-flash');
    scene('title');
    const off = () => {
      boot.classList.remove('is-flash');
      scene(null);
      tear();
      window.removeEventListener('keydown', off, true);
      boot.removeEventListener('click', off);
    };
    setTimeout(() => title.classList.add('is-jolt'), 700);
    setTimeout(off, 1900);
    window.addEventListener('keydown', off, true);
    boot.addEventListener('click', off);
  }

  /* ---------------- rendering command output ---------------- */

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  /** Copies a server-rendered node for reprinting: no duplicate ids, no second h1. */
  function reprint(ref: string): HTMLElement | null {
    const source = root.querySelector<HTMLElement>(`[data-ref="${CSS.escape(ref)}"]`);
    if (!source) return null;
    let copy = source.cloneNode(true) as HTMLElement;
    if (source.hasAttribute('data-wrap') && source.parentElement) {
      // A single list entry keeps its list wrapper so it stays valid, styled markup.
      const wrapper = source.parentElement.cloneNode(false) as HTMLElement;
      wrapper.append(copy);
      copy = wrapper;
    }
    for (const node of [copy, ...$$('[id], [data-ref]', copy)]) {
      node.removeAttribute('id');
      node.removeAttribute('data-ref');
    }
    for (const h1 of $$('h1', copy)) {
      const p = el('p', h1.className);
      p.append(...h1.childNodes);
      h1.replaceWith(p);
    }
    return copy;
  }

  function render(action: Action, out: HTMLElement) {
    switch (action.type) {
      case 'print': {
        const copy = reprint(action.ref);
        if (copy) out.append(...(copy.classList.contains('sh-out') ? copy.childNodes : [copy]));
        break;
      }
      case 'lines':
        for (const line of action.lines) out.append(el('p', `sh-l sh-t${action.tone ? ` sh-t-${action.tone}` : ''}`, line));
        break;
      case 'menu': {
        const list = el('ul', `sh-menu${action.wide ? ' is-wide' : ''}`);
        for (const item of action.items) {
          const row = el('li', 'sh-l');
          const button = el('button', item.label.endsWith('/') ? 'is-dir' : '', item.label);
          button.type = 'button';
          button.dataset.run = item.run;
          row.append(button);
          if (item.hint) row.append(el('span', '', item.hint));
          list.append(row);
        }
        out.append(list);
        break;
      }
      case 'go': {
        const { href, external } = action;
        // ?run= is for screenshots; do not navigate away from the frame being captured.
        if (params.has('run')) break;
        setTimeout(() => (external ? window.open(href, '_blank', 'noopener') : location.assign(href)), 450);
        break;
      }
      case 'title':
        if (reduced) out.append(el('p', 'sh-l sh-t sh-t-error', action.text));
        else flashTitle(action.text);
        break;
      case 'glitch':
        tear();
        break;
      case 'reboot':
        try {
          sessionStorage.removeItem(SEEN_KEY);
        } catch {
          // Nothing to forget.
        }
        setTimeout(() => location.assign(location.pathname), 500);
        break;
    }
  }

  /** Runs one line. `typed` replays it on the prompt line first, for chips and clicked entries. */
  function run(line: string, typed = false) {
    const text = line.trim();
    settle(); // also releases any block still waiting for its scroll reveal
    if (text) history.push(text);
    cursor = history.length;
    const result = execute(text, ctx, history);

    if (result.actions.some((a) => a.type === 'clear' || a.type === 'reset')) {
      session.hidden = result.actions.some((a) => a.type === 'clear');
      log.replaceChildren();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    const block = el('section', 'sh-block');
    const cmd = el('p', 'sh-cmd');
    const out = el('div', 'sh-out');
    cmd.append(ps1.cloneNode(true), ' ', el('span', 'sh-typed', text));
    block.append(cmd, out);
    for (const action of result.actions) render(action, out);
    indexLines(block);
    log.append(block);

    if (typed && !reduced && text) {
      const tl = timeline();
      blockCues(tl, block, 0, 0.4);
      block.dataset.state = 'typing';
      play(tl.cues);
    } else {
      block.dataset.state = 'run';
    }
    // A terminal jumps; it does not glide. (Also keeps a long smooth scroll from fighting the next command.)
    block.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  /* ---------------- the prompt ---------------- */

  function showGhost() {
    const hidden = el('span', '', input.value);
    ghost.replaceChildren(hidden, suggest(input.value, ctx));
  }

  function setInput(value: string) {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    showGhost();
  }

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
      if (cursor === history.length) draft = input.value;
      cursor = Math.max(0, Math.min(history.length, cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      setInput(cursor === history.length ? draft : history[cursor]);
    } else if (event.key === 'Tab' && !event.shiftKey && input.value.trim()) {
      // An empty prompt lets Tab move focus as usual.
      event.preventDefault();
      const { value, options } = complete(input.value, ctx);
      if (value !== input.value) setInput(value);
      else if (options.length > 1) {
        // Like bash on a second Tab: show what it could be.
        const block = el('section', 'sh-block');
        const cmd = el('p', 'sh-cmd');
        cmd.append(ps1.cloneNode(true), ' ', el('span', 'sh-typed', input.value));
        block.append(cmd, el('p', 'sh-l sh-t sh-t-dim', options.join('   ')));
        block.dataset.state = 'run';
        log.append(block);
        block.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    } else if ((event.key === 'ArrowRight' || event.key === 'End') && atEnd && ghost.lastChild?.textContent) {
      event.preventDefault();
      setInput(input.value + suggest(input.value, ctx));
    } else if (event.ctrlKey && event.key === 'l') {
      event.preventDefault();
      run('clear');
    } else if (event.ctrlKey && event.key === 'c' && input.selectionStart === input.selectionEnd) {
      event.preventDefault();
      setInput('');
    }
  });

  // Keyboard focus landing in a block that has not printed yet reveals everything.
  session.addEventListener('focusin', () => blocks.some((block) => block.dataset.state) && settle());

  // Chips, help rows and ls entries all run a command.
  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-run]');
    if (!target || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    run(target.dataset.run ?? '', true);
    if (finePointer) input.focus({ preventScroll: true });
  });

  // Start typing anywhere and it goes to the prompt.
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || event.key === ' ') return;
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    input.focus({ preventScroll: true });
  });

  // Session clock in the status bar.
  const uptime = $('[data-uptime]');
  const born = Date.now();
  const clock = () => {
    const s = Math.floor((Date.now() - born) / 1000);
    uptime.textContent = `tty1 · up ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  clock();
  setInterval(clock, 1000);

  /* ---------------- go ---------------- */

  (window as unknown as { __sh: boolean }).__sh = true;
  if (html.classList.contains('sh-intro')) intro();
  else {
    settle();
    if (finePointer && !params.has('run')) input.focus({ preventScroll: true });
  }
  const script = (params.get('run') ?? '').split(';').filter(Boolean);
  // After first paint, like a visitor would.
  if (script.length) addEventListener('load', () => setTimeout(() => script.forEach((line) => run(line)), 60));
}

const root = document.querySelector<HTMLElement>('[data-shell]');
const data = document.getElementById('sh-data');
if (root && data) start(root, JSON.parse(data.textContent ?? '{}') as ShellContext);
