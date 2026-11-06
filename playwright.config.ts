import { defineConfig, devices } from '@playwright/test';

// pnpm build のあと、書き出された out/ を配信して確かめる
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: { command: 'npx http-server out -p 4173 -s', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1320, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 375, height: 812 } } },
  ],
});
