-- supabase/migrations/20260613_43_global_currency.sql

-- FX rates table (1 row per currency, manually updated by admin, automated later)
create table if not exists public.fx_rates (
  currency_code  text primary key,
  rate_to_usd    numeric(18, 8) not null check (rate_to_usd > 0),
  updated_at     timestamptz not null default now()
);

-- Seed with approximate rates (admin will correct these)
insert into public.fx_rates (currency_code, rate_to_usd) values
  ('USD', 1.0),
  ('ZAR', 0.054),
  ('GHS', 0.067),
  ('NGN', 0.00063),
  ('KES', 0.0077),
  ('GBP', 1.27),
  ('EUR', 1.08),
  ('XOF', 0.00165),
  ('EGP', 0.020)
on conflict (currency_code) do nothing;

-- RLS: anyone can read rates (needed client-side when listing containers)
alter table public.fx_rates enable row level security;

drop policy if exists "fx_rates_public_read" on public.fx_rates;
create policy "fx_rates_public_read"
  on public.fx_rates for select
  using (true);

drop policy if exists "fx_rates_admin_write" on public.fx_rates;
create policy "fx_rates_admin_write"
  on public.fx_rates for all
  using (public.is_admin())
  with check (public.is_admin());

-- Add currency fields to containers
alter table public.containers
  add column if not exists currency_code    text not null default 'ZAR' references public.fx_rates(currency_code),
  add column if not exists price_per_cbm_usd numeric(18, 2);

-- Back-fill existing containers using seeded rates
update public.containers c
  set price_per_cbm_usd = round(c.price_per_cbm * r.rate_to_usd, 2)
  from public.fx_rates r
  where r.currency_code = c.currency_code
    and c.price_per_cbm_usd is null;
