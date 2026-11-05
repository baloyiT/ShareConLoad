'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LocationAutocomplete from '@/components/LocationAutocomplete';

const MAX_WHAT_LENGTH = 500;

export function buildEnquiryContactUrl(what: string, from: string, to: string): string {
  // Array.from counts whole characters, so the cut never splits an emoji.
  // Half an emoji would make encodeURIComponent throw.
  const shortened = Array.from(what).slice(0, MAX_WHAT_LENGTH).join('');
  const message = [
    `What I need to move: ${shortened}`,
    `From: ${from.trim() || 'Not sure'}`,
    `To: ${to.trim() || 'Not sure'}`,
  ].join('\n');
  return `/contact?subject=${encodeURIComponent('Freight enquiry')}&message=${encodeURIComponent(message)}`;
}

export default function HomeEnquiryForm() {
  const router = useRouter();
  const [what, setWhat] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        onChange={(e) => setWhat(e.target.value)}
        placeholder="Furniture from a two-bedroom home"
        className="textarea textarea-bordered w-full text-sm"
      />
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
