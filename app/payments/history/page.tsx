'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

type PaymentRow = {
  id: string;
  stage: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  booking: {
    id: string;
    containers: { origin_city: string; destination_city: string } | null;
  } | null;
};

const STAGE_LABELS: Record<string, string> = {
  deposit_20:       '20% Deposit',
  pre_departure_50: '50% Pre-Departure',
  final_release_30: '30% Final Release',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: '#fffbeb' },
  paid:     { label: 'Paid',     color: '#22c55e', bg: '#f0fdf4' },
  refunded: { label: 'Refunded', color: '#6b7280', bg: '#f9fafb' },
  failed:   { label: 'Failed',   color: '#ef4444', bg: '#fef2f2' },
};

type StatusFilter = 'all' | 'pending' | 'paid' | 'refunded';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PaymentHistoryPage() {
  const router = useRouter();

  const [payments,     setPayments]     = useState<PaymentRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/payments/history'); return; }

      const { data, error: err } = await supabase
        .from('payments')
        .select(`
          id, stage, amount, status, due_date, paid_at, created_at,
          booking:bookings!payments_booking_id_fkey(id, containers(origin_city, destination_city))
        `)
        .in('booking_id',
          (await supabase.from('bookings').select('id').eq('customer_id', user.id)).data?.map((b) => b.id) ?? []
        )
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); }
      else { setPayments((data ?? []) as unknown as PaymentRow[]); }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = statusFilter === 'all'
    ? payments
    : payments.filter((p) => p.status === statusFilter);

  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0b103a' }}>Share</span><span style={{ color: '#ff6a00' }}>Con</span><span style={{ color: '#0b103a' }}>Load</span>
            </span>
          </Link>
          <Link href="/bookings" className="text-sm text-gray-500 hover:text-gray-800">← My Bookings</Link>
        </div>
      </nav>

      <PageHero
        gradient
        label="Customer Portal"
        title="Payment History"
        rightSlot={!loading ? (
          <div className="text-right">
            <p className="text-gray-400 text-xs">Total paid</p>
            <p className="text-2xl font-extrabold text-white">R{totalPaid.toFixed(2)}</p>
          </div>
        ) : undefined}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {(['all', 'pending', 'paid', 'refunded'] as StatusFilter[]).map((s) => {
            const count  = s === 'all' ? payments.length : payments.filter((p) => p.status === s).length;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors"
                style={active
                  ? { backgroundColor: '#0b103a', color: '#fff', borderColor: '#0b103a' }
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
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center">
            <p className="text-gray-400 text-sm">No payment records found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((p) => {
              const route  = p.booking?.containers
                ? `${p.booking.containers.origin_city} → ${p.booking.containers.destination_city}`
                : 'Route unavailable';
              const stCfg  = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-800">{STAGE_LABELS[p.stage] ?? p.stage}</span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: stCfg.bg, color: stCfg.color }}
                      >
                        {stCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{route}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {p.due_date && p.status === 'pending' && <span>Due {fmt(p.due_date)}</span>}
                      {p.paid_at && <span>Paid {fmt(p.paid_at)}</span>}
                      <span>Created {fmt(p.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xl font-extrabold" style={{ color: p.status === 'paid' ? '#22c55e' : '#111827' }}>
                      R{p.amount.toFixed(2)}
                    </span>
                    {p.booking && (
                      <Link
                        href={`/payments/${p.booking.id}`}
                        className="btn btn-ghost btn-sm rounded-lg text-xs text-gray-400 hover:text-gray-700"
                      >
                        {p.status === 'pending' ? 'Pay →' : 'View →'}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
