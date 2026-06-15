'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { notify } from '@/services/notificationService';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');

    if (!code) {
      router.replace('/auth/login?error=confirmation_failed');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (error) {
        router.replace('/auth/login?error=confirmation_failed');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await notify('user.welcome', {
            recipientId: user.id,
            fullName: (user.user_metadata?.full_name as string) ?? '',
          });
        }
        router.replace('/onboarding');
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
    </div>
  );
}
