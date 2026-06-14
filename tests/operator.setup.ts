import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = 'tests/.auth/operator-user.json';

setup('authenticate as operator test user', async ({ page }) => {
  const email    = process.env.TEST_OPERATOR_EMAIL    ?? 'mercy.affulbaloyi@gmail.com';
  const password = process.env.TEST_OPERATOR_PASSWORD ?? 'TestOperator@2026!';

  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
