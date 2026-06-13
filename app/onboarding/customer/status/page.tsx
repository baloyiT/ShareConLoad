'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type KycStatus = 'pending_review' | 'verified' | 'rejected';

const STATUS_CONFIG: Record<KycStatus, { label: string; color: string; bg: string; icon: string; message: string }> = {
  pending_review: {
    label:   'Under Review',
    color:   '#f97316',
    bg:      '#fff7ed',
    icon:    '🔍',
    message: 'Your documents are being reviewed by our compliance team. This usually takes 1–2 business days.',
  },
  verified: {
    label:   'Verified',
    color:   '#16a34a',
    bg:      '#f0fdf4',
    icon:    '✅',
    message: 'Your identity has been verified. You can now book container space.',
  },
  rejected: {
    label:   'Action Required',
    color:   '#ef4444',
    bg:      '#fef2f2',
    icon:    '❌',
    message: 'Your verification was not approved. Please review the reason below and resubmit.',
  },
};

const TRACKER_STEPS = [
  { label: 'Documents Submitted', statuses: ['pending_review', 'verified', 'rejected'] as KycStatus[] },
  { label: 'Under Review',        statuses: ['verified', 'rejected'] as KycStatus[] },
  { label: 'Verified',            statuses: ['verified'] as KycStatus[] },
];

export default function CustomerKycStatus() {
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'customer')
        .maybeSingle();

      if (!profile) { setLoading(false); return; }

      const { data: kyc } = await supabase
        .from('customer_kyc')
        .select('status, rejection_reason')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (kyc) {
        setStatus(kyc.status as KycStatus);
        setRejectionReason(kyc.rejection_reason);
      }
      setLoading(false);
    }
    load();
  }, []);

  const config = status ? STATUS_CONFIG[status] : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Verification Status</h1>

          {loading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
            </div>
          ) : !status ? (
            <div>
              <p className="text-gray-500 mb-4">No verification submitted yet.</p>
              <Link href="/onboarding/customer" className="btn text-white font-bold rounded-xl" style={{ backgroundColor: '#f97316' }}>
                Start Verification
              </Link>
            </div>
          ) : (
            <>
              {/* Step tracker */}
              <div className="flex items-center justify-center gap-2 mb-8">
                {TRACKER_STEPS.map((step, i) => {
                  const done = status && step.statuses.includes(status);
                  return (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={done ? { backgroundColor: config?.color, color: '#fff' } : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}
                        >
                          {done ? '✓' : i + 1}
                        </div>
                        <span className="text-xs text-gray-500 text-center w-16">{step.label}</span>
                      </div>
                      {i < TRACKER_STEPS.length - 1 && (
                        <div className="w-8 h-0.5 mb-4" style={{ backgroundColor: done ? config?.color : '#e5e7eb' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status card */}
              <div className="rounded-xl px-5 py-4 mb-6 text-left" style={{ backgroundColor: config?.bg }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{config?.icon}</span>
                  <span className="font-bold text-sm" style={{ color: config?.color }}>{config?.label}</span>
                </div>
                <p className="text-sm text-gray-600">{config?.message}</p>
              </div>

              {/* Rejection reason */}
              {status === 'rejected' && rejectionReason && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-left mb-6">
                  <p className="font-semibold mb-1">Reason:</p>
                  <p>{rejectionReason}</p>
                </div>
              )}

              {/* CTA */}
              {status === 'verified' && (
                <Link href="/" className="btn w-full text-white font-bold rounded-xl" style={{ backgroundColor: '#f97316' }}>
                  Browse Containers →
                </Link>
              )}
              {(status === 'rejected') && (
                <Link href="/onboarding/customer" className="btn w-full text-white font-bold rounded-xl" style={{ backgroundColor: '#f97316' }}>
                  Resubmit Verification
                </Link>
              )}
              {status === 'pending_review' && (
                <Link href="/" className="btn btn-ghost w-full rounded-xl text-gray-500">← Back to Home</Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
