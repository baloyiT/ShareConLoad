-- supabase/migrations/20260519_39_message_filter_social_handles.sql
-- Adds social media handle blocking (@username) to the message content filter.

create or replace function check_message_content()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.content ~* '[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  if new.content ~* '(https?://|www\.)\S+' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  if new.content ~* '(\+27|0)[6-8][0-9][\s\-]?\d{3}[\s\-]?\d{4}' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  if new.content ~* '\+\d{1,3}[\s\-]?\d{6,14}' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  -- Social media handles: @letter + 1 or more alphanumeric/underscore/dot chars.
  -- Letter-start requirement avoids blocking time references like @3pm or @9am.
  if new.content ~ '@[a-zA-Z][a-zA-Z0-9_.]+' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  return new;
end;
$$;
