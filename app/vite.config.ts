import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Bound peak fork/jsdom contention while retaining parallel test-file execution.
    maxWorkers: 4,
  },
});

