import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { adminClient, createTestUser, removeUsersAndFreight, signInBrowser, sweepTestUsers, type TestUser } from './helpers/frontDoorUsers';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const users: TestUser[] = [];
let customer: TestUser;
let stranger: TestUser;
let admin: TestUser;

type EmailRequest = { to?: string; subject?: string; title?: string; body?: string; html?: string };

// No test here may reach the real send-email function.
async function stubEmail(page: Page, status = 200): Promise<EmailRequest[]> {
  const sent: EmailRequest[] = [];
  await page.route('**/functions/v1/**', async (route) => {
    sent.push(route.request().postDataJSON() as EmailRequest);
    await route.fulfill({ status, json: status === 200 ? { success: true } : { error: 'stubbed failure' } });
  });
  return sent;
}

async function fileTicket(page: Page, subject: string, description: string): Promise<void> {
  await page.goto('/support/new');
  await page.getByPlaceholder('Brief summary of your issue').fill(subject);
  await page.locator('form textarea').fill(description);
  await page.getByRole('button', { name: 'High' }).click();
  await page.getByRole('button', { name: 'Submit Ticket' }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).not.toBe('/support/new');
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await sweepTestUsers();
  for (const role of ['customer', 'customer', 'admin'] as const) users.push(await createTestUser(role));
  [customer, stranger, admin] = users;
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  // requester_id is set to null when a user goes, so tickets must go first.
  const { error } = await adminClient().from('support_tickets').delete().in('requester_id', users.map(u => u.id));
  if (error) console.error('could not remove test tickets', error.message);
  await removeUsersAndFreight(users);
});

test.describe('the emails the admin list relies on', () => {
  test('an admin can match a ticket to its customer email', async () => {
    const { data, error } = await admin.client.rpc('admin_get_users');
    expect(error).toBeNull();
    const row = (data as { user_id: string; email: string }[]).find(u => u.user_id === customer.id);
    expect(row?.email).toBe(customer.email);
  });

  test('a customer gets no emails', async () => {
    const { data, error } = await stranger.client.rpc('admin_get_users');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('someone who is not signed in gets no emails', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    const { data, error } = await anon.rpc('admin_get_users');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

test.describe('in the browser', () => {
  test('a filed ticket alerts support with what they need to reply @browser', async ({ page }) => {
    const sent = await stubEmail(page);
    const subject = `Front door alert ${Date.now()}`;
    await signInBrowser(page, customer);
    await fileTicket(page, subject, 'My cargo <b>is</b> late');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'support@shareconload.com', subject: 'New support ticket' });
    expect(sent[0].html).toBeUndefined();
    for (const part of [subject, 'My cargo <b>is</b> late', customer.email, 'high']) {
      expect(sent[0].body).toContain(part);
    }
  });

  test('the ticket is kept when the alert fails @browser', async ({ page }) => {
    await stubEmail(page, 500);
    const subject = `Front door failed alert ${Date.now()}`;
    await signInBrowser(page, customer);
    await fileTicket(page, subject, 'Alert fails');

    const { data, error } = await adminClient().from('support_tickets').select('id').eq('subject', subject);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  test('an admin sees tickets newest first at /admin/support; a customer is redirected @browser', async ({ page, browser }) => {
    const older = `Front door older ${Date.now()}`;
    const newer = `Front door newer ${Date.now()}`;
    const base = { requester_id: customer.id, submitted_by: customer.profileId, category: 'general', description: 'Seeded' };
    const { error } = await adminClient().from('support_tickets').insert([
      { ...base, subject: older, created_at: '2031-01-01T00:00:00Z' },
      { ...base, subject: newer, created_at: '2031-01-02T00:00:00Z' },
    ]);
    expect(error).toBeNull();

    await signInBrowser(page, admin);
    await page.goto('/admin/support');
    const rows = page.getByTestId('ticket-row');
    await expect(rows.filter({ hasText: newer })).toHaveCount(1, { timeout: 30_000 });
    await expect(rows.filter({ hasText: newer })).toContainText(customer.email);
    const texts = await rows.allTextContents();
    const iNewer = texts.findIndex(t => t.includes(newer));
    const iOlder = texts.findIndex(t => t.includes(older));
    expect(iNewer).toBeGreaterThanOrEqual(0);
    expect(iNewer).toBeLessThan(iOlder);

    await page.goto('/admin');
    await expect(page.locator('a[href="/admin/support"]').first()).toBeVisible({ timeout: 30_000 });

    const context = await browser.newContext();
    const customerPage = await context.newPage();
    try {
      await signInBrowser(customerPage, customer);
      await customerPage.goto('/admin/support');
      await expect.poll(() => new URL(customerPage.url()).pathname, { timeout: 30_000 }).not.toBe('/admin/support');
      await expect(customerPage.getByTestId('ticket-row')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
