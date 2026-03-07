import { defineConfig } from 'vite';

export default defineConfig({
  // Root is relative to cwd (repo root) when run via `npm run dev1:demo`
  root: 'examples/02_universal_ur5e',
  base: '/mujoco-garage.github.io/examples/02_universal_ur5e/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: '../../dist/examples/02_universal_ur5e',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // mujoco-js ships with an embedded WASM binary — exclude from pre-bundling
    exclude: ['mujoco-js'],
  },
});
