'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { loadOperatorProgress, type OperatorProgress } from '@/services/operatorSteps';

import { Check, Clock } from 'lucide-react';

type StepState = 'done' | 'not_started' | 'not_open';

export default function ComplianceHubPage() {
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [steps,   setSteps]     = useState<OperatorProgress['steps']>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance'); return; }

      const progress = await loadOperatorProgress(user.id);

      if (!progress.hasOperatorRole) { router.replace('/onboarding/operator'); return; }
      if (!progress.hasOperatorDetails) { setError('Could not load operator profile.'); setLoading(false); return; }

      setSteps(progress.steps);
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

  const total = steps.length;
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === total;
  const firstIncomplete = steps.findIndex((s) => !s.done && !s.notOpen);
  const waitingOnTerms = !allDone && firstIncomplete === -1;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Compliance &amp; Verification</h1>
        <p className="text-sm text-gray-400 mt-0.5">Complete these steps so we can review your operator account.</p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-500">{completedCount} of {total} steps complete</span>
          <span className="text-xs font-bold" style={{ color: allDone ? '#22c55e' : '#0b103a' }}>
            {Math.round((completedCount / total) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / total) * 100}%`,
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

      {waitingOnTerms && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Check className="w-5 h-5 text-green-500 shrink-0" strokeWidth={2.5} />
          <p className="text-sm font-bold text-green-800">You have finished everything you can for now. The participation terms are still being finalised.</p>
        </div>
      )}

      {/* Step cards */}
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => {
          const state: StepState = step.done ? 'done' : step.notOpen ? 'not_open' : 'not_started';
          const isNext = !allDone && idx === firstIncomplete;

          return (
            <div
              key={step.key}
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
                ) : state === 'not_open' ? (
                  <Clock className="w-4 h-4" />
                ) : idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {state === 'not_open' ? 'These terms are being finalised. Acceptance is not open yet, so there is nothing for you to do here for now.' : step.desc}
                    </p>
                  </div>

                  {/* Status badge */}
                  {state === 'done' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
                      Complete
                    </span>
                  )}
                  {state === 'not_open' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      Not open yet
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
                  ) : state === 'not_open' ? (
                    <Link
                      href={step.href}
                      className="btn btn-sm rounded-xl text-xs font-semibold text-gray-500"
                      style={{ backgroundColor: '#f3f4f6' }}
                    >
                      Read the draft
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
