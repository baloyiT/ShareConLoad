import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { adminClient, createTestUser, deleteTestUser, TestUser } from './helpers/frontDoorUsers';
import { listingDocTypes, verificationLabel } from '../services/operatorCompliance';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const anon = () => createClient(SUPABASE_URL, SUPABASE_ANON);

// 42501 is what the guard triggers raise, and what RLS and a missing grant return.
const DENIED = '42501';

const users: TestUser[] = [];

async function newUser(...args: Parameters<typeof createTestUser>): Promise<TestUser> {
  const user = await createTestUser(...args);
  users.push(user);
  return user;
}

async function readOperator(id: string | undefined) {
  const { data, error } = await adminClient().from('operator_profiles')
    .select('legal_name, entity_type, verification_level, participation_status, participation_terms_accepted_at, participation_terms_version, service_agreement_signed_at, public_description')
    .eq('id', id ?? '')
    .single();
  expect(error).toBeNull();
  return data;
}

async function acceptanceCount(operatorProfileId: string | undefined): Promise<number> {
  const { data } = await adminClient().from('agreement_acceptances')
    .select('id').eq('operator_profile_id', operatorProfileId ?? '');
  return (data ?? []).length;
}

test.afterAll(async () => {
  test.setTimeout(120_000); // one delete per user, well past the default for the whole file
  for (const user of users.splice(0)) await deleteTestUser(user);
});

