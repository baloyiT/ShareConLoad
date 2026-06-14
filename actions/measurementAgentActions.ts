// actions/measurementAgentActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { redirect } from 'next/navigation';

export async function createMeasurementAgentProfile(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | void> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  // Insert profile row for measurement_agent role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, role_type: 'measurement_agent' })
    .select('id')
    .single();

  if (profileError) {
    console.error('measurementAgentActions: profile insert error', profileError);
    if (
      profileError.code === '23505' ||
      profileError.message?.toLowerCase().includes('duplicate') ||
      profileError.message?.toLowerCase().includes('unique')
    ) {
      return { error: 'You already have a profile. Contact support.' };
    }
    return { error: profileError.message };
  }

  // Insert measurement agent profile details
  const { error: agentError } = await supabase
    .from('measurement_agent_profiles')
    .insert({
      profile_id:          profile.id,
      full_name:           formData.get('full_name') as string,
      phone_number:        formData.get('phone_number') as string,
      base_city:           formData.get('base_city') as string,
      base_country:        formData.get('base_country') as string,
      id_document_url:     formData.get('id_document_url') as string,
      selfie_url:          formData.get('selfie_url') as string,
      equipment_photo_url: formData.get('equipment_photo_url') as string,
    });

  if (agentError) {
    console.error('measurementAgentActions: measurement_agent_profiles insert error', agentError);
    return { error: agentError.message };
  }

  // Send confirmation notification
  const { error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      title:   'Application Received',
      message: 'Your measurement agent application has been submitted and is under review.',
      type:    'info',
    });

  if (notifError) {
    console.error('measurementAgentActions: notification insert error', notifError);
    // Non-fatal — proceed to redirect
  }

  redirect('/measurement-agent');
}
