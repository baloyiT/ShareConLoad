/**
 * Creates test users in Supabase, bypassing email confirmation.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   node tests/create-test-users.mjs
 *
 * Prerequisites:
 *   1. Copy your Supabase Service Role Key from:
 *      Supabase Dashboard → Project Settings → API → service_role key
 *   2. Add to .env.local:
 *      SUPABASE_SERVICE_ROLE_KEY=your_key_here
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

const SUPABASE_URL          = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY      = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('   Add it from: Supabase Dashboard → Project Settings → API → service_role');
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
    role:      'customer',
  },
  {
    email:     'mercy.affulbaloyi@gmail.com',
    password:  'TestOperator@2026!',
    full_name: 'Mercy Afful-Baloyi',
    role:      'operator',
  },
  {
    email:     'justice_baloyi@yahoo.com',
    password:  'TestAgent@2026!',
    full_name: 'Justice Baloyi',
    role:      'agent',
  },
];

async function createUser({ email, password, full_name, role }) {
  console.log(`\n→ Creating ${role} user: ${email}`);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,          // skip confirmation email
    user_metadata: { full_name, active_role: 'customer' },
  });

  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      console.log(`  ⚠️  Already exists — skipping`);
      return;
    }
    console.error(`  ❌ Error: ${error.message}`);
    return;
  }

  console.log(`  ✅ Created user: ${data.user.id}`);
}

console.log('ShareConLoad — Creating Test Users');
console.log('====================================');

for (const user of TEST_USERS) {
  await createUser(user);
}

console.log('\n✅ Done. You can now run: npx playwright test');
console.log('\nTest credentials are in Test Case/<Role>/profile.json');
