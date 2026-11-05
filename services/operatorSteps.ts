// Which compliance steps an operator sees, and how far they have got.
// New operators get the five light steps. Operators with containers keep the Stage 3 steps
// and also get the two they need for the directory. Every booking sits on a container,
// so having containers covers operators with existing bookings too.

import { supabase } from '@/services/supabaseClient';
import { isIndividual, listingDocTypes, requiredDocTypes } from '@/services/operatorCompliance';
import { PARTICIPATION_TERMS_VERSION } from '@/services/participationTerms';

export type OperatorStepKey =
  | 'profile'
  | 'contact'
  | 'services'
  | 'documents'
  | 'terms'
  | 'bank'
  | 'agreement';

export type OperatorStep = { key: OperatorStepKey; label: string; desc: string; href: string };

const STEP: Record<OperatorStepKey, OperatorStep> = {
  profile:   { key: 'profile',   label: 'Profile',             desc: 'Your legal details, trading name and public description.',           href: '/operator/compliance/profile' },
  contact:   { key: 'contact',   label: 'Contact',             desc: 'Your private contact details, and the public ones for the directory.', href: '/operator/compliance/contact' },
  services:  { key: 'services',  label: 'Services & coverage', desc: 'The services you offer and the routes you cover.',                    href: '/operator/services' },
  documents: { key: 'documents', label: 'Documents',           desc: 'The documents we need to verify you.',                                href: '/operator/compliance/documents' },
  terms:     { key: 'terms',     label: 'Participation terms', desc: 'Read and accept the operator participation terms.',                   href: '/operator/compliance/terms' },
  bank:      { key: 'bank',      label: 'Bank Account',        desc: 'Payout bank account for receiving transfer payments.',                href: '/operator/bank' },
  agreement: { key: 'agreement', label: 'Service Agreement',   desc: 'Read and sign the ShareConLoad Operator Service Agreement.',          href: '/operator/compliance/agreement' },
};

export const NEW_OPERATOR_STEPS: OperatorStep[] = [
  STEP.profile, STEP.contact, STEP.services, STEP.documents, STEP.terms,
];

export const ESTABLISHED_OPERATOR_STEPS: OperatorStep[] = [
  STEP.profile, STEP.contact, STEP.bank, STEP.documents, STEP.agreement, STEP.services, STEP.terms,
];

// On a failed check the operator gets the new-operator view, which hides Stage 3 links.
export async function hasContainers(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('containers').select('id').eq('operator_id', userId).limit(1);
  if (error) {
    console.error('Could not check operator containers:', error);
    return false;
  }
  return (data ?? []).length > 0;
}

// Acceptance stays closed until the founder approves the terms. The database enforces this;
// here it only decides what operators are told. A failed read counts as closed.
export async function termsOpenForAcceptance(): Promise<boolean> {
  const { data, error } = await supabase
    .from('participation_terms')
    .select('version, open_for_acceptance')
    .eq('is_current', true)
    .maybeSingle();
  if (error) {
    console.error('Could not read the participation terms:', error);
    return false;
  }
  return data?.version === PARTICIPATION_TERMS_VERSION && data.open_for_acceptance === true;
}

export type OperatorProgress = {
  hasOperatorRole: boolean;
  hasOperatorDetails: boolean;
  established: boolean;
  // notOpen: the operator cannot do this step yet. Not done, but not outstanding either.
  steps: (OperatorStep & { done: boolean; notOpen: boolean })[];
};

export async function loadOperatorProgress(userId: string): Promise<OperatorProgress> {
  const established = await hasContainers(userId);
  const defs = established ? ESTABLISHED_OPERATOR_STEPS : NEW_OPERATOR_STEPS;
  const none = defs.map((s) => ({ ...s, done: false, notOpen: false }));

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_type', 'operator')
    .maybeSingle();
  if (!profile) return { hasOperatorRole: false, hasOperatorDetails: false, established, steps: none };

  const { data: op } = await supabase
    .from('operator_profiles')
    .select('id, legal_name, trading_name, phone_number, bank_account_name, paystack_recipient_code, service_agreement_signed_at, entity_type, participation_terms_version')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!op) return { hasOperatorRole: true, hasOperatorDetails: false, established, steps: none };

  const [docs, services, coverage, termsOpen] = await Promise.all([
    supabase.from('compliance_documents').select('doc_type').eq('operator_profile_id', op.id),
    supabase.from('operator_services').select('*', { count: 'exact', head: true }).eq('operator_profile_id', op.id),
    supabase.from('operator_coverage').select('*', { count: 'exact', head: true }).eq('operator_profile_id', op.id),
    termsOpenForAcceptance(),
  ]);

  const uploaded = new Set((docs.data ?? []).map((d) => d.doc_type as string));
  const needed = established ? requiredDocTypes(op.entity_type) : listingDocTypes(op.entity_type);

  const done: Record<OperatorStepKey, boolean> = {
    profile:   !!op.legal_name && (!isIndividual(op.entity_type) || !!op.trading_name?.trim()),
    contact:   !!op.phone_number,
    services:  (services.count ?? 0) > 0 && (coverage.count ?? 0) > 0,
    documents: needed.every((t) => uploaded.has(t)),
    terms:     op.participation_terms_version === PARTICIPATION_TERMS_VERSION,
    bank:      !!op.bank_account_name || !!op.paystack_recipient_code,
    agreement: !!op.service_agreement_signed_at,
  };

  return {
    hasOperatorRole: true,
    hasOperatorDetails: true,
    established,
    steps: defs.map((s) => ({ ...s, done: done[s.key], notOpen: s.key === 'terms' && !done.terms && !termsOpen })),
  };
}
