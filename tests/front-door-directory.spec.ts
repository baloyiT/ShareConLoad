import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'crypto';
import { adminClient, createTestUser, deleteTestUser, type TestUser } from './helpers/frontDoorUsers';

const tag = randomBytes(4).toString('hex');
const FROM = `Fromland ${tag}`;
const TO = `Toland ${tag}`;
const NONE_FROM = `Nowhereland ${tag}`;
const PHONE = '+27 11 555 0100';
const EMAIL = `directory-page-${tag}@example.invalid`;
const COMPANY = `Directory Page Co ${tag}`;
const INDIVIDUAL_TRADING = `Solo Mover ${tag}`;
const BARE = `Bare Operator ${tag}`;
const LONG_NAME = `Averyveryverylongoperatorname${'x'.repeat(60)} ${tag}`;
const NOT_FOUND = /operator not found/i;
const PROMPT = "Tell us what you're moving and we'll help";

let company: TestUser;
let individual: TestUser;
let bare: TestUser;
let longName: TestUser;
let suspended: TestUser;
let sa: TestUser;
const users: TestUser[] = [];
// An inactive category lists nowhere, so an operator with only this one shows services: [].
const HIDDEN_SLUG = `fd-test-hidden-${tag}`;

async function seed(
  user: TestUser,
  fields: Record<string, unknown>,
  coverage: { origin_country: string; destination_country: string }[],
  serviceSlug: string | null = 'sea-freight',
) {
  const admin = adminClient();
  const id = user.operatorProfileId ?? '';
  const { error } = await admin.from('operator_profiles').update({
    public_description: 'We move freight.',
    public_phone: PHONE,
    public_email: EMAIL,
    verification_level: 'business_verified',
    participation_status: 'active',
    participation_terms_accepted_at: new Date().toISOString(),
    participation_terms_version: 'test',
    ...fields,
  }).eq('id', id);
  expect(error).toBeNull();
  if (serviceSlug) {
    const { data: svc } = await admin.from('service_categories').select('id').eq('slug', serviceSlug).single();
    const { error: svcErr } = await admin.from('operator_services')
      .insert({ operator_profile_id: id, service_category_id: svc?.id });
    expect(svcErr).toBeNull();
  }
  const { error: covErr } = await admin.from('operator_coverage')
    .insert(coverage.map(c => ({ ...c, operator_profile_id: id })));
  expect(covErr).toBeNull();
}

async function newOperator(entityType: 'company' | 'individual'): Promise<TestUser> {
  const user = await createTestUser('operator', { entityType });
  users.push(user);
  return user;
}

