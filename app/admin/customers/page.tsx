'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { approveCustomerKyc, rejectCustomerKyc } from '@/actions/adminCustomerActions';

async function getSignedUrl(storedUrl: string | null, bucket: string): Promise<string | null> {
  if (!storedUrl) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx < 0) return null;
  const path = decodeURIComponent(storedUrl.slice(idx + marker.length));
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

type KycRow = {
  id: string;
  profile_id: string;
  full_name: string;
  id_type: string;
  id_number: string;
  phone_number: string | null;
  residential_address: string | null;
  id_document_url: string | null;
  proof_of_address_url: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: '#fff7ed', color: '#f97316', label: 'Pending Review' },
  verified:       { bg: '#f0fdf4', color: '#16a34a', label: 'Verified'       },
  rejected:       { bg: '#fef2f2', color: '#ef4444', label: 'Rejected'       },
};

const ID_TYPE_LABELS: Record<string, string> = {
  national_id:      'National ID',
  passport:         'Passport',
  drivers_license:  "Driver's Licence",
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminCustomersPage() {
  const [records, setRecords]       = useState<KycRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<KycRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState<string | null>(null);
  const [signedIdDocUrl, setSignedIdDocUrl]       = useState<string | null>(null);
  const [signedProofUrl, setSignedProofUrl]       = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('customer_kyc')
      .select('id, profile_id, full_name, id_type, id_number, phone_number, residential_address, id_document_url, proof_of_address_url, status, rejection_reason, submitted_at, reviewed_at')
      .order('submitted_at', { ascending: false });
    setRecords((data ?? []) as KycRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    setActionLoading(true);
    setActionError(null);
    const { error } = await approveCustomerKyc(id);
    if (error) { setActionError(error); } else { setSelected(null); setSignedIdDocUrl(null); setSignedProofUrl(null); await load(); }
    setActionLoading(false);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setActionError('Rejection reason is required.'); return; }
    setActionLoading(true);
    setActionError(null);
    const { error } = await rejectCustomerKyc(id, rejectReason.trim());
    if (error) { setActionError(error); } else { setSelected(null); setSignedIdDocUrl(null); setSignedProofUrl(null); setRejectReason(''); await load(); }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Customer KYC</h1>
          </div>
          <span className="text-sm text-gray-400">{records.length} total</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No KYC submissions yet.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="table w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th>Name</th>
                  <th>ID Type</th>
                  <th>ID Number</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const s = STATUS_STYLES[r.status] ?? STATUS_STYLES['pending_review'];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="font-semibold text-sm text-gray-800">{r.full_name}</td>
                      <td className="text-sm text-gray-600">{ID_TYPE_LABELS[r.id_type] ?? r.id_type}</td>
                      <td className="text-sm text-gray-600 font-mono">{r.id_number}</td>
                      <td className="text-sm text-gray-500">{fmt(r.submitted_at)}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={async () => {
                            setSelected(r);
                            setRejectReason('');
                            setActionError(null);
                            setSignedIdDocUrl(null);
                            setSignedProofUrl(null);
                            const [idUrl, proofUrl] = await Promise.all([
                              getSignedUrl(r.id_document_url, 'customer-kyc'),
                              getSignedUrl(r.proof_of_address_url, 'customer-kyc'),
                            ]);
                            setSignedIdDocUrl(idUrl);
                            setSignedProofUrl(proofUrl);
                          }}
                          className="btn btn-xs btn-ghost text-blue-600"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => { setSelected(null); setSignedIdDocUrl(null); setSignedProofUrl(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-gray-800 mb-4">KYC Review — {selected.full_name}</h2>

            <div className="space-y-2 text-sm mb-5">
              {[
                ['ID Type',    ID_TYPE_LABELS[selected.id_type] ?? selected.id_type],
                ['ID Number',  selected.id_number],
                ['Phone',      selected.phone_number ?? '—'],
                ['Address',    selected.residential_address ?? '—'],
                ['Submitted',  fmt(selected.submitted_at)],
                ['Status',     STATUS_STYLES[selected.status]?.label ?? selected.status],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-gray-400 w-24 shrink-0">{label}</span>
                  <span className="text-gray-800 font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Document links */}
            <div className="mb-5 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Documents</p>
              {selected.id_document_url ? (
                signedIdDocUrl ? (
                  <a href={signedIdDocUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    📄 Identity Document
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Loading document link…</p>
                )
              ) : (
                <p className="text-sm text-gray-400">No identity document uploaded.</p>
              )}
              {selected.proof_of_address_url && (
                signedProofUrl ? (
                  <a href={signedProofUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    📄 Proof of Address
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Loading document link…</p>
                )
              )}
            </div>

            {/* Previous rejection reason */}
            {selected.status === 'rejected' && selected.rejection_reason && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <p className="font-semibold mb-1">Previous rejection reason:</p>
                <p>{selected.rejection_reason}</p>
              </div>
            )}

            {actionError && (
              <div className="mb-4 text-sm text-red-600">{actionError}</div>
            )}

            {selected.status !== 'verified' && (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Rejection Reason <span className="text-gray-400 font-normal">(required to reject)</span>
                  </label>
                  <textarea
                    rows={2}
                    className="textarea textarea-bordered w-full text-sm resize-none"
                    placeholder="e.g. ID document is blurry or expired"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={actionLoading}
                    className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    {actionLoading ? <span className="loading loading-spinner loading-sm" /> : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(selected.id)}
                    disabled={actionLoading}
                    className="btn flex-1 font-bold rounded-xl disabled:opacity-60"
                    style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </>
            )}

            {selected.status === 'verified' && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                This customer is verified. Reviewed on {selected.reviewed_at ? fmt(selected.reviewed_at) : '—'}.
              </div>
            )}

            <button onClick={() => { setSelected(null); setSignedIdDocUrl(null); setSignedProofUrl(null); }} className="btn btn-ghost w-full mt-3 rounded-xl text-gray-400">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
