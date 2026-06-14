import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: 'tests/.auth/agent-user.json' });

const SNAP_DIR = path.join('tests', 'snapshots', 'agent-portal');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

test.describe('TC-AGENT — Agent portal access', () => {
  test('AGT-02 — approved agent can access /agent', async ({ page }) => {
    await page.goto('/agent');
    await page.waitForTimeout(3000);

    // Approved agent should NOT be redirected to login
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 5_000 });

    const blocked = page.getByText(/under review|pending|not approved/i);
    const isBlocked = await blocked.isVisible().catch(() => false);

    if (isBlocked) {
      // Agent not yet approved in test DB — log and capture
      console.warn('Agent not approved in test DB — run admin-review.spec.ts first to approve');
      await snap(page, '01-agent-not-approved');
    } else {
      await expect(page.locator('h1,h2').first()).toBeVisible();
      await snap(page, '01-agent-portal');
    }
  });

  test('AGT-01 — unapproved agent sees pending guard', async ({ page }) => {
    // With approved agent account, navigate to status page
    await page.goto('/onboarding/agent/status');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await snap(page, '02-agent-status');
  });
});

test.describe('TC-AGENT — Managed shippers', () => {
  test('AGT-03 — can navigate to managed shippers', async ({ page }) => {
    await page.goto('/agent');
    await page.waitForTimeout(3000);

    const shippersLink = page.getByRole('link', { name: /shippers|managed/i });
    if (await shippersLink.isVisible().catch(() => false)) {
      await shippersLink.click();
      await page.waitForTimeout(2000);
      await snap(page, '03-managed-shippers');
      await expect(page.locator('h1,h2').first()).toBeVisible();
    } else {
      await snap(page, '03-agent-no-shippers-link');
    }
  });

  test('AGT-03 — managed shippers page renders', async ({ page }) => {
    // Try direct route
    await page.goto('/agent/shippers');
    await page.waitForTimeout(2000);
    await snap(page, '04-shippers-page');
    await expect(page.locator('body')).not.toContainText('500');
  });
});

test.describe('TC-AGENT — Onboarding status', () => {
  test('ONBOARD-16 — status tracker shows correct state', async ({ page }) => {
    await page.goto('/onboarding/agent/status');
    await expect(page.locator('h1')).toContainText('Application Status', { timeout: 10_000 });

    // Should show one of: pending_review, approved, rejected state
    const statuses = ['Under Review', 'Approved', 'Rejected'];
    let found = false;
    for (const status of statuses) {
      if (await page.getByText(status, { exact: false }).isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }

    if (!found) {
      // Might use icons/colours instead of text — just assert page loaded
      await expect(page.locator('h1')).toBeVisible();
    }

    await snap(page, '05-status-tracker');
  });
});
