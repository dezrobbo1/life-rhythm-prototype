// @ts-expect-error -- Vite runs this config in Node; the app intentionally omits Node typings.
import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const maxWorkers = Math.max(1, Math.min(4, availableParallelism()));

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Bound peak fork/jsdom contention while retaining parallel test-file execution.
    maxWorkers,
  },
});

