'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const reference    = searchParams.get('reference') ?? searchParams.get('trxref') ?? '';

  const [status,   setStatus]   = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [message,  setMessage]  = useState('');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setMessage('No payment reference found.');
      return;
    }

    async function verify() {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { reference },
      });

      if (error || !data?.success) {
        setStatus('failed');
        setMessage(data?.message ?? error?.message ?? 'Payment could not be verified. Please contact support.');
        return;
      }

      setBookingId(data.bookingId ?? null);
      setStatus('success');
    }

    verify();
  }, [reference]);

  // Redirect to payment page after success
  useEffect(() => {
    if (status === 'success' && bookingId) {
      const timeout = setTimeout(() => router.push(`/payments/${bookingId}`), 3000);
      return () => clearTimeout(timeout);
    }
  }, [status, bookingId, router]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">

        {status === 'verifying' && (
          <>
            <span className="loading loading-spinner loading-lg mb-5" style={{ color: '#f97316' }} />
            <h2 className="text-xl font-bold text-gray-800">Verifying payment…</h2>
            <p className="text-sm text-gray-400 mt-1">Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#f0fdf4' }}>
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-gray-800 mb-1">Payment Confirmed!</h2>
            <p className="text-sm text-gray-500 mb-1">Your payment has been successfully verified.</p>
            <p className="text-xs text-gray-400 font-mono mb-6">Ref: {reference}</p>
            <p className="text-xs text-gray-400">Redirecting to your payment page…</p>
            {bookingId && (
              <Link
                href={`/payments/${bookingId}`}
                className="btn mt-4 text-white font-bold rounded-xl hover:opacity-90 w-full"
                style={{ backgroundColor: '#0f2044' }}
              >
                Go to Payment Page
              </Link>
            )}
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-red-50">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-gray-800 mb-1">Payment Failed</h2>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <div className="flex flex-col gap-2">
              <Link href="/bookings" className="btn text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#0f2044' }}>
                My Bookings
              </Link>
              <Link href="/support/new" className="btn btn-ghost rounded-xl text-gray-500 text-sm">
                Contact Support
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">

      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
        </div>
      </nav>

      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
