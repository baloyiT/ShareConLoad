-- Add goods_received to booking_status_history status check constraint
alter table booking_status_history drop constraint if exists booking_status_history_status_check;
do $$ begin
  alter table booking_status_history add constraint booking_status_history_status_check
    check (status in ('pending','confirmed','goods_received','loaded','in_transit','delivered','cancelled'));
exception when duplicate_object then null;
end $$;
