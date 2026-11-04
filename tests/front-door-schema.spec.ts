import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createTestUser, deleteTestUser, TestUser } from './helpers/frontDoorUsers';

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
