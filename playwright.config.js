import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8000',
    locale: 'ar-EG',
    serviceWorkers: 'allow'
  },
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://localhost:8000/index.html',
    reuseExistingServer: !process.env.CI
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }]
});
