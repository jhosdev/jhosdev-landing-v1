// Command interpreter for the home page prompt and the /lab/shell terminal. Pure logic, no DOM: it maps
// an input line to a list of actions the runtime renders, so it can be tested
// in vitest and so every personal fact stays in the server-rendered markup
// (actions point at it by `ref`, they never carry profile copy themselves).

export type ShellLocale = 'en' | 'es';

export interface ShellFile {
  /** Path relative to home, e.g. "stack.txt", "projects/my-api", "writing/post.md". */
  path: string;
  /** `data-ref` of the server-rendered node holding this file's content. */
  ref?: string;
  /** Where `open` goes: an article page, a profile, the PDF. */
  href?: string;
  external?: boolean;
  /** Save the target instead of navigating to it (the PDF). */
  download?: boolean;
}

export interface ShellStrings {
  help: Record<string, string>;
  helpIntro: string;
  notFound: string;
  didYouMean: string;
  noSuchFile: string;
  isDirectory: string;
  missingOperand: string;
  binary: string;
  opening: string;
  readWith: string;
  langUsage: string;
  langAlready: string;
  sudo: string;
  rm: string;
  cd: string;
  hello: string;
  logout: string;
}

export interface ShellContext {
  user: string;
  host: string;
  locale: ShellLocale;
  files: ShellFile[];
  langHref: Record<ShellLocale, string>;
  t: ShellStrings;
  /** Commands listed by `help` and offered by completion. Defaults to COMMANDS. */
  commands?: readonly string[];
  /** Command name (or alias) -> `ref` of the section it shows. Defaults to the /lab/shell sections. */
  sections?: Record<string, string>;
  /** Command name (or alias) -> another page of the site it navigates to. */
  pages?: Record<string, string>;
  /** The cat's name, as a command. When set, it (and a bare `cat`) makes the particles form the cat. */
  cat?: string;
}

export interface MenuItem {
  label: string;
  /** Command executed when the entry is clicked. */
  run: string;
  hint?: string;
}

export type Action =
  | { type: 'print'; ref: string }
  | { type: 'lines'; lines: string[]; tone?: 'error' | 'dim' }
  | { type: 'menu'; items: MenuItem[]; wide?: boolean }
  | { type: 'go'; href: string; external?: boolean; download?: boolean }
  | { type: 'title'; text: string }
  | { type: 'clear' }
  | { type: 'reset' }
  | { type: 'reboot' }
  | { type: 'cat' }
  | { type: 'glitch' };

export interface Result {
  actions: Action[];
  /** Shell-style exit status: 0 ok, 1 error, 2 misuse, 127 command not found. */
  status: number;
}

/** Commands listed by `help` and offered by tab completion, in display order. */
export const COMMANDS = [
  'help',
  'whoami',
  'ls',
  'cat',
  'projects',
  'open',
  'stack',
  'principles',
  'experience',
  'writing',
  'contact',
  'history',
  'lang',
  'clear',
  'reset',
  'reboot',
] as const;

const DIRS = ['projects', 'writing', 'associations', 'links', 'opensource'];
/** Directory listings that are already rendered as a section on the page. */
const DIR_REF: Record<string, string> = { projects: 'projects', writing: 'writing', associations: 'associations', links: 'contact', opensource: 'opensource' };
/** Commands that are just `cat` of one section. */
const SECTION: Record<string, string> = {
  whoami: 'whoami',
  projects: 'projects',
  stack: 'stack',
  principles: 'principles',
  experience: 'experience',
  writing: 'writing',
  contact: 'contact',
};

const ok = (...actions: Action[]): Result => ({ actions, status: 0 });
const fail = (line: string, status = 1): Result => ({ actions: [{ type: 'lines', lines: [line], tone: 'error' }], status });
const fill = (template: string, value: string) => template.replace('{}', value);

// ponytail: whitespace split only — no quoting, pipes or globs. Add a real lexer if a command ever needs them.
export function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const stem = (name: string) => name.replace(/\.[a-z]+$/, '');
const cleanPath = (arg: string) => arg.replace(/^(~\/|\.\/|\/)+/, '').replace(/\/+$/, '');

