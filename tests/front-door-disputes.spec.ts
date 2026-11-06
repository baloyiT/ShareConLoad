import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { adminClient, createTestUser, removeUsersAndFreight, signInBrowser, sweepTestUsers, type TestUser } from './helpers/frontDoorUsers';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

const BUCKET = 'dispute-evidence';
const PAGE_DISPUTE_TYPES = ['cargo_damage', 'short_delivery', 'overcharge', 'delay', 'other'];
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const users: TestUser[] = [];
let owner: TestUser;
let stranger: TestUser;
let operator: TestUser;
let customerProfileId: string;
let operatorRowId: string;
let bookingId: string;
let strangerBookingId: string;
let seededDisputeId: string;
let disputeId: string;

async function newUser(role: 'customer' | 'operator'): Promise<TestUser> {
  const user = await createTestUser(role);
  users.push(user);
  return user;
}

// createTestUser adds a row next to the one handle_new_user makes. Real two-row users
// are customer + operator, so the owner gets exactly that.
async function makeCustomerAndOperator(user: TestUser): Promise<void> {
  const db = adminClient();
  const { data, error } = await db.from('profiles').select('id').eq('user_id', user.id).order('created_at');
  expect(error).toBeNull();
  expect(data).toHaveLength(2);
  operatorRowId = data![0].id as string;
  customerProfileId = data![1].id as string;
  const { error: roleErr } = await db.from('profiles').update({ role_type: 'operator' }).eq('id', operatorRowId);
  expect(roleErr).toBeNull();
}

// A stranger with one row, so a denial comes from the policy and not from error 21000.
async function makeSingleProfile(user: TestUser): Promise<void> {
  const db = adminClient();
  const { error } = await db.from('profiles').delete().eq('user_id', user.id).neq('id', user.profileId);
  expect(error).toBeNull();
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await sweepTestUsers();
  const db = adminClient();
  owner = await newUser('customer');
  stranger = await newUser('customer');
  operator = await newUser('operator');
  await makeCustomerAndOperator(owner);
  await makeSingleProfile(stranger);

  const { data: container, error: containerErr } = await db.from('containers').insert({
    operator_id: operator.id,
    origin_country: 'South Africa', origin_city: 'Durban',
    destination_country: 'Ghana', destination_city: 'Tema',
    departure_date: '2030-01-01',
    total_capacity_cbm: 10, available_capacity_cbm: 10,
    load_type: 'LCL', price_per_cbm: 100, currency_code: 'USD', status: 'open',
  }).select('id').single();
  expect(containerErr).toBeNull();

  const { data: booking, error: bookingErr } = await db.from('bookings').insert({
    container_id: container!.id, customer_id: owner.id, total_cbm: 1, total_price: 1000, status: 'goods_received',
  }).select('id').single();
  expect(bookingErr).toBeNull();
  bookingId = booking!.id as string;

  const { data: strangerBooking, error: strangerBookingErr } = await db.from('bookings').insert({
    container_id: container!.id, customer_id: stranger.id, total_cbm: 1, total_price: 1000, status: 'confirmed',
  }).select('id').single();
  expect(strangerBookingErr).toBeNull();
  strangerBookingId = strangerBooking!.id as string;

  const { data: seeded, error: seededErr } = await db.from('disputes').insert({
    booking_id: bookingId, raised_by: owner.id, submitted_by: customerProfileId,
    dispute_type: 'cargo_damage', description: 'Seeded', status: 'resolved', resolution_notes: 'Seeded resolution',
  }).select('id').single();
  expect(seededErr).toBeNull();
  seededDisputeId = seeded!.id as string;
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  const db = adminClient();
  try {
    const { data: disputes } = bookingId
      ? await db.from('disputes').select('id').eq('booking_id', bookingId)
      : { data: [] };
    for (const { id } of disputes ?? []) {
      const { data: objects } = await db.storage.from(BUCKET).list(id as string);
      const paths = (objects ?? []).map(o => `${id}/${o.name}`);
      if (paths.length > 0) {
        const { error } = await db.storage.from(BUCKET).remove(paths);
        if (error) console.error('could not remove evidence', id, error.message);
      }
    }
  } catch (err) {
    console.error('evidence cleanup failed', err);
  }
  await removeUsersAndFreight(users);
});

