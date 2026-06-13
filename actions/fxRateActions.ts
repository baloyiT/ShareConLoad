// actions/fxRateActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

export type FxRate = {
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
};

export async function updateFxRates(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) return { error: 'Admin access required.' };

  const CURRENCIES = ['USD', 'ZAR', 'GHS', 'NGN', 'KES', 'GBP', 'EUR', 'XOF', 'EGP'];

  const updates = CURRENCIES.map((code) => {
    const raw = formData.get(code) as string;
    const rate = parseFloat(raw);
    return { currency_code: code, rate_to_usd: rate, updated_at: new Date().toISOString() };
  }).filter((u) => !isNaN(u.rate_to_usd) && u.rate_to_usd > 0);

  const { error } = await supabase
    .from('fx_rates')
    .upsert(updates, { onConflict: 'currency_code' });

  if (error) return { error: error.message };

  revalidatePath('/admin/fx-rates');
  return { success: true };
}
