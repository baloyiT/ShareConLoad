'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';
import { setActiveSession } from '@/services/session';
import { buildEmailHtml } from '@/services/emailTemplates';

// ── createOperatorProfile ─────────────────────────────────────────────────────
// Called from the operator onboarding form via useActionState.
// Signature matches React 19 useActionState: (prevState, formData) => State.
// On success it calls redirect() (throws NEXT_REDIRECT — never returns).
// On failure it returns { error } so the form can display an inline message.

export async function createOperatorProfile(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  // Idempotency — check for an existing COMPLETE operator profile
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'operator')
    .maybeSingle();

  if (existingProfile) {
    const { data: existingOpProfile } = await supabase
      .from('operator_profiles')
      .select('id')
      .eq('profile_id', existingProfile.id)
      .maybeSingle();

    if (existingOpProfile) {
      // Both rows exist — profile is complete, activate and redirect
      // Must run before redirect() — redirect() throws and terminates execution
      await setActiveSession({ profile_id: existingProfile.id, role_type: 'operator' });
      redirect('/operator');
    } else {
      // Orphaned profiles row (operator_profiles missing) — delete it and re-run cleanly
      await supabase.from('profiles').delete().eq('id', existingProfile.id);
    }
  }

  // Step 1 — create the operator role row in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, role_type: 'operator' })
    .select('id')
    .single();

  if (profileError || !profile) {
    return { error: 'Failed to create operator profile. Please try again.' };
  }

  // Step 2 — create the operator detail row (entity-aware)
  const entityType = (formData.get('entity_type') as string) || 'individual';
  const individual = entityType === 'individual';

  if (individual && !(formData.get('id_number') as string)?.trim()) {
    await supabase.from('profiles').delete().eq('id', profile.id);
    return { error: 'ID number is required for individual operators.' };
  }
  if (!individual && !(formData.get('registration_number') as string)?.trim()) {
    await supabase.from('profiles').delete().eq('id', profile.id);
    return { error: 'Registration number is required for companies.' };
  }

  const { error: opError } = await supabase.from('operator_profiles').insert({
    profile_id:          profile.id,
    entity_type:         entityType,
    legal_name:          formData.get('legal_name') as string,
    registration_number: individual ? null : ((formData.get('registration_number') as string) || null),
    vat_number:          individual ? null : ((formData.get('vat_number') as string) || null),
    contact_person:      individual ? null : ((formData.get('contact_person') as string) || null),
    id_type:             individual ? ((formData.get('id_type') as string) || null) : null,
    id_number:           individual ? ((formData.get('id_number') as string) || null) : null,
    country:             (formData.get('country') as string) || 'South Africa',
    phone_number:        (formData.get('phone_number') as string) || null,
    status:              'draft',
  });

  if (opError) {
    console.error('operator_profiles insert failed:', opError);
    // Roll back the profiles row so the user can retry cleanly
    await supabase.from('profiles').delete().eq('id', profile.id);
    return { error: `Failed to save operator details: ${opError.message}` };
  }

  // Fire onboarding notification (DB + email) before redirect
  const legalName = (formData.get('legal_name') as string) ?? '';
  const notifTitle = 'Operator Profile Created';
  const notifBody  = `Your operator profile for "${legalName}" is set up. Complete your compliance documents to start listing containers and accepting bookings.`;

  await supabase.from('notifications').insert({
    recipient_id: user.id,
    event:        'operator.onboarding_submitted',
    title:        notifTitle,
    body:         notifBody,
    metadata:     { legalName },
  });

  await supabase.functions.invoke('send-email', {
    body: {
      recipientId: user.id,
      subject:     notifTitle,
      html:        buildEmailHtml(notifTitle, notifBody),
      text:        notifBody,
    },
  });

  // Must run before redirect() — redirect() throws and terminates execution
  await setActiveSession({ profile_id: profile.id, role_type: 'operator' });
  redirect('/operator');
}

// ── switchToOperator ──────────────────────────────────────────────────────────
// Reusable action for any UI that wants to switch the active role to operator.
// Always redirects — no return value needed.

export async function switchToOperator(): Promise<void> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'operator')
    .maybeSingle();

  if (profile) {
    // Must run before redirect() — redirect() throws and terminates execution
    await setActiveSession({ profile_id: profile.id, role_type: 'operator' });
    redirect('/operator');
  } else {
    redirect('/onboarding/operator');
  }
}

// ── switchToCustomer ──────────────────────────────────────────────────────────
// Reusable action for any UI that wants to switch the active role to customer.
// Always redirects — no return value needed.

export async function switchToCustomer(): Promise<void> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'customer')
    .maybeSingle();

  if (profile) {
    // Must run before redirect() — redirect() throws and terminates execution
    await setActiveSession({ profile_id: profile.id, role_type: 'customer' });
  }

  redirect('/');
}