test.describe('a customer with two profile rows', () => {
  test('opens a dispute of every type the page offers', async () => {
    for (const dispute_type of PAGE_DISPUTE_TYPES) {
      // Exactly what app/disputes/new/page.tsx sends, on this branch and in production.
      const { data, error } = await owner.client.from('disputes').insert({
        booking_id: bookingId,
        submitted_by: customerProfileId,
        dispute_type,
        description: `Front door test ${dispute_type}`,
      }).select('id').single();
      expect(error, dispute_type).toBeNull();
      disputeId ??= data!.id as string;
    }
    const { data: rows, error } = await owner.client
      .from('disputes').select('id').eq('booking_id', bookingId).like('description', 'Front door test%');
    expect(error).toBeNull();
    expect(rows).toHaveLength(PAGE_DISPUTE_TYPES.length);
  });

  test('records who raised the dispute without the page sending it', async () => {
    const { data } = await adminClient().from('disputes').select('raised_by').eq('id', disputeId).single();
    expect(data?.raised_by).toBe(owner.id);
  });

  test('attaches evidence and reads it back', async () => {
    const path = `${disputeId}/api.png`;
    const { error: uploadErr } = await owner.client.storage.from(BUCKET).upload(path, PNG, { contentType: 'image/png' });
    expect(uploadErr).toBeNull();
    const { data: url } = owner.client.storage.from(BUCKET).getPublicUrl(path);

    // Exactly what app/disputes/[id]/page.tsx sends, on this branch and in production.
    const { error: insertErr } = await owner.client.from('dispute_evidence').insert({
      dispute_id: disputeId,
      uploaded_by: customerProfileId,
      file_url: url.publicUrl,
      file_name: 'api.png',
      description: 'Front door test',
    });
    expect(insertErr).toBeNull();

    const { data: rows, error } = await owner.client
      .from('dispute_evidence')
      .select('id, file_url, file_name, description, created_at')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true });
    expect(error).toBeNull();
    expect(rows?.map(r => r.file_name)).toEqual(['api.png']);
    expect(rows?.[0].description).toBe('Front door test');
  });

  test('attaches evidence under their other profile row too', async () => {
    const { error } = await owner.client.from('dispute_evidence').insert({
      dispute_id: disputeId, uploaded_by: operatorRowId,
      file_url: 'https://example.invalid/other-row.png', file_name: 'other-row.png',
    });
    expect(error).toBeNull();
    await adminClient().from('dispute_evidence').delete().eq('file_name', 'other-row.png').eq('dispute_id', disputeId);
  });

  test('refuses a user id as the uploader', async () => {
    const db = adminClient();
    const { data: inserted, error } = await db.from('dispute_evidence').insert({
      dispute_id: disputeId, uploaded_by: owner.id, file_url: 'https://example.invalid/x.png', file_name: 'x.png',
    }).select('id');
    // uploaded_by is a profile id, so a user id is refused.
    expect(inserted).toBeNull();
    expect(error?.code).toBe('23503');
  });

  test('files and reads an insurance claim', async () => {
    const { error } = await owner.client.from('insurance_claims').insert({
      booking_id: bookingId, dispute_id: disputeId, submitted_by: customerProfileId, claim_type: 'cargo_damage',
    });
    expect(error).toBeNull();
    const { data, error: readErr } = await owner.client.from('insurance_claims').select('id').eq('booking_id', bookingId);
    expect(readErr).toBeNull();
    expect(data).toHaveLength(1);
    await adminClient().from('insurance_claims').delete().eq('booking_id', bookingId);
  });
});

test.describe('a stranger', () => {
  test('cannot open a dispute on someone else\'s booking', async () => {
    const { error } = await stranger.client.from('disputes').insert({
      booking_id: bookingId, submitted_by: stranger.profileId,
      dispute_type: 'cargo_damage', description: 'Front door test',
    });
    expect(error?.code).toBe('42501');
  });

  test('cannot see the dispute or its evidence', async () => {
    const dispute = await stranger.client.from('disputes').select('id').eq('id', disputeId);
    expect(dispute.error).toBeNull();
    expect(dispute.data).toEqual([]);
    const evidence = await stranger.client.from('dispute_evidence').select('id').eq('dispute_id', disputeId);
    expect(evidence.error).toBeNull();
    expect(evidence.data).toEqual([]);
  });

  test('cannot attach evidence to the dispute', async () => {
    const row = await stranger.client.from('dispute_evidence').insert({
      dispute_id: disputeId, uploaded_by: stranger.profileId,
      file_url: 'https://example.invalid/x.png', file_name: 'x.png',
    });
    expect(row.error?.code).toBe('42501');
    const upload = await stranger.client.storage.from(BUCKET).upload(`${disputeId}/stranger.png`, PNG, { contentType: 'image/png' });
    expect(upload.error).not.toBeNull();
  });

  test('cannot attach evidence in the name of the customer', async () => {
    const { error } = await stranger.client.from('dispute_evidence').insert({
      dispute_id: disputeId, uploaded_by: customerProfileId,
      file_url: 'https://example.invalid/x.png', file_name: 'x.png',
    });
    expect(error?.code).toBe('42501');
  });

  test('cannot read the stored file', async () => {
    const { data } = await stranger.client.storage.from(BUCKET).createSignedUrl(`${disputeId}/api.png`, 60);
    expect(data?.signedUrl).toBeUndefined();
  });
});

