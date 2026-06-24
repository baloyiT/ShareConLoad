'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { createOperatorProfile } from '@/actions/operatorActions';

import { AlertCircle, Check, Info } from 'lucide-react';
import { ID_TYPES } from '@/services/operatorCompliance';
const COUNTRY_CODES: Record<string, string> = {
  'South Africa': '+27', 'Afghanistan': '+93', 'Albania': '+355', 'Algeria': '+213',
  'Angola': '+244', 'Argentina': '+54', 'Australia': '+61', 'Austria': '+43',
  'Azerbaijan': '+994', 'Bahrain': '+973', 'Bangladesh': '+880', 'Belarus': '+375',
  'Belgium': '+32', 'Benin': '+229', 'Bolivia': '+591', 'Bosnia and Herzegovina': '+387',
  'Botswana': '+267', 'Brazil': '+55', 'Bulgaria': '+359', 'Burkina Faso': '+226',
  'Cameroon': '+237', 'Canada': '+1', 'Chad': '+235', 'Chile': '+56', 'China': '+86',
  'Colombia': '+57', 'Congo': '+242', 'Costa Rica': '+506', 'Croatia': '+385',
  'Cuba': '+53', 'Cyprus': '+357', 'Czech Republic': '+420', 'Denmark': '+45',
  'Dominican Republic': '+1', 'Ecuador': '+593', 'Egypt': '+20', 'El Salvador': '+503',
  'Ethiopia': '+251', 'Finland': '+358', 'France': '+33', 'Gabon': '+241',
  'Germany': '+49', 'Ghana': '+233', 'Greece': '+30', 'Guatemala': '+502',
  'Guinea': '+224', 'Honduras': '+504', 'Hungary': '+36', 'India': '+91',
  'Indonesia': '+62', 'Iran': '+98', 'Iraq': '+964', 'Ireland': '+353',
  'Israel': '+972', 'Italy': '+39', 'Ivory Coast': '+225', 'Jamaica': '+1',
  'Japan': '+81', 'Jordan': '+962', 'Kazakhstan': '+7', 'Kenya': '+254',
  'Kuwait': '+965', 'Lebanon': '+961', 'Libya': '+218', 'Lithuania': '+370',
  'Madagascar': '+261', 'Malawi': '+265', 'Malaysia': '+60', 'Mali': '+223',
  'Mauritania': '+222', 'Mauritius': '+230', 'Mexico': '+52', 'Morocco': '+212',
  'Mozambique': '+258', 'Myanmar': '+95', 'Namibia': '+264', 'Netherlands': '+31',
  'New Zealand': '+64', 'Nicaragua': '+505', 'Niger': '+227', 'Nigeria': '+234',
  'Norway': '+47', 'Oman': '+968', 'Pakistan': '+92', 'Panama': '+507',
  'Paraguay': '+595', 'Peru': '+51', 'Philippines': '+63', 'Poland': '+48',
  'Portugal': '+351', 'Qatar': '+974', 'Romania': '+40', 'Russia': '+7',
  'Rwanda': '+250', 'Saudi Arabia': '+966', 'Senegal': '+221', 'Serbia': '+381',
  'Sierra Leone': '+232', 'Singapore': '+65', 'Somalia': '+252', 'South Korea': '+82',
  'South Sudan': '+211', 'Spain': '+34', 'Sri Lanka': '+94', 'Sudan': '+249',
  'Sweden': '+46', 'Switzerland': '+41', 'Syria': '+963', 'Taiwan': '+886',
  'Tanzania': '+255', 'Thailand': '+66', 'Togo': '+228', 'Tunisia': '+216',
  'Turkey': '+90', 'Uganda': '+256', 'Ukraine': '+380', 'United Arab Emirates': '+971',
  'United Kingdom': '+44', 'United States': '+1', 'Uruguay': '+598',
  'Venezuela': '+58', 'Vietnam': '+84', 'Yemen': '+967', 'Zambia': '+260',
  'Zimbabwe': '+263',
};

