import { defineConfig } from 'vite';

export default defineConfig({
  root: 'examples/03_universal_ur5e_teleop',
  base: '/mujoco-garage/examples/03_universal_ur5e_teleop/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: '../../dist/examples/03_universal_ur5e_teleop',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // mujoco-js ships with an embedded WASM binary — exclude from pre-bundling
    exclude: ['mujoco-js'],
  },
});
