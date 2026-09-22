#!/usr/bin/env bun
// Build-time resume fetch: for each RESUME_URL_EN / RESUME_URL_ES that is set,
// fetches the URL, validates it looks like a JSON Resume document, and
// overwrites the matching src/data/resume.{en,es}.json. Unset -> the existing
// local file (gitignored) is left as-is; if it's missing too, resume.sample.json
// is copied into place so the repo never needs real personal data to build.
// Set but failing/invalid -> exits non-zero with a clear message.
// Storage-agnostic on purpose: any URL that returns the right JSON shape works.
// Run via `bun scripts/fetch-resume.ts` (wired into the `prebuild` script).

import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  { env: 'RESUME_URL_EN', file: 'resume.en.json' },
  { env: 'RESUME_URL_ES', file: 'resume.es.json' },
] as const;

function isValidResume(data: unknown): data is { basics: { name: string }; work: unknown[] } {
  if (typeof data !== 'object' || data === null) return false;
  const basics = (data as Record<string, unknown>).basics;
  const work = (data as Record<string, unknown>).work;
  return (
    typeof basics === 'object' &&
    basics !== null &&
    typeof (basics as Record<string, unknown>).name === 'string' &&
    Array.isArray(work) &&
    work.length > 0
  );
}

async function fetchAndWrite(env: string, file: string): Promise<void> {
  const url = process.env[env];
  const target = join(ROOT, 'src/data', file);

  if (!url) {
    if (!existsSync(target)) {
      console.log(`${env} unset and src/data/${file} missing — copying resume.sample.json as a placeholder`);
      copyFileSync(join(ROOT, 'src/data/resume.sample.json'), target);
    }
    return;
  }

  console.log(`${env} set — fetching ${file} from ${url}`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`${env}: fetch failed for ${url}: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new Error(`${env}: fetch for ${url} returned HTTP ${res.status}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`${env}: response from ${url} is not valid JSON: ${(err as Error).message}`);
  }

  if (!isValidResume(data)) {
    throw new Error(`${env}: JSON from ${url} is missing basics.name (string) or a non-empty work array`);
  }

  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  console.log(`Wrote src/data/${file}`);
}

try {
  await Promise.all(TARGETS.map(({ env, file }) => fetchAndWrite(env, file)));
} catch (err) {
  console.error(`fetch-resume: ${(err as Error).message}`);
  process.exit(1);
}
