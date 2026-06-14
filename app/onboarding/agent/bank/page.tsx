'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveAgentStep4 } from '@/actions/agentActions';

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep4() {
  const [state, formAction, isPending] = useActionState(saveAgentStep4, null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent/documents" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 3 ? 'bg-green-500 text-white' : i < 3 ? 'bg-white/60 text-gray-700' : 'bg-white/20 text-white/60'}`}>
                {i < 3 ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 4 of 5 — Bank Details
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Banking information</h1>
          <p className="text-gray-500 text-sm mb-6">Stored securely for future payout setup. Not yet active.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bank Name</label>
              <input name="bank_name" className="input input-bordered w-full text-sm" placeholder="e.g. First National Bank" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Account Holder Name</label>
              <input name="bank_account_holder" className="input input-bordered w-full text-sm" placeholder="As it appears on the account" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Account Number</label>
              <input name="bank_account_number" className="input input-bordered w-full text-sm" placeholder="e.g. 62012345678" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Branch Code / SWIFT / IBAN</label>
              <input name="bank_branch_code" className="input input-bordered w-full text-sm" placeholder="e.g. 250655" />
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent/documents" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={isPending}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save & Review →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
