import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: false,
    css: false,
    // This sandbox hangs indefinitely spawning vitest's default multi-worker thread/fork pool
    // (observed: 10+ forked node processes, none ever reporting back). Single-process execution
    // is slower but actually completes; safe to revert if run in a normal CI/dev environment.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Node-script-style tests (src/services/__tests__/*.test.js, run via scripts/run_phase*.js)
    // are plain async functions, not vitest test files — exclude them so `npm test` only picks
    // up real vitest specs (*.spec.jsx / *.test.jsx under src/**/__tests__ using vitest's API).
    include: ['src/**/*.spec.{js,jsx}'],
  },
})
