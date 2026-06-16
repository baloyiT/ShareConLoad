// app/onboarding/agent/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { saveAgentStep1 } from '@/actions/agentActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Malaysia', 'Mozambique',
  'Namibia', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe',
].sort((a, b) => a === 'South Africa' ? -1 : b === 'South Africa' ? 1 : a.localeCompare(b));

const CORRIDORS = ['Africa', 'Europe', 'Asia', 'Americas', 'Middle East', 'Global'];

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep1() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveAgentStep1, null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth/login?next=/onboarding/agent');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding" className="flex items-center gap-2.5">
          <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#ff6a00' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 1 of 5 — Business Details
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Tell us about your agency</h1>
          <p className="text-gray-500 text-sm mb-6">Basic information about your freight agency.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Business / Agency Name <span className="text-red-500">*</span>
              </label>
              <input name="business_name" required className="input input-bordered w-full text-sm" placeholder="e.g. FastTrack Freight Agents" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person</label>
              <input name="contact_person" className="input input-bordered w-full text-sm" placeholder="Full name" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
              <input name="phone_number" type="tel" className="input input-bordered w-full text-sm" placeholder="+27 82 123 4567" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Country of Registration</label>
              <select name="country" className="select select-bordered w-full text-sm">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Years in Operation</label>
              <input name="years_in_operation" type="number" min="0" max="100" className="input input-bordered w-full text-sm" placeholder="e.g. 5" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">Operating Corridors</label>
              <div className="flex flex-wrap gap-2">
                {CORRIDORS.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" name="operating_corridors" value={c} className="checkbox checkbox-sm checkbox-success" />
                    <span className="text-sm text-gray-700">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Brief Description of Services</label>
              <textarea
                name="service_description"
                className="textarea textarea-bordered w-full text-sm"
                rows={3}
                placeholder="Describe the types of freight you handle and the corridors you specialise in..."
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#16a34a' }}
            >
              {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
