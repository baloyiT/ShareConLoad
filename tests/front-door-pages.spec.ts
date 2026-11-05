import { test, expect } from '@playwright/test';

// Public pages: no login and no database writes.

const FOOTER_LINE = 'Independent operators deliver the freight and are responsible for it. ShareConLoad connects you.';
const BANNED = /container|cbm|escrow|\bagents?\b|paystack|deposit/i;
const CLAIMS =
  /lowest price|cheapest|best price|\bguarantee|vetted|top[- ]rated|\d+\+? operators|we guarantee/i;
// The required disclaimers are the only places "guarantee" may appear.
const ALLOWED_DISCLAIMERS = [
  /neither label guarantees service quality/gi,
  /what verification does not guarantee/gi,
  /neither label guarantees the quality of an operator's service/gi,
];
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

function withoutDisclaimers(text: string): string {
  return ALLOWED_DISCLAIMERS.reduce((t, re) => t.replace(re, ''), text);
}

const PUBLIC_PAGES = [
  '/about',
  '/how-it-works',
  '/pricing',
  '/operator-verification',
  '/for-operators',
  '/contact',
  '/terms',
  '/privacy',
  '/cancellation',
  '/payment-flow',
  '/dispute-resolution',
];

const REWRITTEN_PAGES = ['/about', '/how-it-works', '/pricing', '/operator-verification', '/for-operators'];

test.describe('Front door public pages', () => {
  for (const path of REWRITTEN_PAGES) {
    test(`${path} has no banned phrases or forbidden claims`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(BANNED);
      expect(withoutDisclaimers(text)).not.toMatch(CLAIMS);
      const emails = new Set((text.match(EMAIL) ?? []).map((e) => e.toLowerCase()));
      for (const e of emails) expect(e).toBe('support@shareconload.com');
    });
  }

  test('/contact makes no forbidden claims and shows only the support email', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    const text = await page.locator('body').innerText();
    expect(withoutDisclaimers(text)).not.toMatch(CLAIMS);
    for (const e of new Set((text.match(EMAIL) ?? []).map((m) => m.toLowerCase()))) {
      expect(e).toBe('support@shareconload.com');
    }
  });

  for (const path of PUBLIC_PAGES) {
    test(`${path} shows the operator responsibility line and shared navigation`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(FOOTER_LINE).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    });
  }

  test('privacy states that operators deliver and are responsible for the freight', async ({ page }) => {
    await page.goto('/privacy');
    await expect(
      page.getByText(/shipping services\. Independent operators deliver the freight and are responsible for it\. ShareConLoad connects you\./),
    ).toBeVisible({ timeout: 15_000 });
  });

  for (const path of ['/cancellation', '/payment-flow', '/dispute-resolution']) {
    test(`${path} still loads its content with the footer line`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(FOOTER_LINE).first()).toBeVisible();
    });
  }

  test('pricing says customers pay nothing and shows no lead price', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/customers pay nothing/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/not set a price for leads/i).first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/[$R€£]\s?\d|\b\d+\s?(USD|ZAR)\b|\d+%/);
  });

  test('operator-verification explains both labels and says neither guarantees service quality', async ({ page }) => {
    await page.goto('/operator-verification');
    await expect(page.getByRole('heading', { name: 'Business verified' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Identity verified' })).toBeVisible();
    await expect(page.getByText(/neither label guarantees the quality/i)).toBeVisible();
  });

  test('for-operators shows Register your interest while OPERATOR_SIGNUP_OPEN is false', async ({ page }) => {
    await page.goto('/for-operators');
    const cta = page.getByRole('link', { name: /register your interest/i });
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await expect(cta).toHaveAttribute('href', '/contact');
    await expect(page.getByRole('link', { name: /^sign up/i })).toHaveCount(0);
    await expect(page.getByText(/volume of enquiries/i).first()).toBeVisible();
  });

  test('terms states operators deliver and are responsible for freight services', async ({ page }) => {
    await page.goto('/terms');
    await expect(
      page.getByText(/Independent Operators deliver the freight services and are responsible for them/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('how-it-works links to the directory and the quote form, not a listing', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('main a[href="/directory"]')).toBeVisible();
    await expect(page.locator('main a[href="/#get-quotes"]')).toBeVisible();
    await expect(page.locator('a[href="/#listings"]')).toHaveCount(0);
  });

  test('rewritten pages do not scroll sideways at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of [...REWRITTEN_PAGES, '/contact', '/terms', '/privacy']) {
      await page.goto(path);
      await expect(page.locator('h1').first(), path).toBeVisible({ timeout: 15_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
});
