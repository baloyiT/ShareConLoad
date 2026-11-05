'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import type { DirectoryOperator, ServiceCategory, TransportMode } from '@/services/freightTypes';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import OperatorDirectoryCard from '@/components/OperatorDirectoryCard';
import { buildEnquiryContactUrl } from '@/components/HomeEnquiryForm';
import PublicNav from '@/components/PublicNav';
import PublicFooter from '@/components/PublicFooter';

const MODES: { value: TransportMode; label: string }[] = [
  { value: 'sea', label: 'Sea' },
  { value: 'air', label: 'Air' },
  { value: 'road', label: 'Road' },
  { value: 'rail', label: 'Rail' },
];
const RESULT_LIMIT = 100;

interface Filters {
  service: string;
  mode: string;
  fromCity: string;
  fromCountry: string;
  toCity: string;
  toCountry: string;
}

function readFilters(params: URLSearchParams): Filters {
  const mode = params.get('mode') ?? '';
  return {
    service: params.get('service') ?? '',
    mode: MODES.some((m) => m.value === mode) ? mode : '',
    fromCity: params.get('fromCity') ?? '',
    fromCountry: params.get('fromCountry') ?? '',
    toCity: params.get('toCity') ?? '',
    toCountry: params.get('toCountry') ?? '',
  };
}

function placeText(city: string, country: string): string {
  return city && country ? `${city}, ${country}` : country || city;
}

export default function DirectoryPage() {
  // useSearchParams needs a Suspense boundary for production builds.
  return (
    <Suspense fallback={null}>
      <Directory />
    </Suspense>
  );
}

function Directory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = readFilters(searchParams);
  const query = searchParams.toString();

  const [services, setServices] = useState<ServiceCategory[]>([]);
  const [operators, setOperators] = useState<DirectoryOperator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the visitor is typing, kept apart from the filter until a place is picked.
  const [fromText, setFromText] = useState(placeText(filters.fromCity, filters.fromCountry));
  const [toText, setToText] = useState(placeText(filters.toCity, filters.toCountry));

  useEffect(() => {
    supabase.from('service_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data, error: err }) => {
        if (err) console.error('Could not load service categories:', err);
        else setServices((data ?? []) as ServiceCategory[]);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const f = readFilters(new URLSearchParams(query));
    // A country is always sent with its city, so country-wide operators match.
    const args: Record<string, string> = {};
    if (f.service) args.p_service = f.service;
    if (f.mode) args.p_mode = f.mode;
    if (f.fromCountry) { args.p_origin_country = f.fromCountry; if (f.fromCity) args.p_origin_city = f.fromCity; }
    if (f.toCountry) { args.p_destination_country = f.toCountry; if (f.toCity) args.p_destination_city = f.toCity; }
    setError(null);
    supabase.rpc('search_directory', args).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        console.error('Directory search failed:', err);
        setError('We could not load operators. Please try again.');
        setOperators([]);
        return;
      }
      setOperators((data ?? []) as DirectoryOperator[]);
    });
    return () => { cancelled = true; };
  }, [query]);

  // Filters written to the URL but not yet read back from it. Keystrokes can arrive before the
  // router has re-rendered, and each one must build on the latest change, not on a stale render.
  const pending = useRef<{ filters: Filters; query: string } | null>(null);
  useEffect(() => {
    if (pending.current?.query === query) pending.current = null;
  }, [query]);

  function update(patch: Partial<Filters>) {
    const next = { ...(pending.current?.filters ?? filters), ...patch };
    const params = new URLSearchParams();
    (Object.keys(next) as (keyof Filters)[]).forEach((k) => { if (next[k]) params.set(k, next[k]); });
    const qs = params.toString();
    pending.current = { filters: next, query: qs };
    router.replace(qs ? `/directory?${qs}` : '/directory', { scroll: false });
  }

  const enquiryUrl = buildEnquiryContactUrl(
    services.find((s) => s.slug === filters.service)?.name ?? '',
    placeText(filters.fromCity, filters.fromCountry),
    placeText(filters.toCity, filters.toCountry),
  );
  const filtered = Object.values(filters).some(Boolean);
  const results = operators ?? [];

  const prompt = (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center grid gap-3">
      <p className="text-sm text-[#333B48]">
        {filtered
          ? 'Not every route has an operator listed yet.'
          : 'No operators are listed yet. We can still help you find someone for your freight.'}
      </p>
      <Link
        href={enquiryUrl}
        className="justify-self-center text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
      >
        Tell us what you&apos;re moving and we&apos;ll help
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-[#333B48]">
      <PublicNav />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 gap-6 content-start">
        <header className="grid gap-2">
          <h1 className="font-heading text-3xl font-bold text-[#081D3A]">Find operators</h1>
          <p className="text-sm text-[#6B7280]">
            Search by service, transport mode and route. You do not need an account.
          </p>
        </header>

        <form onSubmit={(e) => e.preventDefault()} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dir-service" className="block mb-1 text-sm font-semibold text-gray-700">Service</label>
            <select
              id="dir-service"
              value={filters.service}
              onChange={(e) => update({ service: e.target.value })}
              className="select select-bordered w-full text-sm"
            >
              <option value="">Any service</option>
              {services.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dir-mode" className="block mb-1 text-sm font-semibold text-gray-700">Mode</label>
            <select
              id="dir-mode"
              value={filters.mode}
              onChange={(e) => update({ mode: e.target.value })}
              className="select select-bordered w-full text-sm"
            >
              <option value="">Any mode</option>
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <LocationAutocomplete
            id="dir-from"
            label="From"
            placeholder="Johannesburg, South Africa"
            value={fromText}
            onChange={setFromText}
            onSelect={(loc) => update({ fromCity: loc?.city ?? '', fromCountry: loc?.country ?? '' })}
          />
          <LocationAutocomplete
            id="dir-to"
            label="To"
            placeholder="Accra, Ghana"
            value={toText}
            onChange={setToText}
            onSelect={(loc) => update({ toCity: loc?.city ?? '', toCountry: loc?.country ?? '' })}
          />
        </form>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        {operators === null ? (
          <p className="text-sm text-[#6B7280]">Loading operators...</p>
        ) : results.length === 0 ? (
          prompt
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {results.map((op) => <OperatorDirectoryCard key={op.id} operator={op} />)}
            </div>
            {results.length >= RESULT_LIMIT && (
              <p className="text-sm text-[#6B7280]">Showing the first {RESULT_LIMIT}. Narrow your search to see others.</p>
            )}
            {results.length < 3 && prompt}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
