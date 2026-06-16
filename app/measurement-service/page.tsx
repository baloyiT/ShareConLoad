'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type RateBand = { id: string; zone_name: string; base_fee: number };
type Step = 'form' | 'confirm' | 'paying';

export default function MeasurementServicePage() {
  const router = useRouter();
  const [step, setStep]               = useState<Step>('form');
  const [profileId, setProfileId]     = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity]   = useState('');
  const [pickupCountry, setPickupCountry] = useState('');
  const [rateBand, setRateBand]       = useState<RateBand | null>(null);
  const [bandLoading, setBandLoading] = useState(false);
  const [bandError, setBandError]     = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

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
    }
    init();
  }, [router]);

  async function handleLookupRate(e: React.FormEvent) {
    e.preventDefault();
    if (!pickupAddress.trim() || !pickupCity.trim() || !pickupCountry.trim()) {
      setBandError('All fields are required.');
      return;
    }
    setBandLoading(true);
    setBandError(null);
    const { data: bands } = await supabase
      .from('measurement_rate_bands')
      .select('id, zone_name, base_fee')
      .eq('active', true);

    const city = pickupCity.toLowerCase();
    const matched = (bands ?? []).find((b: RateBand) =>
      b.zone_name.toLowerCase().includes(city) || city.includes(b.zone_name.toLowerCase())
    );

    if (!matched) {
      setBandError(`No measurement service available in ${pickupCity} yet. Contact support@shareconload.com.`);
      setBandLoading(false);
      return;
    }
    setRateBand(matched as RateBand);
    setStep('confirm');
    setBandLoading(false);
  }

  async function handleProceedToPayment() {
    if (!profileId || !rateBand) return;
    setSubmitting(true);
    setError(null);

    // Create the job record
    const { data: job, error: jobErr } = await supabase
      .from('measurement_jobs')
      .insert({
        shipper_profile_id: profileId,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim(),
        pickup_country: pickupCountry.trim(),
        quoted_fee: rateBand.base_fee,
        rate_band_id: rateBand.id,
        status: 'pending_payment',
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      setError('Failed to create job. Please try again.');
      setSubmitting(false);
      return;
    }

    setStep('paying');

    // Call Edge Function for Paystack URL
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initialize-measurement-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          callbackUrl: `${window.location.origin}/measurement-service/${job.id}?verify=1`,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || !result.authorization_url) {
      setError(result.error ?? 'Payment initialization failed.');
      setStep('confirm');
      setSubmitting(false);
      return;
    }

    window.location.href = result.authorization_url;
  }

  function fmtMoney(v: number) {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-12">
        <Link href="/" className="text-sm text-gray-400 hover:underline">← Back</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-1">Cargo Measurement Service</h1>
        <p className="text-sm text-gray-500 mb-8">
          A trained agent will visit your location, measure your cargo, and provide an official CBM report.
        </p>

        {step === 'form' && (
          <form onSubmit={handleLookupRate} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pickup Address</label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Street address"
                className="input input-bordered w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  placeholder="e.g. Johannesburg"
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={pickupCountry}
                  onChange={(e) => setPickupCountry(e.target.value)}
                  placeholder="e.g. South Africa"
                  className="input input-bordered w-full"
                />
              </div>
            </div>
            {bandError && <p className="text-sm text-red-600">{bandError}</p>}
            <button
              type="submit"
              disabled={bandLoading}
              className="btn w-full text-white font-bold rounded-xl disabled:opacity-60"
              style={{ backgroundColor: '#ff6a00' }}
            >
              {bandLoading ? <span className="loading loading-spinner loading-sm" /> : 'Check Availability & Price'}
            </button>
          </form>
        )}

        {step === 'confirm' && rateBand && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Measurement Job Details</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="text-gray-800 font-medium">{pickupAddress}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">City</span><span className="text-gray-800 font-medium">{pickupCity}, {pickupCountry}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Service Zone</span><span className="text-gray-800 font-medium">{rateBand.zone_name}</span></div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t">
                  <span>Service Fee</span>
                  <span style={{ color: '#ff6a00' }}>{fmtMoney(rateBand.base_fee)}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              An agent will contact you within 24 hours to arrange a visit. The fee is non-refundable once the agent has been assigned.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setStep('form'); setRateBand(null); }}
                className="btn btn-ghost flex-1 rounded-xl">Back</button>
              <button onClick={handleProceedToPayment} disabled={submitting}
                className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                style={{ backgroundColor: '#ff6a00' }}>
                {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Pay & Confirm'}
              </button>
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