test.describe('what a customer may write', () => {
  const dispute = () => ({
    booking_id: bookingId, submitted_by: customerProfileId,
    dispute_type: 'cargo_damage', description: 'Front door forged',
  });

  test('cannot open a dispute that is already resolved', async () => {
    const { error } = await owner.client.from('disputes').insert({ ...dispute(), status: 'resolved' });
    expect(error?.code).toBe('42501');
  });

  test('cannot name someone else as the raiser', async () => {
    const { error } = await owner.client.from('disputes').insert({ ...dispute(), raised_by: stranger.id });
    expect(error?.code).toBe('42501');
  });
});

test.describe('insurance claim ownership', () => {
  test('a stranger cannot claim on someone else\'s booking', async () => {
    const { error } = await stranger.client.from('insurance_claims').insert({
      booking_id: bookingId, submitted_by: stranger.profileId, claim_type: 'cargo_damage',
    });
    expect(error?.code).toBe('42501');
  });

  test('a stranger cannot tie their claim to someone else\'s dispute', async () => {
    const { error } = await stranger.client.from('insurance_claims').insert({
      booking_id: strangerBookingId, dispute_id: seededDisputeId,
      submitted_by: stranger.profileId, claim_type: 'cargo_damage',
    });
    expect(error?.code).toBe('42501');
  });

  test('a customer can claim on their own booking with no dispute', async () => {
    const { error } = await stranger.client.from('insurance_claims').insert({
      booking_id: strangerBookingId, submitted_by: stranger.profileId, claim_type: 'cargo_damage',
    });
    expect(error).toBeNull();
    await adminClient().from('insurance_claims').delete().eq('booking_id', strangerBookingId);
  });
});

test.describe('support tickets', () => {
  test('a two-row user can file and read a ticket, and a stranger cannot read it', async () => {
    const { error: readErr } = await owner.client.from('support_tickets').select('id');
    expect(readErr).toBeNull();

    // requester_id and category are required, and neither page ref sends them yet. This
    // tests the policy only; the page is listed as a separate bug in the report.
    const { data, error } = await owner.client.from('support_tickets').insert({
      submitted_by: customerProfileId, requester_id: owner.id, category: 'other',
      subject: 'Front door test', description: 'Front door test',
    }).select('id').single();
    expect(error).toBeNull();

    const seen = await stranger.client.from('support_tickets').select('id').eq('id', data!.id);
    expect(seen.error).toBeNull();
    expect(seen.data).toEqual([]);
    await adminClient().from('support_tickets').delete().eq('id', data!.id);
  });

  test('a stranger cannot file a ticket in the name of the customer', async () => {
    const { error } = await stranger.client.from('support_tickets').insert({
      submitted_by: customerProfileId, requester_id: stranger.id, category: 'other', subject: 'Front door test',
    });
    expect(error?.code).toBe('42501');
  });
});

test.describe('role profile tables', () => {
  for (const [table, extra] of [
    ['transporter_profiles', { vehicle_type: 'bakkie' }],
    ['measurement_agent_profiles', {}],
  ] as const) {
    test(`${table}: the owner reads their row and a stranger cannot read or forge one`, async () => {
      const row = { full_name: 'Front Door Test', base_city: 'Durban', base_country: 'South Africa', ...extra };
      const { data, error } = await adminClient().from(table)
        .insert({ ...row, profile_id: customerProfileId }).select('id').single();
      expect(error).toBeNull();
      try {
        const own = await owner.client.from(table).select('id').eq('id', data!.id);
        expect(own.error).toBeNull();
        expect(own.data).toHaveLength(1);

        const other = await stranger.client.from(table).select('id').eq('id', data!.id);
        expect(other.error).toBeNull();
        expect(other.data).toEqual([]);

        const forged = await stranger.client.from(table).insert({ ...row, profile_id: operatorRowId });
        expect(forged.error?.code).toBe('42501');
      } finally {
        await adminClient().from(table).delete().eq('id', data!.id);
      }
    });
  }
});

