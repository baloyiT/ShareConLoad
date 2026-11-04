import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const OPERATOR_EMAIL = process.env.TEST_OPERATOR_EMAIL    ?? 'mercy.affulbaloyi@gmail.com';
const OPERATOR_PASS  = process.env.TEST_OPERATOR_PASSWORD ?? 'TestOperator@2026!';

const anon = () => createClient(SUPABASE_URL, SUPABASE_ANON);

async function signIn(email: string, password: string) {
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return client;
}

test.describe('Front door schema: taxonomy, services, coverage', () => {
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
    const client = await signIn(OPERATOR_EMAIL, OPERATOR_PASS);
    const { error } = await client.from('operator_coverage').insert({
      operator_profile_id: '00000000-0000-0000-0000-0000000000aa',
      origin_country: 'South Africa',
      destination_country: 'Ghana',
    });
    expect(error).not.toBeNull();
  });
});
