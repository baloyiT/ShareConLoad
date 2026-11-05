// services/operatorCompliance.ts
// Single source of truth for entity-aware operator compliance requirements.

export const COMPANY_DOC_TYPES = [
  'identity',
  'business_registration',
  'proof_of_warehouse_address',
  'tax_clearance',
  'banking_confirmation',
] as const;

export const INDIVIDUAL_DOC_TYPES = [
  'identity',
  'proof_of_warehouse_address',
  'banking_confirmation',
] as const;

export const ID_TYPES: { value: string; label: string }[] = [
  { value: 'passport',        label: 'Passport' },
  { value: 'national_id',     label: 'National ID' },
  { value: 'drivers_license', label: "Driver's Licence" },
];

// Entity logic is binary: only 'individual' is treated as an individual;
// company / partnership / trust all use the company requirements.
export function isIndividual(entity: string | null | undefined): boolean {
  return entity === 'individual';
}

export function requiredDocTypes(entity: string | null | undefined): string[] {
  return isIndividual(entity) ? [...INDIVIDUAL_DOC_TYPES] : [...COMPANY_DOC_TYPES];
}

// Front door listing: lighter than the Stage 3 requirements above.
export type VerificationLevel = 'registered' | 'identity_verified' | 'business_verified';
export type ParticipationStatus = 'pending' | 'active' | 'suspended' | 'deactivated';

export function listingDocTypes(entity: string | null | undefined): string[] {
  return isIndividual(entity) ? ['identity'] : ['identity', 'business_registration'];
}

// Admin verification: the one level this operator's approved documents can support, and what is missing.
// A company earns Business verified, an individual earns Identity verified. Nothing else is offered.
export function verifiableLevel(
  entity: string | null | undefined,
  approvedDocTypes: string[],
): { level: 'identity_verified' | 'business_verified'; missing: string[] } {
  const missing = listingDocTypes(entity).filter((t) => !approvedDocTypes.includes(t));
  return { level: isIndividual(entity) ? 'identity_verified' : 'business_verified', missing };
}

// Must match the check on operator_profiles.trading_name in migration _87.
export const TRADING_NAME_MAX_LENGTH = 120;
export const TRADING_NAME_VISIBLE_CHARACTER =
  '[^\\u0001-\\u0020\\u007F-\\u00A0\\u00AD\\u034F\\u061C\\u115F\\u1160\\u1680\\u17B4\\u17B5\\u180E\\u2000-\\u200F\\u2028-\\u202F\\u205F-\\u206F\\u2800\\u3000\\u3164\\uFE00-\\uFE0F\\uFEFF\\uFFA0]';

export function isBlankTradingName(name: string | null | undefined): boolean {
  return !name || !new RegExp(TRADING_NAME_VISIBLE_CHARACTER, 'u').test(name);
}

export function verificationLabel(level: VerificationLevel): string | null {
  if (level === 'business_verified') return 'Business verified';
  if (level === 'identity_verified') return 'Identity verified';
  return null;
}

// Entity-aware label/description overrides for the two doc types whose meaning
// differs by entity. Returns {} when the default (company-oriented) text applies.
export function docLabelOverride(
  docType: string,
  entity: string | null | undefined,
): { label?: string; desc?: string } {
  if (!isIndividual(entity)) return {};
  if (docType === 'identity') {
    return { label: 'Proof of Identity', desc: 'Your valid passport or national ID' };
  }
  if (docType === 'proof_of_warehouse_address') {
    return {
      label: 'Proof of Residential Address',
      desc: 'Utility bill, bank statement, or lease agreement confirming your home address',
    };
  }
  return {};
}
