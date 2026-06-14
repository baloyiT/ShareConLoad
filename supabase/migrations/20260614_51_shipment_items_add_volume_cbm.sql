-- Add volume_cbm (per unit) to shipment_items.
-- The form captures this value but it was never persisted.

alter table public.shipment_items
  add column if not exists volume_cbm numeric null;
