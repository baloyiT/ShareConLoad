// Caller checks shared by the Edge Functions.
//
// No URL imports on purpose: plain fetch keeps this file loadable by the Playwright tests, which
// run these same checks against real Auth tokens. tests/front-door-security.spec.ts covers it.
declare const Deno: { env: { get(key: string): string | undefined } };

export const SUPPORT_EMAIL = 'support@shareconload.com';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthResult =
  | { user: AuthUser; error: null }
  | { user: null; error: Response };

export type EmailCaller = 'privileged' | 'user' | 'anonymous';

export type EmailDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// Compares every byte whatever the input, so timing does not reveal how much of a secret matched.
export function safeEqual(a: string, b: string): boolean {
  const left  = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

// An unset secret never matches, so a missing configuration fails closed.
export function isCronRequest(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}

export function isServiceRole(req: Request): boolean {
  const key   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = bearerToken(req.headers.get('Authorization'));
  if (!key || !token) return false;
  return safeEqual(token, key);
}

// Null for a missing, invalid or expired token. The anon and service keys are not users.
async function verifiedUser(req: Request): Promise<AuthUser | null> {
  const token = bearerToken(req.headers.get('Authorization'));
  if (!token) return null;

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;

  const user = await res.json() as { id?: string; email?: string };
  return user.id ? { id: user.id, email: user.email ?? null } : null;
}

// The same rule as is_admin() in the database. A user can have several profile rows.
async function isAdminUser(userId: string): Promise<boolean> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const query = `select=id&user_id=eq.${encodeURIComponent(userId)}&or=(is_admin.eq.true,role_type.eq.admin)&limit=1`;

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/profiles?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return false;

  const rows = await res.json() as unknown[];
  return rows.length > 0;
}

export async function requireUser(req: Request): Promise<AuthResult> {
  const user = await verifiedUser(req);
  if (!user) return { user: null, error: deny(401, 'Sign in required') };
  return { user, error: null };
}

export async function requireAdmin(req: Request): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.error) return auth;
  if (!await isAdminUser(auth.user.id)) {
    return { user: null, error: deny(403, 'Admin access required') };
  }
  return auth;
}

export async function emailCaller(req: Request): Promise<EmailCaller> {
  if (isServiceRole(req)) return 'privileged';
  const user = await verifiedUser(req);
  if (!user) return 'anonymous';
  return await isAdminUser(user.id) ? 'privileged' : 'user';
}

export function decideEmail(request: {
  caller: EmailCaller;
  to?: unknown;
  recipientId?: unknown;
  html?: unknown;
}): EmailDecision {
  const { caller, to, recipientId, html } = request;
  if (caller === 'privileged') return { ok: true };

  if (html !== undefined && html !== null) {
    return { ok: false, status: 403, error: 'Only title and body are accepted' };
  }
  if (caller === 'anonymous' && recipientId) {
    return { ok: false, status: 401, error: 'Sign in required' };
  }
  if (to && (typeof to !== 'string' || to.trim().toLowerCase() !== SUPPORT_EMAIL)) {
    return { ok: false, status: 403, error: 'This recipient is not allowed' };
  }
  return { ok: true };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
