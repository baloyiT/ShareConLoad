-- supabase/migrations/20260614_57_bookings_cbm_declaration_columns.sql

alter table bookings
  add column if not exists cbm_declaration_type text not null default 'self_declared'
    check (cbm_declaration_type in ('self_declared','measurement_verified')),
  add column if not exists measurement_report_id uuid references measurement_reports(id),
  add column if not exists cbm_disclaimer_acknowledged_count int not null default 0,
  add column if not exists actual_cbm_at_loading numeric,
  add column if not exists cbm_variance_pct numeric,
  add column if not exists cbm_variance_adjustment numeric;
