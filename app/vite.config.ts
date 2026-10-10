import { availableParallelism } from 'node:os';
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

const maxWorkers = Math.max(1, Math.min(4, availableParallelism()));

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // Explicit loopback API bridge only; hosted requests never proxy to a fixture.
    proxy: process.env.LIFE_RHYTHM_LOCAL_API === 'true' ? { '/api': {target:'http://127.0.0.1:8787',changeOrigin:false} } : undefined,
  },
  build: { outDir:'dist' },
  test: {
    // Bound peak fork/jsdom contention while retaining parallel test-file execution.
    maxWorkers,
    exclude:[...configDefaults.exclude,'evidence/**'],
  },
});

