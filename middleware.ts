import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/services/supabaseServer';

// ─── Route rules ──────────────────────────────────────────────────────────────

// Requires any authenticated user
const PROTECTED = [
  '/booking',   // booking form
  '/operator',  // operator dashboard + create
  '/onboarding',
];

// Requires the admin role
const ADMIN_ONLY = [
  '/admin',
];

// Redirect logged-in users away from these
const AUTH_PAGES = [
  '/auth/login',
  '/auth/register',
];

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request);

  // Refresh session — keeps the cookie TTL alive on active use
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthed    = !!user;
  const userRole    = user?.user_metadata?.role as string | undefined;

  const isProtected = PROTECTED.some((r)  => pathname.startsWith(r));
  const isAdminOnly = ADMIN_ONLY.some((r) => pathname.startsWith(r));
  const isAuthPage  = AUTH_PAGES.some((r) => pathname.startsWith(r));

  // ── Not logged in → redirect to login ──────────────────────────────────────
  if ((isProtected || isAdminOnly) && !isAuthed) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin routes → admin role only ─────────────────────────────────────────
  if (isAdminOnly && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Already logged in → skip auth pages ────────────────────────────────────
  if (isAuthPage && isAuthed) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

// ─── Matcher ──────────────────────────────────────────────────────────────────
// Run middleware on all routes except Next.js internals and static assets.

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
