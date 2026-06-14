import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Load .env.local — Playwright doesn't inherit Next.js env injection
try {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([^#\s][^=]*)=(.*)/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* .env.local not found — skip */ }

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'tests/playwright-report' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off',
  },

  projects: [
    { name: 'setup-agent',    testMatch: /auth\.setup\.ts/ },
    { name: 'setup-operator', testMatch: /operator\.setup\.ts/ },
    { name: 'setup-customer', testMatch: /customer\.setup\.ts/ },
    { name: 'setup-admin',    testMatch: /admin\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup-agent', 'setup-operator', 'setup-customer', 'setup-admin'],
      testIgnore: /\.setup\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
