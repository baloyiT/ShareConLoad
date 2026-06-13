'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { submitAgentApplication } from '@/actions/agentActions';

type AgentSummary = {
  business_name: string;
  contact_person: string | null;
  phone_number: string | null;
  country: string;
  operating_corridors: string[];
  years_in_operation: number | null;
  service_description: string | null;
  license_number: string | null;
  license_authority: string | null;
  license_expiry: string | null;
  registration_number: string | null;
  doc_license_url: string | null;
  doc_business_reg_url: string | null;
  doc_identity_url: string | null;
  doc_proof_address_url: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
};

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingReview() {
  const [profile, setProfile] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, isPending] = useActionState(submitAgentApplication, null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('id').eq('user_id', user.id).eq('role_type', 'agent').maybeSingle();
      if (!p) return;
      const { data: ap } = await supabase.from('agent_profiles').select('*').eq('profile_id', p.id).maybeSingle();
      if (ap) setProfile(ap as AgentSummary);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} /></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent/bank" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 4 ? 'bg-green-500 text-white' : 'bg-white/60 text-gray-700'}`}>
                {i < 4 ? '✓' : '5'}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 5 of 5 — Review &amp; Submit
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Review your application</h1>
          <p className="text-gray-500 text-sm mb-6">Check everything before submitting for review.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
          )}

          {profile && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm flex flex-col gap-2 mb-6">
              <Row label="Agency" value={profile.business_name} />
              <Row label="Contact" value={profile.contact_person ?? '—'} />
              <Row label="Country" value={profile.country} />
              <Row label="Corridors" value={profile.operating_corridors?.join(', ') || '—'} />
              <Row label="License No." value={profile.license_number ?? '—'} />
              <Row label="Bank" value={profile.bank_name ?? '—'} />
              <div className="pt-1 flex flex-col gap-1">
                {[
                  { label: 'License doc', url: profile.doc_license_url },
                  { label: 'Business reg', url: profile.doc_business_reg_url },
                  { label: 'Identity doc', url: profile.doc_identity_url },
                ].map(({ label, url }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-gray-500">{label}</span>
                    {url ? <span className="text-green-600 font-medium">✓ Uploaded</span> : <span className="text-red-500">Missing</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-success mt-0.5"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
              />
              <span className="text-sm text-gray-700">
                I confirm all information is accurate and I agree to the{' '}
                <Link href="/terms" className="text-green-600 underline">ShareConLoad Agent Terms</Link>.
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent/bank" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={isPending || !agreed}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[200px] truncate">{value}</span>
    </div>
  );
}
