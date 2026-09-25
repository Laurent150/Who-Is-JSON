-- Run AFTER the migration against a disposable Supabase project / local database.
-- This transaction rolls back all fixtures. Do not claim this is executed by npm test.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','who-test-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','who-test-b@example.invalid');
do $$ begin
 if has_table_privilege('anon','public.who_libraries','SELECT') or
    has_table_privilege('authenticated','public.who_libraries','UPDATE') or
    has_function_privilege('anon','public.who_save_library(bigint,jsonb)','EXECUTE') then
   raise exception 'Unexpected grants';
 end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare result jsonb; begin
 result := public.who_save_library(0,'{"knowledge":[],"cards":[]}'::jsonb);
 if result->>'revision' <> '1' then raise exception 'Initial save failed'; end if;
 result := public.who_save_library(0,'{"knowledge":[],"cards":[]}'::jsonb);
 if result->>'conflict' <> 'true' then raise exception 'Stale write was accepted'; end if;
 if (select count(*) from public.who_libraries) <> 1 then raise exception 'Own read failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select from public.who_libraries) then raise exception 'Cross-account read'; end if;
 perform public.who_save_library(0,'{"knowledge":[],"cards":[]}'::jsonb);
 if exists(select from public.who_libraries where user_id <> auth.uid()) then raise exception 'Cross-account write/read'; end if;
end $$;
rollback;
