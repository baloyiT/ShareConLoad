'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';

type Step = 'address' | 'select' | 'paying';

type RateBand = { id: string; zone_name: string; base_fee: number; per_cbm_fee: number; origin_city: string; origin_country: string };
type Transporter = { id: string; full_name: string; vehicle_type: string; vehicle_capacity_cbm: number; average_rating: number | null; total_jobs_completed: number };
type Booking = { id: string; total_cbm: number; container_id: string; customer_id: string };

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

function PickupContent({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profileId, setProfileId]         = useState<string | null>(null);
  const [booking, setBooking]             = useState<Booking | null>(null);
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [step, setStep]                   = useState<Step>('address');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity]       = useState('');
  const [pickupCountry, setPickupCountry] = useState('');
  const [rateBand, setRateBand]           = useState<RateBand | null>(null);
  const [quotedFee, setQuotedFee]         = useState(0);
  const [transporters, setTransporters]   = useState<Transporter[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg]         = useState<string | null>(null);
  const [verifying, setVerifying]         = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) { router.push('/'); return; }
      setProfileId(profile.id);

      // Handle ?verify=1
      if (searchParams.get('verify') === '1') {
        setVerifying(true);
        const { data: existingJob } = await supabase
          .from('pickup_jobs')
          .select('payment_ref')
          .eq('booking_id', bookingId)
          .eq('shipper_profile_id', profile.id)
          .single();

        if (existingJob?.payment_ref) {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-pickup-payment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
              },
              body: JSON.stringify({ reference: existingJob.payment_ref }),
            }
          );
          const result = await res.json();
          setVerifyMsg(
            res.ok ? 'Payment confirmed! Your transporter has been notified.' : (result.error ?? 'Verification failed.')
          );
        }
        setVerifying(false);
      }

      // Load booking + container
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('id, total_cbm, container_id, customer_id')
        .eq('id', bookingId)
        .single();

      if (!bookingData) { router.push('/bookings'); return; }
      setBooking(bookingData as Booking);

      if (bookingData.container_id) {
        const { data: container } = await supabase
          .from('containers')
          .select('origin_city, origin_country')
          .eq('id', bookingData.container_id)
          .single();
        if (container) {
          setWarehouseAddress(`${container.origin_city}, ${container.origin_country}`);
        }
      }

      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function handleLookupRate(e: React.FormEvent) {
    e.preventDefault();
    if (!pickupAddress.trim() || !pickupCity.trim() || !pickupCountry.trim()) {
      setError('All fields are required.');
      return;
    }
    setError(null);
    setSubmitting(true);

    // Load all active rate bands + match by city
    const { data: bands } = await supabase
      .from('transporter_rate_bands')
      .select('*')
      .eq('active', true);

    const city = pickupCity.toLowerCase();
    const matched = (bands ?? []).find((b: RateBand) =>
      b.origin_city.toLowerCase() === city
    );

    if (!matched) {
      setError(`No pickup service available in ${pickupCity} yet. Contact support@shareconload.com.`);
      setSubmitting(false);
      return;
    }

    const totalCbm = booking?.total_cbm ?? 0;
    const fee = matched.base_fee + matched.per_cbm_fee * totalCbm;
    setRateBand(matched as RateBand);
    setQuotedFee(Math.round(fee * 100) / 100);

    // Load matching transporters
    const { data: allTransporters } = await supabase
      .from('transporter_profiles')
      .select('id, full_name, vehicle_type, vehicle_capacity_cbm, average_rating, total_jobs_completed, base_city')
      .eq('status', 'approved');

    const matched3 = ((allTransporters ?? []) as (Transporter & { base_city: string })[])
      .filter((t) => t.base_city.toLowerCase() === city && t.vehicle_capacity_cbm >= totalCbm)
      .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
      .slice(0, 3);

    if (matched3.length === 0) {
      setError(`No transporters available in ${pickupCity} with sufficient capacity. Try again later.`);
      setSubmitting(false);
      return;
    }

    setTransporters(matched3);
    setSelectedId(matched3[0].id);
    setStep('select');
    setSubmitting(false);
  }

  async function handleProceedToPayment() {
    if (!profileId || !booking || !rateBand || !selectedId) return;
    setSubmitting(true);
    setError(null);

    const { data: job, error: jobErr } = await supabase
      .from('pickup_jobs')
      .insert({
        booking_id: booking.id,
        shipper_profile_id: profileId,
        transporter_profile_id: selectedId,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim(),
        pickup_country: pickupCountry.trim(),
        warehouse_address: warehouseAddress,
        total_cbm: booking.total_cbm,
        quoted_fee: quotedFee,
        status: 'pending_payment',
        shortlisted_transporter_ids: transporters.map((t) => t.id),
        selected_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      setError('Failed to create pickup job. Please try again.');
      setSubmitting(false);
      return;
    }

    setStep('paying');

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initialize-pickup-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          callbackUrl: `${window.location.origin}/pickup/${bookingId}?verify=1`,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || !result.authorization_url) {
      setError(result.error ?? 'Payment initialization failed.');
      setStep('select');
      setSubmitting(false);
      return;
    }

    window.location.href = result.authorization_url;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-12">
        <Link href="/bookings" className="text-sm text-gray-400 hover:underline">← My Bookings</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-1">Arrange Pickup</h1>
        <p className="text-sm text-gray-500 mb-6">
          A transporter will collect your cargo and deliver it to the warehouse.
          {warehouseAddress && <> Warehouse: <strong>{warehouseAddress}</strong>.</>}
        </p>

        {verifying && (
          <div className="alert mb-4">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Verifying payment…</span>
          </div>
        )}
        {verifyMsg && (
          <div className={`alert text-sm mb-4 ${verifyMsg.includes('confirmed') ? 'alert-success' : 'alert-error'}`}>
            {verifyMsg}
          </div>
        )}

        {step === 'address' && (
          <form onSubmit={handleLookupRate} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pickup Address</label>
              <input type="text" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Street address" className="input input-bordered w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
                <input type="text" value={pickupCity} onChange={(e) => setPickupCity(e.target.value)}
                  placeholder="e.g. Johannesburg" className="input input-bordered w-full" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
                <input type="text" value={pickupCountry} onChange={(e) => setPickupCountry(e.target.value)}
                  placeholder="e.g. South Africa" className="input input-bordered w-full" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={submitting}
              className="btn w-full text-white font-bold rounded-xl disabled:opacity-60"
              style={{ backgroundColor: '#ff6a00' }}>
              {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Find Available Transporters'}
            </button>
            <div className="text-center">
              <Link href="/bookings" className="text-sm text-gray-400 hover:underline">Skip — I&apos;ll drop it off myself</Link>
            </div>
          </form>
        )}

        {step === 'select' && rateBand && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Fee Breakdown</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Base fee</span><span>{fmtMoney(rateBand.base_fee)}</span></div>
                {rateBand.per_cbm_fee > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Per CBM ({booking?.total_cbm} m³ × {fmtMoney(rateBand.per_cbm_fee)})</span>
                    <span>{fmtMoney(rateBand.per_cbm_fee * (booking?.total_cbm ?? 0))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total</span><span style={{ color: '#ff6a00' }}>{fmtMoney(quotedFee)}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Transporter</p>
              <div className="space-y-2">
                {transporters.map((t) => (
                  <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedId === t.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="transporter" value={t.id} checked={selectedId === t.id}
                      onChange={() => setSelectedId(t.id)} className="radio radio-sm" />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{t.full_name}</p>
                      <p className="text-xs text-gray-500">{t.vehicle_type} · {t.vehicle_capacity_cbm} CBM capacity</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-700 flex items-center justify-end gap-1">
                        {t.average_rating != null ? <><Star size={12} fill="#f59e0b" color="#f59e0b" /> {t.average_rating.toFixed(1)}</> : 'New'}
                      </p>
                      <p className="text-xs text-gray-400">{t.total_jobs_completed} jobs</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep('address'); setRateBand(null); setTransporters([]); }}
                className="btn btn-ghost flex-1 rounded-xl">Back</button>
              <button onClick={handleProceedToPayment} disabled={submitting || !selectedId}
                className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                style={{ backgroundColor: '#ff6a00' }}>
                {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Pay & Confirm'}
              </button>
            </div>
            <div className="text-center">
              <Link href="/bookings" className="text-sm text-gray-400 hover:underline">Skip — I&apos;ll drop it off myself</Link>
            </div>
          </div>
        )}

        {step === 'paying' && (
          <div className="text-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
            <p className="text-sm text-gray-500 mt-4">Redirecting to payment…</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PickupPage({ params }: { params: { bookingId: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    }>
      <PickupContent bookingId={params.bookingId} />
    </Suspense>
  );
}
