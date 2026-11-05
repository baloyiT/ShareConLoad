import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { adminClient, createTestUser, deleteTestUser, signInBrowser, type TestUser } from './helpers/frontDoorUsers';
import {
  PARTICIPATION_TERMS_CLAUSES,
  PARTICIPATION_TERMS_TITLE,
  PARTICIPATION_TERMS_VERSION,
  participationTermsPlainText,
} from '../services/participationTerms';

test.setTimeout(120_000);

const users: TestUser[] = [];
const containerIds: string[] = [];

async function newUser(...args: Parameters<typeof createTestUser>): Promise<TestUser> {
  const user = await createTestUser(...args);
  users.push(user);
  return user;
}

// Removes rows even after a partial failure. Containers go first: nothing else references them here.
test.afterAll(async () => {
  test.setTimeout(180_000);
  const admin = adminClient();
  if (containerIds.length > 0) {
    const { error } = await admin.from('containers').delete().in('id', containerIds);
    if (error) console.error('container cleanup failed', error.message);
  }
  for (const u of users) {
    try { await deleteTestUser(u); } catch (err) { console.error('cleanup failed', u.email, err); }
  }
});

async function seedContainer(user: TestUser): Promise<void> {
  const { data, error } = await adminClient().from('containers').insert({
    operator_id: user.id,
    origin_country: 'South Africa', origin_city: 'Durban',
    destination_country: 'Ghana', destination_city: 'Tema',
    departure_date: '2030-01-01',
    total_capacity_cbm: 10, available_capacity_cbm: 10,
    load_type: 'LCL', price_per_cbm: 100, currency_code: 'USD', status: 'open',
  }).select('id').single();
  expect(error).toBeNull();
  containerIds.push(data!.id as string);
}

// Opens the live terms for one test only, and always closes them again.
async function withTermsOpen(fn: () => Promise<void>): Promise<void> {
  const admin = adminClient();
  const setOpen = (open: boolean) => admin.from('participation_terms')
    .update({ open_for_acceptance: open }).eq('version', PARTICIPATION_TERMS_VERSION);
  try {
    expect((await setOpen(true)).error).toBeNull();
    await fn();
  } finally {
    const { error } = await setOpen(false);
    if (error) console.error('COULD NOT CLOSE THE TERMS', error.message);
  }
  const { data } = await admin.from('participation_terms')
    .select('open_for_acceptance').eq('version', PARTICIPATION_TERMS_VERSION).single();
  expect(data?.open_for_acceptance).toBe(false);
}

const sidebar = (page: Page) => page.locator('aside').first();

const hrefsOn = (page: Page) =>
  page.locator('a[href]').evaluateAll(links => links.map(a => a.getAttribute('href') ?? ''));

const STAGE_3_LINK = /^\/(operator\/(create|bookings|payouts|bank)|container)|^\/operator$/;

async function openHub(page: Page): Promise<void> {
  await page.goto('/operator/compliance');
  await expect(page.getByText('steps complete')).toBeVisible({ timeout: 30_000 });
}

test('new operator sees five steps and no Account step', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await openHub(page);

  const main = page.locator('main');
  await expect(page.getByText('0 of 5 steps complete').or(page.getByText('1 of 5 steps complete'))).toBeVisible();
  const expected: [string, string][] = [
    ['Profile', '/operator/compliance/profile'],
    ['Contact', '/operator/compliance/contact'],
    ['Services & coverage', '/operator/services'],
    ['Documents', '/operator/compliance/documents'],
    ['Participation terms', '/operator/compliance/terms'],
  ];
  const menu = sidebar(page);
  for (const [label, href] of expected) {
    await expect(main.getByText(label, { exact: true })).toBeVisible();
    await expect(main.locator(`a[href="${href}"]`)).toHaveCount(1);
    await expect(menu.getByRole('link', { name: label })).toHaveAttribute('href', href);
  }
  await expect(menu.getByRole('link', { name: 'Account' })).toHaveCount(0);
  await expect(main.getByText('Bank Account')).toHaveCount(0);
  await expect(page.getByText('Service Agreement')).toHaveCount(0);

  // The stepper on each step shows the same five.
  await page.goto('/operator/compliance/contact');
  await expect(page.locator('main a[href="/operator/services"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('main a[href="/operator/compliance/terms"]')).toHaveCount(1);
  await expect(page.locator('main a[href="/operator/bank"]')).toHaveCount(0);
  await expect(page.locator('main a[href="/operator/compliance/agreement"]')).toHaveCount(0);
});

test('new operator menu has no containers, bookings or payouts', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);

  for (const route of ['/operator/compliance', '/operator/compliance/profile', '/operator/compliance/contact',
    '/operator/compliance/documents', '/operator/compliance/terms']) {
    await page.goto(route);
    await expect(sidebar(page).getByRole('link', { name: 'Documents' })).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    expect((await hrefsOn(page)).filter(h => STAGE_3_LINK.test(h)), route).toEqual([]);
    await expect(sidebar(page).getByText('My Containers')).toHaveCount(0);
    await expect(sidebar(page).getByText('Manage Bookings')).toHaveCount(0);
    await expect(sidebar(page).getByText('Payout History')).toHaveCount(0);
  }
});

