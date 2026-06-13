// actions/adminCustomerActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
  return data?.is_admin === true;
}

export async function approveCustomerKyc(kycId: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: kyc } = await supabase
    .from('customer_kyc')
    .select('profile_id')
    .eq('id', kycId)
    .maybeSingle();

  if (!kyc) return { error: 'KYC record not found.' };

  const { error } = await supabase
    .from('customer_kyc')
    .update({ status: 'verified', rejection_reason: null, reviewed_at: new Date().toISOString() })
    .eq('id', kycId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', kyc.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Identity Verified',
      message: 'Your identity has been verified. You can now book container space on ShareConLoad.',
      type:    'success',
    });
  }

  revalidatePath('/admin/customers');
  return {};
}

export async function rejectCustomerKyc(kycId: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: kyc } = await supabase
    .from('customer_kyc')
    .select('profile_id')
    .eq('id', kycId)
    .maybeSingle();

  if (!kyc) return { error: 'KYC record not found.' };

  const { error } = await supabase
    .from('customer_kyc')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
    .eq('id', kycId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', kyc.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Identity Verification Update',
      message: `Your identity verification was not approved. Reason: ${reason}. Please resubmit with the correct documents.`,
      type:    'warning',
    });
  }

  revalidatePath('/admin/customers');
  return {};
}
