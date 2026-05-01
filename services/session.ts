import { cookies } from 'next/headers';

export type ActiveSession = {
  profile_id: string;
  role_type: 'customer' | 'operator';
};

export async function setActiveSession(data: ActiveSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('scl_active_profile', JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('scl_active_profile')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}
