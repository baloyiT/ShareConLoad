import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { adminClient, createTestUser, deleteTestUser, TestUser } from './helpers/frontDoorUsers';
import {
  bearerToken,
  decideEmail,
  escapeHtml,
  isCronRequest,
  isServiceRole,
  requireAdmin,
  requireUser,
  safeEqual,
  SUPPORT_EMAIL,
} from '../supabase/functions/_shared/auth';
import { chargeRetryDecision, chargeState, transferReference } from '../supabase/functions/_shared/payments';
import { callbackOutcome } from '../services/paymentCallback';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// 42501 is what the guard triggers raise.
const DENIED = '42501';

const users: TestUser[] = [];

async function newUser(...args: Parameters<typeof createTestUser>): Promise<TestUser> {
  const user = await createTestUser(...args);
  users.push(user);
  return user;
}

async function operatorRow(id: string | undefined) {
  const { data, error } = await adminClient().from('operator_profiles')
    .select('*').eq('id', id ?? '').maybeSingle();
  expect(error).toBeNull();
  return data as Record<string, unknown> | null;
}

// The customer row that on_auth_user_created gives every user: a profile with no operator row.
async function customerProfileId(user: TestUser): Promise<string> {
  const { data, error } = await adminClient().from('profiles')
    .select('id').eq('user_id', user.id).eq('role_type', 'customer').limit(1).single();
  expect(error).toBeNull();
  return data?.id as string;
}

test.afterAll(async () => {
  test.setTimeout(180_000); // one delete per user, well past the default hook timeout
  for (const user of users.splice(0)) await deleteTestUser(user);
});

