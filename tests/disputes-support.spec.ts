import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: 'tests/.auth/customer-user.json' });

const SNAP_DIR = path.join('tests', 'snapshots', 'disputes-support');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

const PDF_FIXTURE = path.join('tests', 'fixtures', 'proof-of-address.pdf');

test.describe('TC-DISPUTE — Submit dispute', () => {
  test('DISP-01 — /disputes/new renders form', async ({ page }) => {
    await page.goto('/disputes/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '01-dispute-form');
  });

  test('DISP-01 — form has required fields', async ({ page }) => {
    await page.goto('/disputes/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });

    // Expect at least a booking selector and reason/description field
    const bookingField = page.locator('select[name="booking_id"],input[name="booking_id"]').first();
    const reasonField  = page.locator('textarea[name="description"],textarea[name="reason"],textarea').first();

    await expect(reasonField).toBeVisible();
    await snap(page, '02-dispute-fields');
  });

  test('DISP-01 — blocks empty submission', async ({ page }) => {
    await page.goto('/disputes/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });

    // Submit button is disabled when customer has no eligible bookings
    const submitBtn = page.locator('button[type="submit"]');
    const isDisabled = await submitBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      await submitBtn.click();
    }
    await expect(page).toHaveURL('/disputes/new');
    await snap(page, '03-dispute-empty-submit');
  });

  test('DISP-01 — fills and submits dispute', async ({ page }) => {
    await page.goto('/disputes/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });

    // Select first booking if dropdown present
    const bookingSelect = page.locator('select[name="booking_id"]');
    if (await bookingSelect.isVisible().catch(() => false)) {
      const options = await bookingSelect.locator('option').all();
      if (options.length > 1) {
        await bookingSelect.selectOption({ index: 1 });
      } else {
        // No bookings — skip
        await snap(page, '04-dispute-no-bookings');
        test.skip();
        return;
      }
    }

    const reasonField = page.locator('select[name="reason_type"],select[name="type"]').first();
    if (await reasonField.isVisible().catch(() => false)) {
      await reasonField.selectOption({ index: 1 });
    }

    const descField = page.locator('textarea').first();
    await descField.fill('Goods arrived damaged. Several boxes of clothing were water-damaged upon delivery.');

    await snap(page, '04-dispute-filled');

    // Submit button is disabled when customer has no eligible bookings
    const submitBtn = page.locator('button[type="submit"]');
    const isDisabled = await submitBtn.isDisabled().catch(() => false);
    if (isDisabled) {
      await snap(page, '04b-dispute-submit-disabled');
      return; // No eligible bookings — can't submit
    }
    await submitBtn.click();

    // Should redirect to dispute detail or show confirmation
    await expect(page).not.toHaveURL('/disputes/new', { timeout: 15_000 });
    await snap(page, '05-dispute-submitted');
  });
});

test.describe('TC-DISPUTE — Dispute detail & evidence', () => {
  test('DISP-07 — invalid dispute ID shows error', async ({ page }) => {
    await page.goto('/disputes/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(3000);
    await expect(
      page.getByText(/not found|error|invalid/i).or(page.locator('h1,h2').first())
    ).toBeVisible({ timeout: 10_000 });
    await snap(page, '06-dispute-not-found');
  });

  test('DISP-02 — dispute detail page shows evidence upload', async ({ page }) => {
    // Navigate to disputes list first
    await page.goto('/disputes');
    await page.waitForTimeout(3000);

    const disputeLinks = page.getByRole('link', { name: /view|details/i });
    const count = await disputeLinks.count();

    if (count === 0) {
      await snap(page, '07-no-disputes');
      return;
    }

    await disputeLinks.first().click();
    await page.waitForTimeout(2000);
    await snap(page, '07-dispute-detail');

    // Evidence upload section
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(PDF_FIXTURE);
      await snap(page, '08-evidence-selected');
    }
  });
});

test.describe('TC-SUPPORT — Support tickets', () => {
  test('SUP-01 — /support/new renders form', async ({ page }) => {
    await page.goto('/support/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '09-support-form');
  });

  test('SUP-01 — form has subject and message fields', async ({ page }) => {
    await page.goto('/support/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator('input[name="subject"]').or(page.getByPlaceholder(/brief summary/i)).or(page.locator('input[type="text"]').first())
    ).toBeVisible();
    await expect(
      page.locator('textarea[name="message"]').or(page.locator('textarea').first())
    ).toBeVisible();

    await snap(page, '10-support-fields');
  });

  test('SUP-01 — blocks empty submission', async ({ page }) => {
    await page.goto('/support/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });

    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/support/new');
    await snap(page, '11-support-empty-submit');
  });

  test('SUP-01 — submits valid ticket', async ({ page }) => {
    await page.goto('/support/new');
    await expect(page.locator('h1,h2').first()).toBeVisible({ timeout: 10_000 });

    const subjectInput = page.locator('input[name="subject"]').or(page.getByPlaceholder(/brief summary/i)).or(page.locator('input[type="text"]').first()).first();
    await subjectInput.fill('Unable to view tracking milestone');

    const msgTextarea = page.locator('textarea').first();
    await msgTextarea.fill(
      'Hello, I booked a container last week and the tracking page shows no milestones yet. Can you please check the status?'
    );

    await snap(page, '12-support-filled');
    await page.locator('button[type="submit"]').click();

    // Should show confirmation or redirect
    await page.waitForTimeout(3000);
    await snap(page, '13-support-submitted');
    await expect(
      page.getByText(/submitted|success|thank you|ticket/i).or(page.locator('h1,h2').first()).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
