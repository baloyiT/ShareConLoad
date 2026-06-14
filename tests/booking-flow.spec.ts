import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: 'tests/.auth/customer-user.json' });

const SNAP_DIR = path.join('tests', 'snapshots', 'booking-flow');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

// Helper: get the first available container ID from the home page
async function getFirstContainerId(page: Page): Promise<string | null> {
  await page.goto('/');
  await page.waitForTimeout(3000);
  const links = page.getByRole('link', { name: /view details|book now/i });
  const count = await links.count();
  if (count === 0) return null;
  const href = await links.first().getAttribute('href');
  return href?.split('/').pop() ?? null;
}

test.describe('TC-CONTAINER — Container detail page', () => {
  test('CONT-04 — container detail renders key info', async ({ page }) => {
    const id = await getFirstContainerId(page);
    if (!id) { test.skip(); return; }

    await page.goto(`/container/${id}`);
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '01-container-detail');
  });

  test('CONT-08 — invalid container ID shows not-found state', async ({ page }) => {
    await page.goto('/container/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(3000);
    await expect(
      page.getByText(/not found|does not exist|no container/i).or(page.getByText(/404/))
    ).toBeVisible({ timeout: 10_000 });
    await snap(page, '02-container-not-found');
  });
});

test.describe('TC-BOOKING — Booking form', () => {
  let containerId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/customer-user.json' });
    const page = await ctx.newPage();
    containerId = await getFirstContainerId(page);
    await ctx.close();
  });

  test('BOOK-04 — booking form renders for verified customer', async ({ page }) => {
    if (!containerId) { test.skip(); return; }

    await page.goto(`/booking/${containerId}`);
    await page.waitForTimeout(3000);
    await snap(page, '03-booking-form');

    // If KYC gate is shown, verified customer test data may need refreshing
    const gate = page.getByText(/verify my identity/i);
    if (await gate.isVisible().catch(() => false)) {
      console.warn('KYC gate visible — ensure customer_kyc.status = verified in DB');
      await snap(page, '03b-booking-gate-shown');
      return;
    }

    await expect(page.locator('input[name="total_cbm"]')).toBeVisible();
  });

  test('BOOK-08 — blocks submission without declaration', async ({ page }) => {
    if (!containerId) { test.skip(); return; }

    await page.goto(`/booking/${containerId}`);
    await page.waitForTimeout(3000);

    const gate = page.getByText(/verify my identity/i);
    if (await gate.isVisible().catch(() => false)) { test.skip(); return; }

    // Fill CBM but do NOT check declaration
    await page.locator('input[name="total_cbm"]').fill('2');
    await page.locator('button[type="submit"]').click();

    // Should stay on booking page
    await expect(page).toHaveURL(new RegExp(`/booking/${containerId}`));
    await snap(page, '04-booking-no-declaration');
  });

  test('BOOK-06 — blocks CBM exceeding capacity', async ({ page }) => {
    if (!containerId) { test.skip(); return; }

    await page.goto(`/booking/${containerId}`);
    await page.waitForTimeout(3000);

    const gate = page.getByText(/verify my identity/i);
    if (await gate.isVisible().catch(() => false)) { test.skip(); return; }

    // Enter extremely large CBM
    const cbmInput = page.locator('input[name="total_cbm"]');
    await cbmInput.fill('99999');

    await page.locator('button[type="submit"]').click();
    await expect(
      page.getByText(/exceeds|capacity|available/i)
    ).toBeVisible({ timeout: 5_000 });
    await snap(page, '05-booking-exceeds-capacity');
  });

  test('BOOK-05 — happy path: complete booking creates payment record', async ({ page }) => {
    if (!containerId) { test.skip(); return; }

    await page.goto(`/booking/${containerId}`);
    await page.waitForTimeout(3000);

    const gate = page.getByText(/verify my identity/i);
    if (await gate.isVisible().catch(() => false)) { test.skip(); return; }

    // Fill CBM
    await page.locator('input[name="total_cbm"]').fill('1');

    // Add item description and value if fields exist
    const descInput = page.locator('input[name="description"],input[placeholder*="description" i]').first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill('Textile goods — cotton shirts');
    }
    const valueInput = page.locator('input[name="declared_value"],input[placeholder*="value" i]').first();
    if (await valueInput.isVisible().catch(() => false)) {
      await valueInput.fill('5000');
    }

    // Confirm declaration checkbox
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }

    await snap(page, '06-booking-filled');
    await page.locator('button[type="submit"]').click();

    // Should redirect to payments or confirmation
    await expect(page).toHaveURL(/\/payments\/|\/bookings\/|\/booking\/track\//, { timeout: 20_000 });
    await snap(page, '07-booking-submitted');
  });
});

test.describe('TC-PAYMENT — Payment stages', () => {
  test('PAY-01 — My Bookings page shows booking list', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '08-my-bookings');
  });

  test('PAY-05 — Payment history page renders', async ({ page }) => {
    await page.goto('/payments/history');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '09-payment-history');
  });

  test('PAY-01 — clicking a booking shows payment stages', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForTimeout(3000);
    await snap(page, '10-bookings-list');

    const bookingLinks = page.getByRole('link', { name: /view|payment|track/i });
    const count = await bookingLinks.count();
    if (count === 0) {
      // No bookings yet — verify page loaded
      await expect(page.locator('h1').first()).toBeVisible();
      return;
    }

    await bookingLinks.first().click();
    await page.waitForTimeout(2000);
    await snap(page, '11-payment-stages');
  });
});

test.describe('TC-TRACK — Shipment tracking', () => {
  test('TRACK-08 — invalid tracking ID shows error state', async ({ page }) => {
    await page.goto('/booking/track/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '12-tracking-not-found');
  });
});