test.describe('Front door schema: taxonomy, services, coverage', () => {
  let operator: TestUser;
  let otherOperator: TestUser;

  test.beforeAll(async () => {
    operator = await createTestUser('operator');
    otherOperator = await createTestUser('operator');
  });

  test.afterAll(async () => {
    if (operator) await deleteTestUser(operator);
    if (otherOperator) await deleteTestUser(otherOperator);
  });

  test('anon reads active categories, including customs-clearing', async () => {
    const { data, error } = await anon().from('service_categories').select('slug');
    expect(error).toBeNull();
    expect(data?.map(c => c.slug)).toEqual(expect.arrayContaining([
      'sea-freight', 'air-freight', 'road-freight', 'rail-freight', 'forwarding',
      'customs-clearing', 'consolidation', 'warehousing', 'household-removals', 'oversized-cargo',
    ]));
  });

  test('anon cannot write categories', async () => {
    const { data, error } = await anon().from('service_categories')
      .insert({ name: 'Hack', slug: `hack-${Date.now()}` }).select();
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test('anon cannot read operator_coverage directly', async () => {
    const { data } = await anon().from('operator_coverage').select('*');
    expect(data ?? []).toHaveLength(0);
  });

  test('operator cannot add coverage for another operator', async () => {
    const { error } = await operator.client.from('operator_coverage').insert({
      operator_profile_id: otherOperator.operatorProfileId,
      origin_country: 'South Africa',
      destination_country: 'Ghana',
    });
    expect(error).not.toBeNull();
  });

  test('operator can add own coverage, and others cannot read it', async () => {
    const { error } = await operator.client.from('operator_coverage').insert({
      operator_profile_id: operator.operatorProfileId,
      origin_country: 'South Africa',
      destination_country: 'Ghana',
    });
    expect(error).toBeNull();
    const { data } = await otherOperator.client.from('operator_coverage').select('id');
    expect(data ?? []).toHaveLength(0);
  });
});

test.describe('Front door schema: operator listing status', () => {
  test('operator cannot set own verification_level', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ verification_level: 'business_verified' }).eq('id', op.operatorProfileId);
    expect(error?.code).toBe(DENIED);
    expect((await readOperator(op.operatorProfileId))?.verification_level).toBe('registered');
  });

  test('operator cannot set own participation_status', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ participation_status: 'active' }).eq('id', op.operatorProfileId);
    expect(error?.code).toBe(DENIED);
    expect((await readOperator(op.operatorProfileId))?.participation_status).toBe('pending');
  });

  test('operator cannot set participation_terms_accepted_at directly', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ participation_terms_accepted_at: new Date().toISOString() }).eq('id', op.operatorProfileId);
    expect(error?.code).toBe(DENIED);
    expect((await readOperator(op.operatorProfileId))?.participation_terms_accepted_at).toBeNull();
  });

  test('operator cannot set participation_terms_version directly', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ participation_terms_version: 'v1' }).eq('id', op.operatorProfileId);
    expect(error?.code).toBe(DENIED);
    expect((await readOperator(op.operatorProfileId))?.participation_terms_version).toBeNull();
  });

  test('a user cannot create their operator row already verified and active', async () => {
    const user = await newUser('customer');
    const { error } = await user.client.from('operator_profiles').insert({
      profile_id: user.profileId,
      legal_name: 'Front Door Test Operator',
      entity_type: 'company',
      country: 'South Africa',
      verification_level: 'business_verified',
      participation_status: 'active',
    });
    expect(error?.code).toBe(DENIED);
    const { data } = await adminClient().from('operator_profiles').select('id').eq('profile_id', user.profileId);
    expect(data ?? []).toHaveLength(0);
  });

  test('a user can still create a plain operator row', async () => {
    const user = await newUser('customer');
    const { error } = await user.client.from('operator_profiles').insert({
      profile_id: user.profileId,
      legal_name: 'Front Door Test Operator',
      entity_type: 'company',
      country: 'South Africa',
    });
    expect(error).toBeNull();
  });

  test('a non-protected column stays editable, and a registered operator can edit legal_name', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ public_description: 'We move freight.', legal_name: 'Renamed Test Operator' })
      .eq('id', op.operatorProfileId);
    expect(error).toBeNull();
    const row = await readOperator(op.operatorProfileId);
    expect(row?.public_description).toBe('We move freight.');
    expect(row?.legal_name).toBe('Renamed Test Operator');
  });

  test('a verified operator cannot change legal_name or entity_type, but can edit other columns', async () => {
    const op = await newUser('operator');
    await adminClient().from('operator_profiles')
      .update({ verification_level: 'business_verified' }).eq('id', op.operatorProfileId);

    const rename = await op.client.from('operator_profiles')
      .update({ legal_name: 'Someone Else Ltd' }).eq('id', op.operatorProfileId);
    expect(rename.error?.code).toBe(DENIED);

    const entity = await op.client.from('operator_profiles')
      .update({ entity_type: 'individual' }).eq('id', op.operatorProfileId);
    expect(entity.error?.code).toBe(DENIED);

    const unchanged = await op.client.from('operator_profiles')
      .update({ legal_name: 'Front Door Test Operator', public_description: 'Still editable.' })
      .eq('id', op.operatorProfileId);
    expect(unchanged.error).toBeNull();

    const row = await readOperator(op.operatorProfileId);
    expect(row?.legal_name).toBe('Front Door Test Operator');
    expect(row?.entity_type).toBe('company');
    expect(row?.public_description).toBe('Still editable.');
  });

  test('admin using the client can set the protected fields and rename a verified operator', async () => {
    const op = await newUser('operator');
    const admin = await newUser('admin');
    const { error } = await admin.client.from('operator_profiles')
      .update({ verification_level: 'identity_verified', participation_status: 'active' })
      .eq('id', op.operatorProfileId);
    expect(error).toBeNull();
    const rename = await admin.client.from('operator_profiles')
      .update({ legal_name: 'Corrected Test Operator' }).eq('id', op.operatorProfileId);
    expect(rename.error).toBeNull();
    const row = await readOperator(op.operatorProfileId);
    expect(row?.verification_level).toBe('identity_verified');
    expect(row?.participation_status).toBe('active');
    expect(row?.legal_name).toBe('Corrected Test Operator');
  });

  test('service role can set the protected fields', async () => {
    const op = await newUser('operator');
    const { error } = await adminClient().from('operator_profiles')
      .update({ participation_status: 'suspended' }).eq('id', op.operatorProfileId);
    expect(error).toBeNull();
    expect((await readOperator(op.operatorProfileId))?.participation_status).toBe('suspended');
  });

  test('listingDocTypes: individual is identity only; company is identity and business_registration', () => {
    expect(listingDocTypes('individual')).toEqual(['identity']);
    expect(listingDocTypes('company')).toEqual(['identity', 'business_registration']);
    expect(listingDocTypes(null)).toEqual(['identity', 'business_registration']);
  });

  test('verificationLabel gives a label only for verified levels', () => {
    expect(verificationLabel('business_verified')).toBe('Business verified');
    expect(verificationLabel('identity_verified')).toBe('Identity verified');
    expect(verificationLabel('registered')).toBeNull();
  });
});

