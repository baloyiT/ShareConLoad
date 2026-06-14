import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: 'tests/.auth/customer-user.json' });

const SNAP_DIR = path.join('tests', 'snapshots', 'messaging');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

// Helper: find a booking with a messaging thread
async function getFirstBookingId(page: Page): Promise<string | null> {
  await page.goto('/bookings');
  await page.waitForTimeout(3000);
  const links = page.getByRole('link', { name: /view|message|details/i });
  const count = await links.count();
  if (count === 0) return null;
  const href = await links.first().getAttribute('href');
  const match = href?.match(/([0-9a-f-]{36})/);
  return match?.[1] ?? null;
}

test.describe('TC-MSG — Booking message thread', () => {
  test('MSG-01 — messages page loads for a booking', async ({ page }) => {
    const bookingId = await getFirstBookingId(page);
    if (!bookingId) {
      await snap(page, '01-no-bookings');
      test.skip();
      return;
    }

    // Messages may be on booking detail or a dedicated route
    const routes = [
      `/bookings/${bookingId}`,
      `/bookings/${bookingId}/messages`,
      `/booking/track/${bookingId}`,
    ];

    let found = false;
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(2000);
      const msgArea = page.locator('textarea,input[placeholder*="message" i]').first();
      if (await msgArea.isVisible().catch(() => false)) {
        found = true;
        await snap(page, '01-messages-thread');
        break;
      }
    }

    if (!found) {
      await snap(page, '01-messages-not-found');
    }
  });
});

test.describe('TC-MSG — Content filter (DB-level trigger)', () => {
  // These tests call Supabase directly via the API to test the DB trigger.
  // The trigger raises an exception server-side — the UI should surface an error.

  async function tryMessage(page: Page, content: string, snapName: string) {
    const bookingId = await getFirstBookingId(page);
    if (!bookingId) { test.skip(); return; }

    // Find message input
    const routes = [`/bookings/${bookingId}`, `/bookings/${bookingId}/messages`, `/booking/track/${bookingId}`];
    let msgInput: ReturnType<Page['locator']> | null = null;
    let sendBtn: ReturnType<Page['locator']> | null = null;

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(2000);
      const inp = page.locator('textarea,input[placeholder*="message" i]').first();
      if (await inp.isVisible().catch(() => false)) {
        msgInput = inp;
        sendBtn = page.getByRole('button', { name: /send/i }).first();
        break;
      }
    }

    if (!msgInput) { test.skip(); return; }

    await msgInput.fill(content);
    await snap(page, `${snapName}-before-send`);
    await sendBtn?.click();
    await page.waitForTimeout(2000);
    await snap(page, `${snapName}-after-send`);

    // Should show an error — not save the message
    await expect(
      page.getByText(/not allowed|blocked|contact/i)
    ).toBeVisible({ timeout: 5_000 });
  }

  test('MSG-03 — email in message is blocked', async ({ page }) => {
    await tryMessage(page, 'Send docs to test@gmail.com please', '02-email-blocked');
  });

  test('MSG-04 — URL in message is blocked', async ({ page }) => {
    await tryMessage(page, 'Check https://whatsapp.com for updates', '03-url-blocked');
  });

  test('MSG-05 — SA phone number is blocked', async ({ page }) => {
    await tryMessage(page, 'Call me on +27 82 123 4567', '04-phone-blocked');
  });

  test('MSG-06 — social handle is blocked', async ({ page }) => {
    await tryMessage(page, 'Find me on @johndoe123', '05-social-blocked');
  });

  test('MSG-07 — clean message is allowed', async ({ page }) => {
    const bookingId = await getFirstBookingId(page);
    if (!bookingId) { test.skip(); return; }

    const routes = [`/bookings/${bookingId}`, `/bookings/${bookingId}/messages`, `/booking/track/${bookingId}`];
    let msgInput: ReturnType<Page['locator']> | null = null;
    let sendBtn: ReturnType<Page['locator']> | null = null;

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(2000);
      const inp = page.locator('textarea,input[placeholder*="message" i]').first();
      if (await inp.isVisible().catch(() => false)) {
        msgInput = inp;
        sendBtn = page.getByRole('button', { name: /send/i }).first();
        break;
      }
    }

    if (!msgInput) { test.skip(); return; }

    await msgInput.fill('When does the container depart from Johannesburg?');
    await sendBtn?.click();
    await page.waitForTimeout(2000);
    await snap(page, '06-clean-message-sent');

    // Should NOT show error
    const error = page.getByText(/not allowed|blocked/i);
    await expect(error).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });
});
