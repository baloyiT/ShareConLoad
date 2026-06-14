/**
 * Creates / updates test users in Supabase, bypassing email confirmation.
 * Resets passwords for existing users so test credentials always match.
 *
 * Usage:
 *   node tests/create-test-users.mjs
 *
 * Prerequisites:
 *   Add to .env.local:
 *     SUPABASE_SERVICE_ROLE_KEY=your_key_here
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
);

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  {
    email:     'customer.shareconload@gmail.com',
    password:  'TestCustomer@2026!',
    full_name: 'Alex Mensah',
    role_type: 'customer',
    is_admin:  false,
  },
  {
    email:     'mercy.affulbaloyi@gmail.com',
    password:  'TestOperator@2026!',
    full_name: 'Mercy Afful-Baloyi',
    role_type: 'operator',
    is_admin:  false,
  },
  {
    email:     'justice_baloyi@yahoo.com',
    password:  'TestAgent@2026!',
    full_name: 'Justice Baloyi',
    role_type: 'agent',
    is_admin:  false,
  },
  {
    email:     'admin.shareconload@test.com',
    password:  'TestAdmin@2026!',
    full_name: 'Test Admin',
    role_type: 'admin',
    is_admin:  true,
  },
];

async function getUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return data.users.find(u => u.email === email) ?? null;
}

async function ensureUser({ email, password, full_name, role_type, is_admin }) {
  console.log(`\n→ ${role_type.toUpperCase()}: ${email}`);

  let userId;

  // Try creating the user
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, active_role: role_type },
  });

  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      console.log('  ⚠️  Auth user already exists — finding and resetting password...');
      const existing = await getUserByEmail(email);
      if (!existing) { console.error('  ❌ Could not find existing user'); return; }
      userId = existing.id;

      // Reset password so test credentials always work
      const { error: resetErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { full_name, active_role: role_type },
      });
      if (resetErr) {
        console.error(`  ❌ Password reset error: ${resetErr.message}`);
      } else {
        console.log(`  ✅ Password reset for user: ${userId}`);
      }
    } else {
      console.error(`  ❌ Auth create error: ${error.message}`);
      return;
    }
  } else {
    userId = data.user.id;
    console.log(`  ✅ Auth user created: ${userId}`);
  }

  // Ensure the correct role_type profile row exists
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_type', role_type)
    .maybeSingle();

  let profileId;

  if (existing) {
    profileId = existing.id;
    console.log(`  ✅ Profile already exists: role_type=${role_type}`);
    if (is_admin) {
      await admin.from('profiles').update({ is_admin: true }).eq('id', existing.id);
      console.log(`  ✅ is_admin set to true`);
    }
  } else {
    const { data: newProfile, error: profileError } = await admin
      .from('profiles')
      .insert({ user_id: userId, role_type, is_admin })
      .select('id')
      .single();

    if (profileError) {
      console.error(`  ❌ Profile insert error: ${profileError.message}`);
      return;
    }
    profileId = newProfile.id;
    console.log(`  ✅ Profile created: role_type=${role_type}, is_admin=${is_admin}`);
  }

  // Seed operator_profiles so /operator/bank and compliance pages work without onboarding
  if (role_type === 'operator' && profileId) {
    const { data: existingOp } = await admin
      .from('operator_profiles')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (!existingOp) {
      const { error: opError } = await admin
        .from('operator_profiles')
        .insert({ profile_id: profileId, legal_name: full_name, entity_type: 'individual', country: 'South Africa' });

      if (opError) {
        console.error(`  ❌ operator_profiles insert error: ${opError.message}`);
      } else {
        console.log(`  ✅ operator_profiles seeded`);
      }
    } else {
      console.log(`  ✅ operator_profiles already exists`);
    }
  }
}

console.log('ShareConLoad — Creating / Updating Test Users');
console.log('==============================================');

for (const user of TEST_USERS) {
  await ensureUser(user);
}

console.log('\n✅ Done. Run: npx playwright test');
console.log('   Credentials: Test Case/<Role>/profile.json');
