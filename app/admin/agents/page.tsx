// app/admin/agents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { approveAgent, rejectAgent } from '@/actions/adminAgentActions';

type AgentRow = {
  id: string;
  business_name: string;
  contact_person: string | null;
  country: string;
  status: string;
  rejection_reason: string | null;
  license_number: string | null;
  registration_number: string | null;
  doc_license_url: string | null;
  doc_business_reg_url: string | null;
  doc_identity_url: string | null;
  doc_proof_address_url: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:          { bg: '#f3f4f6', color: '#6b7280' },
  pending_review: { bg: '#fff7ed', color: '#f97316' },
  approved:       { bg: '#f0fdf4', color: '#16a34a' },
  rejected:       { bg: '#fef2f2', color: '#ef4444' },
};

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id, business_name, contact_person, country, status, rejection_reason, license_number, registration_number, doc_license_url, doc_business_reg_url, doc_identity_url, doc_proof_address_url, created_at')
      .order('created_at', { ascending: false });
    setAgents((data ?? []) as AgentRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    setActionLoading(true);
    setActionError(null);
    const { error } = await approveAgent(id);
    if (error) { setActionError(error); } else { setSelected(null); await load(); }
    setActionLoading(false);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setActionError('Rejection reason is required.'); return; }
    setActionLoading(true);
    setActionError(null);
    const { error } = await rejectAgent(id, rejectReason.trim());
    if (error) { setActionError(error); } else { setSelected(null); setRejectReason(''); await load(); }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-extrabold text-gray-900">Agent Applications</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {agents.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No agent applications yet.</div>
            )}
            {agents.map((a) => {
              const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.draft;
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{a.business_name}</p>
                      <p className="text-xs text-gray-400">{a.contact_person ?? '—'} · {a.country} · {new Date(a.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ backgroundColor: style.bg, color: style.color }}>
                        {a.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => { setSelected(a); setRejectReason(''); setActionError(null); }}
                        className="btn btn-sm btn-ghost text-xs"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-extrabold text-gray-900">{selected.business_name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="flex flex-col gap-2 text-sm mb-4">
              <Row label="Country" value={selected.country} />
              <Row label="Contact" value={selected.contact_person ?? '—'} />
              <Row label="License No." value={selected.license_number ?? '—'} />
              <Row label="Reg. No." value={selected.registration_number ?? '—'} />
              <Row label="Status" value={selected.status} />
              {selected.rejection_reason && <Row label="Prev. Rejection" value={selected.rejection_reason} />}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Documents</p>
              {[
                { label: 'License', url: selected.doc_license_url },
                { label: 'Business Reg', url: selected.doc_business_reg_url },
                { label: 'Identity', url: selected.doc_identity_url },
                { label: 'Proof of Address', url: selected.doc_proof_address_url },
              ].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View</a> : <span className="text-gray-300 text-xs">Not uploaded</span>}
                </div>
              ))}
            </div>

            {actionError && <div className="alert alert-error text-sm mb-3">{actionError}</div>}

            {selected.status !== 'approved' && (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Rejection Reason (required to reject)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="textarea textarea-bordered w-full text-sm"
                    rows={2}
                    placeholder="Explain why the application is not approved..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={actionLoading}
                    className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(selected.id)}
                    disabled={actionLoading}
                    className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Reject'}
                  </button>
                </div>
              </>
            )}
            {selected.status === 'approved' && (
              <p className="text-center text-sm text-green-600 font-bold">This agent is already approved.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
