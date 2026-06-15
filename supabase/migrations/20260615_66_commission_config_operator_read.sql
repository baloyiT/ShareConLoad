-- Allow all authenticated users (operators, shippers) to read the commission config.
-- Previously admin-only, which prevented the operator dashboard from showing the fee schedule.

drop policy if exists "commission_config_read_authenticated" on public.platform_commission_config;
create policy "commission_config_read_authenticated"
  on public.platform_commission_config
  for select
  to authenticated
  using (true);
