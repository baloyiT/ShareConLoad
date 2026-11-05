import { test, expect, Page } from '@playwright/test';
import { randomBytes } from 'crypto';
import { adminClient, createTestUser, deleteTestUser, signInBrowser, sweepTestUsers, TestUser } from './helpers/frontDoorUsers';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await sweepTestUsers();
});

const tag = randomBytes(4).toString('hex');
const users: TestUser[] = [];
let admin: TestUser;
let customer: TestUser;
const categoryIds: string[] = [];

async function approveDoc(opId: string, docType: string) {
  const { error } = await adminClient().from('compliance_documents').insert({
    operator_profile_id: opId, doc_type: docType, file_url: `front-door-test/${tag}/${docType}`, status: 'approved',
  });
  expect(error).toBeNull();
}

async function newOperator(entityType: 'company' | 'individual', name: string): Promise<TestUser> {
  const u = await createTestUser('operator', { entityType });
  users.push(u);
  const { error } = await adminClient().from('operator_profiles')
    .update({ legal_name: name }).eq('id', u.operatorProfileId ?? '');
  expect(error).toBeNull();
  return u;
}

async function auditRows(targetId: string, action: string) {
  const { data, error } = await adminClient().from('audit_logs')
    .select('action, metadata, actor_id').eq('target_id', targetId).eq('action', action);
  expect(error).toBeNull();
  return data ?? [];
}

async function opState(id: string) {
  const { data, error } = await adminClient().from('operator_profiles')
    .select('verification_level, participation_status, trading_name').eq('id', id).single();
  expect(error).toBeNull();
  return data as { verification_level: string; participation_status: string; trading_name: string | null };
}

// The page lists every operator, so find ours by its unique legal name.
function card(page: Page, name: string) {
  return page.locator('[data-testid="operator-directory-panel"]').filter({ hasText: name });
}

