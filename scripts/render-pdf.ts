#!/usr/bin/env bun
// Renders public/resume.pdf from src/data/resume.en.json via Typst.
// Resolves a `typst` binary from PATH, else downloads the official release
// binary (Linux x86_64 only) into node_modules/.cache/typst/.
// Run via `bun scripts/render-pdf.ts` — wired as the `prebuild` script.

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { formatDate } from './date-format';
import type { Resume, ResumeEducation } from '../src/data/resume';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'typst');

const resume: Resume = JSON.parse(readFileSync(join(ROOT, 'src/data/resume.en.json'), 'utf-8'));

function workPeriod(job: { startDate: string; endDate?: string }): string {
  return `${formatDate(job.startDate)} – ${job.endDate ? formatDate(job.endDate) : 'Present'}`;
}

function eduPeriod(edu: ResumeEducation): string {
  const start = formatDate(edu.startDate);
  const end = edu.endDate ? formatDate(edu.endDate) : 'Present';
  const status = edu.status ? ` (${edu.status})` : '';
  return `${start} – ${end}${status}`;
}

// Strips scheme + trailing slash for display text, e.g. "https://github.com/x/" -> "github.com/x".
// The full URL is kept separately and used as the #link() target, so it's still clickable.
function stripUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

// Typst string literals only need \ and " escaped; interpolating a string
// value (#var) in markup inserts it as literal text, so no markup-char
// escaping (*, _, #, ...) is needed.
function typstStr(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ')}"`;
}

function typstOpt(s: string | undefined): string {
  return s ? typstStr(s) : 'none';
}

function typstArr(items: string[]): string {
  if (items.length === 0) return '()';
  // Typst parses "(x)" as the bare value x, not a 1-item array — needs a trailing comma.
  if (items.length === 1) return `(${typstStr(items[0])},)`;
  return `(${items.map(typstStr).join(', ')})`;
}

// Wraps a list of already-formatted Typst dict entries into a Typst array —
// () for an empty list, else a trailing-comma'd, newline-joined block (Typst
// needs the trailing comma so a single-entry list stays an array, not the
// bare value it parses "(x)" as without one).
function typstDictArray(entries: string[]): string {
  return entries.length === 0 ? '()' : `(\n${entries.join(',\n')},\n)`;
}

const { basics, work, education, awards, skills } = resume;

// Contact line, in order: location city, email, every profile, then the website —
// each entry keeps its full URL as the #link() target but shows stripped display text.
const contactEntries: { text: string; link?: string }[] = [];
if (basics.location?.city) contactEntries.push({ text: basics.location.city });
contactEntries.push({ text: basics.email, link: `mailto:${basics.email}` });
for (const p of basics.profiles) contactEntries.push({ text: stripUrl(p.url), link: p.url });
if (basics.url) contactEntries.push({ text: stripUrl(basics.url), link: basics.url });

const contactItemsTypst = `(${contactEntries
  .map((i) => `(text: ${typstStr(i.text)}, link: ${typstOpt(i.link)})`)
  .join(', ')})`;

// ponytail: character-count heuristic to pick a contact-line size that avoids wrapping,
// not real text measurement. Swap for a Typst `context` layout query if it ever misjudges.
const contactPlainLength = contactEntries.map((i) => i.text).join(' · ').length;
const contactSize = contactPlainLength > 90 ? '9pt' : '9.5pt';

const workTypst = typstDictArray(
  work.map(
    (job) => `  (
    position: ${typstStr(job.position)},
    company: ${typstStr(job.name)},
    company_url: ${typstOpt(job.url)},
    location: ${typstOpt(job.location)},
    period: ${typstStr(workPeriod(job))},
    highlights: ${typstArr(job.highlights)},
  )`
  )
);

const skillsTypst = typstDictArray(
  skills.map((s) => `  (name: ${typstStr(s.name)}, keywords: ${typstArr(s.keywords)})`)
);

const educationTypst = typstDictArray(
  education.map(
    (e) => `  (
    institution: ${typstStr(e.institution)},
    degree: ${typstStr(`${e.studyType}, ${e.area}`)},
    period: ${typstStr(eduPeriod(e))},
  )`
  )
);

const awardsTypst = typstDictArray(
  awards.map(
    (a) => `  (
    title: ${typstStr(a.title)},
    awarder: ${typstStr(a.awarder)},
    date: ${typstStr(a.date)},
    summary: ${typstOpt(a.summary)},
  )`
  )
);

const projectsTypst = typstDictArray(
  (resume.projects ?? []).map(
    (p) => `  (name: ${typstStr(p.name)}, description: ${typstStr(p.description)}, keywords: ${typstArr(p.keywords ?? [])})`
  )
);

// `languages` (spoken) is in the JSON but not in the shared Resume type.
const spokenLanguages = (resume as unknown as { languages?: { language: string; fluency: string }[] }).languages ?? [];
const languagesTypst = typstDictArray(
  spokenLanguages.map((l) => `  (language: ${typstStr(l.language)}, fluency: ${typstStr(l.fluency)})`)
);

