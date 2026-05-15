'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

const AGREEMENT_VERSION = '1.0';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ComplianceAgreementPage() {
  const router = useRouter();

  const [profileId,  setProfileId]  = useState<string | null>(null);
  const [signedAt,   setSignedAt]   = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [confirmed,  setConfirmed]  = useState(false);
  const [signing,    setSigning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/agreement'); return; }

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
        .select('service_agreement_signed_at')
        .eq('profile_id', profile.id)
        .single();

      setSignedAt(op?.service_agreement_signed_at ?? null);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSign() {
    if (!confirmed || !profileId) return;
    setSigning(true);
    setError(null);

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('operator_profiles')
      .update({
        service_agreement_signed_at: now,
        service_agreement_version:   AGREEMENT_VERSION,
      })
      .eq('profile_id', profileId);

    if (updateErr) { setError(updateErr.message); } else { setSignedAt(now); }
    setSigning(false);
  }

  if (loading) {
    return <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Service Agreement</h1>
        <p className="text-sm text-gray-400 mt-0.5">Version {AGREEMENT_VERSION} — read carefully before signing.</p>
      </div>

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

      {signedAt && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-bold text-green-800">Agreement signed</p>
            <p className="text-xs text-green-600">Signed on {fmt(signedAt)} · Version {AGREEMENT_VERSION}</p>
          </div>
        </div>
      )}

      {/* Agreement text */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5 prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed">
        <h2 className="text-base font-bold text-gray-800 mb-3">ShareConLoad Operator Service Agreement</h2>

        <p><strong>1. Platform Access.</strong> ShareConLoad grants you a non-exclusive, non-transferable licence to list container space on the platform and accept bookings from customers.</p>

        <p><strong>2. Fees &amp; Commission.</strong> ShareConLoad charges a platform commission of <strong>5%</strong> on each gross payout amount. The net amount (gross minus commission) is transferred to your registered bank account via Paystack.</p>

        <p><strong>3. Payout Conditions.</strong> Payouts are released subject to: (a) the corresponding customer payment being confirmed as &apos;paid&apos;; (b) no active dispute on the booking; (c) payout account being verified and in good standing; and (d) expiry of the applicable refund window.</p>

        <p><strong>4. Operator Obligations.</strong> You must: (a) list only container space you have lawful authority to offer; (b) maintain accurate capacity and departure information; (c) honour confirmed bookings; (d) comply with all applicable customs, import, and export regulations.</p>

        <p><strong>5. Prohibited Goods.</strong> You must not facilitate the shipment of prohibited, restricted, or hazardous goods as defined by applicable law and international shipping conventions.</p>

        <p><strong>6. Dispute Resolution.</strong> In the event of a dispute raised by a customer, ShareConLoad reserves the right to place a payout hold pending investigation. You agree to co-operate fully with any such review.</p>

        <p><strong>7. Termination.</strong> ShareConLoad may suspend or terminate your account for breach of this agreement, fraudulent activity, or repeated customer complaints, with or without notice.</p>

        <p><strong>8. Limitation of Liability.</strong> ShareConLoad&apos;s liability to you in connection with any booking shall not exceed the net payout amount for that booking.</p>

        <p><strong>9. Governing Law.</strong> This agreement is governed by the laws of the Republic of South Africa.</p>

        <p className="text-xs text-gray-400 mt-4">Last updated: 2026-05-12 · Version {AGREEMENT_VERSION}</p>
      </div>

      {signedAt ? (
        <p className="text-sm text-gray-400 text-center">
          To update your signed agreement, contact <span className="font-mono">compliance@shareconload.com</span>.
        </p>
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
            style={{ backgroundColor: '#0f2044' }}
          >
            {signing ? <span className="loading loading-spinner loading-sm" /> : 'Sign Agreement'}
          </button>
        </div>
      )}
    </div>
  );
}
