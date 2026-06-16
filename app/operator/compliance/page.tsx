'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

import { Check } from 'lucide-react';
type DocRecord = { doc_type: string; status: string };

type StepState = 'done' | 'in_progress' | 'not_started';

const REQUIRED_DOC_TYPES = [
  'identity',
  'business_registration',
  'proof_of_warehouse_address',
  'tax_clearance',
  'banking_confirmation',
];

const STEP_DEFS = [
  { number: 1, label: 'Business Profile',  desc: 'Your legal entity name, registration number, and entity type.',     href: '/operator/compliance/profile' },
  { number: 2, label: 'Contact Details',   desc: 'Primary contact person, phone number, and business address.',        href: '/operator/compliance/contact' },
  { number: 3, label: 'Bank Account',      desc: 'Payout bank account for receiving transfer payments.',               href: '/operator/bank' },
  { number: 4, label: 'Documents',         desc: 'KYC documents including identity, registration, and tax clearance.', href: '/operator/compliance/documents' },
  { number: 5, label: 'Service Agreement', desc: 'Read and sign the ShareConLoad Operator Service Agreement.',         href: '/operator/compliance/agreement' },
];

export default function ComplianceHubPage() {
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [stepsDone, setStepsDone] = useState<boolean[]>([false, false, false, false, false]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .single();

      if (!profile) { router.replace('/onboarding/operator'); return; }

      const { data: op, error: opErr } = await supabase
        .from('operator_profiles')
        .select('id, legal_name, phone_number, bank_account_name, service_agreement_signed_at, status')
        .eq('profile_id', profile.id)
        .single();

      if (opErr || !op) { setError('Could not load operator profile.'); setLoading(false); return; }

      const { data: docs } = await supabase
        .from('compliance_documents')
        .select('doc_type, status')
        .eq('operator_profile_id', op.id);

      const uploadedTypes = new Set((docs ?? []).map((d: DocRecord) => d.doc_type));
      const allDocsUploaded = REQUIRED_DOC_TYPES.every((t) => uploadedTypes.has(t));

      setStepsDone([
        !!op.legal_name,
        !!op.phone_number,
        !!op.bank_account_name,
        allDocsUploaded,
        !!op.service_agreement_signed_at,
      ]);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="alert alert-error text-sm">{error}</div>
      </div>
    );
  }

  const completedCount = stepsDone.filter(Boolean).length;
  const allDone = completedCount === 5;
  const firstIncomplete = stepsDone.findIndex((d) => !d);

  function getStepState(idx: number): StepState {
    return stepsDone[idx] ? 'done' : 'not_started';
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Compliance &amp; Verification</h1>
        <p className="text-sm text-gray-400 mt-0.5">Complete all required steps to activate your operator account.</p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-500">{completedCount} of 5 steps complete</span>
          <span className="text-xs font-bold" style={{ color: allDone ? '#22c55e' : '#0b103a' }}>
            {Math.round((completedCount / 5) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / 5) * 100}%`,
              backgroundColor: allDone ? '#22c55e' : '#ff6a00',
            }}
          />
        </div>
      </div>

      {/* All done banner */}
      {allDone && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Check className="w-5 h-5 text-green-500 shrink-0" strokeWidth={2.5} />
          <p className="text-sm font-bold text-green-800">All steps complete — your account is under review.</p>
        </div>
      )}

      {/* Step cards */}
      <div className="flex flex-col gap-3">
        {STEP_DEFS.map((step, idx) => {
          const state: StepState = getStepState(idx);
          const isNext = !allDone && idx === firstIncomplete;

          return (
            <div
              key={step.number}
              className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4"
              style={{ borderColor: isNext ? '#0b103a' : '#f3f4f6', borderWidth: isNext ? '1.5px' : '1px' }}
            >
              {/* Number / check circle */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: state === 'done' ? '#22c55e' : isNext ? '#0b103a' : '#f3f4f6',
                  color: state === 'done' || isNext ? '#ffffff' : '#9ca3af',
                }}
              >
                {state === 'done' ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : step.number}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                  </div>

                  {/* Status badge */}
                  {state === 'done' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
                      Complete
                    </span>
                  )}
                  {state === 'not_started' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 shrink-0">
                      Not started
                    </span>
                  )}
                </div>

                {/* Action button */}
                <div className="mt-3">
                  {state === 'done' ? (
                    <Link
                      href={step.href}
                      className="btn btn-sm btn-outline rounded-xl text-xs font-semibold"
                      style={{ borderColor: '#0b103a', color: '#0b103a' }}
                    >
                      Edit
                    </Link>
                  ) : isNext ? (
                    <Link
                      href={step.href}
                      className="btn btn-sm text-white font-bold rounded-xl text-xs"
                      style={{ backgroundColor: '#0b103a' }}
                    >
                      Start →
                    </Link>
                  ) : (
                    <Link
                      href={step.href}
                      className="btn btn-sm rounded-xl text-xs font-semibold text-gray-500"
                      style={{ backgroundColor: '#f3f4f6' }}
                    >
                      Start →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
