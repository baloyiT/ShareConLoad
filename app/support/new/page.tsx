'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

type BookingOption = {
  id: string;
  route: string;
};

type Priority = 'low' | 'medium' | 'high' | 'critical';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: '#6b7280' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { value: 'high',     label: 'High',     color: '#f97316' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
];

export default function NewSupportTicketPage() {
  const router = useRouter();

  const [profileId,   setProfileId]   = useState<string | null>(null);
  const [bookings,    setBookings]    = useState<BookingOption[]>([]);
  const [bookingId,   setBookingId]   = useState('');
  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [priority,    setPriority]    = useState<Priority>('medium');
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/support/new'); return; }

      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (pErr || !profile) { setError('Profile not found. Please complete onboarding.'); setLoading(false); return; }
      setProfileId(profile.id);

      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('id, containers(origin_city, destination_city)')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });

      setBookings(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bookingRows ?? []).map((b: any) => ({
          id:    b.id,
          route: b.containers ? `${b.containers.origin_city} → ${b.containers.destination_city}` : 'Route unavailable',
        })),
      );
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim())     { setError('Please enter a subject.'); return; }
    if (!description.trim()) { setError('Please describe your issue.'); return; }
    if (!profileId) return;

    setSubmitting(true);
    setError(null);

    const { error: insertErr } = await supabase.from('support_tickets').insert({
      submitted_by: profileId,
      booking_id:   bookingId || null,
      subject:      subject.trim(),
      description:  description.trim(),
      priority,
    });

    if (insertErr) { setError(insertErr.message); setSubmitting(false); return; }
    router.push('/bookings');
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
          <Link href="/bookings" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← My Bookings
          </Link>
        </div>
      </nav>

      <PageHero gradient label="Customer Portal" title="Contact Support" description="Submit a ticket and we'll get back to you as soon as possible." />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">

            {error && (
              <div className="alert alert-error text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                </svg>
                {error}
              </div>
            )}

            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Subject</label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Brief summary of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Booking (optional) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Related Booking <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              >
                <option value="">— No specific booking —</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.route} — #{b.id.slice(0, 8).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">Priority</label>
              <div className="flex gap-2 flex-wrap">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
                    style={priority === p.value
                      ? { backgroundColor: p.color, color: '#fff', borderColor: p.color }
                      : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Description</label>
              <textarea
                className="textarea textarea-bordered w-full h-36 resize-none"
                placeholder="Describe your issue in detail. Include any relevant dates, booking IDs, or steps to reproduce the problem."
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
                disabled={submitting}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#f97316' }}
              >
                {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
