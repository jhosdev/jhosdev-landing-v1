import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

/**
 * Page scripts import shared chunks (draw, motion, commands, and the intro's scene on demand).
 * Astro emits no hint for them, so the browser finds each level one round trip after the
 * previous one. This adds `<link rel="modulepreload">` for everything a page's scripts import.
 * ponytail: reads imports with a regex over the built chunks and preloads on-demand chunks too
 * (the home fetches the ~9 KB intro scene even when the intro will not play); switch to the
 * Vite manifest if chunks ever stop being plain relative imports.
 */
const modulepreload = {
  name: 'modulepreload',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const root = fileURLToPath(dir);
      const imports = (src, seen = new Set()) => {
        const code = readFileSync(join(root, src), 'utf8');
        for (const [, spec] of code.matchAll(/(?:from|import\()\s*["'`](\.\/[^"'`]+\.js)["'`]/g)) {
          const dep = posix.join(posix.dirname(src), spec);
          if (seen.has(dep)) continue;
          seen.add(dep);
          imports(dep, seen);
        }
        return seen;
      };
      for (const file of readdirSync(root, { recursive: true })) {
        if (!file.endsWith('.html')) continue;
        const html = readFileSync(join(root, file), 'utf8');
        const hrefs = new Set();
        for (const [, src] of html.matchAll(/<script type="module" src="([^"]+)"/g)) imports(src).forEach((href) => hrefs.add(href));
        if (!hrefs.size) continue;
        const links = [...hrefs].map((href) => `<link rel="modulepreload" href="${href}">`).join('');
        writeFileSync(join(root, file), html.replace('</head>', `${links}</head>`));
      }
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://jhosdev-landing.vercel.app',
  output: 'static',
  integrations: [modulepreload],
  redirects: {
    '/about': '/',
    '/projects': '/#projects',
    '/articles': '/#writing',
  },
});