test.describe('Front door schema: admin field guard', () => {
  let customer: TestUser;

  async function storedAdminRows(userId: string) {
    const { data } = await adminClient().from('profiles')
      .select('id, role_type, is_admin').eq('user_id', userId);
    return (data ?? []).filter(p => p.is_admin || p.role_type === 'admin');
  }

  test.beforeAll(async () => {
    customer = await newUser('customer');
  });

  test('customer cannot set is_admin on own row', async () => {
    const { error } = await customer.client.from('profiles')
      .update({ is_admin: true }).eq('id', customer.profileId);
    expect(error?.code).toBe(DENIED);
    expect(await storedAdminRows(customer.id)).toHaveLength(0);
  });

  test('customer cannot set role_type to admin on own row', async () => {
    const { error } = await customer.client.from('profiles')
      .update({ role_type: 'admin' }).eq('id', customer.profileId);
    expect(error?.code).toBe(DENIED);
    expect(await storedAdminRows(customer.id)).toHaveLength(0);
  });

  test('customer cannot insert a second row with role_type admin', async () => {
    const { error } = await customer.client.from('profiles')
      .insert({ user_id: customer.id, role_type: 'admin' });
    expect(error?.code).toBe(DENIED);
    expect(await storedAdminRows(customer.id)).toHaveLength(0);
  });

  test('customer cannot insert a second row with is_admin true', async () => {
    const { error } = await customer.client.from('profiles')
      .insert({ user_id: customer.id, role_type: 'agent', is_admin: true });
    expect(error?.code).toBe(DENIED);
    expect(await storedAdminRows(customer.id)).toHaveLength(0);
  });

  test('customer cannot promote through an upsert of own row', async () => {
    const { error } = await customer.client.from('profiles')
      .upsert({ id: customer.profileId, user_id: customer.id, role_type: 'customer', is_admin: true });
    expect(error?.code).toBe(DENIED);
    expect(await storedAdminRows(customer.id)).toHaveLength(0);
  });

  test('is_admin() is false after those attempts', async () => {
    const { data, error } = await customer.client.rpc('is_admin');
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  test('normal role rows can still be created by a client, and own name edited', async () => {
    const user = await newUser('customer');
    for (const role_type of ['operator', 'agent', 'measurement_agent', 'transporter']) {
      const { error } = await user.client.from('profiles').insert({ user_id: user.id, role_type });
      expect(error).toBeNull();
    }
    const { error } = await user.client.from('profiles')
      .update({ full_name: 'Renamed Test User' }).eq('id', user.profileId);
    expect(error).toBeNull();
  });

  test('an existing admin client still works', async () => {
    const admin = await newUser('admin');
    const { data, error } = await admin.client.rpc('is_admin');
    expect(error).toBeNull();
    expect(data).toBe(true);
    const rename = await admin.client.from('profiles')
      .update({ full_name: 'Renamed Test Admin' }).eq('id', admin.profileId);
    expect(rename.error).toBeNull();
    const { data: all } = await admin.client.from('profiles').select('id').eq('id', customer.profileId);
    expect(all ?? []).toHaveLength(1);
  });

  test('operator cannot get past the listing guard by promoting themselves first', async () => {
    const op = await newUser('operator');
    const promote = await op.client.from('profiles')
      .update({ is_admin: true }).eq('id', op.profileId);
    expect(promote.error?.code).toBe(DENIED);
    const secondRow = await op.client.from('profiles')
      .insert({ user_id: op.id, role_type: 'admin' });
    expect(secondRow.error?.code).toBe(DENIED);

    const { error } = await op.client.from('operator_profiles')
      .update({ verification_level: 'business_verified', participation_status: 'active' })
      .eq('id', op.operatorProfileId);
    expect(error?.code).toBe(DENIED);
    const row = await readOperator(op.operatorProfileId);
    expect(row?.verification_level).toBe('registered');
    expect(row?.participation_status).toBe('pending');
  });
});

test.describe('Front door schema: trading name guard', () => {
  const tradingName = async (id: string | undefined) => {
    const { data } = await adminClient().from('operator_profiles').select('trading_name').eq('id', id ?? '').single();
    return data?.trading_name;
  };
  const setOwn = (op: TestUser, trading_name: string | null) =>
    op.client.from('operator_profiles').update({ trading_name }).eq('id', op.operatorProfileId ?? '');
  const verify = (op: TestUser) => adminClient().from('operator_profiles')
    .update({ verification_level: 'identity_verified' }).eq('id', op.operatorProfileId ?? '');

  test('a registered operator can set and change their trading name', async () => {
    const op = await newUser('operator', { entityType: 'individual' });
    expect((await setOwn(op, 'First Name')).error).toBeNull();
    expect((await setOwn(op, 'Second Name')).error).toBeNull();
    expect(await tradingName(op.operatorProfileId)).toBe('Second Name');
  });

  test('a verified operator with a blank trading name can set one, then it is locked', async () => {
    const op = await newUser('operator', { entityType: 'individual' });
    expect((await verify(op)).error).toBeNull();
    expect((await setOwn(op, 'Set After Verification')).error).toBeNull();

    for (const value of ['Changed', '', null]) {
      const { error } = await setOwn(op, value);
      expect(error?.code).toBe(DENIED);
      expect(error?.message).toContain('trading name');
    }
    expect(await tradingName(op.operatorProfileId)).toBe('Set After Verification');
  });

  test('a whitespace-only trading name counts as blank for a verified operator', async () => {
    const op = await newUser('operator', { entityType: 'individual' });
    expect((await setOwn(op, '   ')).error).toBeNull();
    expect((await verify(op)).error).toBeNull();
    expect((await setOwn(op, 'Real Name')).error).toBeNull();
    expect(await tradingName(op.operatorProfileId)).toBe('Real Name');
  });

  test('a verified operator can save other fields without touching the trading name', async () => {
    const op = await newUser('operator', { entityType: 'individual' });
    expect((await setOwn(op, 'Locked Name')).error).toBeNull();
    expect((await verify(op)).error).toBeNull();
    const { error } = await op.client.from('operator_profiles')
      .update({ public_description: 'Still editable.' }).eq('id', op.operatorProfileId ?? '');
    expect(error).toBeNull();
  });

  test('an admin can change a verified trading name', async () => {
    const op = await newUser('operator', { entityType: 'individual' });
    expect((await setOwn(op, 'Locked Name')).error).toBeNull();
    expect((await verify(op)).error).toBeNull();
    const admin = await newUser('admin');
    const { error } = await admin.client.from('operator_profiles')
      .update({ trading_name: 'Corrected Name' }).eq('id', op.operatorProfileId ?? '');
    expect(error).toBeNull();
    expect(await tradingName(op.operatorProfileId)).toBe('Corrected Name');
  });
});

test.describe('Front door schema: participation terms', () => {
  const OWN_TERMS = { version: 'front-door-test-terms', title: 'Test terms', body: 'Test terms body.' };
  let terms: { version: string; body: string };
  let ownsTerms = false;

  // Task 8 seeds real terms. If a current row exists, use it and leave it alone.
  test.beforeAll(async () => {
    const admin = adminClient();
    const { data: current, error } = await admin.from('participation_terms')
      .select('version, body').eq('is_current', true).maybeSingle();
    if (error) throw new Error(`participation_terms read failed: ${error.message}`);
    if (current) {
      terms = current;
      return;
    }
    const { error: insertErr } = await admin.from('participation_terms').insert({ ...OWN_TERMS, is_current: true });
    if (insertErr) throw new Error(`participation_terms insert failed: ${insertErr.message}`);
    terms = { version: OWN_TERMS.version, body: OWN_TERMS.body };
    ownsTerms = true;
  });

  test.afterAll(async () => {
    if (ownsTerms) await adminClient().from('participation_terms').delete().eq('version', OWN_TERMS.version);
  });

  // The terms are closed to acceptance. Opens them for the length of one call, and always closes them.
  async function whileOpen<T>(fn: () => PromiseLike<T>): Promise<T> {
    const admin = adminClient();
    const setOpen = (open: boolean) => admin.from('participation_terms')
      .update({ open_for_acceptance: open }).eq('version', terms.version);
    let result: T;
    try {
      expect((await setOpen(true)).error).toBeNull();
      result = await fn();
    } finally {
      const { error } = await setOpen(false);
      if (error) console.error('COULD NOT CLOSE THE TERMS', error.message);
    }
    const { data } = await admin.from('participation_terms')
      .select('open_for_acceptance').eq('version', terms.version).single();
    expect(data?.open_for_acceptance).toBe(false);
    return result;
  }

  const acceptWhileOpen = (op: TestUser) =>
    whileOpen(() => op.client.rpc('accept_participation_terms', { p_version: terms.version }));

  test('accepting is refused while the terms are not open, for a real operator', async () => {
    const op = await newUser('operator');
    const { data: flag, error: readErr } = await op.client.from('participation_terms')
      .select('open_for_acceptance').eq('version', terms.version).single();
    expect(readErr).toBeNull();
    expect(flag?.open_for_acceptance).toBe(false);

    const { error } = await op.client.rpc('accept_participation_terms', { p_version: terms.version });
    expect(error?.message).toContain('not open for acceptance');
    const row = await readOperator(op.operatorProfileId);
    expect(row?.participation_terms_accepted_at).toBeNull();
    expect(row?.participation_terms_version).toBeNull();
    expect(await acceptanceCount(op.operatorProfileId)).toBe(0);
  });

  test('an operator cannot open the terms themselves', async () => {
    const op = await newUser('operator');
    const { data } = await op.client.from('participation_terms')
      .update({ open_for_acceptance: true }).eq('version', terms.version).select('version');
    expect(data ?? []).toHaveLength(0);
    const { data: row } = await adminClient().from('participation_terms')
      .select('open_for_acceptance').eq('version', terms.version).single();
    expect(row?.open_for_acceptance).toBe(false);
  });

  test('anyone can read the current terms', async () => {
    const { data, error } = await anon().from('participation_terms')
      .select('version, body').eq('is_current', true).single();
    expect(error).toBeNull();
    expect(data).toEqual(terms);
  });

  test('only admins can write terms, and only one row can be current', async () => {
    const version = 'front-door-test-terms-2';
    const op = await newUser('operator');
    const denied = await op.client.from('participation_terms')
      .insert({ version, title: 'Hack', body: 'Hack' });
    expect(denied.error?.code).toBe(DENIED);

    const admin = await newUser('admin');
    const secondCurrent = await admin.client.from('participation_terms')
      .insert({ version, title: 'Second', body: 'Second', is_current: true });
    expect(secondCurrent.error?.code).toBe('23505');

    const allowed = await admin.client.from('participation_terms')
      .insert({ version, title: 'Second', body: 'Second' });
    expect(allowed.error).toBeNull();
    const removed = await admin.client.from('participation_terms').delete().eq('version', version);
    expect(removed.error).toBeNull();
  });

  test('accepting terms writes the column and one agreement_acceptances row with type operator_participation_terms', async () => {
    const op = await newUser('operator');
    const { error } = await acceptWhileOpen(op);
    expect(error).toBeNull();

    const row = await readOperator(op.operatorProfileId);
    expect(row?.participation_terms_accepted_at).not.toBeNull();
    expect(row?.participation_terms_version).toBe(terms.version);

    const { data } = await adminClient().from('agreement_acceptances')
      .select('agreement_type, version, agreement_text, user_id')
      .eq('operator_profile_id', op.operatorProfileId ?? '');
    expect(data).toEqual([{
      agreement_type: 'operator_participation_terms',
      version: terms.version,
      agreement_text: terms.body,
      user_id: op.id,
    }]);
  });

  test('accepting terms leaves service_agreement_signed_at null', async () => {
    const op = await newUser('operator');
    const { error } = await acceptWhileOpen(op);
    expect(error).toBeNull();
    expect((await readOperator(op.operatorProfileId))?.service_agreement_signed_at).toBeNull();
  });

  test('a client cannot supply its own terms text', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.rpc('accept_participation_terms', { p_version: terms.version, p_text: 'My own terms.' });
    expect(error?.code).toBe('PGRST202');
    expect(await acceptanceCount(op.operatorProfileId)).toBe(0);
  });

  test('accepting a version that is not current is refused', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.rpc('accept_participation_terms', { p_version: 'not-the-current-version' });
    expect(error?.message).toContain('not the current terms');
    expect((await readOperator(op.operatorProfileId))?.participation_terms_accepted_at).toBeNull();
    expect(await acceptanceCount(op.operatorProfileId)).toBe(0);
  });

  test('accepting is refused when no terms are current', async () => {
    test.skip(!ownsTerms, 'Real terms are current; they are not switched off for a test');
    const op = await newUser('operator');
    const admin = adminClient();
    await admin.from('participation_terms').update({ is_current: false }).eq('version', OWN_TERMS.version);
    try {
      const { error } = await op.client.rpc('accept_participation_terms', { p_version: OWN_TERMS.version });
      expect(error?.message).toContain('No current terms');
      expect(await acceptanceCount(op.operatorProfileId)).toBe(0);
    } finally {
      await admin.from('participation_terms').update({ is_current: true }).eq('version', OWN_TERMS.version);
    }
  });

  test('accepting the same version twice is refused and changes nothing', async () => {
    const op = await newUser('operator');
    const first = await acceptWhileOpen(op);
    expect(first.error).toBeNull();
    const acceptedAt = (await readOperator(op.operatorProfileId))?.participation_terms_accepted_at;

    const second = await acceptWhileOpen(op);
    expect(second.error?.message).toContain('already accepted');
    expect(await acceptanceCount(op.operatorProfileId)).toBe(1);
    expect((await readOperator(op.operatorProfileId))?.participation_terms_accepted_at).toBe(acceptedAt);
  });

  test('accepting terms is refused without an operator profile, and for anon', async () => {
    const customer = await newUser('customer');
    const asCustomer = await customer.client.rpc('accept_participation_terms', { p_version: terms.version });
    expect(asCustomer.error?.message).toContain('No operator profile');
    const asAnon = await anon().rpc('accept_participation_terms', { p_version: terms.version });
    expect(asAnon.error?.code).toBe(DENIED);
  });

  test('accepting terms ignores an operator row on a non-operator profile', async () => {
    const user = await newUser('customer');
    const { data: op } = await adminClient().from('operator_profiles').insert({
      profile_id: user.profileId,
      legal_name: 'Front Door Test Operator',
      entity_type: 'company',
      country: 'South Africa',
    }).select('id').single();
    const { error } = await user.client.rpc('accept_participation_terms', { p_version: terms.version });
    expect(error?.message).toContain('No operator profile');
    expect(await acceptanceCount(op?.id)).toBe(0);
  });

  test('accepting terms is refused when the user has two operator rows', async () => {
    const op = await newUser('operator');
    const admin = adminClient();
    const { data: profile } = await admin.from('profiles')
      .insert({ user_id: op.id, role_type: 'operator' }).select('id').single();
    const { error: insertErr } = await admin.from('operator_profiles').insert({
      profile_id: profile?.id,
      legal_name: 'Front Door Test Operator Two',
      entity_type: 'company',
      country: 'South Africa',
    });
    expect(insertErr).toBeNull();

    const { error } = await op.client.rpc('accept_participation_terms', { p_version: terms.version });
    expect(error?.message).toContain('More than one operator profile');
    expect(await acceptanceCount(op.operatorProfileId)).toBe(0);
  });

  test('listed only when verified, active, terms accepted, one service and one coverage row', async () => {
    const op = await newUser('operator');
    const id = op.operatorProfileId ?? '';
    const admin = adminClient();
    const isListed = async () => {
      const { data, error } = await anon().rpc('operator_is_listed', { op_id: id });
      expect(error).toBeNull();
      return data;
    };

    expect(await isListed()).toBe(false);

    const { data: category } = await admin.from('service_categories').select('id').eq('slug', 'sea-freight').single();
    const service = { operator_profile_id: id, service_category_id: category?.id };
    const coverage = { operator_profile_id: id, origin_country: 'South Africa', destination_country: 'Ghana' };

    await admin.from('operator_services').insert(service);
    expect(await isListed()).toBe(false);

    await admin.from('operator_coverage').insert(coverage);
    expect(await isListed()).toBe(false);

    const { error: acceptErr } = await acceptWhileOpen(op);
    expect(acceptErr).toBeNull();
    expect(await isListed()).toBe(false);

    await admin.from('operator_profiles').update({ verification_level: 'identity_verified' }).eq('id', id);
    expect(await isListed()).toBe(false);

    await admin.from('operator_profiles').update({ participation_status: 'active' }).eq('id', id);
    expect(await isListed()).toBe(true);

    await admin.from('operator_profiles').update({ participation_status: 'suspended' }).eq('id', id);
    expect(await isListed()).toBe(false);

    await admin.from('operator_profiles')
      .update({ participation_status: 'active', verification_level: 'registered' }).eq('id', id);
    expect(await isListed()).toBe(false);

    await admin.from('operator_profiles').update({ verification_level: 'business_verified' }).eq('id', id);
    expect(await isListed()).toBe(true);

    const { data: accepted } = await admin.from('operator_profiles')
      .select('participation_terms_accepted_at').eq('id', id).single();
    await admin.from('operator_profiles').update({ participation_terms_accepted_at: null }).eq('id', id);
    expect(await isListed()).toBe(false);

    await admin.from('operator_profiles')
      .update({ participation_terms_accepted_at: accepted?.participation_terms_accepted_at }).eq('id', id);
    expect(await isListed()).toBe(true);

    await admin.from('operator_services').delete().eq('operator_profile_id', id);
    expect(await isListed()).toBe(false);

    await admin.from('operator_services').insert(service);
    expect(await isListed()).toBe(true);

    await admin.from('operator_coverage').delete().eq('operator_profile_id', id);
    expect(await isListed()).toBe(false);
  });
});
