import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

// GitHub Pages serves static files. Reuse the existing game and HUD directly
// in a browser entry point, without the server used by the local preview.
export default defineConfig({
  base: '/edgefront-arena/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'dist-pages' },
});
