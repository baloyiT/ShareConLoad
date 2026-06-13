/**
 * Creates test users in Supabase, bypassing email confirmation.
 * Also upserts the correct profiles row for each user using the service role
 * client, bypassing RLS and any trigger-assigned defaults.
 *
 * Usage:
 *   node tests/create-test-users.mjs
 *
 * Prerequisites:
 *   Add to .env.local:
 *     SUPABASE_SERVICE_ROLE_KEY=your_key_here
 *   (Supabase Dashboard → Project Settings → API → service_role)
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
  },
  {
    email:     'mercy.affulbaloyi@gmail.com',
    password:  'TestOperator@2026!',
    full_name: 'Mercy Afful-Baloyi',
    role_type: 'operator',
  },
  {
    email:     'justice_baloyi@yahoo.com',
    password:  'TestAgent@2026!',
    full_name: 'Justice Baloyi',
    role_type: 'agent',
  },
];

async function getUserByEmail(email) {
  // listUsers paginates — search first page (enough for small projects)
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return data.users.find(u => u.email === email) ?? null;
}

async function ensureUser({ email, password, full_name, role_type }) {
  console.log(`\n→ ${role_type.toUpperCase()}: ${email}`);

  let userId;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, active_role: role_type },
  });

  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      console.log('  ⚠️  Auth user already exists — finding...');
      const existing = await getUserByEmail(email);
      if (!existing) { console.error('  ❌ Could not find existing user'); return; }
      userId = existing.id;
      console.log(`  ℹ️  User ID: ${userId}`);
    } else {
      console.error(`  ❌ Auth create error: ${error.message}`);
      return;
    }
  } else {
    userId = data.user.id;
    console.log(`  ✅ Auth user created: ${userId}`);
  }

  // Upsert the profiles row with the correct role_type.
  // Uses service role client (bypasses RLS) so it works regardless of
  // what the trigger created or whether a row already exists.
  // Check if a profile with this role already exists
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_type', role_type)
    .maybeSingle();

  if (existing) {
    console.log(`  ✅ Profile already exists: role_type=${role_type}`);
  } else {
    const { error: profileError } = await admin
      .from('profiles')
      .insert({ user_id: userId, role_type });

    if (profileError) {
      console.error(`  ❌ Profile insert error: ${profileError.message}`);
    } else {
      console.log(`  ✅ Profile created: role_type=${role_type}`);
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
