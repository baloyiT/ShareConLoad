'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import { logAudit } from '@/services/auditLogger';

type OperatorRow = {
  id: string;
  created_at: string;
  operator_profile: {
    id: string;
    legal_name: string | null;
    payout_enabled: boolean;
    payout_hold: boolean;
    payout_hold_reason: string | null;
    paystack_recipient_code: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
  } | null;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminOperatorsPage() {
  const [operators,  setOperators]  = useState<OperatorRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [adminId,    setAdminId]    = useState<string | null>(null);
  const [saving,     setSaving]     = useState<string | null>(null);
  const [holdModal,  setHoldModal]  = useState<OperatorRow | null>(null);
  const [holdReason, setHoldReason] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
        if (profile) setAdminId(profile.id);
      }

      const { data, error: err } = await supabase
        .from('profiles')
        .select(`
          id, created_at,
          operator_profile:operator_profiles!profile_id(
            id, legal_name, payout_enabled, payout_hold, payout_hold_reason,
            paystack_recipient_code, bank_account_name, bank_account_number
          )
        `)
        .eq('role_type', 'operator')
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); }
      else { setOperators((data ?? []) as unknown as OperatorRow[]); }
      setLoading(false);
    }
    init();
  }, []);

  async function togglePayoutEnabled(op: OperatorRow) {
    if (!op.operator_profile) return;
    setSaving(op.id + '_enabled');
    const newVal = !op.operator_profile.payout_enabled;

    const { error: err } = await supabase
      .from('operator_profiles')
      .update({ payout_enabled: newVal })
      .eq('id', op.operator_profile.id);

    if (!err) {
      setOperators((prev) =>
        prev.map((o) => o.id === op.id
          ? { ...o, operator_profile: o.operator_profile ? { ...o.operator_profile, payout_enabled: newVal } : null }
          : o),
      );
      await logAudit({
        action:      newVal ? 'operator.payout_enabled' : 'operator.payout_disabled',
        target_type: 'operator_profile',
        target_id:   op.operator_profile.id,
        actor_id:    adminId ?? undefined,
      });
    } else {
      setError(err.message);
    }
    setSaving(null);
  }

  async function applyHold() {
    if (!holdModal?.operator_profile) return;
    setSaving(holdModal.id + '_hold');

    const { error: err } = await supabase
      .from('operator_profiles')
      .update({ payout_hold: true, payout_hold_reason: holdReason.trim() || null })
      .eq('id', holdModal.operator_profile.id);

    if (!err) {
      setOperators((prev) =>
        prev.map((o) => o.id === holdModal.id
          ? { ...o, operator_profile: o.operator_profile ? { ...o.operator_profile, payout_hold: true, payout_hold_reason: holdReason.trim() || null } : null }
          : o),
      );
      await logAudit({
        action:      'operator.payout_hold_placed',
        target_type: 'operator_profile',
        target_id:   holdModal.operator_profile.id,
        actor_id:    adminId ?? undefined,
        metadata:    { reason: holdReason.trim() },
      });
      setHoldModal(null);
      setHoldReason('');
    } else {
      setError(err.message);
    }
    setSaving(null);
  }

  async function removeHold(op: OperatorRow) {
    if (!op.operator_profile) return;
    setSaving(op.id + '_hold');

    const { error: err } = await supabase
      .from('operator_profiles')
      .update({ payout_hold: false, payout_hold_reason: null })
      .eq('id', op.operator_profile.id);

    if (!err) {
      setOperators((prev) =>
        prev.map((o) => o.id === op.id
          ? { ...o, operator_profile: o.operator_profile ? { ...o.operator_profile, payout_hold: false, payout_hold_reason: null } : null }
          : o),
      );
      await logAudit({
        action:      'operator.payout_hold_removed',
        target_type: 'operator_profile',
        target_id:   op.operator_profile.id,
        actor_id:    adminId ?? undefined,
      });
    } else {
      setError(err.message);
    }
    setSaving(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-8 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-400 text-sm mb-1">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Operator Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage payout eligibility and hold controls for operators.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : operators.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
            <p className="text-gray-400 text-sm">No operators found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Operator', 'Bank', 'Paystack', 'Payout Enabled', 'Hold', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op) => {
                    const p = op.operator_profile;
                    return (
                      <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#f97316' }}>
                              {(p?.legal_name ?? '?')[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800 text-sm">{p?.legal_name ?? <span className="text-gray-400 italic">No name</span>}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-gray-600">
                          {p?.bank_account_name ? (
                            <div>
                              <p className="font-medium">{p.bank_account_name}</p>
                              <p className="text-xs text-gray-400">{p.bank_account_number}</p>
                            </div>
                          ) : <span className="text-gray-400 text-xs italic">Not set</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          {p?.paystack_recipient_code
                            ? <span className="badge badge-sm bg-green-50 text-green-600 border-0">Registered</span>
                            : <span className="badge badge-sm bg-gray-100 text-gray-400 border-0">Not registered</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => togglePayoutEnabled(op)}
                            disabled={!p || saving === op.id + '_enabled'}
                            className="btn btn-xs rounded-lg font-semibold"
                            style={p?.payout_enabled
                              ? { backgroundColor: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0' }
                              : { backgroundColor: '#fafafa', color: '#6b7280', border: '1px solid #e5e7eb' }}
                          >
                            {saving === op.id + '_enabled'
                              ? <span className="loading loading-spinner loading-xs" />
                              : p?.payout_enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          {p?.payout_hold ? (
                            <div className="flex flex-col gap-1">
                              <span className="badge badge-sm bg-red-50 text-red-500 border-0">On Hold</span>
                              {p.payout_hold_reason && (
                                <span className="text-xs text-gray-400 max-w-[120px] truncate">{p.payout_hold_reason}</span>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-sm bg-gray-50 text-gray-400 border-0">None</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-sm text-gray-500">{fmt(op.created_at)}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex gap-1.5">
                            {p?.payout_hold ? (
                              <button
                                onClick={() => removeHold(op)}
                                disabled={saving === op.id + '_hold'}
                                className="btn btn-ghost btn-xs text-green-600 hover:bg-green-50 rounded-lg"
                              >
                                {saving === op.id + '_hold' ? <span className="loading loading-spinner loading-xs" /> : 'Remove Hold'}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setHoldModal(op); setHoldReason(''); }}
                                disabled={!p}
                                className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50 rounded-lg"
                              >
                                Place Hold
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hold modal */}
      {holdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800">Place Payout Hold</h3>
              <p className="text-sm text-gray-500 mt-1">
                Placing a hold on <strong>{holdModal.operator_profile?.legal_name ?? 'this operator'}</strong> will prevent all payout disbursements.
              </p>
            </div>
            <div className="px-6 py-4">
              <label className="text-sm font-semibold text-gray-700">Reason <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea
                className="textarea textarea-bordered w-full h-24 resize-none mt-1.5"
                placeholder="e.g. Compliance review in progress, dispute pending…"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
              />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setHoldModal(null)} className="btn btn-ghost flex-1 rounded-xl text-gray-500">Cancel</button>
              <button
                onClick={applyHold}
                disabled={!!saving}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90"
                style={{ backgroundColor: '#ef4444' }}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Place Hold'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
