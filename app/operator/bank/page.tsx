'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

// Full country list — sorted with SA first
const ALL_COUNTRIES = [
  'South Africa', 'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina',
  'Australia', 'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus',
  'Belgium', 'Benin', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
  'Bulgaria', 'Burkina Faso', 'Cameroon', 'Canada', 'Chad', 'Chile', 'China',
  'Colombia', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Ethiopia', 'Finland', 'France', 'Gabon', 'Germany', 'Ghana',
  'Greece', 'Guatemala', 'Guinea', 'Honduras', 'Hungary', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Lebanon', 'Libya',
  'Lithuania', 'Madagascar', 'Malawi', 'Malaysia', 'Mali', 'Mauritania',
  'Mauritius', 'Mexico', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'Norway',
  'Oman', 'Pakistan', 'Panama', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia',
  'Senegal', 'Serbia', 'Sierra Leone', 'Singapore', 'Somalia', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tanzania', 'Thailand', 'Togo', 'Tunisia', 'Turkey',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
].sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

// Countries with automated Paystack payout support
const PAYSTACK_SUPPORTED = new Set(['South Africa', 'Nigeria', 'Ghana']);

type Bank = { name: string; code: string };

export default function OperatorBankPage() {
  const router = useRouter();

  const [operatorProfileId, setOperatorProfileId] = useState<string | null>(null);
  const [existingCode,      setExistingCode]       = useState<string | null>(null);
  const [loadingProfile,    setLoadingProfile]     = useState(true);

  // Country + bank list
  const [bankCountry,   setBankCountry]   = useState('South Africa');
  const [banks,         setBanks]         = useState<Bank[]>([]);
  const [loadingBanks,  setLoadingBanks]  = useState(false);
  const [bankListError, setBankListError] = useState<string | null>(null);
  const [isManual,      setIsManual]      = useState(false);

  // Bank account fields
  const [bankAccountName,   setBankAccountName]   = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankCode,          setBankCode]          = useState('');
  const [bankName,          setBankName]          = useState('');  // institution name for manual
  const [swiftCode,         setSwiftCode]         = useState('');

  // Submission
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);
  const [successManual, setSuccessManual] = useState(false);
  const [recipientCode, setRecipientCode] = useState<string | null>(null);

  // Load operator profile
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/bank'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('id')
        .eq('user_id', user.id).eq('role_type', 'operator').single();

      if (!profile) { setLoadingProfile(false); return; }

      const { data: op } = await supabase
        .from('operator_profiles')
        .select('id, paystack_recipient_code, bank_account_number, bank_code, bank_name, bank_account_name, bank_country, bank_swift_code, payout_method')
        .eq('profile_id', profile.id).single();

      if (!op) { router.replace('/onboarding/operator?reason=bank'); return; }

      setOperatorProfileId(op.id);
      setExistingCode(op.paystack_recipient_code ?? null);
      if (op.bank_country)        setBankCountry(op.bank_country);
      if (op.bank_account_name)   setBankAccountName(op.bank_account_name);
      if (op.bank_account_number) setBankAccountNumber(op.bank_account_number);
      if (op.bank_code)           setBankCode(op.bank_code);
      if (op.bank_name)           setBankName(op.bank_name);
      if (op.bank_swift_code)     setSwiftCode(op.bank_swift_code);
      setLoadingProfile(false);
    }
    load();
  }, [router]);

  // Fetch bank list when country changes
  useEffect(() => {
    if (!bankCountry) return;
    setBanks([]);
    setBankListError(null);

    if (!PAYSTACK_SUPPORTED.has(bankCountry)) {
      setIsManual(true);
      return;
    }

    setIsManual(false);
    setLoadingBanks(true);

    supabase.functions.invoke('get-banks', { body: { country: bankCountry } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setBankListError(data?.error ?? error?.message ?? 'Could not load bank list.');
        } else if (data?.manual) {
          setIsManual(true);
        } else {
          const seen = new Map<string, Bank>();
          for (const b of (data.banks ?? []) as Bank[]) {
            if (!seen.has(b.code)) seen.set(b.code, b);
          }
          setBanks(Array.from(seen.values()));
        }
        setLoadingBanks(false);
      });
  }, [bankCountry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!bankAccountName.trim())                         { setSubmitError('Account holder name is required.'); return; }
    if (!bankCountry)                                    { setSubmitError('Please select your bank country.'); return; }
    if (!isManual && !bankCode)                          { setSubmitError('Please select your bank.'); return; }
    if (!isManual && !bankAccountNumber.trim())          { setSubmitError('Account number is required.'); return; }
    if (isManual && !bankName.trim())                    { setSubmitError('Bank name is required.'); return; }
    if (isManual && !swiftCode.trim())                   { setSubmitError('SWIFT / BIC code is required.'); return; }
    if (!operatorProfileId) return;

    setSubmitting(true);

    const { data, error: fnErr } = await supabase.functions.invoke('create-transfer-recipient', {
      body: {
        operatorProfileId,
        bankAccountName:   bankAccountName.trim(),
        bankAccountNumber: isManual ? (bankAccountNumber.trim() || null) : bankAccountNumber.trim(),
        bankCode:          isManual ? null : bankCode,
        bankName:          isManual ? bankName.trim() : null,
        bankCountry,
        swiftCode:         isManual ? swiftCode.trim() : null,
      },
    });

    if (fnErr || !data?.success) {
      setSubmitError(data?.error ?? fnErr?.message ?? 'Failed to register bank account. Please try again.');
      setSubmitting(false);
      return;
    }

    setRecipientCode(data.recipientCode ?? null);
    setExistingCode(data.recipientCode ?? null);
    setSuccessManual(!!data.manual);
    setSuccess(true);
    setSubmitting(false);
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHero gradient label="Operator Settings" title="Payout Bank Account" description="Register your bank account to receive payout transfers." />

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">

        {existingCode && !success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
            <p className="font-semibold mb-0.5">Bank account registered</p>
            <p className="text-xs text-green-600">
              Linked to Paystack (<span className="font-mono">{existingCode}</span>).
              Update below to create a new recipient.
            </p>
          </div>
        )}

        {success ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: successManual ? '#fef3c7' : '#f0fdf4' }}
            >
              {successManual ? (
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-gray-800 mb-1">
              {successManual ? 'Bank Details Saved' : 'Bank Account Linked!'}
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-gray-700">{bankAccountName}</span>
              {successManual
                ? ' — our team will contact you to arrange international payout transfers.'
                : ' is registered and ready to receive payouts.'}
            </p>
            {recipientCode && (
              <p className="text-xs text-gray-400 font-mono mb-2">Recipient: {recipientCode}</p>
            )}
            <div className="flex flex-col gap-2 mt-6">
              <Link
                href="/operator/compliance/agreement"
                className="btn text-white font-bold rounded-xl hover:opacity-90"
                style={{ backgroundColor: '#0f2044' }}
              >
                Next, Service Agreement →
              </Link>
              <button
                onClick={() => setSuccess(false)}
                className="btn btn-ghost rounded-xl text-gray-500 text-sm"
              >
                Update Details
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">

            {submitError && (
              <div className="alert alert-error text-sm">{submitError}</div>
            )}

            {/* ── Bank Country ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Bank Country <span className="text-red-500">*</span>
              </label>
              <select
                value={bankCountry}
                onChange={(e) => {
                  setBankCountry(e.target.value);
                  setBankCode('');
                  setSwiftCode('');
                  setBankName('');
                }}
                className="select select-bordered w-full text-sm"
              >
                <option value="">Select country</option>
                {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* ── Payout method notice ── */}
            {bankCountry && (
              isManual ? (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Automated payouts are not yet available for <strong>{bankCountry}</strong>.
                    Save your details and our team will arrange international wire transfers to your account.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Automated payouts via Paystack are available for <strong>{bankCountry}</strong>.
                    Ensure your account holder name matches your bank records exactly.
                  </span>
                </div>
              )
            )}

            {/* ── Paystack-supported: bank dropdown + account number ── */}
            {!isManual && bankCountry && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Bank <span className="text-red-500">*</span>
                  </label>
                  {loadingBanks ? (
                    <div className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-400">
                      <span className="loading loading-spinner loading-xs" style={{ color: '#f97316' }} />
                      Loading banks…
                    </div>
                  ) : bankListError ? (
                    <p className="text-xs text-red-500">{bankListError}</p>
                  ) : (
                    <select
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                      className="select select-bordered w-full text-sm"
                    >
                      <option value="">Select your bank</option>
                      {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 4082653210"
                    className="input input-bordered w-full text-sm font-mono"
                    maxLength={20}
                  />
                </div>
              </>
            )}

            {/* ── International / manual: bank name + SWIFT + IBAN ── */}
            {isManual && bankCountry && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Barclays Bank UK"
                    className="input input-bordered w-full text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    SWIFT / BIC Code <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-1.5">8 or 11 character code identifying your bank internationally.</p>
                  <input
                    type="text"
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="e.g. BARCGB22"
                    className="input input-bordered w-full text-sm font-mono"
                    maxLength={11}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Account Number / IBAN{' '}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value.replace(/\s/g, '').toUpperCase())}
                    placeholder="e.g. GB29NWBK60161331926819"
                    className="input input-bordered w-full text-sm font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">Enter without spaces.</p>
                </div>
              </>
            )}

            {/* ── Account Holder Name — always shown once country selected ── */}
            {bankCountry && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-1.5">
                  Full name or business name exactly as it appears on your bank account.
                </p>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="e.g. John Dlamini or Acme Logistics (Pty) Ltd"
                  className="input input-bordered w-full text-sm"
                />
              </div>
            )}

            {/* ── Warning ── */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              Payouts will be sent to this account. Double-check all details — transfers cannot be reversed once initiated.
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={submitting || loadingBanks || !bankCountry}
              className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#0f2044' }}
            >
              {submitting
                ? <span className="loading loading-spinner loading-sm" />
                : existingCode
                  ? 'Update Bank Account'
                  : isManual ? 'Save Bank Details →' : 'Register Bank Account →'}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
