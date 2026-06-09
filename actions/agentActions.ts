'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';
import { setActiveSession } from '@/services/session';

export async function createAgentProfile(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (existingProfile) {
    const { data: existingAgentProfile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('profile_id', existingProfile.id)
      .maybeSingle();

    if (existingAgentProfile) {
      await setActiveSession({ profile_id: existingProfile.id, role_type: 'agent' });
      redirect('/agent');
    } else {
      await supabase.from('profiles').delete().eq('id', existingProfile.id);
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, role_type: 'agent' })
    .select('id')
    .single();

  if (profileError || !profile) {
    return { error: 'Failed to create agent profile. Please try again.' };
  }

  const { error: agentError } = await supabase.from('agent_profiles').insert({
    profile_id:     profile.id,
    business_name:  formData.get('business_name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    phone_number:   (formData.get('phone_number') as string) || null,
    country:        (formData.get('country') as string) || 'South Africa',
  });

  if (agentError) {
    console.error('agent_profiles insert failed:', agentError);
    await supabase.from('profiles').delete().eq('id', profile.id);
    return { error: `Failed to save agent details: ${agentError.message}` };
  }

  await setActiveSession({ profile_id: profile.id, role_type: 'agent' });
  redirect('/agent');
}

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

  if (insertError) {
    return { error: `Failed to add shipper: ${insertError.message}` };
  }

  redirect('/agent/shippers');
}
