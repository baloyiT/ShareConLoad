  insert into storage.buckets (id, name, public)
  values ('dispute-evidence', 'dispute-evidence', true)
  on conflict (id) do nothing;

  -- Allow authenticated users to upload to their dispute folder
  create policy "authenticated_upload_evidence" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'dispute-evidence');

  -- Allow public read of evidence files
  create policy "public_read_evidence" on storage.objects
    for select using (bucket_id = 'dispute-evidence');