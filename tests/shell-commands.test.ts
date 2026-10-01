import { describe, expect, it } from 'vitest';
import { complete, execute, findFile, suggest, type ShellContext } from '../src/components/shell/commands';
import { shellCopy } from '../src/components/shell/copy';

const ctx: ShellContext = {
  user: 'ada',
  host: 'prod',
  locale: 'en',
  files: [
    { path: 'about.txt', ref: 'whoami' },
    { path: 'stack.txt', ref: 'stack' },
    { path: 'resume.pdf', href: '/resume.pdf', external: true },
    { path: 'projects/ledger-api', ref: 'project:ledger-api' },
    { path: 'projects/ledger-ui', ref: 'project:ledger-ui' },
    { path: 'writing/event-loop.md', ref: 'post:event-loop.md', href: '/writing/event-loop/' },
    { path: 'links/github', href: 'https://github.com/ada', external: true },
  ],
  langHref: { en: '/lab/shell/', es: '/es/lab/shell/' },
  t: shellCopy.en.t,
};

const types = (input: string) => execute(input, ctx).actions.map((a) => a.type);

describe('shell commands', () => {
  it('prints sections by reference, never by copying content', () => {
    expect(execute('whoami', ctx).actions).toEqual([{ type: 'print', ref: 'whoami' }]);
    expect(execute('  cat   stack.txt ', ctx).actions).toEqual([{ type: 'print', ref: 'stack' }]);
    expect(execute('ls projects/', ctx).actions).toEqual([{ type: 'print', ref: 'projects' }]);
    expect(execute('history --work', ctx).actions).toEqual([{ type: 'print', ref: 'experience' }]);
  });

  it('lists home with a runnable command per entry', () => {
    const [menu] = execute('ls -la', ctx).actions;
    const items = menu.type === 'menu' ? menu.items : [];
    expect(items).toContainEqual({ label: 'stack.txt', run: 'cat stack.txt' });
    expect(items).toContainEqual({ label: 'resume.pdf', run: 'open resume.pdf' });
    expect(items).toContainEqual({ label: 'projects/', run: 'ls projects/' });
  });

  it('opens projects in place and navigates to posts and links', () => {
    expect(execute('open ledger-api', ctx).actions).toEqual([{ type: 'print', ref: 'project:ledger-api' }]);
    expect(execute('open event-loop', ctx).actions.at(-1)).toMatchObject({ type: 'go', href: '/writing/event-loop/' });
    expect(execute('open github', ctx).actions.at(-1)).toMatchObject({ type: 'go', external: true });
    expect(findFile('./projects/ledger-ui/', ctx.files)?.ref).toBe('project:ledger-ui');
  });

  it('fails like a shell', () => {
    const unknown = execute('hlep', ctx);
    expect(unknown.status).toBe(127);
    expect(unknown.actions[0]).toEqual({
      type: 'lines',
      tone: 'error',
      lines: ['sh: hlep: command not found', 'did you mean `help`?'],
    });
    expect(execute('cat nope.txt', ctx)).toMatchObject({ status: 1, actions: [{ lines: ['cat: nope.txt: No such file or directory'] }] });
    expect(execute('cat projects', ctx).actions[0]).toMatchObject({ lines: ['cat: projects: Is a directory'] });
    expect(execute('cat', ctx).status).toBe(2);
    expect(execute('', ctx)).toEqual({ actions: [], status: 0 });
  });

  it('switches language, clears, and keeps history', () => {
    expect(execute('lang es', ctx).actions.at(-1)).toEqual({ type: 'go', href: '/es/lab/shell/' });
    expect(types('lang en')).toEqual(['lines']);
    expect(execute('lang fr', ctx).status).toBe(2);
    expect(types('clear')).toEqual(['clear']);
    expect(execute('history', ctx, ['ls', 'history']).actions[0]).toMatchObject({ lines: ['   1  ls', '   2  history'] });
  });

  it('has its easter eggs', () => {
    expect(execute('sudo rm -rf /', ctx).actions[0]).toMatchObject({
      tone: 'error',
      lines: [expect.stringContaining('ada is not in the sudoers file')],
    });
    expect(types('rm -rf /')).toEqual(['glitch', 'lines']);
    expect(types('fsociety')).toEqual(['title']);
  });

  it('completes commands and arguments', () => {
    expect(complete('he', ctx)).toEqual({ value: 'help ', options: ['help'] });
    expect(complete('cat pro', ctx).value).toBe('cat projects/ledger-');
    expect(complete('cat pro', ctx).options).toHaveLength(2);
    expect(complete('ls w', ctx).value).toBe('ls writing/');
    expect(complete('open ev', ctx).value).toBe('open event-loop ');
    expect(complete('zzz', ctx)).toEqual({ value: 'zzz', options: [] });
    expect(suggest('pro', ctx)).toBe('jects');
    expect(suggest('lang ', ctx)).toBe('');
    expect(suggest('', ctx)).toBe('');
  });
});
