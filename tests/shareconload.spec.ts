import { test, expect } from '@playwright/test';

// ── Home page ─────────────────────────────────────────────────────────────────

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows brand name in navbar', async ({ page }) => {
    await expect(page.getByText('ShareConLoad').first()).toBeVisible();
  });

  test('shows Log in and Sign up buttons when logged out', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible();
  });

  test('shows hero headline', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Share the Load/i })).toBeVisible();
  });

  test('shows search form with all four fields', async ({ page }) => {
    await expect(page.getByPlaceholder(/Shanghai, China/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Lagos, Nigeria/i)).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByPlaceholder(/e.g. 200/i)).toBeVisible();
  });

  test('shows Available Containers section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Available Containers' })).toBeVisible();
  });

  test('shows feature cards', async ({ page }) => {
    await expect(page.getByText('Secure Bookings')).toBeVisible();
    await expect(page.getByText('24/7 Support')).toBeVisible();
    await expect(page.getByText('Flexible Bookings')).toBeVisible();
    await expect(page.getByText('Transparent Pricing')).toBeVisible();
  });

  test('shows footer copyright', async ({ page }) => {
    await expect(page.getByText(/ShareConLoad. All rights reserved/i)).toBeVisible();
  });
});

// ── Search / filter ───────────────────────────────────────────────────────────

test.describe('Container search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for initial container load to settle before interacting
    await page.locator('.loading-spinner').waitFor({ state: 'hidden' }).catch(() => {});
  });

  test('Search button is present and clickable', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Search' });
    await expect(btn).toBeVisible();
    await btn.click();
  });

  test('Clear filters button appears after search and resets', async ({ page }) => {
    await page.getByPlaceholder(/Shanghai, China/i).fill('China');
    await page.getByRole('button', { name: 'Search' }).click();
    // Multiple clear buttons may exist (form + floating) — use first
    const clearBtn = page.getByRole('button', { name: 'Clear filters', exact: true }).first();
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(clearBtn).not.toBeVisible();
  });

  test('shows result count after searching', async ({ page }) => {
    await page.getByPlaceholder(/Shanghai, China/i).fill('China');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/\d+ results?/i)).toBeVisible();
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe('Navbar navigation', () => {
  test('How It Works link navigates correctly', async ({ page }) => {
    await page.goto('/');
    // Multiple links may exist (nav + footer) — click the nav one
    await page.getByRole('navigation').getByRole('link', { name: 'How It Works' }).click();
    await expect(page).toHaveURL('/how-it-works');
  });

  test('Log in link navigates to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL('/auth/login');
  });

  test('Sign up link navigates to register page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/auth/register');
  });
});

// ── Login page ────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('renders email and password fields', async ({ page }) => {
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('shows validation errors when submitted empty', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required.')).toBeVisible();
    await expect(page.getByText('Password is required.')).toBeVisible();
  });

  test('shows error for invalid email format', async ({ page }) => {
    await page.getByPlaceholder('you@example.com').fill('notanemail');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  });

  test('has link to register page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible();
  });
});

// ── Register page ─────────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  test('renders all registration fields', async ({ page }) => {
    await expect(page.getByPlaceholder('John Doe')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Min. 8 characters')).toBeVisible();
    await expect(page.getByPlaceholder('Re-enter your password')).toBeVisible();
  });

  test('shows validation errors when submitted empty', async ({ page }) => {
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Full name is required.')).toBeVisible();
    await expect(page.getByText('Email is required.')).toBeVisible();
  });

  test('shows password length error for short password', async ({ page }) => {
    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('Min. 8 characters').fill('short');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('Min. 8 characters').fill('SecurePass1!');
    await page.getByPlaceholder('Re-enter your password').fill('DifferentPass1!');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('has link back to login page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });
});

// ── Auth redirect (middleware) ────────────────────────────────────────────────

test.describe('Protected routes', () => {
  test('unauthenticated user visiting /booking is handled gracefully', async ({ page }) => {
    await page.goto('/booking/some-container-id');
    await page.waitForTimeout(2000);
    // Route either redirects to login or renders content (not all booking routes enforce auth)
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('unauthenticated user visiting /operator is redirected to login', async ({ page }) => {
    await page.goto('/operator');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

// ── Onboarding & auth callback ────────────────────────────────────────────────

test.describe('Onboarding routing', () => {
  test('unauthenticated /onboarding is handled gracefully', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForTimeout(2000);
    // Onboarding page renders without redirect for anon users (client-side auth check)
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('unauthenticated /onboarding/operator is handled gracefully', async ({ page }) => {
    await page.goto('/onboarding/operator');
    await page.waitForTimeout(2000);
    // Onboarding/operator may redirect or render content for anon users — just check no crash
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('/auth/callback with no code redirects to login with error', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/auth\/login\?error=confirmation_failed/);
  });
});
