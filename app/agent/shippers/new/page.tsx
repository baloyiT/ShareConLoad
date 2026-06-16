'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { addManagedShipper } from '@/actions/agentActions';

import { ArrowLeft } from 'lucide-react';
const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Malaysia', 'Mozambique',
  'Namibia', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe',
].sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

export default function AddShipperPage() {
  const [state, formAction, isPending] = useActionState(addManagedShipper, null);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="ShareConLoad" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0b103a' }}>Share</span>
              <span style={{ color: '#ff6a00' }}>Con</span>
              <span style={{ color: '#0b103a' }}>Load</span>
            </span>
          </Link>
          <Link href="/agent/shippers" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Shippers
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-xl font-extrabold text-gray-900 mb-1">Add a Shipper</h1>
        <p className="text-sm text-gray-400 mb-6">Add a client you manage so you can book container space on their behalf.</p>

        {state?.error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Shipper Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              className="input input-bordered w-full text-sm"
              placeholder="Company or individual name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contact Email</label>
            <input
              name="contact_email"
              type="email"
              className="input input-bordered w-full text-sm"
              placeholder="shipper@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone</label>
            <input
              name="contact_phone"
              type="tel"
              className="input input-bordered w-full text-sm"
              placeholder="+27 82 123 4567"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
            <select name="country" className="select select-bordered w-full text-sm">
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="textarea textarea-bordered w-full text-sm"
              placeholder="Optional notes about this shipper"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn w-full text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#16a34a' }}
          >
            {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Add Shipper'}
          </button>
        </form>
      </div>
    </div>
  );
}
