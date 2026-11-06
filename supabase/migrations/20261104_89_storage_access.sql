-- Any signed-in user could read and write agent documents and read measurement photos, and dispute
-- evidence was public to everyone. All three buckets are empty today.
--
-- The paths the clients really use, the same on this branch and at production commit 04f2c62:
--   agent-documents:           <user id>/<doc>_<time>.<ext>, uploaded with upsert. admins_all_agent_docs stays.
--   measurement-report-photos: <measurement agent profile id>/<job id>/<photo>.<ext>, also with upsert.
--     The first folder is the agent's profile id, not the user id. The agent keeps read access because
--     an upsert needs it. The shipper reads through the job id, and "Admin can read report photos" stays.
--   dispute-evidence:          <dispute id>/<time>.<ext>, uploaded without upsert.
--     Only the person who submitted the dispute and an admin can see a dispute or its evidence rows,
--     so the same people get the files.
--
-- Production still links evidence by its public address, and those links stop working here. Nobody can
-- reach a dispute there with 0 bookings. This branch opens evidence through signed links.

drop policy if exists "agents_read_own_docs" on storage.objects;
create policy "agents_read_own_docs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'agent-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or (select public.is_admin()))
  );

drop policy if exists "agents_upload_own_docs" on storage.objects;
create policy "agents_upload_own_docs" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agent-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or (select public.is_admin()))
  );

drop policy if exists "Shipper can read own job photos" on storage.objects;
create policy "Shipper can read own job photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'measurement-report-photos'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] in (
        select ma.id::text
        from public.measurement_agent_profiles ma
        join public.profiles p on p.id = ma.profile_id
        where p.user_id = auth.uid()
      )
      or (storage.foldername(name))[2] in (
        select j.id::text
        from public.measurement_jobs j
        join public.profiles p on p.id = j.shipper_profile_id
        where p.user_id = auth.uid()
      )
    )
  );

update storage.buckets set public = false where id = 'dispute-evidence';

drop policy if exists "public_read_evidence" on storage.objects;
drop policy if exists "dispute_parties_read_evidence" on storage.objects;
create policy "dispute_parties_read_evidence" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] in (
        select d.id::text
        from public.disputes d
        join public.profiles p on p.id = d.submitted_by
        where p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "authenticated_upload_evidence" on storage.objects;
create policy "authenticated_upload_evidence" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] in (
        select d.id::text
        from public.disputes d
        join public.profiles p on p.id = d.submitted_by
        where p.user_id = auth.uid()
      )
    )
  );
