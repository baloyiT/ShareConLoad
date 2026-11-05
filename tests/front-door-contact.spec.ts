import { test, expect, type Page, type Request } from '@playwright/test';
import { randomBytes } from 'crypto';
import { adminClient, createTestUser, deleteTestUser, signInBrowser, type TestUser } from './helpers/frontDoorUsers';
import { buildEnquiryContactUrl } from '../components/HomeEnquiryForm';

test.setTimeout(120_000);

const SEND_EMAIL = '**/functions/v1/send-email*';

// Every row these tests write carries a unique name, so cleanup only ever deletes rows this run made.
const createdNames: string[] = [];
const users: TestUser[] = [];

function marker(): string {
  const name = `FDT-contact-${randomBytes(6).toString('hex')}`;
  createdNames.push(name);
  return name;
}

test.afterEach(async () => {
  test.setTimeout(120_000);
  for (const name of createdNames.splice(0)) {
    const { error } = await adminClient().from('contact_submissions').delete().eq('name', name);
    if (error) console.error('contact row cleanup failed', name, error.message);
  }
  for (const u of users.splice(0)) {
    try { await deleteTestUser(u); } catch (err) { console.error('cleanup failed', u.email, err); }
  }
});

async function newUser(role: 'customer' | 'admin'): Promise<TestUser> {
  const user = await createTestUser(role);
  users.push(user);
  return user;
}

async function rowsNamed(name: string) {
  const { data, error } = await adminClient().from('contact_submissions').select('*').eq('name', name);
  expect(error).toBeNull();
  return data ?? [];
}

// Never lets a test send a real email. Returns the captured requests.
async function stubEmail(page: Page, status = 200): Promise<Request[]> {
  const sent: Request[] = [];
  await page.route(SEND_EMAIL, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
        },
      });
      return;
    }
    sent.push(route.request());
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(status === 200 ? { success: true } : { error: 'boom' }),
    });
  });
  return sent;
}

async function fillAndSend(page: Page, name: string, opts: { phone?: string } = {}) {
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill('front-door-test@example.invalid');
  if (opts.phone) await page.locator('input[name="phone"]').fill(opts.phone);
  await page.getByPlaceholder('Search your country...').fill('Ghana');
  await page.locator('li', { hasText: /^Ghana$/ }).click();
  await page.getByRole('button', { name: 'Send Message' }).click();
}

test.describe('buildEnquiryContactUrl', () => {
  const messageOf = (url: string) => new URL(url, 'http://x').searchParams.get('message') ?? '';

  test('trims what, and caps From and To at 200 characters', () => {
    const msg = messageOf(buildEnquiryContactUrl('  sofa  ', 'a'.repeat(300), `${'b'.repeat(199)}😀😀`));
    const lines = msg.split('\n');
    expect(lines[0]).toBe('What I need to move: sofa');
    expect(lines[1]).toBe(`From: ${'a'.repeat(200)}`);
    expect(Array.from(lines[2].slice(4)).length).toBe(200);
  });

  test('a lone surrogate does not throw and becomes U+FFFD', () => {
    const url = buildEnquiryContactUrl('box \uD800 end', 'x\uDC00', 'y');
    expect(messageOf(url)).toContain('box � end');
    expect(messageOf(url)).toContain('From: x�');
  });
});

