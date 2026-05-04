'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useActionState } from 'react';
import { createOperatorProfile } from '@/actions/operatorActions';

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
  if (!stripped || stripped === countryCode) return null; // optional — not filled in

  if (!stripped.startsWith(countryCode)) {
    return `Number must start with ${countryCode} for the selected country.`;
  }

  const local = stripped.slice(countryCode.length);

  if (!/^\d+$/.test(local)) return 'Phone number must contain digits only.';

  if (local.startsWith('0')) {
    if (local.length !== 10) return 'When starting with 0, the local number must be 10 digits (e.g. 0821234567).';
  } else {
    if (local.length !== 9) return 'Local number must be 9 digits (e.g. 821234567).';
  }

  return null;
}

function extractLocalPart(phone: string, codes: string[]): string {
  const matched = codes
    .filter((c) => phone.startsWith(c))
    .sort((a, b) => b.length - a.length)[0]; // longest match wins
  if (!matched) return phone.trim();
  return phone.slice(matched.length).trim();
}

export default function OperatorOnboardingPage() {
  const [state, formAction, isPending] = useActionState(createOperatorProfile, null);

  const [country, setCountry] = useState('South Africa');
  const [phone, setPhone] = useState('+27 ');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function handleCountryChange(value: string) {
    setCountry(value);
    const newCode = COUNTRY_CODES[value];
    if (!newCode) return;
    const localPart = extractLocalPart(phone, Object.values(COUNTRY_CODES));
    setPhone(localPart ? `${newCode} ${localPart}` : `${newCode} `);
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (phoneError) setPhoneError(validatePhone(value, COUNTRY_CODES[country] ?? ''));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const err = validatePhone(phone, COUNTRY_CODES[country] ?? '');
    if (err) {
      e.preventDefault();
      setPhoneError(err);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">
            Set up your operator profile
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            This information helps customers trust your listings.
          </p>

          {/* Server action error */}
          {state?.error && (
            <div className="alert alert-error text-sm mb-5">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
              {state.error}
            </div>
          )}

          <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Entity type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Entity Type</label>
              <select name="entity_type" required className="select select-bordered w-full">
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>

            {/* Legal name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="legal_name"
                required
                placeholder="Your full legal name or company name"
                className="input input-bordered w-full"
              />
            </div>

            {/* Registration number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Registration Number{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="registration_number"
                placeholder="Company registration number"
                className="input input-bordered w-full"
              />
            </div>

            {/* VAT number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                VAT Number{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="vat_number"
                placeholder="VAT number"
                className="input input-bordered w-full"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="country"
                list="country-list"
                value={country}
                required
                placeholder="Type or select a country"
                className="input input-bordered w-full"
                onChange={(e) => handleCountryChange(e.target.value)}
              />
              <datalist id="country-list">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Contact person */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                name="contact_person"
                placeholder="Full name of primary contact"
                className="input input-bordered w-full"
              />
            </div>

            {/* Phone number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone_number"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={() => setPhoneError(validatePhone(phone, COUNTRY_CODES[country] ?? ''))}
                placeholder="+27 XX XXX XXXX"
                className={`input input-bordered w-full ${phoneError ? 'input-error' : ''}`}
              />
              {phoneError && (
                <p className="text-red-500 text-xs mt-1">{phoneError}</p>
              )}
              {!phoneError && phone.trim().length > 3 && (
                <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Valid phone number
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {isPending
                ? <span className="loading loading-spinner loading-sm" />
                : 'Complete Setup'}
            </button>

          </form>

          <p className="text-center text-sm text-gray-400 mt-4">
            <Link href="/onboarding" className="hover:underline">
              ← Back to role selection
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
