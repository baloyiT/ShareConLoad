import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { adminClient, createTestUser, deleteTestUser, isStaleTestUser, signInBrowser, sweepTestUsers, TestUser } from './helpers/frontDoorUsers';
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

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await sweepTestUsers();
});

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
    compliance_rejection_reason: 'self-set',
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

  test('a client cannot clear a compliance rejection reason', async () => {
    const id = operator.operatorProfileId ?? '';
    await adminClient().from('operator_profiles').update({ compliance_rejection_reason: 'Rejected in a test' }).eq('id', id);
    try {
      const { error } = await operator.client.from('operator_profiles')
        .update({ compliance_rejection_reason: null }).eq('id', id);
      expect(error?.code).toBe(DENIED);
      expect((await operatorRow(id))?.compliance_rejection_reason).toBe('Rejected in a test');
    } finally {
      await adminClient().from('operator_profiles').update({ compliance_rejection_reason: null }).eq('id', id);
    }
  });

  for (const status of ['pending_verification', 'active_limited', 'active', 'trusted']) {
    test(`a client cannot move status to ${status}`, async () => {
      const { error } = await operator.client.from('operator_profiles')
        .update({ status }).eq('id', operator.operatorProfileId ?? '');
      expect(error?.code).toBe(DENIED);
      expect((await operatorRow(operator.operatorProfileId))?.status).toBe('draft');
    });
  }

  test.describe('signing from the live frontend', () => {
    const signedAt = '2026-11-04T10:00:00.000Z';

    test('the exact update production makes succeeds', async () => {
      const target = await newUser('operator');
      const { error } = await target.client.from('operator_profiles').update({
        service_agreement_signed_at: signedAt,
        service_agreement_version: 'v1',
        status: 'pending_verification',
      }).eq('profile_id', target.profileId);
      expect(error).toBeNull();
      const row = await operatorRow(target.operatorProfileId);
      expect(row?.status).toBe('pending_verification');
      expect(row?.service_agreement_version).toBe('v1');
    });

    test('the status change without a signed date fails', async () => {
      const target = await newUser('operator');
      const id = target.operatorProfileId ?? '';
      const { error } = await target.client.from('operator_profiles')
        .update({ status: 'pending_verification', service_agreement_version: 'v1' }).eq('id', id);
      expect(error?.code).toBe(DENIED);
      expect((await operatorRow(id))?.status).toBe('draft');
    });

    test('a date signed earlier does not allow the change on its own', async () => {
      const target = await newUser('operator');
      const id = target.operatorProfileId ?? '';
      await adminClient().from('operator_profiles')
        .update({ service_agreement_signed_at: signedAt }).eq('id', id);
      const { error } = await target.client.from('operator_profiles')
        .update({ status: 'pending_verification' }).eq('id', id);
      expect(error?.code).toBe(DENIED);
      expect((await operatorRow(id))?.status).toBe('draft');
    });

    for (const status of ['active', 'trusted', 'active_limited']) {
      test(`signing cannot move draft to ${status}`, async () => {
        const target = await newUser('operator');
        const id = target.operatorProfileId ?? '';
        const { error } = await target.client.from('operator_profiles')
          .update({ service_agreement_signed_at: signedAt, status }).eq('id', id);
        expect(error?.code).toBe(DENIED);
        expect((await operatorRow(id))?.status).toBe('draft');
      });
    }

    test('no other status change is allowed after signing', async () => {
      const target = await newUser('operator');
      const id = target.operatorProfileId ?? '';
      await target.client.from('operator_profiles').update({
        service_agreement_signed_at: signedAt,
        status: 'pending_verification',
      }).eq('id', id);

      for (const status of ['active', 'trusted', 'draft']) {
        const { error } = await target.client.from('operator_profiles').update({
          service_agreement_signed_at: '2026-11-05T10:00:00.000Z',
          status,
        }).eq('id', id);
        expect(error?.code).toBe(DENIED);
      }
      expect((await operatorRow(id))?.status).toBe('pending_verification');
    });
  });

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
      { compliance_rejection_reason: 'self-set' },
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

test.describe('test user sweep', () => {
  const now = Date.parse('2030-01-01T12:00:00Z');
  const old = '2030-01-01T11:00:00Z';

  test('only a test email older than 15 minutes is stale', () => {
    expect(isStaleTestUser('front-door-test-abc123@example.invalid', old, now)).toBe(true);
    expect(isStaleTestUser('front-door-test-abc123@example.invalid', '2030-01-01T11:50:00Z', now)).toBe(false);
    for (const email of ['support@shareconload.com', 'someone@example.invalid', 'front-door-test-abc@gmail.com', undefined]) {
      expect(isStaleTestUser(email, old, now)).toBe(false);
    }
  });

  test('a sweep leaves a user created moments ago', async () => {
    const user = await newUser('customer');
    await sweepTestUsers();
    const { data } = await adminClient().auth.admin.getUserById(user.id);
    expect(data.user?.email).toBe(user.email);
  });
});

