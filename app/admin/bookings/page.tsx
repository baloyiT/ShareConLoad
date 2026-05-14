'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

type AdminBooking = {
  id: string;
  customer_id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  containers: { origin_city: string; destination_city: string } | null;
};

type Payment = {
  id: string;
  stage: string;
  amount: number;
  status: string;
  paystack_reference: string | null;
  due_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
};

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';
type ModalTab = 'status' | 'payments';

const STATUS_COLOURS: Record<string, string> = {
  pending:    '#f59e0b',
  confirmed:  '#3b82f6',
  loaded:     '#8b5cf6',
  in_transit: '#06b6d4',
  delivered:  '#22c55e',
  cancelled:  '#6b7280',
};

const PAYMENT_COLOURS: Record<string, string> = {
  pending:  '#f59e0b',
  paid:     '#22c55e',
  refunded: '#8b5cf6',
  failed:   '#ef4444',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['loaded', 'cancelled'],
  loaded:     ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  [],
};

const STAGE_LABELS: Record<string, string> = {
  deposit_20:        'Stage 1 — Deposit (20%)',
  pre_departure_50:  'Stage 2 — Pre-departure (50%)',
  final_release_30:  'Stage 3 — Final release (30%)',
};

const STATUS_TABS: StatusFilter[] = ['all', 'pending', 'confirmed', 'loaded', 'in_transit', 'delivered', 'cancelled'];

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ZAR(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminBookingsPage() {
  const [bookings,       setBookings]       = useState<AdminBooking[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');

  // Modal state
  const [selected,       setSelected]       = useState<AdminBooking | null>(null);
  const [modalTab,       setModalTab]       = useState<ModalTab>('status');

  // Status tab
  const [newStatus,      setNewStatus]      = useState('');
  const [notes,          setNotes]          = useState('');
  const [updating,       setUpdating]       = useState(false);
  const [updateError,    setUpdateError]    = useState<string | null>(null);

  // Payments tab
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [loadingPayments,setLoadingPayments]= useState(false);
  const [refunding,      setRefunding]      = useState<string | null>(null);
  const [refundError,    setRefundError]    = useState<Record<string, string>>({});
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookings() {
      const { data, error: err } = await supabase
        .from('bookings')
        .select(`
          id, customer_id, total_cbm, total_price, status, created_at,
          containers(origin_city, destination_city)
        `)
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); }
      else { setBookings((data ?? []) as unknown as AdminBooking[]); }
      setLoading(false);
    }

    async function fetchAdminProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) setAdminProfileId(profile.id);
    }

    fetchBookings();
    fetchAdminProfile();
  }, []);

  const filtered = statusFilter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === statusFilter);

  function openModal(b: AdminBooking, tab: ModalTab = 'status') {
    setSelected(b);
    setModalTab(tab);
    setNewStatus(b.status);
    setNotes('');
    setUpdateError(null);
    setPayments([]);
    setRefundError({});
    if (tab === 'payments') loadPayments(b.id);
  }

  async function loadPayments(bookingId: string) {
    setLoadingPayments(true);
    const { data } = await supabase
      .from('payments')
      .select('id, stage, amount, status, paystack_reference, due_at, paid_at, refunded_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });
    setPayments((data ?? []) as Payment[]);
    setLoadingPayments(false);
  }

  function switchTab(tab: ModalTab) {
    setModalTab(tab);
    if (tab === 'payments' && selected && payments.length === 0) {
      loadPayments(selected.id);
    }
  }

  async function applyStatusChange() {
    if (!selected || newStatus === selected.status) { setSelected(null); return; }
    setUpdating(true);
    setUpdateError(null);

    const { error: bErr } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', selected.id);

    if (bErr) { setUpdateError(bErr.message); setUpdating(false); return; }

    await supabase.from('booking_status_history').insert({
      booking_id: selected.id,
      status:     newStatus,
      notes:      notes.trim() || null,
    });

    setBookings((prev) =>
      prev.map((b) => b.id === selected.id ? { ...b, status: newStatus } : b),
    );
    setSelected(null);
    setUpdating(false);
  }

  async function handleRefund(paymentId: string) {
    setRefunding(paymentId);
    setRefundError((prev) => { const n = { ...prev }; delete n[paymentId]; return n; });

    const { data, error: fnErr } = await supabase.functions.invoke('process-refund', {
      body: { paymentId, adminProfileId },
    });

    if (fnErr || !data?.success) {
      const msg = data?.error ?? fnErr?.message ?? 'Refund failed.';
      setRefundError((prev) => ({ ...prev, [paymentId]: msg }));
      setRefunding(null);
      return;
    }

    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: 'refunded', refunded_at: new Date().toISOString() }
          : p
      )
    );
    setRefunding(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-8 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-400 text-sm mb-1">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">All Bookings</h1>
          <p className="text-gray-400 text-sm mt-1">View, update statuses, and process refunds.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map((s) => {
            const count  = s === 'all' ? bookings.length : bookings.filter((b) => b.status === s).length;
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
                {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
            <p className="text-gray-400 text-sm">No bookings found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Booking ID', 'Customer', 'Route', 'CBM', 'Total', 'Status', 'Date', ''].map((h) => (
                      <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-400">{b.id.slice(0, 8)}…</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-400">
                        {b.customer_id.slice(0, 8)}…
                      </td>
                      <td className="py-3.5 px-4 text-sm font-medium text-gray-700">
                        {b.containers ? `${b.containers.origin_city} → ${b.containers.destination_city}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-700">{b.total_cbm} CBM</td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-sm" style={{ color: '#f97316' }}>{ZAR(b.total_price)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="badge badge-sm text-white font-semibold capitalize"
                          style={{ backgroundColor: STATUS_COLOURS[b.status] ?? '#6b7280' }}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">{fmt(b.created_at)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openModal(b, 'status')}
                            disabled={VALID_TRANSITIONS[b.status]?.length === 0}
                            className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-700 rounded-lg disabled:opacity-30"
                          >
                            Status →
                          </button>
                          <button
                            onClick={() => openModal(b, 'payments')}
                            className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-700 rounded-lg"
                          >
                            Payments
                          </button>
                          <Link
                            href={`/booking/track/${b.id}`}
                            className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-700 rounded-lg"
                          >
                            Track
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-gray-800">
                  {selected.containers
                    ? `${selected.containers.origin_city} → ${selected.containers.destination_city}`
                    : 'Booking'}
                </h3>
                <p className="font-mono text-xs text-gray-400">{selected.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm btn-circle text-gray-400">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['status', 'payments'] as ModalTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className="flex-1 py-3 text-sm font-semibold capitalize transition-colors"
                  style={modalTab === tab
                    ? { color: '#0f2044', borderBottom: '2px solid #0f2044' }
                    : { color: '#9ca3af' }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Status tab */}
            {modalTab === 'status' && (
              <>
                <div className="px-6 py-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-gray-700">New Status</label>
                    <select className="select select-bordered w-full" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      <option value={selected.status}>
                        {selected.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} (current)
                      </option>
                      {VALID_TRANSITIONS[selected.status]?.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-gray-700">Notes <span className="font-normal text-gray-400">(optional)</span></label>
                    <textarea
                      className="textarea textarea-bordered w-full h-20 resize-none"
                      placeholder="Reason for status change…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {updateError && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{updateError}</p>
                  )}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={() => setSelected(null)} className="btn btn-ghost flex-1 rounded-xl text-gray-500">Cancel</button>
                  <button
                    onClick={applyStatusChange}
                    disabled={updating}
                    className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90"
                    style={{ backgroundColor: '#0f2044' }}
                  >
                    {updating ? <span className="loading loading-spinner loading-sm" /> : 'Apply'}
                  </button>
                </div>
              </>
            )}

            {/* Payments tab */}
            {modalTab === 'payments' && (
              <div className="px-6 py-4 flex flex-col gap-3">
                {loadingPayments ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-md" style={{ color: '#f97316' }} />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No payment records found.</p>
                ) : (
                  payments.map((pmt) => (
                    <div key={pmt.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {STAGE_LABELS[pmt.stage] ?? pmt.stage}
                          </p>
                          <p className="text-lg font-extrabold mt-0.5" style={{ color: '#f97316' }}>
                            {ZAR(pmt.amount)}
                          </p>
                        </div>
                        <span className="badge badge-sm text-white font-semibold capitalize shrink-0"
                          style={{ backgroundColor: PAYMENT_COLOURS[pmt.status] ?? '#6b7280' }}>
                          {pmt.status}
                        </span>
                      </div>

                      {pmt.paid_at && (
                        <p className="text-xs text-gray-400">Paid: {fmt(pmt.paid_at)}</p>
                      )}
                      {pmt.refunded_at && (
                        <p className="text-xs text-purple-500">Refunded: {fmt(pmt.refunded_at)}</p>
                      )}
                      {pmt.paystack_reference && (
                        <p className="text-xs font-mono text-gray-400 mt-1 truncate">Ref: {pmt.paystack_reference}</p>
                      )}

                      {pmt.status === 'paid' && (
                        <div className="mt-3">
                          <button
                            onClick={() => handleRefund(pmt.id)}
                            disabled={refunding === pmt.id}
                            className="btn btn-sm btn-error text-white font-bold rounded-lg w-full"
                          >
                            {refunding === pmt.id
                              ? <span className="loading loading-spinner loading-xs" />
                              : 'Issue Refund via Paystack'}
                          </button>
                          {refundError[pmt.id] && (
                            <p className="text-xs text-red-500 mt-1">{refundError[pmt.id]}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <button onClick={() => setSelected(null)} className="btn btn-ghost rounded-xl text-gray-500 mt-2">Close</button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
