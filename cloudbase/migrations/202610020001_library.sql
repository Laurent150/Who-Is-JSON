-- Apply once in the checked CloudBase environment. Does not touch Supabase.
-- Verified catalog: auth.uid() returns JWT sub as text; auth.users.id is bigint.
-- Store the opaque subject, NOT the internal numeric ID. Do not cast to bigint.
-- No foreign key to auth.users.sub: its uniqueness has not been established.
-- Account deletion must explicitly remove its library; no cascade is assumed.
begin;
create table public.fimi_libraries (
  user_id text primary key check (char_length(user_id) between 1 and 255),
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{"knowledge":[],"cards":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint bounded_library check (
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload->'knowledge') = 'array'
    and jsonb_typeof(payload->'cards') = 'array'
    and jsonb_array_length(payload->'knowledge') <= 500
    and jsonb_array_length(payload->'cards') <= 60
    and octet_length(payload::text) <= 2000000
    and payload ?& array['knowledge','cards']
  )
);
alter table public.fimi_libraries enable row level security;
revoke all on public.fimi_libraries from public, anon, authenticated;
grant select on public.fimi_libraries to authenticated;
create policy own_library on public.fimi_libraries for select to authenticated
  using (user_id = (select auth.uid()));

-- The only write path: derive owner from JWT and compare revisions atomically.
create function public.fimi_save_library(expected_revision bigint, new_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id text := nullif(auth.uid(), ''); saved_revision bigint;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if expected_revision is null or expected_revision < 0 or new_payload is null then
    raise exception 'Invalid library';
  end if;
  insert into public.fimi_libraries(user_id) values(owner_id) on conflict do nothing;
  update public.fimi_libraries
    set payload = new_payload, revision = revision + 1, updated_at = now()
    where user_id = owner_id and revision = expected_revision
    returning revision into saved_revision;
  if saved_revision is null then return jsonb_build_object('conflict', true); end if;
  return jsonb_build_object('revision', saved_revision);
end $$;
revoke all on function public.fimi_save_library(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.fimi_save_library(bigint, jsonb) to authenticated;
commit;
