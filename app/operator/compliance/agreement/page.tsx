'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { notify } from '@/services/notificationService';
import ComplianceStepper from '@/components/ComplianceStepper';
import {
  OPERATOR_AGREEMENT_VERSION,
  OPERATOR_AGREEMENT_TITLE,
  OPERATOR_AGREEMENT_CLAUSES,
  operatorAgreementPlainText,
} from '@/services/agreementContent';

import { Check } from 'lucide-react';
const AGREEMENT_VERSION = OPERATOR_AGREEMENT_VERSION;

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ComplianceAgreementPage() {
  const router = useRouter();

  const [profileId,  setProfileId]  = useState<string | null>(null);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [legalName,  setLegalName]  = useState<string>('');
  const [signedAt,   setSignedAt]   = useState<string | null>(null);
  const [pdfPath,    setPdfPath]    = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [confirmed,  setConfirmed]  = useState(false);
  const [signing,    setSigning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/agreement'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .single();

      if (!profile) { setError('Operator profile not found.'); setLoading(false); return; }
      setProfileId(profile.id);

      const { data: op } = await supabase
        .from('operator_profiles')
        .select('id, service_agreement_signed_at, legal_name')
        .eq('profile_id', profile.id)
        .single();

      setSignedAt(op?.service_agreement_signed_at ?? null);
      setLegalName(op?.legal_name ?? '');

      if (op?.id) {
        const { data: agDoc } = await supabase
          .from('compliance_documents')
          .select('file_url')
          .eq('operator_profile_id', op.id)
          .eq('doc_type', 'service_agreement')
          .maybeSingle();
        if (agDoc?.file_url) setPdfPath(agDoc.file_url);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSign() {
    if (!confirmed || !profileId) return;
    setSigning(true);
    setError(null);

    const now = new Date().toISOString();
    const { data, error: fnErr } = await supabase.functions.invoke('generate-agreement-pdf', {
      body: { version: AGREEMENT_VERSION, agreementText: operatorAgreementPlainText() },
    });
    if (fnErr || !data?.success) {
      let msg = (data?.error as string | undefined) ?? fnErr?.message ?? 'Could not record agreement.';
      const ctx = (fnErr as { context?: { json?: () => Promise<unknown> } } | null)?.context;
      if (!data?.error && ctx?.json) { try { const b = await ctx.json() as { error?: string }; if (b?.error) msg = b.error; } catch { /* */ } }
      setError(msg);
      setSigning(false);
      return;
    }
    setSignedAt(now);
    setPdfPath((data.pdf_path as string | undefined) ?? null);
    if (userId) {
      await notify('operator.compliance_submitted', { recipientId: userId, legalName });
    }
    setSigning(false);
  }

  if (loading) {
    return <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ComplianceStepper current={5} />
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Service Agreement</h1>
        <p className="text-sm text-gray-400 mt-0.5">Version {AGREEMENT_VERSION}, read carefully before signing.</p>
      </div>

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

      {signedAt && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Check className="w-5 h-5 text-green-500 shrink-0" strokeWidth={2.5} />
          <div>
            <p className="text-sm font-bold text-green-800">Agreement signed</p>
            <p className="text-xs text-green-600">Signed on {fmt(signedAt)} · Version {AGREEMENT_VERSION}</p>
          </div>
        </div>
      )}

      {/* Agreement text */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5 prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed">
        <h2 className="text-base font-bold text-gray-800 mb-3">{OPERATOR_AGREEMENT_TITLE}</h2>
        {OPERATOR_AGREEMENT_CLAUSES.map((c) => (
          <p key={c.n}><strong>{c.n}. {c.heading}.</strong> {c.body}</p>
        ))}
        <p className="text-xs text-gray-400 mt-4">Last updated: 2026-06-24 · Version {AGREEMENT_VERSION}</p>
      </div>

      {signedAt ? (
        <>
          <p className="text-sm text-gray-400 text-center">
            To update your signed agreement, contact <span className="font-mono">support@shareconload.com</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link href="/operator/compliance" className="btn flex-1 font-bold rounded-xl text-white" style={{ backgroundColor: '#0b103a' }}>
              View Compliance Status
            </Link>
            <button
              type="button"
              onClick={async () => {
                let path = pdfPath;
                if (!path) {
                  const { data: doc } = await supabase.from('compliance_documents')
                    .select('file_url')
                    .eq('doc_type', 'service_agreement')
                    .order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
                  path = doc?.file_url ?? null;
                }
                if (!path) return;
                const { data } = await supabase.storage.from('compliance-documents').createSignedUrl(path, 60);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }}
              className="btn flex-1 font-bold rounded-xl text-white hover:opacity-90"
              style={{ backgroundColor: '#ff6a00' }}
            >
              Download signed agreement (PDF)
            </button>
            <Link href="/operator" className="btn flex-1 btn-ghost rounded-xl font-semibold text-gray-600">
              Go to Dashboard
            </Link>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="checkbox checkbox-sm mt-0.5 shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              I have read and understood the ShareConLoad Operator Service Agreement (Version {AGREEMENT_VERSION}) and agree to be bound by its terms.
            </span>
          </label>

          <button
            onClick={handleSign}
            disabled={!confirmed || signing}
            className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#0b103a' }}
          >
            {signing ? <span className="loading loading-spinner loading-sm" /> : 'Sign Agreement'}
          </button>
        </div>
      )}
    </div>
  );
}
