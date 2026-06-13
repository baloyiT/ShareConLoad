'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveAgentStep1 } from '@/actions/agentActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Malaysia', 'Mozambique',
  'Namibia', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe',
].sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

export default function AgentOnboardingPage() {
  const [state, formAction, isPending] = useActionState(saveAgentStep1, null);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <div className="mb-6">
            <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
              Agent Onboarding
            </span>
            <h1 className="text-2xl font-extrabold text-gray-900">Set up your agent account</h1>
            <p className="text-gray-500 text-sm mt-1">
              You will be able to add shippers and book container space on their behalf.
            </p>
          </div>

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
              <input
                name="business_name"
                required
                className="input input-bordered w-full text-sm"
                placeholder="e.g. FastTrack Freight Agents"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person</label>
              <input
                name="contact_person"
                className="input input-bordered w-full text-sm"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
              <input
                name="phone_number"
                type="tel"
                className="input input-bordered w-full text-sm"
                placeholder="+27 82 123 4567"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
              <select name="country" className="select select-bordered w-full text-sm">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#16a34a' }}
            >
              {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Create Agent Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