test.describe('operator self-edit guard', () => {
  let operator: TestUser;
  let admin: TestUser;

  test.beforeAll(async () => {
    test.setTimeout(60_000);
    operator = await newUser('operator');
    admin = await newUser('admin');
  });

  const blockedUpdates: Record<string, unknown> = {
    payout_enabled: true,
    payout_hold: true,
    payout_hold_reason: 'self-set',
    paystack_recipient_code: 'RCP_selfset',
    bank_code: '999',
    bank_account_number: '1234567890',
    bank_account_name: 'Self Set',
    bank_name: 'Self Bank',
    bank_country: 'Ghana',
    bank_swift_code: 'SELFSET0',
    bank_confirmation_letter_url: 'https://example.invalid/letter.pdf',
    payout_method: 'manual',
    phone_verified: true,
  };

  for (const [field, value] of Object.entries(blockedUpdates)) {
    test(`a client cannot change ${field}`, async () => {
      const before = await operatorRow(operator.operatorProfileId);
      const { error } = await operator.client.from('operator_profiles')
        .update({ [field]: value }).eq('id', operator.operatorProfileId ?? '');
      expect(error?.code).toBe(DENIED);
      expect((await operatorRow(operator.operatorProfileId))?.[field]).toEqual(before?.[field]);
    });
  }

  for (const status of ['pending_verification', 'active_limited', 'active', 'trusted']) {
    test(`a client cannot move status to ${status}`, async () => {
      const { error } = await operator.client.from('operator_profiles')
        .update({ status }).eq('id', operator.operatorProfileId ?? '');
      expect(error?.code).toBe(DENIED);
      expect((await operatorRow(operator.operatorProfileId))?.status).toBe('draft');
    });
  }

  test('the service role can write what create-transfer-recipient and generate-agreement-pdf write', async () => {
    const target = await newUser('operator');
    const { error } = await adminClient().from('operator_profiles').update({
      bank_account_name: 'Test Name',
      bank_account_number: '1234567890',
      bank_name: 'Test Bank',
      bank_code: '632005',
      bank_country: 'South Africa',
      bank_swift_code: null,
      payout_method: 'paystack',
      paystack_recipient_code: 'RCP_test',
      status: 'pending_verification',
    }).eq('id', target.operatorProfileId ?? '');
    expect(error).toBeNull();
    const row = await operatorRow(target.operatorProfileId);
    expect(row?.paystack_recipient_code).toBe('RCP_test');
    expect(row?.status).toBe('pending_verification');
  });

  test('an admin can still approve, reject and control payouts', async () => {
    const target = await newUser('operator');
    const id = target.operatorProfileId ?? '';
    const updates: Record<string, unknown>[] = [
      { status: 'active', compliance_rejection_reason: null },
      { status: 'draft', compliance_rejection_reason: 'Rejected in a test' },
      { payout_enabled: true },
      { payout_hold: true, payout_hold_reason: 'Held in a test' },
      { payout_hold: false, payout_hold_reason: null },
    ];
    for (const update of updates) {
      const { error } = await admin.client.from('operator_profiles').update(update).eq('id', id);
      expect(error).toBeNull();
    }
    const row = await operatorRow(id);
    expect(row?.status).toBe('draft');
    expect(row?.payout_enabled).toBe(true);
    expect(row?.payout_hold).toBe(false);
  });

  test('the compliance profile and contact forms still save', async () => {
    const id = operator.operatorProfileId ?? '';
    const { error: profileErr } = await operator.client.from('operator_profiles').update({
      entity_type: 'company',
      legal_name: 'Front Door Renamed',
      registration_number: '2026/000001/07',
      vat_number: '4000000000',
      id_type: null,
      id_number: null,
    }).eq('id', id);
    expect(profileErr).toBeNull();

    const { error: contactErr } = await operator.client.from('operator_profiles').update({
      contact_person: 'Test Person',
      phone_number: '+27000000000',
      address: '1 Test Road',
      country: 'South Africa',
    }).eq('id', id);
    expect(contactErr).toBeNull();
  });

  test('identity numbers are editable until verified, then locked', async () => {
    const target = await newUser('operator', { entityType: 'individual' });
    const id = target.operatorProfileId ?? '';

    const { error: earlyErr } = await target.client.from('operator_profiles')
      .update({ id_type: 'passport', id_number: 'A1234567', registration_number: 'EARLY' }).eq('id', id);
    expect(earlyErr).toBeNull();

    const { error: verifyErr } = await adminClient().from('operator_profiles')
      .update({ verification_level: 'identity_verified' }).eq('id', id);
    expect(verifyErr).toBeNull();

    for (const update of [{ registration_number: 'LATE' }, { id_number: 'B7654321' }, { id_type: 'national_id' }]) {
      const { error } = await target.client.from('operator_profiles').update(update).eq('id', id);
      expect(error?.code).toBe(DENIED);
    }

    const row = await operatorRow(id);
    expect(row?.id_number).toBe('A1234567');
    expect(row?.registration_number).toBe('EARLY');

    // Saving the form with the values unchanged still works.
    const { error: sameErr } = await target.client.from('operator_profiles')
      .update({ id_type: 'passport', id_number: 'A1234567', phone_number: '+27000000001' }).eq('id', id);
    expect(sameErr).toBeNull();

    const { error: adminErr } = await admin.client.from('operator_profiles')
      .update({ id_number: 'C0000000' }).eq('id', id);
    expect(adminErr).toBeNull();
  });

  test.describe('insert', () => {
    const blockedInserts: Record<string, unknown>[] = [
      { status: 'active' },
      { status: 'trusted' },
      { status: 'pending_verification' },
      { payout_enabled: true },
      { payout_hold_reason: 'self-set' },
      { paystack_recipient_code: 'RCP_selfset' },
      { bank_code: '999' },
      { bank_account_number: '1234567890' },
      { bank_account_name: 'Self Set' },
      { bank_confirmation_letter_url: 'https://example.invalid/letter.pdf' },
      { payout_method: 'manual' },
      { phone_verified: true },
      { status: null },
      { verification_level: null },
    ];

    for (const extra of blockedInserts) {
      test(`a client cannot create a row with ${JSON.stringify(extra)}`, async () => {
        const profileId = await customerProfileId(operator);
        const { error } = await operator.client.from('operator_profiles')
          .insert({ profile_id: profileId, legal_name: 'Second Row', entity_type: 'company', ...extra });
        expect(error?.code).toBe(DENIED);
        // A row that got through would make every later case fail for the wrong reason.
        await adminClient().from('operator_profiles').delete().eq('profile_id', profileId);
      });
    }

    test('onboarding can create a draft row', async () => {
      const target = await newUser('operator');
      const profileId = await customerProfileId(target);
      const { error } = await target.client.from('operator_profiles').insert({
        profile_id: profileId,
        entity_type: 'individual',
        legal_name: 'Onboarding Test',
        registration_number: null,
        vat_number: null,
        contact_person: null,
        id_type: 'passport',
        id_number: 'A1234567',
        country: 'South Africa',
        phone_number: '+27000000000',
        status: 'draft',
      });
      expect(error).toBeNull();
    });
  });

  test.describe('delete', () => {
    test('an owner cannot delete their operator row or wipe acceptances', async () => {
      const target = await newUser('operator');
      const id = target.operatorProfileId ?? '';
      const { error: seedErr } = await adminClient().from('agreement_acceptances').insert({
        operator_profile_id: id,
        user_id: target.id,
        agreement_type: 'operator_service_agreement',
        version: 'front-door-test',
        agreement_text: 'Test agreement',
      });
      expect(seedErr).toBeNull();

      const { error: rowErr } = await target.client.from('operator_profiles').delete().eq('id', id);
      expect(rowErr?.code).toBe(DENIED);

      // Deleting the parent profile would cascade, and a cascade runs as the table owner.
      const { error: parentErr } = await target.client.from('profiles').delete().eq('id', target.profileId);
      expect(parentErr?.code).toBe(DENIED);

      expect(await operatorRow(id)).not.toBeNull();
      const { data } = await adminClient().from('agreement_acceptances')
        .select('id').eq('operator_profile_id', id);
      expect(data).toHaveLength(1);
    });

    test('onboarding can still remove an orphaned profile row', async () => {
      const target = await newUser('operator');
      const profileId = await customerProfileId(target);
      const { error } = await target.client.from('profiles').delete().eq('id', profileId);
      expect(error).toBeNull();
      const { data } = await adminClient().from('profiles').select('id').eq('id', profileId);
      expect(data).toHaveLength(0);
    });

    test('an admin and the service role can delete operator rows', async () => {
      const first = await newUser('operator');
      const { error: adminErr } = await admin.client.from('operator_profiles')
        .delete().eq('id', first.operatorProfileId ?? '');
      expect(adminErr).toBeNull();
      expect(await operatorRow(first.operatorProfileId)).toBeNull();

      const second = await newUser('operator');
      const { error: serviceErr } = await adminClient().from('operator_profiles')
        .delete().eq('id', second.operatorProfileId ?? '');
      expect(serviceErr).toBeNull();
      expect(await operatorRow(second.operatorProfileId)).toBeNull();
    });
  });
});

