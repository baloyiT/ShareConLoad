// actions/adminAgentActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
  return data?.is_admin === true;
}

export async function approveAgent(agentProfileId: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', agentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Agent Application Approved',
      message: 'Congratulations! Your freight agent application has been approved. You can now access the Agent Portal.',
      type:    'success',
    });
  }

  revalidatePath('/admin/agents');
  return {};
}

export async function rejectAgent(agentProfileId: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', agentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Agent Application Update',
      message: `Your freight agent application was not approved. Reason: ${reason}. You may resubmit after addressing the issues.`,
      type:    'warning',
    });
  }

  revalidatePath('/admin/agents');
  return {};
}
