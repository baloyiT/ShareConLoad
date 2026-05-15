import { supabase } from './supabaseClient';

type AuditPayload = {
  action: string;
  target_type: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  actor_id?: string;
};

export async function logAudit({
  action,
  target_type,
  target_id,
  metadata = {},
  actor_id,
}: AuditPayload): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    action,
    target_type,
    target_id: target_id ?? null,
    metadata,
    actor_id: actor_id ?? null,
  });

  if (error) {
    console.error('[AuditLogger]', action, error.message);
  }
}
