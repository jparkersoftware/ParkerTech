import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Your live site URL. Used for canonical links and social-share metadata.
  site: 'https://parkertech.co.uk',
  // Auto-generates sitemap-index.xml / sitemap-0.xml at build time.
  integrations: [sitemap()],
});