/** Resolves an argument to a file: exact path, then bare name, then name without extension. */
export function findFile(arg: string, files: ShellFile[]): ShellFile | undefined {
  const want = cleanPath(arg).toLowerCase();
  if (!want) return undefined;
  const by = (key: (f: ShellFile) => string) => files.find((f) => key(f).toLowerCase() === want);
  return by((f) => f.path) ?? by((f) => basename(f.path)) ?? by((f) => stem(basename(f.path)));
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

function nearest(name: string, commands: readonly string[]): string | undefined {
  const scored = commands.map((c) => [distance(name, c), c] as const).sort((x, y) => x[0] - y[0])[0];
  return scored[0] <= 2 ? scored[1] : undefined;
}

function homeListing(files: ShellFile[]): MenuItem[] {
  const top = files.filter((f) => !f.path.includes('/'));
  return [
    ...top.map((f) => ({ label: f.path, run: `${f.ref ? 'cat' : 'open'} ${f.path}` })),
    ...DIRS.filter((d) => files.some((f) => f.path.startsWith(`${d}/`))).map((d) => ({ label: `${d}/`, run: `ls ${d}/` })),
  ];
}

function ls(args: string[], ctx: ShellContext): Result {
  const target = args.find((a) => !a.startsWith('-'));
  const dir = target === undefined ? '' : cleanPath(target);
  if (dir === '' || dir === '.' || dir === '~') return ok({ type: 'menu', items: homeListing(ctx.files), wide: true });
  if (DIR_REF[dir]) return ok({ type: 'print', ref: DIR_REF[dir] });
  const file = findFile(dir, ctx.files);
  if (file) return ok({ type: 'menu', items: [{ label: file.path, run: `${file.ref ? 'cat' : 'open'} ${file.path}` }], wide: true });
  return fail(`ls: ${fill(ctx.t.noSuchFile, target ?? '')}`, 2);
}

function cat(args: string[], ctx: ShellContext): Result {
  if (args.length === 0) return fail(`cat: ${ctx.t.missingOperand}`, 2);
  const actions: Action[] = [];
  let status = 0;
  for (const arg of args) {
    const file = findFile(arg, ctx.files);
    if (DIRS.includes(cleanPath(arg))) {
      actions.push({ type: 'lines', lines: [`cat: ${fill(ctx.t.isDirectory, arg)}`], tone: 'error' });
      status = 1;
    } else if (!file) {
      actions.push({ type: 'lines', lines: [`cat: ${fill(ctx.t.noSuchFile, arg)}`], tone: 'error' });
      status = 1;
    } else if (file.ref) {
      actions.push({ type: 'print', ref: file.ref });
      if (file.href) actions.push({ type: 'lines', lines: [fill(ctx.t.readWith, `open ${stem(basename(file.path))}`)], tone: 'dim' });
    } else if (file.href && file.path.startsWith('links/')) {
      actions.push({ type: 'lines', lines: [file.href] });
    } else {
      actions.push({ type: 'lines', lines: [`cat: ${fill(ctx.t.binary, `open ${file.path}`)}`], tone: 'error' });
      status = 1;
    }
  }
  return { actions, status };
}

function open(args: string[], ctx: ShellContext): Result {
  if (args.length === 0) return fail(`open: ${ctx.t.missingOperand}`, 2);
  const file = findFile(args[0], ctx.files);
  if (!file) return fail(`open: ${fill(ctx.t.noSuchFile, args[0])}`);
  if (file.href) {
    return ok(
      { type: 'lines', lines: [fill(ctx.t.opening, file.path)], tone: 'dim' },
      { type: 'go', href: file.href, ...(file.external && { external: true }), ...(file.download && { download: true }) },
    );
  }
  return ok({ type: 'print', ref: file.ref as string });
}

function lang(args: string[], ctx: ShellContext): Result {
  const want = args[0]?.toLowerCase();
  if (want !== 'en' && want !== 'es') return fail(`lang: ${ctx.t.langUsage}`, 2);
  if (want === ctx.locale) return ok({ type: 'lines', lines: [fill(ctx.t.langAlready, want)], tone: 'dim' });
  return ok({ type: 'lines', lines: [`LANG=${want === 'es' ? 'es_ES' : 'en_US'}.UTF-8`], tone: 'dim' }, { type: 'go', href: ctx.langHref[want] });
}

function help(ctx: ShellContext): Result {
  return ok(
    { type: 'lines', lines: [ctx.t.helpIntro], tone: 'dim' },
    { type: 'menu', items: (ctx.commands ?? COMMANDS).map((c) => ({ label: USAGE[c] ?? c, run: RUNNABLE[c] ?? c, hint: ctx.t.help[c] })) },
  );
}

const USAGE: Record<string, string> = { ls: 'ls [dir]', cat: 'cat <file>', open: 'open <name>', lang: 'lang en|es' };
/** What a click on a help row runs when the bare command needs an argument. */
const RUNNABLE: Record<string, string> = { cat: 'ls', open: 'ls' };

/** Runs one input line. `history` is the list of previous inputs, oldest first. */
export function execute(input: string, ctx: ShellContext, history: string[] = []): Result {
  const [name, ...args] = tokenize(input);
  if (!name) return ok();
  const cmd = name.toLowerCase();

  if (cmd === 'history') {
    if (args[0] === '--work') return ok({ type: 'print', ref: 'experience' });
    return ok({ type: 'lines', lines: history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`) });
  }
  const sections = ctx.sections ?? SECTION;
  if (Object.hasOwn(sections, cmd)) return ok({ type: 'print', ref: sections[cmd] });
  if (ctx.pages && Object.hasOwn(ctx.pages, cmd)) {
    return ok({ type: 'lines', lines: [fill(ctx.t.opening, cmd)], tone: 'dim' }, { type: 'go', href: ctx.pages[cmd] });
  }
  // `cat` followed by a file is still cat.
  if (ctx.cat && (cmd === ctx.cat || (cmd === 'cat' && args.length === 0))) return ok({ type: 'cat' });

  switch (cmd) {
    case 'help':
    case 'man':
    case '?':
      return help(ctx);
    case 'ls':
    case 'll':
    case 'dir':
      return ls(args, ctx);
    case 'cat':
    case 'less':
    case 'more':
      return cat(args, ctx);
    case 'open':
      return open(args, ctx);
    case 'lang':
      return lang(args, ctx);
    case 'clear':
    case 'cls':
      return ok({ type: 'clear' });
    case 'resume':
    case 'dossier':
    case 'cv':
      return open([ctx.files.find((f) => f.download)?.path ?? 'resume.pdf'], ctx);
    case 'reset':
    case 'all':
    case 'full':
      return ok({ type: 'reset' });
    case 'reboot':
    case 'replay':
    case 'intro':
      return ok({ type: 'reboot' });
    case 'exit':
    case 'logout':
      return ok({ type: 'lines', lines: [ctx.t.logout], tone: 'dim' }, { type: 'reboot' });
    case 'pwd':
      return ok({ type: 'lines', lines: [`/home/${ctx.user}`] });
    case 'echo':
      return ok({ type: 'lines', lines: [args.join(' ')] });
    case 'cd':
      return fail(`cd: ${ctx.t.cd}`);
    // Easter eggs.
    case 'sudo':
    case 'su':
      return fail(fill(ctx.t.sudo, ctx.user));
    case 'rm':
      return { actions: [{ type: 'glitch' }, { type: 'lines', lines: [`rm: ${ctx.t.rm}`], tone: 'error' }], status: 1 };
    case 'hello':
    case 'fsociety':
      return ok({ type: 'title', text: ctx.t.hello });
  }

  const guess = nearest(cmd, ctx.commands ?? COMMANDS);
  const lines = [`sh: ${fill(ctx.t.notFound, name)}`];
  if (guess) lines.push(fill(ctx.t.didYouMean, guess));
  return { actions: [{ type: 'lines', lines, tone: 'error' }], status: 127 };
}

function candidates(tokens: string[], ctx: ShellContext): string[] {
  if (tokens.length === 1) return [...(ctx.commands ?? COMMANDS)];
  const paths = ctx.files.map((f) => f.path);
  switch (tokens[0].toLowerCase()) {
    case 'ls':
      return DIRS.filter((d) => paths.some((p) => p.startsWith(`${d}/`))).map((d) => `${d}/`);
    case 'cat':
      return ctx.files.filter((f) => f.ref).map((f) => f.path);
    case 'open':
      // Bare names: `open my-api` reads better than `open projects/my-api`.
      return paths.map((p) => (p.startsWith('writing/') ? stem(basename(p)) : basename(p)));
    case 'lang':
      return ['en', 'es'];
    case 'history':
      return ['--work'];
    default:
      return [];
  }
}

function commonPrefix(words: string[]): string {
  let prefix = words[0] ?? '';
  for (const w of words) while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}

/** Tab completion: extends the last word to the longest unambiguous prefix and returns the matches. */
export function complete(input: string, ctx: ShellContext): { value: string; options: string[] } {
  const tokens = input.replace(/^\s+/, '').split(/\s+/);
  const last = tokens[tokens.length - 1];
  const options = candidates(tokens, ctx).filter((c) => c.toLowerCase().startsWith(last.toLowerCase()));
  if (options.length === 0) return { value: input, options };
  const head = tokens.slice(0, -1);
  const done = options.length === 1;
  const word = done ? options[0] + (options[0].endsWith('/') ? '' : ' ') : commonPrefix(options);
  return { value: [...head, word.length >= last.length ? word : last].join(' '), options };
}

/** Inline ghost suggestion: the rest of the first completion, or '' when there is nothing to add. */
export function suggest(input: string, ctx: ShellContext): string {
  if (!input.trim()) return '';
  const tokens = input.replace(/^\s+/, '').split(/\s+/);
  const last = tokens[tokens.length - 1];
  if (!last) return '';
  const hit = candidates(tokens, ctx).find((c) => c.toLowerCase().startsWith(last.toLowerCase()));
  return hit ? hit.slice(last.length) : '';
}
