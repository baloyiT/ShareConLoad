'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import { Container } from '@/components/ContainerCard';

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysBetween(a: string, b: string) {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function ContainerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [container, setContainer] = useState<Container | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchContainer() {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Container fetch error:', error);
        setNotFound(true);
      } else {
        setContainer(data as Container);
      }
      setLoading(false);
    }

    if (id) fetchContainer();
  }, [id]);

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────
  if (notFound || !container) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
        <div className="text-6xl">📦</div>
        <h1 className="text-2xl font-bold text-gray-800">Container not found</h1>
        <p className="text-gray-400 text-sm max-w-xs">
          This container may no longer be available or the link is invalid.
        </p>
        <Link href="/" className="btn btn-sm mt-2" style={{ backgroundColor: '#0f2044', color: '#fff' }}>
          ← Back to listings
        </Link>
      </div>
    );
  }

  const capacityUsed = container.total_capacity_cbm - container.available_capacity_cbm;
  const capacityPct = Math.round((capacityUsed / container.total_capacity_cbm) * 100);
  const transitDays =
    container.arrival_date ? daysBetween(container.departure_date, container.arrival_date) : null;
  const isOpen = container.status === 'open';

  // ── Page ─────────────────────────────────────────────────
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
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to listings
          </Link>
        </div>
      </nav>

      {/* Hero band */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="badge badge-sm text-white font-semibold"
                style={{ backgroundColor: isOpen ? '#22c55e' : '#6b7280' }}
              >
                {container.status.toUpperCase()}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center gap-3 flex-wrap">
              {container.origin_city}
              <svg className="w-7 h-7 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              {container.destination_city}
            </h1>
            <p className="text-gray-400 mt-1">
              {container.origin_country} → {container.destination_country}
            </p>
          </div>

          {isOpen && (
            <button
              onClick={() => router.push(`/booking/${container.id}`)}
              className="btn text-white font-bold px-8 py-3 rounded-xl text-base shadow-lg hover:opacity-90 transition-opacity shrink-0"
              style={{ backgroundColor: '#f97316' }}
            >
              Book Space →
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: details */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Route & schedule */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
              Route &amp; Schedule
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Origin</p>
                <p className="font-bold text-gray-900 text-lg">{container.origin_city}</p>
                <p className="text-sm text-gray-500">{container.origin_country}</p>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 text-center">
                  {transitDays !== null && (
                    <span className="text-xs text-gray-400">{transitDays} days</span>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                    <div className="w-16 h-0.5 bg-gray-300" />
                    <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Destination</p>
                <p className="font-bold text-gray-900 text-lg">{container.destination_city}</p>
                <p className="text-sm text-gray-500">{container.destination_country}</p>
              </div>
            </div>

            <div className="divider my-4" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Departure Date</p>
                <p className="font-semibold text-gray-800">{fmt(container.departure_date)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Estimated Arrival</p>
                <p className="font-semibold text-gray-800">
                  {container.arrival_date ? fmt(container.arrival_date) : 'TBC'}
                </p>
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
              Capacity
            </h2>
            <div className="flex items-end justify-between mb-2">
              <p className="text-sm text-gray-500">Space booked</p>
              <p className="text-sm font-semibold text-gray-700">
                {capacityUsed.toFixed(1)} / {container.total_capacity_cbm} CBM ({capacityPct}%)
              </p>
            </div>
            <progress
              className="progress w-full h-3 rounded-full"
              style={{ accentColor: '#f97316' }}
              value={capacityPct}
              max={100}
            />
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-gray-400">Used: {capacityUsed.toFixed(1)} CBM</span>
              <span className="font-semibold" style={{ color: '#f97316' }}>
                Available: {container.available_capacity_cbm} CBM
              </span>
            </div>
          </div>

        </div>

        {/* Right: pricing + CTA */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Pricing
            </h2>

            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-extrabold" style={{ color: '#f97316' }}>
                R{container.price_per_cbm}
              </span>
              <span className="text-gray-400 text-sm">/ CBM</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              e.g. 5 CBM = R{(container.price_per_cbm * 5).toFixed(2)}
            </p>

            <div className="flex flex-col gap-2 text-sm text-gray-600 mb-6">
              {[
                `${container.available_capacity_cbm} CBM remaining`,
                `Departs ${fmt(container.departure_date)}`,
                container.arrival_date
                  ? `Arrives ~${fmt(container.arrival_date)}`
                  : 'Arrival date TBC',
                container.operator_name ?? '',
              ]
                .filter(Boolean)
                .map((line) => (
                  <div key={line} className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{line}</span>
                  </div>
                ))}
            </div>

            {isOpen ? (
              <button
                onClick={() => router.push(`/booking/${container.id}`)}
                className="w-full btn text-white font-bold py-3 rounded-xl text-base hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#f97316' }}
              >
                Book Space
              </button>
            ) : (
              <button disabled className="w-full btn btn-disabled py-3 rounded-xl text-base">
                No longer available
              </button>
            )}

            <p className="text-xs text-gray-400 text-center mt-3">
              No payment charged until confirmed
            </p>
          </div>

          {/* Operator card */}
          {container.operator_name && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: '#0f2044' }}
              >
                {container.operator_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{container.operator_name}</p>
                <p className="text-xs text-gray-400">Verified Operator</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