// Harvard Office of Career Services bullet-resume layout: serif, black only, centered
// name + contact line, bold headings with a full-width rule, org/location and
// italic title/dates rows, tight bullets.
const typstSource = `// Generated by scripts/render-pdf.ts from src/data/resume.en.json — do not edit by hand.
#let name = ${typstStr(basics.name)}
#let contact_items = ${contactItemsTypst}
#let summary = ${typstStr(basics.summary)}
#let work = ${workTypst}
#let projects = ${projectsTypst}
#let skills = ${skillsTypst}
#let education = ${educationTypst}
#let awards = ${awardsTypst}
#let spoken = ${languagesTypst}

#set document(title: name + " — " + ${typstStr(basics.label)}, author: name)
#set page(margin: (x: 0.7in, y: 0.6in))
#set text(font: "Libertinus Serif", size: 10.5pt, fill: black)
#set par(justify: false, leading: 0.5em, spacing: 0.5em)
#set list(indent: 0.15in, body-indent: 0.5em, spacing: 0.4em, marker: [•])

#let section(title) = block(sticky: true, above: 1.1em, below: 0.4em)[
  #text(weight: "bold")[#title]
  #v(-0.15em)
  #line(length: 100%, stroke: 0.5pt)
]

#let row(left, right) = grid(columns: (1fr, auto), column-gutter: 1em, left, right)

#let entry(org, loc, title, dates, items) = block(above: 0.9em, below: 0pt)[
  #block(sticky: true, below: 0.3em)[
    #row(text(weight: "bold")[#org], loc)
    #row(emph(title), emph(dates))
  ]
  #for h in items [
    - #h
  ]
]

#align(center)[
  #text(size: 18pt, weight: "bold")[#name] \\
  #v(2pt)
  #text(size: ${contactSize})[
    #for (i, item) in contact_items.enumerate() [
      #if item.link != none [#link(item.link)[#item.text]] else [#item.text]#if i < contact_items.len() - 1 [ #h(2pt)|#h(2pt) ]
    ]
  ]
]

#if summary != "" [
  #v(0.6em)
  #summary
]

#if work.len() > 0 [
  #section("Experience")
  #for job in work [
    #entry(
      if job.company_url != none [#link(job.company_url)[#job.company]] else [#job.company],
      if job.location != none [#job.location] else [],
      job.position, job.period, job.highlights,
    )
  ]
]

#if projects.len() > 0 [
  #section("Projects")
  #for p in projects [
    - #text(weight: "bold")[#p.name]. #p.description#if p.keywords.len() > 0 [ #emph[(#p.keywords.join(", "))]]
  ]
]

#if education.len() > 0 [
  #section("Education")
  #for e in education [
    #block(above: 0.6em, below: 0pt, sticky: true)[
      #row(text(weight: "bold")[#e.institution], [])
      #row(emph(e.degree), emph(e.period))
    ]
  ]
]

#if awards.len() > 0 [
  #section("Awards")
  #for a in awards [
    #block(above: 0.6em, below: 0pt)[
      #row(text(weight: "bold")[#a.title], emph(a.date))
      #a.awarder#if a.summary != none [ — #a.summary]
    ]
  ]
]

#if skills.len() > 0 or spoken.len() > 0 [
  #section("Skills")
  #for s in skills [
    #text(weight: "bold")[#s.name:] #s.keywords.join(", ") \\
  ]
  #if spoken.len() > 0 [
    #text(weight: "bold")[Spoken languages:] #spoken.map(l => l.language + " (" + l.fluency + ")").join(", ")
  ]
]
`;

function resolveTypstBinary(): string {
  try {
    execFileSync('typst', ['--version'], { stdio: 'ignore' });
    return 'typst';
  } catch {
    // not on PATH — fall through to cache/download below
  }

  const cached = join(CACHE_DIR, 'typst');
  if (existsSync(cached)) return cached;

  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(
      `No 'typst' binary on PATH, and no prebuilt download configured for ${process.platform}/${process.arch} ` +
        `(only Linux x86_64 auto-downloads). Install typst manually — https://github.com/typst/typst/releases — and re-run.`
    );
  }

  console.log('typst not found on PATH — downloading release binary for x86_64-unknown-linux-musl...');
  mkdirSync(CACHE_DIR, { recursive: true });

  const target = 'x86_64-unknown-linux-musl';
  const assetName = `typst-${target}.tar.xz`;
  let downloadUrl: string;
  try {
    const release = execFileSync('curl', [
      '-sL',
      '--max-time',
      '15',
      'https://api.github.com/repos/typst/typst/releases/latest',
    ]).toString();
    const match = new RegExp(`"browser_download_url":\\s*"([^"]*${assetName})"`).exec(release);
    if (!match) throw new Error(`asset ${assetName} not found in latest release response`);
    downloadUrl = match[1];
  } catch (err) {
    throw new Error(
      `Could not resolve typst download URL from GitHub releases (network issue or API change): ${(err as Error).message}`
    );
  }

  const tarPath = join(CACHE_DIR, assetName);
  try {
    execFileSync('curl', ['-sL', '--max-time', '120', '-o', tarPath, downloadUrl]);
    execFileSync('tar', ['-xJf', tarPath, '-C', CACHE_DIR]);
  } catch (err) {
    throw new Error(`Failed to download/extract typst binary: ${(err as Error).message}`);
  }

  const extractedDir = join(CACHE_DIR, `typst-${target}`);
  const extracted = join(extractedDir, 'typst');
  if (!existsSync(extracted)) {
    throw new Error(`Expected typst binary at ${extracted} after extraction, but it's missing.`);
  }
  cpSync(extracted, cached);
  chmodSync(cached, 0o755);
  rmSync(tarPath, { force: true });
  rmSync(extractedDir, { recursive: true, force: true });
  return cached;
}

const typstBin = resolveTypstBinary();

mkdirSync(CACHE_DIR, { recursive: true });
const srcPath = join(CACHE_DIR, 'resume.typ');
writeFileSync(srcPath, typstSource, 'utf-8');

const outPath = join(ROOT, 'public', 'resume.pdf');
execFileSync(typstBin, ['compile', srcPath, outPath], { stdio: 'inherit' });
console.log(`Wrote ${outPath}`);
