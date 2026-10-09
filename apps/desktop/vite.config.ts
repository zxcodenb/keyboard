import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'frontend',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true, fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../../profiles', import.meta.url))] }, watch: { ignored: ['**/.mygo/**', '**/build/**'] } },
});
