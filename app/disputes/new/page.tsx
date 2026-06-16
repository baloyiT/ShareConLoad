'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

import { AlertCircle } from 'lucide-react';
type BookingOption = {
  id: string;
  route: string;
  status: string;
};

type DisputeType = 'cargo_damage' | 'short_delivery' | 'overcharge' | 'delay' | 'other';

const DISPUTE_TYPES: { value: DisputeType; label: string; description: string }[] = [
  { value: 'cargo_damage',   label: 'Cargo Damage',       description: 'Goods arrived damaged or broken.'                     },
  { value: 'short_delivery', label: 'Short Delivery',     description: 'Quantity received is less than booked.'               },
  { value: 'overcharge',     label: 'Overcharge',         description: 'Charged more than the agreed price.'                  },
  { value: 'delay',          label: 'Unreasonable Delay', description: 'Shipment significantly delayed without notice.'       },
  { value: 'other',          label: 'Other',              description: 'Any other issue not listed above.'                    },
];

// ─── Inner form (uses useSearchParams) ───────────────────────────────────────

function NewDisputeForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const preselected  = searchParams.get('bookingId') ?? '';

  const [profileId,    setProfileId]    = useState<string | null>(null);
  const [bookings,     setBookings]     = useState<BookingOption[]>([]);
  const [bookingId,    setBookingId]    = useState(preselected);
  const [disputeType,  setDisputeType]  = useState<DisputeType>('cargo_damage');
  const [description,  setDescription]  = useState('');
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/disputes/new'); return; }

      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (pErr || !profile) { setError('Profile not found. Please complete onboarding.'); setLoading(false); return; }
      setProfileId(profile.id);

      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('id, status, containers(origin_city, destination_city)')
        .eq('customer_id', profile.id)
        .in('status', ['confirmed', 'loaded', 'in_transit', 'delivered'])
        .order('created_at', { ascending: false });

      setBookings(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bookingRows ?? []).map((b: any) => ({
          id:     b.id,
          route:  b.containers ? `${b.containers.origin_city} → ${b.containers.destination_city}` : 'Route unavailable',
          status: b.status,
        })),
      );
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId)          { setError('Please select a booking.'); return; }
    if (!description.trim()) { setError('Please describe the issue.'); return; }
    if (!profileId) return;

    setSubmitting(true);
    setError(null);

    const { data: inserted, error: insertErr } = await supabase
      .from('disputes')
      .insert({
        booking_id:   bookingId,
        submitted_by: profileId,
        dispute_type: disputeType,
        description:  description.trim(),
      })
      .select('id')
      .single();

    if (insertErr || !inserted) { setError(insertErr?.message ?? 'Failed to submit dispute.'); setSubmitting(false); return; }
    router.push(`/disputes/${inserted.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {loading && (
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">

          {error && (
            <div className="alert alert-error text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Booking selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Booking</label>
            {bookings.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                No eligible bookings found. Disputes can be raised for confirmed, loaded, in-transit, or delivered shipments.
              </p>
            ) : (
              <select
                className="select select-bordered w-full"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                required
              >
                <option value="">- Select a booking -</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.route} ({b.status}), #{b.id.slice(0, 8).toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dispute type */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">Dispute Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISPUTE_TYPES.map((dt) => (
                <label
                  key={dt.value}
                  className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                  style={disputeType === dt.value
                    ? { borderColor: '#0b103a', backgroundColor: '#f0f4ff' }
                    : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                >
                  <input
                    type="radio"
                    name="dispute_type"
                    value={dt.value}
                    checked={disputeType === dt.value}
                    onChange={() => setDisputeType(dt.value)}
                    className="radio radio-sm mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{dt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{dt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Description</label>
            <textarea
              className="textarea textarea-bordered w-full h-32 resize-none"
              placeholder="Describe the issue in detail, what happened, when, and what resolution you expect."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Link href="/bookings" className="btn btn-ghost flex-1 rounded-xl text-gray-500">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || bookings.length === 0}
              className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#0b103a' }}
            >
              {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Dispute'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Page (wraps form in Suspense for useSearchParams) ────────────────────────

export default function NewDisputePage() {
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
          <Link href="/bookings" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← My Bookings
          </Link>
        </div>
      </nav>

      <PageHero gradient label="Customer Portal" title="Raise a Dispute" description="Our team will review your case within 2 business days." />

      <Suspense fallback={
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
        </div>
      }>
        <NewDisputeForm />
      </Suspense>
    </div>
  );
}
