'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';
import { logAudit, logAuditChecked } from '@/services/auditLogger';
import { notify } from '@/services/notificationService';
import {
  isBlankTradingName, isIndividual, TRADING_NAME_MAX_LENGTH, verifiableLevel, verificationLabel,
  type ParticipationStatus, type VerificationLevel,
} from '@/services/operatorCompliance';

type OperatorRow = {
  id: string;
  user_id: string;
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
    status: string | null;
    service_agreement_signed_at: string | null;
    compliance_rejection_reason: string | null;
    entity_type: string | null;
    trading_name: string | null;
    verification_level: VerificationLevel;
    participation_status: ParticipationStatus;
    participation_terms_accepted_at: string | null;
    operator_services: { id: string }[];
    operator_coverage: { id: string }[];
    compliance_documents: { doc_type: string; status: string }[];
  } | null;
};

// Verify is only offered when it raises the level.
const LEVEL_RANK: Record<VerificationLevel, number> = { registered: 0, identity_verified: 1, business_verified: 2 };

type OperatorProfile = NonNullable<OperatorRow['operator_profile']>;

// Why an active, verified operator is not in the directory yet. Empty when nothing blocks it.
function listingBlockers(p: OperatorProfile): string[] {
  const out: string[] = [];
  if (isIndividual(p.entity_type) && isBlankTradingName(p.trading_name)) {
    out.push('Trading name is blank (an individual is never listed under their legal name)');
  }
  if (p.operator_services.length === 0) out.push('No services chosen');
  if (p.operator_coverage.length === 0) out.push('No coverage added');
  if (!p.participation_terms_accepted_at) out.push('Terms not accepted');
  return out;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminOperatorsPage() {
  const [operators,        setOperators]        = useState<OperatorRow[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [adminId,          setAdminId]          = useState<string | null>(null);
  const [saving,           setSaving]           = useState<string | null>(null);
  const [holdModal,        setHoldModal]        = useState<OperatorRow | null>(null);
  const [holdReason,       setHoldReason]       = useState('');
  const [rejectModal,      setRejectModal]      = useState<OperatorRow | null>(null);
  const [rejectReason,     setRejectReason]     = useState('');
  const [nameDrafts,       setNameDrafts]       = useState<Record<string, string>>({});
  const [nameSaved,        setNameSaved]        = useState<string | null>(null);
  const [confirmSuspendId, setConfirmSuspendId] = useState<string | null>(null);
  const [termsOpen,        setTermsOpen]        = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminId(user.id);

      const { data, error: err } = await supabase
        .from('profiles')
        .select(`
          id, user_id, created_at,
          operator_profile:operator_profiles!profile_id(
            id, legal_name, payout_enabled, payout_hold, payout_hold_reason,
            paystack_recipient_code, bank_account_name, bank_account_number,
            status, service_agreement_signed_at, compliance_rejection_reason,
            entity_type, trading_name, verification_level, participation_status,
            participation_terms_accepted_at,
            operator_services(id), operator_coverage(id),
            compliance_documents(doc_type, status)
          )
        `)
        .eq('role_type', 'operator')
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); }
      else { setOperators((data ?? []) as unknown as OperatorRow[]); }

      const { data: terms, error: termsErr } = await supabase
        .from('participation_terms').select('open_for_acceptance').eq('is_current', true);
      if (termsErr) console.error('Could not read participation terms:', termsErr);
      else setTermsOpen((terms ?? []).some((t) => t.open_for_acceptance === true));
      setLoading(false);
    }
    init();
  }, []);

  function patchProfile(op: OperatorRow, patch: Partial<OperatorProfile>) {
    setOperators((prev) =>
      prev.map((o) => o.id === op.id
        ? { ...o, operator_profile: o.operator_profile ? { ...o.operator_profile, ...patch } : null }
        : o));
  }

  async function verify(op: OperatorRow, level: VerificationLevel) {
    const p = op.operator_profile;
    if (!p) return;
    setSaving(op.id + '_verify');
    setError(null);

    // The page may be stale: check the approved documents again just before verifying.
    const { data: docs, error: docsErr } = await supabase
      .from('compliance_documents').select('doc_type').eq('operator_profile_id', p.id).eq('status', 'approved');
    if (docsErr) {
      console.error('Re-reading documents failed:', docsErr);
      setError('Could not verify this operator.');
      setSaving(null);
      return;
    }
    const check = verifiableLevel(p.entity_type, (docs ?? []).map((d) => d.doc_type as string));
    if (check.level !== level || check.missing.length > 0) {
      setError(`The documents are no longer approved for this level (needs: ${check.missing.join(', ')}). Refresh the page.`);
      setSaving(null);
      return;
    }

    // A zero-row update (select returns nothing) counts as a failure.
    const { data, error: err } = await supabase
      .from('operator_profiles').update({ verification_level: level }).eq('id', p.id).select('id');
    if (err || !data || data.length === 0) {
      console.error('Verify failed:', err ?? 'no rows updated');
      setError('Could not verify this operator.');
    } else {
      patchProfile(op, { verification_level: level });
      await audit('operator_verified', p.id, { verification_level: level, previous: p.verification_level });
    }
    setSaving(null);
  }

  async function audit(action: string, targetId: string, metadata: Record<string, unknown>) {
    const ok = await logAuditChecked({
      action, target_type: 'operator_profile', target_id: targetId,
      actor_id: adminId ?? undefined, metadata,
    });
    if (!ok) setError('Saved, but the audit record failed. Tell support.');
    return ok;
  }

  async function setParticipation(op: OperatorRow, next: 'active' | 'suspended') {
    const p = op.operator_profile;
    if (!p) return;
    setSaving(op.id + '_participation');
    setError(null);
    const { data, error: err } = await supabase
      .from('operator_profiles').update({ participation_status: next }).eq('id', p.id).select('id');
    if (err || !data || data.length === 0) {
      console.error('Participation change failed:', err ?? 'no rows updated');
      setError('Could not change this operator.');
    } else {
      patchProfile(op, { participation_status: next });
      await audit(next === 'active' ? 'operator_activated' : 'operator_suspended', p.id, { previous: p.participation_status });
    }
    setConfirmSuspendId(null);
    setSaving(null);
  }

  async function saveTradingName(op: OperatorRow) {
    const p = op.operator_profile;
    if (!p) return;
    const draft = (nameDrafts[op.id] ?? p.trading_name ?? '').trim();
    const next = draft === '' ? null : draft;
    if (next !== null && (isBlankTradingName(next) || next.length > TRADING_NAME_MAX_LENGTH)) {
      setError(`A trading name needs a visible character and at most ${TRADING_NAME_MAX_LENGTH} characters.`);
      return;
    }
    if (next === p.trading_name) return;
    setSaving(op.id + '_name');
    setError(null);
    setNameSaved(null);
    const { data, error: err } = await supabase
      .from('operator_profiles').update({ trading_name: next }).eq('id', p.id).select('id');
    if (err || !data || data.length === 0) {
      console.error('Trading name save failed:', err ?? 'no rows updated');
      setError('Could not save the trading name.');
    } else {
      patchProfile(op, { trading_name: next });
      setNameDrafts((prev) => ({ ...prev, [op.id]: next ?? '' }));
      if (await audit('operator_trading_name_changed', p.id, { old: p.trading_name, new: next })) setNameSaved(op.id);
    }
    setSaving(null);
  }

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

  async function approveCompliance(op: OperatorRow) {
    if (!op.operator_profile) return;
    setSaving(op.id + '_approve');

    const { error: err } = await supabase
      .from('operator_profiles')
      .update({ status: 'active', compliance_rejection_reason: null })
      .eq('id', op.operator_profile.id);

    if (!err) {
      setOperators((prev) =>
        prev.map((o) => o.id === op.id
          ? { ...o, operator_profile: o.operator_profile ? { ...o.operator_profile, status: 'active', compliance_rejection_reason: null } : null }
          : o),
      );
      await logAudit({
        action:      'operator.compliance_approved',
        target_type: 'operator_profile',
        target_id:   op.operator_profile.id,
        actor_id:    adminId ?? undefined,
      });
      await notify('operator.compliance_approved', {
        recipientId: op.user_id,
        legalName:   op.operator_profile.legal_name ?? '',
      });
    } else {
      setError(err.message);
    }
    setSaving(null);
  }

  async function applyReject() {
    if (!rejectModal?.operator_profile) return;
    setSaving(rejectModal.id + '_reject');
    const reason = rejectReason.trim() || 'Your submission requires additional information.';

    const { error: err } = await supabase
      .from('operator_profiles')
      .update({ status: 'draft', compliance_rejection_reason: reason })
      .eq('id', rejectModal.operator_profile.id);

    if (!err) {
      setOperators((prev) =>
        prev.map((o) => o.id === rejectModal.id
          ? { ...o, operator_profile: o.operator_profile ? { ...o.operator_profile, status: 'draft', compliance_rejection_reason: reason } : null }
          : o),
      );
      await logAudit({
        action:      'operator.compliance_rejected',
        target_type: 'operator_profile',
        target_id:   rejectModal.operator_profile!.id,
        actor_id:    adminId ?? undefined,
        metadata:    { reason },
      });
      await notify('operator.compliance_rejected', {
        recipientId: rejectModal.user_id,
        legalName:   rejectModal.operator_profile.legal_name ?? '',
        reason,
      });
      setRejectModal(null);
      setRejectReason('');
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
              <span style={{ color: '#0b103a' }}>Share</span><span style={{ color: '#ff6a00' }}>Con</span><span style={{ color: '#0b103a' }}>Load</span>
            </span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>
      </nav>

      <PageHero gradient label="Admin" title="Operator Management" description="Manage payout eligibility and hold controls for operators." />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}
        {termsOpen === false && (
          <div className="alert alert-info text-sm mb-4">
            No operator can be listed until the participation terms are approved and opened for acceptance.
            You can still verify and activate operators now; they appear in the directory once they accept the terms.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
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
                    {['Operator', 'Compliance', 'Bank', 'Paystack', 'Payout Enabled', 'Hold', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op) => {
                    const p = op.operator_profile;
                    return (
                      <Fragment key={op.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#ff6a00' }}>
                              {(p?.legal_name ?? '?')[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800 text-sm">{p?.legal_name ?? <span className="text-gray-400 italic">No name</span>}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {(() => {
                            const status = p?.status ?? 'draft';
                            const signed = !!p?.service_agreement_signed_at;
                            if (status === 'active' || status === 'trusted') {
                              return <span className="badge badge-sm bg-green-50 text-green-600 border-0">Approved</span>;
                            }
                            if (status === 'pending_verification' && signed) {
                              return (
                                <div className="flex flex-col gap-1">
                                  <span className="badge badge-sm bg-blue-50 text-blue-600 border-0">Pending Review</span>
                                  <div className="flex gap-1 mt-0.5">
                                    <button
                                      onClick={() => approveCompliance(op)}
                                      disabled={saving === op.id + '_approve'}
                                      className="btn btn-xs rounded-lg text-white font-semibold"
                                      style={{ backgroundColor: '#22c55e' }}
                                    >
                                      {saving === op.id + '_approve' ? <span className="loading loading-spinner loading-xs" /> : 'Approve'}
                                    </button>
                                    <button
                                      onClick={() => { setRejectModal(op); setRejectReason(''); }}
                                      className="btn btn-xs rounded-lg font-semibold border border-red-200 text-red-500 hover:bg-red-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            if (p?.compliance_rejection_reason) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span className="badge badge-sm bg-red-50 text-red-500 border-0">Rejected</span>
                                  <span className="text-xs text-gray-400 max-w-[140px] truncate">{p.compliance_rejection_reason}</span>
                                </div>
                              );
                            }
                            return <span className="badge badge-sm bg-gray-100 text-gray-400 border-0">Incomplete</span>;
                          })()}
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
                      {p && (() => {
                        const approved = p.compliance_documents.filter((d) => d.status === 'approved').map((d) => d.doc_type);
                        const { level, missing } = verifiableLevel(p.entity_type, approved);
                        const label = verificationLabel(p.verification_level);
                        const blockers = p.participation_status === 'active' && p.verification_level !== 'registered' ? listingBlockers(p) : [];
                        const inputId = `trading-name-${op.id}`;
                        return (
                          <tr className="border-b border-gray-50">
                            <td colSpan={8} className="px-4 pb-4 pt-0">
                              <div data-testid="operator-directory-panel" className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm grid gap-3">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                  Directory listing · {p.legal_name ?? 'No name'} · {isIndividual(p.entity_type) ? 'Individual' : 'Company'}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-gray-500">Verification:</span>
                                  <span data-testid="verification-badge" className="badge badge-sm border-0 bg-blue-50 text-blue-600">{label ?? 'Registered'}</span>
                                  {LEVEL_RANK[level] > LEVEL_RANK[p.verification_level] && missing.length === 0 && (
                                    <button
                                      onClick={() => verify(op, level)}
                                      disabled={saving === op.id + '_verify'}
                                      className="btn btn-xs rounded-lg text-white font-semibold"
                                      style={{ backgroundColor: '#081D3A' }}
                                    >
                                      {`Verify as ${verificationLabel(level)}`}
                                    </button>
                                  )}
                                  {LEVEL_RANK[level] > LEVEL_RANK[p.verification_level] && missing.length > 0 && (
                                    <span className="text-xs text-gray-500">
                                      Cannot verify yet. Needs approved documents: {missing.join(', ')}.
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-gray-500">Participation:</span>
                                  <span className="badge badge-sm border-0 bg-gray-100 text-gray-600 capitalize">{p.participation_status}</span>
                                  {p.participation_status === 'active' ? (
                                    confirmSuspendId === op.id ? (
                                      <>
                                        <span className="text-xs text-red-600">Suspending removes this operator from the directory immediately.</span>
                                        <button
                                          onClick={() => setParticipation(op, 'suspended')}
                                          disabled={saving === op.id + '_participation'}
                                          className="btn btn-xs rounded-lg text-white font-semibold"
                                          style={{ backgroundColor: '#ef4444' }}
                                        >
                                          Confirm suspend
                                        </button>
                                        <button onClick={() => setConfirmSuspendId(null)} className="btn btn-xs btn-ghost">Cancel</button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => setConfirmSuspendId(op.id)}
                                        className="btn btn-xs rounded-lg font-semibold border border-red-200 text-red-500 hover:bg-red-50"
                                      >
                                        Suspend
                                      </button>
                                    )
                                  ) : (
                                    <button
                                      onClick={() => setParticipation(op, 'active')}
                                      disabled={saving === op.id + '_participation'}
                                      className="btn btn-xs rounded-lg text-white font-semibold"
                                      style={{ backgroundColor: '#FF6A00' }}
                                    >
                                      Activate
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-end gap-2">
                                  <div>
                                    <label htmlFor={inputId} className="block text-gray-500 mb-1">Trading name</label>
                                    <input
                                      id={inputId}
                                      type="text"
                                      className="input input-bordered input-sm w-64 max-w-full"
                                      value={nameDrafts[op.id] ?? p.trading_name ?? ''}
                                      onChange={(e) => { setNameSaved(null); setNameDrafts((prev) => ({ ...prev, [op.id]: e.target.value })); }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => saveTradingName(op)}
                                    disabled={saving === op.id + '_name'}
                                    className="btn btn-sm btn-outline rounded-lg"
                                  >
                                    Save trading name
                                  </button>
                                  {nameSaved === op.id && <span className="text-xs text-green-600">Trading name saved</span>}
                                </div>
                                <p className="text-xs text-gray-400">
                                  The directory shows the trading name. Companies fall back to their legal name; individuals are never listed under their legal name.
                                </p>
                                {blockers.length > 0 && (
                                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                                    <p className="font-semibold mb-1">Active and verified, but not listed yet:</p>
                                    <ul className="list-disc ml-4">
                                      {blockers.map((b) => <li key={b}>{b}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Compliance reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800">Reject Compliance</h3>
              <p className="text-sm text-gray-500 mt-1">
                The operator will be notified with this reason and asked to resubmit.
              </p>
            </div>
            <div className="px-6 py-4">
              <label className="text-sm font-semibold text-gray-700">Reason <span className="text-red-500">*</span></label>
              <textarea
                className="textarea textarea-bordered w-full h-24 resize-none mt-1.5"
                placeholder="e.g. Identity document is not legible. Please resubmit a clearer scan."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setRejectModal(null)} className="btn btn-ghost flex-1 rounded-xl text-gray-500">Cancel</button>
              <button
                onClick={applyReject}
                disabled={!!saving || !rejectReason.trim()}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90"
                style={{ backgroundColor: '#ef4444' }}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Send Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

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
