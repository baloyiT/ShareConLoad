'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import {
  ESTABLISHED_OPERATOR_STEPS,
  NEW_OPERATOR_STEPS,
  hasContainers,
  termsOpenForAcceptance,
  type OperatorStepKey,
} from '@/services/operatorSteps';

import { Check, Clock } from 'lucide-react';

export default function ComplianceStepper({ current }: { current: OperatorStepKey }) {
  const [established, setEstablished] = useState(false);
  const [termsOpen,   setTermsOpen]   = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setEstablished(await hasContainers(user.id));
    });
    termsOpenForAcceptance().then(setTermsOpen);
  }, []);

  const steps = established ? ESTABLISHED_OPERATOR_STEPS : NEW_OPERATOR_STEPS;
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-start gap-0 mb-8 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const done   = idx < currentIdx;
        const active = idx === currentIdx;
        const notOpen = step.key === 'terms' && !termsOpen;
        return (
          <div key={step.key} className="flex items-center shrink-0">
            <Link href={step.href} className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                style={{
                  backgroundColor: done ? '#22c55e' : active ? '#0b103a' : '#e5e7eb',
                  color: done || active ? '#ffffff' : '#9ca3af',
                }}
              >
                {done ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : notOpen ? (
                  <Clock className="w-4 h-4" />
                ) : idx + 1}
              </div>
              <span
                className="text-xs font-medium text-center hidden sm:block w-16 leading-tight"
                style={{ color: active ? '#0b103a' : done ? '#22c55e' : '#9ca3af' }}
              >
                {step.label}{notOpen && <span className="block font-normal">Not open yet</span>}
              </span>
            </Link>
            {idx < steps.length - 1 && (
              <div
                className="h-0.5 w-6 sm:w-10 mx-1 mt-0 sm:-mt-4 shrink-0 rounded-full"
                style={{ backgroundColor: done ? '#22c55e' : '#e5e7eb' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
