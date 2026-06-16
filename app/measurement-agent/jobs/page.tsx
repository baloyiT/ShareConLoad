'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

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
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  assigned:    { bg: '#eff6ff', color: '#2563eb', label: 'Assigned'    },
  in_progress: { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress' },
  completed:   { bg: '#f0fdf4', color: '#16a34a', label: 'Completed'   },
  cancelled:   { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled'   },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AgentJobsPage() {
  const router = useRouter();
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role_type')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role_type !== 'measurement_agent') {
        router.push('/');
        return;
      }

      const { data: agentProfile } = await supabase
        .from('measurement_agent_profiles')
        .select('id, status')
        .eq('profile_id', profile.id)
        .single();

      if (!agentProfile || agentProfile.status !== 'approved') {
        router.push('/measurement-agent');
        return;
      }

      const { data: jobData } = await supabase
        .from('measurement_jobs')
        .select('*')
        .eq('measurement_agent_profile_id', agentProfile.id)
        .order('created_at', { ascending: false });

      setJobs((jobData ?? []) as Job[]);
      setLoading(false);
    }
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/measurement-agent" className="text-sm text-gray-400 hover:underline">← Dashboard</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">My Jobs</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No jobs assigned yet.</div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE['assigned'];
              return (
                <Link key={job.id} href={`/measurement-agent/jobs/${job.id}`}
                  className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{job.pickup_city}, {job.pickup_country}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{job.pickup_address}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={{ backgroundColor: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span>Assigned {job.assigned_at ? fmt(job.assigned_at) : '—'}</span>
                    {job.completed_at && <span>Completed {fmt(job.completed_at)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
