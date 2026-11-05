import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { adminClient, createTestUser, deleteTestUser, TestUser } from './helpers/frontDoorUsers';
import type { DirectoryOperator, OperatorCoverage } from '../services/freightTypes';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const anon = () => createClient(SUPABASE_URL, SUPABASE_ANON);

// Must match v_hourly_cap in get_operator_contact.
const CONTACT_VIEW_HOURLY_CAP = 60;

// Unique per run, so route searches only ever find this file's operators.
const tag = randomBytes(4).toString('hex');
const FROM = `Fromland ${tag}`;
const TO   = `Toland ${tag}`;
const OTHER = `Otherland ${tag}`;
const ANY_MODE_FROM = `Anyland ${tag}`;
const NAME_FROM = `Nameland ${tag}`;
const PRIVATE_LEGAL_NAME = `Private Person ${tag}`;
const TRADING_NAME = `Aardvark Freight ${tag}`;
const COMPANY_LEGAL_NAME = `Zebra Shipping Ltd ${tag}`;

const PHONE = '+27 11 000 0000';
const EMAIL = `front-door-public-${tag}@example.invalid`;
const BANK_ACCOUNT = `9${tag}`;
const ID_NUMBER = `ID${tag}`;
const PAYSTACK_CODE = `RCP_${tag}`;
const PRIVATE_PHONE = `+27 82 ${tag}`;

type CoverageSeed = Pick<OperatorCoverage, 'origin_country' | 'destination_country'>
  & Partial<Pick<OperatorCoverage, 'origin_city' | 'destination_city' | 'transport_mode'>>;

async function serviceId(slug: string): Promise<string> {
  const { data, error } = await adminClient().from('service_categories')
    .select('id').eq('slug', slug).single();
  expect(error).toBeNull();
  return data?.id as string;
}

async function seedOperator(
  user: TestUser,
  fields: Record<string, unknown>,
  coverage: CoverageSeed[],
  serviceSlug = 'sea-freight',
): Promise<string> {
  const admin = adminClient();
  const id = user.operatorProfileId ?? '';
  const { error } = await admin.from('operator_profiles').update({
    legal_name: `Directory Test ${tag}`,
    public_description: 'We move freight.',
    public_phone: PHONE,
    public_email: EMAIL,
    verification_level: 'business_verified',
    participation_status: 'active',
    participation_terms_accepted_at: new Date().toISOString(),
    participation_terms_version: 'test',
    phone_number: PRIVATE_PHONE,
    bank_account_number: BANK_ACCOUNT,
    bank_account_name: 'Private Name',
    paystack_recipient_code: PAYSTACK_CODE,
    id_number: ID_NUMBER,
    ...fields,
  }).eq('id', id);
  expect(error).toBeNull();

  const { error: svcErr } = await admin.from('operator_services')
    .insert({ operator_profile_id: id, service_category_id: await serviceId(serviceSlug) });
  expect(svcErr).toBeNull();

  const { error: covErr } = await admin.from('operator_coverage')
    .insert(coverage.map(c => ({ ...c, operator_profile_id: id })));
  expect(covErr).toBeNull();
  return id;
}

async function search(params: Record<string, string> = {}): Promise<DirectoryOperator[]> {
  const { data, error } = await anon().rpc('search_directory', params);
  expect(error).toBeNull();
  return (data ?? []) as DirectoryOperator[];
}

const ids = (rows: DirectoryOperator[]) => rows.map(r => r.id);

async function viewCount(id: string): Promise<number> {
  const { count, error } = await adminClient().from('operator_contact_views')
    .select('id', { count: 'exact', head: true }).eq('operator_profile_id', id);
  expect(error).toBeNull();
  return count ?? 0;
}

