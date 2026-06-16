// app/admin/fx-rates/page.tsx
'use client';

import { useEffect, useState, useActionState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { updateFxRates, type FxRate } from '@/actions/fxRateActions';

const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'ZAR', label: 'South African Rand (ZAR)' },
  { code: 'GHS', label: 'Ghanaian Cedi (GHS)' },
  { code: 'NGN', label: 'Nigerian Naira (NGN)' },
  { code: 'KES', label: 'Kenyan Shilling (KES)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'XOF', label: 'West African CFA Franc (XOF)' },
  { code: 'EGP', label: 'Egyptian Pound (EGP)' },
];

export default function FxRatesPage() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [state, formAction, isPending] = useActionState(updateFxRates, undefined);

  useEffect(() => {
    supabase
      .from('fx_rates')
      .select('currency_code, rate_to_usd')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((r: Pick<FxRate, 'currency_code' | 'rate_to_usd'>) => { map[r.currency_code] = r.rate_to_usd; });
          setRates(map);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-extrabold text-gray-900">FX Rates</h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6">
          Rates represent: <strong>1 unit of currency = X USD</strong>. Example: ZAR 0.054 means 1 ZAR = $0.054 USD.
          These rates are used to compute the USD equivalent on container listings.
        </div>

        {state?.error && (
          <div className="alert alert-error text-sm mb-4">{state.error}</div>
        )}
        {state?.success && (
          <div className="alert alert-success text-sm mb-4">Rates updated successfully.</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : (
          <form action={formAction} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
            {CURRENCIES.map(({ code, label }) => (
              <div key={code} className="flex items-center gap-4">
                <label className="w-52 text-sm font-medium text-gray-700 shrink-0">{label}</label>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-400">1 {code} =</span>
                  <input
                    name={code}
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    defaultValue={rates[code] ?? ''}
                    placeholder="0.000000"
                    className="input input-bordered input-sm w-36 text-sm"
                    required
                  />
                  <span className="text-sm text-gray-400">USD</span>
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0b103a' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save Rates'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
