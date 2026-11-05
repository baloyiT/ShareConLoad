'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LocationAutocomplete from '@/components/LocationAutocomplete';

const MAX_WHAT_LENGTH = 500;
const MAX_PLACE_LENGTH = 200;

// Array.from counts whole characters, so a cut never splits an emoji.
function cut(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('');
}

export function buildEnquiryContactUrl(what: string, from: string, to: string): string {
  const message = [
    `What I need to move: ${cut(what.trim(), MAX_WHAT_LENGTH)}`,
    `From: ${cut(from.trim(), MAX_PLACE_LENGTH) || 'Not sure'}`,
    `To: ${cut(to.trim(), MAX_PLACE_LENGTH) || 'Not sure'}`,
  ].join('\n');
  // encodeURIComponent throws on a lone surrogate, so replace any with U+FFFD first.
  return `/contact?subject=${encodeURIComponent('Freight enquiry')}&message=${encodeURIComponent(message.toWellFormed())}`;
}

export default function HomeEnquiryForm() {
  const router = useRouter();
  const [what, setWhat] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!what.trim()) {
      setError('Please tell us what you need to move.');
      return;
    }
    setError(null);
    router.push(buildEnquiryContactUrl(what, from, to));
  }

  return (
    <form
      id="get-quotes"
      onSubmit={handleSubmit}
      data-theme="light"
      className="bg-white rounded-2xl p-5 sm:p-6 grid gap-4 shadow-xl scroll-mt-24"
    >
      <h2 className="text-lg font-semibold text-[#081D3A]">
        <label htmlFor="enquiry-what">What do you need to move?</label>
      </h2>
      <textarea
        id="enquiry-what"
        required
        rows={2}
        maxLength={MAX_WHAT_LENGTH}
        value={what}
        onChange={(e) => { setWhat(e.target.value); setError(null); }}
        placeholder="Furniture from a two-bedroom home"
        className="textarea textarea-bordered w-full text-sm"
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LocationAutocomplete
          id="enquiry-from"
          label="From"
          placeholder="Johannesburg, South Africa"
          value={from}
          onChange={setFrom}
        />
        <LocationAutocomplete
          id="enquiry-to"
          label="To"
          placeholder="Accra, Ghana"
          value={to}
          onChange={setTo}
        />
      </div>
      <button
        type="submit"
        className="w-full text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
      >
        Continue
      </button>
      <p className="text-center text-sm text-[#6B7280]">
        Already know what you need?{' '}
        <Link href="/directory" className="font-semibold text-[#081D3A] underline">
          Browse operators
        </Link>
      </p>
    </form>
  );
}