test.describe('payments table', () => {
  test('a customer cannot insert payments, and a booking still gets its three stages', async () => {
    test.setTimeout(60_000);
    const service = adminClient();
    const operator = await newUser('operator');
    const customer = await newUser('customer');

    const { data: container, error: containerErr } = await service.from('containers').insert({
      operator_id: operator.id,
      origin_country: 'South Africa',
      origin_city: 'Durban',
      destination_country: 'Ghana',
      destination_city: 'Tema',
      departure_date: '2030-01-01',
      total_capacity_cbm: 10,
      available_capacity_cbm: 10,
      price_per_cbm: 100,
    }).select('id').single();
    expect(containerErr).toBeNull();
    const containerId = container?.id as string;

    try {
      const { data: booking, error: bookingErr } = await customer.client.from('bookings').insert({
        container_id: containerId,
        customer_id: customer.id,
        total_cbm: 1,
        total_price: 100,
      }).select('id').single();
      expect(bookingErr).toBeNull();
      const bookingId = booking?.id as string;

      const { data: rows } = await service.from('payments')
        .select('stage, amount, status').eq('booking_id', bookingId);
      expect((rows ?? []).map(r => [r.stage, Number(r.amount), r.status]).sort()).toEqual([
        ['deposit_20', 20, 'pending'],
        ['final_release_30', 30, 'pending'],
        ['pre_departure_50', 50, 'pending'],
      ]);

      const fake = {
        booking_id: bookingId,
        payer_id: customer.id,
        payment_stage: 'manual_adjustment',
        stage: 'manual_adjustment',
        amount: 0,
      };
      for (const extra of [{ status: 'paid' }, { status: 'pending' }]) {
        const { error } = await customer.client.from('payments').insert({ ...fake, ...extra });
        expect(error?.code).toBe(DENIED);
      }

      const { error: duplicateErr } = await service.from('payments').insert({
        booking_id: bookingId,
        payer_id: customer.id,
        payment_stage: 'deposit_20',
        stage: 'deposit_20',
        amount: 20,
      });
      expect(duplicateErr?.code).toBe('23505');

      const { data: after } = await service.from('payments').select('id').eq('booking_id', bookingId);
      expect(after).toHaveLength(3);
    } finally {
      await service.from('bookings').delete().eq('container_id', containerId);
      await service.from('containers').delete().eq('id', containerId);
    }
  });
});