test('operator with containers still sees those items and the bank page', async ({ page }) => {
  const user = await newUser('operator');
  await seedContainer(user);
  await signInBrowser(page, user);

  await page.goto('/operator');
  await expect(page.getByRole('heading', { name: 'My Containers' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: '+ Create Container' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/operator');

  const menu = sidebar(page);
  await expect(menu.getByRole('link', { name: 'My Containers' })).toHaveAttribute('href', '/operator');
  await expect(menu.getByRole('link', { name: 'Create Container' })).toHaveAttribute('href', '/operator/create');
  await expect(menu.getByRole('link', { name: 'Manage Bookings' })).toHaveAttribute('href', '/operator/bookings');
  await expect(menu.getByRole('link', { name: 'Payout History' })).toHaveAttribute('href', '/operator/payouts');
  await expect(menu.locator('a[href="/operator/bank"]')).toHaveCount(1);
  await expect(menu.locator('a[href="/operator/compliance/agreement"]')).toHaveCount(1);
  // They need these two to be listed.
  await expect(menu.locator('a[href="/operator/services"]')).toHaveCount(1);
  await expect(menu.locator('a[href="/operator/compliance/terms"]')).toHaveCount(1);

  // Full document list, and the old next step, are unchanged for them.
  await page.goto('/operator/compliance/documents');
  await expect(page.getByText('Tax Clearance Certificate')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Banking Confirmation')).toBeVisible();

  await page.goto('/operator/bank');
  await page.waitForLoadState('networkidle');
  expect(new URL(page.url()).pathname).toBe('/operator/bank');
});

test('documents page asks a company for two documents and an individual for one', async ({ page }) => {
  const company = await newUser('operator', { entityType: 'company' });
  await signInBrowser(page, company);
  await page.goto('/operator/compliance/documents');
  await expect(page.getByText('0 of 2 required documents uploaded')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Upload document' })).toHaveCount(2);
  await expect(page.getByText('Proof of Identity')).toBeVisible();
  await expect(page.getByText('Business Registration')).toBeVisible();
  for (const hidden of ['Tax Clearance', 'Banking Confirmation', 'Proof of Business Address', 'Cargo Insurance', 'Freight Forwarding']) {
    await expect(page.getByText(hidden)).toHaveCount(0);
  }

  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  const individual = await newUser('operator', { entityType: 'individual' });
  await signInBrowser(page, individual);
  await page.goto('/operator/compliance/documents');
  await expect(page.getByText('0 of 1 required documents uploaded')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Upload document' })).toHaveCount(1);
  await expect(page.getByText('Proof of Identity')).toBeVisible();
  await expect(page.getByText('Business Registration')).toHaveCount(0);
});

test('documents step goes on to the participation terms when the list is complete', async ({ page }) => {
  const user = await newUser('operator', { entityType: 'individual' });
  const { error } = await adminClient().from('compliance_documents').insert({
    operator_profile_id: user.operatorProfileId, doc_type: 'identity',
    file_url: `${user.operatorProfileId}/identity.pdf`, status: 'under_review',
  });
  expect(error).toBeNull();
  await signInBrowser(page, user);
  await page.goto('/operator/compliance/documents');
  await expect(page.locator('main a[href="/operator/compliance/terms"]').last()).toContainText('Continue', { timeout: 30_000 });

  await openHub(page);
  await expect(sidebar(page).getByRole('link', { name: 'Documents' })).toHaveCSS('color', 'rgb(22, 163, 74)');
});

test('contact step labels public phone and email as shown in the directory', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/compliance/contact');

  const publicPhone = page.getByLabel('Public phone (shown in the directory)');
  const publicEmail = page.getByLabel('Public email (shown in the directory)');
  await expect(publicPhone).toBeVisible({ timeout: 30_000 });
  await expect(publicEmail).toBeVisible();
  await expect(page.getByText('never shown in the directory')).toBeVisible();

  await page.getByLabel('Phone Number').first().fill('+27 82 000 0001');
  await publicPhone.fill('+27 82 000 0002');
  await publicEmail.fill('desk@example.invalid');
  await page.getByRole('button', { name: /Save & Continue/ }).click();

  // Third step. /operator/services arrives in Task 9.
  await page.waitForURL(url => url.pathname === '/operator/services', { timeout: 30_000 });

  const { data } = await adminClient().from('operator_profiles')
    .select('phone_number, public_phone, public_email').eq('id', user.operatorProfileId!).single();
  expect(data).toEqual({
    phone_number: '+27 82 000 0001',
    public_phone: '+27 82 000 0002',
    public_email: 'desk@example.invalid',
  });
});

test('profile step: trading name is optional for a company, and the description saves', async ({ page }) => {
  const user = await newUser('operator', { entityType: 'company' });
  await signInBrowser(page, user);
  await page.goto('/operator/compliance/profile');

  await expect(page.getByLabel(/Trading name \(the name shown publicly in the directory\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('your registered company name is shown')).toBeVisible();
  await expect(page.getByText('legal name will be shown')).toHaveCount(0);
  await page.getByLabel('Registration Number').fill('2018/123456/07');
  await page.getByLabel('Public description (shown in the directory)').fill('Sea freight from Durban.');
  await page.getByRole('button', { name: /Save & Continue/ }).click();
  await page.waitForURL(url => url.pathname === '/operator/compliance/contact', { timeout: 30_000 });

  const { data } = await adminClient().from('operator_profiles')
    .select('public_description, registration_number').eq('id', user.operatorProfileId!).single();
  expect(data).toEqual({ public_description: 'Sea freight from Durban.', registration_number: '2018/123456/07' });
});

test('profile step: an individual must give a trading name', async ({ page }) => {
  const user = await newUser('operator', { entityType: 'individual' });
  const admin = adminClient();
  expect((await admin.from('operator_profiles').update({ id_number: '8001015009087' }).eq('id', user.operatorProfileId!)).error).toBeNull();
  await signInBrowser(page, user);

  await openHub(page);
  await expect(sidebar(page).getByRole('link', { name: 'Profile' })).not.toHaveCSS('color', 'rgb(22, 163, 74)');

  await page.goto('/operator/compliance/profile');
  await expect(page.getByText('Your legal name is not published')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Save & Continue/ }).click();
  await expect(page.getByText('Trading name is required.')).toBeVisible();

  await page.getByLabel(/Trading name/).fill('  Thabo Freight  ');
  await page.getByRole('button', { name: /Save & Continue/ }).click();
  await page.waitForURL(url => url.pathname === '/operator/compliance/contact', { timeout: 30_000 });
  const { data } = await admin.from('operator_profiles').select('trading_name').eq('id', user.operatorProfileId!).single();
  expect(data?.trading_name).toBe('Thabo Freight');
});

test('a verified operator can still save the profile, and locked fields are not sent', async ({ page }) => {
  // Nulls on purpose: the form fills id_type with a default, which the guard would refuse.
  const user = await newUser('operator', { entityType: 'individual' });
  const admin = adminClient();
  const { error } = await admin.from('operator_profiles')
    .update({ verification_level: 'identity_verified', id_number: ' 8001015009087', id_type: null })
    .eq('id', user.operatorProfileId!);
  expect(error).toBeNull();

  await signInBrowser(page, user);
  await page.goto('/operator/compliance/profile');
  const name = page.getByLabel(/Full Legal Name/);
  await expect(name).toBeDisabled({ timeout: 30_000 });
  await expect(page.getByLabel('Entity Type')).toBeDisabled();
  await expect(page.getByLabel(/ID Number/)).toBeDisabled();
  await expect(page.getByText('support@shareconload.com')).toBeVisible();

  const sent: string[] = [];
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/operator_profiles')) sent.push(req.postData() ?? '');
  });
  // No trading name yet, so a verified individual may still add one.
  await page.getByLabel(/Trading name/).fill('Road Runner Freight');
  await page.getByLabel('Public description (shown in the directory)').fill('Road freight.');
  await page.getByRole('button', { name: /Save & Continue/ }).click();
  await page.waitForURL(url => url.pathname === '/operator/compliance/contact', { timeout: 30_000 });

  expect(sent).toHaveLength(1);
  expect(Object.keys(JSON.parse(sent[0])).sort()).toEqual(['public_description', 'trading_name']);
  const { data } = await admin.from('operator_profiles')
    .select('public_description, trading_name, id_number, id_type').eq('id', user.operatorProfileId!).single();
  expect(data).toEqual({
    public_description: 'Road freight.', trading_name: 'Road Runner Freight', id_number: ' 8001015009087', id_type: null,
  });

  // Now it is set, it is fixed like the legal name.
  await page.goto('/operator/compliance/profile');
  await expect(page.getByLabel(/Trading name/)).toBeDisabled({ timeout: 30_000 });
  await page.getByLabel('Public description (shown in the directory)').fill('Road and rail freight.');
  await page.getByRole('button', { name: /Save & Continue/ }).click();
  await page.waitForURL(url => url.pathname === '/operator/compliance/contact', { timeout: 30_000 });
  expect(sent).toHaveLength(2);
  expect(Object.keys(JSON.parse(sent[1]))).toEqual(['public_description']);
});

test('/operator sends a new operator to /operator/compliance', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);

  const seenCreateLink: string[] = [];
  await page.goto('/operator');
  await page.waitForURL(url => url.pathname === '/operator/compliance', { timeout: 30_000 });
  seenCreateLink.push(...(await hrefsOn(page)).filter(h => h === '/operator/create'));
  expect(seenCreateLink).toEqual([]);
});

test('/onboarding/operator redirects to /for-operators while OPERATOR_SIGNUP_OPEN is false', async ({ page }) => {
  await page.goto('/onboarding/operator');
  await page.waitForURL(url => url.pathname === '/for-operators', { timeout: 30_000 });

  const customer = await newUser('customer');
  await signInBrowser(page, customer);
  await page.goto('/onboarding/operator');
  await page.waitForURL(url => url.pathname === '/for-operators', { timeout: 30_000 });
});

test('/onboarding/operator still sends an existing operator to their portal', async ({ page }) => {
  const user = await newUser('operator');
  await seedContainer(user);
  await signInBrowser(page, user);
  await page.goto('/onboarding/operator');
  await page.waitForURL(url => url.pathname === '/operator', { timeout: 30_000 });
});

test('terms page shows every clause, marked as a draft', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/compliance/terms');

  await expect(page.getByRole('heading', { name: PARTICIPATION_TERMS_TITLE })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Draft for review', { exact: false })).toBeVisible();
  await expect(page.getByText(`Version ${PARTICIPATION_TERMS_VERSION}`)).toBeVisible();
  for (const clause of PARTICIPATION_TERMS_CLAUSES) {
    await expect(page.getByText(clause.body)).toBeVisible();
  }
});

test('the terms name the trading name as public and promise no volumes', () => {
  const text = participationTermsPlainText();
  expect(text).toContain('the directory shows your trading name publicly');
  expect(text).toContain('A company with no trading name is shown under its registered name');
  expect(text).not.toContain('legal name');
  expect(text).toContain('does not guarantee');
  expect(text).toContain('90 days');
  const emails = text.match(/[\w.+-]+@[\w.-]+/g);
  expect(emails?.every(e => e.replace(/\.$/, '') === 'support@shareconload.com')).toBe(true);
});

test('migration _86 writes exactly participationTermsPlainText()', () => {
  const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261104_86_trading_name_and_terms_hold.sql'), 'utf-8');
  const literal = sql.match(/E'((?:[^'\\]|''|\\.)*)'/);
  expect(literal).not.toBeNull();
  const body = literal![1].replace(/''/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  expect(body).toBe(participationTermsPlainText());
  expect(sql).toContain(`'${PARTICIPATION_TERMS_VERSION}'`);
});

test('the current database terms match participationTermsPlainText() exactly', async () => {
  const { data, error } = await adminClient().from('participation_terms')
    .select('version, title, body').eq('is_current', true).maybeSingle();
  expect(error).toBeNull();
  expect(data).toEqual({
    version: PARTICIPATION_TERMS_VERSION,
    title: PARTICIPATION_TERMS_TITLE,
    body: participationTermsPlainText(),
  });
});

test('while the terms are not open, the page says so and nothing can be accepted', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);

  // An operator can read the flag under RLS.
  const { data, error } = await user.client.from('participation_terms')
    .select('open_for_acceptance').eq('is_current', true).single();
  expect(error).toBeNull();
  expect(data?.open_for_acceptance).toBe(false);

  await page.goto('/operator/compliance/terms');
  await expect(page.getByText('acceptance is not open yet')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Draft for review', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept terms' })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('main').getByText('Not open yet', { exact: true })).toBeVisible();
  await expect(sidebar(page).getByText('Not open yet', { exact: true })).toBeVisible();

  await openHub(page);
  await expect(page.locator('main').getByText('Not open yet', { exact: true })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'Read the draft' })).toHaveAttribute('href', '/operator/compliance/terms');
});

