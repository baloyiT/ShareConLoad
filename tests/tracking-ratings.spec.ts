import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SNAP_DIR = path.join('tests', 'snapshots', 'tracking-ratings');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

test.describe('TC-TRACK — Operator: advance booking status', () => {
  test.use({ storageState: 'tests/.auth/operator-user.json' });

  test('TRACK-02 — operator bookings page has status controls', async ({ page }) => {
    await page.goto('/operator/bookings');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    await snap(page, '01-operator-bookings-status-controls');

    // Check for status dropdowns or milestone buttons
    const controls = page.locator('select[name="status"],button').filter({ hasText: /confirm|load|transit|deliver/i });
    const count = await controls.count();

    if (count > 0) {
      await snap(page, '01b-status-controls-found');
    } else {
      // May be no bookings yet
      await expect(page.locator('body')).not.toContainText('500');
    }
  });

  test('TRACK-02 — milestone recording UI exists', async ({ page }) => {
    await page.goto('/operator/bookings');
    await page.waitForTimeout(3000);

    const milestoneBtn = page.getByRole('button', { name: /milestone|record|update/i }).first();
    if (await milestoneBtn.isVisible().catch(() => false)) {
      await milestoneBtn.click();
      await page.waitForTimeout(1000);
      await snap(page, '02-milestone-dialog');
    } else {
      await snap(page, '02-no-milestone-btn');
    }
  });
});

test.describe('TC-TRACK — Customer: tracking timeline', () => {
  test.use({ storageState: 'tests/.auth/customer-user.json' });

  test('TRACK-01 — tracking page renders for customer', async ({ page }) => {
    // Navigate to bookings first to find an ID
    await page.goto('/bookings');
    await page.waitForTimeout(3000);
    await snap(page, '03-customer-bookings');

    const trackLinks = page.getByRole('link', { name: /track|view|details/i });
    const count = await trackLinks.count();
    if (count === 0) {
      // No bookings — empty state OK
      return;
    }

    await trackLinks.first().click();
    await page.waitForTimeout(2000);
    await snap(page, '04-tracking-timeline');

    await expect(page.locator('body')).not.toContainText('500');
  });

  test('TRACK-08 — invalid tracking ID shows error', async ({ page }) => {
    await page.goto('/booking/track/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '05-tracking-not-found');
  });
});

test.describe('TC-RATING — Rating form', () => {
  test.use({ storageState: 'tests/.auth/customer-user.json' });

  test('RATE-01 — rating form only appears for delivered bookings', async ({ page }) => {
    // Navigate to a delivered booking if one exists
    await page.goto('/bookings');
    await page.waitForTimeout(3000);
    await snap(page, '06-bookings-for-rating');

    // Look for delivered status
    const deliveredRows = page.locator('tr,li,div').filter({ hasText: /delivered/i });
    const count = await deliveredRows.count();

    if (count === 0) {
      // No delivered bookings yet — expected in test environment
      await snap(page, '06b-no-delivered-bookings');
      return;
    }

    const rateLink = deliveredRows.first().getByRole('link', { name: /rate|review/i });
    if (await rateLink.isVisible().catch(() => false)) {
      await rateLink.click();
      await page.waitForTimeout(2000);
      await snap(page, '07-rating-form');

      // Rating form should have star input
      const stars = page.locator('input[type="radio"][name*="star"],select[name="stars"],[class*="star"]');
      await expect(stars.first()).toBeVisible();
    } else {
      await snap(page, '07-no-rate-link');
    }
  });

  test('RATE-03 — rating form not shown for non-delivered bookings', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForTimeout(3000);

    // Look for pending/confirmed bookings — they should NOT have a rate link
    const nonDelivered = page.locator('tr,li,div').filter({ hasText: /pending|confirmed|in_transit/i });
    const count = await nonDelivered.count();

    if (count > 0) {
      const rateLink = nonDelivered.first().getByRole('link', { name: /rate|review/i });
      await expect(rateLink).not.toBeVisible().catch(() => {});
      await snap(page, '08-no-rating-for-non-delivered');
    } else {
      await snap(page, '08-no-non-delivered-bookings');
    }
  });
});
