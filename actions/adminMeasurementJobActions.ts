// actions/adminMeasurementJobActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
  return Array.isArray(data) && data.some((p) => p.is_admin === true);
}

export async function assignMeasurementAgent(
  jobId: string,
  agentProfileId: string,
): Promise<{ error: string | null }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { error } = await supabase
    .from('measurement_jobs')
    .update({
      measurement_agent_profile_id: agentProfileId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'paid');

  if (error) return { error: error.message };

  // Notify the agent via profile_id → profiles → user_id chain
  const { data: agentProfile } = await supabase
    .from('measurement_agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (agentProfile?.profile_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', agentProfile.profile_id)
      .maybeSingle();

    if (profile?.user_id) {
      await supabase.from('notifications').insert({
        user_id: profile.user_id,
        type:    'measurement_job_assigned',
        title:   'You have a new measurement job',
        message: 'A measurement job has been assigned to you. Check your jobs list.',
      });
    }
  }

  await supabase.from('audit_logs').insert({
    action:      'measurement_job.agent_assigned',
    target_type: 'measurement_job',
    target_id:   jobId,
    metadata:    { agent_profile_id: agentProfileId },
  });

  revalidatePath('/admin/measurement-jobs');
  return { error: null };
}
