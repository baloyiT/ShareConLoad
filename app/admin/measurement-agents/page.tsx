// app/admin/measurement-agents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { approveMeasurementAgent, rejectMeasurementAgent } from '@/actions/adminMeasurementAgentActions';

type MeasurementAgentRow = {
  id: string;
  full_name: string;
  base_city: string;
  base_country: string;
  status: string;
  certification_test_passed: boolean;
  total_jobs_completed: number;
  rejection_reason: string | null;
  created_at: string;
  profiles: { user_id: string } | null;
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#fff7ed', color: '#f97316', label: 'Pending'   },
  approved:  { bg: '#f0fdf4', color: '#16a34a', label: 'Approved'  },
  rejected:  { bg: '#fef2f2', color: '#ef4444', label: 'Rejected'  },
  suspended: { bg: '#f3f4f6', color: '#6b7280', label: 'Suspended' },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminMeasurementAgentsPage() {
  const router = useRouter();
  const [rows, setRows]           = useState<MeasurementAgentRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<FilterStatus>('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.push('/'); return; }
      await load();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('measurement_agent_profiles')
      .select('*, profiles!inner(user_id)')
      .order('created_at', { ascending: false });
    setRows((data ?? []) as MeasurementAgentRow[]);
    setLoading(false);
  }

  async function handleApprove(id: string) {
    setActionLoading(true);
    setActionError(null);
    const { error } = await approveMeasurementAgent(id);
    if (error) {
      setActionError(error);
    } else {
      router.refresh();
      await load();
    }
    setActionLoading(false);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setActionError('Rejection reason is required.'); return; }
    setActionLoading(true);
    setActionError(null);
    const { error } = await rejectMeasurementAgent(id, rejectReason.trim());
    if (error) {
      setActionError(error);
    } else {
      setRejectingId(null);
      setRejectReason('');
      router.refresh();
      await load();
    }
    setActionLoading(false);
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all',       label: 'All'       },
    { key: 'pending',   label: 'Pending'   },
    { key: 'approved',  label: 'Approved'  },
    { key: 'rejected',  label: 'Rejected'  },
    { key: 'suspended', label: 'Suspended' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Measurement Agents</h1>
          </div>
          <span className="text-sm text-gray-400">{rows.length} total</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`btn btn-sm rounded-full ${filter === key ? 'btn-neutral' : 'btn-ghost'}`}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-1 text-xs opacity-70">
                  ({rows.filter((r) => r.status === key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="alert alert-error text-sm mb-4">{actionError}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No measurement agents found.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="table w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th>Name</th>
                  <th>Base City / Country</th>
                  <th>Status</th>
                  <th>Certified</th>
                  <th>Jobs</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE['pending'];
                  const isRejectOpen = rejectingId === row.id;

                  return (
                    <>
                      <tr key={row.id} className="hover:bg-gray-50 align-top">
                        <td className="font-semibold text-sm text-gray-800">{row.full_name}</td>
                        <td className="text-sm text-gray-600">{row.base_city}, {row.base_country}</td>
                        <td>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-sm text-center">
                          {row.certification_test_passed ? (
                            <span className="text-green-600 font-bold">&#10003;</span>
                          ) : (
                            <span className="text-red-400 font-bold">&#10007;</span>
                          )}
                        </td>
                        <td className="text-sm text-gray-600 text-center">{row.total_jobs_completed}</td>
                        <td className="text-sm text-gray-500">{fmt(row.created_at)}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {(row.status === 'pending' || row.status === 'rejected') && (
                              <button
                                onClick={() => handleApprove(row.id)}
                                disabled={actionLoading}
                                className="btn btn-xs text-white font-bold disabled:opacity-60"
                                style={{ backgroundColor: '#16a34a' }}
                              >
                                Approve
                              </button>
                            )}
                            {(row.status === 'pending' || row.status === 'approved') && (
                              <button
                                onClick={() => {
                                  setRejectingId(isRejectOpen ? null : row.id);
                                  setRejectReason('');
                                  setActionError(null);
                                }}
                                disabled={actionLoading}
                                className="btn btn-xs font-bold disabled:opacity-60"
                                style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline reject form */}
                      {isRejectOpen && (
                        <tr key={`${row.id}-reject`} className="bg-red-50">
                          <td colSpan={7} className="py-3 px-4">
                            <div className="flex gap-2 items-start">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection (required)"
                                className="input input-bordered input-sm flex-1 text-sm"
                              />
                              <button
                                onClick={() => handleReject(row.id)}
                                disabled={actionLoading}
                                className="btn btn-sm text-white font-bold disabled:opacity-60"
                                style={{ backgroundColor: '#ef4444' }}
                              >
                                {actionLoading ? <span className="loading loading-spinner loading-xs" /> : 'Confirm'}
                              </button>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReason(''); setActionError(null); }}
                                className="btn btn-sm btn-ghost text-gray-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
