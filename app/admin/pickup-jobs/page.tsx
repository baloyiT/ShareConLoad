'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type PickupJob = {
  id: string;
  booking_id: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  created_at: string;
  transporter_profiles: { full_name: string } | null;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending_selection: { bg: '#fff7ed', color: '#ff6a00', label: 'Pending Selection' },
  pending_payment:   { bg: '#fefce8', color: '#ca8a04', label: 'Pending Payment'   },
  paid:              { bg: '#fefce8', color: '#ca8a04', label: 'Paid'              },
  assigned:          { bg: '#eff6ff', color: '#2563eb', label: 'Assigned'          },
  collected:         { bg: '#f5f3ff', color: '#7c3aed', label: 'Collected'         },
  delivered:         { bg: '#f0fdf4', color: '#16a34a', label: 'Delivered'         },
  cancelled:         { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled'         },
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminPickupJobsPage() {
  const router = useRouter();
  const [jobs, setJobs]             = useState<PickupJob[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
      .from('pickup_jobs')
      .select('id, booking_id, pickup_city, pickup_country, quoted_fee, status, created_at, transporter_profiles(full_name)')
      .order('created_at', { ascending: false });
    setJobs((data ?? []) as unknown as PickupJob[]);
    setLoading(false);
  }

  async function handleCancel(jobId: string) {
    setActionLoading(true);
    setError(null);
    const { error: updateErr } = await supabase
      .from('pickup_jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId);
    if (updateErr) { setError(updateErr.message); } else { setCancellingId(null); await load(); }
    setActionLoading(false);
  }

  const canCancel = (status: string) => !['delivered', 'cancelled'].includes(status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Pickup Jobs</h1>
          </div>
          <span className="text-sm text-gray-400">{jobs.length} total</span>
        </div>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No pickup jobs yet.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="table w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th>Job ID</th><th>Location</th><th>Transporter</th><th>Fee</th><th>Status</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE['pending_selection'];
                  const isCancelling = cancellingId === job.id;
                  return (
                    <Fragment key={job.id}>
                      <tr className="hover:bg-gray-50 align-top">
                        <td className="font-mono text-xs text-gray-500">{job.id.slice(0, 8).toUpperCase()}</td>
                        <td className="text-sm text-gray-700">{job.pickup_city}, {job.pickup_country}</td>
                        <td className="text-sm text-gray-600">{job.transporter_profiles?.full_name ?? <span className="text-gray-400 italic">Unassigned</span>}</td>
                        <td className="text-sm font-semibold text-gray-800">{fmtMoney(job.quoted_fee)}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-sm text-gray-500">{fmt(job.created_at)}</td>
                        <td>
                          {canCancel(job.status) && (
                            <button
                              onClick={() => { setCancellingId(isCancelling ? null : job.id); setError(null); }}
                              className="btn btn-xs font-bold"
                              style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                            >
                              {isCancelling ? 'Close' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isCancelling && (
                        <tr className="bg-red-50">
                          <td colSpan={7} className="py-3 px-4">
                            <div className="flex gap-2 items-center">
                              <span className="text-sm text-gray-600">Cancel this job?</span>
                              <button onClick={() => handleCancel(job.id)} disabled={actionLoading}
                                className="btn btn-sm text-white font-bold disabled:opacity-60"
                                style={{ backgroundColor: '#ef4444' }}>
                                {actionLoading ? <span className="loading loading-spinner loading-xs" /> : 'Confirm Cancel'}
                              </button>
                              <button onClick={() => setCancellingId(null)} className="btn btn-sm btn-ghost text-gray-400">Back</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
