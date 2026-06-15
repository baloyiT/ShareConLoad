'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type PickupJob = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  created_at: string;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  assigned:  { bg: '#eff6ff', color: '#2563eb', label: 'Assigned'   },
  collected: { bg: '#f5f3ff', color: '#7c3aed', label: 'Collected'  },
  delivered: { bg: '#f0fdf4', color: '#16a34a', label: 'Delivered'  },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled'  },
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TransporterJobsPage() {
  const router = useRouter();
  const [jobs, setJobs]       = useState<PickupJob[]>([]);
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

      if (!profile || profile.role_type !== 'transporter') { router.push('/'); return; }

      const { data: tp } = await supabase
        .from('transporter_profiles')
        .select('id, status')
        .eq('profile_id', profile.id)
        .single();

      if (!tp || tp.status !== 'approved') { router.push('/transporter'); return; }

      const { data: jobData } = await supabase
        .from('pickup_jobs')
        .select('id, pickup_address, pickup_city, pickup_country, quoted_fee, status, created_at')
        .eq('transporter_profile_id', tp.id)
        .order('created_at', { ascending: false });

      setJobs((jobData ?? []) as PickupJob[]);
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/transporter" className="text-sm text-gray-400 hover:underline">← Dashboard</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-6">My Pickup Jobs</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No pickup jobs assigned yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE['assigned'];
              return (
                <Link
                  key={job.id}
                  href={`/transporter/jobs/${job.id}`}
                  className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <p className="font-bold text-gray-800">{job.pickup_city}, {job.pickup_country}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{job.pickup_address}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(job.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-sm font-bold" style={{ color: '#f97316' }}>{fmtMoney(job.quoted_fee)}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
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
