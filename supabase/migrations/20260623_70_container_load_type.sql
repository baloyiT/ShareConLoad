-- 20260623_70_container_load_type.sql
-- Adds exclusive FCL/LCL load type + flat full-container pricing to containers.

alter table containers add column if not exists load_type text not null default 'LCL';
alter table containers add column if not exists full_container_price numeric;
alter table containers add column if not exists full_container_price_usd numeric;

-- Existing rows are all per-CBM shared containers = LCL.
update containers set load_type = 'LCL' where load_type is null;

-- price_per_cbm is meaningless for FCL; allow null there.
alter table containers alter column price_per_cbm drop not null;

-- Allowed values for load_type.
do $$ begin
  alter table containers add constraint containers_load_type_check
    check (load_type in ('FCL','LCL'));
exception when duplicate_object then null; end $$;

-- A row must carry the price field matching its type.
do $$ begin
  alter table containers add constraint containers_price_by_type_check check (
    (load_type = 'LCL' and price_per_cbm is not null) or
    (load_type = 'FCL' and full_container_price is not null)
  );
exception when duplicate_object then null; end $$;