test.describe('scheduled payout entry point', () => {
  // A call that got through would post to the Edge Function and start a payout batch. pg_net is
  // not installed on this project, so before the fix it stops with an error at that line and
  // nothing is sent.
  test('clients cannot call auto_trigger_payouts_cron', async () => {
    const customer = await newUser('customer');
    const clients = [createClient(SUPABASE_URL, SUPABASE_ANON), customer.client];
    for (const client of clients) {
      const { error } = await client.rpc('auto_trigger_payouts_cron');
      expect(['42501', 'PGRST202']).toContain(error?.code);
    }
  });
});

test.describe('Edge Function authorisation', () => {
  const env: Record<string, string> = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  };
  const denoGlobal = globalThis as unknown as { Deno?: unknown };

  test.beforeAll(() => {
    denoGlobal.Deno = { env: { get: (key: string) => env[key] } };
  });
  test.afterAll(() => {
    delete denoGlobal.Deno;
  });

  const request = (headers: Record<string, string> = {}) =>
    new Request('http://localhost/function', { method: 'POST', headers });

  async function tokenOf(user: TestUser): Promise<string> {
    const { data } = await user.client.auth.getSession();
    return data.session?.access_token ?? '';
  }

  test('requireUser accepts a signed-in user and rejects everything else with 401', async () => {
    const customer = await newUser('customer');
    const ok = await requireUser(request({ Authorization: `Bearer ${await tokenOf(customer)}` }));
    expect(ok.error).toBeNull();
    expect(ok.user?.id).toBe(customer.id);

    const rejected: Record<string, string>[] = [
      {},
      { Authorization: 'Bearer not-a-token' },
      { Authorization: `Bearer ${SUPABASE_ANON}` },
      { Authorization: `Bearer ${SERVICE_KEY}` },
    ];
    for (const headers of rejected) {
      const denied = await requireUser(request(headers));
      expect(denied.user).toBeNull();
      expect(denied.error?.status).toBe(401);
      expect(await denied.error?.json()).toEqual({ error: expect.any(String) });
    }
  });

  test('requireAdmin returns 403 for customers and operators, 401 with no user', async () => {
    const customer = await newUser('customer');
    const operator = await newUser('operator');
    for (const user of [customer, operator]) {
      const denied = await requireAdmin(request({ Authorization: `Bearer ${await tokenOf(user)}` }));
      expect(denied.error?.status).toBe(403);
    }
    expect((await requireAdmin(request())).error?.status).toBe(401);
    expect((await requireAdmin(request({ Authorization: `Bearer ${SUPABASE_ANON}` }))).error?.status).toBe(401);
  });

  test('requireAdmin accepts is_admin on any role row, and role_type admin', async () => {
    const roleAdmin = await newUser('admin');
    const flagged = await newUser('customer');
    const { error } = await adminClient().from('profiles')
      .update({ is_admin: true }).eq('id', flagged.profileId);
    expect(error).toBeNull();
    const roleOnly = await newUser('customer');
    const { error: roleErr } = await adminClient().from('profiles')
      .update({ role_type: 'admin', is_admin: false }).eq('id', roleOnly.profileId);
    expect(roleErr).toBeNull();

    for (const user of [roleAdmin, flagged, roleOnly]) {
      const ok = await requireAdmin(request({ Authorization: `Bearer ${await tokenOf(user)}` }));
      expect(ok.error).toBeNull();
      expect(ok.user?.id).toBe(user.id);
    }
  });

  test('isServiceRole only accepts the exact service key', () => {
    expect(isServiceRole(request({ Authorization: `Bearer ${SERVICE_KEY}` }))).toBe(true);
    expect(isServiceRole(request({ Authorization: `Bearer ${SUPABASE_ANON}` }))).toBe(false);
    expect(isServiceRole(request())).toBe(false);
    env.SUPABASE_SERVICE_ROLE_KEY = '';
    expect(isServiceRole(request({ Authorization: 'Bearer ' }))).toBe(false);
    env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  });

  test('bearerToken and safeEqual', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('abc')).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  test('isCronRequest needs a configured secret that matches', () => {
    expect(isCronRequest('s3cret', 's3cret')).toBe(true);
    expect(isCronRequest('wrong', 's3cret')).toBe(false);
    expect(isCronRequest(null, 's3cret')).toBe(false);
    expect(isCronRequest('', '')).toBe(false);
    expect(isCronRequest(null, undefined)).toBe(false);
    expect(isCronRequest('', undefined)).toBe(false);
  });

  test('send-email decisions', () => {
    const allowed = { ok: true };
    const outsider = 'someone@example.invalid';

    // Service-role and admin callers: unchanged.
    expect(decideEmail({ caller: 'privileged', to: outsider, html: '<b>x</b>' })).toEqual(allowed);
    expect(decideEmail({ caller: 'privileged', recipientId: 'abc', html: '<b>x</b>' })).toEqual(allowed);

    // Signed-in callers.
    expect(decideEmail({ caller: 'user', recipientId: 'abc' })).toEqual(allowed);
    expect(decideEmail({ caller: 'user', to: SUPPORT_EMAIL })).toEqual(allowed);
    expect(decideEmail({ caller: 'user', to: outsider })).toMatchObject({ ok: false, status: 403 });
    expect(decideEmail({ caller: 'user', to: outsider, recipientId: 'abc' })).toMatchObject({ ok: false, status: 403 });
    expect(decideEmail({ caller: 'user', recipientId: 'abc', html: '<b>x</b>' })).toMatchObject({ ok: false, status: 403 });

    // Anonymous callers.
    expect(decideEmail({ caller: 'anonymous', to: SUPPORT_EMAIL })).toEqual(allowed);
    expect(decideEmail({ caller: 'anonymous', to: 'SUPPORT@shareconload.com ' })).toEqual(allowed);
    expect(decideEmail({ caller: 'anonymous', to: outsider })).toMatchObject({ ok: false, status: 403 });
    expect(decideEmail({ caller: 'anonymous', to: `${SUPPORT_EMAIL}, ${outsider}` })).toMatchObject({ ok: false, status: 403 });
    expect(decideEmail({ caller: 'anonymous', to: [SUPPORT_EMAIL, outsider] })).toMatchObject({ ok: false, status: 403 });
    expect(decideEmail({ caller: 'anonymous', recipientId: 'abc' })).toMatchObject({ ok: false, status: 401 });
    expect(decideEmail({ caller: 'anonymous', to: SUPPORT_EMAIL, recipientId: 'abc' })).toMatchObject({ ok: false, status: 401 });
    expect(decideEmail({ caller: 'anonymous', to: SUPPORT_EMAIL, html: '<b>x</b>' })).toMatchObject({ ok: false, status: 403 });
  });

  test('escapeHtml neutralises markup', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`))
      .toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  // The functions run on Deno and cannot be served here without reaching Paystack, so this
  // proves the order in the source: the check comes before the first Paystack call or write.
  function firstEffect(code: string): number {
    const positions = [/api\.paystack\.co/, /\.update\(/, /\.insert\(/, /\.upsert\(/, /api\.resend\.com/]
      .map(re => code.search(re))
      .filter(i => i >= 0);
    return Math.min(...positions);
  }

  function handler(name: string): string {
    const code = readFileSync(join(process.cwd(), 'supabase', 'functions', name, 'index.ts'), 'utf-8');
    return code.slice(code.indexOf('serve(async'));
  }

  for (const name of [
    'process-refund',
    'trigger-payout',
    'finalize-transfer',
    'trigger-measurement-agent-payout',
    'trigger-transporter-payout',
  ]) {
    test(`${name} requires an admin before anything else`, () => {
      const code = handler(name);
      const check = code.indexOf('await requireAdmin(req)');
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(code.indexOf('req.json()'));
      expect(check).toBeLessThan(firstEffect(code));
    });
  }

  for (const name of ['process-refund', 'trigger-payout']) {
    test(`${name} takes the admin id from the token, not the body`, () => {
      const code = handler(name);
      expect(code).not.toContain('adminProfileId');
      expect(code).toContain('auth.user.id');
    });
  }

  test('auto-trigger-payouts checks the schedule secret first', () => {
    const code = handler('auto-trigger-payouts');
    const check = code.indexOf('isCronRequest(');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(code.indexOf('createClient('));
    expect(check).toBeLessThan(firstEffect(code));
  });

  for (const [name, owner] of [
    ['verify-payment', 'customer_id !== auth.user.id'],
    ['verify-pickup-payment', '.eq(\'id\', job.shipper_profile_id)'],
    ['verify-measurement-payment', '.eq(\'id\', job.shipper_profile_id)'],
  ]) {
    test(`${name} checks ownership before Paystack`, () => {
      const code = handler(name);
      const check = code.indexOf(owner);
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(firstEffect(code));
    });
  }

  for (const name of ['initialize-payment', 'initialize-pickup-payment', 'initialize-measurement-payment']) {
    test(`${name} checks the caller before Paystack`, () => {
      const code = handler(name);
      const check = code.search(/Access denied|Forbidden/);
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(firstEffect(code));
    });
  }

  test('create-transfer-recipient checks the operator record is the caller\'s own', () => {
    const code = handler('create-transfer-recipient');
    const auth = code.indexOf('await requireUser(req)');
    const owner = code.indexOf('.eq(\'user_id\', auth.user.id)');
    expect(auth).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(owner);
    expect(owner).toBeLessThan(firstEffect(code));
  });

  for (const name of ['resolve-bank-account', 'get-banks']) {
    test(`${name} requires a signed-in user`, () => {
      const code = handler(name);
      const check = code.indexOf('await requireUser(req)');
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(firstEffect(code));
    });
  }

  test('paystack-webhook verifies the signature before anything else', () => {
    const code = handler('paystack-webhook');
    const check = code.indexOf('verifySignature(rawBody');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(firstEffect(code));
  });

  test('send-email decides before it reaches Resend', () => {
    const code = handler('send-email');
    const check = code.indexOf('decideEmail(');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(firstEffect(code));
    expect(code).toContain('escapeHtml(');
  });

  test('a stored charge is only replaced when Paystack says it took no money', () => {
    expect(chargeState('success')).toBe('charged');
    for (const status of ['abandoned', 'failed', 'reversed']) expect(chargeState(status)).toBe('not_charged');
    for (const status of ['ongoing', 'pending', 'processing', 'queued', 'something_new', undefined]) {
      expect(chargeState(status)).toBe('in_flight');
    }

    const answer = (status: string) => ({ status: true, data: { status } });
    expect(chargeRetryDecision(200, answer('success'))).toBe('confirming');
    expect(chargeRetryDecision(200, answer('ongoing'))).toBe('confirming');
    expect(chargeRetryDecision(200, answer('abandoned'))).toBe('new_charge');
    expect(chargeRetryDecision(200, answer('failed'))).toBe('new_charge');
    expect(chargeRetryDecision(400, { status: false })).toBe('new_charge');
    expect(chargeRetryDecision(404, { status: false })).toBe('new_charge');
    expect(chargeRetryDecision(401, { status: false })).toBe('unavailable');
    expect(chargeRetryDecision(500, {})).toBe('unavailable');
    expect(chargeRetryDecision(200, { status: false })).toBe('unavailable');
  });

  test('initialize-payment checks the last charge after ownership and before a new one', () => {
    const code = handler('initialize-payment');
    const owner = code.indexOf('Access denied');
    const check = code.indexOf('chargeRetryDecision(');
    const charge = code.indexOf('transaction/initialize');
    expect(owner).toBeGreaterThan(-1);
    expect(owner).toBeLessThan(check);
    expect(check).toBeLessThan(charge);
  });

  test('a refunded payment is not treated as awaiting confirmation or marked paid again', () => {
    expect(handler('initialize-payment')).toContain("payment.status === 'pending' && payment.paystack_reference");
    const verify = handler('verify-payment');
    expect(verify.indexOf("payment?.status === 'refunded'")).toBeGreaterThan(-1);
    expect(verify.indexOf("payment?.status === 'refunded'")).toBeLessThan(verify.indexOf("status:             'paid'"));
  });

  test('the callback only reports failure when the payment really failed', () => {
    expect(callbackOutcome({ success: true }, 200)).toBe('success');
    expect(callbackOutcome({ success: false, confirming: true }, 200)).toBe('confirming');
    expect(callbackOutcome(null, 401)).toBe('confirming');
    expect(callbackOutcome(null, 403)).toBe('confirming');
    expect(callbackOutcome(null, 500)).toBe('confirming');
    expect(callbackOutcome(null, null)).toBe('confirming');
    expect(callbackOutcome({ success: false }, 200)).toBe('failed');
    expect(callbackOutcome(null, 400)).toBe('failed');
  });

  test('verify-payment answers neutrally when it cannot match or is still in flight', () => {
    const code = handler('verify-payment');
    expect(code.match(/confirming: true/g)).toHaveLength(2);
  });

  test('transfer references are stable, valid for Paystack, and change only per attempt', () => {
    const id = '1A2B3C4D-0000-4000-8000-123456789ABC';
    const reference = transferReference('payout', id);
    expect(reference).toBe('scl-payout-1a2b3c4d000040008000123456789abc');
    expect(transferReference('payout', id)).toBe(reference);
    expect(transferReference('payout', id, 0)).toBe(reference);
    expect(transferReference('payout', id, 1)).toBe(`${reference}-r1`);
    expect(transferReference('agpay', id)).not.toBe(reference);
    expect(transferReference('tpay', id)).not.toBe(reference);

    for (const kind of ['payout', 'agpay', 'tpay'] as const) {
      const longest = transferReference(kind, id, 999);
      expect(longest.length).toBeLessThanOrEqual(50);
      expect(longest).toMatch(/^[a-z0-9_-]{16,50}$/);
    }

    for (const attempt of [-1, 1.5, 1000]) {
      expect(() => transferReference('payout', id, attempt)).toThrow(RangeError);
    }
  });

  for (const name of [
    'trigger-payout',
    'auto-trigger-payouts',
    'trigger-measurement-agent-payout',
    'trigger-transporter-payout',
  ]) {
    test(`${name} uses a stable transfer reference`, () => {
      const code = handler(name);
      expect(code).toContain('transferReference(');
      expect(code).not.toContain('Date.now()}');
    });
  }

  test('manual and scheduled payouts share a reference, so one cannot repeat the other', () => {
    expect(handler('trigger-payout')).toContain("transferReference('payout', payoutId, attempt)");
    expect(handler('auto-trigger-payouts')).toContain("transferReference('payout', payout.id)");
  });

  test('only an explicit retry of a failed payout gets a new attempt', () => {
    const code = handler('trigger-payout');
    expect(code).toContain("retryFailed === true && payout.status === 'failed'");
    expect(code).toContain("payout.status !== 'pending' && !retrying");
  });

  test('the transporter and agent pages no longer call the admin-only payouts', () => {
    for (const file of ['app/transporter/jobs/[id]/page.tsx', 'app/measurement-agent/jobs/[id]/page.tsx']) {
      const code = readFileSync(join(process.cwd(), file), 'utf-8');
      expect(code).not.toContain('functions/v1/trigger-');
    }
  });

  test('app callers of send-email do not send html', () => {
    for (const file of ['services/notificationService.ts', 'actions/operatorActions.ts']) {
      const code = readFileSync(join(process.cwd(), file), 'utf-8');
      expect(code).not.toContain('buildEmailHtml');
    }
  });
});
