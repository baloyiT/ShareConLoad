import { test, expect, type Page } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser, signInBrowser, type TestUser } from './helpers/frontDoorUsers';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

const users: TestUser[] = [];

async function newUser(...args: Parameters<typeof createTestUser>): Promise<TestUser> {
  const user = await createTestUser(...args);
  users.push(user);
  return user;
}

test.afterAll(async () => {
  test.setTimeout(120_000);
  for (const u of users) {
    try { await deleteTestUser(u); } catch (err) { console.error('cleanup failed', u.email, err); }
  }
});

const pathOf = (page: Page) => new URL(page.url()).pathname;

// Gives client-side redirects time to fire, then reports where the page ended up.
async function visit(page: Page, route: string): Promise<string> {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  return pathOf(page);
}

const HIDDEN_ROUTES = [
  '/container/x',
  '/booking/x',
  '/transporter',
  '/measurement-agent',
  '/measurement-service',
  '/onboarding/agent',
  '/onboarding/transporter',
  '/onboarding/measurement-agent',
  '/operator/create',
];

test('anon is redirected to / from each hidden route', async ({ page }) => {
  for (const route of HIDDEN_ROUTES) {
    await page.goto(route);
    await page.waitForURL(url => url.pathname === '/', { timeout: 20_000 });
    expect(pathOf(page), route).toBe('/');
  }
});

// /agent has a server layout that already sends anon visitors to login.
test('anon is sent to login from /agent', async ({ page }) => {
  for (const route of ['/agent']) {
    await page.goto(route);
    await page.waitForURL(url => url.pathname === '/auth/login', { timeout: 20_000 });
  }
});

test('operator with no containers is kept out of /operator/create', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/create');
  await page.waitForURL(url => url.pathname === '/', { timeout: 20_000 });
});

// A customer returning from Paystack must reach the page even with no booking.
// The page may send the visitor on by itself (it does for an unknown job), so the proof that
// the gate let it through is that the page mounted and queried its job.
test('/measurement-service/[jobId]?verify=1 is not gated', async ({ page }) => {
  const user = await newUser('customer');
  await signInBrowser(page, user);
  const jobQuery = page.waitForRequest(req => req.url().includes('/rest/v1/measurement_jobs'), { timeout: 20_000 });
  await page.goto('/measurement-service/00000000-0000-0000-0000-000000000000?verify=1');
  await jobQuery;
});

test('/pickup/[bookingId] is not redirected', async ({ page }) => {
  const path = await visit(page, '/pickup/00000000-0000-0000-0000-000000000000');
  expect(path).not.toBe('/');
});

test('/booking/track/[id] and /bookings are not redirected', async ({ page }) => {
  expect(await visit(page, '/booking/track/00000000-0000-0000-0000-000000000000')).not.toBe('/');
  expect(await visit(page, '/bookings')).not.toBe('/');
});

test('agent test user can open /agent', async ({ page }) => {
  const user = await newUser('customer');
  const { error } = await adminClient().from('profiles').insert({ user_id: user.id, role_type: 'agent' });
  expect(error).toBeNull();
  await signInBrowser(page, user);
  const path = await visit(page, '/agent');
  expect(path).not.toBe('/');
  // An agent is still kept out of the other Stage 3 areas.
  await page.goto('/transporter');
  await page.waitForURL(url => url.pathname === '/', { timeout: 20_000 });
});

test('admin can open a hidden route', async ({ page }) => {
  const user = await newUser('admin');
  await signInBrowser(page, user);
  const path = await visit(page, '/booking/x');
  expect(path).toBe('/booking/x');
});

test('customer with no booking is redirected from /measurement-service', async ({ page }) => {
  const user = await newUser('customer');
  await signInBrowser(page, user);
  await page.goto('/measurement-service');
  await page.waitForURL(url => url.pathname === '/', { timeout: 20_000 });
});

test('/onboarding offers only Customer and Operator to a user with no other role', async ({ page }) => {
  const user = await newUser('customer');
  await signInBrowser(page, user);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'I Have Container Space' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'I Need Container Space' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'I Am a Freight Agent' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Measurement Agent' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Transporter' })).toHaveCount(0);
});

test('/onboarding keeps the role card a user already holds', async ({ page }) => {
  const user = await newUser('customer');
  await adminClient().from('profiles').insert({ user_id: user.id, role_type: 'transporter' });
  await signInBrowser(page, user);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Transporter' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'I Am a Freight Agent' })).toHaveCount(0);
});