test('the hub tells an operator with only the terms left that they have finished for now', async ({ page }) => {
  const user = await newUser('operator', { entityType: 'individual' });
  const admin = adminClient();
  const id = user.operatorProfileId!;
  expect((await admin.from('operator_profiles').update({ trading_name: 'Test Trader', phone_number: '+27 82 000 0003' }).eq('id', id)).error).toBeNull();
  const { data: category } = await admin.from('service_categories').select('id').eq('slug', 'sea-freight').single();
  expect((await admin.from('operator_services').insert({ operator_profile_id: id, service_category_id: category?.id })).error).toBeNull();
  expect((await admin.from('operator_coverage').insert({ operator_profile_id: id, origin_country: 'South Africa', destination_country: 'Ghana' })).error).toBeNull();
  expect((await admin.from('compliance_documents').insert({
    operator_profile_id: id, doc_type: 'identity', file_url: `${id}/identity.pdf`, status: 'under_review',
  })).error).toBeNull();

  await signInBrowser(page, user);
  await openHub(page);
  await expect(page.getByText('4 of 5 steps complete')).toBeVisible();
  await expect(page.getByText('You have finished everything you can for now')).toBeVisible();
});

test('accepting terms records acceptance and leaves the Stage 3 gate false', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);

  await withTermsOpen(async () => {
    await page.goto('/operator/compliance/terms');
    const accept = page.getByRole('button', { name: 'Accept terms' });
    await expect(accept).toBeDisabled({ timeout: 30_000 });
    await page.getByRole('checkbox').check();
    await accept.click();
    await expect(page.getByText(`You accepted version ${PARTICIPATION_TERMS_VERSION}`)).toBeVisible({ timeout: 30_000 });
  });

  const admin = adminClient();
  const { data: op } = await admin.from('operator_profiles')
    .select('participation_terms_accepted_at, participation_terms_version, service_agreement_signed_at, status')
    .eq('id', user.operatorProfileId!).single();
  expect(op?.participation_terms_accepted_at).not.toBeNull();
  expect(op?.participation_terms_version).toBe(PARTICIPATION_TERMS_VERSION);
  expect(op?.service_agreement_signed_at).toBeNull();
  expect(op?.status).toBe('draft');

  const { data: rows } = await admin.from('agreement_acceptances')
    .select('agreement_type, version, agreement_text, pdf_path')
    .eq('operator_profile_id', user.operatorProfileId!);
  expect(rows).toEqual([{
    agreement_type: 'operator_participation_terms',
    version: PARTICIPATION_TERMS_VERSION,
    agreement_text: participationTermsPlainText(),
    pdf_path: null,
  }]);

  const { data: compliant, error } = await admin.rpc('operator_is_compliant', { op_id: user.operatorProfileId });
  expect(error).toBeNull();
  expect(compliant).toBe(false);

  // Reload: the page remembers, and the step shows complete.
  await page.reload();
  await expect(page.getByText(`You accepted version ${PARTICIPATION_TERMS_VERSION}`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Accept terms' })).toHaveCount(0);
  await expect(sidebar(page).getByRole('link', { name: 'Participation terms' })).toHaveCSS('color', 'rgb(22, 163, 74)');
});

