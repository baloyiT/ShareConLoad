import type { VerificationLevel } from './operatorCompliance';

export type TransportMode = 'sea' | 'air' | 'road' | 'rail';

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  transport_mode: TransportMode | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface OperatorService {
  id: string;
  operator_profile_id: string;
  service_category_id: string;
}

export interface OperatorCoverage {
  id: string;
  operator_profile_id: string;
  origin_country: string;
  origin_city: string | null;
  destination_country: string;
  destination_city: string | null;
  transport_mode: TransportMode | null;
}

export interface DirectoryOperator {
  id: string;
  // The trading name if set, otherwise a company's legal name. Never an individual's legal name.
  display_name: string;
  public_description: string | null;
  verification_level: VerificationLevel;
  services: string[];
  coverage: OperatorCoverage[];
}
