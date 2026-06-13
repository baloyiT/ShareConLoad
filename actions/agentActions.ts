// actions/agentActions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';
import { setActiveSession } from '@/services/session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateAgentProfile(supabase: Awaited<ReturnType<typeof createServerActionClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (profile) {
    const { data: ap } = await supabase
      .from('agent_profiles')
      .select('id, status')
      .eq('profile_id', profile.id)
      .maybeSingle();
    return { profileId: profile.id, agentProfile: ap };
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({ user_id: userId, role_type: 'agent' })
    .select('id')
    .single();

  if (error || !newProfile) return { profileId: null, agentProfile: null };
  return { profileId: newProfile.id, agentProfile: null };
}

// ─── Step 1: Business Details ──────────────────────────────────────────────────

export async function saveAgentStep1(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { profileId, agentProfile } = await getOrCreateAgentProfile(supabase, user.id);
  if (!profileId) return { error: 'Failed to create profile.' };

  const corridors = formData.getAll('operating_corridors') as string[];

  const payload = {
    profile_id:           profileId,
    business_name:        formData.get('business_name') as string,
    contact_person:       (formData.get('contact_person') as string) || null,
    phone_number:         (formData.get('phone_number') as string) || null,
    country:              (formData.get('country') as string) || 'South Africa',
    operating_corridors:  corridors,
    years_in_operation:   parseInt(formData.get('years_in_operation') as string) || null,
    service_description:  (formData.get('service_description') as string) || null,
    status:               agentProfile?.status === 'approved' ? 'approved' : 'draft',
  };

  const { error } = agentProfile
    ? await supabase.from('agent_profiles').update(payload).eq('profile_id', profileId)
    : await supabase.from('agent_profiles').insert(payload);

  if (error) return { error: error.message };

  await setActiveSession({ profile_id: profileId, role_type: 'agent' });
  redirect('/onboarding/agent/credentials');
}

// ─── Step 2: Credentials ──────────────────────────────────────────────────────

export async function saveAgentStep2(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found. Complete Step 1 first.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({
      license_number:      (formData.get('license_number') as string) || null,
      license_authority:   (formData.get('license_authority') as string) || null,
      license_expiry:      (formData.get('license_expiry') as string) || null,
      registration_number: (formData.get('registration_number') as string) || null,
    })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };
  redirect('/onboarding/agent/documents');
}

// ─── Step 3: Document URLs (called after client-side upload) ──────────────────

export async function saveAgentDocUrls(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found. Complete Step 1 first.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({
      doc_license_url:       (formData.get('doc_license_url') as string) || null,
      doc_business_reg_url:  (formData.get('doc_business_reg_url') as string) || null,
      doc_identity_url:      (formData.get('doc_identity_url') as string) || null,
      doc_proof_address_url: (formData.get('doc_proof_address_url') as string) || null,
    })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };
  redirect('/onboarding/agent/bank');
}

// ─── Step 4: Bank Details ─────────────────────────────────────────────────────

export async function saveAgentStep4(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found. Complete Step 1 first.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({
      bank_name:           (formData.get('bank_name') as string) || null,
      bank_account_holder: (formData.get('bank_account_holder') as string) || null,
      bank_account_number: (formData.get('bank_account_number') as string) || null,
      bank_branch_code:    (formData.get('bank_branch_code') as string) || null,
    })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };
  redirect('/onboarding/agent/review');
}

// ─── Step 5: Submit for review ────────────────────────────────────────────────

export async function submitAgentApplication(
  _prev: { error: string } | null,
  _formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status: 'pending_review' })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };

  await supabase.from('notifications').insert({
    user_id: user.id,
    title:   'Application Submitted',
    message: 'Your freight agent application has been submitted and is under review. We will notify you once a decision has been made.',
    type:    'info',
  }).select().maybeSingle();

  redirect('/onboarding/agent/status');
}

// ─── Switch to agent role ─────────────────────────────────────────────────────

export async function switchToAgent(): Promise<void> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (profile) {
    await setActiveSession({ profile_id: profile.id, role_type: 'agent' });
    redirect('/agent');
  } else {
    redirect('/onboarding/agent');
  }
}

// ─── Add managed shipper (unchanged) ─────────────────────────────────────────

export async function addManagedShipper(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found.' };

  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!agentProfile) return { error: 'Agent profile not found.' };

  const { error: insertError } = await supabase.from('agent_managed_shippers').insert({
    agent_profile_id: agentProfile.id,
    name:             formData.get('name') as string,
    contact_email:    (formData.get('contact_email') as string) || null,
    contact_phone:    (formData.get('contact_phone') as string) || null,
    country:          (formData.get('country') as string) || null,
    notes:            (formData.get('notes') as string) || null,
  });

  if (insertError) return { error: `Failed to add shipper: ${insertError.message}` };
  redirect('/agent/shippers');
}
