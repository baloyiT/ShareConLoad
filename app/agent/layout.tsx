import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/services/supabaseServer';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) redirect('/onboarding/agent');

  return <>{children}</>;
}
