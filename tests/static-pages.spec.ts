import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// No auth required — all pages are publicly accessible

const SNAP_DIR = path.join('tests', 'snapshots', 'static-pages');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

test.describe('How It Works page', () => {
  test('renders the customer and operator journeys', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('If you need to move freight')).toBeVisible();
    await expect(page.getByText('If you are a freight operator')).toBeVisible();
    await snap(page, '01-how-it-works');
  });
});

test.describe('Static / policy pages', () => {
  test('Privacy Policy renders', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/privacy/i).first()).toBeVisible();
    await snap(page, '02-privacy');
  });

  test('Terms and Conditions renders', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/terms/i).first()).toBeVisible();
    await snap(page, '03-terms');
  });

  test('Cancellation & Refund Policy renders', async ({ page }) => {
    await page.goto('/cancellation');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await snap(page, '04-cancellation');
  });

  test('Pricing page says customers pay nothing', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/customers pay nothing/i).first()).toBeVisible();
    await snap(page, '05-pricing');
  });
});

test.describe('Home page - operator invitation', () => {
  test('home invites operators to the For operators page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main a[href="/for-operators"]')).toBeVisible({ timeout: 10_000 });
    await snap(page, '06-home-operator-invitation');
  });
});
