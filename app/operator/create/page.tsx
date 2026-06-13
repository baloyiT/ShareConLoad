'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import PageHero from '@/components/PageHero';
import type { Location } from '@/services/locations';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContainerForm = {
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  arrival_date: string;
  total_capacity_cbm: string;
  price_per_cbm: string;
  currency_code: string;
};

type FormErrors = Partial<Record<keyof ContainerForm, string>> & { submit?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = [
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'XOF', label: 'XOF — West African CFA Franc' },
  { code: 'EGP', label: 'EGP — Egyptian Pound' },
];

const EMPTY_FORM: ContainerForm = {
  origin_country: '',
  origin_city: '',
  destination_country: '',
  destination_city: '',
  departure_date: '',
  arrival_date: '',
  total_capacity_cbm: '',
  price_per_cbm: '',
  currency_code: 'ZAR',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateContainerPage() {
  const router = useRouter();

  const [form, setForm] = useState<ContainerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [compliance, setCompliance] = useState<'loading' | 'ok' | 'blocked'>('loading');

  const [fxRates, setFxRates] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from('fx_rates')
      .select('currency_code, rate_to_usd')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((r: { currency_code: string; rate_to_usd: number }) => {
            map[r.currency_code] = r.rate_to_usd;
          });
          setFxRates(map);
        }
      });
  }, []);

  useEffect(() => {
    async function checkCompliance() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/operator/create'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .single();

      if (!profile) { setCompliance('blocked'); return; }

      const { data: op } = await supabase
        .from('operator_profiles')
        .select('id, legal_name, phone_number, paystack_recipient_code, service_agreement_signed_at')
        .eq('profile_id', profile.id)
        .single();

      if (!op) { setCompliance('blocked'); return; }

      const { count } = await supabase
        .from('compliance_documents')
        .select('id', { count: 'exact', head: true })
        .eq('operator_profile_id', op.id)
        .in('doc_type', ['identity', 'business_registration', 'proof_of_warehouse_address', 'tax_clearance', 'banking_confirmation', 'cargo_insurance'])
        .eq('status', 'approved');

      const compliant =
        !!op.legal_name &&
        !!op.phone_number &&
        !!op.paystack_recipient_code &&
        !!op.service_agreement_signed_at &&
        (count ?? 0) === 6;

      setCompliance(compliant ? 'ok' : 'blocked');
    }
    checkCompliance();
  }, [router]);

  // ── Field update ────────────────────────────────────────────────────────────
  function update(field: keyof ContainerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): FormErrors {
    const errs: FormErrors = {};
    const cbm = parseFloat(form.total_capacity_cbm);
    const price = parseFloat(form.price_per_cbm);

    if (!form.origin_city.trim() || !form.origin_country.trim())
      errs.origin_city = 'Select an origin location.';
    if (!form.destination_city.trim() || !form.destination_country.trim())
      errs.destination_city = 'Select a destination location.';
    if (!form.departure_date)            errs.departure_date     = 'Departure date is required.';

    if (form.arrival_date && form.arrival_date <= form.departure_date) {
      errs.arrival_date = 'Arrival must be after the departure date.';
    }

    if (!form.total_capacity_cbm || isNaN(cbm) || cbm <= 0) {
      errs.total_capacity_cbm = 'Enter a valid capacity greater than 0.';
    }

    if (!form.price_per_cbm || isNaN(price) || price <= 0) {
      errs.price_per_cbm = 'Enter a valid price greater than 0.';
    }

    return errs;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    setSubmitting(true);

    const cbm = parseFloat(form.total_capacity_cbm);
    const rate = fxRates[form.currency_code] ?? null;
    const priceUsd = rate ? Math.round(parseFloat(form.price_per_cbm) * rate * 100) / 100 : null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/operator/create'); return; }

      const { data, error } = await supabase
        .from('containers')
        .insert({
          operator_id: user.id,
          origin_country: form.origin_country.trim(),
          origin_city: form.origin_city.trim(),
          destination_country: form.destination_country.trim(),
          destination_city: form.destination_city.trim(),
          departure_date: form.departure_date,
          arrival_date: form.arrival_date || null,
          total_capacity_cbm: cbm,
          available_capacity_cbm: cbm,           // always equals total on creation
          price_per_cbm: parseFloat(form.price_per_cbm),
          currency_code: form.currency_code,
          price_per_cbm_usd: priceUsd,
          status: 'open',
        })
        .select('id')
        .single();

      if (error || !data) throw error ?? new Error('Insert returned no data');

      setCreatedId(data.id);
    } catch (err) {
      console.error('Container creation error:', err);
      setErrors({ submit: 'Failed to create container. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Compliance loading ──────────────────────────────────────────────────────
  if (compliance === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  // ── Compliance blocked ──────────────────────────────────────────────────────
  if (compliance === 'blocked') {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <PageHero showMap label="Operator Portal" title="Create a Container" />
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: '#fff7ed' }}
            >
              <svg className="w-8 h-8" style={{ color: '#f97316' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a5 5 0 00-5 5v1H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2h-2v-1a5 5 0 00-5-5z" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-gray-800 mb-2">Compliance Required</h2>
            <p className="text-gray-500 text-sm mb-1">
              You must complete your compliance profile before listing containers.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              All five steps must be approved: Profile, Contact, Account, Documents, and Service Agreement.
            </p>
            <Link
              href="/operator/compliance/profile"
              className="btn text-white font-bold rounded-xl w-full hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              Go to Compliance →
            </Link>
            <Link href="/operator" className="btn btn-ghost text-gray-400 rounded-xl w-full mt-2 text-sm">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (createdId) {
    return (
      <div className="flex items-center justify-center px-4 py-16 min-h-[70vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Container Created!</h1>
          <p className="text-gray-500 text-sm mb-1">
            Your container is now live and visible to customers.
          </p>
          <p className="text-xs text-gray-400 font-mono break-all mb-6">ID: {createdId}</p>

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-left flex flex-col gap-2.5 mb-6">
            <Row label="Route"     value={`${form.origin_city} → ${form.destination_city}`} />
            <Row label="Countries" value={`${form.origin_country} → ${form.destination_country}`} />
            <Row label="Departure" value={new Date(form.departure_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <Row label="Capacity"  value={`${form.total_capacity_cbm} CBM`} />
            <Row label="Price"     value={`R${parseFloat(form.price_per_cbm).toFixed(2)} / CBM`} />
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className="badge badge-sm text-white" style={{ backgroundColor: '#22c55e' }}>Open</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={`/container/${createdId}`}
              className="w-full btn text-white font-bold rounded-xl text-sm hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              View Container
            </Link>
            <button
              onClick={() => { setForm(EMPTY_FORM); setCreatedId(null); }}
              className="w-full btn btn-ghost rounded-xl text-sm text-gray-500"
            >
              Create Another
            </button>
            <Link href="/" className="w-full btn btn-ghost rounded-xl text-sm text-gray-400">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f8fafc]">

      <PageHero showMap label="Operator Portal" title="Create a Container" description="List your available container space for customers to book." />

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">

          {/* Global error */}
          {errors.submit && (
            <div className="alert alert-error text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
              {errors.submit}
            </div>
          )}

          {/* ── SECTION 1: Route ──────────────────────────────────────────── */}
          <Section step="1" title="Route">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <LocationAutocomplete
                label="Origin"
                cityField="origin_city"
                countryField="origin_country"
                required
                placeholder="e.g. Shanghai, China"
                error={errors.origin_city}
                onSelect={(loc: Location | null) => {
                  update('origin_city',    loc?.city    ?? '');
                  update('origin_country', loc?.country ?? '');
                  if (errors.origin_city) setErrors((p) => ({ ...p, origin_city: undefined }));
                }}
              />

              <LocationAutocomplete
                label="Destination"
                cityField="destination_city"
                countryField="destination_country"
                required
                placeholder="e.g. Lagos, Nigeria"
                error={errors.destination_city}
                onSelect={(loc: Location | null) => {
                  update('destination_city',    loc?.city    ?? '');
                  update('destination_country', loc?.country ?? '');
                  if (errors.destination_city) setErrors((p) => ({ ...p, destination_city: undefined }));
                }}
              />
            </div>

            {/* Route preview */}
            {(form.origin_city || form.destination_city) && (
              <div className="mt-4 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
                <span className="font-semibold text-gray-700">{form.origin_city || '-'}</span>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="font-semibold text-gray-700">{form.destination_city || '-'}</span>
                {form.origin_country && form.destination_country && (
                  <span className="text-gray-400 ml-auto text-xs">
                    {form.origin_country} → {form.destination_country}
                  </span>
                )}
              </div>
            )}
          </Section>

          {/* ── SECTION 2: Schedule ───────────────────────────────────────── */}
          <Section step="2" title="Schedule">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field
                label="Departure Date"
                required
                error={errors.departure_date}
              >
                <input
                  type="date"
                  value={form.departure_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => update('departure_date', e.target.value)}
                  className={`input input-bordered w-full ${errors.departure_date ? 'input-error' : ''}`}
                  data-error={errors.departure_date ? 'true' : undefined}
                />
              </Field>

              <Field
                label="Arrival Estimate"
                hint="Optional"
                error={errors.arrival_date}
              >
                <input
                  type="date"
                  value={form.arrival_date}
                  min={form.departure_date || new Date().toISOString().split('T')[0]}
                  onChange={(e) => update('arrival_date', e.target.value)}
                  className={`input input-bordered w-full ${errors.arrival_date ? 'input-error' : ''}`}
                  data-error={errors.arrival_date ? 'true' : undefined}
                />
              </Field>
            </div>
          </Section>

          {/* ── SECTION 3: Capacity & Pricing ────────────────────────────── */}
          <Section step="3" title="Capacity &amp; Pricing">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Field
                label="Total Capacity (CBM)"
                required
                hint="Available space = this value on creation"
                error={errors.total_capacity_cbm}
              >
                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 28"
                    min={0.1}
                    step={0.1}
                    value={form.total_capacity_cbm}
                    onChange={(e) => update('total_capacity_cbm', e.target.value)}
                    className={`input input-bordered w-full pr-16 ${errors.total_capacity_cbm ? 'input-error' : ''}`}
                    data-error={errors.total_capacity_cbm ? 'true' : undefined}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                    CBM
                  </span>
                </div>
              </Field>

              <Field label="Currency" required>
                <select
                  value={form.currency_code}
                  onChange={(e) => update('currency_code', e.target.value)}
                  className="select select-bordered w-full"
                >
                  {SUPPORTED_CURRENCIES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field
                label={`Price per CBM (${form.currency_code})`}
                required
                error={errors.price_per_cbm}
              >
                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    min={0.01}
                    step={0.01}
                    value={form.price_per_cbm}
                    onChange={(e) => update('price_per_cbm', e.target.value)}
                    className={`input input-bordered w-full ${errors.price_per_cbm ? 'input-error' : ''}`}
                    data-error={errors.price_per_cbm ? 'true' : undefined}
                  />
                </div>
                {form.price_per_cbm && fxRates[form.currency_code] && (
                  <p className="text-xs text-gray-400 mt-1">
                    ≈ USD {(parseFloat(form.price_per_cbm) * fxRates[form.currency_code]).toFixed(2)} / CBM
                  </p>
                )}
              </Field>
            </div>

            {/* Pricing preview */}
            {form.total_capacity_cbm && form.price_per_cbm &&
              parseFloat(form.total_capacity_cbm) > 0 &&
              parseFloat(form.price_per_cbm) > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <PricingPreviewTile
                    label="Total capacity"
                    value={`${parseFloat(form.total_capacity_cbm)} CBM`}
                  />
                  <PricingPreviewTile
                    label="Price / CBM"
                    value={`R${parseFloat(form.price_per_cbm).toFixed(2)}`}
                    highlight
                  />
                  <PricingPreviewTile
                    label="Max revenue"
                    value={`R${(parseFloat(form.total_capacity_cbm) * parseFloat(form.price_per_cbm)).toFixed(2)}`}
                  />
                </div>
              )}
          </Section>

          {/* ── Submit bar ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <Link href="/" className="btn btn-ghost text-gray-500 rounded-xl">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn text-white font-bold px-10 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {submitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'Create Container'
              )}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}

// ─── Layout sub-components ────────────────────────────────────────────────────

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#0f2044' }}
        >
          {step}
        </span>
        <h2 className="font-bold text-gray-800" dangerouslySetInnerHTML={{ __html: title }} />
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block mb-1">
        <span className="text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-xs text-gray-400 ml-2">({hint})</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1" data-error="true">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function PricingPreviewTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`font-bold text-sm ${highlight ? 'text-orange-500' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}
