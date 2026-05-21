-- Add photo_urls column to shipment_items
alter table public.shipment_items
  add column if not exists photo_urls text[] default '{}';

-- Create item-photos storage bucket (public, matches dispute-evidence pattern)
insert into storage.buckets (id, name, public)
  values ('item-photos', 'item-photos', true)
  on conflict (id) do nothing;

-- Allow authenticated users to upload
drop policy if exists "authenticated_upload_item_photos" on storage.objects;
create policy "authenticated_upload_item_photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos');

-- Allow public read
drop policy if exists "public_read_item_photos" on storage.objects;
create policy "public_read_item_photos" on storage.objects
  for select using (bucket_id = 'item-photos');
