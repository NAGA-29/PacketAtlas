import { defineConfig, devices } from '@playwright/test';

// pnpm build のあと、書き出された out/ を配信して確かめる
const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  // CI では test.only の消し忘れを失敗にし、不安定な失敗は1回だけ再試行する
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: { command: 'pnpm exec http-server out -p 4173 -s', port: 4173, reuseExistingServer: !CI },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1320, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 375, height: 812 } } },
  ],
});
