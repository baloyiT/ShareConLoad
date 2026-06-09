create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  country    text not null,
  subject    text not null,
  message    text not null,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

drop policy if exists "Anyone can insert contact submissions" on public.contact_submissions;
create policy "Anyone can insert contact submissions"
  on public.contact_submissions for insert
  with check (true);

drop policy if exists "Admins can read contact submissions" on public.contact_submissions;
create policy "Admins can read contact submissions"
  on public.contact_submissions for select
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and is_admin = true
    )
  );
