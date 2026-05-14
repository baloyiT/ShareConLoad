-- Platform commission configuration (singleton table)
create table if not exists public.platform_commission_config (
  id              uuid primary key default gen_random_uuid(),
  commission_type text not null default 'tiered'
                  check (commission_type in ('fixed', 'tiered')),
  fixed_rate      numeric(5,4) default 0.05,
  tiers           jsonb not null default '[]'::jsonb,
  updated_at      timestamptz default now(),
  updated_by      uuid references auth.users(id)
);

-- Enforce exactly one row via unique index on a constant expression
create unique index if not exists commission_config_singleton
  on public.platform_commission_config ((true));

-- Seed default tiered rates
insert into public.platform_commission_config (commission_type, fixed_rate, tiers)
values (
  'tiered',
  0.05,
  '[
    {"min": 0,     "max": 5000,  "rate": 0.12},
    {"min": 5001,  "max": 20000, "rate": 0.10},
    {"min": 20001, "max": 50000, "rate": 0.08},
    {"min": 50001, "max": null,  "rate": 0.06}
  ]'::jsonb
)
on conflict do nothing;

-- RLS: admins only
alter table public.platform_commission_config enable row level security;

drop policy if exists "commission_config_admin_all" on public.platform_commission_config;
create policy "commission_config_admin_all"
  on public.platform_commission_config
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  );
