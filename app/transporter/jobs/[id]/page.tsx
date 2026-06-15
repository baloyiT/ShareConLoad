'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Job = {
  id: string;
  booking_id: string;
  shipper_profile_id: string;
  transporter_profile_id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  warehouse_address: string;
  total_cbm: number | null;
  total_weight_kg: number | null;
  quoted_fee: number;
  status: string;
  collected_at: string | null;
  delivered_at: string | null;
  payout_released_at: string | null;
};

const STATUS_STEPS = ['assigned', 'collected', 'delivered'] as const;
const STATUS_LABELS: Record<string, string> = {
  assigned:  'Assigned',
  collected: 'Collected',
  delivered: 'Delivered',
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

export default function TransporterJobDetailPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob]               = useState<Job | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [transporterProfileId, setTransporterProfileId] = useState<string | null>(null);

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
      setTransporterProfileId(tp.id);

      const { data: jobData } = await supabase
        .from('pickup_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('transporter_profile_id', tp.id)
        .single();

      if (!jobData) { router.push('/transporter/jobs'); return; }
      setJob(jobData as Job);
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleConfirmCollection() {
    if (!job) return;
    setActionLoading(true);
    setError(null);
    const { error: updateErr } = await supabase
      .from('pickup_jobs')
      .update({ status: 'collected', collected_at: new Date().toISOString() })
      .eq('id', job.id);

    if (updateErr) { setError(updateErr.message); setActionLoading(false); return; }

    // Notify shipper
    const { data: shipperProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', job.shipper_profile_id)
      .single();
    if (shipperProfile) {
      await supabase.from('notifications').insert({
        user_id: shipperProfile.user_id,
        type: 'pickup_collected',
        title: 'Your cargo has been collected',
        body: 'Your pickup has been collected and is on its way to the warehouse.',
        metadata: { job_id: job.id },
      });
    }

    setJob({ ...job, status: 'collected', collected_at: new Date().toISOString() });
    setActionLoading(false);
  }

  async function handleConfirmDelivery() {
    if (!job) return;
    setActionLoading(true);
    setError(null);

    const { error: updateErr } = await supabase
      .from('pickup_jobs')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', job.id);

    if (updateErr) { setError(updateErr.message); setActionLoading(false); return; }

    // Notify operator via booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('operator_id')
      .eq('id', job.booking_id)
      .single();

    if (booking?.operator_id) {
      // operator_id is operator_profiles.id — resolve to user_id
      const { data: opProfile } = await supabase
        .from('operator_profiles')
        .select('profile_id')
        .eq('id', booking.operator_id)
        .single();
      if (opProfile) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', opProfile.profile_id)
          .single();
        if (profile) {
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'pickup_delivered',
            title: 'Cargo delivered to warehouse',
            body: 'A pickup has been completed and the cargo has arrived at the warehouse.',
            metadata: { job_id: job.id, booking_id: job.booking_id },
          });
        }
      }
    }

    // Trigger payout (best-effort, non-blocking)
    const { data: { session } } = await supabase.auth.getSession();
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trigger-transporter-payout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      }
    ).catch((err) => console.error('Payout trigger failed (non-blocking):', err));

    setJob({ ...job, status: 'delivered', delivered_at: new Date().toISOString() });
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }
  if (!job) return null;

  const stepIndex = STATUS_STEPS.indexOf(job.status as typeof STATUS_STEPS[number]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/transporter/jobs" className="text-sm text-gray-400 hover:underline">← My Jobs</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-6">Pickup Job</h1>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Progress</p>
          <div className="flex items-start justify-between">
            {STATUS_STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div className={`w-4 h-4 rounded-full border-2 ${i <= stepIndex ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`} />
                <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight px-1">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Job details */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Job Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Pickup Address</span><span className="font-medium text-gray-800 text-right max-w-48">{job.pickup_address}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Pickup City</span><span className="font-medium">{job.pickup_city}, {job.pickup_country}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Warehouse</span><span className="font-medium text-gray-800 text-right max-w-48">{job.warehouse_address}</span></div>
            {job.total_cbm && <div className="flex justify-between"><span className="text-gray-500">Cargo CBM</span><span className="font-medium">{job.total_cbm} m³</span></div>}
            {job.total_weight_kg && <div className="flex justify-between"><span className="text-gray-500">Weight</span><span className="font-medium">{job.total_weight_kg} kg</span></div>}
            <div className="flex justify-between text-base font-bold pt-2 border-t mt-2">
              <span>Your Fee (85%)</span>
              <span style={{ color: '#f97316' }}>{fmtMoney(job.quoted_fee * 0.85)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {job.status === 'assigned' && (
          <button
            onClick={handleConfirmCollection}
            disabled={actionLoading}
            className="btn w-full text-white font-bold rounded-xl text-base disabled:opacity-60"
            style={{ backgroundColor: '#7c3aed' }}
          >
            {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Confirm Collection'}
          </button>
        )}

        {job.status === 'collected' && (
          <button
            onClick={handleConfirmDelivery}
            disabled={actionLoading}
            className="btn w-full text-white font-bold rounded-xl text-base disabled:opacity-60"
            style={{ backgroundColor: '#16a34a' }}
          >
            {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Confirm Delivery at Warehouse'}
          </button>
        )}

        {job.status === 'delivered' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl mb-3">&#x2705;</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Delivery Complete</h2>
            <p className="text-sm text-gray-500">Your payout of {fmtMoney(job.quoted_fee * 0.85)} has been triggered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
