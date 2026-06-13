// actions/customerKycActions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';

async function getCustomerProfileId(supabase: Awaited<ReturnType<typeof createServerActionClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_type', 'customer')
    .maybeSingle();
  return data?.id ?? null;
}

// ─── Step 1: Personal Details ─────────────────────────────────────────────────

export async function saveCustomerKycStep1(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const profileId = await getCustomerProfileId(supabase, user.id);
  if (!profileId) return { error: 'Customer profile not found. Please complete sign-up.' };

  const payload = {
    profile_id:           profileId,
    full_name:            formData.get('full_name') as string,
    date_of_birth:        (formData.get('date_of_birth') as string) || null,
    id_type:              formData.get('id_type') as string,
    id_number:            formData.get('id_number') as string,
    phone_number:         (formData.get('phone_number') as string) || null,
    residential_address:  (formData.get('residential_address') as string) || null,
    status:               'pending_review' as const,
  };

  const { data: existing } = await supabase
    .from('customer_kyc')
    .select('id, status')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) {
    const updatePayload = existing.status === 'verified'
      ? payload
      : { ...payload, status: 'pending_review' as const };
    const { error } = await supabase.from('customer_kyc').update(updatePayload).eq('profile_id', profileId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('customer_kyc').insert(payload);
    if (error) return { error: error.message };
  }

  redirect('/onboarding/customer/documents');
}

// ─── Step 2: Save document URLs + submit ──────────────────────────────────────

export async function saveCustomerKycDocs(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const profileId = await getCustomerProfileId(supabase, user.id);
  if (!profileId) return { error: 'Customer profile not found.' };

  const idDocUrl          = formData.get('id_document_url') as string | null;
  const proofAddressUrl   = formData.get('proof_of_address_url') as string | null;

  if (!idDocUrl) return { error: 'Identity document upload is required.' };

  const { error } = await supabase
    .from('customer_kyc')
    .update({
      id_document_url:      idDocUrl,
      proof_of_address_url: proofAddressUrl || null,
      status:               'pending_review',
      submitted_at:         new Date().toISOString(),
    })
    .eq('profile_id', profileId);

  if (error) return { error: error.message };

  await supabase.from('notifications').insert({
    user_id: user.id,
    title:   'Identity Verification Submitted',
    message: 'Your identity verification documents have been submitted and are under review. You will be notified once approved.',
    type:    'info',
  });

  redirect('/onboarding/customer/status');
}
