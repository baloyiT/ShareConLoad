'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { STAGE_3_PUBLIC } from '@/services/releaseFlags';

export type Stage3Audience =
  | 'admin'
  | 'operator'
  | 'agent'
  | 'measurement_agent'
  | 'transporter'
  | 'has_booking'
  | 'has_containers';

type ProfileRow = { role_type: string | null; is_admin: boolean | null };

async function userMatches(allow: Stage3Audience[]): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('role_type, is_admin')
    .eq('user_id', user.id);
  if (profileError) throw profileError;

  const rows = (profiles ?? []) as ProfileRow[];
  if (rows.some((p) => p.is_admin === true)) return true; // admin always matches
  if (rows.some((p) => allow.some((a) => a === p.role_type))) return true;

  if (allow.includes('has_booking')) {
    const { data, error } = await supabase
      .from('bookings').select('id').eq('customer_id', user.id).limit(1);
    if (error) throw error;
    if ((data ?? []).length > 0) return true;
  }
  if (allow.includes('has_containers')) {
    const { data, error } = await supabase
      .from('containers').select('id').eq('operator_id', user.id).limit(1);
    if (error) throw error;
    if ((data ?? []).length > 0) return true;
  }
  return false;
}

export default function Stage3Gate({ allow, children }: { allow: Stage3Audience[]; children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(STAGE_3_PUBLIC);

  useEffect(() => {
    if (STAGE_3_PUBLIC) return;
    let cancelled = false;
    userMatches(allow)
      .then((ok) => {
        if (cancelled) return;
        if (ok) setAllowed(true);
        else router.replace('/');
      })
      .catch((err) => {
        console.error('Stage3Gate audience check failed:', err);
        if (!cancelled) router.replace('/'); // fail closed
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Render nothing until the check passes, so protected content never flashes.
  if (!allowed) return null;
  return <>{children}</>;
}