test.describe('Front door: admin verification and taxonomy', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    admin = await createTestUser('customer');
    users.push(admin);
    const { error } = await adminClient().from('profiles').update({ is_admin: true }).eq('id', admin.profileId);
    expect(error).toBeNull();
    customer = await createTestUser('customer');
    users.push(customer);
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    const db = adminClient();
    for (const u of users) {
      const ids = [u.operatorProfileId, u.id].filter(Boolean) as string[];
      await db.from('audit_logs').delete().in('target_id', ids);
      await db.from('audit_logs').delete().eq('actor_id', u.id);
    }
    if (categoryIds.length) await db.from('service_categories').delete().in('id', categoryIds);
    await db.from('service_categories').delete().like('slug', `front-door-test-${tag}%`);
    for (const u of users) await deleteTestUser(u).catch((e) => console.error('cleanup', e));
  });

  test('admin verifies a company as Business verified, and an audit row is written', async ({ page }) => {
    const name = `Verify Co ${tag}`;
    const op = await newOperator('company', name);
    await approveDoc(op.operatorProfileId ?? '', 'identity');
    await approveDoc(op.operatorProfileId ?? '', 'business_registration');
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c).toBeVisible();
    await expect(c.getByRole('button', { name: 'Verify as Identity verified' })).toHaveCount(0);
    await c.getByRole('button', { name: 'Verify as Business verified' }).click();
    await expect(c.getByTestId('verification-badge')).toHaveText('Business verified');
    expect((await opState(op.operatorProfileId ?? '')).verification_level).toBe('business_verified');
    const rows = await auditRows(op.operatorProfileId ?? '', 'operator_verified');
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(admin.id);
    expect(rows[0].metadata).toMatchObject({ verification_level: 'business_verified', previous: 'registered' });
  });

  test('Verify offers only Identity verified for an individual, and says why when documents are missing', async ({ page }) => {
    const okName = `Verify Person ${tag}`;
    const noDocsName = `No Docs Co ${tag}`;
    const person = await newOperator('individual', okName);
    await approveDoc(person.operatorProfileId ?? '', 'identity');
    const bare = await newOperator('company', noDocsName);
    // Only identity: a company needs business registration too.
    await approveDoc(bare.operatorProfileId ?? '', 'identity');
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const p = card(page, okName);
    await expect(p.getByRole('button', { name: 'Verify as Identity verified' })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Verify as Business verified' })).toHaveCount(0);
    const b = card(page, noDocsName);
    await expect(b).toBeVisible();
    await expect(b.getByRole('button', { name: /^Verify as/ })).toHaveCount(0);
    await expect(b.getByText(/business_registration/)).toBeVisible();
    expect((await opState(bare.operatorProfileId ?? '')).verification_level).toBe('registered');
  });

  test('admin activates and suspends an operator, each audited, and suspending removes it from the directory', async ({ page }) => {
    const name = `Suspend Co ${tag}`;
    const op = await newOperator('company', name);
    const id = op.operatorProfileId ?? '';
    const db = adminClient();
    const { data: svc } = await db.from('service_categories').select('id').eq('slug', 'sea-freight').single();
    const FROM = `Fromland ${tag}`;
    const TO = `Toland ${tag}`;
    // Listed the way the directory data spec does it: set the columns, not the terms hold.
    const { error } = await db.from('operator_profiles').update({
      verification_level: 'business_verified',
      participation_terms_accepted_at: new Date().toISOString(),
      participation_terms_version: 'test',
      trading_name: `Suspendable ${tag}`,
    }).eq('id', id);
    expect(error).toBeNull();
    expect((await db.from('operator_services').insert({ operator_profile_id: id, service_category_id: svc?.id })).error).toBeNull();
    expect((await db.from('operator_coverage').insert({ operator_profile_id: id, origin_country: FROM, destination_country: TO })).error).toBeNull();

    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c.getByRole('button', { name: 'Activate' })).toBeVisible();
    await c.getByRole('button', { name: 'Activate' }).click();
    await expect(c.getByRole('button', { name: 'Suspend' })).toBeVisible();
    expect((await opState(id)).participation_status).toBe('active');
    expect(await auditRows(id, 'operator_activated')).toHaveLength(1);

    const listed = async () => {
      const { data, error: e } = await db.rpc('search_directory', { p_origin_country: FROM, p_destination_country: TO });
      expect(e).toBeNull();
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    };
    expect(await listed()).toContain(id);

    // Suspend asks first; cancelling changes nothing.
    await c.getByRole('button', { name: 'Suspend' }).click();
    await expect(c.getByText(/removes .* from the directory immediately/i)).toBeVisible();
    expect((await opState(id)).participation_status).toBe('active');
    await c.getByRole('button', { name: 'Cancel' }).click();
    await expect(c.getByRole('button', { name: 'Suspend' })).toBeVisible();
    expect(await listed()).toContain(id);

    await c.getByRole('button', { name: 'Suspend' }).click();
    await c.getByRole('button', { name: 'Confirm suspend' }).click();
    await expect(c.getByRole('button', { name: 'Activate' })).toBeVisible();
    expect((await opState(id)).participation_status).toBe('suspended');
    expect(await auditRows(id, 'operator_suspended')).toHaveLength(1);
    expect(await listed()).not.toContain(id);
  });

  test('a failed audit write is reported to the admin', async ({ page }) => {
    const name = `Audit Fail Co ${tag}`;
    const op = await newOperator('company', name);
    const id = op.operatorProfileId ?? '';
    await approveDoc(id, 'identity');
    await approveDoc(id, 'business_registration');
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c).toBeVisible();
    await page.route('**/rest/v1/audit_logs*', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
        : route.continue());
    await c.getByRole('button', { name: 'Verify as Business verified' }).click();
    await expect(page.getByText('Saved, but the audit record failed. Tell support.')).toBeVisible();
    expect((await opState(id)).verification_level).toBe('business_verified');
    expect(await auditRows(id, 'operator_verified')).toHaveLength(0);
  });

  test('an update that changes no rows is a failure: no audit row, no local change', async ({ page }) => {
    const name = `Zero Row Co ${tag}`;
    const op = await newOperator('company', name);
    const id = op.operatorProfileId ?? '';
    await approveDoc(id, 'identity');
    await approveDoc(id, 'business_registration');
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c).toBeVisible();
    // Pretend the database matched no rows.
    await page.route('**/rest/v1/operator_profiles*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        : route.continue());

    await c.getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByText('Could not change this operator.')).toBeVisible();
    await expect(c.getByRole('button', { name: 'Activate' })).toBeVisible();

    await c.getByRole('button', { name: 'Verify as Business verified' }).click();
    await expect(page.getByText('Could not verify this operator.')).toBeVisible();
    await expect(c.getByTestId('verification-badge')).toHaveText('Registered');

    await c.getByLabel('Trading name').fill(`Zero Row ${tag}`);
    await c.getByRole('button', { name: 'Save trading name' }).click();
    await expect(page.getByText('Could not save the trading name.')).toBeVisible();
    await expect(c.getByText('Trading name saved')).toHaveCount(0);

    for (const action of ['operator_activated', 'operator_verified', 'operator_trading_name_changed']) {
      expect(await auditRows(id, action)).toHaveLength(0);
    }
  });

  test('a document rejected after the page loaded stops the verification', async ({ page }) => {
    const name = `Rejected Later Co ${tag}`;
    const op = await newOperator('company', name);
    const id = op.operatorProfileId ?? '';
    await approveDoc(id, 'identity');
    await approveDoc(id, 'business_registration');
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c.getByRole('button', { name: 'Verify as Business verified' })).toBeVisible();
    const { error } = await adminClient().from('compliance_documents')
      .update({ status: 'rejected' }).eq('operator_profile_id', id).eq('doc_type', 'business_registration');
    expect(error).toBeNull();
    await c.getByRole('button', { name: 'Verify as Business verified' }).click();
    await expect(page.getByText(/documents are no longer approved/i)).toBeVisible();
    expect((await opState(id)).verification_level).toBe('registered');
    expect(await auditRows(id, 'operator_verified')).toHaveLength(0);
  });

  test('Verify is not offered as a downgrade', async ({ page }) => {
    const name = `Already Business Person ${tag}`;
    const op = await newOperator('individual', name);
    const id = op.operatorProfileId ?? '';
    await approveDoc(id, 'identity');
    await adminClient().from('operator_profiles').update({ verification_level: 'business_verified' }).eq('id', id);
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c.getByTestId('verification-badge')).toHaveText('Business verified');
    await expect(c.getByRole('button', { name: /^Verify as/ })).toHaveCount(0);
  });

  test('admin edits a trading name, audited with old and new values, and sees why an operator is not listed', async ({ page }) => {
    const name = `Trading Person ${tag}`;
    const op = await newOperator('individual', name);
    const id = op.operatorProfileId ?? '';
    await adminClient().from('operator_profiles')
      .update({ verification_level: 'identity_verified', participation_status: 'active' }).eq('id', id);
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    const c = card(page, name);
    await expect(c.getByText(/trading name is blank/i)).toBeVisible();
    await expect(c.getByText(/no services/i)).toBeVisible();
    await expect(c.getByText(/no coverage/i)).toBeVisible();
    await expect(c.getByText(/terms not accepted/i)).toBeVisible();

    const input = c.getByLabel('Trading name');
    await input.fill(`  Swift Haulage ${tag}  `);
    await c.getByRole('button', { name: 'Save trading name' }).click();
    await expect(c.getByText('Trading name saved')).toBeVisible();
    expect((await opState(id)).trading_name).toBe(`Swift Haulage ${tag}`);
    const first = await auditRows(id, 'operator_trading_name_changed');
    expect(first).toHaveLength(1);
    expect(first[0].metadata).toMatchObject({ old: null, new: `Swift Haulage ${tag}` });
    await expect(c.getByText(/trading name is blank/i)).toHaveCount(0);

    await input.fill(`Swift Freight ${tag}`);
    await c.getByRole('button', { name: 'Save trading name' }).click();
    await expect(c.getByText('Trading name saved')).toBeVisible();
    const all = await auditRows(id, 'operator_trading_name_changed');
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.metadata)).toContainEqual({ old: `Swift Haulage ${tag}`, new: `Swift Freight ${tag}` });
  });

  test('page says plainly that no operator can be listed while terms acceptance is on hold', async ({ page }) => {
    const { data } = await adminClient().from('participation_terms').select('open_for_acceptance').eq('is_current', true);
    test.skip((data ?? []).some((t) => t.open_for_acceptance === true), 'Terms are open for acceptance.');
    await signInBrowser(page, admin);
    await page.goto('/admin/operators');
    await expect(page.getByText(/no operator can be listed until the participation terms are approved/i)).toBeVisible();
  });

  test('admin adds, renames and deactivates a service category without losing operator choices', async ({ page }) => {
    const name = `Front Door Test ${tag} Cat`;
    const renamed = `Front Door Test ${tag} Renamed`;
    const op = await newOperator('company', `Taxonomy Co ${tag}`);
    await signInBrowser(page, admin);
    await page.goto('/admin/taxonomy');
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Slug').fill(`front-door-test-${tag}`);
    await page.getByRole('button', { name: 'Add category' }).click();
    const row = page.locator('[data-testid="category-row"]').filter({ hasText: `front-door-test-${tag}` });
    await expect(row).toBeVisible();
    const db = adminClient();
    const { data: cat } = await db.from('service_categories').select('id, is_active').eq('slug', `front-door-test-${tag}`).single();
    categoryIds.push(cat?.id as string);
    expect(cat?.is_active).toBe(true);

    await row.getByRole('button', { name: 'Rename' }).click();
    await row.getByLabel('Category name').fill(renamed);
    await row.getByRole('button', { name: 'Save' }).click();
    const row2 = row;
    await expect(row2).toContainText(renamed);
    await expect(row2).toBeVisible();
    expect((await db.from('service_categories').select('name').eq('id', cat?.id).single()).data?.name).toBe(renamed);

    // An operator holds this category, then it is deactivated.
    expect((await db.from('operator_services').insert({ operator_profile_id: op.operatorProfileId, service_category_id: cat?.id })).error).toBeNull();
    await row2.getByRole('button', { name: 'Deactivate' }).click();
    await expect(row2.getByRole('button', { name: 'Activate', exact: true })).toBeVisible();
    expect((await db.from('service_categories').select('is_active').eq('id', cat?.id).single()).data?.is_active).toBe(false);
    // Hidden from an operator's choices, but their row is kept.
    const visible = await op.client.from('service_categories').select('id').eq('id', cat?.id);
    expect(visible.data ?? []).toHaveLength(0);
    const kept = await db.from('operator_services').select('id').eq('operator_profile_id', op.operatorProfileId).eq('service_category_id', cat?.id);
    expect(kept.data ?? []).toHaveLength(1);
  });

  // The page itself is guarded only by the admin layout (a UI redirect). The real control is the
  // service_categories policy, so this checks both: the redirect, and a direct API write by the same user.
  test('non-admin cannot open /admin/taxonomy, and cannot write categories through the API', async ({ page }) => {
    const db = adminClient();
    const slug = `front-door-test-${tag}-guard`;
    const { data: cat, error: seedErr } = await db.from('service_categories')
      .insert({ name: `Front Door Test ${tag} Guard`, slug }).select('id').single();
    expect(seedErr).toBeNull();
    categoryIds.push(cat?.id as string);

    const insert = await customer.client.from('service_categories')
      .insert({ name: 'Nope', slug: `${slug}-2` });
    expect(insert.error).not.toBeNull();
    const update = await customer.client.from('service_categories')
      .update({ name: 'Hijacked' }).eq('id', cat?.id).select('id');
    expect(update.data ?? []).toHaveLength(0);
    const del = await customer.client.from('service_categories').delete().eq('id', cat?.id).select('id');
    expect(del.data ?? []).toHaveLength(0);
    const { data: after } = await db.from('service_categories').select('name').eq('id', cat?.id).single();
    expect(after?.name).toBe(`Front Door Test ${tag} Guard`);

    await signInBrowser(page, customer);
    await page.goto('/admin/taxonomy');
    await page.waitForURL((u) => !u.pathname.startsWith('/admin'), { timeout: 15_000 });
    await expect(page.getByLabel('Slug')).toHaveCount(0);
  });
});