test.describe('Front door: public directory data', () => {
  // Country-wide coverage with a null mode, and only a sea service.
  let countryWide: TestUser;
  // Two city-specific rows that must not combine into one route.
  let cityOnly: TestUser;
  // Null-mode coverage and a service with no mode (forwarding), on its own route.
  let modeless: TestUser;
  let suspended: TestUser;
  let unverified: TestUser;
  // Display name rules, all on their own route.
  let namedIndividual: TestUser;
  let blankIndividual: TestUser;
  let spacesIndividual: TestUser;
  let plainCompany: TestUser;
  let tradingCompany: TestUser;
  let customer: TestUser;
  let adminUser: TestUser;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    countryWide = await createTestUser('operator');
    cityOnly = await createTestUser('operator');
    modeless = await createTestUser('operator');
    suspended = await createTestUser('operator');
    unverified = await createTestUser('operator');
    namedIndividual = await createTestUser('operator', { entityType: 'individual' });
    blankIndividual = await createTestUser('operator', { entityType: 'individual' });
    spacesIndividual = await createTestUser('operator', { entityType: 'individual' });
    plainCompany = await createTestUser('operator', { entityType: 'company' });
    tradingCompany = await createTestUser('operator', { entityType: 'company' });
    customer = await createTestUser('customer');
    adminUser = await createTestUser('admin');

    await seedOperator(countryWide, {}, [{ origin_country: FROM, destination_country: TO }]);
    await seedOperator(cityOnly, {}, [
      { origin_country: FROM, origin_city: 'Alpha', destination_country: OTHER, destination_city: 'Gamma', transport_mode: 'air' },
      { origin_country: OTHER, origin_city: 'Delta', destination_country: TO, destination_city: 'Beta', transport_mode: 'air' },
    ], 'air-freight');
    await seedOperator(modeless, {}, [{ origin_country: ANY_MODE_FROM, destination_country: TO }], 'forwarding');
    const route = [{ origin_country: FROM, destination_country: TO }];
    await seedOperator(suspended, { participation_status: 'suspended' }, route);
    await seedOperator(unverified, { verification_level: 'registered' }, route);

    const nameRoute = [{ origin_country: NAME_FROM, destination_country: TO }];
    const individual = { legal_name: PRIVATE_LEGAL_NAME, verification_level: 'identity_verified' };
    await seedOperator(namedIndividual, { ...individual, trading_name: `  ${TRADING_NAME}  ` }, nameRoute);
    await seedOperator(blankIndividual, individual, nameRoute);
    await seedOperator(spacesIndividual, { ...individual, trading_name: '   ' }, nameRoute);
    await seedOperator(plainCompany, { legal_name: COMPANY_LEGAL_NAME, trading_name: '  ' }, nameRoute);
    await seedOperator(tradingCompany, { legal_name: 'Aaa Hidden Registered Name', trading_name: `Mongoose Cargo ${tag}` }, nameRoute);
  });

  test.afterAll(async () => {
    test.setTimeout(240_000);
    for (const user of [countryWide, cityOnly, modeless, suspended, unverified, namedIndividual, blankIndividual,
      spacesIndividual, plainCompany, tradingCompany, customer, adminUser]) {
      if (user) await deleteTestUser(user);
    }
  });

  test('an individual with a trading name shows it, trimmed, and never the legal name', async () => {
    const id = namedIndividual.operatorProfileId ?? '';
    const { data, error } = await anon().rpc('get_directory_operator', { op_id: id });
    expect(error).toBeNull();
    expect((data as DirectoryOperator[])[0].display_name).toBe(TRADING_NAME);
    expect(JSON.stringify(data)).not.toContain(PRIVATE_LEGAL_NAME);

    const rows = await search({ p_origin_country: NAME_FROM });
    expect(rows.find(r => r.id === id)?.display_name).toBe(TRADING_NAME);
    expect(JSON.stringify(rows)).not.toContain(PRIVATE_LEGAL_NAME);
  });

  test('an individual with a blank trading name is not listed', async () => {
    for (const user of [blankIndividual, spacesIndividual]) {
      const id = user.operatorProfileId ?? '';
      const listed = await anon().rpc('operator_is_listed', { op_id: id });
      expect(listed.data).toBe(false);
      const direct = await anon().rpc('get_directory_operator', { op_id: id });
      expect(direct.data ?? []).toHaveLength(0);
      const contact = await anon().rpc('get_operator_contact', { op_id: id });
      expect(contact.data ?? []).toHaveLength(0);
      expect(ids(await search({ p_origin_country: NAME_FROM }))).not.toContain(id);
    }
  });

  test('a company falls back to legal_name, and a trading name replaces it', async () => {
    const rows = await search({ p_origin_country: NAME_FROM });
    expect(rows.find(r => r.id === plainCompany.operatorProfileId)?.display_name).toBe(COMPANY_LEGAL_NAME);
    expect(rows.find(r => r.id === tradingCompany.operatorProfileId)?.display_name).toBe(`Mongoose Cargo ${tag}`);
    expect(JSON.stringify(rows)).not.toContain('Aaa Hidden Registered Name');
  });

  test('search results sort on the name shown, not the legal name', async () => {
    const rows = await search({ p_origin_country: NAME_FROM });
    expect(rows.map(r => r.display_name)).toEqual([TRADING_NAME, `Mongoose Cargo ${tag}`, COMPANY_LEGAL_NAME]);
  });

  test('anon cannot select from operator_profiles', async () => {
    const { data } = await anon().from('operator_profiles')
      .select('id').eq('id', countryWide.operatorProfileId ?? '');
    expect(data ?? []).toHaveLength(0);

    const { data: all } = await anon().from('operator_profiles').select('id').limit(5);
    expect(all ?? []).toHaveLength(0);
  });

  test('anon cannot select from compliance_documents', async () => {
    // Removed with the operator: the foreign key cascades.
    const id = countryWide.operatorProfileId ?? '';
    const { error: seedErr } = await adminClient().from('compliance_documents')
      .insert({ operator_profile_id: id, doc_type: 'identity', file_url: `test/${tag}.pdf` });
    expect(seedErr).toBeNull();

    const { data } = await anon().from('compliance_documents').select('id').eq('operator_profile_id', id);
    expect(data ?? []).toHaveLength(0);

    const { data: all } = await anon().from('compliance_documents').select('id').limit(5);
    expect(all ?? []).toHaveLength(0);
  });

  test('search result keys contain no bank, paystack, id_number or phone fields', async () => {
    const [row] = await search({ p_origin_country: FROM, p_service: 'sea-freight' });
    expect(row).toBeDefined();
    expect(Object.keys(row).sort()).toEqual([
      'coverage', 'display_name', 'id', 'public_description', 'services', 'verification_level',
    ]);
    expect(Object.keys(row).join(',')).not.toMatch(/bank|paystack|id_number|phone|email/i);

    const text = JSON.stringify(row);
    for (const secret of [BANK_ACCOUNT, ID_NUMBER, PAYSTACK_CODE, PRIVATE_PHONE, PHONE, EMAIL]) {
      expect(text).not.toContain(secret);
    }
  });

  test('a directory row has the agreed shape', async () => {
    const { data, error } = await anon().rpc('get_directory_operator', { op_id: countryWide.operatorProfileId });
    expect(error).toBeNull();
    const rows = (data ?? []) as DirectoryOperator[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: countryWide.operatorProfileId,
      display_name: `Directory Test ${tag}`,
      public_description: 'We move freight.',
      verification_level: 'business_verified',
      services: ['Sea freight'],
    });
    expect(rows[0].coverage).toEqual([expect.objectContaining({
      operator_profile_id: countryWide.operatorProfileId,
      origin_country: FROM,
      origin_city: null,
      destination_country: TO,
      destination_city: null,
      transport_mode: null,
    })]);
  });

  test('search with no filters returns only listed operators', async () => {
    const rows = await search();
    const found = ids(rows);
    expect(found).toContain(countryWide.operatorProfileId);
    expect(found).toContain(cityOnly.operatorProfileId);
    expect(found).not.toContain(suspended.operatorProfileId);
    expect(found).not.toContain(unverified.operatorProfileId);

    for (const id of found) {
      const { data } = await anon().rpc('operator_is_listed', { op_id: id });
      expect(data).toBe(true);
    }
  });

  test('country-wide coverage matches a search for a city in that country', async () => {
    const found = ids(await search({
      p_origin_country: FROM, p_origin_city: 'Anywhere',
      p_destination_country: TO, p_destination_city: 'Elsewhere',
    }));
    expect(found).toEqual([countryWide.operatorProfileId]);
  });

  test('a city row matches its own city, in any letter case, and no other', async () => {
    const hit = ids(await search({ p_origin_country: FROM.toUpperCase(), p_origin_city: ' alpha ' }));
    expect(hit).toContain(cityOnly.operatorProfileId);

    const miss = ids(await search({ p_origin_country: FROM, p_origin_city: 'Anywhere' }));
    expect(miss).not.toContain(cityOnly.operatorProfileId);
  });

  test('a city with no country does not match country-wide coverage', async () => {
    const found = ids(await search({ p_origin_city: `Nowhere ${tag}` }));
    expect(found).toEqual([]);
  });

  test('origin and destination must be on the same coverage row', async () => {
    const found = ids(await search({ p_origin_city: 'Alpha', p_destination_city: 'Beta' }));
    expect(found).not.toContain(cityOnly.operatorProfileId);
  });

  test('mode and service filters narrow the result', async () => {
    const route = { p_origin_country: FROM };

    const air = ids(await search({ ...route, p_mode: 'air' }));
    expect(air).toEqual([cityOnly.operatorProfileId]);

    const service = ids(await search({ ...route, p_service: 'air-freight' }));
    expect(service).toEqual([cityOnly.operatorProfileId]);
  });

  test('a sea-only operator with null-mode coverage shows in a sea search, not an air search', async () => {
    const route = { p_origin_country: FROM };
    expect(ids(await search({ ...route, p_mode: 'sea' }))).toEqual([countryWide.operatorProfileId]);
    expect(ids(await search({ ...route, p_mode: 'air' }))).not.toContain(countryWide.operatorProfileId);
  });

  test('an operator with null-mode coverage and a mode-less service shows in every mode', async () => {
    for (const mode of ['sea', 'air', 'road', 'rail']) {
      const found = ids(await search({ p_origin_country: ANY_MODE_FROM, p_mode: mode }));
      expect(found).toEqual([modeless.operatorProfileId]);
    }
  });

  test('an unknown mode returns no rows, even for null-mode coverage', async () => {
    for (const mode of ['spaceship', '%']) {
      expect(await search({ p_origin_country: FROM, p_mode: mode })).toEqual([]);
      expect(await search({ p_origin_country: ANY_MODE_FROM, p_mode: mode })).toEqual([]);
    }
  });

  test('blank filters count as no filter, and hostile input is only ever data', async () => {
    const blank = ids(await search({ p_origin_country: FROM, p_origin_city: '  ', p_mode: '', p_service: '' }));
    expect(blank).toContain(countryWide.operatorProfileId);

    for (const value of [`%`, `_`, `' or 1=1 --`, `'; drop table operator_contact_views; --`, 'x'.repeat(10_000)]) {
      expect(await search({ p_origin_country: value })).toEqual([]);
      expect(await search({ p_service: value })).toEqual([]);
      expect(await search({ p_mode: value })).toEqual([]);
    }
  });

  test('suspended operator: get_directory_operator and get_operator_contact return no rows', async () => {
    for (const user of [suspended, unverified]) {
      const id = user.operatorProfileId ?? '';
      const profile = await anon().rpc('get_directory_operator', { op_id: id });
      expect(profile.error).toBeNull();
      expect(profile.data ?? []).toHaveLength(0);

      const contact = await anon().rpc('get_operator_contact', { op_id: id });
      expect(contact.error).toBeNull();
      expect(contact.data ?? []).toHaveLength(0);

      expect(await viewCount(id)).toBe(0);
    }
  });

  test('an unknown operator id returns no rows and writes nothing', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    const contact = await anon().rpc('get_operator_contact', { op_id: unknown });
    expect(contact.error).toBeNull();
    expect(contact.data ?? []).toHaveLength(0);
    expect(await viewCount(unknown)).toBe(0);
  });

  test('get_operator_contact records one view and creates no lead', async () => {
    const id = countryWide.operatorProfileId ?? '';
    const admin = adminClient();
    const submissions = async () => {
      const { count, error } = await admin.from('contact_submissions')
        .select('id', { count: 'exact', head: true });
      expect(error).toBeNull();
      return count;
    };

    const before = await viewCount(id);
    const submissionsBefore = await submissions();

    const { data, error } = await anon().rpc('get_operator_contact', { op_id: id });
    expect(error).toBeNull();
    expect(data).toEqual([{ public_phone: PHONE, public_email: EMAIL }]);

    expect(await viewCount(id)).toBe(before + 1);
    expect(await submissions()).toBe(submissionsBefore);
  });

  test('contact views stop growing at the hourly cap, but the contact is still returned', async () => {
    const id = cityOnly.operatorProfileId ?? '';
    const admin = adminClient();
    const rows = Array.from({ length: CONTACT_VIEW_HOURLY_CAP }, () => ({ operator_profile_id: id }));
    const { error: seedErr } = await admin.from('operator_contact_views').insert(rows);
    expect(seedErr).toBeNull();

    const { data, error } = await anon().rpc('get_operator_contact', { op_id: id });
    expect(error).toBeNull();
    expect(data).toEqual([{ public_phone: PHONE, public_email: EMAIL }]);
    expect(await viewCount(id)).toBe(CONTACT_VIEW_HOURLY_CAP);

    // Views older than an hour do not count against the cap.
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { error: ageErr } = await admin.from('operator_contact_views')
      .update({ viewed_at: old }).eq('operator_profile_id', id);
    expect(ageErr).toBeNull();
    await anon().rpc('get_operator_contact', { op_id: id });
    expect(await viewCount(id)).toBe(CONTACT_VIEW_HOURLY_CAP + 1);
  });

  test('operator_contact_views: admin read only, no client writes', async () => {
    const id = countryWide.operatorProfileId ?? '';
    await anon().rpc('get_operator_contact', { op_id: id });

    const anonRead = await anon().from('operator_contact_views').select('id').eq('operator_profile_id', id);
    expect(anonRead.data ?? []).toHaveLength(0);

    const customerRead = await customer.client.from('operator_contact_views').select('id').eq('operator_profile_id', id);
    expect(customerRead.data ?? []).toHaveLength(0);

    const ownerRead = await countryWide.client.from('operator_contact_views').select('id').eq('operator_profile_id', id);
    expect(ownerRead.data ?? []).toHaveLength(0);

    const adminRead = await adminUser.client.from('operator_contact_views').select('id').eq('operator_profile_id', id);
    expect(adminRead.error).toBeNull();
    expect((adminRead.data ?? []).length).toBeGreaterThan(0);

    const before = await viewCount(id);
    for (const client of [anon(), customer.client, countryWide.client, adminUser.client]) {
      const insert = await client.from('operator_contact_views').insert({ operator_profile_id: id }).select();
      expect(insert.error).not.toBeNull();
      await client.from('operator_contact_views').delete().eq('operator_profile_id', id);
      await client.from('operator_contact_views').update({ viewed_at: new Date(0).toISOString() }).eq('operator_profile_id', id);
    }
    expect(await viewCount(id)).toBe(before);
    const { data: backdated } = await adminClient().from('operator_contact_views')
      .select('viewed_at').eq('operator_profile_id', id).lt('viewed_at', '2000-01-01');
    expect(backdated ?? []).toHaveLength(0);
  });
});