test.describe('document status guard', () => {
  test.describe('compliance_documents', () => {
    let operator: TestUser;
    let admin: TestUser;
    const docType = 'identity';
    const path = () => `${operator.operatorProfileId}/${docType}.pdf`;

    // Exactly what app/operator/compliance/documents/page.tsx sends, on this branch and in production.
    const upload = () => operator.client.from('compliance_documents').upsert(
      {
        operator_profile_id: operator.operatorProfileId,
        doc_type: docType,
        file_url: path(),
        status: 'under_review',
        admin_notes: null,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'operator_profile_id,doc_type' },
    ).select('id, doc_type, file_url, status, admin_notes, uploaded_at').single();

    async function doc() {
      const { data, error } = await adminClient().from('compliance_documents')
        .select('*').eq('operator_profile_id', operator.operatorProfileId ?? '').eq('doc_type', docType).maybeSingle();
      expect(error).toBeNull();
      return data as Record<string, unknown> | null;
    }

    async function seed(extra: Record<string, unknown>) {
      const { error } = await adminClient().from('compliance_documents').insert({
        operator_profile_id: operator.operatorProfileId,
        doc_type: docType,
        file_url: path(),
        ...extra,
      });
      expect(error).toBeNull();
    }

    test.beforeAll(async () => {
      test.setTimeout(60_000);
      operator = await newUser('operator');
      admin = await newUser('admin');
    });

    test.beforeEach(async () => {
      await adminClient().from('compliance_documents').delete().eq('operator_profile_id', operator.operatorProfileId ?? '');
    });

    const reviewerFields: Record<string, unknown>[] = [
      { status: 'approved' },
      { status: 'rejected' },
      { admin_notes: 'self-set' },
      { reviewed_at: '2030-01-01T00:00:00Z' },
    ];

    for (const extra of reviewerFields) {
      test(`a client cannot upload with ${JSON.stringify(extra)}`, async () => {
        const { error } = await operator.client.from('compliance_documents').insert({
          operator_profile_id: operator.operatorProfileId, doc_type: docType, file_url: path(), ...extra,
        });
        expect(error?.code).toBe(DENIED);
        expect(await doc()).toBeNull();
      });

      test(`a client cannot update a document with ${JSON.stringify(extra)}`, async () => {
        await seed({});
        const before = await doc();
        const { error } = await operator.client.from('compliance_documents')
          .update(extra).eq('operator_profile_id', operator.operatorProfileId ?? '');
        expect(error?.code).toBe(DENIED);
        expect(await doc()).toEqual(before);
      });
    }

    test('a first upload goes in as under_review', async () => {
      const { data, error } = await upload();
      expect(error).toBeNull();
      expect(data?.status).toBe('under_review');
    });

    test('a client cannot approve through the upload upsert', async () => {
      await seed({});
      const { error } = await operator.client.from('compliance_documents').upsert(
        { operator_profile_id: operator.operatorProfileId, doc_type: docType, file_url: path(), status: 'approved' },
        { onConflict: 'operator_profile_id,doc_type' },
      );
      expect(error?.code).toBe(DENIED);
      expect((await doc())?.status).toBe('under_review');
    });

    test('re-uploading after a rejection goes back to review and clears the note', async () => {
      await seed({ status: 'rejected', admin_notes: 'Too blurry', reviewed_at: '2026-01-01T00:00:00Z' });
      const { data, error } = await upload();
      expect(error).toBeNull();
      expect(data?.status).toBe('under_review');
      expect(data?.admin_notes).toBeNull();
    });

    test('a rejected document cannot have its note replaced or its review date moved', async () => {
      await seed({ status: 'rejected', admin_notes: 'Too blurry', reviewed_at: '2026-01-01T00:00:00Z' });
      for (const update of [
        { status: 'under_review', admin_notes: 'self-set' },
        { status: 'under_review', admin_notes: null, reviewed_at: null },
      ]) {
        const { error } = await operator.client.from('compliance_documents')
          .update(update).eq('operator_profile_id', operator.operatorProfileId ?? '');
        expect(error?.code).toBe(DENIED);
      }
      expect((await doc())?.status).toBe('rejected');
    });

    test('an approved document cannot change while it stays approved', async () => {
      await seed({ status: 'approved', reviewed_at: '2026-01-01T00:00:00Z' });
      for (const update of [
        { file_url: `${operator.operatorProfileId}/other.pdf` },
        { doc_type: 'tax_clearance' },
        { uploaded_at: '2030-01-01T00:00:00Z' },
      ]) {
        const { error } = await operator.client.from('compliance_documents')
          .update(update).eq('operator_profile_id', operator.operatorProfileId ?? '');
        expect(error?.code).toBe(DENIED);
      }
      expect((await doc())?.file_url).toBe(path());
    });

    test('replacing an approved document sends it back to review', async () => {
      await seed({ status: 'approved', reviewed_at: '2026-01-01T00:00:00Z' });
      const { data, error } = await upload();
      expect(error).toBeNull();
      expect(data?.status).toBe('under_review');
    });

    test('an admin can still approve and reject', async () => {
      await seed({});
      const id = (await doc())?.id as string;
      for (const update of [
        { status: 'rejected', admin_notes: 'Too blurry', reviewed_at: new Date().toISOString() },
        { status: 'approved', admin_notes: null, reviewed_at: new Date().toISOString() },
      ]) {
        const { error } = await admin.client.from('compliance_documents').update(update).eq('id', id);
        expect(error).toBeNull();
      }
      expect((await doc())?.status).toBe('approved');
    });

    test('the service role can write the approved agreement as generate-agreement-pdf does', async () => {
      const { error } = await adminClient().from('compliance_documents').upsert(
        { operator_profile_id: operator.operatorProfileId, doc_type: 'service_agreement', file_url: 'x.pdf', status: 'approved' },
        { onConflict: 'operator_profile_id,doc_type' },
      );
      expect(error).toBeNull();
    });
  });

  test.describe('customer_kyc', () => {
    let customer: TestUser;
    let admin: TestUser;

    const details = () => ({
      profile_id: customer.profileId,
      full_name: 'Front Door Test',
      date_of_birth: null,
      id_type: 'passport',
      id_number: 'A1234567',
      phone_number: null,
      residential_address: null,
      status: 'pending_review',
    });

    // Exactly what actions/customerKycActions.ts sends, on this branch and in production.
    const saveDetails = () => customer.client.from('customer_kyc').update(details()).eq('profile_id', customer.profileId);
    const saveDocs = () => customer.client.from('customer_kyc').update({
      id_document_url: `${SUPABASE_URL}/storage/v1/object/public/customer-kyc/${customer.id}/id_document_url_1.pdf`,
      proof_of_address_url: null,
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
    }).eq('profile_id', customer.profileId);

    async function kyc() {
      const { data, error } = await adminClient().from('customer_kyc')
        .select('*').eq('profile_id', customer.profileId).maybeSingle();
      expect(error).toBeNull();
      return data as Record<string, unknown> | null;
    }

    async function seed(extra: Record<string, unknown>) {
      const { error } = await adminClient().from('customer_kyc').insert({ ...details(), ...extra });
      expect(error).toBeNull();
    }

    test.beforeAll(async () => {
      test.setTimeout(60_000);
      customer = await newUser('customer');
      admin = await newUser('admin');
    });

    test.beforeEach(async () => {
      await adminClient().from('customer_kyc').delete().eq('profile_id', customer.profileId);
    });

    const reviewerFields: Record<string, unknown>[] = [
      { status: 'verified' },
      { status: 'rejected' },
      { rejection_reason: 'self-set' },
      { reviewed_at: '2030-01-01T00:00:00Z' },
    ];

    for (const extra of reviewerFields) {
      test(`a customer cannot submit KYC with ${JSON.stringify(extra)}`, async () => {
        const { error } = await customer.client.from('customer_kyc').insert({ ...details(), ...extra });
        expect(error?.code).toBe(DENIED);
        expect(await kyc()).toBeNull();
      });

      test(`a customer cannot update KYC with ${JSON.stringify(extra)}`, async () => {
        await seed({});
        const before = await kyc();
        const { error } = await customer.client.from('customer_kyc').update(extra).eq('profile_id', customer.profileId);
        expect(error?.code).toBe(DENIED);
        expect(await kyc()).toEqual(before);
      });
    }

    test('the first submission still saves', async () => {
      const { error } = await customer.client.from('customer_kyc').insert(details());
      expect(error).toBeNull();
      expect((await saveDocs()).error).toBeNull();
      expect((await kyc())?.status).toBe('pending_review');
    });

    test('resubmitting after a rejection goes back to review and keeps the reason', async () => {
      await seed({ status: 'rejected', rejection_reason: 'Expired ID', reviewed_at: '2026-01-01T00:00:00Z' });
      expect((await saveDetails()).error).toBeNull();
      expect((await saveDocs()).error).toBeNull();
      const row = await kyc();
      expect(row?.status).toBe('pending_review');
      expect(row?.rejection_reason).toBe('Expired ID');
    });

    test('a rejection reason cannot be cleared', async () => {
      await seed({ status: 'rejected', rejection_reason: 'Expired ID', reviewed_at: '2026-01-01T00:00:00Z' });
      const { error } = await customer.client.from('customer_kyc')
        .update({ status: 'pending_review', rejection_reason: null }).eq('profile_id', customer.profileId);
      expect(error?.code).toBe(DENIED);
      expect((await kyc())?.rejection_reason).toBe('Expired ID');
    });

    test('verified details cannot change while the row stays verified', async () => {
      await seed({ status: 'verified', reviewed_at: '2026-01-01T00:00:00Z' });
      const { error } = await customer.client.from('customer_kyc')
        .update({ id_number: 'B7654321' }).eq('profile_id', customer.profileId);
      expect(error?.code).toBe(DENIED);
      expect((await kyc())?.id_number).toBe('A1234567');
    });

    test('resaving details on a verified row sends it back to review', async () => {
      await seed({ status: 'verified', reviewed_at: '2026-01-01T00:00:00Z' });
      expect((await saveDetails()).error).toBeNull();
      expect((await kyc())?.status).toBe('pending_review');
    });

    test('an admin can still verify and reject', async () => {
      await seed({});
      for (const update of [
        { status: 'rejected', rejection_reason: 'Expired ID', reviewed_at: new Date().toISOString() },
        { status: 'verified', rejection_reason: null, reviewed_at: new Date().toISOString() },
      ]) {
        const { error } = await admin.client.from('customer_kyc').update(update).eq('profile_id', customer.profileId);
        expect(error).toBeNull();
      }
      expect((await kyc())?.status).toBe('verified');
    });
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
    expect(chargeRetryDecision(400, { status: false })).toBe('unavailable');
    expect(chargeRetryDecision(404, { status: false })).toBe('unavailable');
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

  test('verify-payment answers neutrally when it cannot match, is in flight or Paystack errors', () => {
    const code = handler('verify-payment');
    expect(code.match(/confirming: true/g)).toHaveLength(2);
    expect(code).toContain("!paystackData.status || chargeState(paystackData.data?.status) === 'in_flight'");
  });

  test('the customer is never told money was received before it is confirmed', () => {
    const code = readFileSync(join(process.cwd(), 'app/payments/callback/page.tsx'), 'utf-8');
    expect(code).not.toContain('Payment received');
    expect(code).toContain('confirming your payment');
  });

  test('the payment page explains a 503 in plain words', () => {
    const code = readFileSync(join(process.cwd(), 'app/payments/[bookingId]/page.tsx'), 'utf-8');
    expect(code).toContain('context?.status === 503');
    expect(code).toContain('We could not check your last payment');
  });

  test('the webhook leaves a refunded payment alone', () => {
    const code = handler('paystack-webhook');
    const check = code.indexOf("existingPayment?.status === 'refunded'");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(code.indexOf("status:             'paid'"));
    expect(check).toBeLessThan(code.indexOf('await createPayoutRecord('));
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

test.describe('security list', () => {
  const anon = () => createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const png = () => new Blob(['front door test'], { type: 'image/png' });
  type Client = TestUser['client'];

  test.describe('storage access', () => {
    let owner: TestUser;
    let stranger: TestUser;
    let admin: TestUser;
    let shipper: TestUser;
    let agent: TestUser;
    let agentProfileId: string;
    let jobId: string;
    let containerId: string;
    let bookingId: string;
    let disputeId: string;
    const created: { bucket: string; path: string }[] = [];

    // Tracked before the attempt, because an exploit that still works leaves a file behind.
    async function put(client: Client, bucket: string, path: string, upsert: boolean) {
      created.push({ bucket, path });
      const { error } = await client.storage.from(bucket).upload(path, png(), { upsert });
      return error;
    }

    async function canRead(client: Client, bucket: string, path: string) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
      return !error && !!data?.signedUrl;
    }

    test.beforeAll(async () => {
      test.setTimeout(120_000);
      owner = await newUser('customer');
      stranger = await newUser('customer');
      admin = await newUser('admin');
      shipper = await newUser('customer');
      agent = await newUser('customer');
      const operator = await newUser('operator');
      const db = adminClient();

      // createTestUser adds a second customer row to the one on_auth_user_created makes. A real customer
      // has one, and the disputes policies raise 21000 on two, so a denial here could be that error.
      for (const user of [owner, stranger]) {
        const { error } = await db.from('profiles').delete().eq('user_id', user.id).neq('id', user.profileId);
        expect(error).toBeNull();
      }

      const { data: agentProfile, error: profileErr } = await db.from('profiles')
        .insert({ user_id: agent.id, role_type: 'measurement_agent' }).select('id').single();
      expect(profileErr).toBeNull();
      const { data: measurementAgent, error: agentErr } = await db.from('measurement_agent_profiles').insert({
        profile_id: agentProfile!.id, full_name: 'Front Door Test', base_city: 'Durban', base_country: 'South Africa',
      }).select('id').single();
      expect(agentErr).toBeNull();
      agentProfileId = measurementAgent!.id as string;

      const { data: job, error: jobErr } = await db.from('measurement_jobs').insert({
        shipper_profile_id: shipper.profileId, measurement_agent_profile_id: agentProfileId,
        pickup_address: '1 Test Road', pickup_city: 'Durban', pickup_country: 'South Africa',
        quoted_fee: 1, status: 'assigned',
      }).select('id').single();
      expect(jobErr).toBeNull();
      jobId = job!.id as string;

      const { data: container, error: containerErr } = await db.from('containers').insert({
        operator_id: operator.id,
        origin_country: 'South Africa', origin_city: 'Durban',
        destination_country: 'Ghana', destination_city: 'Tema',
        departure_date: '2030-01-01',
        total_capacity_cbm: 10, available_capacity_cbm: 10,
        load_type: 'LCL', price_per_cbm: 100, currency_code: 'USD', status: 'open',
      }).select('id').single();
      expect(containerErr).toBeNull();
      containerId = container!.id as string;

      const { data: booking, error: bookingErr } = await db.from('bookings').insert({
        container_id: containerId, customer_id: owner.id, total_cbm: 1, total_price: 1000, status: 'pending',
      }).select('id').single();
      expect(bookingErr).toBeNull();
      bookingId = booking!.id as string;

      const { data: dispute, error: disputeErr } = await db.from('disputes').insert({
        booking_id: bookingId, raised_by: owner.id, submitted_by: owner.profileId,
        dispute_type: 'cargo_damage', description: 'Front door test',
      }).select('id').single();
      expect(disputeErr).toBeNull();
      disputeId = dispute!.id as string;
    });

    test.afterAll(async () => {
      test.setTimeout(60_000);
      const db = adminClient();
      for (const { bucket, path } of created.splice(0)) {
        const { error } = await db.storage.from(bucket).remove([path]);
        if (error) console.error('could not remove test object', bucket, path, error.message);
      }
      if (jobId) await db.from('measurement_jobs').delete().eq('id', jobId);
      if (bookingId) await db.from('bookings').delete().eq('id', bookingId);
      if (containerId) await db.from('containers').delete().eq('id', containerId);
    });

    test.describe('agent-documents', () => {
      const bucket = 'agent-documents';
      const ownPath = () => `${owner.id}/doc_license_${Date.now()}.png`;

      test('the owner uploads as onboarding does and reads it back', async () => {
        const path = ownPath();
        expect(await put(owner.client, bucket, path, true)).toBeNull();
        expect(await canRead(owner.client, bucket, path)).toBe(true);
      });

      test('an admin can read it', async () => {
        const path = ownPath();
        expect(await put(owner.client, bucket, path, true)).toBeNull();
        expect(await canRead(admin.client, bucket, path)).toBe(true);
      });

      test('another signed-in user and an anonymous visitor cannot read it', async () => {
        const path = ownPath();
        expect(await put(owner.client, bucket, path, true)).toBeNull();
        expect(await canRead(stranger.client, bucket, path)).toBe(false);
        expect(await canRead(anon(), bucket, path)).toBe(false);
      });

      test('nobody can upload into another user\'s folder', async () => {
        expect(await put(stranger.client, bucket, `${owner.id}/planted_${Date.now()}.png`, false)).not.toBeNull();
        expect(await put(anon(), bucket, `${owner.id}/planted_anon_${Date.now()}.png`, false)).not.toBeNull();
      });
    });

    test.describe('measurement-report-photos', () => {
      const bucket = 'measurement-report-photos';
      const photoPath = (name: string) => `${agentProfileId}/${jobId}/${name}.png`;

      test('the assigned agent uploads as the job page does and reads it back', async () => {
        const path = photoPath('front');
        expect(await put(agent.client, bucket, path, true)).toBeNull();
        expect(await canRead(agent.client, bucket, path)).toBe(true);
      });

      test('the shipper of the job and an admin can read it', async () => {
        const path = photoPath('side');
        expect(await put(agent.client, bucket, path, true)).toBeNull();
        expect(await canRead(shipper.client, bucket, path)).toBe(true);
        expect(await canRead(admin.client, bucket, path)).toBe(true);
      });

      test('another signed-in user and an anonymous visitor cannot read it', async () => {
        const path = photoPath('back');
        expect(await put(agent.client, bucket, path, true)).toBeNull();
        expect(await canRead(stranger.client, bucket, path)).toBe(false);
        expect(await canRead(anon(), bucket, path)).toBe(false);
      });
    });

    test.describe('dispute-evidence', () => {
      const bucket = 'dispute-evidence';
      const evidencePath = () => `${disputeId}/${Date.now()}.png`;

      test('the bucket is private', async () => {
        const { data, error } = await adminClient().storage.getBucket(bucket);
        expect(error).toBeNull();
        expect(data?.public).toBe(false);
      });

      test('the person who raised the dispute uploads as the page does and reads it back', async () => {
        const path = evidencePath();
        expect(await put(owner.client, bucket, path, false)).toBeNull();
        expect(await canRead(owner.client, bucket, path)).toBe(true);
      });

      test('an admin can read it', async () => {
        const path = evidencePath();
        expect(await put(owner.client, bucket, path, false)).toBeNull();
        expect(await canRead(admin.client, bucket, path)).toBe(true);
      });

      test('another signed-in user cannot read it, and its public address is dead', async () => {
        const path = evidencePath();
        expect(await put(owner.client, bucket, path, false)).toBeNull();
        expect(await canRead(stranger.client, bucket, path)).toBe(false);
        const { data } = owner.client.storage.from(bucket).getPublicUrl(path);
        expect((await fetch(data.publicUrl)).ok).toBe(false);
      });

      test('another signed-in user cannot upload to the dispute, or to no dispute at all', async () => {
        expect(await put(stranger.client, bucket, `${disputeId}/planted_${Date.now()}.png`, false)).not.toBeNull();
        expect(await put(stranger.client, bucket, `${stranger.id}/loose_${Date.now()}.png`, false)).not.toBeNull();
      });

      test('the dispute page opens evidence through a signed link', async ({ page }) => {
        test.setTimeout(120_000);
        const path = evidencePath();
        expect(await put(owner.client, bucket, path, false)).toBeNull();
        const { data: url } = owner.client.storage.from(bucket).getPublicUrl(path);
        const { error } = await adminClient().from('dispute_evidence').insert([
          { dispute_id: disputeId, uploaded_by: owner.id, file_url: url.publicUrl, file_name: 'real.png' },
          { dispute_id: disputeId, uploaded_by: owner.id, file_url: 'https://example.invalid/x.png', file_name: 'outside.png' },
        ]);
        expect(error).toBeNull();

        await signInBrowser(page, owner);
        await page.goto(`/disputes/${disputeId}`);
        const link = page.locator('a', { hasText: 'real.png' });
        await expect(link).toHaveAttribute('href', /\/object\/sign\/dispute-evidence\//);
        expect((await fetch((await link.getAttribute('href')) ?? '')).ok).toBe(true);

        await expect(page.getByText('outside.png')).toBeVisible();
        await expect(page.locator('a[href*="example.invalid"]')).toHaveCount(0);
      });
    });
  });

  test.describe('role profile guards', () => {
    let admin: TestUser;

    test.beforeAll(async () => {
      test.setTimeout(60_000);
      admin = await newUser('admin');
    });

    test.describe('agent_profiles', () => {
      let agent: TestUser;
      let profileId: string;

      // Exactly what actions/agentActions.ts sends, on this branch and in production.
      const step1 = (status: string) => ({
        profile_id: profileId,
        business_name: 'Front Door Test',
        contact_person: null,
        phone_number: null,
        country: 'South Africa',
        operating_corridors: [],
        years_in_operation: null,
        service_description: null,
        status,
      });
      const update = (values: Record<string, unknown>) =>
        agent.client.from('agent_profiles').update(values).eq('profile_id', profileId);

      async function row() {
        const { data, error } = await adminClient().from('agent_profiles')
          .select('*').eq('profile_id', profileId).maybeSingle();
        expect(error).toBeNull();
        return data as Record<string, unknown> | null;
      }

      async function seed(extra: Record<string, unknown>) {
        const { error } = await adminClient().from('agent_profiles').insert({ ...step1('draft'), ...extra });
        expect(error).toBeNull();
      }

      test.beforeAll(async () => {
        test.setTimeout(60_000);
        agent = await newUser('customer');
        const { data, error } = await agent.client.from('profiles')
          .insert({ user_id: agent.id, role_type: 'agent' }).select('id').single();
        expect(error).toBeNull();
        profileId = data!.id as string;
      });

      test.beforeEach(async () => {
        await adminClient().from('agent_profiles').delete().eq('profile_id', profileId);
      });

      for (const extra of [
        { status: 'approved' },
        { status: 'rejected' },
        { status: 'pending_review' },
        { rejection_reason: 'self-set' },
      ] as Record<string, unknown>[]) {
        test(`a client cannot insert with ${JSON.stringify(extra)}`, async () => {
          const { error } = await agent.client.from('agent_profiles').insert({ ...step1('draft'), ...extra });
          expect(error?.code).toBe(DENIED);
          expect(await row()).toBeNull();
        });
      }

      test('the whole onboarding still works, up to submitting for review', async () => {
        const { error: insertErr } = await agent.client.from('agent_profiles').insert(step1('draft'));
        expect(insertErr).toBeNull();
        for (const values of [
          step1('draft'),
          { license_number: 'L1', license_authority: 'A', license_expiry: '2030-01-01', registration_number: 'R1' },
          { doc_license_url: 'x', doc_business_reg_url: null, doc_identity_url: 'y', doc_proof_address_url: null },
          { bank_name: 'B', bank_account_holder: 'H', bank_account_number: '1', bank_branch_code: '2' },
          { status: 'pending_review' },
        ]) {
          const { error } = await update(values);
          expect(error).toBeNull();
        }
        expect((await row())?.status).toBe('pending_review');
      });

      for (const from of ['draft', 'pending_review', 'rejected']) {
        test(`a client cannot approve a ${from} application`, async () => {
          await seed({ status: from });
          const { error } = await update({ status: 'approved' });
          expect(error?.code).toBe(DENIED);
          expect((await row())?.status).toBe(from);
        });
      }

      test('a client cannot write the rejection reason', async () => {
        await seed({ status: 'rejected', rejection_reason: 'From the admin' });
        const { error } = await update({ rejection_reason: null });
        expect(error?.code).toBe(DENIED);
      });

      test('a client cannot change an approved row to rejected', async () => {
        await seed({ status: 'approved' });
        const { error } = await update({ status: 'rejected' });
        expect(error?.code).toBe(DENIED);
      });

      test('a rejected agent can start again and resubmit', async () => {
        await seed({ status: 'rejected', rejection_reason: 'From the admin' });
        expect((await update(step1('draft'))).error).toBeNull();
        expect((await update({ status: 'pending_review' })).error).toBeNull();
        expect((await row())?.status).toBe('pending_review');
      });

      test('an approved agent can edit step 1 and stays approved', async () => {
        await seed({ status: 'approved' });
        const { error } = await update({ ...step1('approved'), business_name: 'Edited' });
        expect(error).toBeNull();
        expect(await row()).toMatchObject({ status: 'approved', business_name: 'Edited' });
      });

      test('an admin can approve and reject, as the signed-in admin', async () => {
        await seed({ status: 'pending_review' });
        const decide = (values: Record<string, unknown>) =>
          admin.client.from('agent_profiles').update(values).eq('profile_id', profileId);
        expect((await decide({ status: 'rejected', rejection_reason: 'No' })).error).toBeNull();
        expect((await decide({ status: 'approved', rejection_reason: null })).error).toBeNull();
        expect((await row())?.status).toBe('approved');
      });
    });

    for (const { table, roleType, fields, reviewFields } of [
      {
        table: 'measurement_agent_profiles',
        roleType: 'measurement_agent',
        // Exactly what actions/measurementAgentActions.ts sends, on this branch and in production.
        fields: {
          full_name: 'Front Door Test', phone_number: '1', base_city: 'Durban', base_country: 'South Africa',
          id_document_url: 'x', selfie_url: 'y', equipment_photo_url: 'z',
        },
        reviewFields: [
          { certification_test_passed: true },
          { service_agreement_signed_at: '2030-01-01T00:00:00Z' },
        ],
      },
      {
        table: 'transporter_profiles',
        roleType: 'transporter',
        // Exactly what actions/transporterActions.ts sends, on this branch and in production.
        fields: {
          full_name: 'Front Door Test', phone_number: '1', base_city: 'Durban', base_country: 'South Africa',
          vehicle_type: 'bakkie', vehicle_capacity_kg: null, vehicle_capacity_cbm: null,
          vehicle_registration_number: 'R', drivers_licence_url: 'a', vehicle_ownership_url: 'b',
          vehicle_photo_1_url: 'c', vehicle_photo_2_url: 'd', vehicle_photo_3_url: 'e', vehicle_photo_4_url: 'f',
        },
        reviewFields: [],
      },
    ] as { table: string; roleType: string; fields: Record<string, unknown>; reviewFields: Record<string, unknown>[] }[]) {
      test.describe(table, () => {
        let user: TestUser;
        let profileId: string;

        const body = () => ({ profile_id: profileId, ...fields });

        async function row() {
          const { data, error } = await adminClient().from(table)
            .select('*').eq('profile_id', profileId).maybeSingle();
          expect(error).toBeNull();
          return data as Record<string, unknown> | null;
        }

        test.beforeAll(async () => {
          test.setTimeout(60_000);
          user = await newUser('customer');
          const { data, error } = await user.client.from('profiles')
            .insert({ user_id: user.id, role_type: roleType }).select('id').single();
          expect(error).toBeNull();
          profileId = data!.id as string;
        });

        test.beforeEach(async () => {
          await adminClient().from(table).delete().eq('profile_id', profileId);
        });

        for (const extra of [
          { status: 'approved' },
          { status: 'rejected' },
          { status: 'suspended' },
          { rejection_reason: 'self-set' },
          { payout_enabled: true },
          { payout_hold: true },
          { paystack_recipient_code: 'RCP_front_door_test' },
          { average_rating: 5 },
          { total_jobs_completed: 99 },
          ...reviewFields,
        ] as Record<string, unknown>[]) {
          test(`a client cannot insert with ${JSON.stringify(extra)}`, async () => {
            const { error } = await user.client.from(table).insert({ ...body(), ...extra });
            expect(error?.code).toBe(DENIED);
            expect(await row()).toBeNull();
          });
        }

        test('onboarding still inserts the application as pending', async () => {
          const { error } = await user.client.from(table).insert(body());
          expect(error).toBeNull();
          expect(await row()).toMatchObject({ status: 'pending', payout_enabled: false });
        });

        test('a client still cannot change the row afterwards', async () => {
          expect((await adminClient().from(table).insert(body())).error).toBeNull();
          await user.client.from(table).update({ status: 'approved', payout_enabled: true }).eq('profile_id', profileId);
          expect(await row()).toMatchObject({ status: 'pending', payout_enabled: false });
        });

        test('an admin can approve and reject, as the signed-in admin', async () => {
          expect((await adminClient().from(table).insert(body())).error).toBeNull();
          const decide = (values: Record<string, unknown>) =>
            admin.client.from(table).update(values).eq('profile_id', profileId);
          expect((await decide({ status: 'rejected', rejection_reason: 'No' })).error).toBeNull();
          expect((await decide({ status: 'approved', rejection_reason: null })).error).toBeNull();
          expect((await row())?.status).toBe('approved');
        });

        test('the service role can set the payout fields', async () => {
          expect((await adminClient().from(table).insert(body())).error).toBeNull();
          const { error } = await adminClient().from(table)
            .update({ payout_enabled: true, paystack_recipient_code: 'RCP_front_door_test' }).eq('profile_id', profileId);
          expect(error).toBeNull();
        });
      });
    }
  });

  test.describe('file address guards', () => {
    test.describe('compliance_documents.file_url', () => {
      let operator: TestUser;
      let other: TestUser;
      let admin: TestUser;
      const docType = 'tax_clearance';

      const upload = (fileUrl: string) => operator.client.from('compliance_documents').upsert(
        {
          operator_profile_id: operator.operatorProfileId,
          doc_type: docType,
          file_url: fileUrl,
          status: 'under_review',
          admin_notes: null,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'operator_profile_id,doc_type' },
      ).select('id').single();

      test.beforeAll(async () => {
        test.setTimeout(60_000);
        operator = await newUser('operator');
        other = await newUser('operator');
        admin = await newUser('admin');
      });

      test.beforeEach(async () => {
        await adminClient().from('compliance_documents').delete().eq('operator_profile_id', operator.operatorProfileId ?? '');
      });

      test('the path the page builds is accepted, first time and on a re-upload', async () => {
        const path = `${operator.operatorProfileId}/${docType}.pdf`;
        expect((await upload(path)).error).toBeNull();
        expect((await upload(path)).error).toBeNull();
      });

      for (const [name, build] of [
        ['another operator\'s file', (o: TestUser, x: TestUser) => `${x.operatorProfileId}/identity.pdf`],
        ['a path with no folder', () => 'identity.pdf'],
        ['a climb out of the folder', (o: TestUser, x: TestUser) => `${o.operatorProfileId}/../${x.operatorProfileId}/identity.pdf`],
        ['a nested path', (o: TestUser) => `${o.operatorProfileId}/a/identity.pdf`],
        ['a backslash climb', (o: TestUser, x: TestUser) => `${o.operatorProfileId}/.%2e\\${x.operatorProfileId}\\identity.pdf`],
      ] as [string, (o: TestUser, x: TestUser) => string][]) {
        test(`insert refuses ${name}`, async () => {
          const { error } = await upload(build(operator, other));
          expect(error?.code).toBe(DENIED);
        });

        test(`update refuses ${name}`, async () => {
          expect((await upload(`${operator.operatorProfileId}/${docType}.pdf`)).error).toBeNull();
          const { error } = await operator.client.from('compliance_documents')
            .update({ file_url: build(operator, other) }).eq('operator_profile_id', operator.operatorProfileId ?? '');
          expect(error?.code).toBe(DENIED);
        });
      }

      test('an admin and the service role are not limited', async () => {
        expect((await upload(`${operator.operatorProfileId}/${docType}.pdf`)).error).toBeNull();
        const set = (client: Client, fileUrl: string) => client.from('compliance_documents')
          .update({ file_url: fileUrl }).eq('operator_profile_id', operator.operatorProfileId ?? '');
        expect((await set(admin.client, 'moved-by-admin.pdf')).error).toBeNull();
        expect((await set(adminClient(), `${operator.operatorProfileId}/service_agreement_v1_1.pdf`)).error).toBeNull();
      });
    });

    test.describe('customer_kyc addresses', () => {
      let customer: TestUser;
      let other: TestUser;
      let admin: TestUser;

      const objectUrl = (ownerId: string, name: string, bucket = 'customer-kyc') =>
        `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${ownerId}/${name}`;
      const update = (values: Record<string, unknown>) =>
        customer.client.from('customer_kyc').update({ ...values, status: 'pending_review' }).eq('profile_id', customer.profileId);

      test.beforeAll(async () => {
        test.setTimeout(60_000);
        customer = await newUser('customer');
        other = await newUser('customer');
        admin = await newUser('admin');
      });

      test.beforeEach(async () => {
        const db = adminClient();
        await db.from('customer_kyc').delete().eq('profile_id', customer.profileId);
        const { error } = await db.from('customer_kyc').insert({
          profile_id: customer.profileId, full_name: 'Front Door Test', id_type: 'passport', id_number: 'A1',
        });
        expect(error).toBeNull();
      });

      test('what the documents page sends is accepted', async () => {
        const { error } = await update({
          id_document_url: objectUrl(customer.id, 'id_document_url_1.pdf'),
          proof_of_address_url: null,
        });
        expect(error).toBeNull();
        expect((await update({
          id_document_url: objectUrl(customer.id, 'id_document_url_2.pdf'),
          proof_of_address_url: objectUrl(customer.id, 'proof_of_address_url_2.my%20scan'),
        })).error).toBeNull();
      });

      test('saving the details step leaves the addresses alone', async () => {
        expect((await update({ id_document_url: objectUrl(customer.id, 'id.pdf') })).error).toBeNull();
        expect((await update({ full_name: 'Edited' })).error).toBeNull();
      });

      for (const column of ['id_document_url', 'proof_of_address_url']) {
        for (const [name, build] of [
          ['another user\'s file', (c: TestUser, o: TestUser) => objectUrl(o.id, 'id.pdf')],
          ['another bucket', (c: TestUser) => objectUrl(c.id, 'id.pdf', 'compliance-documents')],
          ['an outside address', () => 'https://example.invalid/id.pdf'],
          ['a climb out of the folder', (c: TestUser, o: TestUser) => objectUrl(c.id, `../${o.id}/id.pdf`)],
          ['an encoded climb', (c: TestUser, o: TestUser) => objectUrl(c.id, `..%2F${o.id}%2Fid.pdf`)],
          ['a backslash climb', (c: TestUser, o: TestUser) => objectUrl(c.id, `.%2e\\${o.id}\\id.pdf`)],
        ] as [string, (c: TestUser, o: TestUser) => string][]) {
          test(`${column} refuses ${name}`, async () => {
            const { error } = await update({ [column]: build(customer, other) });
            expect(error?.code).toBe(DENIED);
          });
        }
      }

      test('an insert is checked too', async () => {
        await adminClient().from('customer_kyc').delete().eq('profile_id', customer.profileId);
        const { error } = await customer.client.from('customer_kyc').insert({
          profile_id: customer.profileId, full_name: 'Front Door Test', id_type: 'passport', id_number: 'A1',
          id_document_url: objectUrl(other.id, 'id.pdf'), status: 'pending_review',
        });
        expect(error?.code).toBe(DENIED);
      });

      test('an admin is not limited', async () => {
        const { error } = await admin.client.from('customer_kyc')
          .update({ id_document_url: 'https://example.invalid/id.pdf' }).eq('profile_id', customer.profileId);
        expect(error).toBeNull();
      });
    });
  });

  test.describe('anonymous access', () => {
    let customer: TestUser;
    let agent: TestUser;
    let agentProfileId: string;

    const jobCount = async () => {
      const { data, error } = await adminClient().from('measurement_agent_profiles')
        .select('total_jobs_completed').eq('id', agentProfileId).single();
      expect(error).toBeNull();
      return data?.total_jobs_completed as number;
    };

    test.beforeAll(async () => {
      test.setTimeout(60_000);
      customer = await newUser('customer');
      agent = await newUser('customer');
      const db = adminClient();
      const { data: profile, error: profileErr } = await db.from('profiles')
        .insert({ user_id: agent.id, role_type: 'measurement_agent' }).select('id').single();
      expect(profileErr).toBeNull();
      const { data, error } = await db.from('measurement_agent_profiles').insert({
        profile_id: profile!.id, full_name: 'Front Door Test', base_city: 'Durban', base_country: 'South Africa',
      }).select('id').single();
      expect(error).toBeNull();
      agentProfileId = data!.id as string;
    });

    test('fire_departure_notices cannot be called by a visitor or a signed-in user', async () => {
      expect((await anon().rpc('fire_departure_notices')).error?.code).toBe(DENIED);
      expect((await customer.client.rpc('fire_departure_notices')).error?.code).toBe(DENIED);
    });

    test('increment_agent_jobs cannot be called by a visitor', async () => {
      const before = await jobCount();
      expect((await anon().rpc('increment_agent_jobs', { agent_id: agentProfileId })).error?.code).toBe(DENIED);
      expect(await jobCount()).toBe(before);
    });

    test('the agent page can still count a finished job', async () => {
      const before = await jobCount();
      const { error } = await agent.client.rpc('increment_agent_jobs', { agent_id: agentProfileId });
      expect(error).toBeNull();
      expect(await jobCount()).toBe(before + 1);
    });

    test('operator_rating_summary is closed to visitors and open to signed-in users', async () => {
      expect((await anon().from('operator_rating_summary').select('user_id').limit(1)).error?.code).toBe(DENIED);
      expect((await customer.client.from('operator_rating_summary').select('user_id').limit(1)).error).toBeNull();
    });
  });

  test.describe('hard-coded passwords', () => {
    const known = new RegExp(['Customer', 'Operator', 'Agent', 'Admin'].map(r => `Test${r}@2026`).join('|'));

    test('none are left in the test setup, scripts or guides', () => {
      for (const file of [
        'tests/rls.spec.ts', 'tests/admin.setup.ts', 'tests/auth.setup.ts', 'tests/customer.setup.ts',
        'tests/operator.setup.ts', 'scripts/capture-screenshots.js', 'docs/test-plan.md',
        'docs/superpowers/plans/2026-06-20-user-guides.md',
        'Test Case/Agent/profile.json', 'Test Case/Customer/profile.json', 'Test Case/Operator/profile.json',
      ]) {
        expect(readFileSync(join(process.cwd(), file), 'utf-8'), file).not.toMatch(known);
      }
    });

    test('the script that reset real accounts to a known password is gone', () => {
      expect(existsSync(join(process.cwd(), 'tests/create-test-users.mjs'))).toBe(false);
    });
  });
});
