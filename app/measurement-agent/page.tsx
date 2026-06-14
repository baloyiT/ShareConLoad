'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type MeasurementAgentProfile = {
  id: string;
  profile_id: string;
  full_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  total_jobs_completed: number;
  average_rating: number | null;
  created_at: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeasurementAgentDashboard() {
  const router = useRouter();

  const [agentProfile, setAgentProfile] = useState<MeasurementAgentProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobCounts, setJobCounts] = useState({ assigned: 0, in_progress: 0, completed: 0 });

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?next=/measurement-agent');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'measurement_agent')
        .maybeSingle();

      if (profileError) {
        setError('Could not load your profile. Please try again.');
        setLoading(false);
        return;
      }

      if (!profile) {
        setAgentProfile(null);
        setLoading(false);
        return;
      }

      const { data: agentData, error: agentError } = await supabase
        .from('measurement_agent_profiles')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (agentError) {
        setError('Could not load your agent profile. Please try again.');
        setLoading(false);
        return;
      }

      setAgentProfile(agentData ?? null);

      if (agentData) {
        const { data: jobs } = await supabase
          .from('measurement_jobs')
          .select('status')
          .eq('measurement_agent_profile_id', agentData.id);

        const counts = { assigned: 0, in_progress: 0, completed: 0 };
        for (const job of jobs ?? []) {
          if (job.status === 'assigned') counts.assigned++;
          else if (job.status === 'in_progress') counts.in_progress++;
          else if (job.status === 'completed') counts.completed++;
        }
        setJobCounts(counts);
      }

      setLoading(false);
    }

    fetchProfile();
  }, [router]);

  function renderContent() {
    if (loading) {
      return (
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
        </div>
      );
    }

    if (error) {
      return <div className="alert alert-error text-sm max-w-lg">{error}</div>;
    }

    if (agentProfile === null || agentProfile === undefined) {
      return (
        <div className="alert max-w-lg" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#92400e' }}>
          <div>
            <p className="font-semibold">No application found.</p>
            <p className="text-sm mt-1">Please complete onboarding to get started.</p>
            <Link
              href="/onboarding/measurement-agent"
              className="btn btn-sm mt-3 text-white font-bold rounded-xl hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              Start Onboarding
            </Link>
          </div>
        </div>
      );
    }

    if (agentProfile.status === 'pending') {
      return (
        <div className="alert max-w-lg" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
          <div>
            <p className="font-semibold">Application Under Review</p>
            <p className="text-sm mt-1">Your application is under review. We&apos;ll notify you once approved.</p>
          </div>
        </div>
      );
    }

    if (agentProfile.status === 'rejected') {
      return (
        <div className="alert alert-error max-w-lg">
          <div>
            <p className="font-semibold">Application Not Approved</p>
            <p className="text-sm mt-1">Your application was not approved.</p>
            {agentProfile.rejection_reason && (
              <p className="text-sm mt-2 font-medium">Reason: {agentProfile.rejection_reason}</p>
            )}
          </div>
        </div>
      );
    }

    if (agentProfile.status === 'suspended') {
      return (
        <div className="alert alert-warning max-w-lg">
          <div>
            <p className="font-semibold">Account Suspended</p>
            <p className="text-sm mt-1">Your account has been suspended. Contact support.</p>
            <Link
              href="/support/new"
              className="btn btn-sm mt-3 font-bold rounded-xl hover:opacity-90"
            >
              Contact Support
            </Link>
          </div>
        </div>
      );
    }

    // Approved dashboard
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#0f2044' }}>
            Measurement Agent Portal
          </h1>
          <p className="text-gray-500 text-sm">
            Welcome, <span className="font-semibold text-gray-700">{agentProfile.full_name}</span>!
          </p>
        </div>

        <div className="stats stats-vertical sm:stats-horizontal bg-white shadow-sm border border-gray-100 rounded-2xl w-full">
          <div className="stat">
            <div className="stat-title text-xs text-gray-400">Jobs Completed</div>
            <div className="stat-value text-2xl font-extrabold" style={{ color: '#0f2044' }}>
              {agentProfile.total_jobs_completed}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-gray-400">Active Jobs</div>
            <div className="stat-value text-2xl font-extrabold" style={{ color: '#f97316' }}>
              {jobCounts.assigned + jobCounts.in_progress}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-gray-400">Average Rating</div>
            <div className="stat-value text-2xl font-extrabold" style={{ color: '#0f2044' }}>
              {agentProfile.average_rating != null ? agentProfile.average_rating.toFixed(1) : 'N/A'}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-gray-400">Awaiting Start</div>
            <div className="stat-value text-2xl font-extrabold" style={{ color: '#0f2044' }}>
              {jobCounts.assigned}
            </div>
          </div>
        </div>

        <Link
          href="/measurement-agent/jobs"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between hover:border-orange-200 hover:bg-orange-50 transition-colors group"
        >
          <div>
            <p className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors">My Jobs</p>
            <p className="text-sm text-gray-500 mt-0.5">View assigned and in-progress measurement jobs</p>
          </div>
          <div className="flex items-center gap-3">
            {(jobCounts.assigned + jobCounts.in_progress) > 0 && (
              <span className="badge text-white font-bold text-xs px-3 py-2" style={{ backgroundColor: '#f97316' }}>
                {jobCounts.assigned + jobCounts.in_progress} active
              </span>
            )}
            <span className="text-gray-300 group-hover:text-orange-400 text-xl transition-colors">→</span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="ShareConLoad" width={36} height={36} className="h-8 w-auto" />
            <span className="text-lg font-extrabold tracking-tight hidden sm:block">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="badge badge-sm font-semibold text-xs px-3 py-2" style={{ backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
              Measurement Agent
            </span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/auth/login');
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="w-full px-6 sm:px-10 py-8 max-w-6xl mx-auto">
        <h2 className="text-xl font-bold text-gray-700 mb-6">Agent Dashboard</h2>
        {renderContent()}
      </div>
    </div>
  );
}
