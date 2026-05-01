'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { createOperatorProfile } from '@/actions/operatorActions';

export default function OperatorOnboardingPage() {
  const [state, formAction, isPending] = useActionState(createOperatorProfile, null);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo_v4.png" alt="ShareConLoad" width={36} height={36} className="rounded-md" />
          <span className="text-xl font-bold text-white">ShareConLoad</span>
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

          {/* Inline error from server action */}
          {state?.error && (
            <div className="alert alert-error text-sm mb-5">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">

            {/* Entity type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Entity Type
              </label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="country"
                defaultValue="South Africa"
                required
                className="input input-bordered w-full"
              />
            </div>

            {/* Contact person */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                name="contact_person"
                placeholder="Full name of primary contact"
                className="input input-bordered w-full"
              />
            </div>

            {/* Phone number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone_number"
                placeholder="+27 XX XXX XXXX"
                className="input input-bordered w-full"
              />
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
