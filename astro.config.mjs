import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Your live site URL. Used for canonical links and social-share metadata.
  site: 'https://parkertech.co.uk',
  // Auto-generates sitemap-index.xml / sitemap-0.xml at build time.
  // Filter excludes the private Command Centre app from public indexes.
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/command-centre'),
    }),
    react(),
  ],
  // Tailwind CSS v4 — loaded only by pages that import its stylesheet
  // (currently just the Command Centre, so it never affects the marketing site).
  vite: {
    plugins: [tailwindcss()],
  },
});
