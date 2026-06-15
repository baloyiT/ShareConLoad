-- supabase/migrations/20260615_65_commission_tiers_usd.sql
-- Re-denominate commission tier thresholds from ZAR to USD.
-- Tier lookup is always performed on the booking's total_price converted to USD
-- (via fx_rates.rate_to_usd), so thresholds must be currency-agnostic USD values.

update public.platform_commission_config
set tiers = '[
  {"min": 0,    "max": 500,  "rate": 0.12},
  {"min": 501,  "max": 2000, "rate": 0.10},
  {"min": 2001, "max": 5000, "rate": 0.08},
  {"min": 5001, "max": null, "rate": 0.06}
]'::jsonb;
