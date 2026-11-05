'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import type { Location } from '@/services/locations';
import type { OperatorCoverage, TransportMode } from '@/services/freightTypes';

import { ArrowRight, Trash2 } from 'lucide-react';

const MODES: { value: TransportMode; label: string }[] = [
  { value: 'sea', label: 'Sea' },
  { value: 'air', label: 'Air' },
  { value: 'road', label: 'Road' },
  { value: 'rail', label: 'Rail' },
];

function place(city: string | null, country: string): string {
  return city ? `${city}, ${country}` : `All of ${country}`;
}

function same(a: string | null, b: string | null): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

export default function CoverageEditor({ operatorProfileId }: { operatorProfileId: string }) {
  const [rows, setRows] = useState<OperatorCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [originWhole, setOriginWhole] = useState(false);
  const [destinationWhole, setDestinationWhole] = useState(false);
  const [mode, setMode] = useState<TransportMode | ''>('');
  // Changing this remounts the pickers so they clear after a save.
  const [resetKey, setResetKey] = useState(0);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('operator_coverage')
      .select('*')
      .eq('operator_profile_id', operatorProfileId)
      .order('origin_country')
      .order('origin_city', { nullsFirst: true })
      .order('destination_country')
      .order('destination_city', { nullsFirst: true })
      .order('transport_mode', { nullsFirst: true })
      .order('id');
    if (err) {
      console.error('Could not load coverage:', err);
      setError('We could not load your routes. Please refresh and try again.');
    } else {
      setRows((data ?? []) as OperatorCoverage[]);
    }
    setLoading(false);
  }, [operatorProfileId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    setError(null);
    if (!origin || !destination) {
      setError('Choose an origin and a destination from the suggestions.');
      return;
    }
    const row = {
      operator_profile_id: operatorProfileId,
      origin_country: origin.country,
      origin_city: originWhole ? null : origin.city,
      destination_country: destination.country,
      destination_city: destinationWhole ? null : destination.city,
      transport_mode: mode || null,
    };
    const duplicate = rows.some((r) =>
      same(r.origin_country, row.origin_country) && same(r.origin_city, row.origin_city) &&
      same(r.destination_country, row.destination_country) && same(r.destination_city, row.destination_city) &&
      (r.transport_mode ?? null) === row.transport_mode);
    if (duplicate) {
      setError('You have already added this route.');
      return;
    }

    setBusy(true);
    const { error: err } = await supabase.from('operator_coverage').insert(row);
    setBusy(false);
    if (err) {
      console.error('Could not add coverage:', err);
      setError('We could not add that route. Please try again.');
      return;
    }
    setOrigin(null); setDestination(null);
    setOriginWhole(false); setDestinationWhole(false);
    setMode('');
    setResetKey((k) => k + 1);
    await load();
  }

  async function remove(id: string) {
    setError(null);
    const { error: err } = await supabase.from('operator_coverage').delete().eq('id', id);
    if (err) {
      console.error('Could not remove coverage:', err);
      setError('We could not remove that route. Please try again.');
      return;
    }
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <div role="alert" className="alert alert-error text-sm">{error}</div>}

      {loading ? (
        <span className="loading loading-spinner loading-sm" style={{ color: '#FF6A00' }} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No routes added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Your routes">
          {rows.map((r) => (
            <li key={r.id} data-testid="coverage-row" className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <span className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 text-gray-700">
                <span>{place(r.origin_city, r.origin_country)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                <span>{place(r.destination_city, r.destination_country)}</span>
                <span className="text-xs text-gray-400">
                  {r.transport_mode ? `(${r.transport_mode})` : '(any mode)'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label={`Remove ${place(r.origin_city, r.origin_country)} to ${place(r.destination_city, r.destination_country)}`}
                className="btn btn-ghost btn-sm text-gray-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl bg-gray-50 p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">Add a route</p>
        <div key={resetKey} className="grid gap-3 sm:grid-cols-2">
          <div>
            <LocationAutocomplete id="coverage-origin" label="From" placeholder="Search a city" onSelect={setOrigin} />
            <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <input type="checkbox" className="checkbox checkbox-sm" checked={originWhole}
                onChange={(e) => setOriginWhole(e.target.checked)} />
              Cover the whole country
            </label>
            {originWhole && (
              <p className="text-xs text-gray-500 mt-1">
                {origin ? `Will cover all of ${origin.country}` : 'The country comes from the city you choose.'}
              </p>
            )}
          </div>
          <div>
            <LocationAutocomplete id="coverage-destination" label="To" placeholder="Search a city" onSelect={setDestination} />
            <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <input type="checkbox" className="checkbox checkbox-sm" checked={destinationWhole}
                onChange={(e) => setDestinationWhole(e.target.checked)} />
              Cover the whole country
            </label>
            {destinationWhole && (
              <p className="text-xs text-gray-500 mt-1">
                {destination ? `Will cover all of ${destination.country}` : 'The country comes from the city you choose.'}
              </p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="coverage-mode" className="block text-sm font-semibold text-gray-700 mb-1">Transport mode</label>
          <select id="coverage-mode" className="select select-bordered select-sm w-full sm:w-48"
            value={mode} onChange={(e) => setMode(e.target.value as TransportMode | '')}>
            <option value="">Any mode</option>
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={add} disabled={busy}
          className="btn btn-sm text-white border-0 self-start" style={{ backgroundColor: '#FF6A00' }}>
          {busy ? 'Adding…' : 'Add route'}
        </button>
      </div>
    </div>
  );
}
