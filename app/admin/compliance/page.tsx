'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

type ComplianceFlag = {
  id: string;
  target_type: string;
  target_id: string;
  flag_type: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
  raised_by_profile: { full_name: string | null } | null;
};

type ComplianceDoc = {
  id: string;
  doc_type: string;
  file_url: string;
  status: 'under_review' | 'approved' | 'rejected';
  admin_notes: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  operator_profile: {
    id: string;
    profile: { full_name: string | null } | null;
  } | null;
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  prohibited_cargo:   'Prohibited Cargo',
  sanctions_risk:     'Sanctions Risk',
  suspicious_payment: 'Suspicious Payment',
  customs_risk:       'Customs Risk',
  fraud_risk:         'Fraud Risk',
  unverified_identity:'Unverified Identity',
};

const FLAG_COLOURS: Record<string, string> = {
  prohibited_cargo:   '#ef4444',
  sanctions_risk:     '#7c3aed',
  suspicious_payment: '#f59e0b',
  customs_risk:       '#f97316',
  fraud_risk:         '#dc2626',
  unverified_identity:'#6b7280',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  identity:                   'Proof of Identity',
  business_registration:      'Business Registration',
  proof_of_warehouse_address: 'Proof of Warehouse Address',
  tax_clearance:              'Tax Clearance Certificate',
  banking_confirmation:       'Banking Confirmation',
  cargo_insurance:            'Cargo Insurance Certificate',
  freight_forwarding_license: 'Freight Forwarding License',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminCompliancePage() {
  const [flags,        setFlags]        = useState<ComplianceFlag[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [resolving,    setResolving]    = useState<string | null>(null);

  const [activeTab,    setActiveTab]    = useState<'flags' | 'documents'>('flags');
  const [docs,         setDocs]         = useState<ComplianceDoc[]>([]);
  const [docsLoading,  setDocsLoading]  = useState(true);
  const [docsError,    setDocsError]    = useState<string | null>(null);
  const [actionBusy,   setActionBusy]   = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNotes,  setRejectNotes]  = useState('');

  async function fetchFlags() {
    const { data, error: err } = await supabase
      .from('compliance_flags')
      .select(`
        id, target_type, target_id, flag_type, description, resolved, created_at,
        raised_by_profile:profiles!compliance_flags_raised_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (err) { setError(err.message); }
    else { setFlags((data ?? []) as unknown as ComplianceFlag[]); }
    setLoading(false);
  }

  async function fetchDocs() {
    const { data, error: err } = await supabase
      .from('compliance_documents')
      .select(`
        id, doc_type, file_url, status, admin_notes, uploaded_at, reviewed_at,
        operator_profile:operator_profiles!compliance_documents_operator_profile_id_fkey(
          id,
          profile:profiles!operator_profiles_profile_id_fkey(full_name)
        )
      `)
      .order('uploaded_at', { ascending: false });

    if (err) { setDocsError(err.message); }
    else { setDocs((data ?? []) as unknown as ComplianceDoc[]); }
    setDocsLoading(false);
  }

  useEffect(() => { fetchFlags(); fetchDocs(); }, []);

  async function toggleResolve(flag: ComplianceFlag) {
    setResolving(flag.id);
    const { error: err } = await supabase
      .from('compliance_flags')
      .update({
        resolved:    !flag.resolved,
        resolved_at: !flag.resolved ? new Date().toISOString() : null,
      })
      .eq('id', flag.id);

    if (!err) {
      setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, resolved: !f.resolved } : f));
    } else {
      setError(err.message);
    }
    setResolving(null);
  }

  async function viewDoc(fileUrl: string) {
    const { data, error: err } = await supabase.storage
      .from('compliance-documents')
      .createSignedUrl(fileUrl, 60);
    if (err || !data?.signedUrl) { setDocsError(err?.message ?? 'Could not generate view link.'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function approveDoc(id: string) {
    setActionBusy(id);
    const { error: err } = await supabase
      .from('compliance_documents')
      .update({ status: 'approved', admin_notes: null, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!err) setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: 'approved', admin_notes: null } : d));
    else setDocsError(err.message);
    setActionBusy(null);
  }

  async function rejectDoc(id: string) {
    setActionBusy(id);
    const { error: err } = await supabase
      .from('compliance_documents')
      .update({ status: 'rejected', admin_notes: rejectNotes.trim() || null, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!err) {
      setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: 'rejected', admin_notes: rejectNotes.trim() || null } : d));
      setRejectTarget(null);
      setRejectNotes('');
    } else {
      setDocsError(err.message);
    }
    setActionBusy(null);
  }

  const filtered = flags.filter((f) => showResolved || !f.resolved);

  const unresolvedCount = flags.filter((f) => !f.resolved).length;

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
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-gray-400 text-sm mb-1">Admin</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Compliance</h1>
            <p className="text-gray-400 text-sm mt-1">
              {unresolvedCount > 0 ? `${unresolvedCount} unresolved flag${unresolvedCount !== 1 ? 's' : ''} require attention.` : 'All flags resolved.'}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            <span className="text-sm text-gray-300">Show resolved</span>
          </label>
          <div className="flex gap-1 mt-4 w-full">
            {(['flags', 'documents'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
                style={activeTab === tab
                  ? { backgroundColor: '#f97316', color: '#ffffff' }
                  : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#d1d5db' }}
              >
                {tab === 'flags' ? 'Compliance Flags' : 'KYC Documents'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Flags tab ── */}
        {activeTab === 'flags' && (
          <>
            {error && <div className="alert alert-error text-sm mb-4">{error}</div>}
            {loading ? (
              <div className="flex justify-center py-24">
                <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
                <p className="text-gray-400 text-sm">No {showResolved ? '' : 'unresolved '}compliance flags.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filtered.map((flag) => (
                  <div key={flag.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="h-1 w-full" style={{ backgroundColor: flag.resolved ? '#86efac' : (FLAG_COLOURS[flag.flag_type] ?? '#6b7280') }} />
                    <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="badge badge-sm text-white font-semibold"
                            style={{ backgroundColor: flag.resolved ? '#22c55e' : (FLAG_COLOURS[flag.flag_type] ?? '#6b7280') }}>
                            {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
                          </span>
                          <span className="badge badge-sm bg-gray-100 text-gray-600 border-0 capitalize">{flag.target_type}</span>
                          {flag.resolved && <span className="badge badge-sm bg-green-50 text-green-600 border-0">Resolved</span>}
                        </div>
                        <p className="text-xs font-mono text-gray-400 mb-2">Target: {flag.target_id.slice(0, 16)}…</p>
                        {flag.description && <p className="text-sm text-gray-700 mb-2">{flag.description}</p>}
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>Raised: {fmt(flag.created_at)}</span>
                          {flag.raised_by_profile?.full_name && <span>By: {flag.raised_by_profile.full_name}</span>}
                        </div>
                      </div>
                      <button onClick={() => toggleResolve(flag)} disabled={resolving === flag.id}
                        className="btn btn-sm rounded-xl font-semibold shrink-0"
                        style={flag.resolved
                          ? { backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }
                          : { backgroundColor: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0' }}>
                        {resolving === flag.id
                          ? <span className="loading loading-spinner loading-xs" />
                          : flag.resolved ? 'Reopen' : 'Mark Resolved'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Documents tab ── */}
        {activeTab === 'documents' && (
          <>
            {docsError && <div className="alert alert-error text-sm mb-4">{docsError}</div>}
            {docsLoading ? (
              <div className="flex justify-center py-24">
                <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
              </div>
            ) : docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
                <p className="text-gray-400 text-sm">No compliance documents submitted yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {docs.map((doc) => {
                  const operatorName = doc.operator_profile?.profile?.full_name ?? 'Unknown operator';
                  const statusColour = doc.status === 'approved' ? '#22c55e' : doc.status === 'rejected' ? '#ef4444' : '#f59e0b';
                  const statusLabel  = doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Under Review';
                  const isRejecting  = rejectTarget === doc.id;

                  return (
                    <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="h-1 w-full" style={{ backgroundColor: statusColour }} />
                      <div className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="badge badge-sm text-white font-semibold" style={{ backgroundColor: statusColour }}>
                                {statusLabel}
                              </span>
                              <span className="badge badge-sm bg-gray-100 text-gray-600 border-0">
                                {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-700">{operatorName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Uploaded: {fmt(doc.uploaded_at)}
                              {doc.reviewed_at && ` · Reviewed: ${fmt(doc.reviewed_at)}`}
                            </p>
                            {doc.file_url && (
                              <button
                                onClick={() => viewDoc(doc.file_url)}
                                className="text-xs font-semibold mt-1 inline-flex items-center gap-1"
                                style={{ color: '#f97316' }}
                              >
                                View document →
                              </button>
                            )}
                            {doc.admin_notes && (
                              <p className="text-xs text-red-500 mt-1 bg-red-50 rounded-lg px-2.5 py-1.5">{doc.admin_notes}</p>
                            )}
                          </div>

                          {doc.status !== 'approved' && (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => approveDoc(doc.id)}
                                disabled={actionBusy === doc.id}
                                className="btn btn-sm rounded-xl font-semibold"
                                style={{ backgroundColor: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0' }}
                              >
                                {actionBusy === doc.id ? <span className="loading loading-spinner loading-xs" /> : 'Approve'}
                              </button>
                              <button
                                onClick={() => { setRejectTarget(doc.id); setRejectNotes(''); }}
                                disabled={actionBusy === doc.id}
                                className="btn btn-sm rounded-xl font-semibold"
                                style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>

                        {isRejecting && (
                          <div className="mt-4 flex flex-col gap-2">
                            <textarea
                              value={rejectNotes}
                              onChange={(e) => setRejectNotes(e.target.value)}
                              placeholder="Reason for rejection (shown to operator)…"
                              className="textarea textarea-bordered text-sm w-full rounded-xl"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => rejectDoc(doc.id)}
                                disabled={actionBusy === doc.id}
                                className="btn btn-sm rounded-xl font-semibold text-white"
                                style={{ backgroundColor: '#ef4444' }}
                              >
                                {actionBusy === doc.id ? <span className="loading loading-spinner loading-xs" /> : 'Confirm Reject'}
                              </button>
                              <button
                                onClick={() => setRejectTarget(null)}
                                className="btn btn-sm btn-ghost rounded-xl text-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