test.describe('dispute page source', () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

  test('the live resolved status closes the dispute page', () => {
    const code = read('app/disputes/[id]/page.tsx');
    expect(code).toMatch(/RESOLVED_STATUSES\s*=\s*new Set\(\[[^\]]*'resolved'/);
    expect(code).toMatch(/UPLOAD_CLOSED\s*=\s*new Set\(\[[^\]]*'resolved'/);
    expect(code).toMatch(/^\s*resolved:\s*\{ label: 'Resolved'/m);
  });

  test('the picker offers goods_received bookings', () => {
    expect(read('app/disputes/new/page.tsx')).toMatch(/\.in\('status', \[[^\]]*'goods_received'/);
  });
});

test.describe('in the browser', () => {
  test('a resolved dispute shows as resolved with its notes and takes no uploads @browser', async ({ page }) => {
    test.setTimeout(120_000);
    await page.route('**/functions/v1/**', route => route.fulfill({ status: 200, json: { ok: true } }));
    await signInBrowser(page, owner);
    await page.goto(`/disputes/${seededDisputeId}`);
    await expect(page.getByText('Seeded resolution')).toBeVisible();
    await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test('the customer opens a dispute, attaches evidence and sees it; a stranger cannot @browser', async ({ page, browser }) => {
    test.setTimeout(180_000);
    // No Edge Function call may leave the test: no Paystack, no email.
    await page.route('**/functions/v1/**', route => route.fulfill({ status: 200, json: { ok: true } }));

    await signInBrowser(page, owner);
    await page.goto('/disputes/new');
    await page.locator('select').selectOption(bookingId);
    await page.getByText('Short Delivery').click();
    await page.locator('textarea').first().fill('Front door browser test');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/disputes\/[0-9a-f-]{36}$/);
    const browserDisputeId = page.url().split('/').pop() as string;
    const { data: saved } = await adminClient().from('disputes').select('submitted_by').eq('id', browserDisputeId).single();
    expect(saved?.submitted_by).toBe(customerProfileId);

    await page.locator('input[type="file"]').setInputFiles({ name: 'browser.png', mimeType: 'image/png', buffer: PNG });
    await page.locator('form button[type="submit"]').click();

    const link = page.locator('a', { hasText: 'browser.png' });
    await expect(link).toHaveAttribute('href', /\/object\/sign\/dispute-evidence\//);
    expect((await fetch((await link.getAttribute('href')) ?? '')).ok).toBe(true);

    const context = await browser.newContext();
    try {
      const strangerPage = await context.newPage();
      await strangerPage.route('**/functions/v1/**', route => route.fulfill({ status: 200, json: { ok: true } }));
      await signInBrowser(strangerPage, stranger);
      await strangerPage.goto(`/disputes/${browserDisputeId}`);
      await expect(strangerPage.getByText('Dispute not found or access denied.')).toBeVisible();
      await expect(strangerPage.getByText('browser.png')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('direct notification inserts', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });
  }

  // The top-level keys of each object passed to .from('notifications').insert({ ... }).
  function insertKeys(source: string): string[][] {
    const found: string[][] = [];
    const start = /\.from\('notifications'\)\s*\.insert\(\{/g;
    for (let match = start.exec(source); match; match = start.exec(source)) {
      const keys: string[] = [];
      let depth = 1;
      let atKey = true;
      for (let i = match.index + match[0].length; depth > 0 && i < source.length; i++) {
        const c = source[i];
        if (c === '{' || c === '(' || c === '[') depth++;
        else if (c === '}' || c === ')' || c === ']') depth--;
        else if (c === '`' || c === "'") i = source.indexOf(c, i + 1);
        else if (c === ',' && depth === 1) atKey = true;
        else if (depth === 1 && atKey && /[A-Za-z_]/.test(c)) {
          const key = /^\w+/.exec(source.slice(i))![0];
          keys.push(key);
          i += key.length - 1;
          atKey = false;
        }
      }
      found.push(keys);
    }
    return found;
  }

  test('every one is accepted by the live table', async () => {
    const db = adminClient();
    const failures: string[] = [];
    let checked = 0;
    for (const file of ['app', 'actions', 'services', 'components'].flatMap(sourceFiles)) {
      for (const keys of insertKeys(readFileSync(file, 'utf8'))) {
        checked++;
        const row = Object.fromEntries(keys.map(key => [
          key,
          key === 'metadata' ? {} : key === 'recipient_id' ? owner.id : 'front door test',
        ]));
        const { error } = await db.from('notifications').insert(row);
        if (error) failures.push(`${file} [${keys.join(', ')}]: ${error.message}`);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(18);
    expect(failures).toEqual([]);
  });
});
