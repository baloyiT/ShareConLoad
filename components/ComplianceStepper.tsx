'use client';

import Link from 'next/link';

const STEPS = [
  { number: 1, label: 'Business Profile', href: '/operator/compliance/profile' },
  { number: 2, label: 'Contact Details',  href: '/operator/compliance/contact' },
  { number: 3, label: 'Bank Account',     href: '/operator/bank' },
  { number: 4, label: 'Documents',        href: '/operator/compliance/documents' },
  { number: 5, label: 'Agreement',        href: '/operator/compliance/agreement' },
];

export default function ComplianceStepper({ current }: { current: number }) {
  return (
    <div className="flex items-start gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((step, idx) => {
        const done   = step.number < current;
        const active = step.number === current;
        return (
          <div key={step.number} className="flex items-center shrink-0">
            <Link href={step.href} className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                style={{
                  backgroundColor: done ? '#22c55e' : active ? '#0f2044' : '#e5e7eb',
                  color: done || active ? '#ffffff' : '#9ca3af',
                }}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.number}
              </div>
              <span
                className="text-xs font-medium text-center hidden sm:block w-16 leading-tight"
                style={{ color: active ? '#0f2044' : done ? '#22c55e' : '#9ca3af' }}
              >
                {step.label}
              </span>
            </Link>
            {idx < STEPS.length - 1 && (
              <div
                className="h-0.5 w-6 sm:w-10 mx-1 mt-0 sm:-mt-4 shrink-0 rounded-full"
                style={{ backgroundColor: step.number < current ? '#22c55e' : '#e5e7eb' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
