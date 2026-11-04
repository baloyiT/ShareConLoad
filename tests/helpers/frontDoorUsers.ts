import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { randomBytes } from 'crypto';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const TEST_EMAIL_RE = /^front-door-test-[a-z0-9]+@example\.invalid$/;

export type TestRole = 'customer' | 'operator' | 'admin';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  profileId: string;
  operatorProfileId?: string;
}

export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(
  role: TestRole,
  opts?: { entityType?: 'company' | 'individual' },
): Promise<TestUser> {
  const admin = adminClient();
  const email = `front-door-test-${randomBytes(6).toString('hex')}@example.invalid`;
  const password = `Fd-${randomBytes(9).toString('hex')}!`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Front Door Test', active_role: role },
  });
  if (createErr || !created.user) throw new Error(`createUser failed: ${createErr?.message}`);
  const id = created.user.id;

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .insert({ user_id: id, role_type: role, is_admin: role === 'admin' })
    .select('id')
    .single();
  if (profileErr || !profile) {
    await admin.auth.admin.deleteUser(id);
    throw new Error(`profile insert failed: ${profileErr?.message}`);
  }

  let operatorProfileId: string | undefined;
  if (role === 'operator') {
    const { data: op, error: opErr } = await admin
      .from('operator_profiles')
      .insert({
        profile_id: profile.id,
        legal_name: 'Front Door Test Operator',
        entity_type: opts?.entityType ?? 'company',
        country: 'South Africa',
      })
      .select('id')
      .single();
    if (opErr || !op) {
      await admin.from('profiles').delete().eq('id', profile.id);
      await admin.auth.admin.deleteUser(id);
      throw new Error(`operator_profiles insert failed: ${opErr?.message}`);
    }
    operatorProfileId = op.id as string;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);

  return { id, email, password, client, profileId: profile.id as string, operatorProfileId };
}

// Only ever removes users whose email matches front-door-test-*@example.invalid.
export async function deleteTestUser(user: Pick<TestUser, 'id' | 'email'>): Promise<void> {
  if (!TEST_EMAIL_RE.test(user.email)) {
    throw new Error(`Refusing to delete non-test user: ${user.email}`);
  }
  const admin = adminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  if (authUser.user && authUser.user.email !== user.email) {
    throw new Error('Refusing to delete: id and email do not match');
  }
  const { data: profiles } = await admin.from('profiles').select('id').eq('user_id', user.id);
  const profileIds = (profiles ?? []).map(p => p.id as string);
  if (profileIds.length > 0) {
    const { data: ops } = await admin.from('operator_profiles').select('id').in('profile_id', profileIds);
    const opIds = (ops ?? []).map(o => o.id as string);
    if (opIds.length > 0) {
      await admin.from('operator_services').delete().in('operator_profile_id', opIds);
      await admin.from('operator_coverage').delete().in('operator_profile_id', opIds);
      await admin.from('operator_profiles').delete().in('id', opIds);
    }
    await admin.from('profiles').delete().in('id', profileIds);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}

export async function signInBrowser(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 15_000 });
}
