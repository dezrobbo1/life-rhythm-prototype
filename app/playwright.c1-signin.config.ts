import { defineConfig } from '@playwright/test';
import base from './playwright.c1.config';

export default defineConfig({
  ...base,
  testMatch: 'signin-layout.spec.ts',
  outputDir: '/tmp/life-rhythm-c1-signin-browser',
  reporter: [['list'], ['json', { outputFile: '/tmp/life-rhythm-c1-signin-results.json' }]],
  // Use the real SDK; all provider responses in this replay are intercepted synthetic errors.
  webServer: {
    command: 'npx --no-install vite --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
  },
});
