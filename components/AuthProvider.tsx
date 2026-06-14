'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // When a refresh token is invalid Supabase fires SIGNED_OUT.
      // Redirect to login so the user sees a clean sign-in form instead
      // of a crash overlay, unless they are already on an auth page.
      if (event === 'SIGNED_OUT' && !pathname.startsWith('/auth')) {
        router.replace('/auth/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return <>{children}</>;
}
