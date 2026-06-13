import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = 'tests/.auth/agent-user.json';

setup('authenticate as agent test user', async ({ page }) => {
  const email    = process.env.TEST_AGENT_EMAIL    ?? 'justice_baloyi@yahoo.com';
  const password = process.env.TEST_AGENT_PASSWORD ?? 'TestAgent@2026!';

  await page.goto('/auth/login');
  await expect(page.locator('h1')).toContainText('Welcome back');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 });

  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
