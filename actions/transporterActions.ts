// actions/transporterActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { redirect } from 'next/navigation';

export async function createTransporterProfile(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | void> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  // Insert profile row for transporter role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, role_type: 'transporter' })
    .select('id')
    .single();

  if (profileError) {
    console.error('transporterActions: profile insert error', profileError);
    if (
      profileError.code === '23505' ||
      profileError.message?.toLowerCase().includes('duplicate') ||
      profileError.message?.toLowerCase().includes('unique')
    ) {
      return { error: 'You already have a profile. Contact support.' };
    }
    return { error: profileError.message };
  }

  // Insert transporter profile details
  const { error: transporterError } = await supabase
    .from('transporter_profiles')
    .insert({
      profile_id:                   profile.id,
      full_name:                    formData.get('full_name') as string,
      phone_number:                 formData.get('phone_number') as string,
      base_city:                    formData.get('base_city') as string,
      base_country:                 formData.get('base_country') as string,
      vehicle_type:                 formData.get('vehicle_type') as string,
      vehicle_capacity_kg:          parseFloat(formData.get('vehicle_capacity_kg') as string) || null,
      vehicle_capacity_cbm:         parseFloat(formData.get('vehicle_capacity_cbm') as string) || null,
      vehicle_registration_number:  formData.get('vehicle_registration_number') as string,
      drivers_licence_url:          formData.get('drivers_licence_url') as string,
      vehicle_ownership_url:        formData.get('vehicle_ownership_url') as string,
      vehicle_photo_1_url:          formData.get('vehicle_photo_1_url') as string,
      vehicle_photo_2_url:          formData.get('vehicle_photo_2_url') as string,
      vehicle_photo_3_url:          formData.get('vehicle_photo_3_url') as string,
      vehicle_photo_4_url:          formData.get('vehicle_photo_4_url') as string,
    });

  if (transporterError) {
    console.error('transporterActions: transporter_profiles insert error', transporterError);
    return { error: transporterError.message };
  }

  // Send confirmation notification
  const { error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      title:   'Application Received',
      message: 'Your transporter application has been submitted and is under review.',
      type:    'info',
    });

  if (notifError) {
    console.error('transporterActions: notification insert error', notifError);
    // Non-fatal — proceed to redirect
  }

  redirect('/transporter');
}
