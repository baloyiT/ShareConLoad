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

// Seeds a customer with a real measurement job and booking. Booking insert fires only the
// DB triggers for the payment schedule and container capacity (no Paystack, no email).
interface Seed { user: TestUser; jobId: string; bookingId: string; containerId: string; paymentRef: string }

async function seedCustomerData(): Promise<Seed> {
  const db = adminClient();
  const user = await newUser('customer');
  const operator = await newUser('operator');
  const paymentRef = `front-door-test-ref-${user.id}`;

  // A signup trigger gives every new user a default customer profile, so the helper user has
  // two customer rows. Kept on purpose: users can hold several profile rows and the pages
  // must cope with that.

  const { data: job, error: jobErr } = await db.from('measurement_jobs').insert({
    shipper_profile_id: user.profileId,
    pickup_address: '1 Test Street',
    pickup_city: 'Johannesburg',
    pickup_country: 'South Africa',
    quoted_fee: 100,
    payment_ref: paymentRef,
  }).select('id').single();
  expect(jobErr).toBeNull();

  const { data: container, error: cErr } = await db.from('containers').insert({
    operator_id: operator.id,
    origin_country: 'South Africa', origin_city: 'Durban',
    destination_country: 'Ghana', destination_city: 'Tema',
    departure_date: '2030-01-01',
    total_capacity_cbm: 10, available_capacity_cbm: 10,
    load_type: 'LCL', price_per_cbm: 100, currency_code: 'USD', status: 'open',
  }).select('id').single();
  expect(cErr).toBeNull();

  const { data: booking, error: bErr } = await db.from('bookings').insert({
    container_id: container!.id, customer_id: user.id,
    total_cbm: 1, total_price: 100, status: 'pending',
  }).select('id').single();
  expect(bErr).toBeNull();

  return { user, jobId: job!.id as string, bookingId: booking!.id as string, containerId: container!.id as string, paymentRef };
}

async function removeSeed(s: Seed): Promise<void> {
  const db = adminClient();
  await db.from('measurement_jobs').delete().eq('id', s.jobId);
  await db.from('pickup_jobs').delete().eq('booking_id', s.bookingId);
  await db.from('payments').delete().eq('booking_id', s.bookingId);
  await db.from('bookings').delete().eq('id', s.bookingId);
  await db.from('containers').delete().eq('id', s.containerId);
}

test('measurement job page loads the job and reaches verification (verify=1)', async ({ page }) => {
  const seed = await seedCustomerData();
  try {
    await signInBrowser(page, seed.user);

    // Stub the verify function so Paystack is never called; record what the page sends.
    const sent: { reference?: string }[] = [];
    await page.route('**/functions/v1/verify-measurement-payment', async route => {
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      sent.push(route.request().postDataJSON() as { reference?: string });
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
    });

    await page.goto(`/measurement-service/${seed.jobId}?verify=1`);
    await expect(page.getByText('1 Test Street')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Payment confirmed!')).toBeVisible();
    expect(pathOf(page)).toBe(`/measurement-service/${seed.jobId}`);
    expect(sent).toEqual([{ reference: seed.paymentRef }]);
  } finally {
    await removeSeed(seed);
  }
});

test('measurement job page loads the job without verify', async ({ page }) => {
  const seed = await seedCustomerData();
  try {
    await signInBrowser(page, seed.user);
    await page.goto(`/measurement-service/${seed.jobId}`);
    await expect(page.getByText('1 Test Street')).toBeVisible({ timeout: 20_000 });
    expect(pathOf(page)).toBe(`/measurement-service/${seed.jobId}`);
  } finally {
    await removeSeed(seed);
  }
});

// A customer with two profile rows returning from a pickup payment must reach verification.
test('/pickup/[bookingId]?verify=1 reaches verification for a user with two profile rows', async ({ page }) => {
  const seed = await seedCustomerData();
  try {
    const { data: rows } = await adminClient().from('profiles').select('id, role_type')
      .eq('user_id', seed.user.id).order('id');
    expect(rows).toHaveLength(2);
    // The page uses the customer row with the lowest id as the shipper.
    const shipperId = rows!.find(r => r.role_type === 'customer')!.id as string;
    const ref = `front-door-test-ref-pickup-${seed.user.id}`;
    const { error } = await adminClient().from('pickup_jobs').insert({
      booking_id: seed.bookingId, shipper_profile_id: shipperId,
      pickup_address: '2 Test Street', pickup_city: 'Johannesburg', pickup_country: 'South Africa',
      warehouse_address: 'Test Warehouse', quoted_fee: 50, status: 'pending_payment', payment_ref: ref,
    });
    expect(error).toBeNull();

    await signInBrowser(page, seed.user);
    const sent: { reference?: string }[] = [];
    await page.route('**/functions/v1/verify-pickup-payment', async route => {
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      sent.push(route.request().postDataJSON() as { reference?: string });
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
    });

    await page.goto(`/pickup/${seed.bookingId}?verify=1`);
    await expect(page.getByText('Payment confirmed!')).toBeVisible({ timeout: 20_000 });
    expect(pathOf(page)).toBe(`/pickup/${seed.bookingId}`);
    expect(sent).toEqual([{ reference: ref }]);
  } finally {
    await removeSeed(seed);
  }
});

test('/pickup/[bookingId] loads the booking and does not bounce', async ({ page }) => {
  const seed = await seedCustomerData();
  try {
    await signInBrowser(page, seed.user);
    const bookingQuery = page.waitForRequest(
      req => req.url().includes('/rest/v1/bookings') && req.url().includes(seed.bookingId),
      { timeout: 20_000 },
    );
    await page.goto(`/pickup/${seed.bookingId}`);
    await bookingQuery;
    await page.waitForTimeout(3000);
    expect(pathOf(page)).toBe(`/pickup/${seed.bookingId}`);
  } finally {
    await removeSeed(seed);
  }
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
