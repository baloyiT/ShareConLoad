'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import { saveCustomerKycStep1 } from '@/actions/customerKycActions';

const STEPS = ['Personal Details', 'Documents', 'Review'];

const ID_TYPES = [
  { value: 'national_id',      label: 'National ID Card' },
  { value: 'passport',         label: 'Passport' },
  { value: 'drivers_license',  label: "Driver's Licence" },
];

export default function CustomerKycStep1() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveCustomerKycStep1, null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth/login?next=/onboarding/customer');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span><span style={{ color: '#ff6a00' }}>Con</span><span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'text-white' : 'bg-white/20 text-white/60'}`}
                style={i === 0 ? { backgroundColor: '#ff6a00' } : {}}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-orange-50 text-orange-500 mb-3">
            Step 1 of 2 — Personal Details
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Verify your identity</h1>
          <p className="text-gray-500 text-sm mb-6">
            International shipping regulations require us to verify your identity before you can book.
          </p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Full Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="full_name"
                required
                placeholder="As it appears on your ID document"
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                name="date_of_birth"
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ID Type <span className="text-red-500">*</span>
              </label>
              <select name="id_type" required className="select select-bordered w-full">
                <option value="">Select ID type</option>
                {ID_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ID / Passport Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="id_number"
                required
                placeholder="Enter your ID or passport number"
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone_number"
                placeholder="+27 82 000 0000"
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Residential Address</label>
              <textarea
                name="residential_address"
                rows={2}
                placeholder="Street address, city, country"
                className="textarea textarea-bordered w-full resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#ff6a00' }}
            >
              {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Continue — Upload Documents →'}
            </button>
          </form>

          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
            Your information is encrypted and only used for identity verification. It is never shared with third parties.
          </div>
        </div>
      </div>
    </div>
  );
}
