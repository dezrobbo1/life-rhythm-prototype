import { defineConfig } from '@playwright/test';
import base from './playwright.c1.config';
export default defineConfig({
  ...base,
  testMatch: 'admission.spec.ts',
  outputDir: '/tmp/life-rhythm-c1-admission-browser',
  webServer: {
    command: 'npx --no-install tsx scripts/admission-browser-server.ts',
    url: 'http://127.0.0.1:5192',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '/tmp/life-rhythm-c1-admission-results.json' }]],
});
