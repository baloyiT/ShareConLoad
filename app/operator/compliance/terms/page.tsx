'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import ComplianceStepper from '@/components/ComplianceStepper';
import {
  PARTICIPATION_TERMS_CLAUSES,
  PARTICIPATION_TERMS_TITLE,
  PARTICIPATION_TERMS_VERSION,
} from '@/services/participationTerms';
import { termsOpenForAcceptance } from '@/services/operatorSteps';

import { AlertTriangle, Check, Clock } from 'lucide-react';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ComplianceTermsPage() {
  const router = useRouter();

  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [open,       setOpen]       = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [confirmed,  setConfirmed]  = useState(false);
  const [accepting,  setAccepting]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/terms'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .maybeSingle();

      if (!profile) { setError('Operator profile not found.'); setLoading(false); return; }

      const { data: op } = await supabase
        .from('operator_profiles')
        .select('participation_terms_accepted_at, participation_terms_version')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (op?.participation_terms_version === PARTICIPATION_TERMS_VERSION) {
        setAcceptedAt(op.participation_terms_accepted_at);
      }
      setOpen(await termsOpenForAcceptance());
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleAccept() {
    if (!confirmed) return;
    setAccepting(true);
    setError(null);

    const { error: rpcErr } = await supabase.rpc('accept_participation_terms', {
      p_version: PARTICIPATION_TERMS_VERSION,
    });

    if (rpcErr) {
      console.error('Could not accept participation terms:', rpcErr);
      setError('Could not record your acceptance. Please reload the page and try again.');
      setAccepting(false);
      return;
    }
    setAcceptedAt(new Date().toISOString());
    setAccepting(false);
  }

  if (loading) {
    return <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ComplianceStepper current="terms" />
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">{PARTICIPATION_TERMS_TITLE}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Version {PARTICIPATION_TERMS_VERSION}</p>
      </div>

      <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#fff7ed', border: '1px solid #FFB37B' }}>
        <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#ff6a00' }} />
        <p className="text-sm font-semibold text-gray-800">
          Draft for review. These terms have not been finalised and may change.
        </p>
      </div>

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

      {acceptedAt && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Check className="w-5 h-5 text-green-500 shrink-0" strokeWidth={2.5} />
          <p className="text-sm font-bold text-green-800">
            You accepted version {PARTICIPATION_TERMS_VERSION} on {fmt(acceptedAt)}.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
        {PARTICIPATION_TERMS_CLAUSES.map((c) => (
          <div key={c.n}>
            <p className="text-sm font-bold text-gray-800">{c.n}. {c.heading}</p>
            <p className="text-sm text-gray-600 mt-0.5">{c.body}</p>
          </div>
        ))}
      </div>

      {acceptedAt ? (
        <div className="mt-6">
          <Link
            href="/operator/compliance"
            className="btn w-full text-white font-bold rounded-xl hover:opacity-90"
            style={{ backgroundColor: '#0b103a' }}
          >
            Back to your steps
          </Link>
        </div>
      ) : !open ? (
        <div className="mt-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100">
          <Clock className="w-5 h-5 shrink-0 text-gray-400" />
          <p className="text-sm text-gray-700">
            These terms are being finalised, so acceptance is not open yet. There is nothing for you to do on this step for now.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="checkbox checkbox-sm mt-0.5"
            />
            <span>I have read these terms and I accept them.</span>
          </label>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!confirmed || accepting}
            className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#0b103a' }}
          >
            {accepting ? <span className="loading loading-spinner loading-sm" /> : 'Accept terms'}
          </button>
        </div>
      )}
    </div>
  );
}