test('home form does not submit a whitespace-only description', async ({ page }) => {
  await page.goto('/');
  const form = page.locator('#get-quotes');
  await form.locator('#enquiry-what').fill('     ');
  await form.getByRole('button', { name: 'Continue' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('Continue still reaches /contact when the browser has no toWellFormed', async ({ page }) => {
  await page.addInitScript(() => {
    delete (String.prototype as { toWellFormed?: unknown }).toWellFormed;
  });
  await page.goto('/');
  expect(await page.evaluate(() => typeof ''.toWellFormed)).toBe('undefined');
  const form = page.locator('#get-quotes');
  await form.locator('#enquiry-what').fill('Two sofas \uD800');
  await form.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/contact\?/, { timeout: 20_000 });
  await expect(page.locator('select[name="subject"]')).toHaveValue('Freight enquiry');
  await expect(page.locator('textarea[name="message"]')).toHaveValue(/What I need to move: Two sofas �\n/);
});

test('/contact prefills subject and message from the query string', async ({ page }) => {
  await page.goto(buildEnquiryContactUrl('Two sofas', 'Johannesburg', 'Accra'));
  await expect(page.locator('select[name="subject"]')).toHaveValue('Freight enquiry');
  await expect(page.locator('textarea[name="message"]')).toHaveValue(
    'What I need to move: Two sofas\nFrom: Johannesburg\nTo: Accra',
  );
});

test('hero text with & " < > survives the round trip unchanged', async ({ page }) => {
  const name = marker();
  const what = `Tom & Jerry's "boxes" <b>x</b> ${name}`;
  const expected = `What I need to move: ${what}\nFrom: Not sure\nTo: Not sure`;
  const sent = await stubEmail(page);

  await page.goto(buildEnquiryContactUrl(what, '', ''));
  await expect(page.locator('textarea[name="message"]')).toHaveValue(expected);
  await fillAndSend(page, name, { phone: '+27 82 000 0000' });
  await expect(page.getByText('Message Received!')).toBeVisible({ timeout: 20_000 });

  const rows = await rowsNamed(name);
  expect(rows).toHaveLength(1);
  expect(rows[0].message).toBe(expected);
  expect(rows[0].subject).toBe('Freight enquiry');
  await expect.poll(() => sent.length).toBe(1);
});

test('a 2000-character description does not break the page', async ({ page }) => {
  await page.goto(buildEnquiryContactUrl('z'.repeat(2000), 'Johannesburg', 'Accra'));
  const value = await page.locator('textarea[name="message"]').inputValue();
  expect(value).toContain(`What I need to move: ${'z'.repeat(500)}\n`);
  expect(value).not.toContain('z'.repeat(501));
  await expect(page.getByRole('button', { name: 'Send Message' })).toBeVisible();
});

test('a freight enquiry needs a phone number; other subjects do not', async ({ page }) => {
  await page.goto(buildEnquiryContactUrl('Boxes', 'Johannesburg', 'Accra'));
  await expect(page.locator('input[name="phone"]')).toHaveJSProperty('required', true);
  await page.locator('select[name="subject"]').selectOption('General Inquiry');
  await expect(page.locator('input[name="phone"]')).toHaveJSProperty('required', false);
  await page.locator('select[name="subject"]').selectOption('Freight enquiry');
  await expect(page.locator('input[name="phone"]')).toHaveJSProperty('required', true);
});

test('a freight enquiry without a phone number is not sent', async ({ page }) => {
  const name = marker();
  const sent = await stubEmail(page);
  await page.goto(buildEnquiryContactUrl('Boxes', 'Johannesburg', 'Accra'));
  await fillAndSend(page, name);
  expect(await page.locator('input[name="phone"]').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await expect(page.getByText('Message Received!')).toHaveCount(0);
  expect(await rowsNamed(name)).toHaveLength(0);
  expect(sent).toHaveLength(0);
});

test('freight enquiry alerts support with the customer text unchanged and no html', async ({ page }) => {
  const name = marker();
  const what = `A & B <i>"q"</i> ${name}`;
  const sent = await stubEmail(page);

  await page.goto(buildEnquiryContactUrl(what, '', ''));
  const requestPromise = page.waitForRequest((r) => r.url().includes('/functions/v1/send-email') && r.method() === 'POST');
  await fillAndSend(page, name, { phone: '+27 82 000 0000' });
  const request = await requestPromise;
  await expect(page.getByText('Message Received!')).toBeVisible({ timeout: 20_000 });

  const payload = request.postDataJSON() as Record<string, unknown>;
  expect(payload.to).toBe('support@shareconload.com');
  expect(typeof payload.subject).toBe('string');
  expect('html' in payload).toBe(false);
  expect(payload.body).toContain(`What I need to move: ${what}`);
  expect(payload.body).toContain(name);
  expect(String(payload.title)).toBe('New freight enquiry');
  await expect.poll(() => sent.length).toBe(1);
});

test('freight enquiry submission still succeeds if the email alert fails', async ({ page }) => {
  const name = marker();
  const sent = await stubEmail(page, 500);

  await page.goto(buildEnquiryContactUrl(`Boxes ${name}`, 'Johannesburg', 'Accra'));
  await fillAndSend(page, name, { phone: '+27 82 000 0000' });
  await expect(page.getByText('Message Received!')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => sent.length).toBeGreaterThan(0);
  expect(await rowsNamed(name)).toHaveLength(1);
});

test('other subjects send no alert email', async ({ page }) => {
  const name = marker();
  const sent = await stubEmail(page);
  await page.goto('/contact');
  await page.locator('select[name="subject"]').selectOption('General Inquiry');
  await page.locator('textarea[name="message"]').fill(`hello ${name}`);
  await fillAndSend(page, name);
  await expect(page.getByText('Message Received!')).toBeVisible({ timeout: 20_000 });
  expect(await rowsNamed(name)).toHaveLength(1);
  expect(sent).toHaveLength(0);
});

test('admin sees submissions newest first at /admin/contact; customer is redirected', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const older = marker();
  const newer = marker();
  const admin = await newUser('admin');
  const customer = await newUser('customer');

  const base = { email: 'front-door-test@example.invalid', country: 'Ghana', subject: 'Freight enquiry', message: 'seeded' };
  const { error } = await adminClient().from('contact_submissions').insert([
    { ...base, name: older, created_at: '2031-01-01T00:00:00Z' },
    { ...base, name: newer, created_at: '2031-01-02T00:00:00Z' },
  ]);
  expect(error).toBeNull();

  await signInBrowser(page, admin);
  await page.goto('/admin/contact');
  const rows = page.getByTestId('contact-row');
  await expect(rows.filter({ hasText: newer })).toHaveCount(1, { timeout: 20_000 });
  const texts = await rows.allTextContents();
  const iNewer = texts.findIndex((t) => t.includes(newer));
  const iOlder = texts.findIndex((t) => t.includes(older));
  expect(iNewer).toBeGreaterThanOrEqual(0);
  expect(iNewer).toBeLessThan(iOlder);

  const context = await browser.newContext();
  const customerPage = await context.newPage();
  try {
    await signInBrowser(customerPage, customer);
    await customerPage.goto('/admin/contact');
    await expect.poll(() => new URL(customerPage.url()).pathname, { timeout: 20_000 }).not.toBe('/admin/contact');
    await expect(customerPage.getByTestId('contact-row')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
