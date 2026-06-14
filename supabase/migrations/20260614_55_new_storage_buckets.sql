-- Create storage buckets for new role document uploads
insert into storage.buckets (id, name, public)
values
  ('measurement-agent-docs', 'measurement-agent-docs', false),
  ('transporter-docs', 'transporter-docs', false)
on conflict (id) do nothing;

-- measurement-agent-docs: authenticated upload to own folder
drop policy if exists "measurement_agent_docs_insert" on storage.objects;
create policy "measurement_agent_docs_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'measurement-agent-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- measurement-agent-docs: owner read
drop policy if exists "measurement_agent_docs_select" on storage.objects;
create policy "measurement_agent_docs_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'measurement-agent-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (select is_admin())
    )
  );

-- transporter-docs: authenticated upload to own folder
drop policy if exists "transporter_docs_insert" on storage.objects;
create policy "transporter_docs_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transporter-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- transporter-docs: owner read
drop policy if exists "transporter_docs_select" on storage.objects;
create policy "transporter_docs_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transporter-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (select is_admin())
    )
  );
