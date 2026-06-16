// app/onboarding/agent/status/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import { Check, CheckCircle2, FileText, Search, XCircle } from 'lucide-react';

type Status = 'draft' | 'pending_review' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<Status, { label: string; color: string; desc: string }> = {
  draft:          { label: 'Draft',        color: '#6b7280', desc: 'Your application is incomplete. Please finish all steps.' },
  pending_review: { label: 'Under Review', color: '#ff6a00', desc: 'Your application has been submitted and is being reviewed by our team. This typically takes 1–3 business days.' },
  approved:       { label: 'Approved',     color: '#16a34a', desc: 'Your agent account is active. You can now access the Agent Portal.' },
  rejected:       { label: 'Rejected',     color: '#ef4444', desc: 'Your application was not approved. Please review the reason below and resubmit.' },
};

export default function AgentStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).eq('role_type', 'agent').maybeSingle();
      if (!profile) { setLoading(false); return; }
      const { data: ap } = await supabase.from('agent_profiles').select('status, rejection_reason').eq('profile_id', profile.id).maybeSingle();
      if (ap) {
        setStatus(ap.status as Status);
        setRejectionReason(ap.rejection_reason ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} /></div>;

  const cfg = status ? STATUS_CONFIG[status] : null;
  const STEPS_STATUS: { label: string; done: boolean; active: boolean }[] = [
    { label: 'Submitted',    done: status !== null && status !== 'draft', active: false },
    { label: 'Under Review', done: status === 'approved' || status === 'rejected', active: status === 'pending_review' },
    { label: status === 'rejected' ? 'Rejected' : 'Approved', done: status === 'approved', active: status === 'rejected' },
  ];

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
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: cfg ? `${cfg.color}20` : '#f3f4f6' }}>
            {status === 'approved'
              ? <CheckCircle2 className="w-8 h-8" style={{ color: '#16a34a' }} />
              : status === 'rejected'
                ? <XCircle className="w-8 h-8" style={{ color: '#ef4444' }} />
                : status === 'pending_review'
                  ? <Search className="w-8 h-8" style={{ color: '#ff6a00' }} />
                  : <FileText className="w-8 h-8" style={{ color: '#6b7280' }} />}
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Application Status</h1>
          {cfg && <p className="text-sm font-bold mb-2" style={{ color: cfg.color }}>{cfg.label}</p>}
          {cfg && <p className="text-sm text-gray-500 mb-6">{cfg.desc}</p>}

          {/* Step tracker */}
          <div className="flex items-center justify-center gap-0 mb-6">
            {STEPS_STATUS.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? 'bg-green-500 text-white' : s.active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                  </div>
                  <span className="text-[10px] text-gray-500 w-16 text-center leading-tight">{s.label}</span>
                </div>
                {i < STEPS_STATUS.length - 1 && (
                  <div className="w-12 h-0.5 bg-gray-200 mx-1 mb-4" />
                )}
              </div>
            ))}
          </div>

          {status === 'rejected' && rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-left mb-4">
              <p className="font-bold mb-1">Reason:</p>
              <p>{rejectionReason}</p>
            </div>
          )}

          {status === 'approved' && (
            <Link href="/agent" className="btn w-full text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>
              Go to Agent Portal →
            </Link>
          )}
          {(status === 'rejected' || status === 'draft') && (
            <Link href="/onboarding/agent" className="btn w-full text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>
              {status === 'rejected' ? 'Resubmit Application' : 'Continue Application'}
            </Link>
          )}
          {status === 'pending_review' && (
            <Link href="/" className="btn btn-ghost w-full rounded-xl text-gray-500">Back to Home</Link>
          )}
        </div>
      </div>
    </div>
  );
}