const COUNTRIES = Object.keys(COUNTRY_CODES).sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

function validatePhone(value: string, countryCode: string): string | null {
  const stripped = value.replace(/[\s\-\(\)]/g, '');
  if (!stripped || stripped === countryCode) return null;
  if (!stripped.startsWith(countryCode)) {
    return `Number must start with ${countryCode} for the selected country.`;
  }
  const local = stripped.slice(countryCode.length);
  if (!/^\d+$/.test(local)) return 'Phone number must contain digits only.';
  if (local.startsWith('0')) {
    if (local.length !== 10) return 'When starting with 0, the local number must be 10 digits.';
  } else {
    if (local.length !== 9) return 'Local number must be 9 digits.';
  }
  return null;
}

function extractLocalPart(phone: string, codes: string[]): string {
  const matched = codes
    .filter((c) => phone.startsWith(c))
    .sort((a, b) => b.length - a.length)[0];
  if (!matched) return phone.trim();
  return phone.slice(matched.length).trim();
}

export default function OperatorOnboardingPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createOperatorProfile, null);

  const [authChecked, setAuthChecked] = useState(false);
  const [entityType, setEntityType]   = useState('individual');
  const isIndividual = entityType === 'individual';
  const [country, setCountry]         = useState('South Africa');
  const [phone, setPhone]             = useState('+27 ');
  const [phoneError, setPhoneError]   = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/auth/login?next=/onboarding/operator');
        return;
      }
      // Already an operator? Skip onboarding — send them straight to their dashboard,
      // where "Create Container" lives. (Mirrors the createOperatorProfile idempotency
      // check, but routes forward on load instead of after a redundant form submit.)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('role_type', 'operator')
        .maybeSingle();
      if (profile) {
        const { data: op } = await supabase
          .from('operator_profiles')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (op) {
          router.replace('/operator');
          return;
        }
      }
      setAuthChecked(true);
    });
  }, [router]);

  function handleCountryChange(value: string) {
    setCountry(value);
    const newCode = COUNTRY_CODES[value];
    if (!newCode) return;
    const localPart = extractLocalPart(phone, Object.values(COUNTRY_CODES));
    setPhone(localPart ? `${newCode} ${localPart}` : `${newCode} `);
    if (fieldErrors.country) setFieldErrors((p) => ({ ...p, country: '' }));
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (phoneError) setPhoneError(validatePhone(value, COUNTRY_CODES[country] ?? ''));
    if (fieldErrors.phone_number) setFieldErrors((p) => ({ ...p, phone_number: '' }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form   = e.currentTarget;
    const errors: Record<string, string> = {};

    const legalName = (form.elements.namedItem('legal_name') as HTMLInputElement)?.value?.trim();
    if (!legalName) errors.legal_name = 'Legal name is required.';

    if (entityType === 'company') {
      const reg = (form.elements.namedItem('registration_number') as HTMLInputElement)?.value?.trim();
      if (!reg) errors.registration_number = 'Registration number is required for companies.';
    } else {
      const idNum = (form.elements.namedItem('id_number') as HTMLInputElement)?.value?.trim();
      if (!idNum) errors.id_number = 'ID number is required.';
    }

    if (!country.trim() || !COUNTRIES.includes(country)) errors.country = 'Please select a valid country.';

    const phoneErr = validatePhone(phone, COUNTRY_CODES[country] ?? '');
    if (phoneErr) errors.phone_number = phoneErr;

    if (Object.keys(errors).length > 0) {
      e.preventDefault();
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPhoneError(null);
  }

  // Show spinner while confirming auth
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}>
        <span className="loading loading-spinner loading-lg text-white" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#ff6a00' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

          {/* Header band */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-100">
            <h1 className="text-2xl font-extrabold text-gray-900">
              Set up your operator profile
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              This information helps customers trust your listings.
            </p>
          </div>

          <div className="px-8 py-6">
            {/* Server error (real errors only — not auth, since we gate above) */}
            {state?.error && state.error !== 'You must be logged in.' && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {state.error}
              </div>
            )}

            <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

              {/* Entity type */}
              <Field label="Entity Type">
                <select name="entity_type" value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="select select-bordered w-full">
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </Field>

              {/* Legal name */}
              <Field label="Legal Name" required error={fieldErrors.legal_name}>
                <input
                  type="text"
                  name="legal_name"
                  placeholder="Your full legal name or company name"
                  className={`input input-bordered w-full ${fieldErrors.legal_name ? 'input-error' : ''}`}
                  onChange={() => setFieldErrors((p) => ({ ...p, legal_name: '' }))}
                />
              </Field>

              {/* Company-only: registration + VAT */}
              {!isIndividual && (
                <>
                  <Field label="Registration Number" required error={fieldErrors.registration_number}>
                    <input type="text" name="registration_number"
                      placeholder="Company registration number"
                      className={`input input-bordered w-full ${fieldErrors.registration_number ? 'input-error' : ''}`}
                      onChange={() => setFieldErrors((p) => ({ ...p, registration_number: '' }))} />
                  </Field>
                  <Field label="VAT Number" hint="optional">
                    <input type="text" name="vat_number" placeholder="VAT number"
                      className="input input-bordered w-full" />
                  </Field>
                </>
              )}

              {/* Individual-only: ID type + number */}
              {isIndividual && (
                <>
                  <Field label="ID Type" required>
                    <select name="id_type" className="select select-bordered w-full">
                      {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="ID Number" required error={fieldErrors.id_number}>
                    <input type="text" name="id_number" placeholder="Your ID or passport number"
                      className={`input input-bordered w-full ${fieldErrors.id_number ? 'input-error' : ''}`}
                      onChange={() => setFieldErrors((p) => ({ ...p, id_number: '' }))} />
                  </Field>
                </>
              )}

              {/* Country */}
              <Field label="Country" required error={fieldErrors.country}>
                <input
                  type="text"
                  name="country"
                  list="country-list"
                  value={country}
                  placeholder="Type or select a country"
                  className={`input input-bordered w-full ${fieldErrors.country ? 'input-error' : ''}`}
                  onChange={(e) => handleCountryChange(e.target.value)}
                />
                <datalist id="country-list">
                  {COUNTRIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>

              {/* Contact person — company only */}
              {!isIndividual && (
                <Field label="Contact Person">
                  <input
                    type="text"
                    name="contact_person"
                    placeholder="Full name of primary contact"
                    className="input input-bordered w-full"
                  />
                </Field>
              )}

              {/* Phone number */}
              <Field label="Phone Number" error={fieldErrors.phone_number || phoneError || undefined}>
                <input
                  type="tel"
                  name="phone_number"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={() => {
                    const err = validatePhone(phone, COUNTRY_CODES[country] ?? '');
                    setPhoneError(err);
                    if (err) setFieldErrors((p) => ({ ...p, phone_number: err }));
                  }}
                  placeholder="+27 XX XXX XXXX"
                  className={`input input-bordered w-full ${(fieldErrors.phone_number || phoneError) ? 'input-error' : ''}`}
                />
                {!phoneError && !fieldErrors.phone_number && phone.trim().length > 3 && (
                  <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Valid phone number
                  </p>
                )}
              </Field>

              <button
                type="submit"
                disabled={isPending}
                className="btn w-full text-white font-bold rounded-xl mt-1 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#ff6a00' }}
              >
                {isPending
                  ? <span className="loading loading-spinner loading-sm" />
                  : 'Complete Setup'}
              </button>

            </form>
          </div>

          <div className="px-8 pb-6 text-center">
            <Link href="/onboarding" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Back to role selection
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label, hint, required, error, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="font-normal text-gray-400 ml-1">({hint})</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
