import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Anon tests — no storageState

const SNAP_DIR = path.join('tests', 'snapshots', 'auth');
function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), fullPage: true });
}

test.describe('AUTH-01 — Registration form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
  });

  test('renders all required fields', async ({ page }) => {
    await expect(page.getByPlaceholder('John Doe')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Min. 8 characters')).toBeVisible();
    await snap(page, '01-register-empty');
  });

  test('blocks empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Full name is required.')).toBeVisible();
    await snap(page, '02-register-validation');
  });

  test('blocks short password', async ({ page }) => {
    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('Min. 8 characters').fill('short');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    await snap(page, '03-register-short-password');
  });

  test('blocks mismatched passwords', async ({ page }) => {
    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('Min. 8 characters').fill('SecurePass1!');
    await page.getByPlaceholder('Re-enter your password').fill('DifferentPass1!');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords do not match/i).first()).toBeVisible();
    await snap(page, '04-register-password-mismatch');
  });

  test('has link to login page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await snap(page, '05-register-links');
  });
});

test.describe('AUTH-03 — Login validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
  });

  test('blocks empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required.')).toBeVisible();
    await snap(page, '06-login-empty');
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.locator('input[type="email"]').fill('nobody@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/incorrect/i).first()).toBeVisible({ timeout: 10_000 });
    await snap(page, '07-login-wrong-creds');
  });

  test('has link to register page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible();
  });
});

test.describe('AUTH-07 — Protected routes redirect', () => {
  test('/operator redirects to login', async ({ page }) => {
    await page.goto('/operator');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await snap(page, '08-protected-operator');
  });

  test('/admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await snap(page, '09-protected-admin');
  });

  test('/bookings redirects to login', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await snap(page, '10-protected-bookings');
  });

  test('/payments/history redirects to login', async ({ page }) => {
    await page.goto('/payments/history');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await snap(page, '11-protected-payments-history');
  });

  test('/agent redirects unauthenticated user', async ({ page }) => {
    await page.goto('/agent');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await snap(page, '12-protected-agent');
  });

  test('/auth/callback with no code → login error', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/auth\/login\?error=confirmation_failed/, { timeout: 10_000 });
    await snap(page, '13-callback-no-code');
  });
});