const route = `fromCountry=${encodeURIComponent(FROM)}&toCountry=${encodeURIComponent(TO)}`;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Front door: public directory pages', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    try {
      company = await newOperator('company');
      individual = await newOperator('individual');
      bare = await newOperator('company');
      longName = await newOperator('company');
      suspended = await newOperator('company');
      sa = await newOperator('company');

      const r = [{ origin_country: FROM, destination_country: TO }];
      await seed(company, { legal_name: COMPANY }, r);
      await seed(individual, { legal_name: `Private Legal ${tag}`, trading_name: INDIVIDUAL_TRADING, verification_level: 'identity_verified' }, r);
          const { error: catErr } = await adminClient().from('service_categories')
        .insert({ name: `Hidden ${tag}`, slug: HIDDEN_SLUG, is_active: false, sort_order: 999 });
      expect(catErr).toBeNull();
      await seed(bare, { legal_name: BARE, public_phone: null, public_email: null, public_description: null }, r, HIDDEN_SLUG);
      await seed(longName, { legal_name: LONG_NAME }, r);
      await seed(suspended, { legal_name: `Suspended ${tag}`, participation_status: 'suspended' }, r);
      await seed(sa, { legal_name: `SA Ghana ${tag}` }, [{ origin_country: 'South Africa', destination_country: 'Ghana' }]);
    } catch (err) {
      await cleanup();
      throw err;
    }
  });

  async function cleanup() {
    for (const u of users.splice(0)) {
      try {
        await adminClient().from('operator_contact_views').delete().eq('operator_profile_id', u.operatorProfileId ?? '');
        await deleteTestUser(u);
      } catch (err) {
        console.error('cleanup failed', u.email, err);
      }
    }
    const { error } = await adminClient().from('service_categories').delete().eq('slug', HIDDEN_SLUG);
    if (error) console.error('category cleanup failed', error.message);
  }

  test.afterAll(async () => {
    test.setTimeout(240_000);
    await cleanup();
  });

  test('anon can search and open a listed operator', async ({ page }) => {
    const bodies: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/rpc/search_directory')) bodies.push(req.postData() ?? '');
    });

    await page.goto('/directory');
    await page.getByLabel('Service', { exact: true }).selectOption({ label: 'Sea freight' });
    await page.getByLabel('From', { exact: true }).fill('Johannesburg');
    await page.getByRole('option', { name: /Johannesburg/ }).first().click();
    await page.getByLabel('To', { exact: true }).fill('Accra');
    await page.getByRole('option', { name: /Accra/ }).first().click();

    await expect(page.getByRole('heading', { name: `SA Ghana ${tag}` })).toBeVisible();
    // The selected city and country are sent apart, never the typed "City, Country" text.
    await expect.poll(() => JSON.parse(bodies[bodies.length - 1] || '{}')).toEqual({
      p_service: 'sea-freight',
      p_origin_city: 'Johannesburg', p_origin_country: 'South Africa',
      p_destination_city: 'Accra', p_destination_country: 'Ghana',
    });

    await page.getByRole('link', { name: `SA Ghana ${tag}` }).click();
    await expect(page).toHaveURL(/\/directory\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { name: `SA Ghana ${tag}` })).toBeVisible();
    await expect(page.getByText('We move freight.')).toBeVisible();
    await expect(page.getByText('Sea freight', { exact: true })).toBeVisible();
  });

  test('card and profile show the exact verification label', async ({ page }) => {
    await page.goto(`/directory?${route}`);
    const business = page.getByRole('article').filter({ hasText: COMPANY });
    await expect(business.getByText('Business verified', { exact: true })).toBeVisible();
    const solo = page.getByRole('article').filter({ hasText: INDIVIDUAL_TRADING });
    await expect(solo.getByText('Identity verified', { exact: true })).toBeVisible();
    await expect(page.getByText(`Private Legal ${tag}`)).toHaveCount(0);
    await expect(business.getByRole('link', { name: 'Business verified' })).toHaveAttribute('href', '/operator-verification');

    await page.goto(`/directory/${company.operatorProfileId}`);
    await expect(page.getByText('Business verified', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /what this means/i })).toHaveAttribute('href', '/operator-verification');
    await page.goto(`/directory/${individual.operatorProfileId}`);
    await expect(page.getByText('Identity verified', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: INDIVIDUAL_TRADING })).toBeVisible();
    await expect(page.getByText(`Private Legal ${tag}`)).toHaveCount(0);
  });

  test('no phone or email in the page until Contact this operator is clicked', async ({ page }) => {
    let contactCalls = 0;
    page.on('request', req => { if (req.url().includes('/rpc/get_operator_contact')) contactCalls++; });

    await page.goto(`/directory?${route}`);
    await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible();
    await page.goto(`/directory/${company.operatorProfileId}`);
    await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(PHONE);
    expect(html).not.toContain(EMAIL);
    expect(contactCalls).toBe(0);

    await page.getByRole('button', { name: 'Contact this operator' }).click();
    await expect(page.getByRole('link', { name: PHONE })).toHaveAttribute('href', /^tel:/);
    await expect(page.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);
    expect(contactCalls).toBe(1);
  });

  test('a listed operator with no services, phone or email still shows a clear page', async ({ page }) => {
    await page.goto(`/directory/${bare.operatorProfileId}`);
    await expect(page.getByRole('heading', { name: BARE })).toBeVisible();
    await expect(page.getByText('No services listed yet')).toBeVisible();
    await page.getByRole('button', { name: 'Contact this operator' }).click();
    await expect(page.getByText(/has not shared/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /enquiry/i })).toHaveAttribute('href', /^\/contact\?/);

    await page.goto(`/directory?${route}`);
    await expect(page.getByRole('article').filter({ hasText: BARE })).toBeVisible();
  });

  test('no results shows "Tell us what you\'re moving and we\'ll help"', async ({ page }) => {
    await page.goto(`/directory?fromCountry=${encodeURIComponent(NONE_FROM)}&toCountry=${encodeURIComponent(TO)}`);
    const link = page.getByRole('link', { name: PROMPT });
    await expect(link).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
    const href = (await link.getAttribute('href')) ?? '';
    expect(href.startsWith('/contact?')).toBe(true);
    const params = new URL(href, 'http://x').searchParams;
    expect(params.get('subject')).toBe('Freight enquiry');
    expect(params.get('message')).toContain(`From: ${NONE_FROM}`);
    expect(params.get('message')).toContain(`To: ${TO}`);
    await link.click();
    await expect(page).toHaveURL(/\/contact\?/);
  });

  test('empty directory shows the prompt and no sample operators', async ({ page }) => {
    await page.route('**/rest/v1/rpc/search_directory*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/directory');
    await expect(page.getByRole('link', { name: PROMPT })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByText(/\b\d+ (operators?|results?)\b/i)).toHaveCount(0);
    await expect(page.getByText(/no operators are listed yet/i)).toBeVisible();
    // Nav and footer are on the page.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByText('Independent operators deliver the freight and are responsible for it. ShareConLoad connects you.')).toBeVisible();
  });

  test('unknown or suspended operator id shows a friendly not found', async ({ page }) => {
    for (const id of [suspended.operatorProfileId, '00000000-0000-4000-8000-000000000000', 'not-a-real-id']) {
      await page.goto(`/directory/${id}`);
      await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Contact this operator' })).toHaveCount(0);
      const html = await page.content();
      expect(html).not.toContain(PHONE);
      expect(html).not.toContain(EMAIL);
      await expect(page.getByRole('link', { name: 'Back to the directory' })).toHaveAttribute('href', '/directory');
    }
    await page.goto(`/directory?${route}`);
    await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible();
    await expect(page.getByText(`Suspended ${tag}`)).toHaveCount(0);
  });

  test('filter state survives opening a profile and going back', async ({ page }) => {
    await page.goto(`/directory?service=sea-freight&mode=sea&${route}`);
    await expect(page.getByLabel('Service', { exact: true })).toHaveValue('sea-freight');
    await expect(page.getByLabel('Mode', { exact: true })).toHaveValue('sea');
    await page.getByRole('link', { name: COMPANY }).click();
    await expect(page).toHaveURL(/\/directory\/[0-9a-f-]{36}/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`service=sea-freight.*mode=sea|mode=sea.*service=sea-freight`));
    expect(page.url()).toContain(`fromCountry=${encodeURIComponent(FROM)}`);
    await expect(page.getByLabel('Service', { exact: true })).toHaveValue('sea-freight');
    await expect(page.getByLabel('Mode', { exact: true })).toHaveValue('sea');
    await expect(page.getByLabel('From', { exact: true })).toHaveValue(FROM);
    await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible();
  });

  test('375px wide: no horizontal scroll with results, a long name, profile or empty state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/directory?${route}`);
    await expect(page.getByRole('heading', { name: LONG_NAME })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`/directory/${longName.operatorProfileId}`);
    await expect(page.getByRole('heading', { name: LONG_NAME })).toBeVisible();
    await page.getByRole('button', { name: 'Contact this operator' }).click();
    await expect(page.getByRole('link', { name: EMAIL })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`/directory?fromCountry=${encodeURIComponent(NONE_FROM)}`);
    await expect(page.getByRole('link', { name: PROMPT })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