test('a failed acceptance shows a plain message and records nothing', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.route('**/rest/v1/rpc/accept_participation_terms', route =>
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'This version is not the current terms' }) }));
  await withTermsOpen(async () => {
    await page.goto('/operator/compliance/terms');
    await page.getByRole('checkbox').check({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Accept terms' }).click();
    await expect(page.getByText('Could not record your acceptance')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('You accepted version')).toHaveCount(0);
  });
});

// ── Services & coverage step ────────────────────────────────────────────────

async function pickPlace(page: Page, id: string, query: string, option: string): Promise<void> {
  await page.locator(`#${id}`).fill(query);
  await page.getByRole('option', { name: option }).click();
}

async function addRoute(page: Page, from: string, to: string): Promise<void> {
  await pickPlace(page, 'coverage-origin', from.split(',')[0], from);
  await pickPlace(page, 'coverage-destination', to.split(',')[0], to);
  await page.getByRole('button', { name: 'Add route' }).click();
}

test('operator ticks a service and it persists after reload', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/services');

  const sea = page.getByLabel('Sea freight');
  await expect(sea).not.toBeChecked({ timeout: 30_000 });
  await sea.check();
  await expect(sea).toBeChecked();
  await expect.poll(async () => {
    const { data } = await adminClient().from('operator_services').select('id').eq('operator_profile_id', user.operatorProfileId!);
    return data?.length;
  }).toBe(1);

  await page.reload();
  await expect(page.getByLabel('Sea freight')).toBeChecked({ timeout: 30_000 });

  await page.getByLabel('Sea freight').uncheck();
  await expect.poll(async () => {
    const { data } = await adminClient().from('operator_services').select('id').eq('operator_profile_id', user.operatorProfileId!);
    return data?.length;
  }).toBe(0);
});

