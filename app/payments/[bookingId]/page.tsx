'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import PaymentStageCard from '@/components/PaymentStageCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type Payment = {
  id: string;
  stage: 'deposit_20' | 'pre_departure_50' | 'final_release_30';
  amount: number;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  due_date: string | null;
  paid_at: string | null;
};

type BookingDetail = {
  id: string;
  total_price: number;
  status: string;
  containers: {
    origin_city: string;
    destination_city: string;
    departure_date: string;
    departure_notice_sent_at: string | null;
  } | null;
};

const STAGE_ORDER = ['deposit_20', 'pre_departure_50', 'final_release_30'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router        = useRouter();

  const [booking,  setBooking]  = useState<BookingDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [paying,     setPaying]     = useState(false);
  const [payError,   setPayError]   = useState<string | null>(null);
  const [milestones, setMilestones] = useState<{ milestone: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/auth/login?next=/payments/${bookingId}`); return; }

      const [bookingRes, paymentsRes, milestonesRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, total_price, status, containers(origin_city, destination_city, departure_date, departure_notice_sent_at)')
          .eq('id', bookingId)
          .single(),
        supabase
          .from('payments')
          .select('id, stage, amount, status, due_date, paid_at')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true }),
        supabase
          .from('shipment_milestones')
          .select('milestone')
          .eq('booking_id', bookingId),
      ]);

      if (bookingRes.error || !bookingRes.data) {
        setError('Booking not found or access denied.');
      } else {
        setBooking(bookingRes.data as unknown as BookingDetail);
        setPayments((paymentsRes.data ?? []) as Payment[]);
        setMilestones((milestonesRes.data ?? []) as { milestone: string }[]);
      }
      setLoading(false);
    }
    if (bookingId) load();
  }, [bookingId, router]);

  function isPayable(payment: Payment): boolean {
    if (payment.status !== 'pending') return false;
    const idx = STAGE_ORDER.indexOf(payment.stage);

    if (idx === 0) return true;

    if (idx === 1) {
      const stage1Paid = payments.find((p) => p.stage === 'deposit_20')?.status === 'paid';
      const isLoaded   = ['loaded', 'in_transit', 'delivered'].includes(booking?.status ?? '');
      const noticeSent = booking?.containers?.departure_notice_sent_at != null;
      return stage1Paid && isLoaded && noticeSent;
    }

    if (idx === 2) {
      const stage2Paid = payments.find((p) => p.stage === 'pre_departure_50')?.status === 'paid';
      const hasArrival = milestones.some((m) => m.milestone === 'destination_arrival');
      return stage2Paid && hasArrival;
    }

    return false;
  }

  function getLockReason(payment: Payment): string | undefined {
    if (payment.status !== 'pending' || isPayable(payment)) return undefined;
    const idx = STAGE_ORDER.indexOf(payment.stage);

    if (idx === 1) {
      const stage1Paid = payments.find((p) => p.stage === 'deposit_20')?.status === 'paid';
      if (!stage1Paid) return 'Complete the 20% deposit first';
      const isLoaded = ['loaded', 'in_transit', 'delivered'].includes(booking?.status ?? '');
      if (!isLoaded) return 'Awaiting cargo loading confirmation from operator';
      return 'Awaiting operator 7-day departure notice';
    }

    if (idx === 2) {
      const stage2Paid = payments.find((p) => p.stage === 'pre_departure_50')?.status === 'paid';
      if (!stage2Paid) return 'Complete the 50% pre-departure payment first';
      return 'Awaiting cargo arrival confirmation from operator';
    }

    return undefined;
  }

  async function handlePay(paymentId: string) {
    setPaying(true);
    setPayError(null);

    const callbackUrl = `${window.location.origin}/payments/callback`;

    const { data, error: fnErr } = await supabase.functions.invoke('initialize-payment', {
      body: { bookingId, paymentId, callbackUrl },
    });

    if (fnErr || !data?.authorization_url) {
      setPayError(data?.error ?? fnErr?.message ?? 'Could not initialize payment. Please try again.');
      setPaying(false);
      return;
    }

    window.location.href = data.authorization_url;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
        <p className="text-gray-500">{error ?? 'Booking not found.'}</p>
        <Link href="/bookings" className="btn btn-sm text-white" style={{ backgroundColor: '#0f2044' }}>
          ← My Bookings
        </Link>
      </div>
    );
  }

  const c              = booking.containers;
  const paidCount      = payments.filter((p) => p.status === 'paid').length;
  const allPaid        = paidCount === 3;
  const totalPaid      = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const remaining      = booking.total_price - totalPaid;

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
          <Link href="/bookings" className="text-sm text-gray-500 hover:text-gray-800">← My Bookings</Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-8 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-gray-400 text-sm mb-1">Payment</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {c ? `${c.origin_city} → ${c.destination_city}` : 'Booking Payment'}
          </h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">Ref: {bookingId.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

        {/* Summary bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap gap-4 justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-xl font-extrabold" style={{ color: '#0f2044' }}>R{booking.total_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Paid</p>
            <p className="text-xl font-extrabold text-green-600">R{totalPaid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Remaining</p>
            <p className="text-xl font-extrabold" style={{ color: remaining > 0 ? '#f97316' : '#22c55e' }}>
              R{remaining.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Progress</p>
            <p className="text-xl font-extrabold text-gray-800">{paidCount}/3 stages</p>
          </div>
        </div>

        {allPaid && (
          <div className="alert text-sm font-semibold" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
            ✓ All payments complete. Your cargo release can be authorised once conditions are met.
          </div>
        )}

        {payError && (
          <div className="alert alert-error text-sm">{payError}</div>
        )}

        {/* Payment stage cards */}
        {payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center">
            <p className="text-gray-400 text-sm">No payment schedule found for this booking.</p>
            <p className="text-xs text-gray-300 mt-1">Payment records are created automatically when a booking is made.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[...payments].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
              .map((payment) => (
                <PaymentStageCard
                  key={payment.id}
                  payment={payment}
                  isPayable={isPayable(payment)}
                  lockReason={getLockReason(payment)}
                  onPay={handlePay}
                  paying={paying}
                />
              ))}
          </div>
        )}

        <div className="flex gap-3">
          <Link href={`/booking/track/${bookingId}`} className="btn btn-ghost flex-1 rounded-xl text-gray-500 text-sm">
            Track Shipment
          </Link>
          <Link href="/payments/history" className="btn btn-ghost flex-1 rounded-xl text-gray-500 text-sm">
            Payment History
          </Link>
        </div>
      </div>
    </div>
  );
}
