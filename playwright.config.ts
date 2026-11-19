import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4307',
    viewport: { width: 1440, height: 1100 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start -- --port 4307 --hmr=false',
    url: 'http://127.0.0.1:4307',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE === 'true',
    timeout: 60000,
  },
});