test('operator adds and removes a coverage row', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/services');
  await expect(page.getByText('No routes added yet.')).toBeVisible({ timeout: 30_000 });

  await addRoute(page, 'Durban, South Africa', 'Tema, Ghana');
  const rows = page.getByTestId('coverage-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Durban, South Africa');
  await expect(rows.first()).toContainText('Tema, Ghana');

  const { data } = await adminClient().from('operator_coverage')
    .select('origin_country, origin_city, destination_country, destination_city, transport_mode')
    .eq('operator_profile_id', user.operatorProfileId!);
  expect(data).toEqual([{
    origin_country: 'South Africa', origin_city: 'Durban',
    destination_country: 'Ghana', destination_city: 'Tema', transport_mode: null,
  }]);

  await rows.first().getByRole('button', { name: /Remove/ }).click();
  await expect(page.getByText('No routes added yet.')).toBeVisible();
  const { data: after } = await adminClient().from('operator_coverage').select('id').eq('operator_profile_id', user.operatorProfileId!);
  expect(after).toEqual([]);
});

test('a whole-country row saves a null city', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/services');
  await expect(page.getByText('No routes added yet.')).toBeVisible({ timeout: 30_000 });

  await pickPlace(page, 'coverage-origin', 'Durban', 'Durban, South Africa');
  await page.getByLabel('Cover the whole country').first().check();
  await pickPlace(page, 'coverage-destination', 'Tema', 'Tema, Ghana');
  await page.getByLabel('Transport mode').selectOption('sea');
  await page.getByRole('button', { name: 'Add route' }).click();
  await expect(page.getByTestId('coverage-row').first()).toContainText('All of South Africa');

  const { data } = await adminClient().from('operator_coverage')
    .select('origin_city, destination_city, transport_mode').eq('operator_profile_id', user.operatorProfileId!);
  expect(data).toEqual([{ origin_city: null, destination_city: 'Tema', transport_mode: 'sea' }]);
});

