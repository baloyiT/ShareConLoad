'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type TransporterProfile = {
  id: string;
  profile_id: string;
  full_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  vehicle_type: string;
  vehicle_capacity_cbm: number;
  total_jobs_completed: number;
  average_rating: number | null;
  created_at: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransporterDashboard() {
  const router = useRouter();

  const [transporterProfile, setTransporterProfile] = useState<TransporterProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?next=/transporter');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'transporter')
        .maybeSingle();

      if (profileError) {
        setError('Could not load your profile. Please try again.');
        setLoading(false);
        return;
      }

      if (!profile) {
        setTransporterProfile(null);
        setLoading(false);
        return;
      }

      const { data: transporterData, error: transporterError } = await supabase
        .from('transporter_profiles')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (transporterError) {
        setError('Could not load your transporter profile. Please try again.');
        setLoading(false);
        return;
      }

      setTransporterProfile(transporterData ?? null);
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

    if (transporterProfile === null || transporterProfile === undefined) {
      return (
        <div className="alert max-w-lg" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#92400e' }}>
          <div>
            <p className="font-semibold">No application found.</p>
            <p className="text-sm mt-1">Please complete onboarding to get started.</p>
            <Link
              href="/onboarding/transporter"
              className="btn btn-sm mt-3 text-white font-bold rounded-xl hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              Start Onboarding
            </Link>
          </div>
        </div>
      );
    }

    if (transporterProfile.status === 'pending') {
      return (
        <div className="alert max-w-lg" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
          <div>
            <p className="font-semibold">Application Under Review</p>
            <p className="text-sm mt-1">Your application is under review. We&apos;ll notify you once approved.</p>
          </div>
        </div>
      );
    }

    if (transporterProfile.status === 'rejected') {
      return (
        <div className="alert alert-error max-w-lg">
          <div>
            <p className="font-semibold">Application Not Approved</p>
            <p className="text-sm mt-1">Your application was not approved.</p>
            {transporterProfile.rejection_reason && (
              <p className="text-sm mt-2 font-medium">Reason: {transporterProfile.rejection_reason}</p>
            )}
          </div>
        </div>
      );
    }

    if (transporterProfile.status === 'suspended') {
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
            Transporter Portal
          </h1>
          <p className="text-gray-500 text-sm">
            Welcome, <span className="font-semibold text-gray-700">{transporterProfile.full_name}</span>!
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Vehicle</p>
          <p className="text-gray-700 font-semibold text-sm">
            {transporterProfile.vehicle_type}
            <span className="mx-2 text-gray-300">|</span>
            Capacity: <span style={{ color: '#f97316' }}>{transporterProfile.vehicle_capacity_cbm} CBM</span>
          </p>
        </div>

        <div className="stats stats-vertical sm:stats-horizontal bg-white shadow-sm border border-gray-100 rounded-2xl w-full">
          <div className="stat">
            <div className="stat-title text-xs text-gray-400">Jobs Completed</div>
            <div className="stat-value text-2xl font-extrabold" style={{ color: '#0f2044' }}>
              {transporterProfile.total_jobs_completed}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-gray-400">Average Rating</div>
            <div className="stat-value text-2xl font-extrabold" style={{ color: '#f97316' }}>
              {transporterProfile.average_rating != null ? transporterProfile.average_rating.toFixed(1) : 'N/A'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="badge badge-outline text-xs font-semibold" style={{ color: '#6b7280', borderColor: '#e5e7eb' }}>
              Phase 3
            </span>
            <span className="text-xs text-gray-400 font-medium">Coming Soon</span>
          </div>
          <p className="text-gray-500 text-sm">
            Pickup &amp; delivery job assignments coming in Phase 3.
          </p>
        </div>
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
            <span className="badge badge-sm font-semibold text-xs px-3 py-2" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
              Transporter
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
        <h2 className="text-xl font-bold text-gray-700 mb-6">Transporter Dashboard</h2>
        {renderContent()}
      </div>
    </div>
  );
}
