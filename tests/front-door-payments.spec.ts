import { test, expect, type Page } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser, signInBrowser, sweepTestUsers, type TestUser } from './helpers/frontDoorUsers';

// Staged payments on a seeded booking. The booking insert fires only the DB triggers, and every
// Edge Function call from the browser is stubbed, so Paystack is never reached.

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const DENIED = '42501';
const TOTAL_PRICE = 1000;

const users: TestUser[] = [];
let containerId: string | undefined;
let bookingId: string | undefined;
let owner: TestUser;
let stranger: TestUser;

async function newUser(...args: Parameters<typeof createTestUser>): Promise<TestUser> {
  const user = await createTestUser(...args);
  users.push(user);
  return user;
}

async function paymentRows() {
  const { data, error } = await adminClient().from('payments')
    .select('id, stage, amount, status').eq('booking_id', bookingId ?? '');
  expect(error).toBeNull();
  return data ?? [];
}

// Answers every Edge Function call with a failure and records it, so nothing can go further.
async function stubEdgeFunctions(page: Page): Promise<{ url: string; body: unknown }[]> {
  const calls: { url: string; body: unknown }[] = [];
  await page.route('**/functions/v1/**', async route => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    calls.push({ url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({
      status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'Stubbed in a test' }),
    });
  });
  return calls;
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await sweepTestUsers();
  owner = await newUser('customer');
  stranger = await newUser('customer');
  const operator = await newUser('operator');
  const db = adminClient();

  const { data: container, error: containerErr } = await db.from('containers').insert({
    operator_id: operator.id,
    origin_country: 'South Africa', origin_city: 'Durban',
    destination_country: 'Ghana', destination_city: 'Tema',
    departure_date: '2030-01-01',
    total_capacity_cbm: 10, available_capacity_cbm: 10,
    load_type: 'LCL', price_per_cbm: 100, currency_code: 'USD', status: 'open',
  }).select('id').single();
  expect(containerErr).toBeNull();
  containerId = container!.id as string;

  const { data: booking, error: bookingErr } = await db.from('bookings').insert({
    container_id: containerId, customer_id: owner.id,
    total_cbm: 1, total_price: TOTAL_PRICE, status: 'pending',
  }).select('id').single();
  expect(bookingErr).toBeNull();
  bookingId = booking!.id as string;
});

// Tries every delete even if one fails, so a partial seed is still removed.
test.afterAll(async () => {
  test.setTimeout(180_000);
  const db = adminClient();
  const del = async (table: string, column: string, value: string | undefined) => {
    if (!value) return;
    const { error } = await db.from(table).delete().eq(column, value);
    if (error) console.error(`cleanup failed for ${table}:`, error.message);
  };
  for (const table of ['payments', 'payouts', 'booking_status_history']) await del(table, 'booking_id', bookingId);
  await del('bookings', 'id', bookingId);
  await del('containers', 'id', containerId);
  for (const user of users) {
    try { await deleteTestUser(user); } catch (err) { console.error('cleanup failed', user.email, err); }
  }
});

test('a booking gets three pending stages at 20, 50 and 30 percent of the total', async () => {
  const rows = await paymentRows();
  expect(rows.map(r => [r.stage, Number(r.amount), r.status]).sort()).toEqual([
    ['deposit_20', TOTAL_PRICE * 0.2, 'pending'],
    ['final_release_30', TOTAL_PRICE * 0.3, 'pending'],
    ['pre_departure_50', TOTAL_PRICE * 0.5, 'pending'],
  ]);
});

test('the owner can pay only the first stage', async ({ page }) => {
  const calls = await stubEdgeFunctions(page);
  await signInBrowser(page, owner);
  await page.goto(`/payments/${bookingId}`);

  const pay = page.getByRole('button', { name: /^Pay / });
  await expect(pay).toHaveCount(1, { timeout: 30_000 });
  await expect(pay).toContainText('200.00');
  await expect(page.getByText('Complete the 20% deposit first')).toBeVisible();
  await expect(page.getByText('Complete the 50% pre-departure payment first')).toBeVisible();

  await pay.click();
  await expect(page.getByText(/Stubbed in a test|Could not initialize payment|non-2xx/i)).toBeVisible({ timeout: 15_000 });

  const deposit = (await paymentRows()).find(r => r.stage === 'deposit_20');
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toContain('/functions/v1/initialize-payment');
  expect(calls[0].body).toMatchObject({ bookingId, paymentId: deposit?.id });
  expect((await paymentRows()).every(r => r.status === 'pending')).toBe(true);
});

test('another customer cannot see the booking or its payments', async ({ page }) => {
  const { data: bookings, error: bookingsErr } = await stranger.client.from('bookings').select('id').eq('id', bookingId ?? '');
  expect(bookingsErr).toBeNull();
  expect(bookings).toEqual([]);
  const { data: payments, error: paymentsErr } = await stranger.client.from('payments').select('id').eq('booking_id', bookingId ?? '');
  expect(paymentsErr).toBeNull();
  expect(payments).toEqual([]);

  await stubEdgeFunctions(page);
  await signInBrowser(page, stranger);
  await page.goto(`/payments/${bookingId}`);
  await expect(page.getByText('Booking not found or access denied.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /^Pay / })).toHaveCount(0);
});

test('a client cannot insert into payments or mark a stage paid', async () => {
  const { error } = await owner.client.from('payments').insert({
    booking_id: bookingId,
    payer_id: owner.id,
    payment_stage: 'manual_adjustment',
    stage: 'manual_adjustment',
    amount: 0,
    status: 'paid',
  });
  expect(error?.code).toBe(DENIED);

  await owner.client.from('payments').update({ status: 'paid' }).eq('booking_id', bookingId ?? '');
  const rows = await paymentRows();
  expect(rows).toHaveLength(3);
  expect(rows.every(r => r.status === 'pending')).toBe(true);
});
