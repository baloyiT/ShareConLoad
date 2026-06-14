// actions/adminMeasurementAgentActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
  return Array.isArray(data) && data.some((p) => p.is_admin === true);
}

export async function approveMeasurementAgent(measurementAgentProfileId: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('measurement_agent_profiles')
    .select('profile_id')
    .eq('id', measurementAgentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Measurement agent profile not found.' };

  const { error } = await supabase
    .from('measurement_agent_profiles')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', measurementAgentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Measurement Agent Application Approved',
      message: 'Congratulations! Your measurement agent application has been approved. You can now access the Measurement Agent Portal.',
      type:    'success',
    });
  }

  revalidatePath('/admin/measurement-agents');
  return {};
}

export async function rejectMeasurementAgent(measurementAgentProfileId: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('measurement_agent_profiles')
    .select('profile_id')
    .eq('id', measurementAgentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Measurement agent profile not found.' };

  const { error } = await supabase
    .from('measurement_agent_profiles')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', measurementAgentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Measurement Agent Application Update',
      message: `Your measurement agent application was not approved. Reason: ${reason}. You may resubmit after addressing the issues.`,
      type:    'warning',
    });
  }

  revalidatePath('/admin/measurement-agents');
  return {};
}
