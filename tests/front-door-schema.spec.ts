import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { adminClient, createTestUser, deleteTestUser, TestUser } from './helpers/frontDoorUsers';
import { listingDocTypes, verificationLabel } from '../services/operatorCompliance';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const anon = () => createClient(SUPABASE_URL, SUPABASE_ANON);

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
  const users: TestUser[] = [];

  async function newUser(...args: Parameters<typeof createTestUser>): Promise<TestUser> {
    const user = await createTestUser(...args);
    users.push(user);
    return user;
  }

  async function readOperator(id: string | undefined) {
    const { data, error } = await adminClient().from('operator_profiles')
      .select('verification_level, participation_status, participation_terms_accepted_at, participation_terms_version, service_agreement_signed_at, public_description')
      .eq('id', id ?? '')
      .single();
    expect(error).toBeNull();
    return data;
  }

  test.afterAll(async () => {
    for (const user of users) await deleteTestUser(user);
  });

  test('operator cannot set own verification_level', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ verification_level: 'business_verified' }).eq('id', op.operatorProfileId);
    expect(error).not.toBeNull();
    expect((await readOperator(op.operatorProfileId))?.verification_level).toBe('registered');
  });

  test('operator cannot set own participation_status', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ participation_status: 'active' }).eq('id', op.operatorProfileId);
    expect(error).not.toBeNull();
    expect((await readOperator(op.operatorProfileId))?.participation_status).toBe('pending');
  });

  test('operator cannot set participation_terms_accepted_at directly', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ participation_terms_accepted_at: new Date().toISOString() }).eq('id', op.operatorProfileId);
    expect(error).not.toBeNull();
    expect((await readOperator(op.operatorProfileId))?.participation_terms_accepted_at).toBeNull();
  });

  test('operator cannot set participation_terms_version directly', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ participation_terms_version: 'v1' }).eq('id', op.operatorProfileId);
    expect(error).not.toBeNull();
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
    expect(error).not.toBeNull();
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

  test('operator can still update other columns', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.from('operator_profiles')
      .update({ public_description: 'We move freight.', legal_name: 'Renamed Test Operator' })
      .eq('id', op.operatorProfileId);
    expect(error).toBeNull();
    expect((await readOperator(op.operatorProfileId))?.public_description).toBe('We move freight.');
  });

  test('admin using the client can set the protected fields', async () => {
    const op = await newUser('operator');
    const admin = await newUser('admin');
    const { error } = await admin.client.from('operator_profiles')
      .update({ verification_level: 'identity_verified', participation_status: 'active' })
      .eq('id', op.operatorProfileId);
    expect(error).toBeNull();
    const row = await readOperator(op.operatorProfileId);
    expect(row?.verification_level).toBe('identity_verified');
    expect(row?.participation_status).toBe('active');
  });

  test('service role can set the protected fields', async () => {
    const op = await newUser('operator');
    const { error } = await adminClient().from('operator_profiles')
      .update({ participation_status: 'suspended' }).eq('id', op.operatorProfileId);
    expect(error).toBeNull();
    expect((await readOperator(op.operatorProfileId))?.participation_status).toBe('suspended');
  });

  test('accepting terms writes the column and one agreement_acceptances row with type operator_participation_terms', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.rpc('accept_participation_terms', { p_version: 'v1', p_text: 'The terms.' });
    expect(error).toBeNull();

    const row = await readOperator(op.operatorProfileId);
    expect(row?.participation_terms_accepted_at).not.toBeNull();
    expect(row?.participation_terms_version).toBe('v1');

    const { data } = await adminClient().from('agreement_acceptances')
      .select('agreement_type, version, agreement_text, user_id')
      .eq('operator_profile_id', op.operatorProfileId ?? '');
    expect(data).toEqual([{
      agreement_type: 'operator_participation_terms',
      version: 'v1',
      agreement_text: 'The terms.',
      user_id: op.id,
    }]);
  });

  test('accepting terms leaves service_agreement_signed_at null', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.rpc('accept_participation_terms', { p_version: 'v1', p_text: 'The terms.' });
    expect(error).toBeNull();
    expect((await readOperator(op.operatorProfileId))?.service_agreement_signed_at).toBeNull();
  });

  test('accepting terms is refused without an operator profile, and for anon', async () => {
    const customer = await newUser('customer');
    const asCustomer = await customer.client.rpc('accept_participation_terms', { p_version: 'v1', p_text: 'The terms.' });
    expect(asCustomer.error).not.toBeNull();
    const asAnon = await anon().rpc('accept_participation_terms', { p_version: 'v1', p_text: 'The terms.' });
    expect(asAnon.error).not.toBeNull();
  });

  test('accepting terms is refused with empty text', async () => {
    const op = await newUser('operator');
    const { error } = await op.client.rpc('accept_participation_terms', { p_version: 'v1', p_text: '  ' });
    expect(error).not.toBeNull();
    expect((await readOperator(op.operatorProfileId))?.participation_terms_accepted_at).toBeNull();
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
    await admin.from('operator_services').insert({ operator_profile_id: id, service_category_id: category?.id });
    expect(await isListed()).toBe(false);

    await admin.from('operator_coverage').insert({
      operator_profile_id: id, origin_country: 'South Africa', destination_country: 'Ghana',
    });
    expect(await isListed()).toBe(false);

    await op.client.rpc('accept_participation_terms', { p_version: 'v1', p_text: 'The terms.' });
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

    await admin.from('operator_coverage').delete().eq('operator_profile_id', id);
    expect(await isListed()).toBe(false);
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
