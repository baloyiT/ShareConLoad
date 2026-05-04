'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchLocations, type Location } from '@/services/locations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-100 text-orange-600 font-semibold not-italic rounded-sm">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
//
// Two modes, both optional — use whichever fits the context:
//
//  Search / controlled-string mode (landing page):
//    <LocationAutocomplete value={str} onChange={setStr} />
//
//  Form / structured mode (create container):
//    <LocationAutocomplete label="Origin" cityField="origin_city"
//      countryField="origin_country" required error={err} onSelect={fn} />

type Props = {
  id?: string;
  placeholder?: string;

  // ── Form mode ───────────────────────────────────────────────────────────────
  label?: string;
  required?: boolean;
  error?: string;
  cityField?: string;
  countryField?: string;
  onSelect?: (loc: Location | null) => void;

  // ── Controlled-string mode ──────────────────────────────────────────────────
  value?: string;
  onChange?: (value: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationAutocomplete({
  id,
  placeholder = 'City or country…',
  label,
  required,
  error,
  cityField,
  countryField,
  onSelect,
  value,
  onChange,
}: Props) {
  const [query, setQuery]         = useState(value ?? '');
  const [results, setResults]     = useState<Location[]>([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selected, setSelected]   = useState<Location | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listRef      = useRef<HTMLUListElement>(null);

  // Sync when parent resets controlled value (e.g. clear filters)
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
      if (!value) { setSelected(null); setResults([]); setOpen(false); }
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Keep active item scrolled into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    (listRef.current.children[activeIdx] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]); setOpen(false); setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchLocations(q);
        setResults(data);
        setOpen(true);
        setActiveIdx(-1);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSelected(null);
    onChange?.(q);
    onSelect?.(null);
    search(q);
  }

  function select(loc: Location) {
    const val = `${loc.city}, ${loc.country}`;
    setQuery(val);
    setSelected(loc);
    onChange?.(val);
    onSelect?.(loc);
    setOpen(false);
    setResults([]);
    setActiveIdx(-1);
  }

  function clear() {
    setQuery('');
    setSelected(null);
    onChange?.('');
    onSelect?.(null);
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) select(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const rawQuery      = query.split(',')[0].trim();
  const showNoResults = open && !loading && results.length === 0 && query.trim().length >= 2;
  const inputBorder   = error
    ? 'input-error'
    : selected
      ? 'border-green-400 focus:border-green-500'
      : '';

  return (
    <div ref={containerRef} className="relative">

      {/* Optional label (form mode) */}
      {label && (
        <label htmlFor={id} className="block mb-1">
          <span className="text-sm font-semibold text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </label>
      )}

      {/* Hidden form inputs (form mode) */}
      {cityField    && <input type="hidden" name={cityField}    value={selected?.city    ?? ''} />}
      {countryField && <input type="hidden" name={countryField} value={selected?.country ?? ''} />}

      {/* Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <PinIcon className="w-4 h-4 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0 && !selected) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          className={`input input-bordered w-full text-sm pl-9 pr-8 ${inputBorder}`}
        />

        {/* Right slot: spinner → clear × */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <span className="loading loading-spinner loading-xs pointer-events-none" style={{ color: '#f97316' }} />
          ) : query ? (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); clear(); }}
              className="text-gray-300 hover:text-gray-500 transition-colors"
              aria-label="Clear"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Validation error (form mode) */}
      {error && (
        <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto"
        >
          {results.map((loc, i) => {
            const active = i === activeIdx;
            return (
              <li
                key={`${loc.city}-${loc.country}-${i}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); select(loc); }}
                className={`flex items-center gap-2.5 px-4 py-2.5 cursor-pointer select-none text-sm transition-colors ${
                  active ? 'bg-orange-50' : 'hover:bg-gray-50'
                }`}
              >
                <PinIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${active ? 'text-orange-400' : 'text-gray-300'}`} />
                <span>
                  <span className="font-semibold text-gray-800">
                    <HighlightMatch text={loc.city} query={rawQuery} />
                  </span>
                  <span className="text-gray-400">, </span>
                  <span className="text-gray-500">
                    <HighlightMatch text={loc.country} query={rawQuery} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No results for &ldquo;<span className="font-medium text-gray-600">{query}</span>&rdquo;
        </div>
      )}
    </div>
  );
}
