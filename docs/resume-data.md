# Resume data

Where the profile data lives, how to publish a change, and how to run the site without the real data.

## Where it lives

- Master copy: a Cloudflare Worker that serves static assets from `~/personal/resume-data` (not in git):
  `wrangler.jsonc` plus `public/resume.en.json` and `public/resume.es.json`. The live URLs are the values of
  `RESUME_URL_EN` and `RESUME_URL_ES` (set in the Vercel project and, optionally, in your shell). Keep them out of the repo.
- Site fallback: `src/data/resume.{en,es}.json` — gitignored, not committed. At build time `scripts/fetch-resume.ts`
  (the `prebuild` script) downloads the live files when `RESUME_URL_*` is set and overwrites the local copies; unset,
  it uses whatever local copy is already there, and if that's missing too it copies `resume.sample.json` into place.
- Shape: JSON Resume v1.0.0 plus three custom parts the site will read:
  - `projects[]` with `status`/`statusLabel` (`production` | `active` | `archived`, plus a localized display label) for the project cards — a falsy/missing `status` means the card is skipped;
  - `meta.site` (`headlineLine2`, `stats`, `principles`, `contactHeading`, `stack`) for the curated page copy — `stack` is the per-category wanted-keyword lists (`streaming`/`data`/`infra`) that `content.ts`'s `pick()` checks against `skills[]`;
  - `meta.linkedin` (`headline`, `about`, `topSkills`, `skills`) for the LinkedIn profile, not rendered.
  Every field appears in `src/data/resume.sample.json`. Skill group names must stay `AI Engineering`, `Languages`,
  `Backend & Data`, `Cloud & Infra` (EN) / `Ingeniería de IA`, `Lenguajes`, `Backend y Datos`, `Nube e Infraestructura`
  (ES) while `src/data/content.ts` looks them up by name — the sample carries both sets since one file backs both
  locales when the real ones are missing.

## Publish a change

1. Edit `~/personal/resume-data/public/resume.en.json`. Bump `meta.version` and `meta.lastModified`.
2. Copy it into the site as the fallback: `cp ~/personal/resume-data/public/resume.en.json src/data/resume.en.json`.
3. Check locally: `bun run test && env -u RESUME_URL_EN -u RESUME_URL_ES bun run build`.
   Unset the URLs, or `prebuild` replaces your edit with the old live copy.
4. Upload: `cd ~/personal/resume-data && wrangler deploy`. First time on a machine: `wrangler login`.
5. Verify: `curl -s "$RESUME_URL_EN" | jq .meta.version`.
6. Trigger a site redeploy (Vercel dashboard or the deploy hook) so the build fetches the new data.

## New machine

The data folder is not in git. Recreate it from the live copy:

```bash
mkdir -p ~/personal/resume-data/public && cd ~/personal/resume-data
cat > wrangler.jsonc <<'JSON'
{
  "name": "resume-data",
  "compatibility_date": "2026-09-01",
  "assets": { "directory": "./public" }
}
JSON
curl -s "$RESUME_URL_EN" -o public/resume.en.json
curl -s "$RESUME_URL_ES" -o public/resume.es.json
wrangler login
```

## Local dev without the real data

Just delete `src/data/resume.{en,es}.json` (or start from a fresh clone — they're gitignored) and run `bun run build`
or `bun run dev` with `RESUME_URL_*` unset: `scripts/fetch-resume.ts` copies `resume.sample.json` into place for
whichever locale is missing. The sample carries placeholder content in the full shape, so the site, tests and the
PDF render from it.

## Next

- GitHub Action: move `~/personal/resume-data` into a private repo; on push to `main` run `wrangler deploy`
  (with a `CLOUDFLARE_API_TOKEN` secret) and then POST the site's deploy hook.
