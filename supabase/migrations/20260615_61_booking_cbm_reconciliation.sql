-- Add goods_received status and CBM reconciliation columns to bookings

-- Drop existing status constraint and recreate with goods_received
alter table bookings drop constraint if exists bookings_status_check;
do $$ begin
  alter table bookings add constraint bookings_status_check
    check (status in ('pending','confirmed','goods_received','loaded','in_transit','delivered','cancelled'));
exception when duplicate_object then null;
end $$;

-- Reconciliation tracking columns
alter table bookings add column if not exists goods_received_at timestamptz;
alter table bookings add column if not exists cbm_reconciliation_status text
  default 'pending'
  check (cbm_reconciliation_status in ('pending','within_threshold','accepted','declined'));
