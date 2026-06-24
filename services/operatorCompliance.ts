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
