// app/admin/measurement-jobs/page.tsx
'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { assignMeasurementAgent } from '@/actions/adminMeasurementJobActions';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
  measurement_agent_profile_id: string | null;
};

type Agent = {
  id: string;
  full_name: string;
  base_city: string;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending_payment: { bg: '#fff7ed', color: '#ff6a00', label: 'Pending Payment'    },
  paid:            { bg: '#fefce8', color: '#ca8a04', label: 'Paid — Needs Agent' },
  assigned:        { bg: '#eff6ff', color: '#2563eb', label: 'Assigned'           },
  in_progress:     { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress'        },
  completed:       { bg: '#f0fdf4', color: '#16a34a', label: 'Completed'          },
  cancelled:       { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled'          },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

export default function AdminMeasurementJobsPage() {
  const router = useRouter();
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [loading, setLoading]         = useState(true);
  const [agents, setAgents]           = useState<Agent[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.push('/'); return; }
      await Promise.all([load(), loadAgents()]);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('measurement_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }

  async function loadAgents() {
    const { data } = await supabase
      .from('measurement_agent_profiles')
      .select('id, full_name, base_city')
      .eq('status', 'approved');
    setAgents((data ?? []) as Agent[]);
  }

  async function handleAssign(jobId: string) {
    const agentId = selectedAgent[jobId];
    if (!agentId) { setError('Please select an agent.'); return; }
    setActionLoading(true);
    setError(null);
    const { error: assignError } = await assignMeasurementAgent(jobId, agentId);
    if (assignError) {
      setError(assignError);
    } else {
      setAssigningId(null);
      await load();
    }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Measurement Jobs</h1>
          </div>
          <span className="text-sm text-gray-400">{jobs.length} total</span>
        </div>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No measurement jobs yet.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="table w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th>Job ID</th>
                  <th>Pickup Location</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE['pending_payment'];
                  const cityAgents = agents.filter((a) =>
                    a.base_city.toLowerCase() === job.pickup_city.toLowerCase()
                  );
                  const isAssigning = assigningId === job.id;

                  return (
                    <Fragment key={job.id}>
                      <tr className="hover:bg-gray-50 align-top">
                        <td className="font-mono text-xs text-gray-500">{job.id.slice(0, 8).toUpperCase()}</td>
                        <td className="text-sm text-gray-700">
                          <div>{job.pickup_city}, {job.pickup_country}</div>
                          <div className="text-xs text-gray-400">{job.pickup_address}</div>
                        </td>
                        <td className="text-sm font-semibold text-gray-800">{fmtMoney(job.quoted_fee)}</td>
                        <td>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-sm text-gray-500">{fmt(job.created_at)}</td>
                        <td>
                          {job.status === 'paid' && (
                            <button
                              onClick={() => { setAssigningId(isAssigning ? null : job.id); setError(null); }}
                              className="btn btn-xs text-white font-bold"
                              style={{ backgroundColor: '#ff6a00' }}
                            >
                              {isAssigning ? 'Cancel' : 'Assign Agent'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {isAssigning && (
                        <tr className="bg-orange-50">
                          <td colSpan={6} className="py-3 px-4">
                            {cityAgents.length === 0 ? (
                              <p className="text-sm text-gray-500">No approved agents in {job.pickup_city}.</p>
                            ) : (
                              <div className="flex gap-2 items-center flex-wrap">
                                <select
                                  value={selectedAgent[job.id] ?? ''}
                                  onChange={(e) =>
                                    setSelectedAgent((prev) => ({ ...prev, [job.id]: e.target.value }))
                                  }
                                  className="select select-bordered select-sm"
                                >
                                  <option value="">Select agent…</option>
                                  {cityAgents.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.full_name} ({a.base_city})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssign(job.id)}
                                  disabled={actionLoading}
                                  className="btn btn-sm text-white font-bold disabled:opacity-60"
                                  style={{ backgroundColor: '#16a34a' }}
                                >
                                  {actionLoading
                                    ? <span className="loading loading-spinner loading-xs" />
                                    : 'Confirm Assignment'}
                                </button>
                              </div>
                            )}
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
