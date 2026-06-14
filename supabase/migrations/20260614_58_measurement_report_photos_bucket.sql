-- supabase/migrations/20260614_58_measurement_report_photos_bucket.sql

insert into storage.buckets (id, name, public)
values ('measurement-report-photos', 'measurement-report-photos', false)
on conflict (id) do nothing;

drop policy if exists "Agent can upload report photos" on storage.objects;
create policy "Agent can upload report photos" on storage.objects
  for insert with check (
    bucket_id = 'measurement-report-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Admin can read report photos" on storage.objects;
create policy "Admin can read report photos" on storage.objects
  for select using (
    bucket_id = 'measurement-report-photos'
    and (select is_admin())
  );

drop policy if exists "Shipper can read own job photos" on storage.objects;
create policy "Shipper can read own job photos" on storage.objects
  for select using (
    bucket_id = 'measurement-report-photos'
    and auth.role() = 'authenticated'
  );