test('adding the same coverage twice shows a friendly message', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/services');
  await expect(page.getByText('No routes added yet.')).toBeVisible({ timeout: 30_000 });

  await addRoute(page, 'Durban, South Africa', 'Tema, Ghana');
  await expect(page.getByTestId('coverage-row')).toHaveCount(1);
  await addRoute(page, 'Durban, South Africa', 'Tema, Ghana');
  await expect(page.getByText('You have already added this route.')).toBeVisible();
  await expect(page.getByTestId('coverage-row')).toHaveCount(1);
  const { data } = await adminClient().from('operator_coverage').select('id').eq('operator_profile_id', user.operatorProfileId!);
  expect(data).toHaveLength(1);
});

test('the step shows complete with one service and one coverage row', async ({ page }) => {
  const user = await newUser('operator');
  await signInBrowser(page, user);
  await page.goto('/operator/services');
  await expect(page.getByLabel('Sea freight')).toBeVisible({ timeout: 30_000 });
  await expect(sidebar(page).getByRole('link', { name: 'Services & coverage' })).not.toHaveCSS('color', 'rgb(22, 163, 74)');

  await page.getByLabel('Sea freight').check();
  await expect(page.getByLabel('Sea freight')).toBeChecked();
  await addRoute(page, 'Durban, South Africa', 'Tema, Ghana');
  await expect(page.getByTestId('coverage-row')).toHaveCount(1);

  await openHub(page);
  await expect(sidebar(page).getByRole('link', { name: 'Services & coverage' })).toHaveCSS('color', 'rgb(22, 163, 74)');
});
