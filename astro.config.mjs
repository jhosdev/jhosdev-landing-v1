import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://jhosdev-landing.vercel.app',
  output: 'static',
  redirects: {
    '/about': '/',
    '/projects': '/#projects',
    '/articles': '/#writing',
  },
});
