import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'evidence/gate8a7c1',
  testMatch: 'replay.spec.ts',
  workers: 1,
  use: {
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.LIFE_RHYTHM_CHROMIUM ?? '/usr/bin/chromium' },
  },
  outputDir: '/tmp/life-rhythm-c1-browser',
  reporter: [['list'], ['json', { outputFile: '/tmp/life-rhythm-c1-browser-results.json' }]],
  webServer: {
    command: 'npx --no-install tsx scripts/browser-server.ts',
    url: 'http://127.0.0.1:5179',
    reuseExistingServer: false,
  },
});
