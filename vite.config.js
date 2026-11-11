import { cp } from 'node:fs/promises';
import { defineConfig } from 'vite';

// The article snapshots are read at runtime from `data/` beside index.html
// (see src/sources.js), so the build copies them next to the bundle.
export default defineConfig({
  // The engine is plain ES modules with many small files; serve them as source.
  optimizeDeps: { exclude: ['madness-engine'] },
  plugins: [{
    name: 'copy-article-snapshots',
    apply: 'build',
    async closeBundle() {
      await cp('data', 'dist/data', { recursive: true });
    },
  }],
});
