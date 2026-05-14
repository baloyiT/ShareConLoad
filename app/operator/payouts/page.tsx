'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Payout = {
  id: string;
  stage: string;
  gross_amount: number;
  commission_rate: number | null;
  commission_amount: number;
  net_amount: number;
  status: string;
  paystack_transfer_code: string | null;
  failure_reason: string | null;
  completed_at: string | null;
  created_at: string;
  booking: { id: string; containers: { origin_city: string; destination_city: string } | null } | null;
};

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

const STAGE_LABELS: Record<string, string> = {
  deposit_20:       '20% Deposit',
  pre_departure_50: '50% Pre-Departure',
  final_release_30: '30% Final Release',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: '#f59e0b', bg: '#fffbeb' },
  processing: { label: 'Processing', color: '#3b82f6', bg: '#eff6ff' },
  completed:  { label: 'Completed',  color: '#22c55e', bg: '#f0fdf4' },
  failed:     { label: 'Failed',     color: '#ef4444', bg: '#fef2f2' },
  on_hold:    { label: 'On Hold',    color: '#f97316', bg: '#fff7ed' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OperatorPayoutsPage() {
  const router = useRouter();

  const [payouts,      setPayouts]      = useState<Payout[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/payouts'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .single();

      if (!profile) { setError('Operator profile not found.'); setLoading(false); return; }

      const { data, error: err } = await supabase
        .from('payouts')
        .select(`
          id, stage, gross_amount, commission_rate, commission_amount, net_amount, status,
          paystack_transfer_code, failure_reason, completed_at, created_at,
          booking:bookings!payouts_booking_id_fkey(id, containers(origin_city, destination_city))
        `)
        .eq('operator_id', profile.id)
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); }
      else { setPayouts((data ?? []) as unknown as Payout[]); }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = statusFilter === 'all' ? payouts : payouts.filter((p) => p.status === statusFilter);
  const totalCompleted = payouts.filter((p) => p.status === 'completed').reduce((s, p) => s + (p.net_amount ?? 0), 0);
  const totalPending   = payouts.filter((p) => ['pending', 'processing'].includes(p.status)).reduce((s, p) => s + (p.gross_amount ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Payout History</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your earnings from completed booking stages.</p>
      </div>

      {/* Summary cards */}
      {!loading && payouts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Received</p>
            <p className="text-xl font-extrabold text-green-600">R{totalCompleted.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending</p>
            <p className="text-xl font-extrabold" style={{ color: '#f97316' }}>R{totalPending.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Payouts</p>
            <p className="text-xl font-extrabold text-gray-800">{payouts.length}</p>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'pending', 'processing', 'completed', 'failed'] as StatusFilter[]).map((s) => {
          const count  = s === 'all' ? payouts.length : payouts.filter((p) => p.status === s).length;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors"
              style={active
                ? { backgroundColor: '#0f2044', color: '#fff', borderColor: '#0f2044' }
                : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={active ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' } : { backgroundColor: '#f3f4f6', color: '#374151' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center">
          <p className="text-gray-400 text-sm">
            {payouts.length === 0 ? 'No payouts yet. Payouts are generated automatically when customer payments are confirmed.' : `No ${statusFilter} payouts.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => {
            const route = p.booking?.containers
              ? `${p.booking.containers.origin_city} → ${p.booking.containers.destination_city}`
              : 'Route unavailable';
            const stCfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{STAGE_LABELS[p.stage] ?? p.stage}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        {stCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{route}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-extrabold" style={{ color: p.status === 'completed' ? '#22c55e' : '#111827' }}>
                      R{(p.net_amount ?? p.gross_amount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">net</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 border-t border-gray-100 pt-3">
                  <span>Gross R{(p.gross_amount ?? 0).toFixed(2)}</span>
                  <span>
                    Commission R{(p.commission_amount ?? 0).toFixed(2)}
                    {p.commission_rate != null && (
                      <span
                        className="ml-1 px-1.5 py-0.5 rounded-full font-bold text-[10px]"
                        style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
                      >
                        {(p.commission_rate * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                  {p.completed_at && <span>Paid {fmt(p.completed_at)}</span>}
                  {!p.completed_at && <span>Created {fmt(p.created_at)}</span>}
                  {p.paystack_transfer_code && (
                    <span className="font-mono">{p.paystack_transfer_code}</span>
                  )}
                  {p.failure_reason && (
                    <span className="text-red-400">{p.failure_reason}</span>
                  )}
                </div>

                {p.booking && (
                  <div className="mt-2 pt-2">
                    <Link
                      href={`/payments/${p.booking.id}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View booking →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
